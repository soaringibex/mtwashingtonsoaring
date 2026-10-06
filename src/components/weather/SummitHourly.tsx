"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/fetch-json";
import { FORECAST_MODELS, mergedSeries } from "@/lib/forecast-model";
import { flyingWindow, hourLabel, inWindow } from "@/lib/wx-window";

const LATITUDE = 44.2705;
const LONGITUDE = -71.3032;
const SUMMIT_FT = 6288;
const REFRESH_MS = 45 * 60 * 1000;

const compass = [
  "N",
  "NNE",
  "NE",
  "ENE",
  "E",
  "ESE",
  "SE",
  "SSE",
  "S",
  "SSW",
  "SW",
  "WSW",
  "W",
  "WNW",
  "NW",
  "NNW",
];

function directionLetters(deg: number): string {
  return compass[Math.round(deg / 22.5) % 16];
}

/** The same speed bands the wind profile's bars use. */
function speedBar(kt: number): string {
  if (kt >= 55) return "bg-sky-800";
  if (kt >= 40) return "bg-sky-700";
  if (kt >= 30) return "bg-sky-600";
  if (kt >= 20) return "bg-sky-500";
  if (kt >= 15) return "bg-sky-400";
  if (kt >= 10) return "bg-sky-300";
  return "bg-slate-300";
}

type SummitHour = {
  time: string;
  hour: number;
  label: string;
  windKt: number;
  gustKt: number | null;
  dirDeg: number;
  tempF: number;
};

type SummitDay = {
  tomorrow: boolean;
  nowHour: number;
  hours: SummitHour[];
  peak: SummitHour;
};

/** The summit's hourly forecast for the flying day — today's remaining window, or tomorrow's once today's is done. */
async function fetchSummitDay(): Promise<SummitDay> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${LATITUDE}&longitude=${LONGITUDE}` +
    `&hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m,temperature_2m` +
    `&models=${FORECAST_MODELS}` +
    `&wind_speed_unit=kn&temperature_unit=fahrenheit&timezone=America%2FNew_York` +
    `&forecast_days=2&elevation=1916`;

  const data = (await fetchJson(url)) as { hourly?: Record<string, unknown> };
  const hourly = data.hourly ?? {};
  const times = (hourly.time ?? []) as string[];
  const speed = mergedSeries(hourly, "wind_speed_10m") ?? [];
  const gust = mergedSeries(hourly, "wind_gusts_10m") ?? [];
  const dir = mergedSeries(hourly, "wind_direction_10m") ?? [];
  const temp = mergedSeries(hourly, "temperature_2m") ?? [];
  if (times.length === 0) throw new Error("missing summit forecast");

  const window = flyingWindow(times);
  if (!window) throw new Error("missing summit forecast");

  const hours: SummitHour[] = [];
  for (let i = 0; i < times.length; i += 1) {
    const time = times[i];
    if (!time.startsWith(window.date)) continue;
    const hour = Number(time.slice(11, 13));
    if (!inWindow(hour, window)) continue;
    const windKt = speed[i];
    const dirDeg = dir[i];
    const tempF = temp[i];
    if (typeof windKt !== "number" || typeof dirDeg !== "number" || typeof tempF !== "number") {
      continue;
    }
    hours.push({
      time,
      hour,
      label: hourLabel(hour),
      windKt: Math.round(windKt),
      gustKt: typeof gust[i] === "number" ? Math.round(gust[i] as number) : null,
      dirDeg,
      tempF: Math.round(tempF),
    });
  }
  if (hours.length === 0) throw new Error("empty summit window");

  const peak = hours.reduce((best, hour) => (hour.windKt > best.windKt ? hour : best), hours[0]);

  return { tomorrow: window.tomorrow, nowHour: window.nowHour, hours, peak };
}

export function SummitHourly() {
  const [day, setDay] = useState<SummitDay | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchSummitDay()
        .then((next) => {
          if (!cancelled) {
            setDay(next);
            setError(false);
          }
        })
        .catch(() => {
          if (!cancelled) setError(true);
        });
    };
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5 sm:p-7">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-display text-xs font-semibold uppercase tracking-[0.28em] text-sky-700">
          Summit forecast
        </p>
        <p className="text-xs text-slate-400">
          {SUMMIT_FT.toLocaleString("en-US")} ft{day ? ` · ${day.tomorrow ? "tomorrow" : "today"}` : ""}
        </p>
      </div>

      {day ? (
        <>
          <div className="mt-5 grid grid-cols-4 gap-2 sm:grid-cols-5">
            {day.hours.map((hour) => {
              const isNow = !day.tomorrow && hour.hour === day.nowHour;
              const showGust = hour.gustKt !== null && hour.gustKt - hour.windKt >= 4;
              return (
                <div
                  key={hour.time}
                  className={`rounded-2xl px-1.5 py-2.5 text-center ring-1 ${
                    isNow ? "bg-sky-50 ring-sky-200" : "bg-slate-50 ring-slate-900/5"
                  }`}
                >
                  <p
                    className={`text-[11px] font-medium ${isNow ? "text-sky-700" : "text-slate-500"}`}
                  >
                    {hour.label}
                  </p>
                  <p className="mt-1.5 flex items-center justify-center gap-1">
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      className="size-3.5 text-sky-600"
                      style={{ transform: `rotate(${hour.dirDeg + 180}deg)` }}
                    >
                      <path d="M12 3.5 18 19l-6-3-6 3z" fill="currentColor" />
                    </svg>
                    <span className="font-display text-[15px] font-bold leading-none tabular-nums text-slate-900">
                      {hour.windKt}
                    </span>
                  </p>
                  <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">
                    kt{showGust ? ` · g${hour.gustKt}` : ""}
                  </p>
                  <p className="mt-1 text-[11px] font-medium tabular-nums text-slate-600">
                    {hour.tempF}°F
                  </p>
                  <span className={`mt-2 block h-1 rounded-full ${speedBar(hour.windKt)}`} />
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-[11px] leading-5 text-slate-400">
            Peak {directionLetters(day.peak.dirDeg)} {day.peak.windKt} kt around {day.peak.label}.
            Hourly GEM-HRDPS at summit elevation (GFS fallback) via{" "}
            <a
              href="https://open-meteo.com/"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-sky-700 hover:text-sky-600"
            >
              Open-Meteo
            </a>
            , refreshed through the day.
          </p>
        </>
      ) : error ? (
        <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600 ring-1 ring-slate-900/5">
          The summit forecast is unavailable right now.{" "}
          <a
            href="https://mountwashington.org/weather/regional-weather/"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-sky-700 hover:text-sky-600"
          >
            Mount Washington Observatory
          </a>
        </p>
      ) : (
        <div className="mt-5 grid grid-cols-4 gap-2 sm:grid-cols-5" aria-hidden="true">
          {Array.from({ length: 10 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      )}
    </div>
  );
}
