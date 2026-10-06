"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/fetch-json";
import { flyingChips, localStampFrom } from "@/lib/wx-window";
import { cellFill, wMs, WaveLegend } from "@/components/weather/wave-field";

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

type LevelData = {
  hPa: number;
  ft: number;
  times: string[];
  offsetSeconds: number;
  defaultIndex: number;
  elevationFt: number[];
  w: (number | null)[][];
  chips: { time: string; label: string }[];
};

async function fetchLevel(hPa: number, ft: number): Promise<LevelData> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${GRID.map((p) => p.lat.toFixed(4)).join(",")}` +
    `&longitude=${GRID.map((p) => p.lon.toFixed(4)).join(",")}` +
    `&hourly=vertical_velocity_${hPa}hPa&models=ncep_hrrr_conus` +
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

  return {
    hPa,
    ft,
    times,
    offsetSeconds,
    defaultIndex,
    elevationFt: locations.map((location) => (location.elevation ?? 0) * 3.28084),
    w: locations.map((location) =>
      (location.hourly?.[`vertical_velocity_${hPa}hPa`] ?? []).map((omega) =>
        wMs(omega),
      ),
    ),
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
  const [data, setData] = useState<LevelData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const definition = LEVELS.find((entry) => entry.hPa === level) ?? LEVELS[2];
    const load = () => {
      fetchLevel(definition.hPa, definition.ft)
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
  }, [level]);

  let index = data?.defaultIndex ?? 0;
  if (data && selectedTime) {
    const found = data.times.indexOf(selectedTime);
    if (found >= 0) index = found;
  }

  const stale = data !== null && data.hPa !== level;

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

      {data ? (
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
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

      {data ? (
        <>
          <svg
            viewBox={`0 0 1000 ${(1000 * (LAT_STEP * (ROWS - 1))) / (LON_STEP * (COLS - 1) * Math.cos((44.25 * Math.PI) / 180))}`}
            className={`mt-4 w-full rounded-2xl ring-1 ring-slate-900/10 transition-opacity ${
              stale ? "opacity-50" : ""
            }`}
            role="img"
            aria-label={`Vertical velocity map at ${data.ft.toLocaleString("en-US")} feet`}
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
              for (let row = 0; row < ROWS - 1; row += 1) {
                for (let col = 0; col < COLS - 1; col += 1) {
                  const corners = [
                    row * COLS + col,
                    row * COLS + col + 1,
                    (row + 1) * COLS + col,
                    (row + 1) * COLS + col + 1,
                  ];
                  const values = corners
                    .map((i) => data.w[i]?.[index] ?? null)
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
            Vertical velocity at {data.ft.toLocaleString("en-US")} ft over the Gorham country —
            warm bands are lift, blue is sink. Pick any hour above; the wave panel shares the
            selection. The westerly flow makes the lift band just east of the ridge crest the one
            to tow toward from 2G8.
          </p>
        </>
      ) : error ? (
        <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600 ring-1 ring-slate-900/5">
          The wave map is unavailable right now.{" "}
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
