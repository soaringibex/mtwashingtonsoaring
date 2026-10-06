// Roads for the wave map, from OpenStreetMap via the Overpass API. The query is fixed
// server-side (not an open proxy) and roads never move, so one copy is cached at the
// edge for a month and shared by every visitor. Each line carries a rank so the map can
// draw trunk roads heavier than forest roads.

const OVERPASS = "https://overpass-api.de/api/interpreter";
const QUERY =
  '[out:json][timeout:25];way["highway"~"^(trunk|primary|secondary|tertiary)$"](44.02,-71.66,44.52,-70.84);out geom;';

const RANK: Record<string, number> = { trunk: 2, primary: 2, secondary: 1, tertiary: 0 };

export async function GET(): Promise<Response> {
  const url = `${OVERPASS}?data=${encodeURIComponent(QUERY)}`;
  try {
    const response = await fetch(url, {
      next: { revalidate: 2592000 },
      headers: { "User-Agent": "mtwashingtonsoaring.org weather dashboard" },
      signal: AbortSignal.timeout(25_000),
    });
    if (!response.ok) throw new Error(`overpass ${response.status}`);
    const data = (await response.json()) as {
      elements?: { tags?: { highway?: string }; geometry?: { lat?: number; lon?: number }[] }[];
    };
    const lines = (data.elements ?? [])
      .map((element) => ({
        k: RANK[element.tags?.highway ?? ""] ?? 0,
        p: (element.geometry ?? [])
          .filter((point) => typeof point.lat === "number" && typeof point.lon === "number")
          .map((point) => [Number(point.lon!.toFixed(5)), Number(point.lat!.toFixed(5))]),
      }))
      .filter((line) => line.p.length > 1);
    return Response.json(
      { lines },
      {
        headers: {
          "Cache-Control": "public, s-maxage=2592000, stale-while-revalidate=604800",
        },
      },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "roads unavailable" },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
