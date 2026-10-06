"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/fetch-json";
import { FORECAST_MODELS, mergedSeries } from "@/lib/forecast-model";
import { computeWaveScore, type WaveLevel, type WaveScore } from "@/lib/wave-score";
import { flyingWindow, hourLabel, inWindow } from "@/lib/wx-window";

const LATITUDE = 44.3931;
const LONGITUDE = -71.1996;
const LEVELS = [850, 800, 700, 600, 500, 400, 300];
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

function signalLabel(score: number): string {
  if (score >= 75) return "Strong signal";
  if (score >= 55) return "Moderate signal";
  if (score >= 35) return "Marginal signal";
  return "Weak signal";
}

/** The same depth-of-blue language the wind profile's bars use — deeper is stronger. */
function scoreBar(score: number): string {
  if (score >= 75) return "bg-sky-700";
  if (score >= 55) return "bg-sky-600";
  if (score >= 35) return "bg-sky-400";
  return "bg-slate-300";
}

type WaveHour = { time: string; hour: number; label: string } & WaveScore;
type WaveDay = { tomorrow: boolean; nowHour: number; hours: WaveHour[]; peak: WaveHour };

/** The Scorer-parameter wave signal for the flying day, hour by hour. */
async function fetchWaveDay(): Promise<WaveDay> {
  const variables = LEVELS.flatMap((level) => [
    `geopotential_height_${level}hPa`,
    `wind_speed_${level}hPa`,
    `wind_direction_${level}hPa`,
    `temperature_${level}hPa`,
  ]);
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${LATITUDE}&longitude=${LONGITUDE}` +
    `&hourly=${variables.join(",")}&models=${FORECAST_MODELS}&wind_speed_unit=kn` +
    `&temperature_unit=celsius&timezone=America%2FNew_York&forecast_days=2`;

  const data = (await fetchJson(url)) as { hourly: Record<string, unknown> };
  const hourly = data.hourly;
  const times = hourly.time as unknown as string[];
  if (!times || times.length === 0) throw new Error("missing wave forecast");

  const at = (key: string, index: number): number | null => {
    const series = mergedSeries(hourly, key);
    if (!series) return null;
    const value = series[index];
    return typeof value === "number" ? value : null;
  };

  const window = flyingWindow(times);
  if (!window) throw new Error("missing wave forecast");

  const hours: WaveHour[] = [];
  for (let i = 0; i < times.length; i += 1) {
    const time = times[i];
    if (!time.startsWith(window.date)) continue;
    const hour = Number(time.slice(11, 13));
    if (!inWindow(hour, window)) continue;

    const levels: WaveLevel[] = [];
    let complete = true;
    for (const hPa of LEVELS) {
      const altM = at(`geopotential_height_${hPa}hPa`, i);
      const speedKt = at(`wind_speed_${hPa}hPa`, i);
      const dirDeg = at(`wind_direction_${hPa}hPa`, i);
      const tempC = at(`temperature_${hPa}hPa`, i);
      if (altM === null || speedKt === null || dirDeg === null || tempC === null) {
        complete = false;
        break;
      }
      levels.push({ hPa, altM, speedKt, dirDeg, tempC });
    }
    if (!complete) continue;

    const score = computeWaveScore(levels);
    if (!score) continue;
    hours.push({ time, hour, label: hourLabel(hour), ...score });
  }
  if (hours.length === 0) throw new Error("empty wave window");

  const peak = hours.reduce((best, hour) => (hour.score > best.score ? hour : best), hours[0]);

  return { tomorrow: window.tomorrow, nowHour: window.nowHour, hours, peak };
}

const scorer = (value: number) => (value * 1e7).toFixed(1);

export function WaveForecast() {
  const [day, setDay] = useState<WaveDay | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchWaveDay()
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

  const peakLift = day ? Math.max(...day.hours.map((hour) => hour.liftFpm)) : 0;
  const peakMaxScorer = day
    ? Math.max(...day.peak.scorerLevels.map((level) => level.scorer), 1e-12)
    : 1;

  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5 sm:p-7">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-display text-xs font-semibold uppercase tracking-[0.28em] text-sky-700">
          Wave forecast
        </p>
        <p className="text-xs text-slate-400">
          Scorer parameter{day ? ` · ${day.tomorrow ? "tomorrow" : "today"}` : ""}
        </p>
      </div>

      {day ? (
        <>
          <div className="mt-6 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="font-display text-5xl font-bold leading-none tabular-nums text-sky-800">
              {day.peak.score}
            </span>
            <span className="flex flex-col leading-tight">
              <span className="font-display text-base font-semibold text-slate-900">
                {signalLabel(day.peak.score)}
              </span>
              <span className="text-xs text-slate-500">
                peak around {day.peak.label}
                {peakLift >= 300
                  ? ` · lift up to ~${peakLift.toLocaleString("en-US")} fpm`
                  : " · lift marginal"}
              </span>
            </span>
          </div>

          <div className="mt-6 grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
            {day.hours.map((hour) => {
              const isNow = !day.tomorrow && hour.hour === day.nowHour;
              return (
                <div
                  key={hour.time}
                  title={`${hour.score} — ${signalLabel(hour.score)}`}
                  className={`rounded-2xl px-2 py-3 text-center ring-1 ${
                    isNow ? "bg-sky-50 ring-sky-200" : "bg-slate-50 ring-slate-900/5"
                  }`}
                >
                  <p
                    className={`text-[11px] font-medium ${isNow ? "text-sky-700" : "text-slate-500"}`}
                  >
                    {hour.label}
                  </p>
                  <p className="mt-1 font-display text-lg font-bold leading-none tabular-nums text-slate-900">
                    {hour.score}
                  </p>
                  <p className="mt-1 text-[10px] tabular-nums text-slate-400">
                    {hour.liftFpm >= 300 ? `~${hour.liftFpm.toLocaleString("en-US")} fpm` : "—"}
                  </p>
                  <span className={`mt-2 block h-1.5 rounded-full ${scoreBar(hour.score)}`} />
                </div>
              );
            })}
          </div>

          <p className="mt-4 text-[11px] leading-5 text-slate-400">
            At the peak: cross-ridge wind {day.peak.ridgeKt} kt (
            {directionLetters(day.peak.ridgeDirDeg)}) at ridge-top, {day.peak.aloftKt} kt aloft ·
            Scorer {scorer(day.peak.lowScorer)} → {scorer(day.peak.highScorer)} (×10⁻⁷ m⁻²) · N{" "}
            {(day.peak.bruntLow * 100).toFixed(1)}×10⁻² s⁻¹.
          </p>
          <div className="mt-5 flex flex-wrap items-end gap-x-8 gap-y-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Scorer l² by level · ×10⁻⁷ m⁻²
              </p>
              <div className="mt-2 flex items-end gap-2.5">
                {day.peak.scorerLevels.map((level) => (
                  <div key={level.hPa} className="flex w-9 flex-col items-center">
                    <span className="text-[10px] tabular-nums text-slate-500">
                      {scorer(level.scorer)}
                    </span>
                    <span className="mt-1 flex h-11 w-full items-end justify-center">
                      <span
                        className="block w-3.5 rounded-t bg-sky-600/75"
                        style={{
                          height: Math.max(4, Math.round((level.scorer / peakMaxScorer) * 44)),
                        }}
                      />
                    </span>
                    <span className="mt-1 text-[10px] tabular-nums text-slate-400">
                      {level.hPa}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <p className="max-w-sm text-[11px] leading-5 text-slate-400">
              At the peak hour ({day.peak.label}) — the Scorer parameter falling with height is
              what lets the wave propagate. The levels run from 850 hPa at the surface end to
              300 hPa aloft.
            </p>
          </div>
          <p className="mt-2 text-[11px] leading-5 text-slate-400">
            Lift is the N·h scale — the low-level stability over the height of the range — an upper
            bound, not a promise. An indicator from the GEM-HRDPS model via Open-Meteo; the
            Observatory&apos;s higher-summits forecast is the one to read before committing.
          </p>
        </>
      ) : error ? (
        <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600 ring-1 ring-slate-900/5">
          The wave forecast is unavailable right now.{" "}
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
        <div className="mt-6 grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8" aria-hidden="true">
          {Array.from({ length: 16 }).map((_, index) => (
            <div key={index} className="h-20 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      )}
    </div>
  );
}
