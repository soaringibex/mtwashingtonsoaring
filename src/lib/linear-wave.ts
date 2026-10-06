// Linear mountain-wave solver — steady 2D Boussinesq theory, solved on the terrain's
// Fourier spectrum with a layered vertical integration.
//
//     w'' + (l^2(z) - k^2) w = 0,     l^2 = N^2 / U^2
//
// Surface boundary: w(x, 0) = U(0) dh/dx (from the terrain profile), upper boundary:
// the outgoing solution (radiation aloft). Each layer between column levels is treated
// as a constant-l^2 layer; the outgoing solution is integrated DOWNWARD from the top
// (numerically stable — the desired mode grows along the integration while spurious
// modes decay) and then scaled to satisfy the surface boundary. A small imaginary part
// on l^2 (radiative damping) keeps trapped resonances finite.
//
// Complex numbers are [re, im] pairs.

export type WaveColumnLevel = {
  hPa: number;
  zM: number;
  tempC: number;
  speedMs: number;
  dirDeg: number;
};

export type WaveColumnLayer = { zTopM: number; l2: number };

export type WaveColumn = {
  levels: { zM: number }[];
  layers: WaveColumnLayer[];
  uSurfaceMs: number;
};

export type SolveInput = {
  /** Terrain heights in metres, evenly spaced along the transect. */
  terrainM: number[];
  /** Sample spacing, metres. */
  dxM: number;
  column: WaveColumn;
  /** Radiative damping on l^2 — keeps trapped resonances finite. */
  damping?: number;
};

export type SolveResult = {
  /** Altitude of each solved level, metres (low to high). */
  zM: number[];
  /** w values in m/s: w[levelIndex][xSample]. */
  w: number[][];
};

type C = [number, number];

const G = 9.81;

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
 * N²/U² layers from the model column, ground-first. `transectAzimuthDeg` is the
 * direction the cross-section runs toward (downwind), so U is the wind's component
 * along that line.
 *
 * The shear-curvature term (−U″/U) is deliberately NOT applied: at 25-hPa model
 * spacing the second derivative of the along-wind component is not resolvable to the
 * accuracy the term demands — measured on 2026-10-06, it swung the 16,000 ft response
 * by 3–8× (with a spurious mid-level barrier) in either direction.
 *
 * `forcingHeightM` is the height of the flow that actually clears the terrain (the
 * profile's crest): with a decoupled valley beneath the range, taking the surface wind
 * as the boundary condition under-forces the wave ~3× — the ridge-top flow is the one
 * that climbs the mountain.
 */
export function buildWaveColumn(
  levels: WaveColumnLevel[],
  transectAzimuthDeg: number,
  forcingHeightM: number,
): WaveColumn | null {
  const sorted = [...levels].sort((a, b) => b.hPa - a.hPa);
  if (sorted.length < 4) return null;
  const along = (level: WaveColumnLevel) => alongTransectWind(level.speedMs, level.dirDeg, transectAzimuthDeg);
  const layers: WaveColumnLayer[] = [];
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const lower = sorted[i];
    const upper = sorted[i + 1];
    const dz = upper.zM - lower.zM;
    if (!(dz > 0)) continue;
    const n2 =
      (G / ((potentialTemperature(lower.tempC, lower.hPa) + potentialTemperature(upper.tempC, upper.hPa)) / 2)) *
      ((potentialTemperature(upper.tempC, upper.hPa) - potentialTemperature(lower.tempC, lower.hPa)) / dz);
    const u = (along(lower) + along(upper)) / 2;
    if (!(n2 > 0) || !(u > 0.5)) continue;
    layers.push({ zTopM: upper.zM, l2: n2 / (u * u) });
  }
  if (layers.length < 3) return null;

  const forcing = sorted.reduce((best, level) =>
    Math.abs(level.zM - forcingHeightM) < Math.abs(best.zM - forcingHeightM) ? level : best,
  );
  const uSurfaceMs = along(forcing);
  if (!(Math.abs(uSurfaceMs) > 0.5)) return null;
  return { levels: sorted.map((level) => ({ zM: level.zM })), layers, uSurfaceMs };
}

export function solveLinearWave(input: SolveInput): SolveResult | null {
  const { terrainM, dxM, column } = input;
  const damping = input.damping ?? 0.05;
  const n = terrainM.length;
  if (n < 16 || !(dxM > 0) || column.layers.length < 3) return null;

  // Taper the outer quarter and remove the mean, so the periodic Fourier basis sees a
  // smooth profile.
  const taper = new Array<number>(n).fill(1);
  const m = Math.floor(n / 4);
  for (let i = 0; i < m; i += 1) {
    const t = 0.5 * (1 - Math.cos((Math.PI * i) / m));
    taper[i] = t;
    taper[n - 1 - i] = t;
  }
  const ht = terrainM.map((h, i) => h * taper[i]);
  const mean = ht.reduce((sum, value) => sum + value, 0) / n;
  for (let i = 0; i < n; i += 1) ht[i] -= mean;

  // Integration segments: 0 → first level (uses the lowest layer's properties), then
  // one segment per layer.
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
      const q2 = q2s[Math.max(s - 1, 0)];
      const dz = zl[s] - zl[s + 1]; // negative — downward
      [w, wp] = wAdv(w, wp, q2, dz);
      atBoundary[s] = w;
    }

    // scale to satisfy the surface boundary: w(0) = i k U(0) h_k
    const w0: C = [-k * column.uSurfaceMs * hkIm, k * column.uSurfaceMs * hkRe];
    const scale = cDiv(w0, atBoundary[0]);
    solutions.push({ k, ws: atBoundary.slice(1).map((value) => cMul(value, scale)) });
  }
  if (solutions.length === 0) return null;

  // compose w(x, z) = Re Σ_k w_k(z) e^{ikx}
  const w: number[][] = column.layers.map((_, levelIndex) => {
    const line = new Array<number>(n);
    for (let s = 0; s < n; s += 1) {
      const x = (s - (n - 1) / 2) * dxM;
      let value = 0;
      for (const { k, ws: wsAt } of solutions) {
        const c = wsAt[levelIndex];
        value += c[0] * Math.cos(k * x) - c[1] * Math.sin(k * x);
      }
      line[s] = value;
    }
    return line;
  });

  return { zM: column.layers.map((layer) => layer.zTopM), w };
}
