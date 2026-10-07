// The day's vertical wind columns over Mount Washington, one per hour — shared by the
// home page card (latest hour) and the Wavecast dashboard (hour selection).

import { fetchJson } from "@/lib/fetch-json";
import { mergedSeries } from "@/lib/forecast-model";
import { localStampFrom } from "@/lib/wx-window";
import { WIND_DAY_LEVELS as LEVELS, wxApiPath } from "@/lib/wx-datasets";

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

export async function fetchWindDay(): Promise<WindDay> {
  const data = (await fetchJson(wxApiPath("wind-day"))) as {
    hourly: Record<string, unknown>;
    utc_offset_seconds?: number;
  };
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
      hourLabel: localStampFrom(times[index], offset),
    });
  }
  if (hours.length === 0) throw new Error("empty wind forecast");

  const maxSpeedKt = Math.max(
    40,
    ...hours.flatMap((hour) => hour.rows.map((row) => Math.ceil(row.speedKt / 10) * 10)),
  );

  return { hours, maxSpeedKt };
}
