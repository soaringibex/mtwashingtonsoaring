// The pieces both wave-field views share for the linear solve: the free-atmosphere
// column and the upwind sounding (each fetched per view through the cached /api/wx
// route) plus the hour/bucket bookkeeping that keeps the two views aligned.

import { fetchJson } from "@/lib/fetch-json";
import { WAVE_LEVELS } from "@/lib/wave-score";
import { azimuthBucket, wxApiPath } from "@/lib/wx-datasets";
import type { WaveColumnLevel } from "@/lib/linear-wave";

export type WaveColumnRaw = {
  times: string[];
  offsetSeconds: number;
  hourly: Record<string, (number | null)[]>;
  defaultIndex: number;
};

type ColumnPayload = {
  hourly?: Record<string, (number | null)[]>;
  utc_offset_seconds?: number;
};

function parseColumn(data: unknown): WaveColumnRaw | null {
  const payload = data as ColumnPayload | null;
  const hourly = payload?.hourly ?? {};
  const times = (hourly.time ?? []) as unknown as string[];
  if (times.length === 0) return null;
  const offsetSeconds = payload?.utc_offset_seconds ?? 0;
  // The hour containing now, resolved here where the clock is allowed.
  const now = Date.now();
  let defaultIndex = 0;
  for (let i = 0; i < times.length; i += 1) {
    if (Date.parse(`${times[i]}:00Z`) - offsetSeconds * 1000 <= now) defaultIndex = i;
    else break;
  }
  return { times, offsetSeconds, hourly, defaultIndex };
}

/** The full model column (geopotential height, wind, temperature per pressure level). */
async function fetchColumnRaw(): Promise<WaveColumnRaw> {
  const raw = parseColumn(await fetchJson(wxApiPath("column")));
  if (!raw) throw new Error("missing column");
  archiveColumn(COLUMN_ARCHIVE_KEY, raw.hourly, raw.times, raw.offsetSeconds);
  return raw;
}

// The solve wants the undisturbed inflow, not the lee-side Gorham column — one sounding
// per 5° wind bucket, cached like the rest.
const upwindCache = new Map<number, { at: number; value: Promise<WaveColumnRaw> }>();

const upwindArchiveKey = (bucket: number) => `mws-wave-column-upwind-v1-${bucket}`;

export function fetchUpwindColumnRaw(azimuth: number): Promise<WaveColumnRaw> {
  const bucket = azimuthBucket(azimuth);
  const now = Date.now();
  const cached = upwindCache.get(bucket);
  if (cached && now - cached.at < COLUMN_CACHE_MS) return cached.value;
  if (!cached) {
    // Archive-seeded reload: comes back with the sounding instead of jumping from the
    // lee column once the fetch lands.
    const archived = readArchivedColumn(upwindArchiveKey(bucket));
    if (archived && now - archived.at < COLUMN_CACHE_MS) {
      const value = Promise.resolve<WaveColumnRaw>(archived);
      upwindCache.set(bucket, { at: archived.at, value });
      return value;
    }
  }
  const value = fetchJson(wxApiPath("column-upwind", { azimuth: bucket }))
    .then((data) => {
      const raw = parseColumn(data);
      if (!raw) throw new Error("missing upwind column");
      archiveColumn(upwindArchiveKey(bucket), raw.hourly, raw.times, raw.offsetSeconds);
      return raw;
    })
    .catch((error: unknown) => {
      if (upwindCache.get(bucket)?.value === value) upwindCache.delete(bucket);
      throw error;
    });
  upwindCache.set(bucket, { at: now, value });
  return value;
}

// Both wave views need the same column — share one in-flight request rather than
// spending the API budget twice. Across reloads, the archive below stands in for the
// in-memory cache while it is still fresh.
let columnCache: { at: number; value: Promise<WaveColumnRaw> } | null = null;
const COLUMN_CACHE_MS = 10 * 60 * 1000;

export function fetchWaveColumnRaw(): Promise<WaveColumnRaw> {
  const now = Date.now();
  if (columnCache && now - columnCache.at < COLUMN_CACHE_MS) return columnCache.value;
  if (!columnCache) {
    const archived = readArchivedColumn();
    if (archived && now - archived.at < COLUMN_CACHE_MS) {
      columnCache = { at: archived.at, value: Promise.resolve(archived) };
      return columnCache.value;
    }
  }
  const value = fetchColumnRaw().catch((error: unknown) => {
    if (columnCache?.value === value) columnCache = null;
    throw error;
  });
  columnCache = { at: now, value };
  return value;
}

// The solver's raw inputs are archived as they arrive. Terrain is static (cached a year
// below), and each hour's column is immutable once the hour passes — so a reload can
// seed the views from the archive instantly and still refresh over the top.

const COLUMN_ARCHIVE_KEY = "mws-wave-column-v1";
const COLUMN_ARCHIVE_HOURS = 72;

type ColumnArchive = {
  offsetSeconds?: number;
  hours?: Record<string, { at: number; levels: WaveColumnLevel[] }>;
};

function readColumnArchive(key: string): ColumnArchive {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ColumnArchive;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function archiveColumn(
  key: string,
  hourly: Record<string, (number | null)[]>,
  times: string[],
  offsetSeconds: number,
): void {
  try {
    const archive = readColumnArchive(key);
    const hours = archive.hours ?? {};
    const now = Date.now();
    for (let i = 0; i < times.length; i += 1) {
      const levels = columnLevelsAt(hourly, i);
      if (levels.length >= 4) hours[times[i]] = { at: now, levels };
    }
    // Keep three days of hours — older weather is not re-solved.
    const cutoff = now - COLUMN_ARCHIVE_HOURS * 60 * 60 * 1000;
    for (const time of Object.keys(hours)) {
      const instant = Date.parse(`${time}:00Z`) - offsetSeconds * 1000;
      if (!Number.isFinite(instant) || instant < cutoff) delete hours[time];
    }
    localStorage.setItem(key, JSON.stringify({ offsetSeconds, hours } satisfies ColumnArchive));
  } catch {
    // storage unavailable — the archive is best-effort
  }
}

/** The archived column as the solver consumes it, with the time it was stored. */
export function readArchivedColumn(key: string = COLUMN_ARCHIVE_KEY): (WaveColumnRaw & { at: number }) | null {
  const archive = readColumnArchive(key);
  const hours = archive.hours ?? {};
  const times = Object.keys(hours).sort();
  if (times.length === 0) return null;

  const hourly: Record<string, (number | null)[]> = {};
  for (const hPa of WAVE_LEVELS) {
    hourly[`geopotential_height_${hPa}hPa`] = [];
    hourly[`wind_speed_${hPa}hPa`] = [];
    hourly[`wind_direction_${hPa}hPa`] = [];
    hourly[`temperature_${hPa}hPa`] = [];
  }
  let at = 0;
  for (const time of times) {
    const entry = hours[time];
    at = Math.max(at, entry.at);
    const byLevel = new Map(entry.levels.map((level) => [level.hPa, level]));
    for (const hPa of WAVE_LEVELS) {
      const level = byLevel.get(hPa);
      hourly[`geopotential_height_${hPa}hPa`].push(level ? level.zM : null);
      hourly[`wind_speed_${hPa}hPa`].push(level ? level.speedMs : null);
      hourly[`wind_direction_${hPa}hPa`].push(level ? level.dirDeg : null);
      hourly[`temperature_${hPa}hPa`].push(level ? level.tempC : null);
    }
  }
  hourly.time = times as unknown as (number | null)[];

  // The hour containing now, as a fresh fetch would resolve it.
  const offsetSeconds = typeof archive.offsetSeconds === "number" ? archive.offsetSeconds : 0;
  const now = Date.now();
  let defaultIndex = 0;
  for (let i = 0; i < times.length; i += 1) {
    if (Date.parse(`${times[i]}:00Z`) - offsetSeconds * 1000 <= now) defaultIndex = i;
    else break;
  }
  return { times, offsetSeconds, hourly, defaultIndex, at };
}

/** The levels of one hour as the solver consumes them. */
export function columnLevelsAt(
  hourly: Record<string, (number | null)[]>,
  i: number,
): WaveColumnLevel[] {
  const levels: WaveColumnLevel[] = [];
  for (const hPa of WAVE_LEVELS) {
    const z = hourly[`geopotential_height_${hPa}hPa`]?.[i];
    const s = hourly[`wind_speed_${hPa}hPa`]?.[i];
    const d = hourly[`wind_direction_${hPa}hPa`]?.[i];
    const t = hourly[`temperature_${hPa}hPa`]?.[i];
    if (typeof z !== "number" || typeof s !== "number" || typeof d !== "number" || typeof t !== "number") {
      continue;
    }
    levels.push({ hPa, zM: z, tempC: t, speedMs: s, dirDeg: d });
  }
  return levels;
}

/** The column hour to use for a shared selection. */
export function waveColumnHour(raw: WaveColumnRaw, selectedTime: string | null): number {
  if (selectedTime) {
    const found = raw.times.indexOf(selectedTime);
    if (found >= 0) return found;
  }
  return raw.defaultIndex;
}

/**
 * The azimuth the wave views run along for this hour — the 800 hPa wind's
 * meteorological direction (the direction it blows FROM), falling back through
 * nearby levels when that one is missing or calm, then to the historical
 * northwest axis. Callers lay their transects along `(azimuth + 180) % 360`,
 * so distance increases downwind.
 */
export function waveAzimuth(levels: WaveColumnLevel[]): number {
  for (const hPa of [800, 825, 775, 850, 750, 700]) {
    const level = levels.find((entry) => entry.hPa === hPa);
    if (level && Number.isFinite(level.dirDeg) && level.speedMs > 5) return level.dirDeg;
  }
  return 305;
}
