// AWS Terrain Tiles (Terrarium-encoded PNG, elevation in R·256 + G + B/256 − 32768
// metres) proxied through our own cache. The tiles carry public-domain elevation data
// and never change, so the edge keeps them for a year; proxying keeps the tile host
// out of the client and lets the whole site share one copy.

const TILE_HOST = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ z: string; x: string; y: string }> },
): Promise<Response> {
  const { z, x, y } = await params;
  const zoom = Number(z);
  const tileX = Number(x);
  const tileY = Number(y);
  const span = Number.isInteger(zoom) && zoom >= 0 && zoom <= 14 ? 2 ** zoom : 0;
  const inRange = (value: number) => Number.isInteger(value) && value >= 0 && value < span;
  if (!span || !inRange(tileX) || !inRange(tileY)) {
    return new Response("bad tile", { status: 400 });
  }

  try {
    const upstream = await fetch(`${TILE_HOST}/${zoom}/${tileX}/${tileY}.png`, {
      next: { revalidate: 31536000 },
      signal: AbortSignal.timeout(20_000),
    });
    if (!upstream.ok) throw new Error(`upstream ${upstream.status}`);
    const body = await upstream.arrayBuffer();
    return new Response(body, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400, s-maxage=31536000, stale-while-revalidate=604800",
      },
    });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "tile unavailable", { status: 502 });
  }
}
