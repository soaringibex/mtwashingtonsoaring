// One aerial-imagery box for the 3D relief textures: a single colour JPEG export
// from /api/imagery, rasterized here into pixels. Unlike the terrain mosaics
// (tiles stitched per zoom) this is one request covering exactly the box the
// caller asked for, so its pixel grid maps straight onto the box's 0..1 frame.

import type { MosaicBounds } from "@/lib/terrain-tiles";

export type ImageryBox = {
  /** RGBA pixels, row-major, north to south — the box itself, corners at 0 and width-1. */
  data: Uint8ClampedArray;
  width: number;
  height: number;
};

// One box per session per bounds/size, like the terrain mosaics — the browser's
// HTTP cache carries the JPEG across reloads.
const imageryCache = new Map<string, Promise<ImageryBox>>();

export function fetchImageryBox(bounds: MosaicBounds, size: number): Promise<ImageryBox> {
  const key = `${size}:${bounds.west},${bounds.south},${bounds.east},${bounds.north}`;
  const cached = imageryCache.get(key);
  if (cached) return cached;
  const value = buildImageryBox(bounds, size).catch((error: unknown) => {
    if (imageryCache.get(key) === value) imageryCache.delete(key);
    throw error;
  });
  imageryCache.set(key, value);
  return value;
}

async function buildImageryBox(bounds: MosaicBounds, size: number): Promise<ImageryBox> {
  const response = await fetch(
    `/api/imagery?west=${bounds.west}&south=${bounds.south}&east=${bounds.east}&north=${bounds.north}&size=${size}`,
  );
  if (!response.ok) throw new Error(`imagery box ${response.status}`);
  const bitmap = await createImageBitmap(await response.blob());
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("canvas unavailable");
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  return { data: context.getImageData(0, 0, canvas.width, canvas.height).data, width: canvas.width, height: canvas.height };
}

/** Bilinear RGB from the box at its 0..1 fractions, written into `out` — the frame
 * the texture is built in. `out` is caller-owned so a texture build reuses one triple. */
export function imageryColour(
  imagery: ImageryBox,
  u: number,
  v: number,
  out: [number, number, number],
): void {
  const x = Math.min(Math.max(u * (imagery.width - 1), 0), imagery.width - 1.001);
  const y = Math.min(Math.max(v * (imagery.height - 1), 0), imagery.height - 1.001);
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const d = imagery.data;
  const row = imagery.width * 4;
  const i = y0 * row + x0 * 4;
  for (let c = 0; c < 3; c += 1) {
    out[c] =
      d[i + c] * (1 - fx) * (1 - fy) +
      d[i + 4 + c] * fx * (1 - fy) +
      d[i + row + c] * (1 - fx) * fy +
      d[i + row + 4 + c] * fx * fy;
  }
}
