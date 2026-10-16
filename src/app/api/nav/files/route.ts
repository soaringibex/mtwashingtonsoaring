// The electronic-files viewer's data: the exchange's current Gorham waypoint set,
// parsed for the map, plus the version stamp of the all-USA airspace package the
// downloads are built from. One route so the viewer's stamp and its dots agree on
// which files they describe.
//
// Upstream fetches carry their own cache windows (@/lib/nav-files); this response
// is cached at the edge on top of that, like /api/wx.

import { fetchGorhamWaypoints, fetchUsaAirspaceIssue } from "@/lib/nav-files";

const REVALIDATE = 12 * 60 * 60;

export async function GET(): Promise<Response> {
  const headers = {
    "Cache-Control": `public, s-maxage=${REVALIDATE}, stale-while-revalidate=${REVALIDATE * 2}`,
  };

  try {
    const [waypoints, airspace] = await Promise.allSettled([
      fetchGorhamWaypoints(),
      fetchUsaAirspaceIssue(),
    ]);
    if (waypoints.status === "rejected") throw waypoints.reason;

    return Response.json(
      {
        waypoints: {
          source: waypoints.value.url,
          dated: waypoints.value.dated,
          points: waypoints.value.waypoints,
        },
        // The waypoint list is what the map cannot draw without; a missing airspace
        // stamp only costs the download panel its version note.
        airspace: airspace.status === "fulfilled" ? airspace.value : null,
      },
      { headers },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "files unavailable" },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
