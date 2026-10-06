"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchJson } from "@/lib/fetch-json";
import { flyingChips, localStampFrom } from "@/lib/wx-window";
import { cellFill, wMs, WaveLegend } from "@/components/weather/wave-field";
import { buildWaveColumn, solveLinearWave } from "@/lib/linear-wave";
import {
  alongTransect,
  columnLevelsAt,
  fetchWaveColumnRaw,
  readCachedTerrain,
  waveColumnHour,
  writeCachedTerrain,
  type WaveColumnRaw,
} from "@/lib/wave-column";

const REFRESH_MS = 45 * 60 * 1000;

/** 10 x 10 grid over Gorham, the Presidential Range and the Bartlett valley. */
const ROWS = 10;
const COLS = 10;
const LAT_MIN = 44.06;
const LAT_STEP = 0.04;
const LON_MIN = -71.55;
const LON_STEP = 0.0671;
const GRID = (() => {
  const points: { lat: number; lon: number }[] = [];
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      points.push({ lat: LAT_MIN + row * LAT_STEP, lon: LON_MIN + col * LON_STEP });
    }
  }
  return points;
})();

/** The flow direction the terrain profiles run along (the cross-section's azimuth). */
const AZIMUTH = 125;
/** Each cell is solved from a 1.6 km terrain profile through its centre. */
const SOLVE_DX_M = 1600;
const PROFILE_DISTANCES = Array.from({ length: 49 }, (_, i) => (i - 24) * 1.6);
const PROFILE_CENTER = 24;

/**
 * One fine terrain grid serves every cell's profile — ~3.3 km east-west, ~3.5 km
 * north-south over the map and the flow lines' reach — sampled by bilinear
 * interpolation instead of a fetch per cell. The free API counts each location
 * against a per-minute budget, and terrain is static, so the grid is fetched
 * through the elevation endpoint in three quiet calls and kept in localStorage.
 */
const FINE_COLS = 20;
const FINE_ROWS = 10;
const FINE_LON_MIN = -71.68;
const FINE_LON_SPAN = 0.78;
const FINE_LAT_MIN = 43.98;
const FINE_LAT_SPAN = 0.44;
const FINE_POINTS = (() => {
  const points: { lat: number; lon: number }[] = [];
  for (let row = 0; row < FINE_ROWS; row += 1) {
    for (let col = 0; col < FINE_COLS; col += 1) {
      points.push({
        lat: FINE_LAT_MIN + (row * FINE_LAT_SPAN) / (FINE_ROWS - 1),
        lon: FINE_LON_MIN + (col * FINE_LON_SPAN) / (FINE_COLS - 1),
      });
    }
  }
  return points;
})();

const TERRAIN_CACHE_KEY = "mws-wave-terrain-grid-v1";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchTerrainGrid(): Promise<number[]> {
  const cached = readCachedTerrain(TERRAIN_CACHE_KEY, FINE_POINTS.length);
  if (cached) return cached;

  const CHUNK = 100; // the elevation endpoint's per-request cap
  const elevations: number[] = [];
  for (let start = 0; start < FINE_POINTS.length; start += CHUNK) {
    if (start > 0) await sleep(350);
    const chunk = FINE_POINTS.slice(start, start + CHUNK);
    const url =
      `https://api.open-meteo.com/v1/elevation?latitude=${chunk.map((p) => p.lat.toFixed(4)).join(",")}` +
      `&longitude=${chunk.map((p) => p.lon.toFixed(4)).join(",")}`;
    let data: unknown;
    try {
      data = await fetchJson(url);
    } catch {
      // One slow second chance — a 429 from the burst limit clears quickly.
      await sleep(1800);
      data = await fetchJson(url);
    }
    const values = (data as { elevation?: number[] } | null)?.elevation;
    if (!Array.isArray(values) || values.length !== chunk.length) {
      throw new Error("missing terrain grid");
    }
    elevations.push(...values);
  }

  writeCachedTerrain(TERRAIN_CACHE_KEY, elevations);
  return elevations;
}

/** Bilinear sample of the fine terrain grid, clamped at its edges. */
function sampleTerrain(grid: number[], lat: number, lon: number): number {
  const fx = ((lon - FINE_LON_MIN) / FINE_LON_SPAN) * (FINE_COLS - 1);
  const fy = ((lat - FINE_LAT_MIN) / FINE_LAT_SPAN) * (FINE_ROWS - 1);
  const x0 = Math.min(Math.max(Math.floor(fx), 0), FINE_COLS - 2);
  const y0 = Math.min(Math.max(Math.floor(fy), 0), FINE_ROWS - 2);
  const tx = Math.min(Math.max(fx - x0, 0), 1);
  const ty = Math.min(Math.max(fy - y0, 0), 1);
  const v00 = grid[y0 * FINE_COLS + x0];
  const v10 = grid[y0 * FINE_COLS + x0 + 1];
  const v01 = grid[(y0 + 1) * FINE_COLS + x0];
  const v11 = grid[(y0 + 1) * FINE_COLS + x0 + 1];
  return v00 * (1 - tx) * (1 - ty) + v10 * tx * (1 - ty) + v01 * (1 - tx) * ty + v11 * tx * ty;
}

const LEVELS = [
  { ft: 3000, hPa: 900 },
  { ft: 7000, hPa: 800 },
  { ft: 10000, hPa: 700 },
  { ft: 16000, hPa: 550 },
  { ft: 23000, hPa: 400 },
];

const PLACES = [
  { name: "Gorham · 2G8", lat: 44.393, lon: -71.196, primary: true },
  { name: "Mt Washington", lat: 44.2705, lon: -71.3032, primary: true },
  { name: "Pinkham Notch", lat: 44.257, lon: -71.253, primary: false },
  { name: "Crawford Notch", lat: 44.215, lon: -71.415, primary: false },
  { name: "Bartlett", lat: 44.078, lon: -71.283, primary: false },
];

type MapData = {
  times: string[];
  offsetSeconds: number;
  defaultIndex: number;
  elevationFt: number[];
  /** hPa → [location][hour] — every level in one fetch, so level switches are free. */
  w: Record<number, (number | null)[][]>;
  chips: { time: string; label: string }[];
};

async function fetchMap(): Promise<MapData> {
  const variables = LEVELS.map((entry) => `vertical_velocity_${entry.hPa}hPa`).join(",");
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${GRID.map((p) => p.lat.toFixed(4)).join(",")}` +
    `&longitude=${GRID.map((p) => p.lon.toFixed(4)).join(",")}` +
    `&hourly=${variables}&models=ncep_hrrr_conus` +
    `&timezone=America%2FNew_York&forecast_days=2`;
  const data = (await fetchJson(url)) as unknown;
  const locations = (Array.isArray(data) ? data : [data]) as {
    elevation?: number;
    utc_offset_seconds?: number;
    hourly?: Record<string, (number | null)[]>;
  }[];
  const first = locations[0];
  const times = (first?.hourly?.time ?? []) as unknown as string[];
  if (locations.length !== GRID.length || times.length === 0) throw new Error("missing wave map");
  const offsetSeconds = first?.utc_offset_seconds ?? 0;

  const now = Date.now();
  let defaultIndex = 0;
  for (let i = 0; i < times.length; i += 1) {
    if (Date.parse(`${times[i]}:00Z`) - offsetSeconds * 1000 <= now) defaultIndex = i;
    else break;
  }

  const w: Record<number, (number | null)[][]> = {};
  for (const entry of LEVELS) {
    w[entry.hPa] = locations.map((location) =>
      (location.hourly?.[`vertical_velocity_${entry.hPa}hPa`] ?? []).map((value) => wMs(value)),
    );
  }

  return {
    times,
    offsetSeconds,
    defaultIndex,
    elevationFt: locations.map((location) => (location.elevation ?? 0) * 3.28084),
    w,
    chips: flyingChips(times),
  };
}

function terrainFill(elevationFt: number): string {
  if (elevationFt >= 5000) return "fill-slate-600";
  if (elevationFt >= 4000) return "fill-slate-500";
  if (elevationFt >= 3000) return "fill-slate-400";
  if (elevationFt >= 2000) return "fill-slate-300";
  if (elevationFt >= 1200) return "fill-slate-200";
  return "fill-slate-100";
}

/** Where the lift bands sit on the ground — vertical velocity over the Gorham country. */
export function WaveMap({
  selectedTime,
  onSelectTime,
}: {
  selectedTime: string | null;
  onSelectTime: (time: string) => void;
}) {
  const [level, setLevel] = useState(700); // 10,000 ft — the wave-connection level
  const [mode, setMode] = useState<"linear" | "model">("linear");
  const [data, setData] = useState<MapData | null>(null);
  const [error, setError] = useState(false);
  const [terrainGrid, setTerrainGrid] = useState<number[] | null>(null);
  const [column, setColumn] = useState<WaveColumnRaw | null>(null);
  const [linearError, setLinearError] = useState(false);

  const definition = LEVELS.find((entry) => entry.hPa === level) ?? LEVELS[2];

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchMap()
        .then((next) => {
          if (!cancelled) {
            setData(next);
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

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      Promise.all([fetchTerrainGrid(), fetchWaveColumnRaw()])
        .then(([nextGrid, nextColumn]) => {
          if (!cancelled) {
            setTerrainGrid(nextGrid);
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

  // Solve every cell's flow-line transect once per hour (the level pick is free after
  // that). Pure math, so it rides a memo rather than an effect.
  const solvedField = useMemo(() => {
    if (!terrainGrid || !column) return null;
    const hour = waveColumnHour(column, selectedTime);
    const waveColumn = buildWaveColumn(columnLevelsAt(column.hourly, hour));
    if (!waveColumn) return null;
    const center: number[][] = [];
    let zM: number[] = [];
    for (const cell of GRID) {
      const terrain = PROFILE_DISTANCES.map((d) => {
        const point = alongTransect(cell, AZIMUTH, d);
        return sampleTerrain(terrainGrid, point.lat, point.lon);
      });
      const solve = solveLinearWave({ terrainM: terrain, dxM: SOLVE_DX_M, column: waveColumn });
      if (!solve) return null;
      zM = solve.zM;
      center.push(solve.w.map((line) => line[PROFILE_CENTER]));
    }
    return { zM, center };
  }, [terrainGrid, column, selectedTime]);

  // Inputs arrived but the solver came back empty — a data problem, not a pending one.
  const linearUnavailable = linearError || (!solvedField && Boolean(terrainGrid && column));

  let index = data?.defaultIndex ?? 0;
  if (data && selectedTime) {
    const found = data.times.indexOf(selectedTime);
    if (found >= 0) index = found;
  }

  // The level pick reads straight from the fetched field — no per-level refetch, so
  // there is no stale state to dim.

  // The linear view's per-cell values at the selected level — a free pick once the
  // hour's cells have been solved.
  let nodeValues: number[] | null = null;
  if (solvedField) {
    const targetM = definition.ft / 3.28084;
    let levelIndex = 0;
    for (let i = 1; i < solvedField.zM.length; i += 1) {
      if (Math.abs(solvedField.zM[i] - targetM) < Math.abs(solvedField.zM[levelIndex] - targetM)) {
        levelIndex = i;
      }
    }
    nodeValues = solvedField.center.map((levels) => levels[levelIndex]);
  }

  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5 sm:p-7">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-display text-xs font-semibold uppercase tracking-[0.28em] text-sky-700">
          Wave map · where the lift bands sit
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

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {LEVELS.map((entry) => {
          const active = entry.hPa === level;
          return (
            <button
              key={entry.hPa}
              type="button"
              aria-pressed={active}
              onClick={() => setLevel(entry.hPa)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? "bg-sky-100 text-sky-700 ring-1 ring-sky-200"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {entry.ft.toLocaleString("en-US")} ft
            </button>
          );
        })}
        <p className="text-[11px] text-slate-400">the level to scan for the wave</p>
      </div>

      {data && (mode === "model" || nodeValues) ? (
        <>
          <svg
            viewBox={`0 0 1000 ${(1000 * (LAT_STEP * (ROWS - 1))) / (LON_STEP * (COLS - 1) * Math.cos((44.25 * Math.PI) / 180))}`}
            className="mt-4 w-full rounded-2xl ring-1 ring-slate-900/10"
            role="img"
            aria-label={
              mode === "linear"
                ? `Linear-theory vertical velocity map at ${definition.ft.toLocaleString("en-US")} feet`
                : `Vertical velocity map at ${definition.ft.toLocaleString("en-US")} feet`
            }
          >
            {(() => {
              const W = 1000;
              const H = (W * (LAT_STEP * (ROWS - 1))) / (LON_STEP * (COLS - 1) * Math.cos((44.25 * Math.PI) / 180));
              const cellW = W / (COLS - 1);
              const cellH = H / (ROWS - 1);
              const x = (col: number) => col * cellW;
              const y = (row: number) => H - (row + 1) * cellH;

              const cells: React.ReactNode[] = [];
              for (let row = 0; row < ROWS - 1; row += 1) {
                for (let col = 0; col < COLS - 1; col += 1) {
                  const corners = [
                    row * COLS + col,
                    row * COLS + col + 1,
                    (row + 1) * COLS + col,
                    (row + 1) * COLS + col + 1,
                  ];
                  const elevation =
                    corners.reduce((sum, i) => sum + data.elevationFt[i], 0) / corners.length;
                  cells.push(
                    <rect
                      key={`t-${row}-${col}`}
                      x={x(col)}
                      y={y(row)}
                      width={cellW + 0.5}
                      height={cellH + 0.5}
                      className={terrainFill(elevation)}
                    />,
                  );
                }
              }
              const overlay: React.ReactNode[] = [];
              const linear = nodeValues;
              for (let row = 0; row < ROWS - 1; row += 1) {
                for (let col = 0; col < COLS - 1; col += 1) {
                  const corners = [
                    row * COLS + col,
                    row * COLS + col + 1,
                    (row + 1) * COLS + col,
                    (row + 1) * COLS + col + 1,
                  ];
                  const values = linear
                    ? corners.map((i) => linear[i])
                    : corners
                        .map((i) => data.w[level]?.[i]?.[index] ?? null)
                        .filter((value): value is number => value !== null);
                  if (values.length === 0) continue;
                  const w = values.reduce((sum, value) => sum + value, 0) / values.length;
                  overlay.push(
                    <rect
                      key={`w-${row}-${col}`}
                      x={x(col)}
                      y={y(row)}
                      width={cellW + 0.5}
                      height={cellH + 0.5}
                      className={cellFill(w)}
                    />,
                  );
                }
              }

              return (
                <>
                  {cells}
                  {overlay}
                  {PLACES.map((place) => {
                    const px = ((place.lon - LON_MIN) / (LON_STEP * (COLS - 1))) * W;
                    const py =
                      H - ((place.lat - LAT_MIN) / (LAT_STEP * (ROWS - 1))) * H;
                    return (
                      <g key={place.name}>
                        <circle
                          cx={px}
                          cy={py}
                          r={place.primary ? 4 : 3}
                          className={place.primary ? "fill-slate-900" : "fill-slate-600"}
                        />
                        <text
                          x={px + 8}
                          y={py + 3.5}
                          className={`text-[13px] ${place.primary ? "fill-slate-900 font-semibold" : "fill-slate-600"}`}
                          style={{ paintOrder: "stroke", stroke: "#ffffff", strokeWidth: 3 }}
                        >
                          {place.name}
                        </text>
                      </g>
                    );
                  })}
                </>
              );
            })()}
          </svg>
          <WaveLegend />
          <p className="mt-3 text-[11px] leading-5 text-slate-400">
            {mode === "linear"
              ? `Linear-theory estimate at ${definition.ft.toLocaleString("en-US")} ft — every cell's flow-line terrain profile solved with the HRRR column. The steady wave shows as crest-to-crest stripes just east of the ridge, the one to tow toward from 2G8.`
              : `Vertical velocity at ${definition.ft.toLocaleString("en-US")} ft over the Gorham country. The westerly flow makes the lift band just east of the ridge crest the one to tow toward from 2G8.`}{" "}
            Warm bands are lift, blue is sink. Pick any hour above; the wave panel shares the
            selection.
          </p>
        </>
      ) : error || linearUnavailable ? (
        <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600 ring-1 ring-slate-900/5">
          {mode === "linear" && linearUnavailable && !error
            ? "The linear wave solve is unavailable right now. "
            : "The wave map is unavailable right now. "}
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
        <div className="mt-4 h-[520px] animate-pulse rounded-2xl bg-slate-100" aria-hidden="true" />
      )}
    </div>
  );
}
