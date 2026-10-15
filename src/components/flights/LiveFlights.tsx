"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SectionNote } from "@/components/weather/SectionNote";
import { Container } from "@/components/ui/Container";
import { fetchJson } from "@/lib/fetch-json";
import { fetchRoadLines, type RoadLine } from "@/lib/roads";
import { MAP_LIGHT, MAP_RELIEF_RAMP, reliefColour } from "@/lib/relief";
import { AREA_RADIUS_NM, GLIDER_AREA, KM_PER_NM } from "@/lib/wx-grid";
import {
  CLIENT_POLL_MS,
  FIELD_MEMORY_MS,
  FIELD_ZONE_NM,
  GORHAM_FIELD,
  KIND_LABEL,
  TRAFFIC_BOUNDS,
  compassPoint,
  hasFieldEvidence,
  isAirborneGlider,
  isAtField,
  type FieldSighting,
  type LiveFlight,
  type LiveTraffic,
  type TrafficKind,
} from "@/lib/live-traffic";
import {
  contourSegments,
  fetchTerrainMosaic,
  mosaicElevation,
  type TerrainMosaic,
} from "@/lib/terrain-tiles";

/**
 * Airborne now — the flights page's live tracker. Both feeds (the Open Glider
 * Network's FLARM/OGN markers and ADS-B via adsb.lol) are merged by
 * /api/flights/live; this component draws the box around Gorham, puts every
 * aircraft on it, and lists them in the order the ground cares about.
 *
 * The card shows itself only while a glider that departed Gorham is flying: a
 * parked glider with its FLARM on is not a flight, and traffic passing through is
 * not the camp. A departure is learned by watching — the aircraft low and close
 * to 2G8 — and sightings persist in localStorage, so a return visit still
 * recognises the flights that took off while the page was closed.
 *
 * Polling runs while the tab is foreground — the card being hidden is exactly
 * when the page must keep looking for a launch — and refreshes once a minute.
 */

/** The world (canvas) size — the box's true projected aspect, ~82 m per unit, and
 * close enough to its display width that map units stay readable as text. */
const W = 704;
const LAT_SPAN = TRAFFIC_BOUNDS.north - TRAFFIC_BOUNDS.south;
const LON_SPAN = TRAFFIC_BOUNDS.east - TRAFFIC_BOUNDS.west;
const MID_LAT = (TRAFFIC_BOUNDS.north + TRAFFIC_BOUNDS.south) / 2;
const H = Math.round((W * LAT_SPAN) / (LON_SPAN * Math.cos((MID_LAT * Math.PI) / 180)));

/** ~55 m tiles, so the mosaic is finer than the canvas it feeds. */
const TERRAIN_ZOOM = 11;

const KM_PER_DEG_LAT = 111.09;
const METRES_PER_DEG_LON = KM_PER_DEG_LAT * Math.cos((MID_LAT * Math.PI) / 180) * 1000;

const pxX = (lon: number) => ((lon - TRAFFIC_BOUNDS.west) / LON_SPAN) * W;
const pxY = (lat: number) => H - ((lat - TRAFFIC_BOUNDS.south) / LAT_SPAN) * H;
/** A nautical-mile radius in map units — equal on both axes by the aspect above. */
const nmToPx = (nm: number) => ((nm * KM_PER_NM) / KM_PER_DEG_LAT / LAT_SPAN) * H;

const FIELD_PX = { x: pxX(GORHAM_FIELD.lon), y: pxY(GORHAM_FIELD.lat) };
const FIELD_RADIUS_PX = nmToPx(FIELD_ZONE_NM);
const GLIDER_PX = { x: pxX(GLIDER_AREA.lon), y: pxY(GLIDER_AREA.lat) };
const GLIDER_RADIUS_PX = nmToPx(AREA_RADIUS_NM);

/** The wave map's contour set: every 1,000 ft from 1,000 to 6,000. */
const CONTOURS_M = [305, 610, 914, 1219, 1524, 1829];

const KIND_COLOR: Record<TrafficKind, string> = {
  glider: "#0284c7", // sky-600 — the camp's own traffic
  tow: "#d97706", // amber-600 — the tugs
  helicopter: "#475569", // slate-600
  powered: "#64748b", // slate-500
  other: "#94a3b8", // slate-400
};

const LEGEND_KINDS: TrafficKind[] = ["glider", "tow", "powered"];

/** The summits and towns that orient the eye; the field is drawn separately. */
const PLACES = [
  { name: "Mt Washington", lat: 44.27246, lon: -71.30402, primary: true },
  { name: "Mt Madison", lat: 44.33046, lon: -71.27724, primary: false },
  { name: "Berlin", lat: 44.4687, lon: -71.1851, primary: false },
  { name: "Whitefield", lat: 44.3675, lon: -71.55, primary: false },
].map((place) => ({ ...place, x: pxX(place.lon), y: pxY(place.lat) }));

const FIELD_LABEL = { x: FIELD_PX.x + 10, y: FIELD_PX.y + 3.5 };

type Rect = { x1: number; y1: number; x2: number; y2: number };
type LabelSpot = { x: number; y: number; anchor: "start" | "end" };

/** A generous box for a text label — used only to keep labels off each other. */
function textBox(text: string, x: number, y: number, anchor: "start" | "end"): Rect {
  const width = text.length * 8.4 + 6;
  const left = anchor === "start" ? x : x - width;
  return { x1: left, y1: y - 12, x2: left + width, y2: y + 4 };
}

const overlaps = (rects: Rect[], box: Rect) =>
  rects.some((rect) => box.x1 < rect.x2 && box.x2 > rect.x1 && box.y1 < rect.y2 && box.y2 > rect.y1);

/** Keeps a candidate inside the map so an edge aircraft still gets its whole label. */
function clampSpot(text: string, spot: LabelSpot): LabelSpot {
  const width = text.length * 8.4 + 6;
  const minX = spot.anchor === "start" ? 4 : 4 + width;
  const maxX = spot.anchor === "start" ? W - width - 4 : W - 4;
  return {
    ...spot,
    x: Math.min(Math.max(spot.x, minX), maxX),
    y: Math.min(Math.max(spot.y, 14), H - 6),
  };
}


const HALO = { paintOrder: "stroke", stroke: "#ffffff", strokeWidth: 3 } as const;

const FT_FORMAT = new Intl.NumberFormat("en-US");

const formatAltitude = (ft: number | null) => (ft === null ? "—" : `${FT_FORMAT.format(ft)} ft`);
const formatClimb = (fpm: number | null) =>
  fpm === null ? "—" : `${fpm > 0 ? "+" : ""}${FT_FORMAT.format(fpm)} fpm`;
const formatDistance = (nm: number) => (nm < 10 ? `${nm.toFixed(1)} NM` : `${Math.round(nm)} NM`);
const formatAge = (seconds: number) =>
  seconds < 90 ? `${Math.max(0, Math.round(seconds))} s` : `${Math.round(seconds / 60)} min`;
const formatMinutes = (ms: number) => {
  const minutes = Math.max(1, Math.round(ms / 60000));
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
};

/** localStorage key for the departure memories — bump the version to retire old ones. */
const SIGHTINGS_KEY = "mws-live-flights-sightings-v1";

/** The departure memories this browser stored on earlier visits, still fresh. */
function readStoredSightings(): Map<string, FieldSighting> {
  const stored = new Map<string, FieldSighting>();
  try {
    const raw = window.localStorage.getItem(SIGHTINGS_KEY);
    if (!raw) return stored;
    const parsed = JSON.parse(raw) as { sightings?: [string, unknown][] };
    const now = Date.now();
    for (const [id, value] of parsed.sightings ?? []) {
      const nearFieldMs = (value as { nearFieldMs?: unknown } | null)?.nearFieldMs;
      if (typeof nearFieldMs === "number" && now - nearFieldMs < FIELD_MEMORY_MS) {
        stored.set(id, { nearFieldMs });
      }
    }
  } catch {
    // unreadable storage — evidence starts fresh
  }
  return stored;
}

function FlightRow({ flight, departure, ageSec }: { flight: LiveFlight; departure: string | null; ageSec: number }) {
  const meta = [
    KIND_LABEL[flight.kind],
    flight.registration && flight.registration !== flight.ident ? flight.registration : null,
    flight.aircraftType,
    `${compassPoint(flight.bearingDeg)} ${formatDistance(flight.distanceNm)}`,
    formatAge(ageSec),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li
      className="flex items-start justify-between gap-3 py-2.5"
      title={`${flight.ident} — ${KIND_LABEL[flight.kind]}${flight.aircraftType ? ` (${flight.aircraftType})` : ""} · ${formatAltitude(flight.altitudeFt)} · ${formatClimb(flight.climbFpm)} · ${flight.groundSpeedKt !== null ? `${flight.groundSpeedKt} kt · ` : ""}seen ${formatAge(ageSec)} ago`}
    >
      <div className="min-w-0">
        <p className="flex items-center gap-2 font-medium text-slate-900">
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: KIND_COLOR[flight.kind] }}
            aria-hidden="true"
          />
          <span className="truncate">{flight.ident}</span>
        </p>
        <p className="mt-0.5 text-xs leading-5 text-slate-500 tabular-nums">{meta}</p>
        {departure ? (
          <p className="mt-1">
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                departure === "at the field"
                  ? "bg-slate-100 text-slate-600"
                  : "bg-sky-100 text-sky-800 ring-1 ring-sky-200"
              }`}
            >
              {departure}
            </span>
          </p>
        ) : null}
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold tabular-nums text-slate-900">
          {formatAltitude(flight.altitudeFt)}
        </p>
        <p className="text-xs tabular-nums text-slate-500">{formatClimb(flight.climbFpm)}</p>
      </div>
    </li>
  );
}

export function LiveFlights() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [data, setData] = useState<LiveTraffic | null>(null);
  const [failed, setFailed] = useState(false);
  const [fetchedAtMs, setFetchedAtMs] = useState<number | null>(null);
  // Seeded so "now" is never null in render; the clock effect keeps it ticking.
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [pageVisible, setPageVisible] = useState(true);
  const [sightings, setSightings] = useState<Map<string, FieldSighting>>(new Map());
  const [mosaic, setMosaic] = useState<TerrainMosaic | null>(null);
  const [mosaicFailed, setMosaicFailed] = useState(false);
  const [roads, setRoads] = useState<RoadLine[] | null>(null);

  // Foreground tabs poll; a background tab stops asking.
  useEffect(() => {
    const onVisibility = () => setPageVisible(document.visibilityState === "visible");
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const recordSightings = useCallback((flights: LiveFlight[], stored: Map<string, FieldSighting>) => {
    setSightings((previous) => {
      const now = Date.now();
      const next = new Map(previous);
      // A sighting remembered from an earlier visit still counts — a returning
      // visitor recognises flights that took off while the page was closed.
      for (const [id, sighting] of stored) {
        if (!next.has(id) && now - sighting.nearFieldMs < FIELD_MEMORY_MS) next.set(id, sighting);
      }
      for (const flight of flights) {
        // The clock restarts each time the aircraft is seen at the field again,
        // so "off 2G8" counts from its most recent visit, not its first.
        if (isAtField(flight)) next.set(flight.id, { nearFieldMs: now });
      }
      for (const [id, sighting] of next) {
        if (now - sighting.nearFieldMs > FIELD_MEMORY_MS) next.delete(id);
      }
      return next;
    });
  }, []);

  // The memories are written back only once the first load has merged what was
  // stored — before that, an empty map would erase them.
  const loadedRef = useRef(false);
  useEffect(() => {
    if (!loadedRef.current) return;
    try {
      window.localStorage.setItem(SIGHTINGS_KEY, JSON.stringify({ sightings: [...sightings] }));
    } catch {
      // storage full or disabled — evidence stays for this visit only
    }
  }, [sightings]);

  useEffect(() => {
    if (!pageVisible) return;
    let cancelled = false;
    const load = async () => {
      try {
        const next = (await fetchJson("/api/flights/live")) as LiveTraffic;
        if (cancelled) return;
        setData(next);
        setFetchedAtMs(Date.now());
        setFailed(false);
        loadedRef.current = true;
        recordSightings(next.flights, readStoredSightings());
      } catch {
        if (!cancelled) setFailed(true);
      }
    };
    load();
    const timer = window.setInterval(load, CLIENT_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [pageVisible, recordSightings]);

  // A slow clock for the age readouts between polls.
  useEffect(() => {
    const tick = () => setNowMs(Date.now());
    tick();
    const timer = window.setInterval(tick, 10_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchTerrainMosaic(TRAFFIC_BOUNDS, TERRAIN_ZOOM)
      .then((next) => {
        if (!cancelled) setMosaic(next);
      })
      .catch(() => {
        if (!cancelled) setMosaicFailed(true);
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

  // Contour lines never move — derive them once per mosaic.
  const contours = useMemo(
    () => (mosaic ? CONTOURS_M.map((levelM) => ({ segments: contourSegments(mosaic, levelM, 5) })) : []),
    [mosaic],
  );

  // The elevation at every canvas pixel — it depends only on the mosaic.
  const terrainGrid = useMemo(() => {
    if (!mosaic) return null;
    const { lonStep, latStep, west, north } = mosaic;
    const mx0 = (TRAFFIC_BOUNDS.west - west) / lonStep;
    const mxStep = LON_SPAN / (W - 1) / lonStep;
    const my0 = (north - TRAFFIC_BOUNDS.north) / latStep;
    const myStep = LAT_SPAN / (H - 1) / latStep;
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

  // Paint the shaded relief and the contours; the traffic itself is SVG on top.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mosaic || !terrainGrid) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const { lonStep, latStep, west, north } = mosaic;
    const mx0 = (TRAFFIC_BOUNDS.west - west) / lonStep;
    const mxStep = LON_SPAN / (W - 1) / lonStep;
    const my0 = (north - TRAFFIC_BOUNDS.north) / latStep;
    const myStep = LAT_SPAN / (H - 1) / latStep;
    const dxM = (LON_SPAN / (W - 1)) * METRES_PER_DEG_LON;
    const dyM = (LAT_SPAN / (H - 1)) * (KM_PER_DEG_LAT * 1000);
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
  }, [mosaic, terrainGrid, contours]);

  const flights = useMemo(() => data?.flights ?? [], [data]);
  const elapsedSec = fetchedAtMs !== null ? Math.max(0, (nowMs - fetchedAtMs) / 1000) : 0;

  /**
   * Where each callsign goes: every marker claims its square first (a label never
   * sits on another aircraft), then aircraft are labelled in list order — gliders
   * first — at the first of four candidate spots that clears everything already
   * down. A label with nowhere to go steps aside; the list still carries it.
   */
  const labelSpots = useMemo(() => {
    const claims: Rect[] = [];
    for (const flight of flights) {
      const cx = pxX(flight.lon);
      const cy = pxY(flight.lat);
      claims.push({ x1: cx - 7.5, y1: cy - 7.5, x2: cx + 7.5, y2: cy + 7.5 });
    }
    for (const place of PLACES) {
      claims.push(textBox(place.name, place.x + 8, place.y + 3.5, "start"));
    }
    claims.push(textBox("Gorham 2G8", FIELD_LABEL.x, FIELD_LABEL.y, "start"));

    const spots = new Map<string, LabelSpot>();
    for (const flight of flights) {
      const cx = pxX(flight.lon);
      const cy = pxY(flight.lat);
      const candidates: LabelSpot[] = [
        { x: cx + 10, y: cy - 6, anchor: "start" },
        { x: cx - 10, y: cy - 6, anchor: "end" },
        { x: cx + 10, y: cy + 17, anchor: "start" },
        { x: cx - 10, y: cy + 17, anchor: "end" },
      ];
      for (const candidate of candidates) {
        const spot = clampSpot(flight.ident, candidate);
        const box = textBox(flight.ident, spot.x, spot.y, spot.anchor);
        if (!overlaps(claims, box)) {
          spots.set(flight.id, spot);
          claims.push(box);
          break;
        }
      }
    }
    return spots;
  }, [flights]);

  /** The flights that decide whether the card exists at all. */
  const gorhamFlights = useMemo(
    () =>
      flights.filter(
        (flight) =>
          isAirborneGlider(flight) &&
          hasFieldEvidence(flight, sightings.get(flight.id), nowMs),
      ),
    [flights, sightings, nowMs],
  );

  // Shown only while a glider that departed Gorham is flying; the page around it
  // carries the archive either way.
  if (gorhamFlights.length === 0 || data === null) return null;

  const departureOf = (flight: LiveFlight): string | null => {
    // Low and close is "at the field"; anything else that was seen there is off it.
    if (isAtField(flight)) return "at the field";
    const sighting = sightings.get(flight.id);
    if (sighting === undefined) return null;
    return `off 2G8 · ${formatMinutes(nowMs - sighting.nearFieldMs)}`;
  };

  const sourceNote =
    data.sources.ogn && data.sources.adsb
      ? ""
      : data.sources.ogn
        ? " · ADS-B feed unavailable"
        : " · OGN feed unavailable";
  const summary = `${flights.length} airborne · ${
    elapsedSec < 5 ? "updated just now" : `updated ${formatAge(elapsedSec)} ago`
  }${failed ? " · reconnecting…" : sourceNote}`;

  return (
    <section aria-label="Live traffic around Gorham" className="pt-16 sm:pt-20">
      <Container width="5xl">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex items-center gap-2.5">
          <p className="font-display text-xs font-semibold uppercase tracking-[0.28em] text-sky-700">
            Airborne now
          </p>
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:animate-none" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
            </span>
            live
          </span>
        </div>
        <p className="text-xs text-slate-400 tabular-nums">{summary}</p>
      </div>

      <SectionNote>
        Who is flying around Gorham at this moment — gliders and tugs off the field through
        the Open Glider Network&rsquo;s FLARM receivers, everything else through ADS-B. Give
        it a minute: it refreshes itself.
      </SectionNote>

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div>
          <div
            className="relative overflow-hidden rounded-2xl ring-1 ring-slate-900/10"
            role="img"
            aria-label={`Live map of ${flights.length} aircraft around Gorham — the field, the LOA Glider Area circle, and each aircraft's last reported position`}
          >
            <canvas ref={canvasRef} width={W} height={H} className="block h-auto w-full" />
            <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" aria-hidden="true">
              {roads?.map((line, index) => (
                <g key={index}>
                  <polyline
                    points={line.p.map(([lon, lat]) => `${pxX(lon).toFixed(1)},${pxY(lat).toFixed(1)}`).join(" ")}
                    className={line.k === 2 ? "fill-none stroke-white/55" : "fill-none stroke-white/40"}
                    strokeWidth={line.k === 2 ? 2 : 1.5}
                    vectorEffect="non-scaling-stroke"
                  />
                  <polyline
                    points={line.p.map(([lon, lat]) => `${pxX(lon).toFixed(1)},${pxY(lat).toFixed(1)}`).join(" ")}
                    className={line.k === 2 ? "fill-none stroke-slate-500/55" : "fill-none stroke-slate-500/35"}
                    strokeWidth={0.8}
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              ))}

              <ellipse
                cx={GLIDER_PX.x}
                cy={GLIDER_PX.y}
                rx={GLIDER_RADIUS_PX}
                ry={GLIDER_RADIUS_PX}
                className="fill-none stroke-slate-900/40"
                strokeDasharray="8 6"
                strokeWidth={1.3}
                vectorEffect="non-scaling-stroke"
              />

              <ellipse
                cx={FIELD_PX.x}
                cy={FIELD_PX.y}
                rx={FIELD_RADIUS_PX}
                ry={FIELD_RADIUS_PX}
                className="fill-sky-600/5 stroke-sky-900/30"
                strokeDasharray="5 4"
                strokeWidth={1.2}
                vectorEffect="non-scaling-stroke"
              />
              <rect
                x={FIELD_PX.x - 4}
                y={FIELD_PX.y - 4}
                width={8}
                height={8}
                transform={`rotate(45 ${FIELD_PX.x} ${FIELD_PX.y})`}
                className="fill-slate-900 stroke-white"
                strokeWidth={1.4}
              />
              <text
                x={FIELD_LABEL.x}
                y={FIELD_LABEL.y}
                className="hidden fill-slate-900 text-[15px] font-semibold sm:inline"
                style={HALO}
              >
                Gorham 2G8
              </text>

              {PLACES.map((place) => (
                <g key={place.name}>
                  <circle
                    cx={place.x}
                    cy={place.y}
                    r={place.primary ? 3.5 : 3}
                    className={place.primary ? "fill-slate-900" : "fill-slate-700"}
                  />
                  <text
                    x={place.x + 8}
                    y={place.y + 3.5}
                    className={`hidden text-[13px] sm:inline ${place.primary ? "fill-slate-900 font-semibold" : "fill-slate-700"}`}
                    style={HALO}
                  >
                    {place.name}
                  </text>
                </g>
              ))}

              {flights.map((flight) => {
                const cx = pxX(flight.lon);
                const cy = pxY(flight.lat);
                const spot = labelSpots.get(flight.id);
                return (
                  <g key={flight.id}>
                    <g transform={`translate(${cx} ${cy}) rotate(${flight.trackDeg ?? 0})`}>
                      <path
                        d="M0,-9 L6.5,8 L0,4 L-6.5,8 Z"
                        fill={KIND_COLOR[flight.kind]}
                        stroke="#ffffff"
                        strokeWidth={1.8}
                        strokeLinejoin="round"
                      />
                    </g>
                    {spot ? (
                      <text
                        x={spot.x}
                        y={spot.y}
                        textAnchor={spot.anchor}
                        className="hidden fill-slate-800 text-[15px] font-semibold sm:inline"
                        style={HALO}
                      >
                        {flight.ident}
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </svg>
            {!mosaic && !mosaicFailed ? (
              <div className="absolute inset-0 animate-pulse bg-slate-100" aria-hidden="true" />
            ) : null}
            {mosaicFailed ? (
              <div className="absolute inset-0 grid place-items-center bg-slate-50 p-6">
                <p className="text-center text-sm text-slate-500">
                  The relief map did not load — the traffic list beside it still works.
                </p>
              </div>
            ) : null}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <ul className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-xs text-slate-500">
              {LEGEND_KINDS.map((kind) => (
                <li key={kind} className="flex items-center gap-1.5">
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: KIND_COLOR[kind] }}
                    aria-hidden="true"
                  />
                  {KIND_LABEL[kind]}
                </li>
              ))}
              <li className="flex items-center gap-1.5">
                <span className="size-2 rotate-45 bg-slate-900" aria-hidden="true" />
                2G8
              </li>
            </ul>
            <a
              href="https://live.glidernet.org/#c=44.33,-71.26&z=10"
              target="_blank"
              rel="noreferrer"
              className="text-xs font-medium text-sky-700 hover:text-sky-600"
            >
              Full OGN map ↗
            </a>
          </div>
        </div>

        <div className="flex min-h-0 flex-col">
          <ul className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto pr-1 max-h-[440px] lg:max-h-[604px]">
            {flights.map((flight) => (
              <FlightRow
                key={flight.id}
                flight={flight}
                departure={departureOf(flight)}
                ageSec={flight.ageSec + elapsedSec}
              />
            ))}
          </ul>
        </div>
      </div>

      <p className="mt-4 text-[11px] leading-5 text-slate-400">
        Positions are the networks&rsquo; last fix — usually seconds old, sometimes a few
        minutes. Gliders and tugs come from the{" "}
        <a
          href="https://wiki.glidernet.org/"
          target="_blank"
          rel="noreferrer"
          className="font-medium text-slate-500 hover:text-sky-700"
        >
          Open Glider Network
        </a>{" "}
        (FLARM/OGN); everything else from{" "}
        <a
          href="https://adsb.lol"
          target="_blank"
          rel="noreferrer"
          className="font-medium text-slate-500 hover:text-sky-700"
        >
          adsb.lol
        </a>{" "}
        (ADS-B). The small dashed ring is three miles around 2G8; the large one is the
        LOA&rsquo;s 10 NM Mount Washington Glider Area. &ldquo;Off 2G8&rdquo; means the
        page watched the aircraft leave the field during this visit — and the tracker
        shows itself only while a flight like that is up. Not a traffic or flight-planning
        service — look outside, and call the field.
      </p>
        </div>
      </Container>
    </section>
  );
}
