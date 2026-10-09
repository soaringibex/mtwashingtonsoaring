// Live verification for the linear wave solver, against the deployed Vercel routes.
// The routes are cached upstream, so this spends no Open-Meteo budget.
//
//   node scripts/wave-live-check.mts                 # the hour's solve, all diagnostics
//   node scripts/wave-live-check.mts --hour 16 --scan
//   node scripts/wave-live-check.mts --hour 16 --3d  # 2-D vs 3-D on the real terrain
//
// Prints: the dividing-streamline launch (z_d, Fr), |w| at 10k/16k ft, the dominant
// wavelength along the transect, the sign changes inside the LOA circle, and the
// wrap-around contamination at the PADDED domain's true edge. --scan sweeps the
// Rayleigh friction α table used to pick DEFAULT_DAMPING_S; --3d builds the map's
// 128 km/500 m rotated grid from the same z10 tiles the map uses and compares the
// centre transect with the 2-D solve. Optional: --base <url>, --damping <x> to
// override the default α for a probe run.

import { inflateSync } from "node:zlib";
import {
  buildWaveColumn,
  divideStreamline,
  dominantWavelengthKm,
  saturateWave,
  solveLinearWavePadded,
  type SolveResult,
  type WaveColumnLevel,
} from "../src/lib/linear-wave.ts";
import { buildRotatedTerrainGrid, solveLinearWave3D } from "../src/lib/linear-wave-3d.ts";

const args = process.argv.slice(2);
const argOf = (name: string, fallback: string): string => {
  const at = args.indexOf(name);
  return at >= 0 && args[at + 1] ? args[at + 1] : fallback;
};
const BASE = argOf("--base", "https://mtwashingtonsoaring.vercel.app");
const HOUR = Number(argOf("--hour", String(new Date().getHours())));
const ALPHAS = [0, 1e-4, 2e-4, 5e-4, 1e-3];
const SCAN = args.includes("--scan");
const DAMPING_ARG = argOf("--damping", "");
const DAMPING_OVERRIDE = DAMPING_ARG ? Number(DAMPING_ARG) : undefined;
const ALPHAS_OF_ARG = argOf("--alphas", "")
  .split(",")
  .map((value) => Number(value))
  .filter((value) => Number.isFinite(value));
const SCAN_ALPHAS = ALPHAS_OF_ARG.length > 0 ? ALPHAS_OF_ARG : ALPHAS;

const DX_M = 1000;
const FT_PER_M = 3.28084;

const WAVE_LEVELS = [
  1000, 975, 950, 925, 900, 875, 850, 825, 800, 775, 750, 725, 700, 675, 650, 625, 600, 575, 550,
  525, 500, 475, 450, 425, 400, 375, 350, 325, 300, 275, 250, 225, 200, 175, 150, 100,
] as const;

const levelsAt = (hourly: Record<string, (number | null)[]>, i: number): WaveColumnLevel[] => {
  const levels: WaveColumnLevel[] = [];
  for (const hPa of WAVE_LEVELS) {
    const z = hourly[`geopotential_height_${hPa}hPa`]?.[i];
    const s = hourly[`wind_speed_${hPa}hPa`]?.[i];
    const d = hourly[`wind_direction_${hPa}hPa`]?.[i];
    const t = hourly[`temperature_${hPa}hPa`]?.[i];
    if (typeof z !== "number" || typeof s !== "number" || typeof d !== "number" || typeof t !== "number") continue;
    levels.push({ hPa, zM: z, tempC: t, speedMs: s, dirDeg: d });
  }
  return levels;
};

const waveAzimuth = (levels: WaveColumnLevel[]): number => {
  for (const hPa of [800, 825, 775, 850, 750, 700]) {
    const level = levels.find((entry) => entry.hPa === hPa);
    if (level && Number.isFinite(level.dirDeg) && level.speedMs > 5) return level.dirDeg;
  }
  return 305;
};

const nearestLevel = (zM: number[], target: number): number => {
  let li = 0;
  for (let i = 1; i < zM.length; i += 1) {
    if (Math.abs(zM[i] - target) < Math.abs(zM[li] - target)) li = i;
  }
  return li;
};
const maxAbs = (line: number[]): number => line.reduce((peak, v) => Math.max(peak, Math.abs(v)), 0);

/** Runs of w > 1 m/s — the discrete lift bands a pilot could name. */
const liftBands = (line: number[]): number => {
  let bands = 0;
  let inside = false;
  for (const v of line) {
    if (v > 1 && !inside) {
      bands += 1;
      inside = true;
    } else if (v <= 1) {
      inside = false;
    }
  }
  return bands;
};

const signChangesInsideCircle = (line: number[]): number => {
  let changes = 0;
  let previous = 0;
  for (let i = 0; i < line.length; i += 1) {
    if (Math.abs(i - 36) > 18.52) continue; // 10 NM circle, 1 km samples
    const sign = Math.sign(line[i]);
    if (sign !== 0 && previous !== 0 && sign !== previous) changes += 1;
    if (sign !== 0) previous = sign;
  }
  return changes;
};

/** |w| in the outermost samples of the PADDED domain, over the global peak. */
const paddedEdgeRatio = (line: number[]): number => {
  const edge = Math.max(1, Math.min(16, Math.floor(line.length / 8)));
  const peak = maxAbs(line);
  if (!(peak > 0)) return 0;
  return Math.max(maxAbs(line.slice(0, edge)), maxAbs(line.slice(line.length - edge))) / peak;
};

const get = async (path: string): Promise<unknown> => {
  const response = await fetch(`${BASE}${path}`);
  if (!response.ok) throw new Error(`${path}: ${response.status} ${await response.text()}`);
  return response.json();
};

const column = (await get("/api/wx/column")) as {
  hourly: Record<string, (number | null)[]>;
  utc_offset_seconds: number;
};
const times = column.hourly.time as unknown as string[];
const idx = times.findIndex((t) => t.endsWith(`T${String(HOUR).padStart(2, "0")}:00`));
if (idx < 0) throw new Error(`hour ${HOUR} not in ${times[0]}..${times[times.length - 1]}`);
const local = levelsAt(column.hourly, idx);
const windFrom = waveAzimuth(local);
const bucket = (Math.round(windFrom / 5) * 5) % 360;
const transectAz = (windFrom + 180) % 360;

const [upwind, terrainRaw] = await Promise.all([
  get(`/api/wx/column-upwind?azimuth=${bucket}`),
  get(`/api/wx/terrain-line?azimuth=${bucket}`),
]);
const upwindPayload = upwind as { hourly: Record<string, (number | null)[]> };
const upIdx = (upwindPayload.hourly.time as unknown as string[]).indexOf(times[idx]);
const levels = levelsAt(upwindPayload.hourly, upIdx);
const terrain = (terrainRaw as { elevation: number[] }).elevation;
if (terrain.length !== 73) throw new Error(`terrain line has ${terrain.length} samples`);

const mean = terrain.reduce((sum, value) => sum + value, 0) / terrain.length;
const crest = Math.max(...terrain);
const divider = divideStreamline(levels, transectAz, mean, crest);
const clipped = terrain.map((h) => Math.max(h, divider.zD));
const columnBase = buildWaveColumn(levels, transectAz, divider.zD);
if (!columnBase) throw new Error("column failed");

console.log(
  `live ${times[idx]} — bucket ${bucket}°, transect ${transectAz.toFixed(0)}°, ` +
    `mean ${mean.toFixed(0)} m, crest ${crest.toFixed(0)} m, h_c ${(crest - mean).toFixed(0)} m`,
);
console.log(
  `launch: z_d ${divider.zD.toFixed(0)} m (${(divider.zD * FT_PER_M).toFixed(0)} ft) — U_eff ${divider.uEff.toFixed(2)} m/s, ` +
    `N_eff ${divider.nEff.toExponential(2)} s⁻¹, Fr ${divider.froude.toFixed(2)}; column ${columnBase.layers.length} layers, ` +
    `U(z_d) ${columnBase.uSurfaceMs.toFixed(2)} m/s`,
);
const clipDepth = clipped.reduce((sum, h, i) => sum + (h - terrain[i]), 0) / terrain.length;
console.log(`clipping: blocked air raised the mean profile by ${clipDepth.toFixed(1)} m`);

const report = (label: string, alpha: number | undefined) => {
  const damping = alpha ?? DAMPING_OVERRIDE;
  const padded = solveLinearWavePadded({
    terrainM: clipped,
    dxM: DX_M,
    column: columnBase,
    ...(damping === undefined ? {} : { damping }),
  });
  if (!padded) throw new Error("solve failed");
  const count = clipped.length;
  const central = padded.w.map((line) => line.slice(padded.offset, padded.offset + count));
  const raw: SolveResult = { zM: padded.zM, w: central };
  const li10 = nearestLevel(raw.zM, 3048);
  const li16 = nearestLevel(raw.zM, 4877);
  const saturated = saturateWave(raw, columnBase);
  const line10 = raw.w[li10];
  console.log(
    `${label}: |w|@10k ${maxAbs(line10).toFixed(2)} m/s raw (${maxAbs(saturated.w[li10]).toFixed(2)} saturated), |w|@16k ${maxAbs(raw.w[li16]).toFixed(2)} m/s, ` +
      `λ@10k ${dominantWavelengthKm(line10, DX_M)?.toFixed(2)} km (padded ${dominantWavelengthKm(padded.w[li10], DX_M)?.toFixed(2)}), ` +
      `circle sign changes ${signChangesInsideCircle(line10)}, lee bands ${liftBands(line10)}, ` +
      `true edge ${(100 * paddedEdgeRatio(padded.w[li10])).toFixed(1)}% of peak (pad ${padded.padLength})`,
  );
};

if (SCAN) {
  console.log("Rayleigh scan (raw solve, no saturation) — pick the smallest α keeping the true edge < 15%:");
  for (const alpha of SCAN_ALPHAS) report(`α ${String(alpha).padEnd(8)}`, alpha);
} else {
  report("solve", undefined);
}

// ------------------------------------------------------------------ 3-D on real terrain
//
// Decodes the same z10 Terrarium tiles the map fetches, builds the map's 128 km/500 m
// rotated grid, and compares the 3-D field's centre transect against the 2-D solve on
// the same line and column. Run with --3d.

const TILE_SIZE = 256;
const lonToTileX = (lon: number, zoom: number) => ((lon + 180) / 360) * 2 ** zoom;
const latToTileY = (lat: number, zoom: number) => {
  const rad = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** zoom;
};
const tileXToLon = (x: number, zoom: number) => (x / 2 ** zoom) * 360 - 180;
const tileYToLat = (y: number, zoom: number) => {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** zoom;
  return (180 / Math.PI) * Math.atan(Math.sinh(n));
};

type Mosaic = {
  elevations: Float32Array;
  width: number;
  height: number;
  west: number;
  north: number;
  lonStep: number;
  latStep: number;
};

/** Terrarium PNG (8-bit, non-interlaced, RGB or RGBA) → elevation mosaic. */
function decodeTerrariumPng(
  buffer: Buffer,
): { width: number; height: number; rgba: Uint8Array; bpp: number } {
  if (buffer.readUInt32BE(0) !== 0x89504e47) throw new Error("not a PNG");
  let pos = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idat: Buffer[] = [];
  while (pos + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(pos);
    const type = buffer.toString("ascii", pos + 4, pos + 8);
    const data = buffer.subarray(pos + 8, pos + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
    pos += 12 + length;
  }
  const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
  if (bitDepth !== 8 || bpp === 0 || interlace !== 0) {
    throw new Error(`unsupported PNG (depth ${bitDepth}, colour ${colorType}, interlace ${interlace})`);
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * bpp;
  const rgba = new Uint8Array(width * height * bpp);
  const paeth = (a: number, b: number, c: number) => {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const out = y * stride;
    const prev = (y - 1) * stride;
    for (let x = 0; x < stride; x += 1) {
      const a = x >= bpp ? rgba[out + x - bpp] : 0;
      const b = y > 0 ? rgba[prev + x] : 0;
      const c = x >= bpp && y > 0 ? rgba[prev + x - bpp] : 0;
      let v = row[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) v += paeth(a, b, c);
      rgba[out + x] = v & 0xff;
    }
  }
  return { width, height, rgba, bpp };
}

async function fetchMosaic(
  zoom: number,
  west: number,
  south: number,
  east: number,
  north: number,
): Promise<Mosaic> {
  const x0 = Math.floor(lonToTileX(west, zoom));
  const x1 = Math.floor(lonToTileX(east, zoom));
  const y0 = Math.floor(latToTileY(north, zoom));
  const y1 = Math.floor(latToTileY(south, zoom));
  const cols = x1 - x0 + 1;
  const rows = y1 - y0 + 1;
  const tiles = await Promise.all(
    Array.from({ length: rows * cols }, async (_, index) => {
      const tileX = x0 + (index % cols);
      const tileY = y0 + Math.floor(index / cols);
      const response = await fetch(`${BASE}/api/terrain/${zoom}/${tileX}/${tileY}`);
      if (!response.ok) throw new Error(`terrain tile ${zoom}/${tileX}/${tileY}: ${response.status}`);
      return decodeTerrariumPng(Buffer.from(await response.arrayBuffer()));
    }),
  );
  const width = cols * TILE_SIZE;
  const height = rows * TILE_SIZE;
  const elevations = new Float32Array(width * height);
  tiles.forEach((tile, index) => {
    const ox = (index % cols) * TILE_SIZE;
    const oy = Math.floor(index / cols) * TILE_SIZE;
    for (let y = 0; y < TILE_SIZE; y += 1) {
      for (let x = 0; x < TILE_SIZE; x += 1) {
        const o = (y * TILE_SIZE + x) * tile.bpp;
        elevations[(oy + y) * width + ox + x] =
          tile.rgba[o] * 256 + tile.rgba[o + 1] + tile.rgba[o + 2] / 256 - 32768;
      }
    }
  });
  const mosaicNorth = tileYToLat(y0, zoom);
  return {
    elevations,
    width,
    height,
    west: tileXToLon(x0, zoom),
    north: mosaicNorth,
    lonStep: 360 / 2 ** zoom / TILE_SIZE,
    latStep: (mosaicNorth - tileYToLat(y0 + 1, zoom)) / TILE_SIZE,
  };
}

const sampleMosaic = (m: Mosaic, lat: number, lon: number): number => {
  const fx = Math.min(Math.max((lon - m.west) / m.lonStep, 0), m.width - 1.001);
  const fy = Math.min(Math.max((m.north - lat) / m.latStep, 0), m.height - 1.001);
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const i = y0 * m.width + x0;
  return (
    m.elevations[i] * (1 - tx) * (1 - ty) +
    m.elevations[i + 1] * tx * (1 - ty) +
    m.elevations[i + m.width] * (1 - tx) * ty +
    m.elevations[i + m.width + 1] * tx * ty
  );
};

if (args.includes("--3d")) {
  console.log("--- 3-D map solve on the real z10 terrain (128 km, 500 m, x downwind) ---");
  // The map's own bounds, mirrored from wx-datasets.ts.
  const MAP_LAT_MIN = 44.06;
  const MAP_LAT_SPAN = 0.42;
  const MAP_LON_MIN = -71.55;
  const MAP_LON_SPAN = 0.604;
  const MAP_CENTER = { lat: MAP_LAT_MIN + MAP_LAT_SPAN / 2, lon: MAP_LON_MIN + MAP_LON_SPAN / 2 };
  const G3 = 256;
  const DX3 = 500;
  const metresPerDegLat = 111 * 1000;
  const metresPerDegLon = 111 * Math.cos((MAP_CENTER.lat * Math.PI) / 180) * 1000;
  const halfM = (G3 / 2) * DX3 * 1.06;
  const tileStart = performance.now();
  const mosaic = await fetchMosaic(
    10,
    MAP_CENTER.lon - halfM / metresPerDegLon,
    MAP_CENTER.lat - halfM / metresPerDegLat,
    MAP_CENTER.lon + halfM / metresPerDegLon,
    MAP_CENTER.lat + halfM / metresPerDegLat,
  );
  const tileMs = performance.now() - tileStart;
  const grid = buildRotatedTerrainGrid({
    size: G3,
    dxM: DX3,
    centreLat: MAP_CENTER.lat,
    centreLon: MAP_CENTER.lon,
    metresPerDegLat,
    metresPerDegLon,
    azimuthDeg: transectAz,
    sample: (lat, lon) => sampleMosaic(mosaic, lat, lon),
  });
  let gridMean = 0;
  let gridCrest = -Infinity;
  for (let i = 0; i < grid.length; i += 1) {
    gridMean += grid[i];
    if (grid[i] > gridCrest) gridCrest = grid[i];
  }
  gridMean /= grid.length;
  const gridDivider = divideStreamline(levels, transectAz, gridMean, gridCrest);
  const gridColumn = buildWaveColumn(levels, transectAz, gridDivider.zD);
  if (!gridColumn) throw new Error("3-D column failed");
  const clippedGrid = new Float64Array(grid.length);
  for (let i = 0; i < grid.length; i += 1) clippedGrid[i] = Math.max(grid[i], gridDivider.zD);

  const solveStart = performance.now();
  const raw3 = solveLinearWave3D({
    terrainM: clippedGrid,
    size: G3,
    dxM: DX3,
    column: gridColumn,
    ...(DAMPING_OVERRIDE === undefined ? {} : { damping: DAMPING_OVERRIDE }),
  });
  const solveMs = performance.now() - solveStart;
  if (!raw3) throw new Error("3-D solve failed");
  const sat3 = saturateWave(raw3, gridColumn);
  const level3d = nearestLevel(raw3.zM, 3048);

  // The 3-D grid is not padded (256² stays inside the timing budget), so the wrap
  // metric is the outermost 16 samples of each side of the field, over the peak.
  const line3d = raw3.w[level3d];
  let gridPeak3 = 0;
  let gridEdge3 = 0;
  for (let y = 0; y < G3; y += 1) {
    for (let x = 0; x < G3; x += 1) {
      const v = Math.abs(line3d[y * G3 + x]);
      if (v > gridPeak3) gridPeak3 = v;
      if ((x < 16 || x >= G3 - 16 || y < 16 || y >= G3 - 16) && v > gridEdge3) gridEdge3 = v;
    }
  }
  const edgeRatio3 = gridPeak3 > 0 ? gridEdge3 / gridPeak3 : 0;

  // The centre transect: cross = 0 sits between rows 127/128, so average them.
  const centreLine = new Array<number>(G3);
  const centreField = new Array<number>(G3);
  for (let i = 0; i < G3; i += 1) {
    centreLine[i] = 0.5 * (clippedGrid[127 * G3 + i] + clippedGrid[128 * G3 + i]);
    centreField[i] = 0.5 * (sat3.w[level3d][127 * G3 + i] + sat3.w[level3d][128 * G3 + i]);
  }
  const padded2 = solveLinearWavePadded({
    terrainM: centreLine,
    dxM: DX3,
    column: gridColumn,
    ...(DAMPING_OVERRIDE === undefined ? {} : { damping: DAMPING_OVERRIDE }),
  });
  if (!padded2) throw new Error("2-D centre-line solve failed");
  const central2: SolveResult = {
    zM: padded2.zM,
    w: padded2.w.map((line) => line.slice(padded2.offset, padded2.offset + G3)),
  };
  const sat2 = saturateWave(central2, gridColumn);
  const level2d = nearestLevel(central2.zM, 3048);

  console.log(
    `grid: mean ${gridMean.toFixed(0)} m, crest ${gridCrest.toFixed(0)} m, z_d ${gridDivider.zD.toFixed(0)} m ` +
      `(${(gridDivider.zD * FT_PER_M).toFixed(0)} ft), Fr ${gridDivider.froude.toFixed(2)}, ${gridColumn.layers.length} layers, α ${DAMPING_OVERRIDE ?? "default"}`,
  );
  console.log(
    `2-D centre line: λ@10k ${dominantWavelengthKm(sat2.w[level2d], DX3)?.toFixed(2)} km, ` +
      `peak |w|@10k ${maxAbs(sat2.w[level2d]).toFixed(2)} m/s, true edge ${(100 * paddedEdgeRatio(padded2.w[level2d])).toFixed(1)}% (pad ${padded2.padLength})`,
  );
  console.log(
    `3-D centre row:  λ@10k ${dominantWavelengthKm(centreField, DX3)?.toFixed(2)} km, ` +
      `peak |w|@10k ${maxAbs(centreField).toFixed(2)} m/s at ${raw3.zM[level3d].toFixed(0)} m; ` +
      `2-D same level ${maxAbs(sat2.w[level2d]).toFixed(2)} m/s; true edge ${(100 * edgeRatio3).toFixed(1)}% (256²)`,
  );
  console.log(`timing: tiles ${tileMs.toFixed(0)} ms, 3-D solve ${solveMs.toFixed(0)} ms (${G3}² × ${gridColumn.layers.length} layers)`);
}
