// The wave map's terrain base. AWS Terrain Tiles (Terrarium-encoded PNGs, ~55 m per
// pixel at zoom 11) come through our own /api/terrain route, decode into one elevation
// mosaic, and feed the shaded-relief canvas and its contour lines.

export const TILE_SIZE = 256;
const TERRAIN_ZOOM = 11;

const lonToTileX = (lon: number, zoom: number) => ((lon + 180) / 360) * 2 ** zoom;
const latToTileY = (lat: number, zoom: number) => {
  const rad = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** zoom;
};
const tileXToLon = (x: number, zoom: number) => (x / 2 ** zoom) * 360 - 180;
const tileYToLat = (y: number, zoom: number) => {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** zoom;
  return (180 / Math.PI) * Math.atan(Math.sinh(n));
};

export type TerrainMosaic = {
  /** Elevation in metres, row-major, north to south. */
  elevations: Float32Array;
  width: number;
  height: number;
  /** The north-west corner and the (positive) degrees each pixel moves. */
  west: number;
  north: number;
  lonStep: number;
  latStep: number;
};

export type MosaicBounds = { west: number; south: number; east: number; north: number };

export async function fetchTerrainMosaic(bounds: MosaicBounds): Promise<TerrainMosaic> {
  const zoom = TERRAIN_ZOOM;
  const x0 = Math.floor(lonToTileX(bounds.west, zoom));
  const x1 = Math.floor(lonToTileX(bounds.east, zoom));
  const y0 = Math.floor(latToTileY(bounds.north, zoom));
  const y1 = Math.floor(latToTileY(bounds.south, zoom));
  const cols = x1 - x0 + 1;
  const rows = y1 - y0 + 1;

  const bitmaps = await Promise.all(
    Array.from({ length: rows * cols }, async (_, index) => {
      const tileX = x0 + (index % cols);
      const tileY = y0 + Math.floor(index / cols);
      const response = await fetch(`/api/terrain/${zoom}/${tileX}/${tileY}`);
      if (!response.ok) throw new Error(`terrain tile ${zoom}/${tileX}/${tileY}`);
      return createImageBitmap(await response.blob());
    }),
  );

  const canvas = document.createElement("canvas");
  canvas.width = cols * TILE_SIZE;
  canvas.height = rows * TILE_SIZE;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("canvas unavailable");
  bitmaps.forEach((bitmap, index) => {
    context.drawImage(bitmap, (index % cols) * TILE_SIZE, Math.floor(index / cols) * TILE_SIZE);
    bitmap.close();
  });

  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  const elevations = new Float32Array(canvas.width * canvas.height);
  for (let i = 0; i < elevations.length; i += 1) {
    const offset = i * 4;
    elevations[i] = data[offset] * 256 + data[offset + 1] + data[offset + 2] / 256 - 32768;
  }

  const north = tileYToLat(y0, zoom);
  return {
    elevations,
    width: canvas.width,
    height: canvas.height,
    west: tileXToLon(x0, zoom),
    north,
    lonStep: 360 / 2 ** zoom / TILE_SIZE,
    latStep: (north - tileYToLat(y0 + 1, zoom)) / TILE_SIZE,
  };
}

/** Bilinear elevation at a mosaic pixel, clamped at the edges. */
export function mosaicElevation(mosaic: TerrainMosaic, mx: number, my: number): number {
  const { elevations, width, height } = mosaic;
  const fx = Math.min(Math.max(mx, 0), width - 1.001);
  const fy = Math.min(Math.max(my, 0), height - 1.001);
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const i = y0 * width + x0;
  const v00 = elevations[i];
  const v10 = elevations[i + 1];
  const v01 = elevations[i + width];
  const v11 = elevations[i + width + 1];
  return (
    v00 * (1 - tx) * (1 - ty) + v10 * tx * (1 - ty) + v01 * (1 - tx) * ty + v11 * tx * ty
  );
}

export type ContourSegment = { x1: number; y1: number; x2: number; y2: number };

/**
 * Marching-squares segments for one elevation level, in mosaic pixel coordinates
 * (north to south), subsampled every `step` pixels.
 */
export function contourSegments(
  mosaic: TerrainMosaic,
  levelM: number,
  step: number,
): ContourSegment[] {
  const { elevations, width, height } = mosaic;
  const segments: ContourSegment[] = [];
  const crossing = (from: number, to: number, t0: number, t1: number): number => {
    const span = to - from;
    const t = Math.abs(span) < 1e-6 ? 0.5 : (levelM - from) / span;
    return t0 + (t1 - t0) * Math.min(Math.max(t, 0), 1);
  };

  for (let y = 0; y + step < height; y += step) {
    for (let x = 0; x + step < width; x += step) {
      const a = elevations[y * width + x];
      const b = elevations[y * width + x + step];
      const c = elevations[(y + step) * width + x + step];
      const d = elevations[(y + step) * width + x];
      const code = (a >= levelM ? 1 : 0) | (b >= levelM ? 2 : 0) | (c >= levelM ? 4 : 0) | (d >= levelM ? 8 : 0);
      if (code === 0 || code === 15) continue;

      const top = { x: crossing(a, b, x, x + step), y };
      const right = { x: x + step, y: crossing(b, c, y, y + step) };
      const bottom = { x: crossing(d, c, x, x + step), y: y + step };
      const left = { x, y: crossing(a, d, y, y + step) };
      const push = (p1: { x: number; y: number }, p2: { x: number; y: number }) =>
        segments.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });

      switch (code) {
        case 1:
        case 14:
          push(left, top);
          break;
        case 2:
        case 13:
          push(top, right);
          break;
        case 3:
        case 12:
          push(left, right);
          break;
        case 4:
        case 11:
          push(right, bottom);
          break;
        case 6:
        case 9:
          push(top, bottom);
          break;
        case 7:
        case 8:
          push(left, bottom);
          break;
        default: // 5 and 10 — saddles, split simply
          push(left, top);
          push(right, bottom);
          break;
      }
    }
  }
  return segments;
}
