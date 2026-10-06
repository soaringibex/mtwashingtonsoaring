// The day's vertical wind columns over Mount Washington, one per hour — shared by the
// home page card (latest hour) and the Wx Brief dashboard (hour selection).

import { fetchJson } from "@/lib/fetch-json";
import { FORECAST_MODELS, mergedSeries } from "@/lib/forecast-model";

const LATITUDE = 44.3931;
const LONGITUDE = -71.1996;

/** Pressure levels to pull, in hPa. Filtered against the surface pressure at render time. */
const LEVELS = [1000, 975, 950, 925, 900, 850, 800, 700, 600, 500, 400, 300, 250, 200];

export type ProfileRow = {
  hPa: number;
  altFt: number;
  speedKt: number;
  dirDeg: number;
  tempF: number | null;
};

/** One hour's column, shaped for the profile card. */
export type Profile = {
  rows: ProfileRow[];
  maxSpeedKt: number;
  hourLabel: string;
};

export type WindHour = {
  time: string;
  instantMs: number;
  rows: ProfileRow[];
  hourLabel: string;
};

export type WindDay = {
  hours: WindHour[];
  maxSpeedKt: number;
};

/** "2026-10-06T14:00" + offset −14400 → "Oct 6, 2:00 PM EDT". */
function labelFrom(time: string, offsetSeconds: number): string {
  const instantMs = Date.parse(`${time}:00Z`) - offsetSeconds * 1000;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(instantMs));
}

export async function fetchWindDay(): Promise<WindDay> {
  const variables = [
    "wind_speed_10m",
    "wind_direction_10m",
    "temperature_2m",
    "surface_pressure",
    ...LEVELS.flatMap((level) => [
      `geopotential_height_${level}hPa`,
      `wind_speed_${level}hPa`,
      `wind_direction_${level}hPa`,
      `temperature_${level}hPa`,
    ]),
  ];
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${LATITUDE}&longitude=${LONGITUDE}` +
    `&hourly=${variables.join(",")}&models=${FORECAST_MODELS}&wind_speed_unit=kn` +
    `&temperature_unit=fahrenheit&timezone=America%2FNew_York&forecast_days=2`;

  const data = (await fetchJson(url)) as { hourly: Record<string, unknown>; utc_offset_seconds?: number };
  const hourly = data.hourly;
  const times = hourly.time as unknown as string[];
  const offset = typeof data.utc_offset_seconds === "number" ? data.utc_offset_seconds : 0;
  if (!times || times.length === 0) throw new Error("missing wind forecast");

  const at = (key: string, index: number): number | null => {
    const series = mergedSeries(hourly, key);
    if (!series) return null;
    const value = series[index];
    return typeof value === "number" ? value : null;
  };

  const hours: WindHour[] = [];
  for (let index = 0; index < times.length; index += 1) {
    const surfacePressure = at("surface_pressure", index) ?? 1013;
    const rows: ProfileRow[] = [];

    const surfaceSpeed = at("wind_speed_10m", index);
    const surfaceDir = at("wind_direction_10m", index);
    if (surfaceSpeed !== null && surfaceDir !== null) {
      rows.push({
        hPa: Math.round(surfacePressure),
        altFt: 835,
        speedKt: surfaceSpeed,
        dirDeg: surfaceDir,
        tempF: at("temperature_2m", index),
      });
    }

    for (const level of LEVELS) {
      // Skip levels that sit below the terrain (higher pressure than the surface).
      if (level > surfacePressure) continue;
      const height = at(`geopotential_height_${level}hPa`, index);
      const speed = at(`wind_speed_${level}hPa`, index);
      const dir = at(`wind_direction_${level}hPa`, index);
      if (height === null || speed === null || dir === null) continue;
      const altFt = Math.round(height * 3.28084);
      if (altFt < 800) continue;
      rows.push({
        hPa: level,
        altFt,
        speedKt: speed,
        dirDeg: dir,
        tempF: at(`temperature_${level}hPa`, index),
      });
    }

    if (rows.length < 2) continue;
    // Highest altitude first, so the column reads like the sky does.
    rows.sort((a, b) => b.altFt - a.altFt);
    hours.push({
      time: times[index],
      instantMs: Date.parse(`${times[index]}:00Z`) - offset * 1000,
      rows,
      hourLabel: labelFrom(times[index], offset),
    });
  }
  if (hours.length === 0) throw new Error("empty wind forecast");

  const maxSpeedKt = Math.max(
    40,
    ...hours.flatMap((hour) => hour.rows.map((row) => Math.ceil(row.speedKt / 10) * 10)),
  );

  return { hours, maxSpeedKt };
}
