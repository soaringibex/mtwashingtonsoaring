// The moving-map downloads, assembled at request time so none of them is a
// checked-in copy that can go stale:
//
// - the waypoint files are proxied from the Worldwide Soaring Turnpoint Exchange
//   (the exchange's own current file, under the name the old static files had);
// - the glider-area-only airspace is generated from the LOA's numbers;
// - the all-USA airspace is the exchange's current NASR package with the glider
//   area merged in (@/lib/nav-files).

import {
  NAV_DOWNLOADS,
  fetchAllUsaAirspace,
  fetchWaypointDownload,
  gliderAreaBlock,
  type NavDownloadId,
} from "@/lib/nav-files";

/** Twelve hours, matching the upstream cache windows in @/lib/nav-files. */
const REVALIDATE = 12 * 60 * 60;

async function build(id: NavDownloadId): Promise<string> {
  switch (id) {
    case "waypoints-cup":
      return fetchWaypointDownload("cup");
    case "waypoints-gpx":
      return fetchWaypointDownload("gpx");
    case "airspace-glider-sua":
      return gliderAreaBlock("sua");
    case "airspace-glider-openair":
      return gliderAreaBlock("openair");
    case "airspace-allusa-sua":
      return (await fetchAllUsaAirspace("sua")).text;
    case "airspace-allusa-openair":
      return (await fetchAllUsaAirspace("openair")).text;
  }
}

export async function GET(request: Request): Promise<Response> {
  const id = new URL(request.url).searchParams.get("file");
  const entry = NAV_DOWNLOADS.find((candidate) => candidate.id === id);
  if (!entry) {
    return new Response("unknown file", { status: 404 });
  }

  try {
    const text = await build(entry.id);
    return new Response(text, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${entry.file}"`,
        "Cache-Control": `public, s-maxage=${REVALIDATE}, stale-while-revalidate=${REVALIDATE * 2}`,
      },
    });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "file unavailable", {
      status: 502,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
