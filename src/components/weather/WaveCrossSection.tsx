"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/fetch-json";
import { compassName, flyingChips, localStampFrom } from "@/lib/wx-window";
import { cellFill, wMs, WaveLegend } from "@/components/weather/wave-field";
import { buildWaveColumn, solveLinearWave, type SolveResult } from "@/lib/linear-wave";
import {
  columnLevelsAt,
  fetchUpwindColumnRaw,
  fetchWaveColumnRaw,
  readCachedTerrain,
  waveAzimuth,
  waveColumnHour,
  writeCachedTerrain,
  type WaveColumnRaw,
} from "@/lib/wave-column";
import {
  AREA_RADIUS_NM,
  KM_PER_NM,
  MODEL_DISTANCES,
  CROSS_LEVELS as MODEL_LEVELS,
  SOLVE_DISTANCES,
  SOLVE_DX_M,
  WINDOW_KM,
  azimuthBucket,
  wxApiPath,
} from "@/lib/wx-datasets";

/**
 * The transect follows the LOA. The Mount Washington Glider Area is a circle of
 * radius 10 NM centred at 44°17′26″N 071°13′40″W (the Boston ARTCC letter of
 * agreement), and the cross-section runs along this hour's 800 hPa wind through
 * that centre — the chart is the slice inside the circle.
 */

const REFRESH_MS = 45 * 60 * 1000;
const FT_PER_M = 3.28084;

async function fetchTerrainLine(bucket: number): Promise<number[]> {
  const key = `mws-wave-terrain-line-v1-${bucket}`;
  const cached = readCachedTerrain(key, SOLVE_DISTANCES.length);
  if (cached) return cached;
  const data = (await fetchJson(wxApiPath("terrain-line", { azimuth: bucket }))) as {
    elevation?: number[];
  } | null;
  const values = data?.elevation;
  if (!Array.isArray(values) || values.length !== SOLVE_DISTANCES.length) {
    throw new Error("missing terrain line");
  }
  writeCachedTerrain(key, values);
  return values;
}

type CrossLevel = {
  hPa: number;
  w: (number | null)[];
  altFt: (number | null)[];
};

type CrossPoint = { distanceKm: number; elevationFt: number; levels: CrossLevel[] };
type CrossData = {
  times: string[];
  offsetSeconds: number;
  points: CrossPoint[];
  defaultIndex: number;
  chips: { time: string; label: string }[];
};

async function fetchModelField(azimuth: number): Promise<CrossData> {
  const data = (await fetchJson(wxApiPath("cross-section", { azimuth }))) as unknown;
  const locations = (Array.isArray(data) ? data : [data]) as {
    elevation?: number;
    utc_offset_seconds?: number;
    hourly?: Record<string, (number | null)[]>;
  }[];
  const first = locations[0];
  const times = (first?.hourly?.time ?? []) as unknown as string[];
  if (locations.length !== MODEL_DISTANCES.length || times.length === 0) {
    throw new Error("missing cross-section");
  }
  const offsetSeconds = first?.utc_offset_seconds ?? 0;

  const points: CrossPoint[] = locations.map((location, i) => {
    const hourly = location.hourly ?? {};
    return {
      distanceKm: MODEL_DISTANCES[i],
      elevationFt: (location.elevation ?? 0) * FT_PER_M,
      levels: MODEL_LEVELS.map((hPa) => ({
        hPa,
        w: hourly[`vertical_velocity_${hPa}hPa`] ?? [],
        altFt: (hourly[`geopotential_height_${hPa}hPa`] ?? []).map((z) =>
          typeof z === "number" ? z * FT_PER_M : null,
        ),
      })),
    };
  });

  // The hour containing now, resolved once here where the clock is allowed.
  const now = Date.now();
  let defaultIndex = 0;
  for (let i = 0; i < times.length; i += 1) {
    if (Date.parse(`${times[i]}:00Z`) - offsetSeconds * 1000 <= now) defaultIndex = i;
    else break;
  }

  return { times, offsetSeconds, points, defaultIndex, chips: flyingChips(times) };
}

/** The linear-theory wave field and the model's own field along the hour's wind line. */
export function WaveCrossSection({
  selectedTime,
  onSelectTime,
}: {
  selectedTime: string | null;
  onSelectTime: (time: string) => void;
}) {
  const [mode, setMode] = useState<"linear" | "model">("linear");
  const [column, setColumn] = useState<WaveColumnRaw | null>(null);
  const [terrainLine, setTerrainLine] = useState<{ bucket: number; elevationsM: number[] } | null>(null);
  const [upwindColumn, setUpwindColumn] = useState<WaveColumnRaw | null>(null);
  const [field, setField] = useState<{ bucket: number; data: CrossData } | null>(null);
  const [linearError, setLinearError] = useState(false);
  const [error, setError] = useState(false);

  // The column first — the wind in it orients everything downstream.
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchWaveColumnRaw()
        .then((next) => {
          if (!cancelled) {
            setColumn(next);
            setLinearError(false);
          }
        })
        .catch(() => {
          if (!cancelled) setLinearError(true);
        });
    };
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const hourIndex = column ? waveColumnHour(column, selectedTime) : 0;
  const levels = column ? columnLevelsAt(column.hourly, hourIndex) : [];
  const windFrom = waveAzimuth(levels);
  const transectAzimuth = (windFrom + 180) % 360;
  const bucket = column && levels.length > 0 ? azimuthBucket(windFrom) : null;

  // The solve runs on the undisturbed inflow sounding — the local Gorham column is
  // inside the wave on a NW day, and the amplitude scales with the base-plane wind.
  // Falls back to the local column when the upwind fetch cannot be had.
  useEffect(() => {
    if (bucket === null) return;
    let cancelled = false;
    fetchUpwindColumnRaw(bucket)
      .then((next) => {
        if (!cancelled) setUpwindColumn(next);
      })
      .catch(() => {
        if (!cancelled) setUpwindColumn(null);
      });
    return () => {
      cancelled = true;
    };
  }, [bucket]);

  // The terrain line and the model field follow the chosen hour's direction.
  useEffect(() => {
    if (bucket === null) return;
    let cancelled = false;
    const load = () => {
      fetchTerrainLine(bucket)
        .then((elevationsM) => {
          if (!cancelled) {
            setTerrainLine({ bucket, elevationsM });
            setLinearError(false);
          }
        })
        .catch(() => {
          if (!cancelled) setLinearError(true);
        });
      fetchModelField(bucket)
        .then((next) => {
          if (!cancelled) {
            setField({ bucket, data: next });
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
  }, [bucket]);

  // The linear solve for the selected hour — pure math (~0.1 ms), so it runs in render.
  let solve: SolveResult | null = null;
  if (column && terrainLine && levels.length > 0) {
    const solveLevels = upwindColumn
      ? columnLevelsAt(upwindColumn.hourly, waveColumnHour(upwindColumn, selectedTime))
      : levels;
    const baseM =
      terrainLine.elevationsM.reduce((sum, h) => sum + h, 0) / terrainLine.elevationsM.length;
    const waveColumn = buildWaveColumn(solveLevels, transectAzimuth, baseM);
    if (waveColumn) {
      solve = solveLinearWave({ terrainM: terrainLine.elevationsM, dxM: SOLVE_DX_M, column: waveColumn });
    }
  }
  const linearUnavailable = linearError || (!solve && Boolean(terrainLine && column));

  const data = field?.data ?? null;
  const staleField = field !== null && bucket !== null && field.bucket !== bucket;

  let index = data?.defaultIndex ?? 0;
  if (data && selectedTime) {
    const found = data.times.indexOf(selectedTime);
    if (found >= 0) index = found;
  }

  const windLabel = `${compassName(windFrom)} ${Math.round(windFrom)}°`;

  const W = 1000;
  const H = 330;
  const padL = 44;
  const padR = 12;
  const padT = 10;
  const padB = 30;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const xMin = -WINDOW_KM;
  const xMax = WINDOW_KM;
  const x = (d: number) => padL + ((d - xMin) / (xMax - xMin)) * plotW;
  const distTicks = [-AREA_RADIUS_NM, -5, 0, 5, AREA_RADIUS_NM];

  const axes = (altTicks: number[], y: (altFt: number) => number) => (
    <>
      {altTicks.map((alt) => (
        <g key={alt}>
          <line
            x1={padL}
            x2={W - padR}
            y1={y(alt)}
            y2={y(alt)}
            className="stroke-slate-900/10"
            strokeDasharray="4 4"
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
      {distTicks.map((nm) => (
        <text
          key={nm}
          x={x(nm * KM_PER_NM)}
          y={H - 8}
          textAnchor="middle"
          className="fill-slate-400 text-[9px] tabular-nums"
        >
          {nm > 0 ? `+${nm}` : nm}
        </text>
      ))}
      <text
        x={padL + plotW / 2}
        y={H - 20}
        textAnchor="middle"
        className="fill-slate-400 text-[9px]"
      >
        NM from the Glider Area centre · upwind to downwind
      </text>
      <text x={padL - 6} y={padT + 8} textAnchor="end" className="fill-slate-400 text-[9px]">
        ft
      </text>
    </>
  );

  let content: React.ReactNode = null;
  if (mode === "linear") {
    if (solve && terrainLine) {
      const lastLevel = solve.zM.length - 1;
      const topFt = solve.zM[lastLevel] * FT_PER_M;
      const yMax = Math.ceil(Math.min(topFt + 1500, 55000) / 5000) * 5000;
      const y = (altFt: number) =>
        padT + (1 - Math.min(Math.max(altFt, 0), yMax) / yMax) * plotH;
      const altTicks: number[] = [];
      for (let alt = 10000; alt <= yMax; alt += 10000) altTicks.push(alt);

      const shown = SOLVE_DISTANCES.map((d, i) => ({ d, i })).filter(
        ({ d }) => d >= xMin && d <= xMax,
      );

      const cells: React.ReactNode[] = [];
      for (let s = 0; s < shown.length - 1; s += 1) {
        const a = shown[s];
        const b = shown[s + 1];
        for (let j = 0; j < lastLevel; j += 1) {
          const zBot = solve.zM[j] * FT_PER_M;
          const zTop = solve.zM[j + 1] * FT_PER_M;
          const corners = [
            solve.w[j][a.i],
            solve.w[j][b.i],
            solve.w[j + 1][a.i],
            solve.w[j + 1][b.i],
          ];
          const value = corners.reduce((sum, v) => sum + v, 0) / corners.length;
          cells.push(
            <rect
              key={`${a.d}-${j}`}
              x={x(a.d).toFixed(1)}
              y={y(zTop).toFixed(1)}
              width={(x(b.d) - x(a.d)).toFixed(1)}
              height={Math.max(y(zBot) - y(zTop), 0.1).toFixed(1)}
              className={cellFill(value, "linear")}
            />,
          );
        }
      }

      const profile = SOLVE_DISTANCES.map((d, i) => ({
        d,
        ft: terrainLine.elevationsM[i] * FT_PER_M,
      })).filter(({ d }) => d >= xMin && d <= xMax);
      const terrainPath =
        `M ${x(xMin).toFixed(1)},${(padT + plotH).toFixed(1)} ` +
        profile.map(({ d, ft }) => `L ${x(d).toFixed(1)},${y(ft).toFixed(1)}`).join(" ") +
        ` L ${x(xMax).toFixed(1)},${(padT + plotH).toFixed(1)} Z`;
      const peak = profile.reduce((best, point) => (point.ft > best.ft ? point : best), profile[0]);

      content = (
        <>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="mt-3 w-full"
            role="img"
            aria-label="Linear-theory vertical velocity cross-section along the wind through the Mount Washington Glider Area"
          >
            {cells}
            {axes(altTicks, y)}
            <path d={terrainPath} className="fill-slate-300" />
            <text
              x={x(peak.d)}
              y={y(peak.ft) - 5}
              textAnchor="middle"
              className="fill-slate-500 text-[9px]"
            >
              ridge crest
            </text>
          </svg>
          <WaveLegend scale="linear" />
        </>
      );
    }
  } else if (data) {
    const topAlt = Math.max(
      ...data.points.flatMap((point) =>
        point.levels.map((level) => level.altFt[index] ?? 0),
      ),
      10000,
    );
    const yMax = Math.ceil(Math.min(topAlt + 1500, 52000) / 5000) * 5000;
    const y = (altFt: number) =>
      padT + (1 - Math.min(Math.max(altFt, 0), yMax) / yMax) * plotH;

    const altTicks: number[] = [];
    for (let alt = 10000; alt <= yMax; alt += 10000) altTicks.push(alt);

    const cells: React.ReactNode[] = [];
    for (let i = 0; i < data.points.length - 1; i += 1) {
      const a = data.points[i];
      const b = data.points[i + 1];
      for (let j = 0; j < MODEL_LEVELS.length - 1; j += 1) {
        const al = a.levels[j];
        const au = a.levels[j + 1];
        const bl = b.levels[j];
        const bu = b.levels[j + 1];
        const za0 = al.altFt[index];
        const za1 = au.altFt[index];
        const zb0 = bl.altFt[index];
        const zb1 = bu.altFt[index];
        if (za0 === null || za1 === null || zb0 === null || zb1 === null) continue;
        const corners = [
          wMs(al.w[index]),
          wMs(au.w[index]),
          wMs(bl.w[index]),
          wMs(bu.w[index]),
        ].filter((value): value is number => value !== null);
        if (corners.length === 0) continue;
        const w = corners.reduce((sum, value) => sum + value, 0) / corners.length;
        cells.push(
          <polygon
            key={`${i}-${j}`}
            points={`${x(a.distanceKm).toFixed(1)},${y(za0).toFixed(1)} ${x(b.distanceKm).toFixed(1)},${y(zb0).toFixed(1)} ${x(b.distanceKm).toFixed(1)},${y(zb1).toFixed(1)} ${x(a.distanceKm).toFixed(1)},${y(za1).toFixed(1)}`}
            className={cellFill(w, "hrrr")}
          />,
        );
      }
    }

    const terrainPoints = data.points
      .map((point) => `${x(point.distanceKm).toFixed(1)},${y(point.elevationFt).toFixed(1)}`)
      .join(" ");
    const terrainPath = `M ${x(xMin).toFixed(1)},${padT + plotH} L ${terrainPoints} L ${x(xMax).toFixed(1)},${padT + plotH} Z`;
    const peak = data.points.reduce((best, point) =>
      point.elevationFt > best.elevationFt ? point : best,
    );

    content = (
      <>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className={`mt-3 w-full transition-opacity ${staleField ? "opacity-50" : ""}`}
          role="img"
          aria-label="Vertical velocity cross-section along the wind through the Mount Washington Glider Area"
        >
          {cells}
          {axes(altTicks, y)}
          <path d={terrainPath} className="fill-slate-300" />
          <text
            x={x(peak.distanceKm)}
            y={y(peak.elevationFt) - 5}
            textAnchor="middle"
            className="fill-slate-500 text-[9px]"
          >
            ridge crest
          </text>
        </svg>
        <WaveLegend scale="hrrr" />
      </>
    );
  }

  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5 sm:p-7">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-display text-xs font-semibold uppercase tracking-[0.28em] text-sky-700">
          Wave field · cross-section
        </p>
        <p className="text-xs text-slate-400">
          {data ? `${localStampFrom(data.times[index], data.offsetSeconds)} · HRRR` : "HRRR"}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          Field
        </span>
        {(
          [
            ["linear", "Linear estimate"],
            ["model", "HRRR field"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={mode === value}
            onClick={() => setMode(value)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
              mode === value
                ? "bg-sky-100 text-sky-700 ring-1 ring-sky-200"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {label}
          </button>
        ))}
        <p className="text-[11px] text-slate-400">
          the line runs along the 800 hPa wind, {windLabel}, through the Glider Area centre
        </p>
      </div>

      {data ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {data.chips.map((chip) => {
            const active = chip.time === data.times[index];
            return (
              <button
                key={chip.time}
                type="button"
                aria-pressed={active}
                onClick={() => onSelectTime(chip.time)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  active
                    ? "bg-sky-100 text-sky-700 ring-1 ring-sky-200"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {chip.label}
              </button>
            );
          })}
          <p className="text-[11px] text-slate-400">the hour</p>
        </div>
      ) : null}

      {content ? (
        <>
          {content}
          <p className="mt-3 text-[11px] leading-5 text-slate-400">
            {mode === "linear"
              ? `Linear-theory estimate: the steady wave equation solved from the terrain profile and the HRRR column, on this hour's wind line (${windLabel}) through the LOA's Glider Area centre — the chart is the slice inside the 10 NM circle. The model's own pressure-level vertical velocity is much smoother; switch the field to HRRR for comparison.`
              : `The model's own vertical velocity along this hour's wind line (${windLabel}) through the LOA's Glider Area centre, grey being the terrain.`}{" "}
            Warm colours are lift, blue is sink — pick any hour above; the wave panel shares the
            selection.
          </p>
        </>
      ) : error || linearUnavailable ? (
        <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600 ring-1 ring-slate-900/5">
          {mode === "linear" && linearUnavailable && !error
            ? "The linear wave solve is unavailable right now. "
            : "The cross-section is unavailable right now. "}
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
        <div className="mt-4 grid gap-2" aria-hidden="true">
          <div className="h-[300px] animate-pulse rounded-2xl bg-slate-100" />
        </div>
      )}
    </div>
  );
}
