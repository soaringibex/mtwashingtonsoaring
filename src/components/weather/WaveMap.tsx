"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fetchJson } from "@/lib/fetch-json";
import { flyingChips, localStampFrom } from "@/lib/wx-window";
import { cellRgb, wMs, WaveLegend } from "@/components/weather/wave-field";
import { buildWaveColumn, solveLinearWave } from "@/lib/linear-wave";
import { fetchRoadLines, type RoadLine } from "@/lib/roads";
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
  azimuthBucket,
  KM_PER_NM,
  MAP_COLS,
  MAP_GRID,
  MAP_LAT_MIN,
  MAP_LAT_SPAN,
  MAP_LEVELS as LEVELS,
  MAP_LON_MIN,
  MAP_LON_SPAN,
  MAP_ROWS,
  alongTransect,
  wxApiPath,
} from "@/lib/wx-datasets";
import {
  contourSegments,
  fetchTerrainMosaic,
  mosaicElevation,
  sampleMosaic,
  type TerrainMosaic,
} from "@/lib/terrain-tiles";

const REFRESH_MS = 45 * 60 * 1000;

/** The world (canvas) size — the map's true projected aspect, ~32 m per pixel. */
const W = 1500;
const METRES_PER_DEG_LAT = 110900;
const METRES_PER_DEG_LON = 111320 * Math.cos((44.26 * Math.PI) / 180);
const H = Math.round((W * MAP_LAT_SPAN * METRES_PER_DEG_LAT) / (MAP_LON_SPAN * METRES_PER_DEG_LON));

/** The tiles cover a touch beyond the map so the relief runs to every edge. */
const TERRAIN_BOUNDS = {
  west: MAP_LON_MIN - 0.02,
  south: MAP_LAT_MIN - 0.02,
  east: MAP_LON_MIN + MAP_LON_SPAN + 0.02,
  north: MAP_LAT_MIN + MAP_LAT_SPAN + 0.02,
};

/**
 * The solves run as long parallel transects across the map, then the nodes sample them.
 * A per-node 48-km profile tapered the range away for the lee rows — a crest 16 km
 * upwind was scaled to 81% and 24 km to zero, suppressing the wave train exactly where
 * it matters — so each transect now spans 120 km of terrain along the flow, at z10's
 * ~110 m resolution, sampled at 1.2 km.
 */
const SOLVE_BOUNDS = {
  west: MAP_LON_MIN - 1.0,
  south: MAP_LAT_MIN - 0.72,
  east: MAP_LON_MIN + MAP_LON_SPAN + 1.0,
  north: MAP_LAT_MIN + MAP_LAT_SPAN + 0.72,
};
const SOLVE_ZOOM = 10;

// The band must cover the map's corners — 33.5 km cross-flow on the 135° diagonal — and
// the transects must reach past the corner nodes' 33.5 km along-flow in the untapered
// span (the taper eats the outer quarter: 111 samples place it beyond 33.6 km).
const TRANSECT_COUNT = 29;
const TRANSECT_SPACING_KM = 2.4;
const TRANSECT_DX_M = 1200;
const TRANSECT_SAMPLES = 111;
const MAP_CENTER = { lat: MAP_LAT_MIN + MAP_LAT_SPAN / 2, lon: MAP_LON_MIN + MAP_LON_SPAN / 2 };

const PLACES = [
  { name: "Gorham · 2G8", lat: 44.393, lon: -71.196, primary: true },
  { name: "Mt Washington", lat: 44.2705, lon: -71.3032, primary: true },
  { name: "Pinkham Notch", lat: 44.257, lon: -71.253, primary: false },
  { name: "Bretton Woods", lat: 44.258, lon: -71.441, primary: false },
  { name: "Crawford Notch", lat: 44.215, lon: -71.415, primary: false },
  { name: "Bartlett", lat: 44.078, lon: -71.283, primary: false },
];

/** Contours every 1,000 ft from 1,000 to 6,000 ft. */
const CONTOURS = [305, 610, 914, 1219, 1524, 1829].map((levelM) => ({ levelM }));

const WAVE_ALPHA = 0.36;

/** Light from the northwest (map convention), 45° altitude. */
const LIGHT = { east: -0.5, north: 0.5, up: Math.SQRT1_2 };

const RELIEF_RAMP: [number, [number, number, number]][] = [
  [150, [52, 76, 60]],
  [400, [84, 108, 74]],
  [650, [122, 132, 88]],
  [900, [160, 148, 108]],
  [1150, [172, 146, 116]],
  [1400, [166, 162, 164]],
  [1650, [210, 210, 212]],
  [1950, [238, 239, 242]],
];

function reliefColour(elevationM: number, shade: number): [number, number, number] {
  const low = RELIEF_RAMP[0];
  const high = RELIEF_RAMP[RELIEF_RAMP.length - 1];
  const e = Math.min(Math.max(elevationM, low[0]), high[0]);
  let lower = low;
  let upper = high;
  for (let i = 0; i < RELIEF_RAMP.length - 1; i += 1) {
    if (e >= RELIEF_RAMP[i][0] && e <= RELIEF_RAMP[i + 1][0]) {
      lower = RELIEF_RAMP[i];
      upper = RELIEF_RAMP[i + 1];
      break;
    }
  }
  const t = (e - lower[0]) / (upper[0] - lower[0] || 1);
  const factor = Math.min(Math.max(0.42 + 1.15 * shade, 0.3), 1.45);
  return [
    Math.round((lower[1][0] + (upper[1][0] - lower[1][0]) * t) * factor),
    Math.round((lower[1][1] + (upper[1][1] - lower[1][1]) * t) * factor),
    Math.round((lower[1][2] + (upper[1][2] - lower[1][2]) * t) * factor),
  ];
}

const x = (lon: number) => ((lon - MAP_LON_MIN) / MAP_LON_SPAN) * W;
const y = (lat: number) => H - ((lat - MAP_LAT_MIN) / MAP_LAT_SPAN) * H;

/** A road polyline in the map's own coordinates. */
const roadPoints = (line: RoadLine) =>
  line.p.map(([lon, lat]) => `${x(lon).toFixed(1)},${y(lat).toFixed(1)}`).join(" ");

type MapData = {
  times: string[];
  offsetSeconds: number;
  defaultIndex: number;
  /** hPa → [location][hour] — every level in one fetch, so level switches are free. */
  w: Record<number, (number | null)[][]>;
  chips: { time: string; label: string }[];
};

const GRID_LENGTH = MAP_ROWS * MAP_COLS;

async function fetchMap(): Promise<MapData> {
  const data = (await fetchJson(wxApiPath("map-field"))) as unknown;
  const locations = (Array.isArray(data) ? data : [data]) as {
    utc_offset_seconds?: number;
    hourly?: Record<string, (number | null)[]>;
  }[];
  const first = locations[0];
  const times = (first?.hourly?.time ?? []) as unknown as string[];
  if (locations.length !== GRID_LENGTH || times.length === 0) throw new Error("missing wave map");
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

  return { times, offsetSeconds, defaultIndex, w, chips: flyingChips(times) };
}

/** Where the lift bands sit on the ground — the wave field over shaded relief. */
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
  const [solveMosaic, setSolveMosaic] = useState<TerrainMosaic | null>(null);
  const [column, setColumn] = useState<WaveColumnRaw | null>(null);
  const [linearError, setLinearError] = useState(false);
  const [upwind, setUpwind] = useState<{ bucket: number; column: WaveColumnRaw } | null>(null);
  const [mosaic, setMosaic] = useState<TerrainMosaic | null>(null);
  const [mosaicError, setMosaicError] = useState(false);
  const [roads, setRoads] = useState<RoadLine[] | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

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
      Promise.all([fetchTerrainMosaic(SOLVE_BOUNDS, SOLVE_ZOOM), fetchWaveColumnRaw()])
        .then(([nextMosaic, nextColumn]) => {
          if (!cancelled) {
            setSolveMosaic(nextMosaic);
            setColumn(nextColumn);
            setLinearError(false);
          }
        })
        .catch(() => {
          if (!cancelled) setLinearError(true);
        });
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchTerrainMosaic(TERRAIN_BOUNDS, 12)
      .then((next) => {
        if (!cancelled) {
          setMosaic(next);
          setMosaicError(false);
        }
      })
      .catch(() => {
        if (!cancelled) setMosaicError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchRoadLines()
      .then((next) => {
        if (!cancelled) setRoads(next);
      })
      .catch(() => {
        // Roads are orientation, not data — the map stands without them.
        if (!cancelled) setRoads([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Solve the transects once per hour (the level pick is free after that). Pure math,
  // so it rides a memo rather than an effect.
  const solvedField = useMemo(() => {
    if (!solveMosaic || !column) return null;
    const hour = waveColumnHour(column, selectedTime);
    const localLevels = columnLevelsAt(column.hourly, hour);
    // The solves run on the undisturbed inflow sounding; the local column orients them.
    // Only a sounding for THIS wind bucket is usable — a stale one would solve on the
    // previous direction until the new fetch resolves.
    const activeUpwind = upwind !== null && upwind.bucket === azimuthBucket(waveAzimuth(localLevels)) ? upwind.column : null;
    const levels = activeUpwind
      ? columnLevelsAt(activeUpwind.hourly, waveColumnHour(activeUpwind, selectedTime))
      : localLevels;
    const radians = (((waveAzimuth(localLevels) + 180) % 360) * Math.PI) / 180;
    const alongE = Math.sin(radians);
    const alongN = Math.cos(radians);
    const crossE = Math.sin(radians + Math.PI / 2);
    const crossN = Math.cos(radians + Math.PI / 2);
    const centreKmPerDegLon = 111 * Math.cos((MAP_CENTER.lat * Math.PI) / 180);

    const transects: number[][][] = [];
    let zM: number[] = [];
    for (let i = 0; i < TRANSECT_COUNT; i += 1) {
      const offsetKm = (i - (TRANSECT_COUNT - 1) / 2) * TRANSECT_SPACING_KM;
      const anchorLat = MAP_CENTER.lat + (crossN * offsetKm) / 111;
      const anchorLon = MAP_CENTER.lon + (crossE * offsetKm) / centreKmPerDegLon;
      const terrain: number[] = [];
      for (let j = 0; j < TRANSECT_SAMPLES; j += 1) {
        const dKm = (j - (TRANSECT_SAMPLES - 1) / 2) * (TRANSECT_DX_M / 1000);
        const lat = anchorLat + (alongN * dKm) / 111;
        const lon = anchorLon + (alongE * dKm) / centreKmPerDegLon;
        terrain.push(sampleMosaic(solveMosaic, lat, lon));
      }
      const baseM = terrain.reduce((sum, h) => sum + h, 0) / terrain.length;
      const waveColumn = buildWaveColumn(levels, (radians * 180) / Math.PI, baseM);
      if (!waveColumn) return null;
      const solve = solveLinearWave({ terrainM: terrain, dxM: TRANSECT_DX_M, column: waveColumn });
      if (!solve) return null;
      zM = solve.zM;
      transects.push(solve.w);
    }
    return { zM, transects, alongE, alongN, crossE, crossN, centreKmPerDegLon };
  }, [solveMosaic, column, selectedTime, upwind]);

  // Inputs arrived but the solver came back empty — a data problem, not a pending one.
  const linearUnavailable = linearError || (!solvedField && Boolean(solveMosaic && column));

  let index = data?.defaultIndex ?? 0;
  if (data && selectedTime) {
    const found = data.times.indexOf(selectedTime);
    if (found >= 0) index = found;
  }

  const hourIndex = column ? waveColumnHour(column, selectedTime) : 0;
  const levels = column ? columnLevelsAt(column.hourly, hourIndex) : [];
  const windFrom = waveAzimuth(levels);
  const windBucket = column && levels.length > 0 ? azimuthBucket(windFrom) : null;

  // The transect solves run on the undisturbed inflow sounding — the local Gorham
  // column is inside the wave on a NW day, and the amplitude scales with the base-plane
  // wind. Falls back to the local column when the upwind fetch cannot be had.
  useEffect(() => {
    if (windBucket === null) return;
    let cancelled = false;
    fetchUpwindColumnRaw(windBucket)
      .then((next) => {
        if (!cancelled) setUpwind({ bucket: windBucket, column: next });
      })
      .catch(() => {
        if (!cancelled) setUpwind(null);
      });
    return () => {
      cancelled = true;
    };
  }, [windBucket]);

  // The overlay values on the full model grid, whatever the mode.
  const nodeValues = useMemo<(number | null)[] | null>(() => {
    if (mode === "linear") {
      if (!solvedField) return null;
      const targetM = definition.ft / 3.28084;
      let levelIndex = 0;
      for (let i = 1; i < solvedField.zM.length; i += 1) {
        if (Math.abs(solvedField.zM[i] - targetM) < Math.abs(solvedField.zM[levelIndex] - targetM)) {
          levelIndex = i;
        }
      }
      // Each node samples the transect pair nearest its cross-flow position, at its own
      // along-flow distance.
      const { alongE, alongN, crossE, crossN, centreKmPerDegLon } = solvedField;
      return MAP_GRID.map((node) => {
        const dE = (node.lon - MAP_CENTER.lon) * centreKmPerDegLon;
        const dN = (node.lat - MAP_CENTER.lat) * 111;
        const alongKm = dE * alongE + dN * alongN;
        const crossKm = dE * crossE + dN * crossN;
        const tPos = crossKm / TRANSECT_SPACING_KM + (TRANSECT_COUNT - 1) / 2;
        const t0 = Math.min(Math.max(Math.floor(tPos), 0), TRANSECT_COUNT - 2);
        const tFrac = Math.min(Math.max(tPos - t0, 0), 1);
        const sPos = alongKm / (TRANSECT_DX_M / 1000) + (TRANSECT_SAMPLES - 1) / 2;
        const s0 = Math.min(Math.max(Math.floor(sPos), 0), TRANSECT_SAMPLES - 2);
        const sFrac = Math.min(Math.max(sPos - s0, 0), 1);
        const at = (t: number) => {
          const line = solvedField.transects[t][levelIndex];
          return line[s0] * (1 - sFrac) + line[s0 + 1] * sFrac;
        };
        return at(t0) * (1 - tFrac) + at(t0 + 1) * tFrac;
      });
    }
    const series = data?.w[level];
    if (!series) return null;
    return series.map((values) => wMs(values[index]));
  }, [mode, solvedField, definition.ft, data, level, index]);

  // Contour lines never move — derive them once per mosaic.
  const contours = useMemo(
    () =>
      mosaic
        ? CONTOURS.map(({ levelM }) => ({ levelM, segments: contourSegments(mosaic, levelM, 5) }))
        : [],
    [mosaic],
  );

  // The elevation at every canvas pixel — it depends only on the mosaic, so hour and
  // level redraws reuse it.
  const terrainGrid = useMemo(() => {
    if (!mosaic) return null;
    const { lonStep, latStep, west, north } = mosaic;
    const mx0 = (MAP_LON_MIN - west) / lonStep;
    const mxStep = MAP_LON_SPAN / (W - 1) / lonStep;
    const my0 = (north - (MAP_LAT_MIN + MAP_LAT_SPAN)) / latStep;
    const myStep = MAP_LAT_SPAN / (H - 1) / latStep;
    const grid = new Float32Array(W * H);
    for (let py = 0; py < H; py += 1) {
      const my = my0 + py * myStep;
      const row = py * W;
      for (let px = 0; px < W; px += 1) {
        grid[row + px] = mosaicElevation(mosaic, mx0 + px * mxStep, my);
      }
    }
    return grid;
  }, [mosaic]);

  // Paint the relief (with the wave field blended in) and the contours.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mosaic || !terrainGrid) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const { lonStep, latStep, west, north } = mosaic;
    const mx0 = (MAP_LON_MIN - west) / lonStep;
    const mxStep = MAP_LON_SPAN / (W - 1) / lonStep;
    const my0 = (north - (MAP_LAT_MIN + MAP_LAT_SPAN)) / latStep;
    const myStep = MAP_LAT_SPAN / (H - 1) / latStep;
    // Gradients are between adjacent canvas pixels, so scale by the canvas pixel size.
    const dxM = (MAP_LON_SPAN / (W - 1)) * METRES_PER_DEG_LON;
    const dyM = (MAP_LAT_SPAN / (H - 1)) * METRES_PER_DEG_LAT;
    const terrain = terrainGrid;

    // Relief colour + hillshade + the wave field.
    const image = context.createImageData(W, H);
    const pixels = image.data;
    for (let py = 0; py < H; py += 1) {
      const row = py * W;
      const fy = Math.min(Math.max((py / (H - 1)) * (MAP_ROWS - 1), 0), MAP_ROWS - 1.001);
      const ny = Math.floor(fy);
      const ty = fy - ny;
      for (let px = 0; px < W; px += 1) {
        const i = row + px;
        const e = terrain[i];
        const left = terrain[i - (px > 0 ? 1 : 0)];
        const right = terrain[i + (px < W - 1 ? 1 : 0)];
        const up = terrain[i - (py > 0 ? W : 0)];
        const down = terrain[i + (py < H - 1 ? W : 0)];
        const dzdx = (right - left) / (2 * dxM);
        const dzdy = (down - up) / (2 * dyM);
        const norm = Math.sqrt(dzdx * dzdx + dzdy * dzdy + 1);
        const shade = (-dzdx * LIGHT.east - dzdy * LIGHT.north + LIGHT.up) / norm;
        let [r, g, b] = reliefColour(e, shade);

        if (nodeValues) {
          const fx = Math.min(Math.max((px / (W - 1)) * (MAP_COLS - 1), 0), MAP_COLS - 1.001);
          const nx = Math.floor(fx);
          const tx = fx - nx;
          const v00 = nodeValues[ny * MAP_COLS + nx];
          const v10 = nodeValues[ny * MAP_COLS + nx + 1];
          const v01 = nodeValues[(ny + 1) * MAP_COLS + nx];
          const v11 = nodeValues[(ny + 1) * MAP_COLS + nx + 1];
          if (v00 !== null && v10 !== null && v01 !== null && v11 !== null) {
            const w = v00 * (1 - tx) * (1 - ty) + v10 * tx * (1 - ty) + v01 * (1 - tx) * ty + v11 * tx * ty;
            const [wr, wg, wb] = cellRgb(w, mode === "linear" ? "linear" : "hrrr");
            r = Math.round(r * (1 - WAVE_ALPHA) + wr * WAVE_ALPHA);
            g = Math.round(g * (1 - WAVE_ALPHA) + wg * WAVE_ALPHA);
            b = Math.round(b * (1 - WAVE_ALPHA) + wb * WAVE_ALPHA);
          }
        }

        const o = i * 4;
        pixels[o] = r;
        pixels[o + 1] = g;
        pixels[o + 2] = b;
        pixels[o + 3] = 255;
      }
    }
    context.putImageData(image, 0, 0);

    // Contours over the relief.
    context.strokeStyle = "rgba(30, 41, 59, 0.42)";
    context.lineWidth = 1;
    for (const { segments } of contours) {
      context.beginPath();
      for (const segment of segments) {
        context.moveTo((segment.x1 - mx0) / mxStep, (segment.y1 - my0) / myStep);
        context.lineTo((segment.x2 - mx0) / mxStep, (segment.y2 - my0) / myStep);
      }
      context.stroke();
    }
  }, [mosaic, terrainGrid, nodeValues, contours, mode]);

  // The LOA circle and this hour's cross-section line.
  const centre = { x: x(GLIDER_AREA.lon), y: y(GLIDER_AREA.lat) };
  const radiusMap = ((AREA_RADIUS_NM * KM_PER_NM * 1000) / METRES_PER_DEG_LON / MAP_LON_SPAN) * W;
  const windward = alongTransect(GLIDER_AREA, windFrom, AREA_RADIUS_NM * KM_PER_NM);
  const leeward = alongTransect(GLIDER_AREA, windFrom + 180, AREA_RADIUS_NM * KM_PER_NM);
  const windwardPoint = { x: x(windward.lon), y: y(windward.lat) };
  const leewardPoint = { x: x(leeward.lon), y: y(leeward.lat) };
  const span = Math.hypot(leewardPoint.x - windwardPoint.x, leewardPoint.y - windwardPoint.y) || 1;
  const direction = {
    x: (leewardPoint.x - windwardPoint.x) / span,
    y: (leewardPoint.y - windwardPoint.y) / span,
  };

  const ready = mosaic !== null && (mode === "linear" ? nodeValues !== null : data !== null);

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

      {ready ? (
        <>
          <div
            className="relative mt-4 overflow-hidden rounded-2xl ring-1 ring-slate-900/10"
            role="img"
            aria-label={`Wave field over shaded relief at ${definition.ft.toLocaleString("en-US")} feet, with the LOA's 10 NM Glider Area circle and the cross-section line`}
          >
            <canvas ref={canvasRef} width={W} height={H} className="block h-auto w-full" />
            <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" aria-hidden="true">
              {roads?.map((line, index) => (
                <g key={index}>
                  <polyline
                    points={roadPoints(line)}
                    className={line.k === 2 ? "fill-none stroke-white/50" : "fill-none stroke-white/35"}
                    strokeWidth={line.k === 2 ? 2.2 : line.k === 1 ? 1.8 : 1.4}
                    vectorEffect="non-scaling-stroke"
                  />
                  <polyline
                    points={roadPoints(line)}
                    className={
                      line.k === 2
                        ? "fill-none stroke-slate-600/60"
                        : line.k === 1
                          ? "fill-none stroke-slate-500/45"
                          : "fill-none stroke-slate-500/30"
                    }
                    strokeWidth={line.k === 2 ? 0.9 : 0.7}
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              ))}
              <circle
                cx={centre.x}
                cy={centre.y}
                r={radiusMap}
                className="fill-sky-500/5 stroke-slate-900/50"
                strokeDasharray="9 7"
                strokeWidth={1.4}
                vectorEffect="non-scaling-stroke"
              />
              <line
                x1={windwardPoint.x}
                y1={windwardPoint.y}
                x2={leewardPoint.x}
                y2={leewardPoint.y}
                className="stroke-slate-900/80"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
              />
              <circle cx={windwardPoint.x} cy={windwardPoint.y} r={3} className="fill-slate-900" />
              <circle cx={leewardPoint.x} cy={leewardPoint.y} r={3} className="fill-slate-900" />
              <path
                d="M0,0 L-11,-4.5 L-11,4.5 Z"
                className="fill-slate-900"
                transform={`translate(${leewardPoint.x + direction.x * 6} ${leewardPoint.y + direction.y * 6}) rotate(${(Math.atan2(direction.y, direction.x) * 180) / Math.PI})`}
              />
              {[
                { point: windwardPoint, label: "upwind" },
                { point: leewardPoint, label: "downwind" },
              ].map(({ point, label }) => {
                const outward = label === "upwind" ? -1 : 1;
                return (
                  <text
                    key={label}
                    x={point.x + direction.x * outward * 22}
                    y={point.y + direction.y * outward * 22 + 4}
                    textAnchor="middle"
                    className="fill-slate-700 text-[13px]"
                    style={{ paintOrder: "stroke", stroke: "#ffffff", strokeWidth: 3 }}
                  >
                    {label}
                  </text>
                );
              })}
              <circle cx={centre.x} cy={centre.y} r={3.5} className="fill-slate-900" />
              <text
                x={centre.x + 10}
                y={centre.y - 8}
                className="fill-slate-700 text-[13px]"
                style={{ paintOrder: "stroke", stroke: "#ffffff", strokeWidth: 3 }}
              >
                Glider Area centre
              </text>
              {PLACES.map((place) => {
                const px = x(place.lon);
                const py = y(place.lat);
                return (
                  <g key={place.name}>
                    <circle
                      cx={px}
                      cy={py}
                      r={place.primary ? 4 : 3}
                      className={place.primary ? "fill-slate-900" : "fill-slate-700"}
                    />
                    <text
                      x={px + 9}
                      y={py + 3.5}
                      className={`text-[13px] ${place.primary ? "fill-slate-900 font-semibold" : "fill-slate-700"}`}
                      style={{ paintOrder: "stroke", stroke: "#ffffff", strokeWidth: 3 }}
                    >
                      {place.name}
                    </text>
                  </g>
                );
              })}
              <g>
                <line
                  x1={26}
                  y1={H - 26}
                  x2={26 + radiusMap}
                  y2={H - 26}
                  className="stroke-slate-900/70"
                  strokeWidth={1.5}
                  vectorEffect="non-scaling-stroke"
                />
                {[0, 0.5, 1].map((tick) => (
                  <line
                    key={tick}
                    x1={26 + radiusMap * tick}
                    y1={H - 31}
                    x2={26 + radiusMap * tick}
                    y2={H - 21}
                    className="stroke-slate-900/70"
                    strokeWidth={1.5}
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
                {[
                  { t: 0, label: "0", anchor: "middle" },
                  { t: 0.5, label: "5", anchor: "middle" },
                  { t: 1, label: "10 NM", anchor: "middle" },
                ].map(({ t, label }) => (
                  <text
                    key={label}
                    x={26 + radiusMap * t}
                    y={H - 36}
                    textAnchor="middle"
                    className="fill-slate-700 text-[13px]"
                    style={{ paintOrder: "stroke", stroke: "#ffffff", strokeWidth: 3 }}
                  >
                    {label}
                  </text>
                ))}
              </g>
              <g transform={`translate(${W - 36} 36)`}>
                <path d="M0,-15 L5.5,7 L0,2.5 L-5.5,7 Z" className="fill-slate-900" />
                <text
                  x={0}
                  y={26}
                  textAnchor="middle"
                  className="fill-slate-900 text-[13px] font-semibold"
                  style={{ paintOrder: "stroke", stroke: "#ffffff", strokeWidth: 3 }}
                >
                  N
                </text>
              </g>
            </svg>
          </div>
          <WaveLegend scale={mode === "linear" ? "linear" : "hrrr"} />
          <p className="mt-3 text-[11px] leading-5 text-slate-400">
            {mode === "linear"
              ? `Linear-theory estimate at ${definition.ft.toLocaleString("en-US")} ft — long terrain transects run along this hour's wind and are solved with the HRRR column, anchored at the range's mean height with the flow there doing the forcing. `
              : `Vertical velocity at ${definition.ft.toLocaleString("en-US")} ft over the Gorham country. `}
            The dashed circle is the LOA&apos;s Mount Washington Glider Area — a 10 NM radius around its
            centre — and the solid line is the cross-section above, this hour&apos;s wind line through
            that centre. Shaded relief with 1,000 ft contours and roads (terrain: AWS Terrain Tiles;
            roads © OpenStreetMap contributors). Warm bands are lift, blue is sink; pick any hour
            above and the whole picture turns with it.
          </p>
        </>
      ) : error || mosaicError || linearUnavailable ? (
        <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600 ring-1 ring-slate-900/5">
          {mode === "linear" && linearUnavailable && !error && !mosaicError
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
