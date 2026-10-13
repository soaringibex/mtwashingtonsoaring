#!/usr/bin/env node
/**
 * Build public/data/flights/three-ways-into-the-wave.json — the track and the
 * phase breakdown behind the /stories/three-ways-into-the-wave page.
 *
 * Source: the pilot's own IGC (1-second fixes), kept in .screenshots/igc/1253598.igc
 * as gitignored scratch. We keep every fourth fix — 4 s is ~120 m at cruise and
 * plenty for a ribbon over terrain — with GNSS altitude in metres.
 *
 * The phase boundaries are read off the barogram (see the article): the tow ends
 * at 12:18:02 local, the low point is 1,857 ft at 12:35, the crossing of the
 * valley runs 12:55–13:02, and the top is 7,943 ft at 13:24:10.
 *
 * Run from the repo root:  node scripts/build-flight-story.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const IGC = join(ROOT, ".screenshots", "igc", "1253598.igc");
const OUT_DIR = join(ROOT, "public", "data", "flights");
const OUT = join(OUT_DIR, "three-ways-into-the-wave.json");

const FLIGHT_DATE_UTC = Date.UTC(2026, 9, 12) / 1000; // 2026-10-12T00:00Z
const UTC_OFFSET_HOURS = -4; // America/New_York in October (EDT)
const STRIDE = 4; // keep every 4th 1-second fix

/** B-records: B HHMMSS DDMMmmm{N,S} DDDMMmmm{E,W} A PPPPP GGGGG … */
function parseIgc(path) {
  const pts = [];
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    if (line[0] !== "B" || line.length < 35) continue;
    if (line[24] !== "A") continue;
    const hh = Number(line.slice(1, 3));
    const mm = Number(line.slice(3, 5));
    const ss = Number(line.slice(5, 7));
    const lat = Number(line.slice(7, 9)) + Number(line.slice(9, 14)) / 1000 / 60;
    const lon = Number(line.slice(15, 18)) + Number(line.slice(18, 23)) / 1000 / 60;
    const gnss = Number(line.slice(30, 35));
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(gnss)) continue;
    const latSigned = line[14] === "S" ? -lat : lat;
    const lonSigned = line[23] === "W" ? -lon : lon;
    pts.push({
      t: FLIGHT_DATE_UTC + hh * 3600 + mm * 60 + ss,
      lon: Math.round(lonSigned * 1e5) / 1e5,
      lat: Math.round(latSigned * 1e5) / 1e5,
      alt: Math.round(gnss),
    });
  }
  return pts;
}

/** "12:55:10" local on 2026-10-12 → unix seconds UTC. */
const local = (hh, mm, ss = 0) => FLIGHT_DATE_UTC + (hh - UTC_OFFSET_HOURS) * 3600 + mm * 60 + ss;

const PHASES = [
  {
    id: "tow",
    label: "The tow — and the sinking",
    tone: "context",
    from: local(12, 12, 24),
    to: local(12, 27, 0),
    note: "A direct tow toward the primary, released at 4,300 ft into air that wasn't working yet. It went nowhere.",
  },
  {
    id: "ridge",
    label: "Ridge work, down low",
    tone: "key",
    from: local(12, 27, 0),
    to: local(12, 55, 10),
    note: "Down to 1,857 ft, working the northwest-facing flank of the Moriah–Carter ridge in ridge lift and the odd scrap of rotor.",
  },
  {
    id: "transit",
    label: "Below the rotor, across the valley",
    tone: "key",
    from: local(12, 55, 10),
    to: local(13, 0, 0),
    note: "West across the valley beneath the rotor for the lee of the Presidential range, bottoming out at 3,200 ft.",
  },
  {
    id: "rotor",
    label: "The rotor climb — circling",
    tone: "key",
    from: local(13, 0, 0),
    to: local(13, 11, 50),
    note: "Circling out of the valley in the rotor's turbulent air, 3,500 to 5,700 ft in twelve minutes.",
  },
  {
    id: "wave",
    label: "The wave climb — back and forth",
    tone: "key",
    from: local(13, 11, 50),
    to: local(13, 19, 50),
    note: "Reaching the top of the rotor and pushing upwind into the primary wave: long legs back and forth across the lift, 5,700 to 7,600 ft.",
  },
  {
    id: "upwind",
    label: "Upwind into the primary",
    tone: "key",
    from: local(13, 19, 50),
    to: local(13, 25, 0),
    note: "The push upwind through the strongest part of the wave, topping out at 7,943 ft near The Horn.",
  },
  {
    id: "home",
    label: "Home",
    tone: "context",
    from: local(13, 25, 0),
    to: local(13, 36, 30),
    note: "Downwind and down ahead of the recall, with the wave still building behind.",
  },
];

const all0 = parseIgc(IGC);
if (all0.length < 100) throw new Error(`only ${all0.length} fixes parsed from ${IGC}`);
// Trim the post-landing roll-out to the actual end of the flight.
const END_LOCAL = local(13, 36, 40);
const lastIdx = all0.findIndex((p) => p.t > END_LOCAL);
const all = lastIdx > 100 ? all0.slice(0, lastIdx) : all0;
const last = all[all.length - 1];

const points = all.filter((_, i) => i % STRIDE === 0);
if (points[points.length - 1] !== last) points.push(last);

const maxAltM = Math.max(...all.map((p) => p.alt));
const track = {
  id: 1253598,
  date: "2026-10-12",
  pilot: "Thomas Van de Velde",
  aircraft: "ASG 29 18m",
  takeoff: all[0].t,
  landing: last.t,
  maxAltFt: Math.round(maxAltM * 3.28084),
  utcOffsetHours: UTC_OFFSET_HOURS,
  /** [lon, lat, GNSS alt (m), unix seconds] every ~4 s. */
  points: points.map((p) => [p.lon, p.lat, p.alt, p.t]),
  phases: PHASES,
};

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT, JSON.stringify(track));
console.log(
  `${OUT}: ${points.length} points (${all.length} fixes, 1/${STRIDE} kept), ` +
    `${PHASES.length} phases, max ${track.maxAltFt} ft`,
);
