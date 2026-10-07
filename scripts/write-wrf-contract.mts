// Emit public/wrf-contract.json from src/lib/wx-grid.ts — the single source the
// WRF pipeline reads (wrf/scripts/export-grid.mts) so the model grid and pressure
// levels can never drift from the site's.
import { writeFile } from "node:fs/promises";
import path from "node:path";
import {
  CROSS_LEVELS,
  GLIDER_AREA,
  MAP_GRID,
  MAP_LEVELS,
  MODEL_DISTANCES,
} from "../src/lib/wx-grid.ts";

const contract = {
  schema: 1,
  map_levels_hpa: MAP_LEVELS.map((entry) => entry.hPa),
  cross_levels_hpa: CROSS_LEVELS,
  map_points: MAP_GRID.map((p) => [Number(p.lat.toFixed(6)), Number(p.lon.toFixed(6))]),
  model_distances_km: MODEL_DISTANCES.map((d) => Number(d.toFixed(4))),
  glider_area: [GLIDER_AREA.lat, GLIDER_AREA.lon],
  azimuth_buckets: Array.from({ length: 72 }, (_, i) => i * 5),
};

const out = path.join(import.meta.dirname, "..", "public", "wrf-contract.json");
await writeFile(out, `${JSON.stringify(contract, null, 1)}\n`);
console.log(
  `wrote ${out} — ${contract.map_points.length} map points, ` +
    `${contract.cross_levels_hpa.length} cross levels, ${contract.azimuth_buckets.length} buckets`,
);
