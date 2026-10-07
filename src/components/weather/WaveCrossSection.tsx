"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchJson } from "@/lib/fetch-json";
import { compassName, flyingChips, localStampFrom } from "@/lib/wx-window";
import { cellFill, wMs, WaveLegend } from "@/components/weather/wave-field";
import { parseWrfRun, wrfRunFresh, type WrfRun } from "@/lib/wrf-run";
import { parseWrfWind, wrfWindFrom, type WrfWind } from "@/lib/wrf-wind";
import { fetchTerrainMosaic, type TerrainMosaic } from "@/lib/terrain-tiles";
import {
  SOLVE_BOUNDS,
  SOLVE_ZOOM,
  sliceWaveField,
  solveWaveFieldCached,
  waveSolveKey,
} from "@/lib/wave-solve";
import {
  columnLevelsAt,
  fetchUpwindColumnRaw,
  fetchWaveColumnRaw,
  waveAzimuth,
  waveColumnHour,
  type WaveColumnRaw,
} from "@/lib/wave-column";
import {
  AREA_RADIUS_NM,
  GLIDER_AREA,
  KM_PER_NM,
  MODEL_DISTANCES,
  CROSS_LEVELS as MODEL_LEVELS,
  WINDOW_KM,
  azimuthBucket,
  wxApiPath,
} from "@/lib/wx-datasets";

/**
 * The cross-section is the vertical cut of the wave map's 3-D solve along the LOA.
 * The Mount Washington Glider Area is a circle of radius 10 NM centred at
 * 44°17′26″N 071°13′40″W (the Boston ARTCC letter of agreement); the cut runs along
 * this hour's 800 hPa wind through that centre — the chart is the slice inside the
 * circle — and both views read the same shared field (@/lib/wave-solve), so they can
 * never tell different stories about the day.
 */

const REFRESH_MS = 45 * 60 * 1000;
const FT_PER_M = 3.28084;

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

async function fetchModelField(
  dataset: "cross-section" | "wrf-cross-section",
  azimuth: number,
): Promise<CrossData> {
  const data = (await fetchJson(wxApiPath(dataset, { azimuth }))) as unknown;
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
  const [mode, setMode] = useState<"linear" | "model" | "wrf">("linear");
  const [column, setColumn] = useState<WaveColumnRaw | null>(null);
  const [mosaic, setMosaic] = useState<TerrainMosaic | null>(null);
  const [upwind, setUpwind] = useState<{ bucket: number; column: WaveColumnRaw } | null>(null);
  const [field, setField] = useState<{ bucket: number; data: CrossData } | null>(null);
  const [wrfRun, setWrfRun] = useState<WrfRun | null>(null);
  const [wrfAvailable, setWrfAvailable] = useState(false);
  const [wrfWind, setWrfWind] = useState<WrfWind | null>(null);
  const [wrfField, setWrfField] = useState<{ bucket: number; data: CrossData } | null>(null);
  const [wrfError, setWrfError] = useState(false);
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
  const bucket = column && levels.length > 0 ? azimuthBucket(windFrom) : null;

  // The solve runs on the undisturbed inflow sounding — the local Gorham column is
  // inside the wave on a NW day, and the amplitude scales with the base-plane wind.
  // Falls back to the local column when the upwind fetch cannot be had.
  useEffect(() => {
    if (bucket === null) return;
    let cancelled = false;
    fetchUpwindColumnRaw(bucket)
      .then((next) => {
        if (!cancelled) setUpwind({ bucket, column: next });
      })
      .catch(() => {
        if (!cancelled) setUpwind(null);
      });
    return () => {
      cancelled = true;
    };
  }, [bucket]);

  // The solve terrain — the same z10 mosaic (and the same shared fetch promise) the
  // map uses, so this view adds no network and both solve on one terrain.
  useEffect(() => {
    let cancelled = false;
    fetchTerrainMosaic(SOLVE_BOUNDS, SOLVE_ZOOM)
      .then((next) => {
        if (!cancelled) {
          setMosaic(next);
          setLinearError(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLinearError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // The model field follows the chosen hour's direction.
  useEffect(() => {
    if (bucket === null) return;
    let cancelled = false;
    const load = () => {
      fetchModelField("cross-section", bucket)
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

  // The WRF run stamp decides whether the "WRF 1 km" option exists at all.
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchJson(wxApiPath("wrf-run"))
        .then((payload) => {
          if (!cancelled) {
            const run = parseWrfRun(payload);
            setWrfRun(run);
            setWrfAvailable(wrfRunFresh(run, Date.now()));
          }
        })
        .catch(() => {
          if (!cancelled) {
            setWrfRun(null);
            setWrfAvailable(false);
          }
        });
    };
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  // The WRF's own wind at the Glider Area — the axis the cross-section uses in
  // WRF mode (the live sounding cannot speak for an archive hour).
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchJson(wxApiPath("wrf-wind"))
        .then((payload) => {
          if (!cancelled) setWrfWind(parseWrfWind(payload));
        })
        .catch(() => {
          if (!cancelled) setWrfWind(null);
        });
    };
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  // The transect axis is the WRF's OWN wind at the displayed frame — the wind
  // that modelled the wave. (Today's sounding cannot speak for an archive, and
  // clamping it to "nearest available hour" drew the line across the wrong day.)
  const wrfFrameTime = (() => {
    const frame = wrfField?.data;
    if (!frame) return selectedTime ?? null;
    let at = frame.defaultIndex ?? 0;
    if (selectedTime) {
      const found = frame.times.indexOf(selectedTime);
      if (found >= 0) at = found;
    }
    return frame.times[at] ?? null;
  })();
  const modelWindFrom = wrfWindFrom(wrfWind, wrfFrameTime);
  const wrfBucket = modelWindFrom !== null ? azimuthBucket(modelWindFrom) : bucket;

  // The WRF cross-section for the hour's bucket loads eagerly; a failed or
  // non-fresh run simply leaves the option on HRRR.
  useEffect(() => {
    if (wrfBucket === null) return;
    let cancelled = false;
    fetchModelField("wrf-cross-section", wrfBucket)
      .then((next) => {
        if (!cancelled) {
          setWrfField({ bucket: wrfBucket, data: next });
          setWrfError(false);
        }
      })
      .catch(() => {
        if (!cancelled) setWrfError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [wrfBucket]);

  // A run that is missing, stale, not "ok" or whose field failed to load falls
  // back to HRRR — the WRF option is simply not offered.
  const effectiveMode = mode === "wrf" && (!wrfAvailable || wrfError) ? "model" : mode;

  // The vertical cut of the shared 3-D solve along this hour's wind line. The map
  // above reads the same solve (it is cached by key), so a glancing day reads weak in
  // both views — no separate 2-D reduction that disagrees with the map.
  const slice = useMemo(() => {
    if (!mosaic || !column) return null;
    const hour = waveColumnHour(column, selectedTime);
    const localLevels = columnLevelsAt(column.hourly, hour);
    const azimuth = waveAzimuth(localLevels);
    const upwindColumn =
      upwind !== null && upwind.bucket === azimuthBucket(azimuth) ? upwind.column : null;
    const solveLevels = upwindColumn
      ? columnLevelsAt(upwindColumn.hourly, waveColumnHour(upwindColumn, selectedTime))
      : localLevels;
    const field = solveWaveFieldCached(
      waveSolveKey(azimuthBucket(azimuth), selectedTime ?? "default", solveLevels),
      mosaic,
      solveLevels,
      (azimuth + 180) % 360,
    );
    return field ? sliceWaveField(field, GLIDER_AREA.lat, GLIDER_AREA.lon) : null;
  }, [mosaic, column, selectedTime, upwind]);
  const linearUnavailable = linearError || (!slice && Boolean(mosaic && column));

  // The caption carries the launch plane the shared solve actually used.
  const launchNote =
    slice && slice.launchM > 0
      ? `, launched from the dividing streamline at ${(
          Math.round((slice.launchM * FT_PER_M) / 100) * 100
        ).toLocaleString("en-US")} ft (Fr ${slice.froude.toFixed(2)})`
      : "";

  const activeField = effectiveMode === "wrf" ? wrfField : field;
  const activeBucket = effectiveMode === "wrf" ? wrfBucket : bucket;
  const data = activeField?.data ?? null;
  const staleField = activeField !== null && activeBucket !== null && activeField.bucket !== activeBucket;

  let index = data?.defaultIndex ?? 0;
  if (data && selectedTime) {
    const found = data.times.indexOf(selectedTime);
    if (found >= 0) index = found;
  }

  const shownWindFrom = effectiveMode === "wrf" && modelWindFrom !== null ? modelWindFrom : windFrom;
  const windLabel = `${compassName(shownWindFrom)} ${Math.round(shownWindFrom)}°`;

  const fieldOptions: { value: "linear" | "model" | "wrf"; label: string }[] = [
    { value: "linear", label: "Linear estimate" },
    { value: "model", label: "HRRR field" },
  ];
  if (wrfAvailable) fieldOptions.push({ value: "wrf", label: "WRF 1 km" });
  const fieldStamp = effectiveMode === "wrf" ? `WRF 1 km${wrfRun ? ` · ${wrfRun.label}` : ""}` : "HRRR";

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
  if (effectiveMode === "linear") {
    if (slice) {
      const lastLevel = slice.zM.length - 1;
      const topFt = slice.zM[lastLevel] * FT_PER_M;
      const yMax = Math.ceil(Math.min(topFt + 1500, 55000) / 5000) * 5000;
      const y = (altFt: number) =>
        padT + (1 - Math.min(Math.max(altFt, 0), yMax) / yMax) * plotH;
      const altTicks: number[] = [];
      for (let alt = 10000; alt <= yMax; alt += 10000) altTicks.push(alt);

      // Every second 500 m sample: the chart keeps 1 km columns while the solve —
      // and the map above — stay at 500 m.
      const shown: { d: number; i: number }[] = [];
      for (let i = 0; i < slice.offsetsM.length; i += 2) {
        const d = slice.offsetsM[i] / 1000;
        if (d >= xMin && d <= xMax) shown.push({ d, i });
      }

      const cells: React.ReactNode[] = [];
      for (let s = 0; s < shown.length - 1; s += 1) {
        const a = shown[s];
        const b = shown[s + 1];
        for (let j = 0; j < lastLevel; j += 1) {
          const zBot = slice.zM[j] * FT_PER_M;
          const zTop = slice.zM[j + 1] * FT_PER_M;
          const corners = [
            slice.w[j][a.i],
            slice.w[j][b.i],
            slice.w[j + 1][a.i],
            slice.w[j + 1][b.i],
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

      const profile = shown.map(({ d, i }) => ({ d, ft: slice.terrainM[i] * FT_PER_M }));
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
            aria-label="3-D linear-theory vertical velocity cross-section along the wind through the Mount Washington Glider Area"
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
            className={cellFill(w, effectiveMode === "wrf" ? "wrf" : "hrrr")}
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
        <WaveLegend scale={effectiveMode === "wrf" ? "wrf" : "hrrr"} />
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
          {data ? `${localStampFrom(data.times[index], data.offsetSeconds)} · ${fieldStamp}` : fieldStamp}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          Field
        </span>
        {fieldOptions.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            aria-pressed={effectiveMode === value}
            onClick={() => setMode(value)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
              effectiveMode === value
                ? "bg-sky-100 text-sky-700 ring-1 ring-sky-200"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {label}
          </button>
        ))}
        <p className="text-[11px] text-slate-400">
          the line runs along {effectiveMode === "wrf" ? "the WRF's" : "the"} 800 hPa wind, {windLabel},
          through the Glider Area centre
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
            {effectiveMode === "linear"
              ? `Linear-theory estimate: the 3-D steady wave equation on the real terrain${launchNote}, sliced along this hour's wind line (${windLabel}) through the LOA's Glider Area centre — the chart is the slice inside the 10 NM circle, the vertical cut of the same solve the wave map above shows. The amplitude is Fr-scaled below 1 and capped at half the carrying flow. The model's own pressure-level vertical velocity is much smoother; switch the field to HRRR for comparison.`
              : effectiveMode === "wrf"
                ? `The WRF 1 km field${wrfRun ? ` (${wrfRun.label} cycle)` : ""}: the model's own vertical velocity along this hour's wind line (${windLabel}) through the LOA's Glider Area centre, grey being the terrain.`
                : `The model's own vertical velocity along this hour's wind line (${windLabel}) through the LOA's Glider Area centre, grey being the terrain.`}{" "}
            Warm colours are lift, blue is sink — pick any hour above; the wave panel shares the
            selection.
          </p>
        </>
      ) : error || linearUnavailable ? (
        <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600 ring-1 ring-slate-900/5">
          {effectiveMode === "linear" && linearUnavailable && !error
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
