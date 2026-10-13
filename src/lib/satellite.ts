// The satellite panels' shared geography.

/** The polar-pass snapshot box — must match the request the /api/satellite/polar route makes. */
export const POLAR_BBOX = { west: -77, south: 40.5, east: -65, north: 48.2 };
export const POLAR_SIZE = { width: 2400, height: 1540 };

export function polarBboxString(): string {
  return `${POLAR_BBOX.west},${POLAR_BBOX.south},${POLAR_BBOX.east},${POLAR_BBOX.north}`;
}

/** Gorham Municipal Airport (2G8) — the wave camp's home field. */
export const GORHAM = { lat: 44.3939, lon: -71.194 };

/** Gorham's pixel in the polar-pass render (EPSG:4326 — exact by construction). */
export function polarPinPixels(): { x: number; y: number } {
  return {
    x: ((GORHAM.lon - POLAR_BBOX.west) / (POLAR_BBOX.east - POLAR_BBOX.west)) * POLAR_SIZE.width,
    y:
      ((POLAR_BBOX.north - GORHAM.lat) / (POLAR_BBOX.north - POLAR_BBOX.south)) *
      POLAR_SIZE.height,
  };
}

/**
 * Gorham's pixel in the GOES Northeast sector image (2400×2400).
 *
 * The sector is an ABI fixed-grid crop — a geostationary projection no corner box can
 * describe — so this was calibrated against the drawn state and national borders in a
 * clear-sky sector image: the 45th-parallel segment, the VT/NH and NH/ME border lines,
 * and the coastline were matched to their real coordinates, and the persistent estimate
 * (border math and an iterative coastline fit agree) lands Gorham just
 * north-west of the White Mountains. Accurate to roughly ±20 px, ~3 px at panel scale.
 */
export const GOES_PIN_PIXELS = { x: 1605, y: 1029 };

export const GOES_SIZE = { width: 2400, height: 2400 };
