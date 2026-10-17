"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fetchJson } from "@/lib/fetch-json";
import { fetchRoadLines, type RoadLine } from "@/lib/roads";
import { MAP_LIGHT, MAP_RELIEF_RAMP, reliefColour } from "@/lib/relief";
import {
  AREA_RADIUS_NM,
  GLIDER_AREA,
  KM_PER_NM,
  MAP_LAT_MIN,
  MAP_LAT_SPAN,
  MAP_LON_MIN,
  MAP_LON_SPAN,
} from "@/lib/wx-grid";
import {
  GLIDER_AREA_BASE_FT,
  GLIDER_AREA_TOPS_FT,
  NAV_DOWNLOAD_GROUPS,
  NAV_DOWNLOADS,
  navDownloadHref,
  WSTX_GORHAM_FILES,
  type CupWaypoint,
} from "@/lib/nav-files";
import {
  contourSegments,
  fetchTerrainMosaic,
  mosaicElevation,
  type TerrainMosaic,
} from "@/lib/terrain-tiles";

/**
 * Electronic files, drawn: the exchange's Gorham waypoint set and the LOA's
 * Glider Area on one map, with the downloads that carry them. Two windows —
 * the wave area the camp flies, and the full reach of the waypoint package —
 * share the same relief, contours and waypoint layer; only the bounds change.
 *
 * The waypoints come from /api/nav/files (the exchange's current CUP file, parsed);
 * the relief is the site's shared terrain mosaic. Hovering a point names it.
 */

type Bounds = { west: number; south: number; east: number; north: number };

const M_PER_DEG_LAT = 111_194.93;
const metresPerDegLon = (lat: number) => M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);

/** One window's world — the canvas size is the bounds' true projected aspect. */
function makeView(bounds: Bounds, width: number, zoom: number) {
  const latSpan = bounds.north - bounds.south;
  const lonSpan = bounds.east - bounds.west;
  const midLat = (bounds.north + bounds.south) / 2;
  const height = Math.round((width * latSpan * M_PER_DEG_LAT) / (lonSpan * metresPerDegLon(midLat)));
  return {
    bounds,
    zoom,
    width,
    height,
    x: (lon: number) => ((lon - bounds.west) / lonSpan) * width,
    y: (lat: number) => height - ((lat - bounds.south) / latSpan) * height,
    /** A distance in kilometres, in map units — equal on both axes by the aspect. */
    km: (km: number) => (km / (lonSpan * metresPerDegLon(midLat))) * 1000 * width,
    metresPerDegLon: metresPerDegLon(midLat),
  };
}

/**
 * The wave window is the site's shared map box (the same one the Wavecast map
 * uses); the region window is the waypoint package's own reach, a little air
 * around the extremes of the 250 points (Socatean Bay to Shirley, Keene to
 * Knox County).
 */
const VIEWS = {
  wave: makeView(
    {
      west: MAP_LON_MIN,
      south: MAP_LAT_MIN,
      east: MAP_LON_MIN + MAP_LON_SPAN,
      north: MAP_LAT_MIN + MAP_LAT_SPAN,
    },
    1200,
    12,
  ),
  region: makeView({ west: -74.0, south: 42.45, east: -68.85, north: 45.85 }, 1400, 8),
} as const;

type ViewId = keyof typeof VIEWS;

const VIEW_LABELS: Record<ViewId, string> = {
  wave: "Wave area",
  region: "All waypoints",
};

const VIEW_NOTES: Record<ViewId, string> = {
  wave: "The LOA's 10 NM Glider Area over the wave country, with the exchange's waypoints around the field. Hover any point for its name, elevation and notes.",
  region:
    "Every waypoint in the exchange's Gorham package — the 250 points closest to the field, from the Canadian line to the Massachusetts hills. The dashed circle is the LOA's Glider Area.",
};

/** The wave map's contour set: every 1,000 ft from 1,000 to 6,000. */
const CONTOURS_M = [305, 610, 914, 1219, 1524, 1829];

const WAVE_LEGEND = { ticks: ["0", "5", "10 NM"] };
const REGION_LEGEND = { ticks: ["0", "25", "50 km"] };

const HALO = { paintOrder: "stroke", stroke: "#ffffff", strokeWidth: 3 } as const;

type NavFilesPayload = {
  waypoints: { source: string; dated: string | null; points: CupWaypoint[] };
  airspace: { version: string; effective: string | null } | null;
};

type WaypointKind = "field" | "airfield" | "outlanding" | "turnpoint" | "other";

function waypointKind(waypoint: CupWaypoint): WaypointKind {
  if (waypoint.code === "2G8") return "field";
  if (waypoint.style === 2 || waypoint.style === 5) return "airfield";
  if (waypoint.style === 3) return "outlanding";
  if (waypoint.style === 1) return "turnpoint";
  return "other";
}

const KIND_LABEL: Record<WaypointKind, string> = {
  field: "Airfield — the wave camp field",
  airfield: "Airfield",
  outlanding: "Outlanding",
  turnpoint: "Turn point",
  other: "Waypoint",
};

/** The field carries its identifier on the map the way the rest of the site writes it. */
const labelText = (waypoint: CupWaypoint) =>
  waypointKind(waypoint) === "field" ? `${waypoint.name} ${waypoint.code}` : waypoint.name;

/** The marker's own class and radius, in map units. */
const MARKER: Record<WaypointKind, { r: number; className: string; strokeWidth: number }> = {
  other: { r: 2, className: "fill-slate-500/60", strokeWidth: 0 },
  turnpoint: { r: 2.6, className: "fill-slate-700/90", strokeWidth: 0 },
  outlanding: { r: 3, className: "fill-white stroke-slate-600/80", strokeWidth: 1.2 },
  airfield: { r: 3.4, className: "fill-sky-700 stroke-white", strokeWidth: 1.2 },
  field: { r: 4.8, className: "fill-slate-900 stroke-white", strokeWidth: 1.5 },
};

/** How the label sorts when the map has room for only some of them. */
const KIND_ORDER: Record<WaypointKind, number> = {
  field: 0,
  airfield: 1,
  outlanding: 2,
  turnpoint: 3,
  other: 4,
};

/* ------------------------------ label placement ----------------------------- */

type Rect = { x1: number; y1: number; x2: number; y2: number };
type LabelSpot = { x: number; y: number; anchor: "start" | "end" };

/** A generous box for a text label — used only to keep labels off each other. */
function textBox(text: string, x: number, y: number, anchor: "start" | "end"): Rect {
  const width = text.length * 8.2 + 6;
  const left = anchor === "start" ? x : x - width;
  return { x1: left, y1: y - 12, x2: left + width, y2: y + 4 };
}

const overlaps = (rects: Rect[], box: Rect) =>
  rects.some((rect) => box.x1 < rect.x2 && box.x2 > rect.x1 && box.y1 < rect.y2 && box.y2 > rect.y1);

function clampSpot(text: string, spot: LabelSpot, view: (typeof VIEWS)[ViewId]): LabelSpot {
  const width = text.length * 8.2 + 6;
  const minX = spot.anchor === "start" ? 4 : 4 + width;
  const maxX = spot.anchor === "start" ? view.width - width - 4 : view.width - 4;
  return {
    ...spot,
    x: Math.min(Math.max(spot.x, minX), maxX),
    y: Math.min(Math.max(spot.y, 14), view.height - 6),
  };
}

const FT_FORMAT = new Intl.NumberFormat("en-US");

export function NavFilesMap() {
  const [view, setView] = useState<ViewId>("wave");
  const [files, setFiles] = useState<NavFilesPayload | null>(null);
  const [filesFailed, setFilesFailed] = useState(false);
  const [mosaics, setMosaics] = useState<Partial<Record<ViewId, TerrainMosaic>>>({});
  const [mosaicFailed, setMosaicFailed] = useState(false);
  const [roads, setRoads] = useState<RoadLine[] | null>(null);
  const [hover, setHover] = useState<{ waypoint: CupWaypoint; x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const active = VIEWS[view];
  const mosaic = mosaics[view] ?? null;

  useEffect(() => {
    let cancelled = false;
    fetchJson("/api/nav/files")
      .then((payload) => {
        if (cancelled) return;
        setFiles(payload as NavFilesPayload);
        setFilesFailed(false);
      })
      .catch(() => {
        if (!cancelled) setFilesFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // One mosaic per view, kept — switching back to a view draws it at once.
  useEffect(() => {
    let cancelled = false;
    fetchTerrainMosaic(VIEWS[view].bounds, VIEWS[view].zoom)
      .then((next) => {
        if (!cancelled) setMosaics((previous) => ({ ...previous, [view]: next }));
      })
      .catch(() => {
        if (!cancelled) setMosaicFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [view]);

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

  const waypoints = files?.waypoints.points ?? null;

  const shown = useMemo(
    () =>
      (waypoints ?? []).filter(
        (waypoint) =>
          waypoint.lon >= active.bounds.west &&
          waypoint.lon <= active.bounds.east &&
          waypoint.lat >= active.bounds.south &&
          waypoint.lat <= active.bounds.north,
      ),
    [waypoints, active],
  );

  // Contour lines never move — derive them once per mosaic.
  const contours = useMemo(
    () =>
      mosaic
        ? CONTOURS_M.map((levelM) => ({ levelM, segments: contourSegments(mosaic, levelM, 5) }))
        : [],
    [mosaic],
  );

  // The elevation at every canvas pixel — it depends only on the mosaic.
  const terrainGrid = useMemo(() => {
    if (!mosaic) return null;
    const { width: W, height: H, bounds } = active;
    const { lonStep, latStep, west, north } = mosaic;
    const mx0 = (bounds.west - west) / lonStep;
    const mxStep = (bounds.east - bounds.west) / (W - 1) / lonStep;
    const my0 = (north - bounds.north) / latStep;
    const myStep = (bounds.north - bounds.south) / (H - 1) / latStep;
    const grid = new Float32Array(W * H);
    for (let py = 0; py < H; py += 1) {
      const my = my0 + py * myStep;
      const row = py * W;
      for (let px = 0; px < W; px += 1) {
        grid[row + px] = mosaicElevation(mosaic, mx0 + px * mxStep, my);
      }
    }
    return grid;
  }, [mosaic, active]);

  /**
   * The waypoint labels the map has room for. Every marker claims its square
   * first, then points are labelled in the order the camp reads them — the field,
   * airfields, outlandings, then the peaks — at the first of four candidate spots
   * that clears everything already placed. The region view labels only what gives
   * it bearings: the field, the airfields and the Observatory.
   */
  const labelSpots = useMemo(() => {
    const spots = new Map<string, LabelSpot>();
    const claims: Rect[] = [];
    for (const waypoint of shown) {
      const cx = active.x(waypoint.lon);
      const cy = active.y(waypoint.lat);
      claims.push({ x1: cx - 7, y1: cy - 7, x2: cx + 7, y2: cy + 7 });
    }
    const gliderCx = active.x(GLIDER_AREA.lon);
    const gliderCy = active.y(GLIDER_AREA.lat);
    const gliderR = active.km(AREA_RADIUS_NM * KM_PER_NM);
    claims.push(textBox("Glider Area", gliderCx, gliderCy - gliderR - 8, "start"));

    const candidates = (waypoint: CupWaypoint) => {
      const cx = active.x(waypoint.lon);
      const cy = active.y(waypoint.lat);
      return [
        { x: cx + 10, y: cy - 6, anchor: "start" as const },
        { x: cx - 10, y: cy - 6, anchor: "end" as const },
        { x: cx + 10, y: cy + 17, anchor: "start" as const },
        { x: cx - 10, y: cy + 17, anchor: "end" as const },
      ];
    };

    const labelled = shown.filter(
      (waypoint) =>
        view === "wave" ||
        waypointKind(waypoint) === "airfield" ||
        waypointKind(waypoint) === "field" ||
        waypoint.code === "MTWASHIN",
    );
    const ordered = [...labelled].sort(
      (left, right) => KIND_ORDER[waypointKind(left)] - KIND_ORDER[waypointKind(right)],
    );

    for (const waypoint of ordered) {
      for (const candidate of candidates(waypoint)) {
        const text = labelText(waypoint);
        const spot = clampSpot(text, candidate, active);
        const box = textBox(text, spot.x, spot.y, spot.anchor);
        if (!overlaps(claims, box)) {
          spots.set(`${waypoint.code}:${waypoint.name}`, spot);
          claims.push(box);
          break;
        }
      }
    }
    return spots;
  }, [shown, active, view]);

  // Paint the shaded relief and the contours; the waypoints are SVG on top.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mosaic || !terrainGrid) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const { width: W, height: H, bounds } = active;
    const { lonStep, latStep, west, north } = mosaic;
    const mx0 = (bounds.west - west) / lonStep;
    const mxStep = (bounds.east - bounds.west) / (W - 1) / lonStep;
    const my0 = (north - bounds.north) / latStep;
    const myStep = (bounds.north - bounds.south) / (H - 1) / latStep;
    const dxM = ((bounds.east - bounds.west) / (W - 1)) * active.metresPerDegLon;
    const dyM = ((bounds.north - bounds.south) / (H - 1)) * M_PER_DEG_LAT;
    const terrain = terrainGrid;

    const image = context.createImageData(W, H);
    const pixels = image.data;
    for (let py = 0; py < H; py += 1) {
      const row = py * W;
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
        const shade = (-dzdx * MAP_LIGHT.east - dzdy * MAP_LIGHT.north + MAP_LIGHT.up) / norm;
        const [r, g, b] = reliefColour(e, shade, MAP_RELIEF_RAMP);
        const o = i * 4;
        pixels[o] = r;
        pixels[o + 1] = g;
        pixels[o + 2] = b;
        pixels[o + 3] = 255;
      }
    }
    context.putImageData(image, 0, 0);

    context.strokeStyle = "rgba(30, 41, 59, 0.2)";
    context.lineWidth = 1;
    for (const { segments } of contours) {
      context.beginPath();
      for (const segment of segments) {
        context.moveTo((segment.x1 - mx0) / mxStep, (segment.y1 - my0) / myStep);
        context.lineTo((segment.x2 - mx0) / mxStep, (segment.y2 - my0) / myStep);
      }
      context.stroke();
    }
  }, [mosaic, terrainGrid, contours, active]);

  const gliderCentre = { x: active.x(GLIDER_AREA.lon), y: active.y(GLIDER_AREA.lat) };
  const gliderRadius = active.km(AREA_RADIUS_NM * KM_PER_NM);
  const legend = view === "wave" ? WAVE_LEGEND : REGION_LEGEND;
  const legendUnit = view === "wave" ? active.km(AREA_RADIUS_NM * KM_PER_NM) : active.km(50);

  const dated = files?.waypoints.dated ?? null;
  const sourceFile = files?.waypoints.source.split("/").pop() ?? null;
  const airspace = files?.airspace ?? null;
  const ready = mosaic !== null;

  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Map view">
          {(Object.keys(VIEWS) as ViewId[]).map((id) => {
            const activeView = view === id;
            const count = id === "region" && waypoints ? ` (${waypoints.length})` : "";
            return (
              <button
                key={id}
                type="button"
                aria-pressed={activeView}
                onClick={() => setView(id)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                  activeView
                    ? "bg-sky-100 text-sky-700 ring-1 ring-sky-200"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {VIEW_LABELS[id]}
                {count}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-slate-400">
          {waypoints
            ? `${waypoints.length} waypoints · soaringweb.org`
            : filesFailed
              ? "waypoints unavailable"
              : "loading waypoints…"}
          {airspace?.effective ? ` · airspace effective ${airspace.effective}` : ""}
        </p>
      </div>

      {ready ? (
        <>
          <div
            className="relative mt-4 overflow-hidden rounded-2xl ring-1 ring-slate-900/10"
            role="img"
            aria-label={`Map of the ${VIEW_LABELS[view].toLowerCase()} with the exchange's Gorham waypoints and the LOA's 10 NM Glider Area`}
          >
            <canvas ref={canvasRef} width={active.width} height={active.height} className="block h-auto w-full" />
            <svg
              viewBox={`0 0 ${active.width} ${active.height}`}
              className="absolute inset-0 h-full w-full"
              aria-hidden="true"
            >
              {view === "wave"
                ? roads?.map((line, index) => (
                    <g key={index}>
                      <polyline
                        points={line.p
                          .map(([lon, lat]) => `${active.x(lon).toFixed(1)},${active.y(lat).toFixed(1)}`)
                          .join(" ")}
                        className={line.k === 2 ? "fill-none stroke-white/55" : "fill-none stroke-white/40"}
                        strokeWidth={line.k === 2 ? 2 : 1.5}
                        vectorEffect="non-scaling-stroke"
                      />
                      <polyline
                        points={line.p
                          .map(([lon, lat]) => `${active.x(lon).toFixed(1)},${active.y(lat).toFixed(1)}`)
                          .join(" ")}
                        className={line.k === 2 ? "fill-none stroke-slate-500/55" : "fill-none stroke-slate-500/35"}
                        strokeWidth={0.8}
                        vectorEffect="non-scaling-stroke"
                      />
                    </g>
                  ))
                : null}

              <circle
                cx={gliderCentre.x}
                cy={gliderCentre.y}
                r={gliderRadius}
                className="fill-sky-500/5 stroke-slate-900/50"
                strokeDasharray="9 7"
                strokeWidth={1.4}
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={gliderCentre.x}
                y={gliderCentre.y - gliderRadius - 10}
                textAnchor="middle"
                className="hidden fill-slate-700 text-[13px] sm:inline"
                style={HALO}
              >
                Glider Area · {FT_FORMAT.format(GLIDER_AREA_BASE_FT)}–{FT_FORMAT.format(GLIDER_AREA_TOPS_FT)} ft
              </text>

              {shown.map((waypoint) => {
                const kind = waypointKind(waypoint);
                const marker = MARKER[kind];
                const cx = active.x(waypoint.lon);
                const cy = active.y(waypoint.lat);
                const key = `${waypoint.code}:${waypoint.name}`;
                const spot = labelSpots.get(key);
                return (
                  <g
                    key={key}
                    data-waypoint={waypoint.code || waypoint.name}
                    onMouseEnter={() => setHover({ waypoint, x: cx, y: cy })}
                    onMouseLeave={() => setHover(null)}
                  >
                    {kind === "field" ? (
                      <rect
                        x={cx - marker.r}
                        y={cy - marker.r}
                        width={marker.r * 2}
                        height={marker.r * 2}
                        transform={`rotate(45 ${cx} ${cy})`}
                        className={marker.className}
                        strokeWidth={marker.strokeWidth}
                      />
                    ) : (
                      <circle cx={cx} cy={cy} r={marker.r} className={marker.className} strokeWidth={marker.strokeWidth} />
                    )}
                    {/* A generous invisible hit area, so small markers still catch the pointer. */}
                    <circle cx={cx} cy={cy} r={9} className="fill-transparent" />
                    {spot ? (
                      <text
                        x={spot.x}
                        y={spot.y}
                        textAnchor={spot.anchor}
                        className={`hidden text-[13px] sm:inline ${
                          kind === "field" ? "fill-slate-900 font-semibold" : "fill-slate-700"
                        }`}
                        style={HALO}
                      >
                        {labelText(waypoint)}
                      </text>
                    ) : null}
                  </g>
                );
              })}

              <g>
                <line
                  x1={26}
                  y1={active.height - 26}
                  x2={26 + legendUnit}
                  y2={active.height - 26}
                  className="stroke-slate-900/70"
                  strokeWidth={1.5}
                  vectorEffect="non-scaling-stroke"
                />
                {[0, 0.5, 1].map((tick) => (
                  <line
                    key={tick}
                    x1={26 + legendUnit * tick}
                    y1={active.height - 31}
                    x2={26 + legendUnit * tick}
                    y2={active.height - 21}
                    className="stroke-slate-900/70"
                    strokeWidth={1.5}
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
                {legend.ticks.map((label, index) => (
                  <text
                    key={label}
                    x={26 + legendUnit * (index / 2)}
                    y={active.height - 36}
                    textAnchor="middle"
                    className="hidden fill-slate-700 text-[13px] sm:inline"
                    style={HALO}
                  >
                    {label}
                  </text>
                ))}
              </g>
              <g transform={`translate(${active.width - 36} 36)`}>
                <path d="M0,-15 L5.5,7 L0,2.5 L-5.5,7 Z" className="fill-slate-900" />
                <text
                  x={0}
                  y={26}
                  textAnchor="middle"
                  className="hidden fill-slate-900 text-[13px] font-semibold sm:inline"
                  style={HALO}
                >
                  N
                </text>
              </g>
            </svg>

            {hover ? (
              <div
                className="pointer-events-none absolute z-10 w-max max-w-[17rem] rounded-xl bg-slate-900/95 px-3.5 py-2.5 text-xs leading-5 text-white shadow-lg"
                style={{
                  left: `${Math.min(Math.max((hover.x / active.width) * 100, 14), 86)}%`,
                  top: `${(hover.y / active.height) * 100}%`,
                  // Below the marker when there is no room above it inside the map.
                  transform:
                    hover.y < active.height * 0.16
                      ? "translate(-50%, 16px)"
                      : "translate(-50%, calc(-100% - 14px))",
                }}
              >
                <p className="font-semibold">
                  {hover.waypoint.name}
                  {hover.waypoint.code && hover.waypoint.code !== hover.waypoint.name ? (
                    <span className="ml-1.5 font-normal text-slate-300">{hover.waypoint.code}</span>
                  ) : null}
                </p>
                <p className="text-slate-300">
                  {KIND_LABEL[waypointKind(hover.waypoint)]}
                  {hover.waypoint.elevationFt !== null
                    ? ` · ${FT_FORMAT.format(hover.waypoint.elevationFt)} ft`
                    : ""}
                </p>
                {hover.waypoint.description ? (
                  <p className="mt-1 text-slate-400">{hover.waypoint.description}</p>
                ) : null}
              </div>
            ) : null}
          </div>
          <p className="mt-3 text-[11px] leading-5 text-slate-400">
            {VIEW_NOTES[view]} Shaded relief with 1,000 ft contours
            {view === "wave" ? " and roads" : ""} — terrain: AWS Terrain Tiles
            {view === "wave" ? ", roads © OpenStreetMap contributors" : ""}.
          </p>
        </>
      ) : mosaicFailed ? (
        <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600 ring-1 ring-slate-900/5">
          The map&rsquo;s terrain is unavailable right now. The downloads below still serve the current
          files from the exchange.
        </p>
      ) : (
        <div className="mt-4 h-[520px] animate-pulse rounded-2xl bg-slate-100" aria-hidden="true" />
      )}

      {filesFailed ? (
        <p className="mt-4 rounded-2xl bg-amber-50 p-3.5 text-xs leading-5 text-amber-900 ring-1 ring-amber-200/70">
          The exchange&rsquo;s waypoint list could not be reached just now, so the map is showing the
          terrain alone. The downloads still fetch the exchange&rsquo;s current files.
        </p>
      ) : null}

      <div className="mt-6 border-t border-slate-100 pt-5">
        <div className="grid gap-5 md:grid-cols-3">
          {NAV_DOWNLOAD_GROUPS.map((group) => (
            <div key={group.id}>
              <p className="text-sm font-semibold text-slate-900">{group.title}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {group.description}
                {group.id === "allusa" && airspace
                  ? ` Current issue ${airspace.version}${airspace.effective ? `, effective ${airspace.effective}` : ""}.`
                  : ""}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {NAV_DOWNLOADS.filter((download) => download.group === group.id).map((download) => (
                  <a
                    key={download.id}
                    href={navDownloadHref(download.id)}
                    data-umami-event="Download"
                    data-umami-event-file={download.file}
                    className="group inline-flex items-center gap-2 rounded-full bg-slate-100 py-1.5 pl-2.5 pr-3.5 text-xs font-medium text-slate-700 transition-colors hover:bg-sky-50 hover:text-sky-700"
                  >
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 group-hover:text-sky-700">
                      {download.meta}
                    </span>
                    <span>{download.apps}</span>
                    <span aria-hidden="true" className="text-slate-400 group-hover:text-sky-700">
                      ↓
                    </span>
                  </a>
                ))}
                {group.id === "waypoints" ? (
                  <a
                    href={WSTX_GORHAM_FILES}
                    target="_blank"
                    rel="noreferrer"
                    data-umami-event="Open waypoint exchange"
                    className="group inline-flex items-center gap-2 rounded-full bg-slate-100 py-1.5 pl-2.5 pr-3.5 text-xs font-medium text-slate-700 transition-colors hover:bg-sky-50 hover:text-sky-700"
                  >
                    <span>More formats at soaringweb.org</span>
                    <span aria-hidden="true" className="text-slate-400 group-hover:text-sky-700">
                      ↗
                    </span>
                  </a>
                ) : null}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-slate-500">
          <span>Also useful:</span>
          <a
            href="/files/45-minute-diamond.igc"
            data-umami-event="Download"
            data-umami-event-file="45-minute-diamond.igc"
            className="font-medium text-sky-700 underline underline-offset-4 hover:text-sky-600"
          >
            45-Minute Diamond · IGC
          </a>
          <a
            href="/files/gorham-landing-places.kmz"
            data-umami-event="Download"
            data-umami-event-file="gorham-landing-places.kmz"
            className="font-medium text-sky-700 underline underline-offset-4 hover:text-sky-600"
          >
            Landing places within 100 miles · KMZ for Google Earth
          </a>
        </p>
        <p className="mt-4 text-[11px] leading-5 text-slate-400">
          Waypoints and airspace come from the Worldwide Soaring Turnpoint Exchange
          {sourceFile && dated
            ? ` — its Gorham package (${sourceFile}) is dated ${dated}`
            : ""}. The all-USA file is the
          exchange&rsquo;s current NASR issue with the glider area merged in at download time, so
          nothing here has to be kept in step by hand.
        </p>
      </div>
    </div>
  );
}
