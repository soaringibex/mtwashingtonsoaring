// Smith (1980) 3-D linear mountain-wave theory on a real terrain grid, sharing the
// layered vertical structure with the 2-D solver (`verticalResponse`).
//
// The 2-D solve runs one transect with w = U·h′(x) forcing. In 3-D the terrain is
// Fourier transformed in both horizontal directions, and only the ALONG-WIND slope of
// each mode forces a wave:
//
//     ŵ(k, l, z) = i k U · ĥ(k, l) · T(z; κ),   κ² = k² + l²
//
// where T is the same outgoing layered response the 2-D solver integrates downward.
// The reconstruction fills only the k > 0 half of the spectrum and doubles the real
// part (w = 2·Re Σ_{k>0,l} …) — the same ×2 the 2-D solve carries, and for the same
// reason: the coefficients are the half-plane only.
//
// Hydrostatic/non-hydrostatic behaviour all lives in T; the horizontal structure is
// exactly the FFT of the terrain. A cross-wind ridge (no y variation) therefore
// reduces to the 2-D solve, which `check:wave` asserts.

import { fft2d } from "./fft.ts";
import {
  DEFAULT_DAMPING_S,
  verticalResponse,
  type SolveResult,
  type WaveColumn,
} from "./linear-wave.ts";

export type Solve3DInput = {
  /** Terrain heights in metres ASL, row-major: index = crossIndex·size + downwindIndex. */
  terrainM: Float64Array;
  size: number;
  dxM: number;
  column: WaveColumn;
  /** Rayleigh friction α, s⁻¹. */
  damping?: number;
};

/**
 * The 3-D wave field at every column layer top, on the solve grid. The caller clips
 * the terrain to the launch plane first; this solver centres the profile on
 * `column.baseM` and tapers the outer eighth of the grid.
 */
export function solveLinearWave3D(input: Solve3DInput): SolveResult | null {
  const { terrainM, size: n, dxM, column } = input;
  const damping = input.damping ?? DEFAULT_DAMPING_S;
  if (n < 16 || (n & (n - 1)) !== 0 || !(dxM > 0) || column.layers.length < 3) return null;
  if (terrainM.length !== n * n) return null;
  const layerCount = column.layers.length;

  // Centre on the launch plane, then taper the outer eighth with the same cosine
  // window the 2-D solve uses on the outer quarter (the 2-D window is in profile
  // samples; here it is per axis, so an eighth each side keeps the same margin).
  const margin = Math.floor(n / 8);
  const window = new Float64Array(n).fill(1);
  for (let i = 0; i < margin; i += 1) {
    const t = 0.5 * (1 - Math.cos((Math.PI * i) / margin));
    window[i] = t;
    window[n - 1 - i] = t;
  }
  const re = new Float64Array(n * n);
  const im = new Float64Array(n * n);
  for (let y = 0; y < n; y += 1) {
    const wy = window[y];
    for (let x = 0; x < n; x += 1) {
      re[y * n + x] = (terrainM[y * n + x] - column.baseM) * window[x] * wy;
    }
  }
  fft2d(re, im, n);

  // The layered response depends only on κ² (Rayleigh friction uses κ), and κ² is an
  // exact multiple of j² + m² — so identical integer keys share one integration.
  const gridStep = (2 * Math.PI) / (n * dxM);
  const transferCache = new Map<number, Float64Array>();
  const transferOf = (j: number, mSigned: number): Float64Array => {
    const key = j * j + mSigned * mSigned;
    let packed = transferCache.get(key);
    if (!packed) {
      const at = verticalResponse(column, gridStep * gridStep * key, damping);
      // The transfer is the response at each layer top RELATIVE to the base plane
      // (at[s] / at[0]) — the same normalization the 2-D solve applies when it scales
      // to the surface boundary. Raw at[s] grows like e^{|m|·depth} in evanescent
      // layers and would overflow the reconstruction.
      const base = at[0];
      const denom = base[0] * base[0] + base[1] * base[1];
      packed = new Float64Array(2 * layerCount);
      for (let s = 0; s < layerCount; s += 1) {
        const value = at[s + 1];
        packed[2 * s] = (value[0] * base[0] + value[1] * base[1]) / denom;
        packed[2 * s + 1] = (value[1] * base[0] - value[0] * base[1]) / denom;
      }
      transferCache.set(key, packed);
    }
    return packed;
  };

  const norm = 1 / (n * n); // ĥ(k,l) = FFT(h)/n², the coefficient the 2-D solve uses
  const skip = 1e-9 * n * n; // the 2-D solve's |ĥ| < 1e-9 threshold, pre-normalization
  const uSurface = column.uSurfaceMs;
  const specRe = new Float64Array(n * n);
  const specIm = new Float64Array(n * n);
  const w: number[][] = [];
  for (let s = 0; s < layerCount; s += 1) {
    specRe.fill(0);
    specIm.fill(0);
    for (let j = 1; j < n / 2; j += 1) {
      const kU = gridStep * j * uSurface;
      for (let my = 0; my < n; my += 1) {
        const idx = my * n + j;
        const hRe = re[idx];
        const hIm = im[idx];
        if (Math.hypot(hRe, hIm) < skip) continue;
        const mSigned = my <= n / 2 ? my : my - n;
        const t = transferOf(j, mSigned);
        // W = T · (i k U ĥ) = T · (−kU·ĥ_im + i·kU·ĥ_re) / n²
        const fRe = -kU * hIm * norm;
        const fIm = kU * hRe * norm;
        specRe[idx] = t[2 * s] * fRe - t[2 * s + 1] * fIm;
        specIm[idx] = t[2 * s] * fIm + t[2 * s + 1] * fRe;
      }
    }
    fft2d(specRe, specIm, n, true);
    const gain = 2 * column.layers[s].amp; // the ×2 half-plane reconstruction
    const line = new Array<number>(n * n);
    for (let i = 0; i < n * n; i += 1) line[i] = gain * specRe[i];
    w.push(line);
  }

  return { zM: column.layers.map((layer) => layer.zTopM + column.baseM), w };
}

export type RotatedGridInput = {
  size: number;
  dxM: number;
  centreLat: number;
  centreLon: number;
  metresPerDegLat: number;
  metresPerDegLon: number;
  /** The downwind direction the grid's x axis follows, degrees from north. */
  azimuthDeg: number;
  sample: (lat: number, lon: number) => number;
};

/** A square terrain grid centred on a point, rotated so x runs downwind. */
export function buildRotatedTerrainGrid(input: RotatedGridInput): Float64Array {
  const {
    size,
    dxM,
    centreLat,
    centreLon,
    metresPerDegLat,
    metresPerDegLon,
    azimuthDeg,
    sample,
  } = input;
  const rad = (azimuthDeg * Math.PI) / 180;
  const alongE = Math.sin(rad);
  const alongN = Math.cos(rad);
  const crossE = Math.sin(rad + Math.PI / 2);
  const crossN = Math.cos(rad + Math.PI / 2);
  const grid = new Float64Array(size * size);
  const mid = (size - 1) / 2;
  for (let j = 0; j < size; j += 1) {
    const crossM = (j - mid) * dxM;
    for (let i = 0; i < size; i += 1) {
      const alongM = (i - mid) * dxM;
      const lat = centreLat + (alongM * alongN + crossM * crossN) / metresPerDegLat;
      const lon = centreLon + (alongM * alongE + crossM * crossE) / metresPerDegLon;
      grid[j * size + i] = sample(lat, lon);
    }
  }
  return grid;
}

/** Bilinear sample of a flat, row-major size×size field at fractional (i, j). */
export function sampleField(
  field: readonly number[],
  size: number,
  fi: number,
  fj: number,
): number {
  const i = Math.min(Math.max(fi, 0), size - 1.001);
  const j = Math.min(Math.max(fj, 0), size - 1.001);
  const i0 = Math.floor(i);
  const j0 = Math.floor(j);
  const ti = i - i0;
  const tj = j - j0;
  const v00 = field[j0 * size + i0];
  const v10 = field[j0 * size + i0 + 1];
  const v01 = field[(j0 + 1) * size + i0];
  const v11 = field[(j0 + 1) * size + i0 + 1];
  return v00 * (1 - ti) * (1 - tj) + v10 * ti * (1 - tj) + v01 * (1 - ti) * tj + v11 * ti * tj;
}
