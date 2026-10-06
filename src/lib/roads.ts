// Road polylines for the wave map, from OpenStreetMap. The region's roads never move,
// so they ship as a committed asset (public/roads.json) rather than a runtime API call —
// one file on the CDN for everyone, kept in localStorage for a year per browser.

const ROADS_CACHE_KEY = "mws-roads-v2";
const ROADS_CACHE_MS = 365 * 24 * 60 * 60 * 1000;

/** A road polyline: rank (2 trunk/primary, 1 secondary, 0 tertiary) and [lon, lat] pairs. */
export type RoadLine = { k: number; p: [number, number][] };

export async function fetchRoadLines(): Promise<RoadLine[]> {
  try {
    const cached = localStorage.getItem(ROADS_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached) as { ts?: number; lines?: RoadLine[] };
      if (
        typeof parsed.ts === "number" &&
        Date.now() - parsed.ts < ROADS_CACHE_MS &&
        Array.isArray(parsed.lines) &&
        parsed.lines.length > 0 &&
        Array.isArray(parsed.lines[0]?.p)
      ) {
        return parsed.lines;
      }
    }
  } catch {
    // no readable cache — fall through to the network
  }

  const response = await fetch("/roads.json");
  if (!response.ok) throw new Error("roads unavailable");
  const data = (await response.json()) as { lines?: RoadLine[] };
  const lines = Array.isArray(data.lines) ? data.lines : [];
  if (lines.length === 0) throw new Error("no roads returned");

  try {
    localStorage.setItem(ROADS_CACHE_KEY, JSON.stringify({ ts: Date.now(), lines }));
  } catch {
    // storage unavailable — the roads just aren't cached
  }
  return lines;
}
