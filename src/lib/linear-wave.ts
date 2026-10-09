// Linear mountain-wave solver — steady 2D theory on the terrain's Fourier spectrum,
// integrated through the model column in layers of constant Scorer parameter.
//
//     w'' + (l²(z) − k²) w = 0,    l² = N²/U² − 1/(4H²)
//
// Each choice here is deliberate (and each was measured at some point in this
// project's audit history):
//
// - The solve is anchored at the DIVIDING-STREAMLINE plane (`divideStreamline`), not
//   the mean terrain: air below the streamline is blocked, so the
//   obstacle the wave sees is the terrain clipped to max(h, z_d), and the flow at z_d
//   does the forcing. On a strongly stratified day the plane collapses back to the
//   mean terrain; on a near-neutral mixed layer it lifts much of the way to the crest.
// - The terrain passed to the solve is measured from the column's launch plane
//   (`column.baseM`), not from its own mean — callers clip to the launch plane first
//   (the blocked air below it must not force a wave).
// - The column is truncated at the first CRITICAL level above the base (along-transect
//   wind near zero): the linear assumptions fail there, and the outgoing top boundary
//   condition then acts as the absorber.
// - Layers with N² ≤ 0 are kept as evanescent (negative l²) rather than dropped — a
//   dropped layer silently removes its thickness from the geometry.
// - Density: the anelastic amplification sqrt(ρ_base/ρ(z)) is applied to the output
//   (wave amplitude grows as √(ρ₀/ρ) ≈ e^{z/2H}), with the small −1/(4H²) folded
//   into l².
// - The reconstruction multiplies by 2: the Fourier coefficients are the positive-k
//   half only, and a real field needs 2·Re Σ_{k>0} (missing this halves every value —
//   a uniform test column cannot see it, because the error is linear).
// - Shear curvature (−U″/U) is NOT applied: at 25-hPa spacing it is not resolvable;
//   measured 2026-10-06, it swung the response 3–8× in either direction.
// - Damping is Rayleigh friction, not a flat imaginary part on l²: each layer uses a
//   complex effective wind U_κ = U − iα/κ in l² = N²/U_κ², so friction enters as a
//   rate (α, s⁻¹) and every trapped resonance stays finite. Measured 2026-10-06, the
//   flat δ = 0.05 left the trapped train wrapping the periodic domain (upwind edge
//   60% of the lee peak); α = 1e-3 brings it to the 10% criterion.
// - The solve runs on a zero-padded periodic domain: a power of two with at least one
//   profile length of zeros on each side (73 → 256, 111 → 512). The wrap then sits far
//   outside the terrain, so a weakly damped trapped train cannot masquerade as upwind
//   lift at the window edge; `solveLinearWave` still returns the input length.
// - The output is calibrated and bounded (`saturateWave`), never the solver: a fixed
//   gain fitted to glider climbs, then a cap at half the layer's along-transect wind.
//   Blocking is handled once, by the dividing-streamline launch plane — an extra
//   ×Fr on the amplitude counted it twice (see `WAVE_GAIN`).
// - The outgoing solution is integrated DOWNWARD from the top (numerically stable —
//   the desired mode grows along the integration while spurious modes decay), then
//   scaled once to satisfy the surface boundary.
//
// `verticalResponse` is the shared per-wavenumber vertical structure: the 2-D solver
// calls it with κ² = k² and the 3-D Smith (1980) solver with κ² = k² + l².
//
// Complex numbers are [re, im] pairs.

import { fft1d } from "./fft.ts";

export type WaveColumnLevel = {
  hPa: number;
  zM: number;
  tempC: number;
  speedMs: number;
  dirDeg: number;
};

export type WaveColumnLayer = {
  /** Height of the layer top, relative to the base plane. */
  zTopM: number;
  /** N² of the layer, s⁻². */
  n2: number;
  /** Along-transect wind of the layer, m/s. */
  uMs: number;
  /** Zero-damping Scorer parameter N²/U² − 1/(4H²), m⁻². */
  l2: number;
  /** Anelastic amplitude factor at the layer top, sqrt(ρ_base/ρ_top). */
  amp: number;
};

export type WaveColumn = {
  layers: WaveColumnLayer[];
  uSurfaceMs: number;
  /** The launch plane the column is anchored to, metres ASL. */
  baseM: number;
};

export type SolveInput = {
  /**
   * Terrain heights in metres ASL, evenly spaced along the transect. Measured from
   * `column.baseM` — a dividing-streamline solve should clip the profile to
   * max(h, z_d) first, so the blocked valley floor does not force the wave.
   */
  terrainM: number[];
  /** Sample spacing, metres. */
  dxM: number;
  column: WaveColumn;
  /** Rayleigh friction α, s⁻¹. Larger α damps the trapped wave train harder. */
  damping?: number;
  /**
   * Zero-pad the periodic domain (default true: a power of two with a full profile
   * length of zeros on each side). Set false only to compare against a solver on the
   * SAME domain — the 3-D reduction test does, because two different k-grids differ by
   * quadrature (~1%) and hide the transform check behind that.
   */
  pad?: boolean;
};

export type SolveResult = {
  /** Altitude of each solved level, metres ASL (low to high). */
  zM: number[];
  /** w values in m/s: w[levelIndex][xSample]. */
  w: number[][];
};

export type WaveComplex = [number, number];

type C = WaveComplex;

const G = 9.81;
const GAS_CONSTANT = 287.05; // dry air, J kg⁻¹ K⁻¹

/**
 * The default Rayleigh friction, s⁻¹ — chosen against observations, not a numerical
 * criterion. Hindcasting the map's 3-D solve for every hour of 172 Gorham October
 * flights (2016–2025, fixed-interval loggers, 71,499 straight-flight samples above the
 * crest), the correlation between modelled w and the gliders' measured air w peaked at
 * α ≈ 1e-3 (2e-4 → 0.225, 5e-4 → 0.247, 1e-3 → 0.254, 2e-3 → 0.218, 3e-3 → 0.170 on
 * 2016–2020) and held on the untouched 2021–2025 flights (0.269 → 0.318). Real lee-wave
 * trains fade downstream faster than the lossless theory says; the stronger friction
 * trades away the far-downstream train, and `WAVE_GAIN` restores the primary's
 * amplitude. The earlier pick of 2e-4 came from a wrap-around criterion on a single
 * live day; with the zero-padded 2-D domain the wrap no longer constrains α.
 */
export const DEFAULT_DAMPING_S = 1e-3;

const cAdd = (a: C, b: C): C => [a[0] + b[0], a[1] + b[1]];
const cMul = (a: C, b: C): C => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const cDiv = (a: C, b: C): C => {
  const d = b[0] * b[0] + b[1] * b[1];
  return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d];
};
const cScale = (a: C, s: number): C => [a[0] * s, a[1] * s];
const cSqrt = (a: C): C => {
  const m = Math.hypot(a[0], a[1]);
  return [Math.sqrt((m + a[0]) / 2), Math.sign(a[1] || 1) * Math.sqrt((m - a[0]) / 2)];
};
const cCos = (a: C): C => [Math.cos(a[0]) * Math.cosh(a[1]), -Math.sin(a[0]) * Math.sinh(a[1])];
const cSin = (a: C): C => [Math.sin(a[0]) * Math.cosh(a[1]), Math.cos(a[0]) * Math.sinh(a[1])];

/** Advance (w, w') through a constant-l² layer by a signed distance. */
function wAdv(w: C, wp: C, q2: C, dz: number): [C, C] {
  const mq = cSqrt(q2);
  if (Math.hypot(mq[0], mq[1]) < 1e-9) {
    return [cAdd(w, cScale(wp, dz)), wp];
  }
  const cos = cCos([mq[0] * dz, mq[1] * dz]);
  const sin = cSin([mq[0] * dz, mq[1] * dz]);
  const wNew = cAdd(cMul(w, cos), cMul(cDiv(wp, mq), sin));
  const wpNew = cAdd(cMul([-mq[0], -mq[1]], cMul(w, sin)), cMul(wp, cos));
  return [wNew, wpNew];
}

const potentialTemperature = (tempC: number, hPa: number) =>
  (tempC + 273.15) * (1000 / hPa) ** 0.2854;

/** The wind's component along the transect — full speed when the line is the wind's line. */
const alongTransectWind = (speedMs: number, dirDeg: number, transectAzimuthDeg: number) =>
  speedMs * Math.cos(((dirDeg + 180 - transectAzimuthDeg) * Math.PI) / 180);

/**
 * The layered column the solve integrates, anchored at `baseM` (the launch plane —
 * mean terrain, or `divideStreamline`'s z_d) and truncated at the first critical
 * level above it.
 */
export function buildWaveColumn(
  levels: WaveColumnLevel[],
  transectAzimuthDeg: number,
  baseM: number,
): WaveColumn | null {
  const sorted = [...levels].sort((a, b) => b.hPa - a.hPa);
  if (sorted.length < 6) return null;
  const along = (level: WaveColumnLevel) => alongTransectWind(level.speedMs, level.dirDeg, transectAzimuthDeg);

  // Interpolate a level at exactly the base height.
  let baseIndex = 0;
  while (baseIndex < sorted.length - 1 && sorted[baseIndex + 1].zM <= baseM) baseIndex += 1;
  const lower = sorted[baseIndex];
  const upper = sorted[Math.min(baseIndex + 1, sorted.length - 1)];
  const span = upper.zM - lower.zM;
  const f = span > 0 ? Math.min(Math.max((baseM - lower.zM) / span, 0), 1) : 0;
  // Interpolate the wind as a vector (u, v) — interpolating direction degrees wraps
  // silently across north (350° ↔ 10° would average to 180°).
  const toUV = (level: WaveColumnLevel) => {
    const rad = (level.dirDeg * Math.PI) / 180;
    return { u: -level.speedMs * Math.sin(rad), v: -level.speedMs * Math.cos(rad) };
  };
  const uvLower = toUV(lower);
  const uvUpper = toUV(upper);
  const u = uvLower.u + (uvUpper.u - uvLower.u) * f;
  const v = uvLower.v + (uvUpper.v - uvLower.v) * f;
  const base: WaveColumnLevel = {
    hPa: lower.hPa + (upper.hPa - lower.hPa) * f,
    zM: lower.zM + span * f,
    tempC: lower.tempC + (upper.tempC - lower.tempC) * f,
    speedMs: Math.hypot(u, v),
    dirDeg: ((Math.atan2(-u, -v) * 180) / Math.PI + 360) % 360,
  };
  if (Math.abs(along(base)) <= 0.5) return null;

  // Base plus every level above, stopping at the first critical level.
  const kept: WaveColumnLevel[] = [base];
  for (let i = baseIndex + 1; i < sorted.length; i += 1) {
    kept.push(sorted[i]);
    if (along(sorted[i]) <= 0.5) break;
  }
  if (kept.length < 5) return null;

  const baseT = base.tempC + 273.15;
  const layers: WaveColumnLayer[] = [];
  for (let i = 0; i < kept.length - 1; i += 1) {
    const lo = kept[i];
    const up = kept[i + 1];
    const dz = up.zM - lo.zM;
    if (!(dz > 0)) continue;
    const thetaLo = potentialTemperature(lo.tempC, lo.hPa);
    const thetaUp = potentialTemperature(up.tempC, up.hPa);
    const n2 = (G / ((thetaLo + thetaUp) / 2)) * ((thetaUp - thetaLo) / dz);
    const u = (along(lo) + along(up)) / 2;
    if (!(u > 0.5)) break;
    const upT = up.tempC + 273.15;
    const scaleHeight = (GAS_CONSTANT * ((lo.tempC + 273.15 + upT) / 2)) / G;
    layers.push({
      zTopM: up.zM - base.zM,
      n2,
      uMs: u,
      l2: n2 / (u * u) - 1 / (4 * scaleHeight * scaleHeight),
      amp: Math.sqrt((base.hPa / up.hPa) * (upT / baseT)),
    });
  }
  if (layers.length < 3) return null;

  return { layers, uSurfaceMs: along(base), baseM: base.zM };
}

export type DividingStreamline = {
  /** The launch height, metres ASL: mean + h_c·(1 − Fr), clamped to [mean, crest]. */
  zD: number;
  /** Along-transect wind averaged over [meanM, meanM + h_c], m/s. */
  uEff: number;
  /** Brunt–Väisälä frequency from the mean N² over that layer, s⁻¹. */
  nEff: number;
  /** Froude number U_eff/(N_eff·h_c); ≥ 1 means nothing is blocked. */
  froude: number;
};

/**
 * Sheppard's dividing-streamline height: the flow passes under the crest when
 * Fr = U/(N·h_c) < 1, and the blocked layer below z_d does not force a wave. The
 * effective wind and stability are averaged over the layer the flow has to lift
 * through, [mean terrain, mean terrain + h_c], using the upwind column.
 */
export function divideStreamline(
  levels: WaveColumnLevel[],
  transectAzimuthDeg: number,
  meanM: number,
  crestM: number,
): DividingStreamline {
  if (levels.length === 0) return { zD: meanM, uEff: 0, nEff: 1e-3, froude: 0 };
  const hc = Math.max(0, crestM - meanM);
  const sorted = [...levels].sort((a, b) => b.hPa - a.hPa);
  const along = (level: WaveColumnLevel) =>
    alongTransectWind(level.speedMs, level.dirDeg, transectAzimuthDeg);

  // Overlap-weighted mean N² and wind over the blocked layer.
  let n2Integral = 0;
  let uIntegral = 0;
  let span = 0;
  const layerTop = meanM + hc;
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const lo = sorted[i];
    const up = sorted[i + 1];
    const overlap = Math.min(up.zM, layerTop) - Math.max(lo.zM, meanM);
    if (!(overlap > 0)) continue;
    const dz = up.zM - lo.zM;
    if (!(dz > 0)) continue;
    const thetaLo = potentialTemperature(lo.tempC, lo.hPa);
    const thetaUp = potentialTemperature(up.tempC, up.hPa);
    const n2 = (G / ((thetaLo + thetaUp) / 2)) * ((thetaUp - thetaLo) / dz);
    n2Integral += n2 * overlap;
    uIntegral += ((along(lo) + along(up)) / 2) * overlap;
    span += overlap;
  }

  // N² is floored: a neutral (or unstable) layer is not a divide, and the floor keeps
  // the Froude number finite. `uEff` falls back to the nearest level when the sounding
  // does not reach the layer at all.
  const meanN2 = span > 0 ? n2Integral / span : 1e-6;
  const nEff = Math.sqrt(Math.max(meanN2, 1e-6));
  const uEff =
    span > 0
      ? uIntegral / span
      : along(
          sorted.reduce((best, level) =>
            Math.abs(level.zM - (meanM + hc / 2)) < Math.abs(best.zM - (meanM + hc / 2))
              ? level
              : best,
          ),
        );
  const froude = hc > 0 ? uEff / (nEff * hc) : 0;
  const blocked = Math.min(1, Math.max(0, 1 - froude));
  return { zD: meanM + hc * blocked, uEff, nEff, froude };
}

/**
 * The complex vertical structure for one horizontal wavenumber: the outgoing solution
 * (e^{imz} at the top) integrated DOWNWARD to the base, normalized to w = 1 at the top.
 * Index 0 is the base plane, index s is the top of layer s−1.
 *
 * `kappa2` is the horizontal wavenumber squared the column sees — k² for a 2-D
 * transect, k² + l² for a 3-D mode. Rayleigh friction enters through a complex
 * effective wind U_κ = U − iα/κ, so q² = N²/U_κ² − 1/(4H²) − κ².
 */
export function verticalResponse(column: WaveColumn, kappa2: number, damping: number): C[] {
  const kappa = Math.sqrt(Math.max(kappa2, 0));
  const q2s: C[] = column.layers.map((layer) => {
    // 1/U_κ² with U_κ = u − iα/κ: for u, α > 0 this carries a positive imaginary part
    // (upward decay), which is what keeps a lossless trapped resonance finite.
    const uIm = damping > 0 && kappa > 0 ? -damping / kappa : 0;
    const denom = (layer.uMs * layer.uMs + uIm * uIm) ** 2;
    const invRe = (layer.uMs * layer.uMs - uIm * uIm) / denom;
    const invIm = (-2 * layer.uMs * uIm) / denom;
    // l² = N²/U_κ² + (l²₀ − N²/U₀²), where l²₀ carries the −1/(4H²) term.
    const curv = layer.l2 - layer.n2 / (layer.uMs * layer.uMs);
    return [layer.n2 * invRe + curv - kappa2, layer.n2 * invIm];
  });

  // Outgoing solution at the top: w = e^{imz}, w' = i m w — then integrate down. Each
  // segment (zl[s], zl[s+1]] IS layer s; a staircase shifted by one layer is invisible
  // to a uniform test column and was a real 30–40% bug.
  const zl = [0, ...column.layers.map((layer) => layer.zTopM)];
  const mTop = cSqrt(q2s[q2s.length - 1]);
  let w: C = [1, 0];
  let wp: C = [-mTop[1], mTop[0]];
  const at: C[] = new Array(zl.length);
  at[zl.length - 1] = w;
  for (let s = zl.length - 2; s >= 0; s -= 1) {
    [w, wp] = wAdv(w, wp, q2s[s], zl[s] - zl[s + 1]); // negative — downward
    at[s] = w;
  }
  return at;
}

/**
 * The padded solve length for a profile of `n` samples: a power of two with at least
 * one profile length of zeros on each side (73 → 256, 111 → 512).
 */
export function paddedSolveLength(n: number): number {
  return nearestPowerOfTwo(3 * n);
}

/** The smallest power of two ≥ n. */
function nearestPowerOfTwo(n: number): number {
  let length = 1;
  while (length < n) length *= 2;
  return length;
}

export type PaddedSolveResult = {
  zM: number[];
  /** w on the padded grid, length `paddedSolveLength(terrainM.length)`. */
  w: number[][];
  padLength: number;
  /** Index of the input's first sample on the padded grid. */
  offset: number;
};

/**
 * The 2-D solve on a zero-padded periodic domain. The terrain's centred, tapered
 * profile is embedded in a longer zero-filled array so the periodic wrap sits far
 * outside the obstacle — a weakly damped trapped train then cannot masquerade as
 * upwind lift at the window edge. `solveLinearWave` is the caller-facing wrapper;
 * this variant exposes the padded grid so the live check can measure contamination
 * at the domain's TRUE edge rather than at the (arbitrary) window edge.
 */
export function solveLinearWavePadded(input: SolveInput): PaddedSolveResult | null {
  const { terrainM, dxM, column } = input;
  const damping = input.damping ?? DEFAULT_DAMPING_S;
  const n = terrainM.length;
  if (n < 16 || !(dxM > 0) || column.layers.length < 3) return null;

  // Taper the outer quarter of the input profile. The profile is measured from the
  // column's launch plane (not its own mean): the solve integrates the layers above
  // that plane, and the surface boundary must reference the same origin.
  const taper = new Array<number>(n).fill(1);
  const m = Math.floor(n / 4);
  for (let i = 0; i < m; i += 1) {
    const t = 0.5 * (1 - Math.cos((Math.PI * i) / m));
    taper[i] = t;
    taper[n - 1 - i] = t;
  }
  const N = input.pad === false ? nearestPowerOfTwo(n) : paddedSolveLength(n);
  const offset = Math.floor((N - n) / 2);
  // s0 puts the input's centre sample at x = 0, so the central output samples land
  // exactly on the caller's distance grid even when N − n is odd.
  const s0 = offset + (n - 1) / 2;
  const hp = new Float64Array(N);
  for (let i = 0; i < n; i += 1) {
    hp[offset + i] = (terrainM[i] - column.baseM) * taper[i];
  }

  const solutions: { j: number; k: number; ws: C[] }[] = [];
  for (let j = 1; j < N / 2; j += 1) {
    const k = (2 * Math.PI * j) / (N * dxM);

    // terrain Fourier component h_k = Σ h(x) e^{-ikx} / N on the padded grid
    let hkRe = 0;
    let hkIm = 0;
    for (let s = 0; s < N; s += 1) {
      const value = hp[s];
      if (value === 0) continue;
      const x = (s - s0) * dxM;
      const phase = -k * x;
      hkRe += value * Math.cos(phase);
      hkIm += value * Math.sin(phase);
    }
    hkRe /= N;
    hkIm /= N;
    if (Math.hypot(hkRe, hkIm) < 1e-9) continue;

    const at = verticalResponse(column, k * k, damping);

    // scale to satisfy the surface boundary at the base plane: w(0) = i k U h_k
    const w0: C = [-k * column.uSurfaceMs * hkIm, k * column.uSurfaceMs * hkRe];
    const scale = cDiv(w0, at[0]);
    solutions.push({ j, k, ws: at.slice(1).map((value) => cMul(value, scale)) });
  }
  if (solutions.length === 0) return null;

  // Compose w on the padded grid by inverse FFT. The coefficients are re-phased to the
  // FFT's index origin (e^{−ik s0 dx}), then the positive-k half alone is inverted and
  // the real part doubled — the same 2·Re Σ_{k>0} the direct sum carried.
  const specRe = new Float64Array(N);
  const specIm = new Float64Array(N);
  const w: number[][] = column.layers.map((layer, levelIndex) => {
    specRe.fill(0);
    specIm.fill(0);
    for (const { j, k, ws: wsAt } of solutions) {
      const phaseRe = Math.cos(k * s0 * dxM);
      const phaseIm = -Math.sin(k * s0 * dxM);
      const c = wsAt[levelIndex];
      specRe[j] = c[0] * phaseRe - c[1] * phaseIm;
      specIm[j] = c[0] * phaseIm + c[1] * phaseRe;
    }
    fft1d(specRe, specIm, 0, 1, N, true);
    const gain = 2 * layer.amp;
    const line = new Array<number>(N);
    for (let s = 0; s < N; s += 1) line[s] = gain * specRe[s];
    return line;
  });

  return { zM: column.layers.map((layer) => layer.zTopM + column.baseM), w, padLength: N, offset };
}

export function solveLinearWave(input: SolveInput): SolveResult | null {
  const padded = solveLinearWavePadded(input);
  if (!padded) return null;
  const n = input.terrainM.length;
  return {
    zM: padded.zM,
    w: padded.w.map((line) => line.slice(padded.offset, padded.offset + n)),
  };
}

/**
 * The amplitude gain on the linear solve, fitted to glider climbs. With α = 1e-3 and no
 * Froude scaling, the strongest-lift decile of the 2016–2020 hindcast read 0.82 m/s
 * against 1.64 m/s measured (×2.0); at gain 2 the held-out 2021–2025 decile read
 * 2.28 m/s modelled vs 2.11 m/s measured. The old ×Fr factor (typical Fr 0.2–0.6 here)
 * cut the amplitude 2–5× on days pilots climbed at 3–4 m/s.
 */
export const WAVE_GAIN = 2;

/**
 * Calibrated, bounded output for a physical day — applied to the solve, never inside it.
 *
 *  1. w × WAVE_GAIN (observational calibration, see above). Blocking is NOT scaled
 *     here: the dividing-streamline launch plane already removes the blocked terrain
 *     from the forcing.
 *  2. |w| ≤ 0.5·U at each level, where U is that layer's along-transect wind: the
 *     vertical velocity cannot outrun the flow that carries it.
 */
export function saturateWave(solve: SolveResult, column: WaveColumn): SolveResult {
  const w = solve.w.map((line, levelIndex) => {
    const u = column.layers[levelIndex]?.uMs ?? column.uSurfaceMs;
    const cap = 0.5 * Math.max(u, 0);
    return line.map((value) => Math.min(Math.max(value * WAVE_GAIN, -cap), cap));
  });
  return { zM: solve.zM, w };
}

/**
 * The dominant wavelength (km) along a solved line: the peak of the one-sided
 * spectrum of w, evaluated on a k-grid eight times finer than the sample grid's
 * DFT bins so the peak is not quantized to the bins.
 */
export function dominantWavelengthKm(line: readonly number[], dxM: number): number | null {
  const n = line.length;
  if (n < 8 || !(dxM > 0)) return null;
  const mean = line.reduce((sum, value) => sum + value, 0) / n;
  const oversample = 8;
  let bestPower = 0;
  let bestK = 0;
  for (let bin = 1; bin <= (n / 2 - 1) * oversample; bin += 1) {
    const k = (2 * Math.PI * (bin / oversample)) / (n * dxM);
    let re = 0;
    let im = 0;
    for (let s = 0; s < n; s += 1) {
      const v = line[s] - mean;
      const phase = k * (s - (n - 1) / 2) * dxM;
      re += v * Math.cos(phase);
      im -= v * Math.sin(phase);
    }
    const power = re * re + im * im;
    if (power > bestPower) {
      bestPower = power;
      bestK = k;
    }
  }
  if (!(bestK > 0)) return null;
  return (2 * Math.PI) / bestK / 1000;
}
