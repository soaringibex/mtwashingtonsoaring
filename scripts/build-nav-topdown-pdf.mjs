#!/usr/bin/env node
/**
 * Build the printable top-down chart — public/files/gorham-range-rings.pdf —
 * a 1:450,000 full-bleed tabloid (17 x 11 in) sheet of the wave country, north up.
 * The west edge lands on the exchange's Black Mountain (Benton), the bottom edge
 * just below Fryeburg; Sugarloaf AP and Moosilauke stay in frame. The main map
 * carries only the exchange's turnpoints (CUP styles 2/5 fly the airplane icon,
 * as read in src/lib/nav-files.ts), the rivers and lakes, a grey dotted set of
 * glide rings every 5 NM around Gorham (2G8) — each labelled with the altitude
 * a 25:1 glide in still air needs at that distance to arrive with 1,000 ft to
 * spare (required MSL = field elevation 837 ft + 1,000 ft + the ring's
 * distance / 25) — and the LOA's glider area, solid red and pointed at. The
 * briefing's detailed landmarks live on the disc that enlarges that area at
 * 1:186,000 — its raster twice the sheet's 300 dpi, over a one-zoom-finer
 * terrain mosaic.
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

/**
 * The corner inset: the LOA's glider area at 2.4× the sheet's scale, flush in
 * the bottom-right. Its centre is the glider area's own centre (src/lib/wx-grid.ts);
 * the solid red circle is its 10 NM radius.
 */
const INSET = {
  lat: 44.290556,
  lon: -71.227778,
  radiusNm: 10,
  mPerMm: 186,
  // A square box clipped to a disc, flush in the bottom-right corner. 204 mm
  // across sizes the rim to just reach the Webb Lake mark on the main sheet
  // (~5 mm shy); the drawn 10 NM cylinder sits well inside it.
  widthMm: 204,
  heightMm: 204,
  /** The disc's raster runs at twice the sheet's 300 dpi. */
  supersample: 2,
};
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
 * The inset's labels — text anchors in millimetres east/north of the inset's
 * centre (the glider area), authored at 1:186,000 and kept a few millimetres from
 * each anchor so every name sits by its feature with a short leader.
 */
const INSET_LABELS = [
  { name: "Mt Washington", kind: "summit", lat: 44.27049, lon: -71.3033, tx: -34.5, ty: -11.6, align: "right" },
  { name: "Mt Madison", kind: "summit", lat: 44.32879, lon: -71.27667, tx: -18.5, ty: 23.5, align: "left" },
  { name: "Pine Mtn", kind: "summit", lat: 44.36588, lon: -71.21519, tx: 8, ty: 45.3, align: "left" },
  { name: "Mt Hayes", kind: "summit", lat: 44.41566, lon: -71.15986, tx: 30.5, ty: 75.2, align: "left" },
  { name: "The Great Gulf", kind: "area", lat: 44.2845, lon: -71.2945, tx: -20, ty: -2.9, align: "left", arrow: true },
  { name: "The Horn", kind: "summit", lat: 44.29483, lon: -71.279, tx: -19, ty: 2.3, align: "left" },
  { name: "Huntington Ravine", kind: "area", lat: 44.2745, lon: -71.2805, tx: -15, ty: -8, align: "left", arrow: true },
  { name: "Tuckerman Ravine", kind: "area", lat: 44.2605, lon: -71.292, tx: -25, ty: -22.5, align: "left", arrow: true },
  { name: "Wildcat Mtn", kind: "summit", lat: 44.2592, lon: -71.20161, tx: 14, ty: -20, align: "left" },
  { name: "Carter Dome", kind: "summit", lat: 44.2674, lon: -71.17912, tx: 27, ty: -12, align: "left" },
  { name: "Gorham 2G8", kind: "field", lat: 44.39472, lon: -71.19805, tx: 16, ty: 63, align: "left" },
  { name: "Glen House", kind: "place", lat: 44.29093, lon: -71.22559, tx: 3, ty: -2.5, align: "left" },
  { name: "Mt Jefferson", kind: "summit", lat: 44.30423, lon: -71.31675, tx: -41, ty: 7, align: "right" },
  { name: "Mt Adams", kind: "summit", lat: 44.32058, lon: -71.29164, tx: -30, ty: 18.5, align: "right" },
  { name: "Mt Moriah", kind: "summit", lat: 44.34053, lon: -71.13172, tx: 42.5, ty: 30.2, align: "left" },
  { name: "Crescent Range", kind: "range", lat: 44.438, lon: -71.302, tx: -31.7, ty: 84.5, align: "center" },
  { name: "Carter-Moriah Range", kind: "range", lat: 44.245, lon: -71.155, tx: 33, ty: -28, align: "left" },
  { name: "North Carter", kind: "summit", lat: 44.31306, lon: -71.16444, tx: 29, ty: 14.7, align: "left" },
  { name: "Middle Carter", kind: "summit", lat: 44.30312, lon: -71.16722, tx: 28, ty: 7.4, align: "left" },
  { name: "South Carter", kind: "summit", lat: 44.289486, lon: -71.176911, tx: 24, ty: -0.2, align: "left" },
  { name: "Lakes of the Clouds", kind: "place", lat: 44.2585, lon: -71.3187, tx: -41, ty: -19.6, align: "right" },
  { name: "Cog Railway base station", kind: "place", lat: 44.2867, lon: -71.3366, tx: -49, ty: -2.3, align: "right" },
  { name: "Mt Eisenhower", kind: "summit", lat: 44.2403434, lon: -71.3503537, tx: -54.5, ty: -30.5, align: "right" },
  { name: "Mt Crescent", kind: "summit", lat: 44.404348, lon: -71.294115, tx: -25.5, ty: 68.7, align: "left" },
  { name: "Pinkham Notch", kind: "place", lat: 44.2575, lon: -71.2531, tx: -16, ty: -17.5, align: "left" },
  { name: "Pliny Mtn", kind: "summit", lat: 44.4143, lon: -71.3882, tx: -65, ty: 72, align: "left" },
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

/** North up: screen right is east, screen up is north. */
const ER = { east: 1, north: 0, bearing: 90 };
const UP = { east: 0, north: 1 };
const PX_PER_M = PX_PER_MM / M_PER_MM;
const HALF_W_M = CANVAS_W / 2 / PX_PER_M;
const HALF_H_M = CANVAS_H / 2 / PX_PER_M;

const project = (lat, lon) => {
  const east = (lon - CENTER.lon) * M_PER_LON;
  const north = (lat - CENTER.lat) * M_PER_LAT;
  return [east * ER.east + north * ER.north, east * UP.east + north * UP.north];
};
/** The sheet's frame: the west edge lands on Black Mountain (the exchange's
 * BLACKMTN, Benton NH), the bottom edge just below Fryeburg. */
const FRYEBURG = { lat: 44.0164, lon: -70.9753 };
const BLACK_MTN = { lat: 44.07472, lon: -71.92388 };
const SHEET_C = (() => {
  const [uBlack] = project(BLACK_MTN.lat, BLACK_MTN.lon);
  const [, vFryeburg] = project(FRYEBURG.lat, FRYEBURG.lon);
  // West edge at Black Mountain; bottom edge below Fryeburg but never clipping
  // the 25 NM ring's southern tangent.
  return { u: uBlack - 2500 + HALF_W_M, v: Math.min(vFryeburg - 3800, -47300) + HALF_H_M };
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

async function buildMosaic(label, bounds, zoom, binName, metaName) {
  const x0 = Math.floor(lonToTileX(bounds.west, zoom));
  const x1 = Math.floor(lonToTileX(bounds.east, zoom));
  const y0 = Math.floor(latToTileY(bounds.north, zoom));
  const y1 = Math.floor(latToTileY(bounds.south, zoom));
  const cols = x1 - x0 + 1;
  const rows = y1 - y0 + 1;
  const width = cols * TILE_SIZE;
  const height = rows * TILE_SIZE;
  const elevations = new Float32Array(width * height);

  process.stdout.write(`${label} tiles: z${zoom} ${cols}x${rows} (${cols * rows}) … `);
  let done = 0;
  for (let ty = 0; ty < rows; ty += 1) {
    const row = await Promise.all(
      Array.from({ length: cols }, (_, tx) => fetchTile(zoom, x0 + tx, y0 + ty)),
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

  const north = tileYToLat(y0, zoom);
  const meta = {
    width,
    height,
    west: tileXToLon(x0, zoom),
    north,
    lonStep: 360 / 2 ** zoom / TILE_SIZE,
    latStep: (north - tileYToLat(y0 + 1, zoom)) / TILE_SIZE,
  };
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, binName), Buffer.from(elevations.buffer));
  writeFileSync(join(SCRATCH, metaName), JSON.stringify(meta));
  console.log(`${label}: ${width}x${height}px, ${(meta.lonStep * M_PER_LON).toFixed(1)}m/px`);
  return meta;
}

/** The disc's own mosaic: one zoom finer than the sheet's, for its 600 dpi raster. */
function discBounds() {
  const half = (INSET.widthMm / 2) * INSET.mPerMm + 1000; // metres, plus a km of margin
  return {
    west: INSET.lon - half / M_PER_LON,
    east: INSET.lon + half / M_PER_LON,
    south: INSET.lat - half / M_PER_LAT,
    north: INSET.lat + half / M_PER_LAT,
  };
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
    // Overpass rate-limits per IP and 502s when it is unhappy; walk the mirrors.
    let response = null;
    let lastError = "";
    const endpoints = [
      "https://overpass-api.de/api/interpreter",
      "https://overpass.kumi.systems/api/interpreter",
      "https://overpass.private.coffee/api/interpreter",
    ];
    for (let attempt = 0; attempt < 6 && !response; attempt += 1) {
      const endpoint = endpoints[attempt % endpoints.length];
      try {
        const candidate = await fetch(endpoint, {
          method: "POST",
          body: query,
          headers: { "User-Agent": "mtwashingtonsoaring-site/1.0 (gorham chart)" },
        });
        if (candidate.ok) response = candidate;
        else lastError = `${endpoint} returned ${candidate.status}`;
      } catch (error) {
        lastError = `${endpoint}: ${error.message}`;
      }
      if (!response) await new Promise((resolve) => setTimeout(resolve, 15000 * (attempt + 1)));
    }
    if (!response) throw new Error(`overpass unreachable — ${lastError}`);
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
const WAYPOINT_RENAME = { Berlin: "Berlin (BML)" };
/** Where the default "name to the right of the dot" crowds a neighbour. */
const WAYPOINT_POS = {
  "Berlin (BML)": { side: "right", dy: 0 },
  Durand: { side: "left", dy: 0 },
};
/** Points the chart leaves to its own furniture: the hotel, the observatory
 *  (the summit is marked instead) and the glider-area centre. */
const WAYPOINT_SKIP = new Set(["Mount Washington Hotel", "Mount Washington Observatory", "Mount Washington GA"]);
/** The one summit the main sheet marks, in the disc's triangle. */
const MAIN_SUMMITS = [{ name: "Mt Washington", lat: 44.27049, lon: -71.3033 }];

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
    const style = Number.parseInt(columns[6], 10) || 0;
    waypoints.push({
      name: WAYPOINT_RENAME[name] ?? name,
      code,
      lat,
      lon,
      elevation: elevation ?? "",
      // CUP styles 2 and 5 are the airfields, as src/lib/nav-files.ts reads them.
      airport: style === 2 || style === 5,
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
  .inset { position: absolute; right: 0; bottom: 0;
           width: ${INSET.widthMm}mm; height: ${INSET.heightMm}mm; background: #fff;
           border: 0.5mm solid #334155; border-radius: 50%; overflow: hidden; box-sizing: border-box; }
  .inset canvas, .inset svg { position: absolute; inset: 0.5mm; width: calc(100% - 1mm); height: calc(100% - 1mm); }
</style></head>
<body>
<div class="map"><canvas id="c" width="${CANVAS_W}" height="${CANVAS_H}"></canvas><svg id="o" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}"></svg></div>
<div class="inset"><canvas id="ci"></canvas><svg id="oi"></svg></div>
<script>
const META = ${JSON.stringify(meta)};
const WATER = ${JSON.stringify(water)};
const RINGS_NM = ${JSON.stringify(RINGS_NM)};
const GRATICULE_DEG = ${JSON.stringify(GRATICULE_DEG)};
const WAYPOINTS = ${JSON.stringify(waypoints)};
const WAYPOINT_POS = ${JSON.stringify(WAYPOINT_POS)};
const WAYPOINT_SKIP = new Set(${JSON.stringify([...WAYPOINT_SKIP])});
const MAIN_SUMMITS = ${JSON.stringify(MAIN_SUMMITS)};
const INSET = ${JSON.stringify(INSET)};
const INSET_LABELS = ${JSON.stringify(INSET_LABELS)};
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
  const discDem = new Float32Array(await (await fetch("disc-dem.bin")).arrayBuffer());
  const DISC_META = await (await fetch("disc-dem.json")).json();
  /** One DEM mosaic plus the sampling maths its raster needs. */
  const makeSampler = (meta, data) => {
    const { width: W, height: H, west, north, lonStep, latStep } = meta;
    const hAt = (mx, my) => {
      const fx = Math.min(Math.max(mx, 0), W - 1.001), fy = Math.min(Math.max(my, 0), H - 1.001);
      const ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
      const i = iy * W + ix;
      return data[i] * (1 - tx) * (1 - ty) + data[i + 1] * tx * (1 - ty) +
             data[i + W] * (1 - tx) * ty + data[i + W + 1] * tx * ty;
    };
    return {
      hAt, west, north, lonStep, latStep,
      perPxX: M_PER_LON * lonStep, // metres to the DEM pixel, each axis
      perPxY: M_PER_LAT * latStep,
    };
  };
  const sheetDem = makeSampler(META, dem);
  const fineDem = makeSampler(DISC_META, discDem);
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

  // Terrain raster: each canvas pixel is one ground sample, hillshaded north-west.
  const paintTerrain = (target, w, h, ppm, cu, cv, S) => {
    target.width = w; target.height = h;
    const tctx = target.getContext("2d");
    const img = tctx.createImageData(w, h);
    const data = img.data;
    let idx = 0;
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const u = (x - w / 2) / ppm + cu;
        const v = -(y - h / 2) / ppm + cv;
        const east = u * ER.east + v * UP.east;
        const nn = u * ER.north + v * UP.north;
        const my = (S.north - (CENTER.lat + nn / M_PER_LAT)) / S.latStep;
        const mx = (CENTER.lon + east / M_PER_LON - S.west) / S.lonStep;
        const hgt = S.hAt(mx, my);
        const hx = (S.hAt(mx + 0.75, my) - S.hAt(mx - 0.75, my)) / (1.5 * S.perPxX);
        const hy = (S.hAt(mx, my + 0.75) - S.hAt(mx, my - 0.75)) / (1.5 * S.perPxY);
        let nx = -hx, ny = hy, nz = 1;
        const nl = Math.hypot(nx, ny, nz);
        nx /= nl; ny /= nl; nz /= nl;
        const shade = Math.min(Math.max(nx * LIGHT.east + ny * LIGHT.north + nz * LIGHT.up, 0), 1);
        const c = reliefColour(hgt, shade);
        data[idx] = c[0]; data[idx + 1] = c[1]; data[idx + 2] = c[2]; data[idx + 3] = 255;
        idx += 4;
      }
    }
    tctx.putImageData(img, 0, 0);
  };
  // Swap a canvas for a JPEG-backed image: printToPDF embeds JPEGs as-is, where a
  // live canvas would be rasterised losslessly and blow the file up tenfold.
  const swapToJpeg = (target, quality) => new Promise((resolve) => {
    const jpeg = new Image();
    jpeg.onload = () => {
      const holder = target.parentNode;
      const id = target.id;
      holder.removeChild(target);
      jpeg.id = id;
      jpeg.style.position = "absolute";
      jpeg.style.inset = "0";
      jpeg.style.width = "100%";
      jpeg.style.height = "100%";
      holder.prepend(jpeg);
      resolve();
    };
    jpeg.src = target.toDataURL("image/jpeg", quality);
  });
  paintTerrain(document.getElementById("c"), CANVAS_W, CANVAS_H, pxPerM, SHEET_C.u, SHEET_C.v, sheetDem);
  await swapToJpeg(document.getElementById("c"), 0.84);

  // --------------------------------- vector ----------------------------------
  const svg = document.getElementById("o");
  const NS = "http://www.w3.org/2000/svg";
  const el = (name, attrs, parent = svg) => {
    const node = document.createElementNS(NS, name);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    parent.appendChild(node);
    return node;
  };
  const text = (str, x, y, opts = {}, parent = svg) => {
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
    }, parent);
    node.textContent = str;
    return node;
  };
  const line = (x1, y1, x2, y2, opts = {}, parent = svg) =>
    el("line", { x1: x1.toFixed(1), y1: y1.toFixed(1), x2: x2.toFixed(1), y2: y2.toFixed(1),
                 stroke: opts.stroke ?? "#334155", "stroke-width": opts.width ?? 2,
                 "stroke-opacity": opts.opacity ?? 1, "stroke-dasharray": opts.dash ?? "none",
                 "stroke-linecap": "round" }, parent);
  const pathOf = (points, close, px = pxOf) =>
    points.map((p, i) => (i === 0 ? "M" : "L") + px(p.lat, p.lon).map((n) => n.toFixed(1)).join(" ")).join(" ") + (close ? " Z" : "");

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

  // Range rings: centred on the field, every 5 NM — grey dotted, cased so the
  // dots read over the terrain.
  const [cx, cy] = pxOf(CENTER.lat, CENTER.lon);
  for (const nm of RINGS_NM) {
    const r = (nm * M_PER_NM) * pxPerM;
    el("circle", { cx, cy, r, fill: "none", stroke: "rgba(255,255,255,0.85)", "stroke-width": 6, "stroke-dasharray": "3 7" });
    el("circle", { cx, cy, r, fill: "none", stroke: "#6b7280", "stroke-width": 2.4, "stroke-dasharray": "3 7" });
    // Each ring's pair sits at its top — the distance just outside the line, the
    // 25:1 arrival altitude just inside — as a column nudged left of due north,
    // clear of Berlin's airport marker on the 10 NM ring.
    const needFt = Math.round((1837 + (nm * 6076.12) / 25) / 50) * 50;
    const needLabel = needFt.toLocaleString("en-US") + " ft";
    text(nm + " NM", cx - 75, cy - r - 22, { anchor: "middle", size: 26, weight: 600, fill: "#334155", haloWidth: 0 });
    text(needLabel, cx - 75, cy - r + 28, { anchor: "middle", size: 28, weight: 700, fill: "#0f172a", haloWidth: 0 });
  }

  // The LOA's glider-area cylinder on the main map — solid red on both the
  // sheet and the disc, labelled, with a pointer across to the disc it is
  // enlarged as.
  const [gax, gay] = pxOf(INSET.lat, INSET.lon);
  const loaMainR = INSET.radiusNm * M_PER_NM * pxPerM;
  el("circle", { cx: gax, cy: gay, r: loaMainR, fill: "none", stroke: "rgba(255,255,255,0.9)", "stroke-width": 7.5 });
  el("circle", { cx: gax, cy: gay, r: loaMainR, fill: "none", stroke: "#dc2626", "stroke-width": 4 });
  text("Glider area", gax, gay - loaMainR + 70, { anchor: "middle", size: 30, weight: 600, italic: true, fill: "#334155", haloWidth: 8 });
  {
    // Rim-to-rim pointer: the disc's drawn footprint, in sheet pixels.
    const discBox = INSET.widthMm * PX_PER_MM;
    const dcx = CANVAS_W - discBox / 2, dcy = CANVAS_H - discBox / 2, dR = discBox / 2;
    const dx = dcx - gax, dy = dcy - gay;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    const p1 = [gax + ux * (loaMainR + 6), gay + uy * (loaMainR + 6)];
    const p2 = [dcx - ux * (dR + 6), dcy - uy * (dR + 6)];
    line(p1[0], p1[1], p2[0], p2[1], { stroke: "#dc2626", width: 1.8, opacity: 0.8 });
    const px = -uy, py = ux; // perpendicular
    el("path", {
      d: "M" + p1[0] + " " + p1[1] +
         " L" + (p1[0] + ux * 22 + px * 8) + " " + (p1[1] + uy * 22 + py * 8) +
         " L" + (p1[0] + ux * 22 - px * 8) + " " + (p1[1] + uy * 22 - py * 8) + " Z",
      fill: "#dc2626", "fill-opacity": 0.85,
    });
  }

  // A top-down airplane for every airport — nose north, on this north-up sheet.
  const planeIcon = (x, y, len, fill, parent) => {
    const s = len / 21;
    el("path", {
      d: "M21 16v-2l-8-5V3.5C13 2.67 12.33 2 11.5 2S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z",
      transform: "translate(" + x + " " + y + ") scale(" + s + ") translate(-11.5 -12)",
      fill: fill, stroke: "rgba(255,255,255,0.95)", "stroke-width": 2.6 / s, "stroke-linejoin": "round",
    }, parent);
  };

  // The exchange's turnpoints: a small diamond and a quiet name each, drawn over
  // the rings so their casings do not cut the type.
  for (const wp of WAYPOINTS) {
    if (WAYPOINT_SKIP.has(wp.name)) continue;
    const [sx, sy] = pxOf(wp.lat, wp.lon);
    if (sx < 16 || sx > CANVAS_W - 16 || sy < 16 || sy > CANVAS_H - 16) continue;
    if (wp.airport) {
      // Airfields fly the chart's airplane icon.
      planeIcon(sx, sy, 30, "#3f4c5f");
    } else {
      el("path", {
        d: "M" + sx + " " + (sy - 7) + " L" + (sx + 7) + " " + sy + " L" + sx + " " + (sy + 7) + " L" + (sx - 7) + " " + sy + " Z",
        fill: "#3f4c5f", stroke: "rgba(255,255,255,0.9)", "stroke-width": 2.5,
      });
    }
    const pos = WAYPOINT_POS[wp.name] ?? {};
    const left = pos.side === "left" || (!pos.side && sx > CANVAS_W - 430);
    const shown = wp.name.replace(/^Mount /, "Mt ").replace(/ Mountain$/, " Mtn");
    text(shown, sx + (left ? (wp.airport ? -22 : -12) : wp.airport ? 22 : 12), sy + 3 + (pos.dy ?? 0) * PX_PER_MM * 0.25,
         { anchor: left ? "end" : "start", size: 26, weight: wp.airport ? 600 : 500, fill: wp.airport ? "#334155" : "#3f4c5f", haloWidth: 6, spacing: "0.01em" });
  }

  // Mount Washington itself, in the disc's triangle.
  for (const peak of MAIN_SUMMITS) {
    const [sx, sy] = pxOf(peak.lat, peak.lon);
    el("path", {
      d: "M" + sx + " " + (sy - 12) + " L" + (sx - 10) + " " + (sy + 8) + " L" + (sx + 10) + " " + (sy + 8) + " Z",
      fill: "#1e293b", stroke: "rgba(255,255,255,0.95)", "stroke-width": 3.5,
    });
    text(peak.name, sx + 16, sy + 4, { size: 26, weight: 600, fill: "#334155", haloWidth: 6 });
  }

  // Scale bar (bottom left, in the map) and north arrow (top right).
  const bar5nm = 5 * M_PER_NM * pxPerM;
  const bx = 40, by = CANVAS_H - 46;
  line(bx, by, bx + bar5nm * 2, by, { stroke: "rgba(255,255,255,0.9)", width: 12 });
  line(bx, by, bx + bar5nm * 2, by, { stroke: "#1e293b", width: 4 });
  for (const xx of [bx, bx + bar5nm, bx + bar5nm * 2]) line(xx, by - 10, xx, by + 10, { stroke: "#1e293b", width: 4 });
  text("0", bx, by - 28, { anchor: "middle", size: 34, weight: 600, haloWidth: 8 });
  text("5", bx + bar5nm, by - 28, { anchor: "middle", size: 34, weight: 600, haloWidth: 8 });
  text("10 NM", bx + bar5nm * 2, by - 28, { anchor: "middle", size: 34, weight: 600, haloWidth: 8 });
  // The one line of print the data licences ask for.
  text("Terrain: AWS Terrain Tiles  ·  Water: © OpenStreetMap contributors (ODbL)  ·  25:1, 1,000 ft arrival",
       bx, by - 70, { size: 29, weight: 500, fill: "#334155", haloWidth: 8 });
  // North arrow, pointed at true north in the turned frame: north's screen
  // direction is its (east, north) components read through the sheet's axes.
  const ndx = ER.north, ndy = -UP.north;
  const pdx = -ndy, pdy = ndx;
  const ax = CANVAS_W - 116, ay = 190;
  const at = (fx, fy) => [ax + ndx * fx + pdx * fy, ay + ndy * fx + pdy * fy];
  const tip = at(54, 0), left = at(-18, 20), notch = at(-4, 0), right = at(-18, -20);
  el("path", {
    d: "M" + tip[0].toFixed(1) + " " + tip[1].toFixed(1) + " L" + left[0].toFixed(1) + " " + left[1].toFixed(1) +
       " L" + notch[0].toFixed(1) + " " + notch[1].toFixed(1) + " L" + right[0].toFixed(1) + " " + right[1].toFixed(1) + " Z",
    fill: "#1e293b", stroke: "rgba(255,255,255,0.95)", "stroke-width": 4,
  });
  const nLab = at(92, 0);
  text("N", nLab[0], nLab[1], { anchor: "middle", size: 40, weight: 700, haloWidth: 8 });

  // The sheet's title, top-left, aligned with the credit line below.
  text("Mt Washington Glider Area", 40, 122, { size: 92, weight: 700, fill: "#1e293b", haloWidth: 14, spacing: "0.01em" });

  // ------------------------- the glider-area inset ---------------------------
  // The LOA's 10 NM cylinder at 1.5x the sheet's scale, pinned to the top-left.
  const IW = Math.round(INSET.widthMm * PX_PER_MM);
  const IH = Math.round(INSET.heightMm * PX_PER_MM);
  const ippm = PX_PER_MM / INSET.mPerMm;
  const [igaU, igaV] = project(INSET.lat, INSET.lon);
  // The disc's raster runs at INSET.supersample × the sheet's dpi, over its finer mosaic.
  const IS = INSET.supersample ?? 1;
  paintTerrain(document.getElementById("ci"), IW * IS, IH * IS, ippm * IS, igaU, igaV, fineDem);
  await swapToJpeg(document.getElementById("ci"), 0.84);
  const io = document.getElementById("oi");
  io.setAttribute("viewBox", "0 0 " + IW + " " + IH);
  const icx = IW / 2, icy = IH / 2;
  // The inset's offsets are authored at 1:186,000, hugging their anchors; scale
  // them with the zoom so a future change keeps the layout self-similar.
  const iScale = 186 / INSET.mPerMm;
  const ipx = (lat, lon) => {
    const [u, v] = project(lat, lon);
    return [icx + (u - igaU) * ippm, icy - (v - igaV) * ippm];
  };
  const ipath = (points, close) =>
    points.map((p, i) => (i === 0 ? "M" : "L") + ipx(p.lat, p.lon).map((n) => n.toFixed(1)).join(" ")).join(" ") + (close ? " Z" : "");
  for (const lake of WATER.lakes) {
    const shape = Array.isArray(lake) ? { points: lake, closed: true } : lake;
    el("path", { d: ipath(shape.points, shape.closed), fill: shape.closed ? WATER_INK : "none",
                 "fill-opacity": 0.75, stroke: WATER_INK, "stroke-width": shape.closed ? 1.5 : 5,
                 "stroke-opacity": shape.closed ? 0.9 : 0.55, "stroke-linejoin": "round" }, io);
  }
  for (const river of WATER.rivers) {
    el("path", { d: ipath(river, false), fill: "none", stroke: WATER_INK, "stroke-width": 4.5,
                 "stroke-opacity": 0.85, "stroke-linecap": "round" }, io);
  }
  // The LOA cylinder — solid red, matching the main map's.
  const loaR = INSET.radiusNm * M_PER_NM * ippm;
  el("circle", { cx: icx, cy: icy, r: loaR, fill: "none", stroke: "rgba(255,255,255,0.9)", "stroke-width": 7.5 }, io);
  el("circle", { cx: icx, cy: icy, r: loaR, fill: "none", stroke: "#dc2626", "stroke-width": 4 }, io);

  // The inset's own label set.
  for (const label of INSET_LABELS) {
    const [sx, sy] = ipx(label.lat, label.lon);
    const tx = icx + label.tx * iScale * PX_PER_MM, ty = icy - label.ty * iScale * PX_PER_MM;
    const lead = (px, py, arrow) => {
      const len = Math.hypot(px - sx, py - sy);
      if (arrow) {
        // A pointing arrow: the head lands on the feature, the shaft runs to the text.
        if (len < 3 * PX_PER_MM) return;
        const ux = (sx - px) / len, uy = (sy - py) / len;
        const head = 3.2 * PX_PER_MM, half = 1.25 * PX_PER_MM;
        const tipX = sx - ux * 0.6 * PX_PER_MM, tipY = sy - uy * 0.6 * PX_PER_MM;
        const backX = tipX - ux * head, backY = tipY - uy * head;
        const nx = -uy, ny = ux;
        el("path", {
          d: "M" + tipX.toFixed(1) + " " + tipY.toFixed(1) +
             " L" + (backX + nx * half).toFixed(1) + " " + (backY + ny * half).toFixed(1) +
             " L" + (backX - nx * half).toFixed(1) + " " + (backY - ny * half).toFixed(1) + " Z",
          fill: "#475569", "fill-opacity": 0.9, stroke: "rgba(255,255,255,0.9)", "stroke-width": 2.5,
        }, io);
        line(px, py, backX + ux * 1.2 * PX_PER_MM, backY + uy * 1.2 * PX_PER_MM,
             { stroke: "#475569", width: 2.4, opacity: 0.85 }, io);
        return;
      }
      if (len < 8 * PX_PER_MM) return;
      const t = (2.5 * PX_PER_MM) / len;
      line(sx + (px - sx) * t, sy + (py - sy) * t, px, py, { stroke: "#475569", width: 1.8, opacity: 0.5 }, io);
    };
    if (label.kind === "summit") {
      el("path", { d: "M" + sx + " " + (sy - 10) + " L" + (sx - 9) + " " + (sy + 6.5) + " L" + (sx + 9) + " " + (sy + 6.5) + " Z",
                   fill: "#1e293b", stroke: "rgba(255,255,255,0.95)", "stroke-width": 3.5 }, io);
      lead(label.align === "right" ? tx + 2 * PX_PER_MM : tx - 2 * PX_PER_MM, ty);
      text(label.name, tx, ty, { anchor: label.align, size: 26, weight: 600 }, io);
    } else if (label.kind === "area") {
      lead(label.align === "right" ? tx + 2 * PX_PER_MM : tx - 2 * PX_PER_MM, ty, label.arrow);
      text(label.name, tx, ty, { anchor: label.align, size: 26, weight: 600, italic: true, fill: "rgba(15,23,42,0.9)", haloWidth: 6 }, io);
    } else if (label.kind === "range") {
      if (label.align !== "center") lead(label.align === "right" ? tx + 2 * PX_PER_MM : tx - 2 * PX_PER_MM, ty);
      text(label.name, tx, ty, { anchor: label.align, size: 26, weight: 600, italic: true, fill: "#334155", spacing: "0.05em", haloWidth: 6 }, io);
    } else if (label.kind === "field") {
      planeIcon(sx, sy, 44, "#0ea5e9", io);
      text(label.name, tx, ty, { anchor: label.align, size: 26, weight: 700 }, io);
    } else {
      el("circle", { cx: sx, cy: sy, r: 8, fill: "#475569", stroke: "rgba(255,255,255,0.95)", "stroke-width": 3.5 }, io);
      text(label.name, tx, ty, { anchor: label.align, size: 26, weight: 600, fill: "#334155" }, io);
    }
  }
  // A 5 NM scale bar for the inset, tucked inside the disc's lower-left —
  // one-mile ticks, the ends carrying the numerals.
  const ibar = 5 * M_PER_NM * ippm;
  const ibx = icx - 52 * PX_PER_MM, iby = icy + 74 * PX_PER_MM;
  line(ibx, iby, ibx + ibar, iby, { stroke: "rgba(255,255,255,0.9)", width: 11 }, io);
  line(ibx, iby, ibx + ibar, iby, { stroke: "#1e293b", width: 4 }, io);
  for (let k = 0; k <= 5; k++) {
    const xx = ibx + (ibar / 5) * k;
    const big = k === 0 || k === 5;
    line(xx, iby - (big ? 10 : 6), xx, iby + (big ? 10 : 6), { stroke: "#1e293b", width: big ? 4 : 3 }, io);
  }
  text("0", ibx, iby - 27, { anchor: "middle", size: 30, weight: 600, haloWidth: 7 }, io);
  text("5 NM", ibx + ibar, iby - 27, { anchor: "middle", size: 30, weight: 600, haloWidth: 7 }, io);

  if (DEBUG) {
    for (let lat = Math.floor(BOUNDS.south * 20) / 20; lat <= BOUNDS.north; lat += 0.05) {
      const samples = [];
      for (let lon = BOUNDS.west; lon <= BOUNDS.east; lon += 0.005) samples.push(pxOf(lat, lon));
      strokeGraticule(samples, { stroke: "#dc2626", width: 1, opacity: 0.5 });
      const first = samples.find((p) => p && p[0] > 60 && inSheet(p[0], p[1]));
      if (first) text(lat.toFixed(2), 60, first[1] - 10, { size: 24, fill: "#dc2626", haloWidth: 4 });
    }
  }

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
        expression: "[...document.querySelectorAll('#oi text')].map((t) => 'INSET ' + t.textContent + ' @ ' + t.getAttribute('x') + ',' + t.getAttribute('y')).join('\\n') + '\\n' + [...document.querySelectorAll('#o text')].map((t) => t.textContent + ' @ ' + t.getAttribute('x') + ',' + t.getAttribute('y')).join('\\n')",
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
  const meta = await buildMosaic("sheet", BOUNDS, ZOOM, "dem.bin", "dem.json");
  await buildMosaic("disc", discBounds(), ZOOM + 1, "disc-dem.bin", "disc-dem.json");
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
