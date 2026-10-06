// Linear mountain-wave solver — steady 2D theory on the terrain's Fourier spectrum,
// integrated through the model column in layers of constant Scorer parameter.
//
//     w'' + (l²(z) − k²) w = 0,    l² = N²/U² − 1/(4H²)
//
// Each choice here is deliberate (and each was measured at some point in this
// project's audit history):
//
// - The solve is anchored at the MEAN TERRAIN plane, not sea level. The column is
//   truncated there — the valley layers below the ground the wave is launched from do
//   not exist for the wave — and the surface boundary w = U·dh/dx is applied at that
//   plane with the flow AT the plane (the ridge-top flow, not the decoupled valley
//   wind). Output heights are shifted back to ASL through `baseM`.
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
// - A small imaginary part on l² (radiative damping) keeps trapped resonances finite.
// - The outgoing solution is integrated DOWNWARD from the top (numerically stable —
//   the desired mode grows along the integration while spurious modes decay), then
//   scaled once to satisfy the surface boundary.
//
// Complex numbers are [re, im] pairs.

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
  l2: number;
  /** Anelastic amplitude factor at the layer top, sqrt(ρ_base/ρ_top). */
  amp: number;
};

export type WaveColumn = {
  layers: WaveColumnLayer[];
  uSurfaceMs: number;
  /** The mean-terrain plane the column is anchored to, metres ASL. */
  baseM: number;
};

export type SolveInput = {
  /** Terrain heights in metres, evenly spaced along the transect. */
  terrainM: number[];
  /** Sample spacing, metres. */
  dxM: number;
  column: WaveColumn;
  /** Radiative damping on l² — keeps trapped resonances finite. */
  damping?: number;
};

export type SolveResult = {
  /** Altitude of each solved level, metres ASL (low to high). */
  zM: number[];
  /** w values in m/s: w[levelIndex][xSample]. */
  w: number[][];
};

type C = [number, number];

const G = 9.81;
const GAS_CONSTANT = 287.05; // dry air, J kg⁻¹ K⁻¹

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
 * The layered column the solve integrates, anchored at `baseM` (the transect's mean
 * terrain) and truncated at the first critical level above it.
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
      l2: n2 / (u * u) - 1 / (4 * scaleHeight * scaleHeight),
      amp: Math.sqrt((base.hPa / up.hPa) * (upT / baseT)),
    });
  }
  if (layers.length < 3) return null;

  return { layers, uSurfaceMs: along(base), baseM: base.zM };
}

export function solveLinearWave(input: SolveInput): SolveResult | null {
  const { terrainM, dxM, column } = input;
  const damping = input.damping ?? 0.05;
  const n = terrainM.length;
  if (n < 16 || !(dxM > 0) || column.layers.length < 3) return null;

  // Taper the outer quarter of the CENTRED profile: subtracting the mean first makes
  // the tapered ends approach the base plane (0), not sea level — tapering the raw
  // heights left a fake ~600 m valley ramped into each end, worth 7-8% RMS inside the
  // LOA circle and up to 50% at the far upwind end.
  const taper = new Array<number>(n).fill(1);
  const m = Math.floor(n / 4);
  for (let i = 0; i < m; i += 1) {
    const t = 0.5 * (1 - Math.cos((Math.PI * i) / m));
    taper[i] = t;
    taper[n - 1 - i] = t;
  }
  const mean = terrainM.reduce((sum, value) => sum + value, 0) / n;
  const ht = terrainM.map((h, i) => (h - mean) * taper[i]);

  // Integration segments: 0 → first layer top, then one per layer.
  const zl = [0, ...column.layers.map((layer) => layer.zTopM)];

  const solutions: { k: number; ws: C[] }[] = [];
  for (let j = 1; j < n / 2; j += 1) {
    const k = (2 * Math.PI * j) / (n * dxM);

    // terrain Fourier component h_k = Σ h(x) e^{-ikx} / n, x centred on the array
    let hkRe = 0;
    let hkIm = 0;
    for (let s = 0; s < n; s += 1) {
      const x = (s - (n - 1) / 2) * dxM;
      const phase = -k * x;
      hkRe += ht[s] * Math.cos(phase);
      hkIm += ht[s] * Math.sin(phase);
    }
    hkRe /= n;
    hkIm /= n;
    if (Math.hypot(hkRe, hkIm) < 1e-9) continue;

    // l² per layer with damping → q² = l²(1 + iδ) − k²
    const q2s: C[] = column.layers.map((layer) => [layer.l2 - k * k, Math.abs(layer.l2) * damping]);

    // outgoing solution at the top: w = e^{i m z}, w' = i m w
    const mTop = cSqrt(q2s[q2s.length - 1]);
    let w: C = [1, 0];
    let wp: C = [-mTop[1], mTop[0]];
    const atBoundary: C[] = new Array(zl.length);
    atBoundary[zl.length - 1] = w;
    for (let s = zl.length - 2; s >= 0; s -= 1) {
      // Segment s spans (zl[s], zl[s+1]] = (t_{s-1}, t_s], which IS layer s — the
      // segment below the first layer top carries that layer's own l², not the one
      // beneath it. (Getting this index wrong shifts the whole l² staircase down by
      // one layer; a uniform test column cannot see it.)
      const q2 = q2s[s];
      const dz = zl[s] - zl[s + 1]; // negative — downward
      [w, wp] = wAdv(w, wp, q2, dz);
      atBoundary[s] = w;
    }

    // scale to satisfy the surface boundary at the base plane: w(0) = i k U h_k
    const w0: C = [-k * column.uSurfaceMs * hkIm, k * column.uSurfaceMs * hkRe];
    const scale = cDiv(w0, atBoundary[0]);
    solutions.push({ k, ws: atBoundary.slice(1).map((value) => cMul(value, scale)) });
  }
  if (solutions.length === 0) return null;

  // compose w(x, z) = 2·Re Σ_{k>0} w_k(z) e^{ikx}, with the anelastic amplification.
  const w: number[][] = column.layers.map((layer, levelIndex) => {
    const gain = 2 * layer.amp;
    const line = new Array<number>(n);
    for (let s = 0; s < n; s += 1) {
      const x = (s - (n - 1) / 2) * dxM;
      let value = 0;
      for (const { k, ws: wsAt } of solutions) {
        const c = wsAt[levelIndex];
        value += c[0] * Math.cos(k * x) - c[1] * Math.sin(k * x);
      }
      line[s] = value * gain;
    }
    return line;
  });

  return { zM: column.layers.map((layer) => layer.zTopM + column.baseM), w };
}
