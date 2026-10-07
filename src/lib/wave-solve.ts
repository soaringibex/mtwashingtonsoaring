// The one 3-D solve both wave views read. The map paints it as lift bands; the
// cross-section slices it along the LOA's wind line through the Glider Area centre —
// the very line the map draws, so the two views cannot disagree about the day.
//
// They used to. Each ran its own reduction: the map a 3-D solve on a 128 km rotated
// grid launched from the grid's dividing streamline, the cross-section a 2-D solve on a
// single 1 km transect launched from that transect's own terrain mean. On a cross-ridge
// day those agree; on 2026-10-07's WSW flow (26 kt along the line, but only ~17 kt
// across the Presidential ridge) the map's grid-divider gave z_d 3,200 ft / Fr 0.62
// (amplitude Fr-scaled) while the line's own mean gave 2,550 ft / Fr 1.09 (no scale),
// and the 2-D cut ignored the obliquity on top — so the cross-section read ~2.7x
// stronger than the same day's 3-D field. One solve, one launch plane, one sounding.

import {
  buildWaveColumn,
  divideStreamline,
  saturateWave,
  type WaveColumnLevel,
} from "@/lib/linear-wave";
import { buildRotatedTerrainGrid, solveLinearWave3D } from "@/lib/linear-wave-3d";
import { sampleMosaic, type TerrainMosaic } from "@/lib/terrain-tiles";
import { MAP_LAT_MIN, MAP_LAT_SPAN, MAP_LON_MIN, MAP_LON_SPAN } from "@/lib/wx-datasets";

/** The map's solve terrain: z10 tiles over a generous frame around the display map. */
export const SOLVE_BOUNDS = {
  west: MAP_LON_MIN - 1.0,
  south: MAP_LAT_MIN - 0.72,
  east: MAP_LON_MIN + MAP_LON_SPAN + 1.0,
  north: MAP_LAT_MIN + MAP_LAT_SPAN + 0.72,
};
export const SOLVE_ZOOM = 10;
export const SOLVE3_SIZE = 256;
export const SOLVE3_DX_M = 500;
export const MAP_CENTER = {
  lat: MAP_LAT_MIN + MAP_LAT_SPAN / 2,
  lon: MAP_LON_MIN + MAP_LON_SPAN / 2,
};
export const METRES_PER_DEG_LAT = 110900;
export const METRES_PER_DEG_LON = 111320 * Math.cos((44.26 * Math.PI) / 180);

export type WaveField3D = {
  /** Layer-top altitudes, m ASL (the column's levels, measured from its base plane). */
  zM: number[];
  /** Saturated vertical velocity at each layer top, flat row-major (j·size + i). */
  w: number[][];
  size: number;
  dxM: number;
  centreLat: number;
  centreLon: number;
  /** Unit vectors: x runs downwind along `azimuthDeg`, y is cross-wind. */
  alongE: number;
  alongN: number;
  crossE: number;
  crossN: number;
  metresPerDegLat: number;
  metresPerDegLon: number;
  /** The terrain the solve rode BEFORE the launch-plane clip, m ASL, same layout as `w`. */
  terrainM: Float64Array;
  launchM: number;
  froude: number;
};

/**
 * The shared solve. The grid is centred on the display map, rotated so x runs downwind,
 * and launched from the dividing streamline of the whole grid (Sheppard): the terrain
 * below z_d is clipped away and the column is anchored there.
 */
export function solveWaveField3D(
  mosaic: TerrainMosaic,
  levels: WaveColumnLevel[],
  azimuthDeg: number,
): WaveField3D | null {
  const radians = (azimuthDeg * Math.PI) / 180;
  const alongE = Math.sin(radians);
  const alongN = Math.cos(radians);
  const crossE = Math.sin(radians + Math.PI / 2);
  const crossN = Math.cos(radians + Math.PI / 2);
  const terrainM = buildRotatedTerrainGrid({
    size: SOLVE3_SIZE,
    dxM: SOLVE3_DX_M,
    centreLat: MAP_CENTER.lat,
    centreLon: MAP_CENTER.lon,
    metresPerDegLat: METRES_PER_DEG_LAT,
    metresPerDegLon: METRES_PER_DEG_LON,
    azimuthDeg,
    sample: (lat, lon) => sampleMosaic(mosaic, lat, lon),
  });
  let gridMean = 0;
  let gridCrest = -Infinity;
  for (let i = 0; i < terrainM.length; i += 1) {
    gridMean += terrainM[i];
    if (terrainM[i] > gridCrest) gridCrest = terrainM[i];
  }
  gridMean /= terrainM.length;
  const divider = divideStreamline(levels, azimuthDeg, gridMean, gridCrest);
  const waveColumn = buildWaveColumn(levels, azimuthDeg, divider.zD);
  if (!waveColumn) return null;
  const clipped = Float64Array.from(terrainM, (h) => Math.max(h, divider.zD));
  const raw = solveLinearWave3D({
    terrainM: clipped,
    size: SOLVE3_SIZE,
    dxM: SOLVE3_DX_M,
    column: waveColumn,
  });
  if (!raw) return null;
  const solve = saturateWave(raw, waveColumn, divider.froude);
  return {
    zM: solve.zM,
    w: solve.w,
    size: SOLVE3_SIZE,
    dxM: SOLVE3_DX_M,
    centreLat: MAP_CENTER.lat,
    centreLon: MAP_CENTER.lon,
    alongE,
    alongN,
    crossE,
    crossN,
    metresPerDegLat: METRES_PER_DEG_LAT,
    metresPerDegLon: METRES_PER_DEG_LON,
    terrainM,
    launchM: divider.zD,
    froude: divider.froude,
  };
}

/**
 * A fingerprint of the inputs that decide the field, so both views share one solve:
 * same bucket, hour and sounding → same key → the second ask rides the first result
 * instead of running a second 256² FFT. Any real data change moves the sum.
 */
export function waveSolveKey(
  bucket: number,
  hourKey: string,
  levels: WaveColumnLevel[],
): string {
  let acc = 0;
  for (let i = 0; i < levels.length; i += 1) {
    const level = levels[i];
    acc += (level.speedMs * 7.31 + level.dirDeg * 3.17 + level.zM * 0.013) * (i + 1);
  }
  return `${bucket}|${hourKey}|${levels.length}|${acc.toFixed(4)}`;
}

let lastKey: string | null = null;
let lastField: WaveField3D | null = null;

export function solveWaveFieldCached(
  key: string,
  mosaic: TerrainMosaic,
  levels: WaveColumnLevel[],
  azimuthDeg: number,
): WaveField3D | null {
  if (lastKey === key) return lastField;
  const field = solveWaveField3D(mosaic, levels, azimuthDeg);
  lastKey = key;
  lastField = field;
  return field;
}

export type WaveSlice = {
  /** Layer-top altitudes, m ASL. */
  zM: number[];
  /** Saturated w at each layer top along the cut, indexed [level][sample]. */
  w: number[][];
  /** The real terrain under the cut, m ASL (before the launch-plane clip). */
  terrainM: number[];
  /** Each sample's along-wind offset from the reference point, metres, positive downwind. */
  offsetsM: number[];
  launchM: number;
  froude: number;
};

/**
 * The vertical cut of the shared field through a point, taken along the field's
 * downwind axis — the nearest grid row (within half a cell of the exact line).
 */
export function sliceWaveField(field: WaveField3D, lat: number, lon: number): WaveSlice {
  const dE = (lon - field.centreLon) * field.metresPerDegLon;
  const dN = (lat - field.centreLat) * field.metresPerDegLat;
  const alongM = dE * field.alongE + dN * field.alongN;
  const crossM = dE * field.crossE + dN * field.crossN;
  const mid = (field.size - 1) / 2;
  const j = Math.min(Math.max(Math.round(mid + crossM / field.dxM), 0), field.size - 1);
  const w = field.w.map((line) => {
    const row = new Array<number>(field.size);
    for (let i = 0; i < field.size; i += 1) row[i] = line[j * field.size + i];
    return row;
  });
  const terrainM = new Array<number>(field.size);
  const offsetsM = new Array<number>(field.size);
  for (let i = 0; i < field.size; i += 1) {
    terrainM[i] = field.terrainM[j * field.size + i];
    offsetsM[i] = (i - mid) * field.dxM - alongM;
  }
  return { zM: field.zM, w, terrainM, offsetsM, launchM: field.launchM, froude: field.froude };
}
