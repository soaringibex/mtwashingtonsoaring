// Live verification for the linear wave solver, against the deployed Vercel routes.
// The routes are cached upstream, so this spends no Open-Meteo budget.
//
//   node scripts/wave-live-check.mts                 # the hour's solve, all diagnostics
//   node scripts/wave-live-check.mts --hour 16 --scan
//
// Prints: the dividing-streamline launch (z_d, Fr), |w| at 10k/16k ft, the dominant
// wavelength along the transect, the sign changes inside the LOA circle, and the
// upwind-taper contamination ratio. --scan sweeps the Rayleigh friction α table used
// to pick DEFAULT_DAMPING_S. Optional: --base <url> (default the production deployment).

import {
  buildWaveColumn,
  divideStreamline,
  dominantWavelengthKm,
  saturateWave,
  solveLinearWave,
  type WaveColumnLevel,
} from "../src/lib/linear-wave.ts";

const args = process.argv.slice(2);
const argOf = (name: string, fallback: string): string => {
  const at = args.indexOf(name);
  return at >= 0 && args[at + 1] ? args[at + 1] : fallback;
};
const BASE = argOf("--base", "https://mtwashingtonsoaring.vercel.app");
const HOUR = Number(argOf("--hour", String(new Date().getHours())));
const ALPHAS = [0, 1e-4, 2e-4, 5e-4, 1e-3];
const SCAN = args.includes("--scan");
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

/** |w| in the upwind tapered quarter, over the lee peak — the wrap-around metric. */
const upwindEdgeRatio = (line: number[]): number => {
  const m = Math.floor(line.length / 4);
  const peak = maxAbs(line);
  if (!(peak > 0)) return 0;
  return maxAbs(line.slice(0, m)) / peak;
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
  const raw = solveLinearWave({
    terrainM: clipped,
    dxM: DX_M,
    column: columnBase,
    ...(alpha === undefined ? {} : { damping: alpha }),
  });
  if (!raw) throw new Error("solve failed");
  const li10 = nearestLevel(raw.zM, 3048);
  const li16 = nearestLevel(raw.zM, 4877);
  const saturated = saturateWave(raw, columnBase, divider.froude);
  const scale = divider.froude >= 1 ? 1 : Math.max(0, divider.froude);
  const line10 = raw.w[li10];
  console.log(
    `${label}: |w|@10k ${maxAbs(line10).toFixed(2)} m/s raw (${maxAbs(saturated.w[li10]).toFixed(2)} saturated, ` +
      `lift scale ${scale.toFixed(2)}), |w|@16k ${maxAbs(raw.w[li16]).toFixed(2)} m/s, ` +
      `λ@10k ${dominantWavelengthKm(line10, DX_M)?.toFixed(2)} km, ` +
      `circle sign changes ${signChangesInsideCircle(line10)}, lee bands ${liftBands(line10)}, ` +
      `upwind edge ${(100 * upwindEdgeRatio(line10)).toFixed(1)}% of peak`,
  );
};

if (SCAN) {
  console.log("Rayleigh scan (raw solve, no saturation) — pick the smallest α keeping the edge < 10%:");
  for (const alpha of SCAN_ALPHAS) report(`α ${String(alpha).padEnd(8)}`, alpha);
} else {
  report("solve", undefined);
}
