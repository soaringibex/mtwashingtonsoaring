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
import { buildWaveColumn, solveLinearWave, type WaveColumnLayer } from "../src/lib/linear-wave.ts";
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
      layers.push({ zTopM: previousTop + span * i, l2: layer.l2, amp: layer.amp });
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

// Independent reference: the same windowed terrain's spectrum, the closed-form per-mode
// solution, and the density factor re-derived from the synthetic profile.
const reference = (zM: number, amp: number): number => {
  const m0 = Math.floor(n / 4);
  const rawMean = sinusoid.reduce((sum, v) => sum + v, 0) / n;
  const windowed = sinusoid.map((h, i) => {
    const centred = h - rawMean;
    if (i < m0) return centred * 0.5 * (1 - Math.cos((Math.PI * i) / m0));
    if (i > n - 1 - m0) return centred * 0.5 * (1 - Math.cos((Math.PI * (n - 1 - i)) / m0));
    return centred;
  });
  const scaleHeight = (GAS_CONSTANT * 290) / G;
  const l2 = N2 / (U * U) - 1 / (4 * scaleHeight * scaleHeight);
  let peak = 0;
  for (let s = 0; s < n; s += 1) {
    const x = (s - (n - 1) / 2) * dxM;
    let value = 0;
    for (let j = 1; j < n / 2; j += 1) {
      const k = (2 * Math.PI * j) / (n * dxM);
      let hkRe = 0;
      let hkIm = 0;
      for (let q = 0; q < n; q += 1) {
        const px = (q - (n - 1) / 2) * dxM;
        hkRe += windowed[q] * Math.cos(k * px);
        hkIm -= windowed[q] * Math.sin(k * px);
      }
      hkRe /= n;
      hkIm /= n;
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
