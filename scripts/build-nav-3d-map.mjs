#!/usr/bin/env node
/**
 * Build the labelled 3D relief of the wave country for the Flying page's
 * Navigational references section — public/images/reading/white-mountains-3d.webp
 * and the -full.png behind its "View larger" link.
 *
 * The DEM is AWS Terrain Tiles (Terrarium, the same public-domain source the site's
 * own maps use), cached under .screenshots/nav3d/tiles so re-runs render without
 * re-downloading. The scene is ray-marched per pixel in a headless Chrome canvas
 * (scripts/capture-pages.mjs sets the CDP precedent), labels drawn over it, then
 * the screenshot is encoded to webp/png with sharp.
 *
 * Feature coordinates: summits from OpenStreetMap/USGS, "The Horn" from the club's
 * own Gorham turnpoint set (soaringweb.org, via public/files/gorham-waypoints.cup),
 * the Crescent Range point from the club's Gorham Google Earth placemarks, and the
 * field itself from the site's flights globe.
 *
 * Run from the repo root:  node scripts/build-nav-3d-map.mjs
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
const SCRATCH = join(ROOT, ".screenshots", "nav3d");
const TILE_DIR = join(SCRATCH, "tiles");
const OUT_WEBP = join(ROOT, "public", "images", "reading", "white-mountains-3d.webp");
const OUT_FULL = join(ROOT, "public", "images", "reading", "white-mountains-3d-full.png");

const TILE_HOST = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium";
const ZOOM = 13;
const TILE_SIZE = 256;

/** DEM box: the features plus their terrain context, a little margin all round. */
const BOUNDS = { west: -71.62, south: 44.125, east: -70.96, north: 44.67 };

/** Master render size — display webp is half this, the "View larger" PNG is the master.
 * NAV3D_WIDTH/HEIGHT override it for quick preview renders while tuning the view. */
const MASTER = {
  width: Number(process.env.NAV3D_WIDTH) || 2800,
  height: Number(process.env.NAV3D_HEIGHT) || 1750,
};
const DISPLAY_WIDTH = 1400;

/**
 * Camera and stylisation. The eye sits southeast of Wildcat looking northwest up
 * the valley — the view a pilot has climbing out toward the wave, with the ravine
 * faces and the gulf's mouth turned toward the viewer.
 */
const VIEW = {
  eye: { lat: 44.102, lon: -70.995, alt: 15600 },
  target: { lat: 44.375, lon: -71.312, alt: 150 },
  fov: 26.5,
  exaggeration: 1.45,
  /** Light from the west-southwest, so the southeast faces read; tuned by eye. */
  light: { azimuth: 236, elevation: 39 },
  /** Distance fade toward the page's haze so depth reads without going grey. The
   * far edge of the DEM disappears into it (terrain past fadeEnd is pure haze). */
  haze: { color: [227, 235, 243], fadeStartM: 46000, fadeEndM: 82000 },
};

/**
 * The landmarks the section's lede names, plus the field itself as the anchor.
 * `offset` is where the text sits relative to the point, in master pixels (y down),
 * tuned against the render; `leader` draws a fine line back to the point.
 */
const LABELS = [
  { name: "Mount Washington", kind: "summit", lat: 44.27049, lon: -71.3033, offset: [-24, 72], align: "right" },
  { name: "Mount Jefferson", kind: "summit", lat: 44.30423, lon: -71.31675, offset: [-46, 18], align: "right" },
  { name: "Mount Madison", kind: "summit", lat: 44.32879, lon: -71.27667, offset: [40, 34], align: "left" },
  { name: "The Horn", kind: "summit", lat: 44.29483, lon: -71.279, offset: [36, 30], align: "left" },
  { name: "Tuckerman's Ravine", kind: "area", lat: 44.2605, lon: -71.292, offset: [-60, 90], align: "right" },
  { name: "Huntington Ravine", kind: "area", lat: 44.2745, lon: -71.2805, offset: [14, 64], align: "left" },
  { name: "The Great Gulf", kind: "area", lat: 44.2975, lon: -71.3095, offset: [30, 42], align: "left", alpha: 0.92 },
  { name: "Carter Dome", kind: "summit", lat: 44.2674, lon: -71.17912, offset: [28, 54], align: "left" },
  { name: "Wildcat Mountain", kind: "summit", lat: 44.2592, lon: -71.20161, offset: [-30, 54], align: "right" },
  { name: "Mount Moriah", kind: "summit", lat: 44.34053, lon: -71.13172, offset: [24, 30], align: "left" },
  { name: "Mount Hayes", kind: "summit", lat: 44.41566, lon: -71.15986, offset: [-30, -52], align: "right" },
  { name: "Pine Mountain", kind: "summit", lat: 44.36588, lon: -71.21519, offset: [-10, 96], align: "center" },
  { name: "Crescent Range", kind: "range", lat: 44.438, lon: -71.302, offset: [0, -24], align: "center" },
  { name: "Pilot Range", kind: "range", lat: 44.5285, lon: -71.4185, offset: [0, -24], align: "center" },
  { name: "Gorham 2G8", kind: "field", lat: 44.39472, lon: -71.19805, offset: [22, 44], align: "left" },
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

/* ----------------------------------- dem ------------------------------------ */

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
          elevations[dst + px] =
            data[o] * 256 + data[o + 1] + data[o + 2] / 256 - 32768;
        }
      }
    }
    done += cols;
    if ((ty + 1) % 2 === 0 || ty + 1 === rows) {
      process.stdout.write(`\r  ${done}/${cols * rows} tiles …`);
    }
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
  console.log(`dem: ${width}x${height}px, ${meta.lonStep * 79500 | 0}m EW x ${meta.latStep * 111195 | 0}m NS per px`);
  return meta;
}

/* --------------------------------- harness ---------------------------------- */

function harnessHtml() {
  // Everything the page needs is inlined except the DEM binary, which the little
  // static server beside it hands over.
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>html,body{margin:0;background:#eef3f8}canvas{display:block}</style></head>
<body><canvas id="c"></canvas><script>
const VIEW = ${JSON.stringify(VIEW)};
const DEBUG = ${process.env.NAV3D_DEBUG ? "true" : "false"};
const BOUNDS = ${JSON.stringify(BOUNDS)};
const LABELS = ${JSON.stringify(LABELS)};
const MASTER = ${JSON.stringify(MASTER)};
const RAMP = [[150,[52,76,60]],[400,[84,108,74]],[650,[122,132,88]],[900,[160,148,108]],[1150,[172,146,116]],[1400,[166,162,164]],[1650,[210,210,212]],[1950,[238,239,242]]]; // src/lib/relief.ts

const M_PER_LON = 111194.93 * Math.cos(44.38 * Math.PI / 180);
const M_PER_LAT = 111194.93;
const ORIGIN = { lat: 44.38, lon: -71.275 };

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
  const meta = await (await fetch("dem.json")).json();
  const dem = new Float32Array(await (await fetch("dem.bin")).arrayBuffer());
  const { width: W, height: H, west, north, lonStep, latStep } = meta;

  // Local metres frame (x east, y north) with elevations scaled by the exaggeration.
  const K = VIEW.exaggeration;
  const toXY = (lat, lon) => [ (lon - ORIGIN.lon) * M_PER_LON, (lat - ORIGIN.lat) * M_PER_LAT ];
  const hAt = (xm, ym) => {
    const mx = (xm / M_PER_LON + ORIGIN.lon - west) / lonStep;
    const my = (north - (ym / M_PER_LAT + ORIGIN.lat)) / latStep;
    const fx = Math.min(Math.max(mx, 0), W - 1.001), fy = Math.min(Math.max(my, 0), H - 1.001);
    const ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
    const i = iy * W + ix;
    return (dem[i] * (1 - tx) * (1 - ty) + dem[i + 1] * tx * (1 - ty) +
            dem[i + W] * (1 - tx) * ty + dem[i + W + 1] * tx * ty) * K;
  };

  const cam = (() => {
    const [ex, ey] = toXY(VIEW.eye.lat, VIEW.eye.lon);
    const [tx, ty] = toXY(VIEW.target.lat, VIEW.target.lon);
    const ez = VIEW.eye.alt * K, tz = VIEW.target.alt * K;
    let fx = tx - ex, fy = ty - ey, fz = tz - ez;
    const fl = Math.hypot(fx, fy, fz);
    fx /= fl; fy /= fl; fz /= fl;
    // right = normalize(forward × up), up = right × forward — screen x grows right.
    const rl = Math.hypot(fy, -fx) || 1;
    const rx = fy / rl, ry = -fx / rl, rz = 0;
    const ux = ry * fz - rz * fy, uy = rz * fx - rx * fz, uz = rx * fy - ry * fx;
    return { ex, ey, ez, fx, fy, fz, rx, ry, rz, ux, uy, uz, tanHalf: Math.tan(VIEW.fov * Math.PI / 360) };
  })();

  const azRad = (90 - VIEW.light.azimuth) * Math.PI / 180;
  const light = [
    Math.sin(azRad) * Math.cos(VIEW.light.elevation * Math.PI / 180),
    Math.cos(azRad) * Math.cos(VIEW.light.elevation * Math.PI / 180),
    Math.sin(VIEW.light.elevation * Math.PI / 180),
  ];
  // Light vector is expressed in the exaggerated world; normals below match it.
  light[2] /= K;

  const canvas = document.getElementById("c");
  canvas.width = MASTER.width; canvas.height = MASTER.height;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(MASTER.width, MASTER.height);
  const px = img.data;
  const aspect = MASTER.width / MASTER.height;
  const tanHalfX = cam.tanHalf * aspect;

  const XMIN = -60000, XMAX = 60000, YMIN = -60000, YMAX = 60000; // generous local frame

  const t0 = performance.now();
  let idx = 0;
  for (let sy = 0; sy < MASTER.height; sy += 1) {
    const ndcY = 1 - (2 * (sy + 0.5)) / MASTER.height;
    for (let sx = 0; sx < MASTER.width; sx += 1) {
      const ndcX = (2 * (sx + 0.5)) / MASTER.width - 1;
      let dx = cam.fx + cam.rx * ndcX * tanHalfX + cam.ux * ndcY * cam.tanHalf;
      let dy = cam.fy + cam.ry * ndcX * tanHalfX + cam.uy * ndcY * cam.tanHalf;
      let dz = cam.fz + cam.rz * ndcX * tanHalfX + cam.uz * ndcY * cam.tanHalf;
      const dl = Math.hypot(dx, dy, dz); dx /= dl; dy /= dl; dz /= dl;

      // March the heightfield: steps scale with the ray's clearance above the
      // terrain, so the approach stays dense and the high passes stay cheap. A
      // deterministic sub-step jitter turns grazing-ray terracing into fine grain.
      let t = 260 + ((sx * 2654435761 + sy * 40503) % 97) * 0.5, hit = -1, lastT = t, iterations = 0;
      const maxT = 125000; // beyond the haze, everything reads as air
      while (t < maxT && iterations < 6000) {
        iterations += 1;
        const xx = cam.ex + dx * t, yy = cam.ey + dy * t, zz = cam.ez + dz * t;
        if (xx < XMIN || xx > XMAX || yy < YMIN || yy > YMAX) break;
        const h = hAt(xx, yy);
        if (zz <= h) {
          // Bisect between the last free sample and this one.
          let lo = lastT, hi = t;
          for (let b = 0; b < 9; b += 1) {
            const mid = (lo + hi) / 2;
            const mx = cam.ex + dx * mid, my = cam.ey + dy * mid, mz = cam.ez + dz * mid;
            if (mz <= hAt(mx, my)) hi = mid; else lo = mid;
          }
          hit = hi;
          break;
        }
        lastT = t;
        t += Math.max(13, Math.min(0.85 * (zz - h), t * 0.05, 45));
      }

      if (hit < 0) {
        const hz = VIEW.haze.color;
        px[idx] = hz[0]; px[idx + 1] = hz[1]; px[idx + 2] = hz[2]; px[idx + 3] = 255;
        idx += 4;
        continue;
      }

      const hx = cam.ex + dx * hit, hy = cam.ey + dy * hit, hz = cam.ez + dz * hit;
      const e = 14; // metres for the normal sample
      const sxp = hAt(hx + e, hy), sxm = hAt(hx - e, hy);
      const syp = hAt(hx, hy + e), sym = hAt(hx, hy - e);
      // Normal in the exaggerated world (z spans e*(2e/2e)… slopes in exaggerated space).
      let nx = -(sxp - sxm) / (2 * e), ny = -(syp - sym) / (2 * e), nz = 1;
      const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
      const shade = Math.min(Math.max(nx * light[0] + ny * light[1] + nz * light[2], 0), 1);

      // True elevation for the colour ramp (the exaggeration is for form, not climate).
      const elevation = hz / K;
      const c = reliefColour(elevation, 0.25 + 0.9 * shade);
      const fade = Math.min(Math.max((hit - VIEW.haze.fadeStartM) / (VIEW.haze.fadeEndM - VIEW.haze.fadeStartM), 0), 1);
      px[idx] = c[0] + (VIEW.haze.color[0] - c[0]) * fade;
      px[idx + 1] = c[1] + (VIEW.haze.color[1] - c[1]) * fade;
      px[idx + 2] = c[2] + (VIEW.haze.color[2] - c[2]) * fade;
      px[idx + 3] = 255;
      idx += 4;
    }
  }
  console.log("march", ((performance.now() - t0) / 1000).toFixed(1) + "s");
  ctx.putImageData(img, 0, 0);

  // ------------------------------- labels ---------------------------------
  const toScreen = (lat, lon, zK) => {
    const [xm, ym] = toXY(lat, lon);
    const vx = xm - cam.ex, vy = ym - cam.ey, vz = zK - cam.ez;
    const tz = vx * cam.fx + vy * cam.fy + vz * cam.fz;
    if (tz <= 1) return null;
    const sx = vx * cam.rx + vy * cam.ry + vz * cam.rz;
    const sy = vx * cam.ux + vy * cam.uy + vz * cam.uz;
    return [MASTER.width / 2 + (sx / (tz * tanHalfX)) * MASTER.width / 2,
            MASTER.height / 2 - (sy / (tz * cam.tanHalf)) * MASTER.height / 2];
  };
  // Snap a summnut label to the local crest so the dot sits on the summit.
  const snap = (lat, lon) => {
    const [xm, ym] = toXY(lat, lon);
    let best = -1e9, blat = lat, blon = lon;
    for (let dLat = -0.0026; dLat <= 0.0026; dLat += 0.00035) {
      for (let dLon = -0.0026; dLon <= 0.0026; dLon += 0.00035) {
        const la = lat + dLat, lo = lon + dLon;
        const mx = ((lo - west) / lonStep) | 0, my = ((north - la) / latStep) | 0;
        if (mx < 1 || my < 1 || mx >= W - 1 || my >= H - 1) continue;
        const h = dem[my * W + mx];
        if (h > best) { best = h; blat = la; blon = lo; }
      }
    }
    return [blat, blon, best * K];
  };

  const FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';
  const drawText = (text, x, y, font, fill, align, halo = 4.5, italic = false) => {
    ctx.font = (italic ? "italic " : "") + font;
    ctx.textAlign = align; ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(255,255,255,0.92)";
    ctx.lineWidth = halo;
    ctx.strokeText(text, x, y);
    ctx.fillStyle = fill;
    ctx.fillText(text, x, y);
  };

  ctx.lineCap = "round";
  // Layout numbers below are authored against the 2800px master and scale with it.
  const S = MASTER.width / 2800;
  const anchors = {};
  for (const label of LABELS) {
    const [blat, blon, bz] = label.kind === "summit" || label.kind === "field" ? snap(label.lat, label.lon) : [label.lat, label.lon, hAt(...toXY(label.lat, label.lon))];
    const p = toScreen(blat, blon, bz);
    if (!p) continue;
    const [sx, sy] = p;
    anchors[label.name] = [Math.round(sx), Math.round(sy)];
    const tx = sx + label.offset[0] * S, ty = sy + label.offset[1] * S;
    const align = label.align;

    if (label.kind === "summit") {
      // Triangle glyph at the summit, leader to the name when it sits aside.
      ctx.beginPath();
      ctx.moveTo(sx, sy - 11 * S); ctx.lineTo(sx - 10 * S, sy + 7 * S); ctx.lineTo(sx + 10 * S, sy + 7 * S); ctx.closePath();
      ctx.fillStyle = "#1e293b"; ctx.strokeStyle = "rgba(255,255,255,0.95)"; ctx.lineWidth = 4 * S;
      ctx.stroke(); ctx.fill();
      if (label.offset[0] !== 0 || label.offset[1] !== 0) {
        ctx.beginPath(); ctx.moveTo(sx, sy + 4 * S); ctx.lineTo(tx - (align === "right" ? 12 : -12) * S, ty);
        ctx.strokeStyle = "rgba(30,41,59,0.45)"; ctx.lineWidth = 2.4 * S; ctx.stroke();
      }
      drawText(label.name, tx, ty, "600 " + 42 * S + "px " + FONT, "#0f172a", align, 7 * S);
    } else if (label.kind === "field") {
      ctx.beginPath();
      ctx.arc(sx, sy, 13 * S, 0, Math.PI * 2);
      ctx.fillStyle = "#0ea5e9"; ctx.strokeStyle = "rgba(255,255,255,0.95)"; ctx.lineWidth = 4.5 * S;
      ctx.stroke(); ctx.fill();
      drawText(label.name, tx, ty, "700 " + 43 * S + "px " + FONT, "#0f172a", align, 7 * S);
    } else if (label.kind === "area") {
      // A fine leader ties each named area to its point on the ground.
      const endX = align === "right" ? tx + 10 * S : align === "left" ? tx - 10 * S : tx;
      const endY = align === "center" ? ty - 16 * S : ty;
      if (Math.hypot(endX - sx, endY - sy) > 24 * S) {
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(endX, endY);
        ctx.strokeStyle = "rgba(30,41,59,0.38)"; ctx.lineWidth = 2 * S; ctx.stroke();
      }
      drawText(label.name, tx, ty, "600 " + 38 * S + "px " + FONT, "rgba(15,23,42," + (label.alpha ?? 0.85) + ")", align, 6 * S, true);
    } else {
      drawText(label.name, tx, ty, "600 " + 37 * S + "px " + FONT, "rgba(51,65,85,0.95)", align, 6 * S, true);
    }
  }

  // North arrow, bottom right; scale bar, bottom left.
  const margin = 48 * S;
  const nx = MASTER.width - margin - 46 * S, ny = MASTER.height - margin - 150 * S;
  ctx.beginPath(); ctx.moveTo(nx, ny); ctx.lineTo(nx - 16 * S, ny + 52 * S); ctx.lineTo(nx, ny + 39 * S); ctx.lineTo(nx + 16 * S, ny + 52 * S); ctx.closePath();
  ctx.fillStyle = "#1e293b"; ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 5 * S;
  ctx.stroke(); ctx.fill();
  drawText("N", nx, ny + 80 * S, "700 " + 38 * S + "px " + FONT, "#1e293b", "center", 6 * S);

  // Debug overlay: a half-degree graticule and each label's projected anchor —
  // used while tuning the view, kept for the next person who moves the camera.
  if (DEBUG) {
    ctx.strokeStyle = "rgba(220, 38, 38, 0.55)";
    ctx.lineWidth = 1.5;
    for (let lat = 44.1; lat <= 44.7; lat += 0.05) {
      let prev = null;
      for (let lon = BOUNDS.west; lon <= BOUNDS.east; lon += 0.005) {
        const p = toScreen(lat, lon, hAt(...toXY(lat, lon)));
        if (p && prev) { ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(p[0], p[1]); ctx.stroke(); }
        prev = p;
      }
      const edge = toScreen(lat, BOUNDS.west, hAt(...toXY(lat, BOUNDS.west)));
      if (edge) drawText(lat.toFixed(2), edge[0] + 4, edge[1], "600 22px " + FONT, "#dc2626", "left", 3);
    }
    for (let lon = -71.6; lon <= -70.9; lon += 0.05) {
      let prev = null;
      for (let lat = BOUNDS.south; lat <= BOUNDS.north; lat += 0.005) {
        const p = toScreen(lat, lon, hAt(...toXY(lat, lon)));
        if (p && prev) { ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(p[0], p[1]); ctx.stroke(); }
        prev = p;
      }
    }
    for (const label of LABELS) {
      const [blat, blon, bz] = label.kind === "summit" || label.kind === "field"
        ? snap(label.lat, label.lon)
        : [label.lat, label.lon, hAt(...toXY(label.lat, label.lon))];
      const p = toScreen(blat, blon, bz);
      if (!p) continue;
      ctx.fillStyle = "#dc2626";
      ctx.beginPath(); ctx.arc(p[0], p[1], 4, 0, Math.PI * 2); ctx.fill();
      drawText(label.name.slice(0, 9), p[0] + 8, p[1] - 14, "600 20px " + FONT, "#dc2626", "left", 3);
    }
  }

  const scaleM = 10000;
  const [sx0, sy0] = toXY(VIEW.target.lat, VIEW.target.lon);
  const p0 = toScreen(VIEW.target.lat, VIEW.target.lon, hAt(sx0, sy0));
  const p1 = toScreen(VIEW.target.lat, VIEW.target.lon + scaleM / M_PER_LON, hAt(sx0, sy0));
  if (p0 && p1) {
    const barLen = Math.abs(p1[0] - p0[0]);
    const bx = margin + 16 * S, by = MASTER.height - margin - 34 * S;
    ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 10 * S;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + barLen, by); ctx.stroke();
    ctx.strokeStyle = "#1e293b"; ctx.lineWidth = 4.5 * S;
    ctx.beginPath(); ctx.moveTo(bx, by - 14 * S); ctx.lineTo(bx, by + 14 * S); ctx.moveTo(bx + barLen, by - 14 * S); ctx.lineTo(bx + barLen, by + 14 * S); ctx.stroke();
    drawText("10 km", bx + barLen / 2, by - 39 * S, "600 " + 35 * S + "px " + FONT, "#1e293b", "center", 6 * S);
  }

  window.__anchors = anchors;
  window.__done = true;
}
main().catch((e) => { window.__error = String(e && e.stack || e); });
</script></body></html>`;
}

/* ------------------------------ cdp capture --------------------------------- */

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

async function capture(port) {
  const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const dbgPort = 9444;
  // The profile lives in the system temp dir: Chrome writes extension bundles into
  // it, and inside the repo those would land in eslint's scan.
  const profile = await mkdtemp(join(tmpdir(), "nav3d-chrome-"));
  const chrome = spawn(CHROME, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check",
    `--remote-debugging-port=${dbgPort}`,
    `--user-data-dir=${profile}`,
    `--window-size=${MASTER.width},${MASTER.height}`,
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
    await send(ws, "Emulation.setDeviceMetricsOverride",
      { width: MASTER.width, height: MASTER.height, deviceScaleFactor: 1, mobile: false }, sessionId);
    await send(ws, "Page.navigate", { url: `http://127.0.0.1:${port}/` }, sessionId);

    const deadline = Date.now() + 15 * 60 * 1000;
    for (;;) {
      const { result } = await send(ws, "Runtime.evaluate",
        { expression: "window.__done ? JSON.stringify(window.__anchors || {}) : (window.__error || 'waiting')", returnByValue: true }, sessionId);
      if (result.value && result.value !== "waiting") {
        try {
          const anchors = JSON.parse(result.value);
          console.log("anchors:", JSON.stringify(anchors));
          break;
        } catch {
          throw new Error(String(result.value));
        }
      }
      if (Date.now() > deadline) throw new Error("render timed out");
      await sleep(1000);
    }

    const shot = await send(ws, "Page.captureScreenshot", { format: "png", captureBeyondViewport: false }, sessionId);
    ws.close();
    return Buffer.from(shot.data, "base64");
  } finally {
    chrome.kill("SIGKILL");
  }
}

/* ---------------------------------- main ------------------------------------ */

async function main() {
  mkdirSync(SCRATCH, { recursive: true });
  await buildDem();
  writeFileSync(join(SCRATCH, "index.html"), harnessHtml());

  const { server, port } = await serve();
  let png;
  try {
    console.log(`capturing ${MASTER.width}x${MASTER.height} …`);
    png = await capture(port);
  } finally {
    server.close();
  }
  writeFileSync(join(SCRATCH, "render.png"), png);

  if (process.env.NAV3D_PREVIEW_ONLY) {
    console.log("preview only — render kept at", join(SCRATCH, "render.png"));
    return;
  }

  await sharp(png).resize({ width: DISPLAY_WIDTH }).webp({ quality: 82 }).toFile(OUT_WEBP);
  // The "View larger" master: 256-colour PNG with dithering — a quarter of the
  // 24-bit size and, over this much terrain texture, indistinguishable.
  await sharp(png)
    .png({ compressionLevel: 9, palette: true, colours: 256, dither: 1 })
    .toFile(OUT_FULL);
  console.log("wrote", OUT_WEBP);
  console.log("wrote", OUT_FULL);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
