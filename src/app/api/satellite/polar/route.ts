// The sharpest daily satellite imagery of the Northeast, composed from GIBS tiles.
//
// The polar-orbiting satellites cross this region once or twice a day — a single look at
// 250 m instead of the GOES loop's five-minute half-kilometre. NASA's regional snapshot
// service stopped returning usable imagery for this box (blank white sheets, or half
// missing), so the box is now composed from the WMTS tile pyramid Worldview itself draws:
// level 7 of the 250 m set is a 160 × 80 grid of 512 px tiles, each 2.25° × 2.25°.
// Those numbers come from the WMTS capabilities document, not from a 2ⁿ guess — the
// first cut of this route assumed square power-of-two tiles, fetched the Gulf of Mexico
// for a New England box, and pinned "Gorham" to open water.
//
// Two measured quirks shape this route:
//
//  - A day's mosaic fills in as the passes come down, and the archive has holes: a real
//    tile measured 15–80 kB, an empty one ≈ 4.7 kB. Tiles below TILE_MIN_BYTES count as
//    missing, and a candidate day is only served when its tiles cover MIN_COVERAGE of
//    the box — so a half-filled day falls through to the next candidate instead of
//    rendering as black noise.
//
//  - MODIS carries this region's best true colour (250 m; VIIRS true colour is 750 m),
//    so mornings prefer Terra and afternoons prefer Aqua, with NOAA-21 VIIRS as the
//    afternoon fallback. A bare request resolves to the most recent usable pass; an
//    explicit ?date= asks for that date only and 404s when its imagery is not there yet.

import sharp from "sharp";

import { POLAR_BBOX } from "@/lib/satellite";

const WMTS = "https://gibs-a.earthdata.nasa.gov/wmts/epsg4326/best/wmts.cgi";
/** Level 7 of the 250 m set: a 160 × 80 matrix of 512 px tiles, each 2.25° × 2.25°. */
const TILE_MATRIX = 7;
const TILE_SIZE = 512;
const LON_STEP = 360 / 160;
const LAT_STEP = 180 / 80;
const RENDER_SIZE = { width: 2400, height: 1540 };
/** Measured: real tiles 15–80 kB, empty tiles ≈ 4.7 kB. */
const TILE_MIN_BYTES = 9000;
/** Measured: good days 77–99 %, broken days 0–2 %. */
const MIN_COVERAGE = 0.85;
/** "Latest" tries today, then yesterday — no further, or it stops being "latest". */
const WALK_BACK_DAYS = 1;

const PASSES = {
  morning: ["MODIS_Terra_CorrectedReflectance_TrueColor"],
  afternoon: [
    "MODIS_Aqua_CorrectedReflectance_TrueColor",
    "VIIRS_NOAA21_CorrectedReflectance_TrueColor",
  ],
} as const;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const EARLIEST_DATE = "2026-01-01";

/** Today's calendar date in Eastern time, offset by whole days. */
function etDate(offsetDays = 0): string {
  const at = new Date(Date.now() - offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(at);
}

function tileUrl(layer: string, date: string, row: number, col: number): string {
  const params = new URLSearchParams({
    TIME: `${date}T00:00:00Z`,
    layer,
    style: "default",
    tilematrixset: "250m",
    Service: "WMTS",
    Request: "GetTile",
    Version: "1.0.0",
    Format: "image/jpeg",
    TileMatrix: String(TILE_MATRIX),
    TileCol: String(col),
    TileRow: String(row),
  });
  return `${WMTS}?${params.toString()}`;
}

type Tile = { row: number; col: number; body: Buffer };

/** The tile window that covers the polar box, and the box's crop inside it. */
function boxGeometry() {
  const col0 = Math.floor((POLAR_BBOX.west + 180) / LON_STEP);
  const col1 = Math.floor((POLAR_BBOX.east + 180) / LON_STEP);
  const row0 = Math.floor((90 - POLAR_BBOX.north) / LAT_STEP);
  const row1 = Math.floor((90 - POLAR_BBOX.south) / LAT_STEP);
  const tileWest = col0 * LON_STEP - 180;
  const tileNorth = 90 - row0 * LAT_STEP;
  return {
    cols: { from: col0, to: col1 },
    rows: { from: row0, to: row1 },
    crop: {
      left: ((POLAR_BBOX.west - tileWest) / LON_STEP) * TILE_SIZE,
      top: ((tileNorth - POLAR_BBOX.north) / LAT_STEP) * TILE_SIZE,
      width: ((POLAR_BBOX.east - POLAR_BBOX.west) / LON_STEP) * TILE_SIZE,
      height: ((POLAR_BBOX.north - POLAR_BBOX.south) / LAT_STEP) * TILE_SIZE,
    },
  };
}

async function fetchTile(
  layer: string,
  date: string,
  row: number,
  col: number,
  revalidate: number,
): Promise<Buffer | null> {
  try {
    const response = await fetch(tileUrl(layer, date, row, col), {
      next: { revalidate },
      headers: { "User-Agent": "mtwashingtonsoaring.org weather dashboard" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return null;
    const body = Buffer.from(await response.arrayBuffer());
    return body.byteLength >= TILE_MIN_BYTES ? body : null;
  } catch {
    return null;
  }
}

/** Fetch the day's tiles and measure how much of the box they actually cover. */
async function fetchBox(
  layer: string,
  date: string,
  tileRevalidate: number,
): Promise<{ tiles: Tile[]; coverage: number }> {
  const { cols, rows } = boxGeometry();
  const wanted: { row: number; col: number; area: number }[] = [];
  let area = 0;
  for (let row = rows.from; row <= rows.to; row += 1) {
    for (let col = cols.from; col <= cols.to; col += 1) {
      const west = col * LON_STEP - 180;
      const north = 90 - row * LAT_STEP;
      const covered =
        Math.max(0, Math.min(POLAR_BBOX.east, west + LON_STEP) - Math.max(POLAR_BBOX.west, west)) *
        Math.max(0, Math.min(POLAR_BBOX.north, north) - Math.max(POLAR_BBOX.south, north - LAT_STEP));
      if (covered > 0) {
        wanted.push({ row, col, area: covered });
        area += covered;
      }
    }
  }

  const bodies = await Promise.all(
    wanted.map(async (tile) => ({
      ...tile,
      body: await fetchTile(layer, date, tile.row, tile.col, tileRevalidate),
    })),
  );

  const tiles: Tile[] = [];
  let covered = 0;
  for (const tile of bodies) {
    if (tile.body !== null) {
      tiles.push({ row: tile.row, col: tile.col, body: tile.body });
      covered += tile.area;
    }
  }
  return { tiles, coverage: area === 0 ? 0 : covered / area };
}

/** Compose the day's tiles into one box-sized JPEG. */
async function compose(tiles: Tile[]): Promise<Buffer> {
  const { cols, rows, crop } = boxGeometry();
  const width = (cols.to - cols.from + 1) * TILE_SIZE;
  const height = (rows.to - rows.from + 1) * TILE_SIZE;
  const composites = tiles.map((tile) => ({
    input: tile.body,
    left: (tile.col - cols.from) * TILE_SIZE,
    top: (tile.row - rows.from) * TILE_SIZE,
  }));

  // Two sharp stages, on purpose: sharp runs `composite` after `extract`/`resize` in its
  // pipeline, so chaining them in one call pastes the tiles onto the already-cropped
  // canvas — the crop picks the mosaic's top-left corner instead of the box, shifting
  // the served image most of a tile row north. Materialise the mosaic first, then crop.
  const mosaic = await sharp({
    create: { width, height, channels: 3, background: { r: 0, g: 0, b: 0 } },
  })
    .composite(composites)
    .png()
    .toBuffer();

  return sharp(mosaic)
    .extract({
      left: Math.round(crop.left),
      top: Math.round(crop.top),
      width: Math.round(crop.width),
      height: Math.round(crop.height),
    })
    .resize({ ...RENDER_SIZE, fit: "fill" })
    .jpeg({ quality: 82 })
    .toBuffer();
}

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const pass = params.get("pass") === "morning" ? "morning" : "afternoon";
  const layers = PASSES[pass];
  const today = etDate();

  const requestedDate = params.get("date");
  let candidates: { layer: string; date: string }[];
  if (requestedDate !== null) {
    if (
      !DATE_PATTERN.test(requestedDate) ||
      requestedDate < EARLIEST_DATE ||
      requestedDate > today
    ) {
      return Response.json(
        { error: "date must be a day between 2026-01-01 and today" },
        { status: 400 },
      );
    }
    candidates = layers.map((layer) => ({ layer, date: requestedDate }));
  } else {
    candidates = [];
    for (let daysBack = 0; daysBack <= WALK_BACK_DAYS; daysBack += 1) {
      const date = etDate(daysBack);
      for (const layer of layers) candidates.push({ layer, date });
    }
  }

  try {
    for (const candidate of candidates) {
      // A past day's tiles never change, so they may be cached long; today's keep filling.
      const tileRevalidate = candidate.date === today ? 1800 : 604800;
      const { tiles, coverage } = await fetchBox(candidate.layer, candidate.date, tileRevalidate);
      if (coverage < MIN_COVERAGE) continue;

      const body = await compose(tiles);
      const settled = candidate.date !== today && requestedDate !== null;
      return new Response(new Uint8Array(body), {
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": settled
            ? "public, s-maxage=604800, stale-while-revalidate=86400"
            : "public, s-maxage=1800, stale-while-revalidate=7200",
          "X-Satellite-Layer": candidate.layer,
          "X-Satellite-Date": candidate.date,
        },
      });
    }
    return Response.json({ error: "no pass imagery for that date" }, { status: 404 });
  } catch (error) {
    return new Response(
      error instanceof Error ? error.message : "satellite imagery unavailable",
      { status: 502 },
    );
  }
}

export const maxDuration = 30;
