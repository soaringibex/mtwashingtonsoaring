// Standing invariants for the linear wave solver.
//
// 1. Split invariance: subdividing an l² layer into sub-layers that carry the same l²
//    must not change the solution (the transfer composes exactly). A uniform column
//    cannot see a layer-ALIGNMENT error — every layer shares its l² — so the profile
//    here is deliberately non-uniform. This guards the 2026-10-06 bug where the whole
//    l² staircase was applied one segment low (30–40% error, ship-and-forget invisible).
//
// 2. Analytic amplitude: for a uniform atmosphere the closed-form solution is a single
//    mode per Fourier component — w = 2·Re[ i k U ĥ_k e^{ikx} e^{imz} ] × amp(z), with
//    amp(z) = sqrt(ρ_base/ρ(z)). The maximum |w| at any height must match an
//    independently written reference. This guards the real-field factor of 2 (missing it
//    halves every value — a linear error that split-invariance cannot see) and the
//    density amplification's direction and power.
import {
  buildWaveColumn,
  DEFAULT_DAMPING_S,
  dominantWavelengthKm,
  saturateWave,
  solveLinearWave,
  solveLinearWavePadded,
  type WaveColumn,
  type WaveColumnLayer,
  WAVE_GAIN,
} from "../src/lib/linear-wave.ts";
import { sampleField, solveLinearWave3D } from "../src/lib/linear-wave-3d.ts";
import { fft2d } from "../src/lib/fft.ts";
import type { WaveColumnLevel } from "../src/lib/linear-wave.ts";

const G = 9.81;
const GAS_CONSTANT = 287.05;

// ---------------------------------------------------------------- split invariance

const N_LAYERS = 44;
const levels: WaveColumnLevel[] = [];
// Non-uniform stability and wind, in a range that gives a healthy trapped response.
for (let i = 1; i <= N_LAYERS; i += 1) {
  const zM = i * 320;
  const hPa = 1000 * Math.exp(-zM / 8000);
  const n2 = 1.4e-4 * (1 + 0.35 * Math.sin(i * 0.7));
  const theta = 300 * Math.exp((n2 * zM) / G);
  levels.push({
    hPa,
    zM,
    tempC: theta * Math.pow(hPa / 1000, 0.2854) - 273.15,
    speedMs: 18 + 3.5 * Math.sin(i * 0.5),
    dirDeg: 285 + 8 * Math.sin(i * 0.4),
  });
}

const terrain = Array.from({ length: 41 }, (_, i) => {
  const d = (i - 20) * 1200;
  return 400 + 1300 * Math.exp(-(d * d) / (2 * 5000 * 5000)) + 250 * Math.exp(-((d - 6000) ** 2) / (2 * 2500 ** 2));
});

const baseline = buildWaveColumn(levels, 105, 400);
if (!baseline) throw new Error("baseline column failed");

const split = (column: NonNullable<typeof baseline>, n: number) => {
  const layers: WaveColumnLayer[] = [];
  let previousTop = 0;
  for (const layer of column.layers) {
    const span = (layer.zTopM - previousTop) / n;
    for (let i = 1; i <= n; i += 1) {
      layers.push({
        zTopM: previousTop + span * i,
        n2: layer.n2,
        uMs: layer.uMs,
        l2: layer.l2,
        amp: layer.amp,
      });
    }
    previousTop = layer.zTopM;
  }
  return { layers, uSurfaceMs: column.uSurfaceMs, baseM: column.baseM };
};

// Compare at an EXACT common level (every parent layer top exists in the split), so no
// interpolation is involved and the invariance must hold to floating point.
const lineAt = (column: NonNullable<typeof baseline>, target: number) => {
  const solve = solveLinearWave({ terrainM: terrain, dxM: 1200, column });
  if (!solve) throw new Error("solve failed");
  let li = 0;
  for (let i = 1; i < solve.zM.length; i += 1) {
    if (solve.zM[i] <= target) li = i;
  }
  return { z: solve.zM[li], line: solve.w[li] };
};

const target = 3000;
const base = lineAt(baseline, target);
const refined = lineAt(split(baseline, 4), base.z);
if (refined.z !== base.z) throw new Error(`common level missing in the split (${base.z} vs ${refined.z})`);
const rms = (values: number[]) => Math.sqrt(values.reduce((sum, v) => sum + v * v, 0) / values.length);
const difference = Math.sqrt(base.line.reduce((sum, v, i) => sum + (v - refined.line[i]) ** 2, 0) / base.line.length);
const relative = difference / rms(base.line);
if (relative > 0.01) {
  throw new Error(
    `wave solver split-invariance failed at z=${base.z} m: RMS difference ${(100 * relative).toFixed(1)}% of ${rms(base.line).toFixed(2)} m/s — layer alignment or transfer bug`,
  );
}
console.log(`wave solver: split-invariance ok at z=${base.z} m (RMS difference ${(100 * relative).toFixed(3)}%)`);

// ------------------------------------------------------------- analytic amplitude

// Uniform stability and wind: constant N², U = 20 m/s along the transect, sinusoid hill.
const N2 = 1.44e-4;
const U = 20;
const uniformLevels: WaveColumnLevel[] = [];
for (let i = 1; i <= 44; i += 1) {
  const zM = i * 320;
  const hPa = 1000 * Math.exp(-zM / 8000);
  const theta = 300 * Math.exp((N2 * zM) / G);
  uniformLevels.push({
    hPa,
    zM,
    tempC: theta * Math.pow(hPa / 1000, 0.2854) - 273.15,
    speedMs: U,
    dirDeg: 285,
  });
}

const n = 64;
const dxM = 1000;
const lambda = 21000;
const a = 500;
const sinusoid = Array.from({ length: n }, (_, i) => {
  const x = (i - (n - 1) / 2) * dxM;
  return 400 + a * Math.cos((2 * Math.PI * x) / lambda);
});

const uniformColumn = buildWaveColumn(uniformLevels, 105, 400);
if (!uniformColumn) throw new Error("uniform column failed");
const damping = 1e-9;
const uniformSolve = solveLinearWave({ terrainM: sinusoid, dxM, column: uniformColumn, damping });
if (!uniformSolve) throw new Error("uniform solve failed");

// Independent reference: the same windowed, zero-padded terrain spectrum, the
// closed-form per-mode solution, and the density factor re-derived from the synthetic
// profile. The padding mirrors the solver's domain (it is part of the tested contract),
// while the propagation stays a hand-written closed form.
const reference = (zM: number, amp: number): number => {
  const m0 = Math.floor(n / 4);
  const windowed = sinusoid.map((h, i) => {
    const centred = h - 400;
    if (i < m0) return centred * 0.5 * (1 - Math.cos((Math.PI * i) / m0));
    if (i > n - 1 - m0) return centred * 0.5 * (1 - Math.cos((Math.PI * (n - 1 - i)) / m0));
    return centred;
  });
  let N = 1;
  while (N < 3 * n) N *= 2;
  const offset = Math.floor((N - n) / 2);
  const s0 = offset + (n - 1) / 2;
  const hp = new Float64Array(N);
  for (let i = 0; i < n; i += 1) hp[offset + i] = windowed[i];
  const scaleHeight = (GAS_CONSTANT * 290) / G;
  const l2 = N2 / (U * U) - 1 / (4 * scaleHeight * scaleHeight);
  let peak = 0;
  for (let s = 0; s < n; s += 1) {
    const x = (s - (n - 1) / 2) * dxM;
    let value = 0;
    for (let j = 1; j < N / 2; j += 1) {
      const k = (2 * Math.PI * j) / (N * dxM);
      let hkRe = 0;
      let hkIm = 0;
      for (let q = 0; q < N; q += 1) {
        const px = (q - s0) * dxM;
        hkRe += hp[q] * Math.cos(k * px);
        hkIm -= hp[q] * Math.sin(k * px);
      }
      hkRe /= N;
      hkIm /= N;
      const q2 = l2 - k * k;
      const mRe = q2 >= 0 ? Math.sqrt(q2) : 0;
      const mIm = q2 >= 0 ? 0 : Math.sqrt(-q2);
      // ŵ = i k U ĥ e^{imz}, with ĥ = hkRe + i·hkIm and m = mRe + i·mIm.
      const aR = -k * U * hkIm;
      const aI = k * U * hkRe;
      const eR = Math.cos(mRe * zM) * Math.exp(-mIm * zM);
      const eI = Math.sin(mRe * zM) * Math.exp(-mIm * zM);
      const wRe = aR * eR - aI * eI;
      const wIm = aR * eI + aI * eR;
      value += 2 * (wRe * Math.cos(k * x) - wIm * Math.sin(k * x));
    }
    if (Math.abs(value) > peak) peak = Math.abs(value);
  }
  return peak * amp;
};

let failed = false;
for (const targetZ of [1500, 1200 + 7000]) {
  let li = 0;
  for (let i = 1; i < uniformSolve.zM.length; i += 1) {
    if (Math.abs(uniformSolve.zM[i] - targetZ) < Math.abs(uniformSolve.zM[li] - targetZ)) li = i;
  }
  const z = uniformSolve.zM[li];
  // Density factor from the synthetic profile (isothermal-ish, analytic p and T).
  const hPaAt = (height: number) => 1000 * Math.exp(-height / 8000);
  const thetaAt = (height: number) => 300 * Math.exp((N2 * height) / G);
  const tempAt = (height: number) => thetaAt(height) * Math.pow(hPaAt(height) / 1000, 0.2854);
  const baseH = 400;
  const amp = Math.sqrt((hPaAt(baseH) / hPaAt(z)) * (tempAt(z) / tempAt(baseH)));
  const expected = reference(z, amp);
  let peak = 0;
  for (const v of uniformSolve.w[li]) peak = Math.max(peak, Math.abs(v));
  const ratio = peak / expected;
  const ok = ratio > 0.9 && ratio < 1.1;
  if (!ok) failed = true;
  console.log(
    `wave solver: amplitude at z=${z} m: solver ${peak.toFixed(3)} vs reference ${expected.toFixed(3)} m/s (ratio ${ratio.toFixed(3)}) ${ok ? "ok" : "FAILED"}`,
  );
}
if (failed) throw new Error("wave solver amplitude reference failed — check the factor 2 and the density factor");

// ------------------------------------------------------------- saturation rules
//
// Every value is multiplied by WAVE_GAIN (the glider-climb calibration), then capped at
// half each layer's along-transect wind. Blocking is not rescaled here.
const layerStub = (uMs: number, amp: number): WaveColumnLayer => ({ zTopM: 1000, n2: 1e-4, uMs, l2: 1e-7, amp });
const satColumn: WaveColumn = {
  layers: [layerStub(20, 1), layerStub(10, 1)],
  uSurfaceMs: 20,
  baseM: 0,
};
const satSolve = { zM: [1000, 2000], w: [[40, -40, 1.5], [2, -2, 0]] };
const sat = saturateWave(satSolve, satColumn);
// ×WAVE_GAIN (2), then capped at 0.5·U per level (10, then 5): 1.5 → 3, 2 → 4 stay under
const expectSat = [[10, -10, 1.5 * WAVE_GAIN], [2 * WAVE_GAIN, -2 * WAVE_GAIN, 0]];
const close = (a: number[], b: number[]) => a.every((value, i) => Math.abs(value - b[i]) < 1e-12);
if (WAVE_GAIN !== 2 || !close(sat.w[0], expectSat[0]) || !close(sat.w[1], expectSat[1])) {
  throw new Error(`saturation failed: ${JSON.stringify(sat.w)} (gain ${WAVE_GAIN})`);
}
console.log(`wave solver: saturation ok (×${WAVE_GAIN} calibration gain, capped at 0.5·U)`);

// --------------------------------------------- two-layer trapped resonance (Scorer)
//
// A lower layer of depth H (Scorer l1²) over a lid (l2²), with l2² < k² < l1², traps
// the mode whose k solves
//
//     tan(m1 H) = −m1/|m2|,   m1² = l1² − k²,   |m2|² = k² − l2².
//
// A broad Gaussian ridge carries energy at every k, so the solved line's dominant
// wavelength must sit on that resonance. This is the regression that pins the launch
// plane reference, the Rayleigh damping and the shared verticalResponse together.
const TWO_N1 = 2.5e-4; // lower-layer N², s⁻²
const TWO_N2 = 4e-5; // lid N², s⁻²
const TWO_U = 20; // along-transect wind, m/s
const TWO_BASE = 400;
const TWO_LID_ASL = 3400; // the N² step, metres ASL — 3000 m above the base

const twoLevels: WaveColumnLevel[] = [];
for (let zM = 200; zM <= 20000; zM += 200) {
  const theta =
    zM < TWO_LID_ASL
      ? 300 * Math.exp((TWO_N1 * (zM - TWO_BASE)) / G)
      : 300 * Math.exp((TWO_N1 * (TWO_LID_ASL - TWO_BASE)) / G) *
        Math.exp((TWO_N2 * (zM - TWO_LID_ASL)) / G);
  const hPa = 1000 * Math.exp(-zM / 8000);
  twoLevels.push({ hPa, zM, tempC: theta * Math.pow(hPa / 1000, 0.2854) - 273.15, speedMs: TWO_U, dirDeg: 285 });
}

const TWO_N = 1024;
const TWO_DX = 500;
const twoRidge = Array.from({ length: TWO_N }, (_, i) => {
  const x = (i - (TWO_N - 1) / 2) * TWO_DX;
  return TWO_BASE + 500 * Math.exp(-(x * x) / (2 * 4000 * 4000));
});
const twoColumn = buildWaveColumn(twoLevels, 105, TWO_BASE);
if (!twoColumn) throw new Error("two-layer column failed");
const twoSolve = solveLinearWave({ terrainM: twoRidge, dxM: TWO_DX, column: twoColumn, damping: 1e-6 });
if (!twoSolve) throw new Error("two-layer solve failed");

const l1sq = twoColumn.layers[0].l2;
const isLid = (layer: WaveColumnLayer) => layer.n2 < (TWO_N1 + TWO_N2) / 2;
const lidLayer = twoColumn.layers.find(isLid);
if (!lidLayer) throw new Error("two-layer column has no lid");
let H = 0;
for (const layer of twoColumn.layers) if (!isLid(layer)) H = layer.zTopM;
const l2sq = lidLayer.l2;

// Solve tan(m1 H) = −m1/|m2| for k by bisection on the first (π/2, π) branch:
// g(k) = tan(m1 H)·|m2| + m1 is positive at the k where |m2| → 0 and negative as
// m1 H → π/2 from above.
const gOf = (k: number) => {
  const m1 = Math.sqrt(Math.max(l1sq - k * k, 0));
  const m2 = Math.sqrt(Math.max(k * k - l2sq, 0));
  return Math.tan(m1 * H) * m2 + m1;
};
let loK = Math.sqrt(l2sq) + 1e-8;
let hiK = Math.sqrt(Math.max(l1sq - (Math.PI / (2 * H)) ** 2, 0)) - 1e-9;
if (!(gOf(loK) > 0 && gOf(hiK) < 0)) {
  throw new Error(`two-layer bracket failed: g(lo)=${gOf(loK)}, g(hi)=${gOf(hiK)}`);
}
for (let i = 0; i < 100; i += 1) {
  const mid = (loK + hiK) / 2;
  if (gOf(mid) > 0) loK = mid;
  else hiK = mid;
}
const analyticK = (loK + hiK) / 2;
const analyticWavelengthKm = (2 * Math.PI) / analyticK / 1000;

let twoLi = 0;
for (let i = 1; i < twoSolve.zM.length; i += 1) {
  if (Math.abs(twoSolve.zM[i] - 2000) < Math.abs(twoSolve.zM[twoLi] - 2000)) twoLi = i;
}
const measuredKm = dominantWavelengthKm(twoSolve.w[twoLi], TWO_DX);
if (measuredKm === null) throw new Error("dominantWavelengthKm returned null");
const wavelengthError = Math.abs(measuredKm - analyticWavelengthKm) / analyticWavelengthKm;
console.log(
  `wave solver: two-layer duct (l1²=${l1sq.toExponential(3)}, l2²=${l2sq.toExponential(3)}, H=${H} m): ` +
    `analytic λ=${analyticWavelengthKm.toFixed(3)} km, measured λ=${measuredKm.toFixed(3)} km ` +
    `(error ${(100 * wavelengthError).toFixed(2)}%) ${wavelengthError <= 0.05 ? "ok" : "FAILED"}`,
);
if (wavelengthError > 0.05) {
  throw new Error(
    `two-layer resonance wavelength off by ${(100 * wavelengthError).toFixed(1)}% — the layered integration or the wavelength diagnostic has drifted`,
  );
}

// The padded domain's TRUE edge at the shipped α: the wrap-around the earlier
// window-edge metric could not separate from real upwind lift must stay under 15% of
// the peak. This is the metric DEFAULT_DAMPING_S is calibrated on.
const maxAbsLine = (line: number[]) => line.reduce((peak, v) => Math.max(peak, Math.abs(v)), 0);
const shippedPadded = solveLinearWavePadded({ terrainM: twoRidge, dxM: TWO_DX, column: twoColumn });
if (!shippedPadded) throw new Error("padded two-layer solve failed");
const shippedLine = shippedPadded.w[twoLi];
const shippedEdge = Math.max(
  maxAbsLine(shippedLine.slice(0, 16)),
  maxAbsLine(shippedLine.slice(shippedLine.length - 16)),
);
const shippedPeak = maxAbsLine(shippedLine);
const shippedRatio = shippedPeak > 0 ? shippedEdge / shippedPeak : 0;
console.log(
  `wave solver: two-layer duct true edge at α=${DEFAULT_DAMPING_S}: ${(100 * shippedRatio).toFixed(2)}% of the peak ` +
    `(pad ${shippedPadded.padLength}) ${shippedRatio < 0.15 ? "ok" : "FAILED"}`,
);
if (!(shippedRatio < 0.15)) {
  throw new Error(
    `padded-domain wrap contamination ${(100 * shippedRatio).toFixed(1)}% exceeds 15% at α=${DEFAULT_DAMPING_S}`,
  );
}

// -------------------------------------------------- 3-D ridge reduces to the 2-D line
//
// A ridge with no cross-wind variation has ĥ(k, l≠0) = 0, so Smith's 3-D solve must
// reproduce the 2-D transect solve. The comparison runs on the SAME unpadded 256-point
// domain (`pad: false`): the production 2-D solve pads, and comparing two different
// k-grids would measure the quadrature difference (~1% here) rather than the transform.
const N3 = 256;
const DX3 = 500;
const ridge3 = Array.from({ length: N3 }, (_, i) => {
  const x = (i - (N3 - 1) / 2) * DX3;
  return 400 + 800 * Math.exp(-(x * x) / (2 * 5000 * 5000));
});
const grid3 = new Float64Array(N3 * N3);
for (let j = 0; j < N3; j += 1) {
  for (let i = 0; i < N3; i += 1) grid3[j * N3 + i] = ridge3[i];
}
const ridge2d = solveLinearWave({
  terrainM: ridge3,
  dxM: DX3,
  column: uniformColumn,
  damping: DEFAULT_DAMPING_S,
  pad: false,
});
const ridge3d = solveLinearWave3D({ terrainM: grid3, size: N3, dxM: DX3, column: uniformColumn, damping: DEFAULT_DAMPING_S });
if (!ridge2d || !ridge3d) throw new Error("3-D ridge solve failed");
let ridgeLi = 0;
for (let i = 1; i < ridge3d.zM.length; i += 1) {
  if (Math.abs(ridge3d.zM[i] - 3000) < Math.abs(ridge3d.zM[ridgeLi] - 3000)) ridgeLi = i;
}
const ridgeRow = ridge3d.w[ridgeLi].slice(128 * N3, 129 * N3);
const ridgeDiff = Math.sqrt(
  ridge2d.w[ridgeLi].reduce((sum, value, i) => sum + (value - ridgeRow[i]) ** 2, 0) / N3,
);
const ridgeRms = Math.sqrt(ridge2d.w[ridgeLi].reduce((sum, value) => sum + value * value, 0) / N3);
const ridgeError = ridgeDiff / ridgeRms;
console.log(
  `wave solver: 3-D ridge vs 2-D line at z=${ridge3d.zM[ridgeLi]} m: RMS difference ${(100 * ridgeError).toFixed(3)}% ` +
    `of ${ridgeRms.toFixed(3)} m/s ${ridgeError < 0.01 ? "ok" : "FAILED"}`,
);
if (!(ridgeError < 0.01)) {
  throw new Error(`3-D ridge does not reproduce the 2-D solve (${(100 * ridgeError).toFixed(1)}% RMS)`);
}

// ---------------------------------------------- 3-D circular hill: ship-wave pattern
//
// A compact circular Gaussian hill must leave its largest disturbance downstream of
// the crest, not in the cross-stream lobes: |w| 20 km downwind on the centreline must
// exceed |w| 20 km downwind at ±20 km cross-stream.
const SIGMA3 = 6000;
const hill3 = new Float64Array(N3 * N3);
for (let j = 0; j < N3; j += 1) {
  for (let i = 0; i < N3; i += 1) {
    const x = (i - (N3 - 1) / 2) * DX3;
    const y = (j - (N3 - 1) / 2) * DX3;
    hill3[j * N3 + i] = 400 + 700 * Math.exp(-(x * x + y * y) / (2 * SIGMA3 * SIGMA3));
  }
}
const hillSolve = solveLinearWave3D({ terrainM: hill3, size: N3, dxM: DX3, column: uniformColumn, damping: DEFAULT_DAMPING_S });
if (!hillSolve) throw new Error("3-D hill solve failed");
let hillLi = 0;
for (let i = 1; i < hillSolve.zM.length; i += 1) {
  if (Math.abs(hillSolve.zM[i] - 3000) < Math.abs(hillSolve.zM[hillLi] - 3000)) hillLi = i;
}
const hillLine = hillSolve.w[hillLi];
const mid3 = (N3 - 1) / 2;
const sampleAtKm = (xKm: number, yKm: number) =>
  Math.abs(sampleField(hillLine, N3, mid3 + (xKm * 1000) / DX3, mid3 + (yKm * 1000) / DX3));
const centreW = sampleAtKm(20, 0);
const northW = sampleAtKm(20, 20);
const southW = sampleAtKm(20, -20);
console.log(
  `wave solver: 3-D hill wake at ${hillSolve.zM[hillLi].toFixed(0)} m: |w| 20 km downwind centre ${centreW.toFixed(3)} vs ` +
    `±20 km cross-stream ${northW.toFixed(3)}/${southW.toFixed(3)} m/s ` +
    `${centreW > northW && centreW > southW ? "ok" : "FAILED"}`,
);
if (!(centreW > northW && centreW > southW)) {
  throw new Error("3-D hill wake is not concentrated on the downstream centreline");
}

// ------------------------------------------------------------------------- FFT sanity
//
// The ridge and hill are symmetric, so a conjugate or twiddle mistake could cancel in
// both 3-D tests. Pin the transform directly: one asymmetric coefficient against the
// hand-written DFT, then an inverse round trip.
const FN = 8;
const fRe = new Float64Array(FN * FN);
for (let i = 0; i < FN * FN; i += 1) fRe[i] = Math.sin(i * 1.7) + 0.3 * Math.cos(i * 0.9);
const fReCheck = Float64Array.from(fRe);
const fImCheck = new Float64Array(FN * FN);
fft2d(fReCheck, fImCheck, FN);
const checkKx = 1;
const checkKy = 2;
let directRe = 0;
let directIm = 0;
for (let y = 0; y < FN; y += 1) {
  for (let x = 0; x < FN; x += 1) {
    const phase = (-2 * Math.PI * (checkKx * x + checkKy * y)) / FN;
    directRe += fRe[y * FN + x] * Math.cos(phase);
    directIm += fRe[y * FN + x] * Math.sin(phase);
  }
}
if (
  Math.abs(fReCheck[checkKy * FN + checkKx] - directRe) > 1e-9 ||
  Math.abs(fImCheck[checkKy * FN + checkKx] - directIm) > 1e-9
) {
  throw new Error("fft forward transform does not match the direct DFT");
}
fft2d(fReCheck, fImCheck, FN, true);
const fftScale = FN * FN;
for (let i = 0; i < FN * FN; i += 1) {
  if (Math.abs(fReCheck[i] / fftScale - fRe[i]) > 1e-9 || Math.abs(fImCheck[i] / fftScale) > 1e-9) {
    throw new Error("fft inverse round trip does not return the input");
  }
}
console.log("wave solver: fft ok (direct DFT match + inverse round trip)");
