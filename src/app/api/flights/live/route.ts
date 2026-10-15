// The flights page's live traffic feed — both networks fetched here, once per refresh
// window, merged and clipped to the Gorham box.
//
// Anything a visitor's browser fetched directly would spend a request per viewer per
// minute against two volunteer services; here each edge window costs one request each,
// and the page only ever talks to us. The window is deliberately short — traffic moves
// — but it is the same trick /api/wx uses, and it keeps the tracker a good citizen.
//
// Partial failure is normal on volunteer networks: if one feed answers, the page shows
// what that one knows and says which network is quiet; only both failing is an error.

import {
  ADSB_QUERY_RADIUS_NM,
  insideBounds,
  parseAdsbAircraft,
  parseOgnMarkers,
  sortFlights,
  TRAFFIC_BOUNDS,
  TRAFFIC_CENTER,
  type LiveFlight,
  type LiveTraffic,
} from "@/lib/live-traffic";

const USER_AGENT = "mtwashingtonsoaring.org live traffic tracker";

/** Seconds an assembled snapshot is served from the edge before it re-asks upstream. */
const WINDOW_S = 25;

async function fetchOgn(): Promise<LiveFlight[]> {
  // b/c/d/e are the box's north, south, east and west — confirmed against the
  // server, which answers an inverted pair with an empty list rather than an error.
  const url =
    "https://live.glidernet.org/lxml.php?a=0" +
    `&b=${TRAFFIC_BOUNDS.north}&c=${TRAFFIC_BOUNDS.south}` +
    `&d=${TRAFFIC_BOUNDS.east}&e=${TRAFFIC_BOUNDS.west}`;
  const response = await fetch(url, {
    next: { revalidate: WINDOW_S },
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`ogn ${response.status}`);
  const xml = await response.text();
  if (!xml.includes("<markers")) throw new Error("ogn: unexpected payload");
  // The network itself treats 10 minutes without a fix as offline; the feed may
  // still list the aircraft, but "airborne now" should not.
  return parseOgnMarkers(xml).filter(
    (flight) => flight.ageSec <= 600 && insideBounds(flight),
  );
}

async function fetchAdsb(): Promise<LiveFlight[]> {
  const url =
    `https://api.adsb.lol/v2/point/${TRAFFIC_CENTER.lat.toFixed(3)}` +
    `/${TRAFFIC_CENTER.lon.toFixed(3)}/${ADSB_QUERY_RADIUS_NM}`;
  const response = await fetch(url, {
    next: { revalidate: WINDOW_S },
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`adsb ${response.status}`);
  return parseAdsbAircraft(await response.json()).filter((flight) => insideBounds(flight));
}

export async function GET(): Promise<Response> {
  const headers = {
    "Cache-Control": `public, s-maxage=${WINDOW_S}, stale-while-revalidate=${WINDOW_S * 2}`,
  };

  const [ogn, adsb] = await Promise.allSettled([fetchOgn(), fetchAdsb()]);
  if (ogn.status === "rejected" && adsb.status === "rejected") {
    return Response.json(
      { error: "both traffic networks unreachable" },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }

  const ognFlights = ogn.status === "fulfilled" ? ogn.value : [];
  const adsbFlights = adsb.status === "fulfilled" ? adsb.value : [];

  // A glider carrying both FLARM and a transponder appears in both feeds; keep the
  // OGN copy — its climb rate is the one glider pilots watch — and drop the ADS-B twin.
  const ognAddresses = new Set(
    ognFlights.map((flight) => flight.address).filter((address): address is string => address !== null),
  );
  const flights = sortFlights([
    ...ognFlights,
    ...adsbFlights.filter((flight) => flight.address === null || !ognAddresses.has(flight.address)),
  ]);

  const payload: LiveTraffic = {
    updatedAt: new Date().toISOString(),
    sources: { ogn: ogn.status === "fulfilled", adsb: adsb.status === "fulfilled" },
    flights,
  };
  return Response.json(payload, { headers });
}
