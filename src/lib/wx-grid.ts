// Pure grid/level constants shared by the site and the WRF pipeline. No imports
// here on purpose: scripts/write-wrf-contract.mts imports this file with plain
// node type-stripping, and wrf/scripts/export-grid.mts consumes the generated
// public/wrf-contract.json — one definition, so the model grid cannot drift from
// the site's.

/** The LOA's Mount Washington Glider Area centre — 44°17′26″N 071°13′40″W. */
export const GLIDER_AREA = { lat: 44.290556, lon: -71.227778 };
export const AREA_RADIUS_NM = 10;
export const KM_PER_NM = 1.852;
export const WINDOW_KM = AREA_RADIUS_NM * KM_PER_NM;

/** The HRRR field's own transect — 15 points across the window. */
export const MODEL_DISTANCES = Array.from(
  { length: 15 },
  (_, i) => -WINDOW_KM + (i * 2 * WINDOW_KM) / 14,
);
export const CROSS_LEVELS = [950, 900, 850, 800, 700, 600, 500, 400, 300, 250, 200, 150];

/**
 * The map's model grid — 19 x 13 (~2.7 km east-west, ~3.9 km north-south) over Gorham,
 * the Presidential Range, Bartlett and the LOA circle's reach. Sized so a fully cold
 * page stays inside Open-Meteo's ~600 locations-per-minute budget (~540 all told).
 */
export const MAP_COLS = 19;
export const MAP_ROWS = 13;
export const MAP_LAT_MIN = 44.06;
export const MAP_LAT_SPAN = 0.42;
export const MAP_LON_MIN = -71.55;
export const MAP_LON_SPAN = 0.604;
export const MAP_GRID = (() => {
  const points: { lat: number; lon: number }[] = [];
  for (let row = 0; row < MAP_ROWS; row += 1) {
    for (let col = 0; col < MAP_COLS; col += 1) {
      points.push({
        lat: MAP_LAT_MIN + (row * MAP_LAT_SPAN) / (MAP_ROWS - 1),
        lon: MAP_LON_MIN + (col * MAP_LON_SPAN) / (MAP_COLS - 1),
      });
    }
  }
  return points;
})();
export const MAP_LEVELS = [
  { ft: 3000, hPa: 900 },
  { ft: 7000, hPa: 800 },
  { ft: 10000, hPa: 700 },
  { ft: 16000, hPa: 550 },
  { ft: 23000, hPa: 400 },
];

/** 5°-rounded wind azimuths bucket the terrain lines (they never move — cache per bucket). */
export const azimuthBucket = (azimuth: number) => (Math.round(azimuth / 5) * 5) % 360;

/** A point offset along a transect azimuth (degrees from north) by dKm from `from`. */
export function alongTransect(from: { lat: number; lon: number }, azimuthDeg: number, dKm: number) {
  const az = (azimuthDeg * Math.PI) / 180;
  return {
    lat: from.lat + (Math.cos(az) * dKm) / 111,
    lon: from.lon + (Math.sin(az) * dKm) / (111 * Math.cos((from.lat * Math.PI) / 180)),
  };
}
