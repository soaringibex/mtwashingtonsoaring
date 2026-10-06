"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/fetch-json";
import { FORECAST_MODELS, mergedSeries } from "@/lib/forecast-model";
import { computeWaveScore, WAVE_LEVELS, type WaveLevel, type WaveScore } from "@/lib/wave-score";
import { flyingWindow, hourLabel, inWindow } from "@/lib/wx-window";

const LATITUDE = 44.3931;
const LONGITUDE = -71.1996;
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
type WaveDay = {
  tomorrow: boolean;
  nowHour: number;
  hours: WaveHour[];
  peak: WaveHour;
  source: "hrrr" | "hrdps";
};

/** The Scorer-parameter wave signal for the flying day, hour by hour, from Open-Meteo. */
async function fetchWaveDayFrom(
  models: string,
  source: WaveDay["source"],
): Promise<WaveDay> {
  const variables = WAVE_LEVELS.flatMap((level) => [
    `geopotential_height_${level}hPa`,
    `wind_speed_${level}hPa`,
    `wind_direction_${level}hPa`,
    `temperature_${level}hPa`,
  ]);
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${LATITUDE}&longitude=${LONGITUDE}` +
    `&hourly=${variables.join(",")}&models=${models}&wind_speed_unit=kn` +
    `&temperature_unit=celsius&timezone=America%2FNew_York&forecast_days=2`;

  const data = (await fetchJson(url)) as { hourly: Record<string, unknown> };
  const hourly = data.hourly;
  const times = hourly.time as unknown as string[];
  if (!times || times.length === 0) throw new Error("missing wave forecast");

  const at = (key: string, index: number): number | null => {
    // A single requested model comes back with plain keys; a merged pair is suffixed.
    const series = models.includes(",")
      ? mergedSeries(hourly, key)
      : ((hourly[key] as (number | null)[] | undefined) ?? null);
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
    for (const hPa of WAVE_LEVELS) {
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

  return {
    tomorrow: window.tomorrow,
    nowHour: window.nowHour,
    hours,
    peak,
    source,
  };
}

async function fetchWaveDay(): Promise<WaveDay> {
  try {
    return await fetchWaveDayFrom("ncep_hrrr_conus", "hrrr");
  } catch {
    return await fetchWaveDayFrom(FORECAST_MODELS, "hrdps");
  }
}

const scorer = (value: number) => (value * 1e7).toFixed(1);

/** The Scorer parameter against altitude for the peak hour — a classic l²(z) sounding. */
function ScorerProfile({
  levels,
}: {
  levels: { hPa: number; altM: number; scorer: number | null }[];
}) {
  const points = levels.filter(
    (level): level is { hPa: number; altM: number; scorer: number } => level.scorer !== null,
  );
  if (points.length < 2) return null;

  const FT_PER_M = 3.28084;
  const values = points.map((point) => point.scorer * 1e7);
  // The surface layers can spike hard (unstable air, or near-calm winds); clip the
  // display to a window where the wave-relevant structure is still readable.
  const xMin = Math.max(Math.min(0, Math.floor(Math.min(...values))), -10);
  const xMax = Math.max(Math.min(Math.ceil(Math.max(...values)), 15), xMin + 10);
  const alts = points.map((point) => point.altM * FT_PER_M);
  const yMin = Math.max(0, Math.floor(Math.min(...alts) / 5000) * 5000);
  const yMax = Math.ceil(Math.max(...alts) / 5000) * 5000;

  const W = 300;
  const H = 240;
  const padL = 44;
  const padR = 10;
  const padT = 10;
  const padB = 30;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const x = (value: number) =>
    padL + ((Math.min(Math.max(value, xMin), xMax) - xMin) / (xMax - xMin)) * plotW;
  const y = (altFt: number) => padT + (1 - (altFt - yMin) / (yMax - yMin)) * plotH;

  const span = xMax - xMin;
  const xStep = span <= 10 ? 2 : span <= 25 ? 5 : 10;
  const xTicks: number[] = [];
  for (let value = Math.ceil(xMin / xStep) * xStep; value <= xMax; value += xStep) {
    xTicks.push(value);
  }
  const altSpan = yMax - yMin;
  const altStep = altSpan <= 12000 ? 5000 : 10000;
  const altTicks: number[] = [];
  for (let alt = yMin; alt <= yMax; alt += altStep) altTicks.push(alt);

  const path = points
    .map((point) => `${x(point.scorer * 1e7).toFixed(1)},${y(point.altM * FT_PER_M).toFixed(1)}`)
    .join(" ");

  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        Scorer l² by altitude · ×10⁻⁷ m⁻²
      </p>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-2 w-full max-w-[340px]"
        role="img"
        aria-label="Scorer parameter against altitude for the peak hour"
      >
        {altTicks.map((alt) => (
          <g key={alt}>
            <line
              x1={padL}
              x2={W - padR}
              y1={y(alt)}
              y2={y(alt)}
              className="stroke-slate-200"
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={padL - 6}
              y={y(alt) + 3}
              textAnchor="end"
              className="fill-slate-400 text-[9px] tabular-nums"
            >
              {alt.toLocaleString("en-US")}
            </text>
          </g>
        ))}
        {xTicks.map((value) => (
          <g key={value}>
            <line
              x1={x(value)}
              x2={x(value)}
              y1={padT}
              y2={H - padB}
              className="stroke-slate-200"
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={x(value)}
              y={H - padB + 12}
              textAnchor="middle"
              className="fill-slate-400 text-[9px] tabular-nums"
            >
              {value}
            </text>
          </g>
        ))}
        {xMin < 0 ? (
          <line
            x1={x(0)}
            x2={x(0)}
            y1={padT}
            y2={H - padB}
            className="stroke-slate-300"
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        <polyline
          points={path}
          fill="none"
          className="stroke-sky-600"
          strokeWidth={1.6}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {points.map((point) => (
          <circle
            key={point.hPa}
            cx={x(point.scorer * 1e7)}
            cy={y(point.altM * FT_PER_M)}
            r={2.2}
            className="fill-sky-600"
          >
            <title>{`${scorer(point.scorer)} at ${Math.round(point.altM * FT_PER_M).toLocaleString("en-US")} ft (${point.hPa} hPa)`}</title>
          </circle>
        ))}
        <text
          x={padL + plotW / 2}
          y={H - 5}
          textAnchor="middle"
          className="fill-slate-400 text-[9px]"
        >
          Scorer l² (×10⁻⁷ m⁻²)
        </text>
        <text
          x={11}
          y={padT + plotH / 2}
          textAnchor="middle"
          transform={`rotate(-90 11 ${padT + plotH / 2})`}
          className="fill-slate-400 text-[9px]"
        >
          ft
        </text>
      </svg>
    </div>
  );
}

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

  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5 sm:p-7">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-display text-xs font-semibold uppercase tracking-[0.28em] text-sky-700">
          Wave forecast
        </p>
        <p className="text-xs text-slate-400">
          Scorer parameter
          {day
            ? ` · ${day.source === "hrrr" ? "HRRR" : "HRDPS"} · ${day.tomorrow ? "tomorrow" : "today"}`
            : ""}
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
          <div className="mt-5 flex flex-wrap items-start gap-x-10 gap-y-5">
            <ScorerProfile levels={day.peak.scorerLevels} />
            <p className="max-w-sm text-[11px] leading-5 text-slate-400">
              At the peak hour ({day.peak.label}) — from 1,000 hPa at the station end to 100 hPa
              aloft. Falling with height is what lets the wave propagate; negative values are
              unstable layers that cannot carry it.
            </p>
          </div>
          <p className="mt-2 text-[11px] leading-5 text-slate-400">
            Lift is the N·h scale — the low-level stability over the height of the range — an upper
            bound, not a promise. An indicator from{" "}
            {day.source === "hrrr"
              ? "NOAA's HRRR model via Open-Meteo"
              : "the GEM-HRDPS model via Open-Meteo"}
            ; the Observatory&apos;s higher-summits forecast is the one to read before committing.
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
