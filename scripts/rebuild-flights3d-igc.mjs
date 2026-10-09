#!/usr/bin/env node
/**
 * Rebuild public/data/flights3d/*.json from the original IGC files — the
 * highest-resolution source for each flight — falling back to the trace already
 * in the file when no IGC is present.
 *
 * IGCs are downloaded from WeGlide into .screenshots/igc/<flightId>.igc
 * (gitignored scratch). Each B-record carries a position every one to four
 * seconds; we keep the GNSS altitude and decimate only very long traces.
 *
 * Run from anywhere:  node scripts/rebuild-flights3d-igc.mjs
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const IGC_DIR = join(ROOT, ".screenshots", "igc");
const DATA_DIR = join(ROOT, "public", "data", "flights3d");
const CAP = 3500;

/** B-records: B HHMMSS DDMMmmm{N,S} DDDMMmmm{E,W} A PPPPP GGGGG … */
function parseIgc(path) {
  const pts = [];
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    if (line[0] !== "B" || line.length < 35) continue;
    if (line[24] !== "A") continue; // land-out / invalid fix
    const lat = Number(line.slice(7, 9)) + Number(line.slice(9, 14)) / 1000 / 60;
    const lon = Number(line.slice(15, 18)) + Number(line.slice(18, 23)) / 1000 / 60;
    const gnss = Number(line.slice(30, 35));
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(gnss)) continue;
    const latSigned = line[14] === "S" ? -lat : lat;
    const lonSigned = line[23] === "W" ? -lon : lon;
    pts.push([round5(lonSigned), round5(latSigned), Math.round(gnss)]);
  }
  if (pts.length < 2) return null;
  if (pts.length > CAP) {
    const stride = Math.ceil(pts.length / CAP);
    const out = pts.filter((_, i) => i % stride === 0);
    if (out[out.length - 1] !== pts[pts.length - 1]) out.push(pts[pts.length - 1]);
    return out;
  }
  return pts;
}

const round5 = (v) => Math.round(v * 1e5) / 1e5;

let igcCount = 0;
for (const name of readdirSync(DATA_DIR).filter((f) => f.endsWith(".json")).sort()) {
  const path = join(DATA_DIR, name);
  const data = JSON.parse(readFileSync(path, "utf8"));
  let used = 0;
  for (const flight of data.flights) {
    const igc = join(IGC_DIR, `${flight.id}.igc`);
    if (!existsSync(igc)) continue;
    const pts = parseIgc(igc);
    if (!pts) continue;
    flight.pts = pts;
    used += 1;
  }
  writeFileSync(path, JSON.stringify(data));
  igcCount += used;
  console.log(`${name}: ${data.flights.length} flights, ${used} rebuilt from IGC`);
}
console.log(`total ${igcCount} tracks from IGC`);
