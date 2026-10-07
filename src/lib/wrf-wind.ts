// The WRF run's own wind at the Glider Area, from wrf-wind.json.
//
// Both wave views orient their cross-section — and caption it — from this
// whenever the WRF field is active: the axis must be the wind that modelled
// the wave. The live sounding is fetched as a today-and-tomorrow forecast and
// cannot speak for an archive — clamping it drew the line across the wrong day.

export type WrfWindLevel = {
  hPa: number;
  wind_direction: (number | null)[];
  wind_speed_ms: (number | null)[];
};

export type WrfWind = {
  times: string[];
  levels: WrfWindLevel[];
};

export function parseWrfWind(payload: unknown): WrfWind | null {
  if (typeof payload !== "object" || payload === null) return null;
  const record = payload as Record<string, unknown>;
  if (!Array.isArray(record.times) || !record.times.every((entry) => typeof entry === "string")) {
    return null;
  }
  if (!Array.isArray(record.levels)) return null;
  const levels: WrfWindLevel[] = [];
  for (const entry of record.levels) {
    if (typeof entry !== "object" || entry === null) return null;
    const level = entry as Record<string, unknown>;
    if (typeof level.hPa !== "number") return null;
    if (!Array.isArray(level.wind_direction) || !Array.isArray(level.wind_speed_ms)) return null;
    levels.push({
      hPa: level.hPa,
      wind_direction: level.wind_direction as (number | null)[],
      wind_speed_ms: level.wind_speed_ms as (number | null)[],
    });
  }
  return { times: record.times as string[], levels };
}

/**
 * The 800-hPa wind FROM direction at a given time — the same level preference
 * scan (and calm threshold) as `waveAzimuth`, but over the WRF's own series.
 */
export function wrfWindFrom(wind: WrfWind | null, time: string | null): number | null {
  if (!wind || !time) return null;
  const index = wind.times.indexOf(time);
  if (index < 0) return null;
  for (const hPa of [800, 825, 775, 850, 750, 700]) {
    const level = wind.levels.find((entry) => entry.hPa === hPa);
    const dir = level?.wind_direction[index];
    const speed = level?.wind_speed_ms[index];
    if (typeof dir === "number" && typeof speed === "number" && speed > 5) return dir;
  }
  return null;
}
