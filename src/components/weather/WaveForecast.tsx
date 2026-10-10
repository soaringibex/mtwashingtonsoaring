"use client";

import { useEffect, useRef, useState } from "react";
import { SectionNote } from "@/components/weather/SectionNote";
import { fetchJson } from "@/lib/fetch-json";
import { mergedSeries } from "@/lib/forecast-model";
import { computeWaveScore, estimateWaveTop, signalLabel, WAVE_LEVELS, type WaveLevel, type WaveScore, type WaveTop } from "@/lib/wave-score";
import { flyingWindow, hourLabel, inWindow, compassName } from "@/lib/wx-window";
import { wxApiPath } from "@/lib/wx-datasets";

const REFRESH_MS = 45 * 60 * 1000;

/** The same depth-of-blue language the wind profile's bars use — deeper is stronger. */
function scoreBar(score: number): string {
  if (score >= 75) return "bg-sky-700";
  if (score >= 55) return "bg-sky-600";
  if (score >= 35) return "bg-sky-400";
  return "bg-slate-300";
}

type WaveHour = { time: string; hour: number; label: string; waveTop: WaveTop } & WaveScore;
type WaveDay = {
  tomorrow: boolean;
  nowHour: number;
  hours: WaveHour[];
  peak: WaveHour;
  source: "hrrr" | "hrdps";
};

/** The Scorer-parameter wave signal for the flying day, hour by hour, from Open-Meteo. */
async function fetchWaveDayFrom(
  variant: "hrrr" | "hrdps",
  source: WaveDay["source"],
): Promise<WaveDay> {
  const data = (await fetchJson(wxApiPath("wave-forecast", { models: variant }))) as {
    hourly: Record<string, unknown>;
  };
  const hourly = data.hourly;
  const times = hourly.time as unknown as string[];
  if (!times || times.length === 0) throw new Error("missing wave forecast");

  const at = (key: string, index: number): number | null => {
    // A single requested model comes back with plain keys; a merged pair is suffixed.
    const series =
      variant === "hrdps"
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
      levels.push({
        hPa,
        altM,
        speedKt,
        dirDeg,
        tempC,
        cloudCover: at(`cloud_cover_${hPa}hPa`, i),
      });
    }
    if (!complete) continue;

    const score = computeWaveScore(levels);
    if (!score) continue;
    const waveTop = estimateWaveTop(levels, score.scorerLevels);
    if (!waveTop) continue;
    hours.push({ time, hour, label: hourLabel(hour), waveTop, ...score });
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
    return await fetchWaveDayFrom("hrrr", "hrrr");
  } catch {
    return await fetchWaveDayFrom("hrdps", "hrdps");
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
    (level): level is { hPa: number; altM: number; scorer: number } =>
      level.scorer !== null && level.hPa <= 850,
  );
  if (points.length < 2) return null;

  const FT_PER_M = 3.28084;
  const values = points.map((point) => point.scorer * 1e7);
  // The lowest levels can still spike (unstable air, near-calm winds); clip the display
  // to a window where the wave-relevant structure is readable.
  const xMin = Math.max(Math.min(0, Math.floor(Math.min(...values))), -10);
  const xMax = Math.max(Math.min(Math.ceil(Math.max(...values)), 15), xMin + 10);
  const alts = points.map((point) => point.altM * FT_PER_M);
  const yMin = Math.max(0, Math.floor((Math.min(...alts) - 500) / 1000) * 1000);
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
  for (let alt = Math.ceil(yMin / altStep) * altStep; alt <= yMax; alt += altStep) {
    altTicks.push(alt);
  }

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

/** The day's estimated climbing top, hour by hour, with any cloud ceiling shaded. */
function WaveTopMeteogram({ hours }: { hours: WaveHour[] }) {
  if (hours.length < 2) return null;
  const tops = hours.map((hour) => hour.waveTop.topFt);
  const yMax = Math.min(
    55000,
    Math.max(30000, Math.ceil((Math.max(...tops, 6288) + 1500) / 5000) * 5000),
  );

  const W = 980;
  const H = 200;
  const padL = 42;
  const padR = 10;
  const padT = 10;
  const padB = 26;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const x = (index: number) => padL + ((index + 0.5) / hours.length) * plotW;
  const y = (altFt: number) => padT + (1 - Math.min(Math.max(altFt, 0), yMax) / yMax) * plotH;
  const step = plotW / hours.length;

  const altTicks: number[] = [];
  for (let alt = 10000; alt <= yMax; alt += 10000) altTicks.push(alt);

  const areaPath = [
    ...hours.map(
      (hour, index) =>
        `${index === 0 ? "M" : "L"} ${x(index).toFixed(1)} ${y(hour.waveTop.topFt).toFixed(1)}`,
    ),
    `L ${x(hours.length - 1).toFixed(1)} ${y(6288).toFixed(1)}`,
    `L ${x(0).toFixed(1)} ${y(6288).toFixed(1)}`,
    "Z",
  ].join(" ");
  const linePath = hours
    .map(
      (hour, index) =>
        `${index === 0 ? "M" : "L"} ${x(index).toFixed(1)} ${y(hour.waveTop.topFt).toFixed(1)}`,
    )
    .join(" ");

  let reflectionPath = "";
  let penDown = false;
  hours.forEach((hour, index) => {
    const value =
      hour.waveTop.reflectionFt !== null && hour.waveTop.reflectionFt < hour.waveTop.topFt
        ? hour.waveTop.reflectionFt
        : null;
    if (value === null) {
      penDown = false;
      return;
    }
    reflectionPath += `${penDown ? " L" : " M"} ${x(index).toFixed(1)} ${y(value).toFixed(1)}`;
    penDown = true;
  });

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="mt-3 w-full"
      role="img"
      aria-label="Estimated top of the usable wave, hour by hour"
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
            {alt / 1000}k
          </text>
        </g>
      ))}

      {hours.map((hour, index) =>
        hour.waveTop.ceilingFt !== null && hour.waveTop.cloudTopFt !== null ? (
          <rect
            key={`cloud-${hour.time}`}
            x={x(index) - step / 2}
            y={y(hour.waveTop.cloudTopFt)}
            width={step}
            height={Math.max(1.5, y(hour.waveTop.ceilingFt) - y(hour.waveTop.cloudTopFt))}
            className="fill-slate-400/50"
          />
        ) : null,
      )}

      <line
        x1={padL}
        x2={W - padR}
        y1={y(6288)}
        y2={y(6288)}
        className="stroke-slate-300"
        strokeDasharray="4 4"
        vectorEffect="non-scaling-stroke"
      />
      <text
        x={W - padR}
        y={y(6288) - 4}
        textAnchor="end"
        className="fill-slate-400 text-[9px]"
      >
        summit 6,288 ft
      </text>

      <path d={areaPath} className="fill-sky-500/10" />
      <path
        d={linePath}
        fill="none"
        className="stroke-sky-600"
        strokeWidth={1.8}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {reflectionPath ? (
        <path
          d={reflectionPath}
          fill="none"
          className="stroke-sky-400"
          strokeWidth={1.4}
          strokeDasharray="4 3"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      ) : null}

      {hours.map((hour, index) => (
        <circle key={hour.time} cx={x(index)} cy={y(hour.waveTop.topFt)} r={2.4} className="fill-sky-600">
          <title>
            {hour.label} · top {hour.waveTop.topFt.toLocaleString("en-US")} ft
            {hour.waveTop.reflectionFt !== null
              ? ` · resonant cap ${hour.waveTop.reflectionFt.toLocaleString("en-US")} ft`
              : ""}
            {hour.waveTop.ceilingFt !== null
              ? ` · cloud ceiling ${hour.waveTop.ceilingFt.toLocaleString("en-US")} ft`
              : ""}
          </title>
        </circle>
      ))}

      {hours.map((hour, index) =>
        hour.waveTop.reflectionFt !== null && hour.waveTop.reflectionFt < hour.waveTop.topFt ? (
          <circle
            key={`reflection-${hour.time}`}
            cx={x(index)}
            cy={y(hour.waveTop.reflectionFt)}
            r={2}
            className="fill-sky-400"
          >
            <title>{`${hour.label} · resonant cap ${hour.waveTop.reflectionFt.toLocaleString("en-US")} ft`}</title>
          </circle>
        ) : null,
      )}

      {hours.map((hour, index) =>
        index % 2 === 0 ? (
          <text
            key={`label-${hour.time}`}
            x={x(index)}
            y={H - 8}
            textAnchor="middle"
            className="fill-slate-400 text-[9px]"
          >
            {hour.label}
          </text>
        ) : null,
      )}

      <text x={padL - 6} y={padT + 8} textAnchor="end" className="fill-slate-400 text-[9px]">
        ft
      </text>
    </svg>
  );
}

export function WaveForecast({
  selectedTime,
  onSelectTime,
}: {
  selectedTime: string | null;
  onSelectTime: (time: string) => void;
}) {
  const [day, setDay] = useState<WaveDay | null>(null);
  const [error, setError] = useState(false);
  const defaulted = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchWaveDay()
        .then((next) => {
          if (cancelled) return;
          setDay(next);
          setError(false);
          if (!defaulted.current) {
            defaulted.current = true;
            onSelectTime(next.peak.time);
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
  }, [onSelectTime]);

  const selected = day
    ? (day.hours.find((hour) => hour.time === selectedTime) ?? day.peak)
    : null;

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

      <SectionNote>
        Wave lift needs wind crossing the ridge and stable air stacked above it. This card scores
        how well the day has both, hour by hour — higher is a stronger signal. Treat it as a hint,
        not a promise.
      </SectionNote>

      {day && selected ? (
        <>
          <div className="mt-6 grid items-start gap-x-10 gap-y-6 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            <div>
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <span className="font-display text-5xl font-bold leading-none tabular-nums text-sky-800">
                  {selected.score}
                </span>
                <span className="flex flex-col leading-tight">
                  <span className="font-display text-base font-semibold text-slate-900">
                    {signalLabel(selected.score)}
                  </span>
                  <span className="text-xs text-slate-500">
                    {selected.label}
                    {selected.liftFpm >= 300
                      ? ` · lift up to ~${selected.liftFpm.toLocaleString("en-US")} fpm`
                      : " · lift marginal"}
                  </span>
                </span>
              </div>

              <div className="mt-5 flex flex-wrap items-start gap-x-10 gap-y-5">
                <ScorerProfile levels={selected.scorerLevels} />
                <p className="max-w-sm text-[11px] leading-5 text-slate-400">
                  At {selected.label} — the ridge-height band (850 hPa) up to 100 hPa aloft.
                  Falling with height is what lets the wave propagate; negative values are
                  unstable layers that cannot carry it.
                </p>
              </div>

              <p className="mt-4 text-[11px] leading-5 text-slate-400">
                Cross-ridge wind {selected.ridgeKt} kt ({compassName(selected.ridgeDirDeg)}) at
                ridge-top, {selected.aloftKt} kt aloft · Scorer {scorer(selected.lowScorer)} →{" "}
                {scorer(selected.highScorer)} (×10⁻⁷ m⁻²) · N{" "}
                {(selected.bruntLow * 100).toFixed(1)}×10⁻² s⁻¹.
              </p>
            </div>

            <div className="order-first xl:order-none">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  By hour
                </p>
                <p className="text-[11px] text-slate-400">
                  peak {day.peak.score} · {day.peak.label}
                </p>
              </div>
              <div className="mt-2 grid gap-1">
                {day.hours.map((hour) => {
                  const isSelected = hour.time === selected.time;
                  const isNow = !day.tomorrow && hour.hour === day.nowHour;
                  return (
                    <button
                      key={hour.time}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => onSelectTime(hour.time)}
                      className={`grid grid-cols-[3.5rem_2.25rem_minmax(0,1fr)_4.5rem] items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-colors ${
                        isSelected ? "bg-sky-50 ring-1 ring-sky-200" : "hover:bg-slate-50"
                      }`}
                    >
                      <span
                        className={`text-xs font-medium ${isSelected ? "text-sky-700" : "text-slate-500"}`}
                      >
                        {hour.label}
                        {isNow ? " · now" : ""}
                      </span>
                      <span className="font-display text-sm font-bold tabular-nums text-slate-900">
                        {hour.score}
                      </span>
                      <span className="relative block h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <span
                          className={`absolute inset-y-0 left-0 rounded-full ${scoreBar(hour.score)}`}
                          style={{ width: `${Math.max(4, hour.score)}%` }}
                        />
                      </span>
                      <span className="text-right text-[11px] tabular-nums text-slate-400">
                        {hour.liftFpm >= 300 ? `~${hour.liftFpm.toLocaleString("en-US")} fpm` : "—"}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 text-[11px] leading-5 text-slate-400">
                Click an hour to read its Scorer profile on the left.
              </p>
            </div>
          </div>

          <div className="mt-6 border-t border-slate-100 pt-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Usable wave top · by hour
              </p>
              <p className="text-[11px] text-slate-400">
                solid: climbing envelope · dashed: resonant wave cap · cloud shaded where it caps
              </p>
            </div>
            <WaveTopMeteogram hours={day.hours} />
            <p className="mt-2 text-[11px] leading-5 text-slate-400">
              The dashed line is where the Scorer parameter falls below the terrain wavenumber —
              the resonant wave caps there; longer wavelengths can still carry lift above it, up to
              the solid envelope.
            </p>
          </div>

          <p className="mt-4 text-[11px] leading-5 text-slate-400">
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
        <div
          className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]"
          aria-hidden="true"
        >
          <div className="grid content-start gap-3">
            <div className="h-12 w-44 animate-pulse rounded-2xl bg-slate-100" />
            <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
          </div>
          <div className="grid content-start gap-2">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="h-9 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
