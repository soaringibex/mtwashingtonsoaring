// NAIP aerial imagery for one map box, exported by the USGS National Map image
// service (public domain) as a single colour JPEG and proxied through our own
// cache. One request per box: the service mosaics and colour-balances the tiles
// server-side, so the story view gets one seamless photograph to lay under its
// hillshade — no flight-strip tone breaks, and no client-side tile stitching.
// The alternative (Esri World Imagery tiles) is finer-grained but needs an
// attribution and carries the same kind of capture-date seams.

const IMAGE_HOST =
  "https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPImagery/ImageServer/exportImage";

/** The service rasterizes an export on demand — a cold box can take tens of seconds,
 * so give it room; the result is cached for a year either side. */
export const maxDuration = 60;

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const west = Number(searchParams.get("west"));
  const south = Number(searchParams.get("south"));
  const east = Number(searchParams.get("east"));
  const north = Number(searchParams.get("north"));
  const size = Math.round(Number(searchParams.get("size") ?? 2048));
  const finite = [west, south, east, north].every((value) => Number.isFinite(value));
  const inRange =
    finite &&
    west >= -180 &&
    east <= 180 &&
    south >= -85 &&
    north <= 85 &&
    west < east &&
    south < north;
  if (!inRange || !Number.isFinite(size) || size < 256 || size > 4096) {
    return new Response("bad box", { status: 400 });
  }

  try {
    const upstream = await fetch(
      `${IMAGE_HOST}?bbox=${west},${south},${east},${north}&bboxSR=4326&imageSR=4326&size=${size},${size}&format=jpg&f=image`,
      { next: { revalidate: 31536000 }, signal: AbortSignal.timeout(45_000) },
    );
    if (!upstream.ok) throw new Error(`upstream ${upstream.status}`);
    const body = await upstream.arrayBuffer();
    return new Response(body, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=86400, s-maxage=31536000, stale-while-revalidate=604800",
      },
    });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "imagery unavailable", { status: 502 });
  }
}
