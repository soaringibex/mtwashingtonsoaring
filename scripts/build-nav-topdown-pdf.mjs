#!/usr/bin/env node
/**
 * Build the printable top-down chart — public/files/gorham-range-rings.pdf —
 * a 1:450,000 full-bleed tabloid (17 x 11 in) sheet of the wave country, turned
 * so the exchange's Moosilauke–Sugarloaf AP line runs straight across it as it
 * is flown (Moosilauke left, Sugarloaf right). Range rings every 5 NM around Gorham (2G8), a
 * graticule, the rivers and lakes, the exchange's turnpoints and the landmark
 * labels. Each ring is labelled with the altitude a 25:1 glide in still air
 * needs at that distance to arrive at the field with 1,000 ft to spare:
 * required MSL = field elevation (837 ft) + 1,000 ft + the ring's distance / 25.
 *
 * Same machinery as scripts/build-nav-3d-map.mjs: AWS Terrain Tiles (Terrarium,
 * cache shared in .screenshots/nav3d/tiles), a harneess page rendered in headless
 * Chrome, and CDP — but the output is Page.printToPDF rather than a screenshot.
 * The terrain is a raster; everything else (rings, water, labels, panel) is
 * vector, so the print stays crisp.
 *
 * Water: © OpenStreetMap contributors (ODbL), fetched once via Overpass and
 * cached under .screenshots/navtop so re-runs skip the network.
 *
 * Run from the repo root:  node scripts/build-nav-topdown-pdf.mjs
 * Tune:  NAV3D_DEBUG=1 NAV3D_PREVIEW_ONLY=1 node scripts/build-nav-topdown-pdf.mjs
 */
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdirSync, existsSync, writeFileSync, readFileSync, statSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SCRATCH = join(ROOT, ".screenshots", "navtop");
const TILE_DIR = join(ROOT, ".screenshots", "terrain-tiles");
const OUT_PDF = join(ROOT, "public", "files", "gorham-range-rings.pdf");
const OUT_PREVIEW = join(SCRATCH, "preview.png");

const TILE_HOST = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium";
const ZOOM = 12;
const TILE_SIZE = 256;

/** The rings stay centred on the field — Gorham 2G8. */
const CENTER = { lat: 44.39472, lon: -71.19805 };
const PAPER_IN = { width: 17, height: 11 };
const DPI = 300;
const PX_PER_MM = DPI / 25.4;
const MAP_W_MM = PAPER_IN.width * 25.4;
const MAP_H_MM = PAPER_IN.height * 25.4;
const CANVAS_W = Math.round(MAP_W_MM * PX_PER_MM);
const CANVAS_H = Math.round(MAP_H_MM * PX_PER_MM);
/** 1 mm of paper over 450 m of ground = 1:450,000. */
const M_PER_MM = 450;

/**
 * The sheet is turned so the exchange's Moosilauke–Sugarloaf line runs straight
 * across it, the way it is flown: Moosilauke at the left end, Sugarloaf AP at
 * the right, screen right along the corridor (≈047°) and screen up ≈317°. The
 * sheet centres on the route's midpoint, which leaves the field just left of
 * centre and both anchors inside the edges.
 */
const ROUTE = {
  from: { lat: 44.02388, lon: -71.83055 }, // Moosilauke (MOOSILAK)
  to: { lat: 45.08528, lon: -70.21638 }, // Sugarloaf AP (B21, Carrabassett Valley ME)
};

const RINGS_NM = [5, 10, 15, 20, 25];
const GRATICULE_DEG = 0.25;
const M_PER_NM = 1852;

/** Cartographic light, from the site's relief convention: northwest, 45°. */
const LIGHT = { east: -0.5, north: 0.5, up: Math.SQRT1_2 };
const RAMP = [[150,[52,76,60]],[400,[84,108,74]],[650,[122,132,88]],[900,[160,148,108]],[1150,[172,146,116]],[1400,[166,162,164]],[1650,[210,210,212]],[1950,[238,239,242]]]; // src/lib/relief.ts

/**
 * Labels for the sheet. Offsets are millimetres from the anchor (y down), tuned
 * against the render; `kind` picks the glyph and type style.
 */
/**
 * Labels for the sheet. `tx`/`ty` are the text anchor in millimetres east/north of
 * the map centre — placed against the render, with leaders fanning into the crowded
 * Presidential cluster.
 */
const LABELS = [
  { name: "Mount Washington", kind: "summit", lat: 44.27049, lon: -71.3033, tx: -50, ty: -30, align: "right" },
  { name: "Mount Jefferson", kind: "summit", lat: 44.30423, lon: -71.31675, tx: -42, ty: -23, align: "right" },
  { name: "Mount Adams", kind: "summit", lat: 44.32058, lon: -71.29164, tx: -34, ty: -16.5, align: "right" },
  { name: "Mount Madison", kind: "summit", lat: 44.32879, lon: -71.27667, tx: -22, ty: -10.5, align: "right" },
  { name: "Tuckerman's Ravine", kind: "area", lat: 44.2605, lon: -71.292, tx: -42, ty: -42, align: "right" },
  { name: "Wildcat Mountain", kind: "summit", lat: 44.2592, lon: -71.20161, tx: -20, ty: -38, align: "right" },
  { name: "The Glen House", kind: "place", lat: 44.29093, lon: -71.22559, tx: -12, ty: -33, align: "right" },
  { name: "Huntington Ravine", kind: "area", lat: 44.2745, lon: -71.2805, tx: 2, ty: -33, align: "left" },
  { name: "Carter Dome", kind: "summit", lat: 44.2674, lon: -71.17912, tx: 14, ty: -27, align: "left" },
  { name: "The Horn", kind: "summit", lat: 44.29483, lon: -71.279, tx: 16, ty: -19, align: "left" },
  { name: "The Great Gulf", kind: "area", lat: 44.2975, lon: -71.3095, tx: -14, ty: -27.5, align: "right", alpha: 0.9 },
  { name: "Mount Moriah", kind: "summit", lat: 44.34053, lon: -71.13172, tx: 16, ty: -12, align: "left" },
  { name: "Pine Mountain", kind: "summit", lat: 44.36588, lon: -71.21519, tx: 3, ty: -7, align: "left" },
  { name: "Gorham 2G8", kind: "field", lat: 44.39472, lon: -71.19805, tx: -3, ty: 2.5, align: "right" },
  { name: "Mount Hayes", kind: "summit", lat: 44.41566, lon: -71.15986, tx: 12, ty: 6, align: "left" },
  { name: "Crescent Range", kind: "range", lat: 44.438, lon: -71.302, tx: -32, ty: 12, align: "center" },
  { name: "Pilot Range", kind: "range", lat: 44.5285, lon: -71.4185, tx: -35, ty: 26.5, align: "center" },
  { name: "Carter-Moriah Range", kind: "range", lat: 44.245, lon: -71.155, tx: 20, ty: -38, align: "left" },
  { name: "Old Speck Mountain", kind: "summit", lat: 44.57083, lon: -70.95445, tx: 52, ty: 47, align: "left" },
  { name: "Bald Pate Mountain", kind: "summit", lat: 44.60833, lon: -70.89445, tx: 63, ty: 61, align: "left" },
  { name: "Moosilauke", kind: "summit", lat: 44.02388, lon: -71.83055, tx: -141, ty: -8, align: "left" },
  { name: "Sugarloaf AP", kind: "place", lat: 45.08528, lon: -70.21638, tx: 240, ty: -8, align: "right" },
];

const TOWNS = [
  { name: "Gorham", lat: 44.3878, lon: -71.1729, dx: 2.2, dy: 2.2, align: "left" },
  { name: "Berlin", lat: 44.4687, lon: -71.1851, dx: 2.2, dy: 2.2, align: "left" },
  { name: "Lancaster", lat: 44.4889, lon: -71.5692, dx: 2.2, dy: 2.2, align: "left" },
  { name: "Whitefield", lat: 44.3675, lon: -71.55, dx: 2.2, dy: 2.2, align: "left" },
  { name: "Twin Mountain", lat: 44.2642, lon: -71.5467, dx: -2.4, dy: -2.4, align: "right" },
  { name: "Jackson", lat: 44.1567, lon: -71.1817, dx: 2.2, dy: 2.2, align: "left" },
  { name: "Glen", lat: 44.1058, lon: -71.1861, dx: 2.2, dy: 2.2, align: "left" },
  { name: "North Conway", lat: 44.0537, lon: -71.1284, dx: 2.2, dy: 2.2, align: "left" },
  { name: "Fryeburg", lat: 44.0164, lon: -70.9753, dx: 2.2, dy: 2.2, align: "left" },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const lonToTileX = (lon, z) => ((lon + 180) / 360) * 2 ** z;
const latToTileY = (lat, z) => {
  const rad = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z;
};
const tileXToLon = (x, z) => (x / 2 ** z) * 360 - 180;
const tileYToLat = (y, z) => {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z;
  return (180 / Math.PI) * Math.atan(Math.sinh(n));
};

const M_PER_LAT = 111194.93;
const M_PER_LON = M_PER_LAT * Math.cos((CENTER.lat * Math.PI) / 180);

const headOut = (a, b) => {
  const east = (b.lon - a.lon) * M_PER_LON;
  const north = (b.lat - a.lat) * M_PER_LAT;
  const len = Math.hypot(east, north) || 1;
  return {
    east: east / len,
    north: north / len,
    bearing: ((Math.atan2(east, north) * 180) / Math.PI + 360) % 360,
  };
};
/** Screen-right = Sugarbush → Moosilauke; screen-up is 90° counter-clockwise of it. */
const ER = headOut(ROUTE.from, ROUTE.to);
const UP = { east: -ER.north, north: ER.east };
const PX_PER_M = PX_PER_MM / M_PER_MM;
const HALF_W_M = CANVAS_W / 2 / PX_PER_M;
const HALF_H_M = CANVAS_H / 2 / PX_PER_M;

const project = (lat, lon) => {
  const east = (lon - CENTER.lon) * M_PER_LON;
  const north = (lat - CENTER.lat) * M_PER_LAT;
  return [east * ER.east + north * ER.north, east * UP.east + north * UP.north];
};
/** The sheet centre, in field-relative (along, across) metres: the route's midpoint. */
const SHEET_C = (() => {
  const [u, v] = project((ROUTE.from.lat + ROUTE.to.lat) / 2, (ROUTE.from.lon + ROUTE.to.lon) / 2);
  return { u, v };
})();
const routeKm = Math.hypot(
  (ROUTE.to.lon - ROUTE.from.lon) * M_PER_LON,
  (ROUTE.to.lat - ROUTE.from.lat) * M_PER_LAT,
) / 1000;
const unprojectAt = (u, v) => {
  const east = u * ER.east + v * UP.east;
  const north = u * ER.north + v * UP.north;
  return { lat: CENTER.lat + north / M_PER_LAT, lon: CENTER.lon + east / M_PER_LON };
};
const boxCorners = [
  unprojectAt(SHEET_C.u - HALF_W_M, SHEET_C.v - HALF_H_M),
  unprojectAt(SHEET_C.u + HALF_W_M, SHEET_C.v - HALF_H_M),
  unprojectAt(SHEET_C.u - HALF_W_M, SHEET_C.v + HALF_H_M),
  unprojectAt(SHEET_C.u + HALF_W_M, SHEET_C.v + HALF_H_M),
];
const BOUNDS = {
  south: Math.min(...boxCorners.map((c) => c.lat)) - 0.03,
  north: Math.max(...boxCorners.map((c) => c.lat)) + 0.03,
  west: Math.min(...boxCorners.map((c) => c.lon)) - 0.03,
  east: Math.max(...boxCorners.map((c) => c.lon)) + 0.03,
};
console.log(`sheet: Moosilauke–Sugarloaf AP ${routeKm.toFixed(0)} km, screen-right ${ER.bearing.toFixed(1)}°, covers ${BOUNDS.west.toFixed(2)}..${BOUNDS.east.toFixed(2)} lon, ${BOUNDS.south.toFixed(2)}..${BOUNDS.north.toFixed(2)} lat`);

/* ---------------------------------- tiles ---------------------------------- */

async function fetchTile(z, x, y) {
  const file = join(TILE_DIR, String(z), String(x), `${y}.png`);
  if (existsSync(file) && statSync(file).size > 0) return file;
  mkdirSync(dirname(file), { recursive: true });
  const response = await fetch(`${TILE_HOST}/${z}/${x}/${y}.png`);
  if (!response.ok) throw new Error(`tile ${z}/${x}/${y}: ${response.status}`);
  writeFileSync(file, Buffer.from(await response.arrayBuffer()));
  return file;
}

async function buildDem() {
  const x0 = Math.floor(lonToTileX(BOUNDS.west, ZOOM));
  const x1 = Math.floor(lonToTileX(BOUNDS.east, ZOOM));
  const y0 = Math.floor(latToTileY(BOUNDS.north, ZOOM));
  const y1 = Math.floor(latToTileY(BOUNDS.south, ZOOM));
  const cols = x1 - x0 + 1;
  const rows = y1 - y0 + 1;
  const width = cols * TILE_SIZE;
  const height = rows * TILE_SIZE;
  const elevations = new Float32Array(width * height);

  process.stdout.write(`tiles: z${ZOOM} ${cols}x${rows} (${cols * rows}) … `);
  let done = 0;
  for (let ty = 0; ty < rows; ty += 1) {
    const row = await Promise.all(
      Array.from({ length: cols }, (_, tx) => fetchTile(ZOOM, x0 + tx, y0 + ty)),
    );
    for (let tx = 0; tx < cols; tx += 1) {
      const { data, info } = await sharp(row[tx]).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      for (let py = 0; py < TILE_SIZE; py += 1) {
        const dst = (ty * TILE_SIZE + py) * width + tx * TILE_SIZE;
        const src = py * info.width * info.channels;
        for (let px = 0; px < TILE_SIZE; px += 1) {
          const o = src + px * info.channels;
          elevations[dst + px] = data[o] * 256 + data[o + 1] + data[o + 2] / 256 - 32768;
        }
      }
    }
    done += cols;
    if ((ty + 1) % 2 === 0 || ty + 1 === rows) process.stdout.write(`\r  ${done}/${cols * rows} tiles …`);
  }
  process.stdout.write("\n");

  const north = tileYToLat(y0, ZOOM);
  const meta = {
    width,
    height,
    west: tileXToLon(x0, ZOOM),
    north,
    lonStep: 360 / 2 ** ZOOM / TILE_SIZE,
    latStep: (north - tileYToLat(y0 + 1, ZOOM)) / TILE_SIZE,
  };
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, "dem.bin"), Buffer.from(elevations.buffer));
  writeFileSync(join(SCRATCH, "dem.json"), JSON.stringify(meta));
  console.log(`dem: ${width}x${height}px, ${(meta.lonStep * M_PER_LON).toFixed(1)}m/px`);
  return meta;
}

/* ---------------------------------- water ---------------------------------- */

async function buildWater() {
  const cache = join(SCRATCH, `water-${BOUNDS.west.toFixed(2)}_${BOUNDS.south.toFixed(2)}_${BOUNDS.east.toFixed(2)}.json`);
  if (!existsSync(cache)) {
    console.log("fetching water from Overpass …");
    const query = `[out:json][timeout:120];
      (way["waterway"="river"](${BOUNDS.south},${BOUNDS.west},${BOUNDS.north},${BOUNDS.east});
       way["natural"="water"]["name"](${BOUNDS.south},${BOUNDS.west},${BOUNDS.north},${BOUNDS.east});
       relation["natural"="water"]["name"](${BOUNDS.south},${BOUNDS.west},${BOUNDS.north},${BOUNDS.east}););
      out geom;`;
    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: query,
      headers: { "User-Agent": "mtwashingtonsoaring-site/1.0 (gorham chart)" },
    });
    if (!response.ok) throw new Error(`overpass ${response.status}`);
    writeFileSync(cache, Buffer.from(await response.arrayBuffer()));
  }
  const raw = JSON.parse(readFileSync(cache, "utf8"));
  const rivers = [];
  const lakes = [];
  const inBox = (p) =>
    p.lat >= BOUNDS.south - 0.01 && p.lat <= BOUNDS.north + 0.01 &&
    p.lon >= BOUNDS.west - 0.01 && p.lon <= BOUNDS.east + 0.01;

  const addWay = (element, asLake) => {
    const geometry = element.geometry?.filter(Boolean);
    if (!geometry || geometry.length < 2) return;
    // Trim to the chart's neighbourhood and thin the point spacing.
    const points = [];
    for (const p of geometry) {
      if (points.length === 0 || Math.abs(p.lat - points[points.length - 1].lat) + Math.abs(p.lon - points[points.length - 1].lon) > 0.0006) {
        points.push({ lat: p.lat, lon: p.lon });
      }
    }
    if (!points.some(inBox)) return;
    if (asLake) {
      const lats = points.map((p) => p.lat);
      const lons = points.map((p) => p.lon);
      const spanM = Math.hypot(
        (Math.max(...lats) - Math.min(...lats)) * M_PER_LAT,
        (Math.max(...lons) - Math.min(...lons)) * M_PER_LON,
      );
      if (spanM < 1600) return; // Maine has thousands of pondlets; only the lakes orient
      lakes.push(points);
    } else {
      rivers.push(points);
    }
  };

  const wayMembers = new Set();
  for (const element of raw.elements) {
    if (element.type === "way") {
      if (element.tags?.waterway === "river") addWay(element, false);
      else if (element.tags?.natural === "water") addWay(element, true);
    } else if (element.type === "relation") {
      for (const member of element.members ?? []) {
        if (member.type === "way" && member.geometry) wayMembers.add(member);
      }
    }
  }
  // Relation members (the big lakes) rarely carry tags of their own — draw each
  // member's geometry as a shoreline; closed rings fill, open arcs stroke.
  for (const member of wayMembers) {
    const geometry = member.geometry?.filter(Boolean);
    if (!geometry || geometry.length < 3) continue;
    if (!geometry.some(inBox)) continue;
    const points = [];
    for (const p of geometry) {
      if (points.length === 0 || Math.abs(p.lat - points[points.length - 1].lat) + Math.abs(p.lon - points[points.length - 1].lon) > 0.0006) {
        points.push({ lat: p.lat, lon: p.lon });
      }
    }
    if (points.length < 3) continue;
    const closed =
      Math.abs(points[0].lat - points[points.length - 1].lat) < 1e-6 &&
      Math.abs(points[0].lon - points[points.length - 1].lon) < 1e-6;
    if (closed) {
      const lats = points.map((p) => p.lat);
      const lons = points.map((p) => p.lon);
      const spanM = Math.hypot(
        (Math.max(...lats) - Math.min(...lats)) * M_PER_LAT,
        (Math.max(...lons) - Math.min(...lons)) * M_PER_LON,
      );
      if (spanM < 1600) continue;
    }
    lakes.push({ points, closed });
  }
  console.log(`water: ${rivers.length} rivers, ${lakes.length} lake shapes`);
  return { rivers, lakes };
}

/* -------------------------------- waypoints --------------------------------- */

/**
 * The turnpoints the exchange publishes for Gorham (soaringweb.org/TP/Gorham) —
 * discovered from its files page and cached whole; the sheet draws every one that
 * falls inside its edges as a small diamond, names suppressed where the chart's own
 * labels already stand on the spot.
 */
const WAYPOINT_SKIP = new Set([
  "Pine Mountain", "The Horn", "Wildcat Mountain", "Bald Pate Mountain",
  "Old Speck Mountain", "Glen", "Jackson", "North Conway", "North Conway 1",
  "North Conway 2", "Twin Mountain", "Whitefield", "Fryeburg", "Gorham",
  "Moosilauke", "Sugarloaf AP",
]);
const WAYPOINT_RENAME = { Berlin: "Berlin (BML)" };
/** Where the default "name to the right of the dot" crowds a neighbour. */
const WAYPOINT_POS = {
  "Mount Washington Observatory": { side: "left", dy: 0.4 },
  "Mount Washington Hotel": { side: "right", dy: 6.5 },
};

async function buildWaypoints() {
  const cache = join(SCRATCH, "gorham.cup");
  if (!existsSync(cache)) {
    console.log("fetching the exchange's turnpoints …");
    const headers = {
      "User-Agent": "mtwashingtonsoaring-site/1.0 (gorham chart)",
      Referer: "https://soaringweb.org/TP/Gorham/files.html",
    };
    const files = await fetch("https://soaringweb.org/TP/Gorham/files.html", { headers });
    if (!files.ok) throw new Error(`exchange files page: ${files.status}`);
    const links = [...(await files.text()).matchAll(/href="([^"]+\.cup)"/gi)].map((m) => m[1]);
    if (!links.length) throw new Error("no .cup link on the exchange page");
    const cup = await fetch(new URL(links[0], "https://soaringweb.org/TP/Gorham/"), { headers });
    if (!cup.ok) throw new Error(`turnpoint file: ${cup.status}`);
    writeFileSync(cache, Buffer.from(await cup.arrayBuffer()));
  }

  const parseLat = (value) => Number(value.slice(0, 2)) + Number(value.slice(2, -1)) / 60;
  const parseLon = (value) => {
    const v = Number(value.slice(0, 3)) + Number(value.slice(3, -1)) / 60;
    return /[WS]$/i.test(value) ? -v : v;
  };
  const waypoints = [];
  for (const line of readFileSync(cache, "latin1").split(/\r?\n/).slice(1)) {
    const columns = line.match(/("([^"]*)"|[^,]*)(,|$)/g)?.map((c) => c.replace(/,$/, "").replace(/^"|"$/g, ""));
    if (!columns || columns.length < 5) continue;
    const [name, code, , rawLat, rawLon, elevation] = columns;
    if (!rawLat || !rawLon) continue;
    const lat = parseLat(rawLat);
    const lon = parseLon(rawLon);
    waypoints.push({
      name: WAYPOINT_RENAME[name] ?? name,
      code,
      lat,
      lon,
      elevation: elevation ?? "",
      skip: WAYPOINT_SKIP.has(name),
      ...(() => {
        const [u, v] = project(lat, lon);
        return {
          chart:
            Math.abs(u - SHEET_C.u) <= HALF_W_M + 4000 &&
            Math.abs(v - SHEET_C.v) <= HALF_H_M + 4000,
        };
      })(),
    });
  }
  console.log(`waypoints: ${waypoints.length} in the file, ${waypoints.filter((w) => w.chart).length} on the sheet`);
  return waypoints.filter((w) => w.chart);
}

/* --------------------------------- harness ---------------------------------- */

function harnessHtml(meta, water, waypoints) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Gorham (2G8) range rings — Mount Washington wave camp</title>
<style>
  @page { size: 17in 11in; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { width: 17in; height: 11in; position: relative; overflow: hidden;
         font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; color: #0f172a; }
  .map { position: absolute; inset: 0; }
  .map canvas, .map svg { position: absolute; inset: 0; width: 100%; height: 100%; }
</style></head>
<body>
<div class="map"><canvas id="c" width="${CANVAS_W}" height="${CANVAS_H}"></canvas><svg id="o" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}"></svg></div>
<script>
const META = ${JSON.stringify(meta)};
const WATER = ${JSON.stringify(water)};
const RINGS_NM = ${JSON.stringify(RINGS_NM)};
const GRATICULE_DEG = ${JSON.stringify(GRATICULE_DEG)};
const LABELS = ${JSON.stringify(LABELS)};
const TOWNS = ${JSON.stringify(TOWNS)};
const WAYPOINTS = ${JSON.stringify(waypoints)};
const WAYPOINT_POS = ${JSON.stringify(WAYPOINT_POS)};
const CENTER = ${JSON.stringify(CENTER)};
const CANVAS_W = ${CANVAS_W};
const CANVAS_H = ${CANVAS_H};
const PX_PER_MM = ${PX_PER_MM};
const M_PER_MM = ${M_PER_MM};
const M_PER_NM = ${M_PER_NM};
const M_PER_LAT = ${M_PER_LAT};
const M_PER_LON = ${M_PER_LON};
const LIGHT = ${JSON.stringify(LIGHT)};
const RAMP = ${JSON.stringify(RAMP)};
const DEBUG = ${process.env.NAV3D_DEBUG ? "true" : "false"};
const WATER_INK = "#79aed6";
const ER = ${JSON.stringify(ER)};
const UP = ${JSON.stringify(UP)};
const SHEET_C = ${JSON.stringify(SHEET_C)};
const BOUNDS = ${JSON.stringify(BOUNDS)};

function reliefColour(elevationM, shade) {
  const low = RAMP[0], high = RAMP[RAMP.length - 1];
  const e = Math.min(Math.max(elevationM, low[0]), high[0]);
  let lower = low, upper = high;
  for (let i = 0; i < RAMP.length - 1; i += 1) {
    if (e >= RAMP[i][0] && e <= RAMP[i + 1][0]) { lower = RAMP[i]; upper = RAMP[i + 1]; break; }
  }
  const t = (e - lower[0]) / (upper[0] - lower[0] || 1);
  const f = Math.min(Math.max(0.42 + 1.15 * shade, 0.3), 1.45);
  return [(lower[1][0] + (upper[1][0] - lower[1][0]) * t) * f,
          (lower[1][1] + (upper[1][1] - lower[1][1]) * t) * f,
          (lower[1][2] + (upper[1][2] - lower[1][2]) * t) * f];
}

async function main() {
  const dem = new Float32Array(await (await fetch("dem.bin")).arrayBuffer());
  const { width: W, height: H, west, north: demNorth, lonStep, latStep } = META;
  const pxPerM = PX_PER_MM / M_PER_MM;
  const project = (lat, lon) => {
    const east = (lon - CENTER.lon) * M_PER_LON;
    const north = (lat - CENTER.lat) * M_PER_LAT;
    return [east * ER.east + north * ER.north, east * UP.east + north * UP.north];
  };
  const pxOf = (lat, lon) => {
    const [u, v] = project(lat, lon);
    return [CANVAS_W / 2 + (u - SHEET_C.u) * pxPerM, CANVAS_H / 2 - (v - SHEET_C.v) * pxPerM];
  };
  const hAt = (mx, my) => {
    const fx = Math.min(Math.max(mx, 0), W - 1.001), fy = Math.min(Math.max(my, 0), H - 1.001);
    const ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
    const i = iy * W + ix;
    return dem[i] * (1 - tx) * (1 - ty) + dem[i + 1] * tx * (1 - ty) +
           dem[i + W] * (1 - tx) * ty + dem[i + W + 1] * tx * ty;
  };

  // Terrain raster: eached canvas pixel is one ground sample, hillshaded north-west.
  const canvas = document.getElementById("c");
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(CANVAS_W, CANVAS_H);
  const data = img.data;
  const demPerPxX = M_PER_LON * lonStep; // metres to the DEM pixel, each axis
  const demPerPxY = M_PER_LAT * latStep;
  let idx = 0;
  for (let y = 0; y < CANVAS_H; y += 1) {
    for (let x = 0; x < CANVAS_W; x += 1) {
      const u = (x - CANVAS_W / 2) / pxPerM + SHEET_C.u;
      const v = -(y - CANVAS_H / 2) / pxPerM + SHEET_C.v;
      const east = u * ER.east + v * UP.east;
      const nn = u * ER.north + v * UP.north;
      const my = (demNorth - (CENTER.lat + nn / M_PER_LAT)) / latStep;
      const mx = (CENTER.lon + east / M_PER_LON - west) / lonStep;
      const h = hAt(mx, my);
      const hx = (hAt(mx + 0.75, my) - hAt(mx - 0.75, my)) / (1.5 * demPerPxX);
      const hy = (hAt(mx, my + 0.75) - hAt(mx, my - 0.75)) / (1.5 * demPerPxY);
      let nx = -hx, ny = hy, nz = 1;
      const nl = Math.hypot(nx, ny, nz);
      nx /= nl; ny /= nl; nz /= nl;
      const shade = Math.min(Math.max(nx * LIGHT.east + ny * LIGHT.north + nz * LIGHT.up, 0), 1);
      const c = reliefColour(h, shade);
      data[idx] = c[0]; data[idx + 1] = c[1]; data[idx + 2] = c[2]; data[idx + 3] = 255;
      idx += 4;
    }
  }
  ctx.putImageData(img, 0, 0);
  // Swap the canvas for a JPEG-backed image: printToPDF embeds JPEGs as-is, where
  // a live canvas would be rasterised losslessly and blow the file up tenfold.
  await new Promise((resolve) => {
    const jpeg = new Image();
    jpeg.onload = () => {
      const holder = canvas.parentNode;
      holder.removeChild(canvas);
      jpeg.id = "c";
      jpeg.style.position = "absolute";
      jpeg.style.inset = "0";
      jpeg.style.width = "100%";
      jpeg.style.height = "100%";
      holder.prepend(jpeg);
      resolve();
    };
    jpeg.src = canvas.toDataURL("image/jpeg", 0.84);
  });

  // --------------------------------- vector ----------------------------------
  const svg = document.getElementById("o");
  const NS = "http://www.w3.org/2000/svg";
  const el = (name, attrs, parent = svg) => {
    const node = document.createElementNS(NS, name);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    parent.appendChild(node);
    return node;
  };
  const text = (str, x, y, opts = {}) => {
    const node = el("text", {
      x: x.toFixed(1), y: y.toFixed(1),
      "text-anchor": opts.anchor === "right" ? "end" : opts.anchor === "center" ? "middle" : "start",
      "dominant-baseline": "middle",
      "font-family": opts.font ?? '"Helvetica Neue", Helvetica, Arial, sans-serif',
      "font-size": opts.size ?? 36,
      "font-weight": opts.weight ?? 600,
      "font-style": opts.italic ? "italic" : "normal",
      fill: opts.fill ?? "#0f172a",
      stroke: opts.halo === false ? "none" : "rgba(255,255,255,0.92)",
      "stroke-width": opts.haloWidth ?? (opts.size ?? 36) * 0.24,
      "paint-order": "stroke",
      "stroke-linejoin": "round",
      "letter-spacing": opts.spacing ?? "0",
    });
    node.textContent = str;
    return node;
  };
  const line = (x1, y1, x2, y2, opts = {}) =>
    el("line", { x1: x1.toFixed(1), y1: y1.toFixed(1), x2: x2.toFixed(1), y2: y2.toFixed(1),
                 stroke: opts.stroke ?? "#334155", "stroke-width": opts.width ?? 2,
                 "stroke-opacity": opts.opacity ?? 1, "stroke-dasharray": opts.dash ?? "none",
                 "stroke-linecap": "round" });
  const pathOf = (points, close) =>
    points.map((p, i) => (i === 0 ? "M" : "L") + pxOf(p.lat, p.lon).map((n) => n.toFixed(1)).join(" ")).join(" ") + (close ? " Z" : "");

  // Water: over the terrain, under everything else.
  for (const lake of WATER.lakes) {
    const shape = Array.isArray(lake) ? { points: lake, closed: true } : lake;
    el("path", { d: pathOf(shape.points, shape.closed), fill: shape.closed ? WATER_INK : "none",
                 "fill-opacity": 0.75, stroke: WATER_INK, "stroke-width": shape.closed ? 1.5 : 5,
                 "stroke-opacity": shape.closed ? 0.9 : 0.55, "stroke-linejoin": "round" });
  }
  for (const river of WATER.rivers) {
    el("path", { d: pathOf(river, false), fill: "none", stroke: WATER_INK, "stroke-width": 4.5,
                 "stroke-opacity": 0.85, "stroke-linecap": "round" });
  }

  // Graticule, every quarter degree. The sheet is turned, so each line is drawn as
  // a sampled polyline, labelled where it meets the sheet's left or top edge.
  const inSheet = (x, y) => x > -80 && x < CANVAS_W + 80 && y > -80 && y < CANVAS_H + 80;
  const strokeGraticule = (samples, style) => {
    let run = [];
    const flush = () => {
      if (run.length > 1) {
        const d = run.map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
        el("path", { d, fill: "none", stroke: style.stroke, "stroke-width": style.width, "stroke-opacity": style.opacity });
      }
      run = [];
    };
    for (const p of samples) (p && inSheet(p[0], p[1]) ? run.push(p) : flush());
    flush();
  };
  const latMinG = Math.ceil(BOUNDS.south / GRATICULE_DEG) * GRATICULE_DEG;
  const lonMinG = Math.ceil(BOUNDS.west / GRATICULE_DEG) * GRATICULE_DEG;
  for (let lat = latMinG; lat <= BOUNDS.north; lat += GRATICULE_DEG) {
    const samples = [];
    for (let lon = BOUNDS.west; lon <= BOUNDS.east; lon += 0.005) samples.push(pxOf(lat, lon));
    strokeGraticule(samples, { stroke: "#475569", width: 1.4, opacity: 0.28 });
    let best = null;
    for (const p of samples) {
      if (!p || p[1] < 34 || p[1] > CANVAS_H - 34) continue;
      const d = Math.abs(p[0] - 44);
      if (!best || d < best.d) best = { d, p };
    }
    if (best) {
      const deg = Math.floor(lat), min = Math.round((lat - deg) * 60);
      text(deg + "°" + String(min).padStart(2, "0") + "′", 18, best.p[1] - 20, { size: 34, weight: 500, fill: "#334155", haloWidth: 8 });
    }
  }
  for (let lon = lonMinG; lon <= BOUNDS.east; lon += GRATICULE_DEG) {
    const samples = [];
    for (let lat = BOUNDS.south; lat <= BOUNDS.north; lat += 0.005) samples.push(pxOf(lat, lon));
    strokeGraticule(samples, { stroke: "#475569", width: 1.4, opacity: 0.28 });
    let best = null;
    for (const p of samples) {
      if (!p || p[0] < 34 || p[0] > CANVAS_W - 34) continue;
      const d = Math.abs(p[1] - 44);
      if (!best || d < best.d) best = { d, p };
    }
    if (best) {
      const deg = Math.floor(-lon), min = Math.round((-lon - deg) * 60);
      text(deg + "°" + String(min).padStart(2, "0") + "′W", best.p[0] + 18, 32, { size: 34, weight: 500, fill: "#334155", haloWidth: 8 });
    }
  }

  // Range rings: centred on the field, every 5 NM, cased so they read over terrain.
  const [cx, cy] = pxOf(CENTER.lat, CENTER.lon);
  for (const nm of RINGS_NM) {
    const r = (nm * M_PER_NM) * pxPerM;
    el("circle", { cx, cy, r, fill: "none", stroke: "rgba(255,255,255,0.85)", "stroke-width": 7 });
    el("circle", { cx, cy, r, fill: "none", stroke: "#1e293b", "stroke-width": 2.4, "stroke-opacity": 0.85 });
    // Labels just inside each ring — eastwards in the empty Maine woods for the
    // inner rings, west of the field for the outermost (the east side runs out).
    // Two stacked lines: the distance, and the 25:1 glide altitude it demands,
    // to the nearest 50 ft.
    const needFt = Math.round((1837 + (nm * 6076.12) / 25) / 50) * 50;
    const needLabel = needFt.toLocaleString("en-US") + " ft";
    if (nm === 25) {
      text(nm + " NM", cx - r + 16, cy - 26, { size: 35, weight: 600, fill: "#334155", haloWidth: 9 });
      text(needLabel, cx - r + 16, cy + 30, { size: 40, weight: 700, fill: "#0f172a", haloWidth: 9 });
    } else {
      text(nm + " NM", cx + r - 16, cy - 26, { anchor: "end", size: 35, weight: 600, fill: "#334155", haloWidth: 9 });
      text(needLabel, cx + r - 16, cy + 30, { anchor: "end", size: 40, weight: 700, fill: "#0f172a", haloWidth: 9 });
    }
  }

  // The exchange's turnpoints: a small diamond and a quiet name each, drawn over
  // the rings so their casings do not cut the type.
  for (const wp of WAYPOINTS) {
    if (wp.skip) continue;
    const [sx, sy] = pxOf(wp.lat, wp.lon);
    if (sx < 16 || sx > CANVAS_W - 16 || sy < 16 || sy > CANVAS_H - 16) continue;
    el("path", {
      d: "M" + sx + " " + (sy - 7) + " L" + (sx + 7) + " " + sy + " L" + sx + " " + (sy + 7) + " L" + (sx - 7) + " " + sy + " Z",
      fill: "#3f4c5f", stroke: "rgba(255,255,255,0.9)", "stroke-width": 2.5,
    });
    const pos = WAYPOINT_POS[wp.name] ?? {};
    const left = pos.side === "left" || (!pos.side && sx > CANVAS_W - 430);
    text(wp.name, sx + (left ? -12 : 12), sy + 3 + (pos.dy ?? 0) * PX_PER_MM * 0.25,
         { anchor: left ? "end" : "start", size: 26, weight: 500, fill: "#3f4c5f", haloWidth: 6, spacing: "0.01em" });
  }

  // Landmark labels: summit triangles, italic ranges and areas, towns, the field.
  const anchors = {};
  const place = (label) => {
    const p = pxOf(label.lat, label.lon);
    anchors[label.name] = [Math.round(p[0]), Math.round(p[1])];
    return p;
  };
  const mm = PX_PER_MM;
  const leader = (sx, sy, px, py) => {
    const len = Math.hypot(px - sx, py - sy);
    if (len < 8 * mm) return;
    const t = (2.5 * mm) / len;
    line(sx + (px - sx) * t, sy + (py - sy) * t, px, py, { stroke: "#475569", width: 1.8, opacity: 0.5 });
  };
  const textPos = (label) => [cx + label.tx * mm, cy - label.ty * mm];
  for (const label of LABELS) {
    const [sx, sy] = place(label);
    const [tx, ty] = textPos(label);
    if (label.kind === "summit") {
      el("path", { d: "M" + sx + " " + (sy - 13) + " L" + (sx - 11) + " " + (sy + 7) + " L" + (sx + 11) + " " + (sy + 7) + " Z",
                   fill: "#1e293b", stroke: "rgba(255,255,255,0.95)", "stroke-width": 4 });
      if (label.align !== "center") leader(sx, sy, label.align === "right" ? tx + 2 * mm : tx - 2 * mm, ty);
      text(label.name, tx, ty, { anchor: label.align, size: 42, weight: 600 });
    } else if (label.kind === "field") {
      el("circle", { cx: sx, cy: sy, r: 16, fill: "#0ea5e9", stroke: "rgba(255,255,255,0.95)", "stroke-width": 5 });
      if (label.align !== "center") leader(sx, sy, label.align === "right" ? tx + 2 * mm : tx - 2 * mm, ty);
      text(label.name, tx, ty, { anchor: label.align, size: 44, weight: 700 });
    } else if (label.kind === "place") {
      el("circle", { cx: sx, cy: sy, r: 8, fill: "#475569", stroke: "rgba(255,255,255,0.95)", "stroke-width": 3.5 });
      if (label.align !== "center") leader(sx, sy, label.align === "right" ? tx + 2 * mm : tx - 2 * mm, ty);
      text(label.name, tx, ty, { anchor: label.align, size: 38, weight: 600, fill: "#334155" });
    } else if (label.kind === "area") {
      if (label.align !== "center") leader(sx, sy, label.align === "right" ? tx + 2 * mm : tx - 2 * mm, ty);
      text(label.name, tx, ty, { anchor: label.align, size: 40, weight: 600, italic: true, fill: "rgba(15,23,42," + (label.alpha ?? 0.85) + ")", haloWidth: 9 });
    } else {
      text(label.name, tx, ty, { anchor: label.align, size: 40, weight: 600, italic: true, fill: "#334155", spacing: "0.05em", haloWidth: 9 });
    }
  }
  for (const town of TOWNS) {
    const [sx, sy] = place(town);
    el("circle", { cx: sx, cy: sy, r: 7, fill: "#334155", stroke: "rgba(255,255,255,0.95)", "stroke-width": 3 });
    text(town.name, sx + town.dx * mm, sy + town.dy * mm, { anchor: town.align, size: 37, weight: 600, fill: "#334155", haloWidth: 8 });
  }

  // Scale bar (bottom left, in the map) and north arrow (top right).
  const bar10 = 10000 * pxPerM;
  const bx = 40, by = CANVAS_H - 46;
  line(bx, by, bx + bar10 * 2, by, { stroke: "rgba(255,255,255,0.9)", width: 12 });
  line(bx, by, bx + bar10 * 2, by, { stroke: "#1e293b", width: 4 });
  for (const xx of [bx, bx + bar10, bx + bar10 * 2]) line(xx, by - 10, xx, by + 10, { stroke: "#1e293b", width: 4 });
  text("0", bx, by - 28, { anchor: "middle", size: 34, weight: 600, haloWidth: 8 });
  text("10", bx + bar10, by - 28, { anchor: "middle", size: 34, weight: 600, haloWidth: 8 });
  text("20 km", bx + bar10 * 2, by - 28, { anchor: "middle", size: 34, weight: 600, haloWidth: 8 });
  // The one line of print the data licences ask for.
  text("Terrain: AWS Terrain Tiles  ·  Water: © OpenStreetMap contributors (ODbL)  ·  25:1, 1,000 ft arrival",
       bx, by - 70, { size: 29, weight: 500, fill: "#334155", haloWidth: 8 });
  // North arrow, pointed at true north in the turned frame: north's screen
  // direction is its (east, north) components read through the sheet's axes.
  const ndx = ER.north, ndy = -UP.north;
  const pdx = -ndy, pdy = ndx;
  const ax = CANVAS_W - 104, ay = 178;
  const at = (fx, fy) => [ax + ndx * fx + pdx * fy, ay + ndy * fx + pdy * fy];
  const tip = at(54, 0), left = at(-18, 20), notch = at(-4, 0), right = at(-18, -20);
  el("path", {
    d: "M" + tip[0].toFixed(1) + " " + tip[1].toFixed(1) + " L" + left[0].toFixed(1) + " " + left[1].toFixed(1) +
       " L" + notch[0].toFixed(1) + " " + notch[1].toFixed(1) + " L" + right[0].toFixed(1) + " " + right[1].toFixed(1) + " Z",
    fill: "#1e293b", stroke: "rgba(255,255,255,0.95)", "stroke-width": 4,
  });
  const nLab = at(92, 0);
  text("N", nLab[0], nLab[1], { anchor: "middle", size: 40, weight: 700, haloWidth: 8 });

  if (DEBUG) {
    for (let lat = Math.floor(BOUNDS.south * 20) / 20; lat <= BOUNDS.north; lat += 0.05) {
      const samples = [];
      for (let lon = BOUNDS.west; lon <= BOUNDS.east; lon += 0.005) samples.push(pxOf(lat, lon));
      strokeGraticule(samples, { stroke: "#dc2626", width: 1, opacity: 0.5 });
      const first = samples.find((p) => p && p[0] > 60 && inSheet(p[0], p[1]));
      if (first) text(lat.toFixed(2), 60, first[1] - 10, { size: 24, fill: "#dc2626", haloWidth: 4 });
    }
    for (const label of LABELS) {
      const [sx, sy] = pxOf(label.lat, label.lon);
      el("circle", { cx: sx, cy: sy, r: 5, fill: "#dc2626" });
      text(label.name.slice(0, 10), sx + 10, sy - 16, { size: 22, fill: "#dc2626", haloWidth: 4 });
    }
  }

  window.__anchors = anchors;
  window.__done = true;
}
main().catch((e) => { window.__error = String(e && e.stack || e); });
</script></body></html>`;
}

/* ------------------------------ cdp + print --------------------------------- */

async function serve() {
  const server = createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    const file = join(SCRATCH, url.pathname === "/" ? "index.html" : url.pathname.slice(1));
    if (!file.startsWith(SCRATCH) || !existsSync(file)) { res.writeHead(404); res.end(); return; }
    const type = file.endsWith(".html") ? "text/html" : file.endsWith(".json") ? "application/json" : "application/octet-stream";
    res.writeHead(200, { "Content-Type": type });
    res.end(readFileSync(file));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { server, port: server.address().port };
}

async function render(port) {
  const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const dbgPort = 9445;
  const profile = await mkdtemp(join(tmpdir(), "navtop-chrome-"));
  const chrome = spawn(CHROME, [
    "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
    `--remote-debugging-port=${dbgPort}`, `--user-data-dir=${profile}`,
    `--window-size=${CANVAS_W},${CANVAS_H}`,
  ], { stdio: "ignore" });

  let seq = 0;
  const send = (ws, method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++seq;
    const onMessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.id !== id) return;
      ws.removeEventListener("message", onMessage);
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolve(message.result);
    };
    ws.addEventListener("message", onMessage);
    ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });

  try {
    let version;
    for (let attempt = 0; attempt < 80; attempt += 1) {
      try {
        const r = await fetch(`http://127.0.0.1:${dbgPort}/json/version`);
        if (r.ok) { version = await r.json(); break; }
      } catch {}
      await sleep(250);
    }
    if (!version) throw new Error("chrome debug port never answered");
    const ws = new WebSocket(version.webSocketDebuggerUrl);
    await new Promise((resolve) => ws.addEventListener("open", resolve));
    const { targetId } = await send(ws, "Target.createTarget", { url: "about:blank" });
    const { sessionId } = await send(ws, "Target.attachToTarget", { targetId, flatten: true });
    await send(ws, "Page.enable", {}, sessionId);
    await send(ws, "Emulation.setDeviceMetricsOverride", { width: 1400, height: 950, deviceScaleFactor: 1, mobile: false }, sessionId);
    await send(ws, "Page.navigate", { url: `http://127.0.0.1:${port}/` }, sessionId);

    const deadline = Date.now() + 10 * 60 * 1000;
    for (;;) {
      const { result } = await send(ws, "Runtime.evaluate", { expression: "window.__done ? 'done' : (window.__error || 'waiting')", returnByValue: true }, sessionId);
      if (result.value === "done") break;
      if (result.value && result.value !== "waiting") throw new Error(String(result.value));
      if (Date.now() > deadline) throw new Error("render timed out");
      await sleep(1000);
    }

    if (process.env.NAV3D_DEBUG) {
      const { result: dump } = await send(ws, "Runtime.evaluate", {
        expression: "[...document.querySelectorAll('#o text')].map((t) => t.textContent + ' @ ' + t.getAttribute('x') + ',' + t.getAttribute('y')).join('\\n')",
        returnByValue: true,
      }, sessionId);
      console.log("text nodes:\n" + dump.value);
    }
    const shot = await send(ws, "Page.captureScreenshot", { format: "png", captureBeyondViewport: false }, sessionId);
    const pdf = await send(ws, "Page.printToPDF", {
      landscape: true, printBackground: true, preferCSSPageSize: true,
      paperWidth: PAPER_IN.width, paperHeight: PAPER_IN.height,
      marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0,
    }, sessionId);
    ws.close();
    return { preview: Buffer.from(shot.data, "base64"), pdf: Buffer.from(pdf.data, "base64") };
  } finally {
    chrome.kill("SIGKILL");
  }
}

/* ---------------------------------- main ------------------------------------ */

async function main() {
  mkdirSync(SCRATCH, { recursive: true });
  await buildDem();
  const meta = JSON.parse(readFileSync(join(SCRATCH, "dem.json"), "utf8"));
  const water = await buildWater();
  const waypoints = await buildWaypoints();
  writeFileSync(join(SCRATCH, "index.html"), harnessHtml(meta, water, waypoints));

  const { server, port } = await serve();
  let out;
  try {
    out = await render(port);
  } finally {
    server.close();
  }
  writeFileSync(OUT_PREVIEW, out.preview);
  if (process.env.NAV3D_PREVIEW_ONLY) {
    console.log("preview only — kept at", OUT_PREVIEW);
    return;
  }
  writeFileSync(OUT_PDF, out.pdf);
  console.log("wrote", OUT_PDF, (out.pdf.length / 1e6).toFixed(2) + " MB");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
