"use client";

import { useEffect, useState } from "react";
import { SectionNote } from "@/components/weather/SectionNote";
import { WindProfileView } from "@/components/home/WindProfile";
import { fetchJson } from "@/lib/fetch-json";
import { mergedSeries } from "@/lib/forecast-model";
import { fetchWindDay, type WindDay, type WindHour } from "@/lib/wind-day";
import { flyingWindow, hourLabel, inWindow, compassName } from "@/lib/wx-window";
import { wxApiPath } from "@/lib/wx-datasets";

const REFRESH_MS = 45 * 60 * 1000;

type SummitHour = {
  time: string;
  hour: number;
  label: string;
  windKt: number;
  gustKt: number | null;
  dirDeg: number;
  tempF: number;
};

type SummitDay = { tomorrow: boolean; nowHour: number; hours: SummitHour[]; peak: SummitHour };

/** The summit's hourly forecast for the flying day — the list that drives the column. */
async function fetchSummitDay(): Promise<SummitDay> {
  const data = (await fetchJson(wxApiPath("summit-hourly"))) as { hourly?: Record<string, unknown> };
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

/** The column of wind with its hour selector: pick a summit hour, read its profile. */
export function WindPanel() {
  const [wind, setWind] = useState<WindDay | null>(null);
  const [summit, setSummit] = useState<SummitDay | null>(null);
  const [windError, setWindError] = useState(false);
  const [summitError, setSummitError] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchWindDay()
        .then((next) => {
          if (cancelled) return;
          setWind(next);
          setWindError(false);
          // Default the selection to the hour containing now, resolved at load time.
          const now = Date.now();
          let fallback: WindHour | null = null;
          for (const hour of next.hours) {
            if (hour.instantMs <= now) fallback = hour;
            else break;
          }
          fallback = fallback ?? next.hours[0] ?? null;
          if (fallback) setSelected((current) => current ?? fallback?.time ?? null);
        })
        .catch(() => {
          if (!cancelled) setWindError(true);
        });
      fetchSummitDay()
        .then((next) => {
          if (cancelled) return;
          setSummit(next);
          setSummitError(false);
          setSelected((current) =>
            current ??
            next.hours.find((hour) => !next.tomorrow && hour.hour === next.nowHour)?.time ??
            next.hours[0]?.time ??
            null,
          );
        })
        .catch(() => {
          if (!cancelled) setSummitError(true);
        });
    };
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const windHour = wind
    ? (wind.hours.find((hour) => hour.time === selected) ?? wind.hours[0] ?? null)
    : null;

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      {wind && windHour ? (
        <WindProfileView
          profile={{
            rows: windHour.rows,
            maxSpeedKt: wind.maxSpeedKt,
            hourLabel: windHour.hourLabel,
          }}
        />
      ) : (
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5 sm:p-7">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-display text-xs font-semibold uppercase tracking-[0.28em] text-sky-700">
              Vertical wind profile
            </p>
            <p className="text-xs text-slate-400">Mt Washington</p>
          </div>

          <SectionNote>
            The wind and temperature above the summit, level by level. Wave flying wants a strong,
            steady wind near ridge height — the levels just above the peaks are the ones to watch.
          </SectionNote>
          {windError ? (
            <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600 ring-1 ring-slate-900/5">
              The wind profile is unavailable right now.{" "}
              <a
                href="https://open-meteo.com/"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-sky-700 hover:text-sky-600"
              >
                Open-Meteo
              </a>
            </p>
          ) : (
            <div className="mt-5 grid gap-2" aria-hidden="true">
              {Array.from({ length: 10 }).map((_, index) => (
                <div
                  key={index}
                  className="grid grid-cols-[4.25rem_0.875rem_minmax(0,1fr)_4.25rem] items-center gap-2 sm:grid-cols-[5rem_1rem_minmax(0,1fr)_5.5rem] sm:gap-2.5"
                >
                  <span className="h-3 animate-pulse rounded bg-slate-100" />
                  <span className="size-3 animate-pulse rounded-full bg-slate-100" />
                  <span className="h-2.5 animate-pulse rounded-full bg-slate-100" />
                  <span className="h-3 animate-pulse rounded bg-slate-100" />
                </div>
              ))}
              <p className="mt-2 text-xs text-slate-400">Loading the wind profile…</p>
            </div>
          )}
        </div>
      )}

      <div className="order-first rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5 sm:p-7 xl:order-none">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-display text-xs font-semibold uppercase tracking-[0.28em] text-sky-700">
            Summit hourly
          </p>
          <p className="text-xs text-slate-400">
            6,288 ft{summit ? ` · ${summit.tomorrow ? "tomorrow" : "today"}` : ""}
          </p>
        </div>

        <SectionNote>
          The summit’s own hour-by-hour forecast — wind, gusts and temperature on the rockpile.
          The quickest way to see whether the real mountain agrees with the wave views.
        </SectionNote>

        {summit ? (
          <>
            <div className="mt-4 grid gap-1">
              {summit.hours.map((hour) => {
                const isSelected = hour.time === selected;
                const isNow = !summit.tomorrow && hour.hour === summit.nowHour;
                const showGust = hour.gustKt !== null && hour.gustKt - hour.windKt >= 4;
                return (
                  <button
                    key={hour.time}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setSelected(hour.time)}
                    className={`grid grid-cols-[3.75rem_1rem_minmax(0,1fr)_3rem] items-center gap-2 rounded-xl px-3 py-2 text-left transition-colors ${
                      isSelected ? "bg-sky-50 ring-1 ring-sky-200" : "hover:bg-slate-50"
                    }`}
                  >
                    <span
                      className={`text-xs font-medium ${isSelected ? "text-sky-700" : "text-slate-500"}`}
                    >
                      {hour.label}
                      {isNow ? " · now" : ""}
                    </span>
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      className="size-3.5 text-sky-600"
                      style={{ transform: `rotate(${hour.dirDeg + 180}deg)` }}
                    >
                      <path d="M12 3.5 18 19l-6-3-6 3z" fill="currentColor" />
                    </svg>
                    <span className="text-sm font-semibold tabular-nums text-slate-800">
                      {hour.windKt} kt
                      {showGust ? ` G${hour.gustKt}` : ""}
                    </span>
                    <span className="text-right text-xs tabular-nums text-slate-500">
                      {hour.tempF}°F
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-4 text-[11px] leading-5 text-slate-400">
              Click an hour to load the column of wind for it. Peak{" "}
              {compassName(summit.peak.dirDeg)} {summit.peak.windKt} kt around {summit.peak.label}.
              GEM-HRDPS at summit elevation (GFS fallback) via Open-Meteo.
            </p>
          </>
        ) : summitError ? (
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
          <div className="mt-4 grid gap-2" aria-hidden="true">
            {Array.from({ length: 10 }).map((_, index) => (
              <div key={index} className="h-8 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
