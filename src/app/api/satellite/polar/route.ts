// The sharpest daily satellite imagery of the Northeast, proxied and cached.
//
// The polar-orbiting satellites cross this region once or twice a day — a single look at
// 250 m instead of the GOES loop's five-minute half-kilometre. NASA's Worldview snapshot
// service renders the day's imagery for an arbitrary box; two measured quirks shaped
// this route:
//
//  - A day's mosaic fills in over the hours after its pass, so the freshest date may
//    render empty (near-black) or only partly covered. At the 400×256 probe size an
//    empty box is a deterministic ~1.7 kB JPEG (black + coastlines only), while real
//    imagery measured 5.9–11.3 kB across a test week — even a uniformly overcast day.
//    PROBE_MIN_BYTES therefore only guards against the empty case, with room to spare;
//    a mid-fill day may be served while it is still filling in, which is honest "today
//    so far" imagery.
//
//  - MODIS carries this region's best true colour (250 m; VIIRS true colour is 750 m
//    and its mosaics fill less reliably), so mornings prefer Terra and afternoons prefer
//    Aqua, with NOAA-21 VIIRS as the afternoon fallback. A bare request resolves to the
//    most recent usable pass; an explicit ?date= asks for that date only and 404s when
//    its imagery is not there yet.

import { polarBboxString } from "@/lib/satellite";

const SNAPSHOT = "https://wvs.earthdata.nasa.gov/api/v1/snapshot";
/** The Northeast, from the Mid-Atlantic to the St. Lawrence — the wave in its setting. */
const PROBE_SIZE = { width: 400, height: 256 };
const RENDER_SIZE = { width: 2400, height: 1540 };
/** Measured: empty ≈ 1.7 kB, real days ≈ 5.9–11.3 kB (see the header). */
const PROBE_MIN_BYTES = 3000;
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

function snapshotUrl(
  layer: string,
  date: string,
  size: { width: number; height: number },
): string {
  const params = new URLSearchParams({
    REQUEST: "GetSnapshot",
    LAYERS: `${layer},Coastlines_15m`,
    CRS: "EPSG:4326",
    BBOX: polarBboxString(),
    WIDTH: String(size.width),
    HEIGHT: String(size.height),
    FORMAT: "image/jpeg",
    TIME: date,
  });
  return `${SNAPSHOT}?${params.toString()}`;
}

async function fetchSnapshot(
  layer: string,
  date: string,
  size: { width: number; height: number },
  revalidate: number,
): Promise<Response | null> {
  try {
    const response = await fetch(snapshotUrl(layer, date, size), {
      next: { revalidate },
      headers: { "User-Agent": "mtwashingtonsoaring.org weather dashboard" },
      signal: AbortSignal.timeout(20_000),
    });
    return response.ok ? response : null;
  } catch {
    return null;
  }
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
      // Today's imagery keeps changing as its mosaic fills, so only past dates may be
      // cached long — and a resolved-latest request must stay short-lived either way.
      const settled = candidate.date !== today && requestedDate !== null;
      const revalidate = settled ? 604800 : 1800;

      const probe = await fetchSnapshot(candidate.layer, candidate.date, PROBE_SIZE, 1800);
      if (!probe) continue;
      if ((await probe.arrayBuffer()).byteLength < PROBE_MIN_BYTES) continue;

      const render = await fetchSnapshot(
        candidate.layer,
        candidate.date,
        RENDER_SIZE,
        revalidate,
      );
      if (!render) continue;
      const body = await render.arrayBuffer();

      return new Response(body, {
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
