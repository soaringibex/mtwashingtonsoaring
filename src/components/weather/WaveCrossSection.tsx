"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/fetch-json";
import { flyingChips, localStampFrom } from "@/lib/wx-window";
import { cellFill, wMs, WaveLegend } from "@/components/weather/wave-field";
import { buildWaveColumn, solveLinearWave, type SolveResult, type WaveColumnLevel } from "@/lib/linear-wave";
import { WAVE_LEVELS } from "@/lib/wave-score";

const SUMMIT = { lat: 44.2705, lon: -71.3032 };
/** Azimuth of the transect, degrees from north — NW (windward) to SE (lee) through the summit. */
const AZIMUTH = 125;
const STEP_KM = 2;
const DISTANCES = Array.from({ length: 14 }, (_, i) => -12 + i * STEP_KM);
const LEVELS = [950, 900, 850, 800, 700, 600, 500, 400, 300, 250, 200, 150];
const REFRESH_MS = 45 * 60 * 1000;
const FT_PER_M = 3.28084;

/** The solver's terrain sampling — 1 km, wider than the window so the taper is outside. */
const SOLVE_DX_M = 1000;
const SOLVE_DISTANCES = Array.from({ length: 49 }, (_, i) => i - 24);
/** The column for the linear solve, at the same point the wave score uses. */
const GORHAM = { lat: 44.3931, lon: -71.1996 };

function alongTransect(from: { lat: number; lon: number }, dKm: number) {
  const az = (AZIMUTH * Math.PI) / 180;
  return {
    lat: from.lat + (Math.cos(az) * dKm) / 111,
    lon: from.lon + (Math.sin(az) * dKm) / (111 * Math.cos((from.lat * Math.PI) / 180)),
  };
}

const COORDS = DISTANCES.map((d) => alongTransect(SUMMIT, d));

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

async function fetchCrossSection(): Promise<CrossData> {
  const variables = LEVELS.flatMap((hPa) => [
    `vertical_velocity_${hPa}hPa`,
    `geopotential_height_${hPa}hPa`,
  ]);
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${COORDS.map((c) => c.lat.toFixed(4)).join(",")}` +
    `&longitude=${COORDS.map((c) => c.lon.toFixed(4)).join(",")}` +
    `&hourly=${variables.join(",")}&models=ncep_hrrr_conus` +
    `&temperature_unit=celsius&timezone=America%2FNew_York&forecast_days=2`;

  const data = (await fetchJson(url)) as unknown;
  const locations = (Array.isArray(data) ? data : [data]) as {
    elevation?: number;
    utc_offset_seconds?: number;
    hourly?: Record<string, (number | null)[]>;
  }[];
  const first = locations[0];
  const times = (first?.hourly?.time ?? []) as unknown as string[];
  if (locations.length !== COORDS.length || times.length === 0) {
    throw new Error("missing cross-section");
  }
  const offsetSeconds = first?.utc_offset_seconds ?? 0;

  const points: CrossPoint[] = locations.map((location, i) => {
    const hourly = location.hourly ?? {};
    return {
      distanceKm: DISTANCES[i],
      elevationFt: (location.elevation ?? 0) * FT_PER_M,
      levels: LEVELS.map((hPa) => ({
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

/** Model terrain along the solver's transect. */
async function fetchTerrain(): Promise<{ distancesKm: number[]; elevationsM: number[] }> {
  const coords = SOLVE_DISTANCES.map((d) => alongTransect(SUMMIT, d));
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${coords.map((c) => c.lat.toFixed(4)).join(",")}` +
    `&longitude=${coords.map((c) => c.lon.toFixed(4)).join(",")}` +
    `&hourly=temperature_2m&models=ncep_hrrr_conus&forecast_days=1`;
  const data = (await fetchJson(url)) as unknown;
  const locations = (Array.isArray(data) ? data : [data]) as { elevation?: number }[];
  if (locations.length !== SOLVE_DISTANCES.length) throw new Error("missing terrain");
  return {
    distancesKm: SOLVE_DISTANCES,
    elevationsM: locations.map((location) => location.elevation ?? 0),
  };
}

type ColumnRaw = {
  times: string[];
  offsetSeconds: number;
  hourly: Record<string, (number | null)[]>;
  defaultIndex: number;
};

/** The full model column (for N·h) at the wave-score point. */
async function fetchColumnRaw(): Promise<ColumnRaw> {
  const variables = WAVE_LEVELS.flatMap((hPa) => [
    `geopotential_height_${hPa}hPa`,
    `wind_speed_${hPa}hPa`,
    `wind_direction_${hPa}hPa`,
    `temperature_${hPa}hPa`,
  ]);
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${GORHAM.lat}&longitude=${GORHAM.lon}` +
    `&hourly=${variables.join(",")}&models=ncep_hrrr_conus&wind_speed_unit=ms` +
    `&temperature_unit=celsius&timezone=America%2FNew_York&forecast_days=2`;
  const data = (await fetchJson(url)) as {
    hourly?: Record<string, (number | null)[]>;
    utc_offset_seconds?: number;
  };
  const hourly = data.hourly ?? {};
  const times = (hourly.time ?? []) as unknown as string[];
  if (times.length === 0) throw new Error("missing column");
  const offsetSeconds = data.utc_offset_seconds ?? 0;
  const now = Date.now();
  let defaultIndex = 0;
  for (let i = 0; i < times.length; i += 1) {
    if (Date.parse(`${times[i]}:00Z`) - offsetSeconds * 1000 <= now) defaultIndex = i;
    else break;
  }
  return { times, offsetSeconds, hourly, defaultIndex };
}

function columnLevelsAt(hourly: Record<string, (number | null)[]>, i: number): WaveColumnLevel[] {
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

/** The model's own vertical velocity along a ridge-normal transect through the summit. */
export function WaveCrossSection({
  selectedTime,
  onSelectTime,
}: {
  selectedTime: string | null;
  onSelectTime: (time: string) => void;
}) {
  const [data, setData] = useState<CrossData | null>(null);
  const [error, setError] = useState(false);
  const [terrain, setTerrain] = useState<{ distancesKm: number[]; elevationsM: number[] } | null>(null);
  const [column, setColumn] = useState<ColumnRaw | null>(null);
  const [linearError, setLinearError] = useState(false);
  const [mode, setMode] = useState<"linear" | "model">("linear");

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchCrossSection()
        .then((next) => {
          if (!cancelled) {
            setData(next);
            setError(false);
          }
        })
        .catch(() => {
          if (!cancelled) setError(true);
        });
      Promise.all([fetchTerrain(), fetchColumnRaw()])
        .then(([nextTerrain, nextColumn]) => {
          if (!cancelled) {
            setTerrain(nextTerrain);
            setColumn(nextColumn);
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

  let index = data?.defaultIndex ?? 0;
  if (data && selectedTime) {
    const found = data.times.indexOf(selectedTime);
    if (found >= 0) index = found;
  }

  // The linear solve for the selected hour — pure math (~0.04 ms per solve), so it can
  // run in render; the fetches above own the clock.
  let solve: SolveResult | null = null;
  if (terrain && column) {
    let columnIndex = column.defaultIndex;
    if (selectedTime) {
      const found = column.times.indexOf(selectedTime);
      if (found >= 0) columnIndex = found;
    }
    const waveColumn = buildWaveColumn(columnLevelsAt(column.hourly, columnIndex));
    if (waveColumn) {
      solve = solveLinearWave({ terrainM: terrain.elevationsM, dxM: SOLVE_DX_M, column: waveColumn });
    }
  }

  const W = 1000;
  const H = 330;
  const padL = 44;
  const padR = 12;
  const padT = 10;
  const padB = 30;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const xMin = DISTANCES[0];
  const xMax = DISTANCES[DISTANCES.length - 1];
  const x = (d: number) => padL + ((d - xMin) / (xMax - xMin)) * plotW;
  const distTicks = DISTANCES.filter((d) => d % 4 === 0);

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
      {distTicks.map((d) => (
        <text
          key={d}
          x={x(d)}
          y={H - 8}
          textAnchor="middle"
          className="fill-slate-400 text-[9px] tabular-nums"
        >
          {d > 0 ? `+${d}` : d}
        </text>
      ))}
      <text
        x={padL + plotW / 2}
        y={H - 8}
        textAnchor="middle"
        className="fill-slate-400 text-[9px]"
      >
        km from the summit · NW (windward) to SE (lee)
      </text>
      <text x={padL - 6} y={padT + 8} textAnchor="end" className="fill-slate-400 text-[9px]">
        ft
      </text>
    </>
  );

  let content: React.ReactNode = null;
  if (mode === "linear") {
    if (solve && terrain) {
      const lastLevel = solve.zM.length - 1;
      const topFt = solve.zM[lastLevel] * FT_PER_M;
      const yMax = Math.ceil(Math.min(topFt + 1500, 55000) / 5000) * 5000;
      const y = (altFt: number) =>
        padT + (1 - Math.min(Math.max(altFt, 0), yMax) / yMax) * plotH;
      const altTicks: number[] = [];
      for (let alt = 10000; alt <= yMax; alt += 10000) altTicks.push(alt);

      const shown = terrain.distancesKm
        .map((d, i) => ({ d, i }))
        .filter(({ d }) => d >= xMin && d <= xMax);

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
              className={cellFill(value)}
            />,
          );
        }
      }

      const profile = terrain.elevationsM
        .map((h, i) => ({ d: terrain.distancesKm[i], ft: h * FT_PER_M }))
        .filter(({ d }) => d >= xMin && d <= xMax);
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
            aria-label="Linear-theory vertical velocity cross-section through Mount Washington"
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
              {peak.d === 0 ? "Mt Washington" : "Presidential Range"}
            </text>
          </svg>
          <WaveLegend />
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
      for (let j = 0; j < LEVELS.length - 1; j += 1) {
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
            className={cellFill(w)}
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
          className="mt-3 w-full"
          role="img"
          aria-label="Vertical velocity cross-section through Mount Washington"
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
            {peak.distanceKm === 0 ? "Mt Washington" : "Presidential Range"}
          </text>
        </svg>
        <WaveLegend />
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
              ? "Linear-theory estimate: the steady wave equation solved from the terrain profile and the HRRR temperature and wind column — the model's own pressure-level vertical velocity is much smoother, so switch the field to HRRR for comparison."
              : "The model's own vertical velocity along the line through the summit, grey being the model terrain."}{" "}
            Warm colours are lift, blue is sink — pick any hour above; the wave panel shares the
            selection. The transect runs about 26 km from the Great Gulf side across to Bartlett.
          </p>
        </>
      ) : error || (mode === "linear" && linearError) ? (
        <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600 ring-1 ring-slate-900/5">
          {mode === "linear" && linearError
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
