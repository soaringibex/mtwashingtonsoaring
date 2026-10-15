// Live traffic around Gorham — the shared vocabulary of the flights page's tracker.
//
// Two volunteer networks watch this sky and neither is complete on its own. The Open
// Glider Network hears FLARM and OGN beacons — gliders, the tugs, the training traffic
// in the valley — but almost no powered aircraft; ADS-B hears everything with a
// transponder, but a glider only if it carries one. The tracker asks both, keeps the
// answers inside one box around the field, and reports every target the way the ground
// wants it: where it is from 2G8, how high, climbing or sinking, and how old the fix is.
//
// The wire formats are parsed here so /api/flights/live and the page agree on one shape:
//
// - OGN's `lxml.php?a=0&b=<north>&c=<south>&d=<east>&e=<west>` answers one
//   `<m a="…"/>` per aircraft, comma-separated as latitude, longitude, competition id,
//   registration, altitude, fix time, seconds since fix, track, ground speed, climb
//   rate, aircraft type index, receiver, device id, code. Its numbers are metric —
//   metres, km/h, m/s — whatever unit switch its own map may be showing.
// - ADS-B (adsb.lol) answers `/v2/point/<lat>/<lon>/<radius>` with a tar1090-style
//   JSON object, already in feet, knots and feet per minute.

export type LatLon = { lat: number; lon: number };

/** Gorham Municipal (2G8), the Worldwide Soaring Turnpoint Exchange's own point. */
export const GORHAM_FIELD: LatLon = { lat: 44.39472, lon: -71.19805 };

/** Everything inside this many miles of the field reads as "at the field". */
export const FIELD_ZONE_NM = 3;

/** Below this altitude, an aircraft within the field zone reads as at the field. */
export const FIELD_LOW_FT = 4000;

/** How long a departure sighting is remembered — a long wave flight, plus slack. */
export const FIELD_MEMORY_MS = 12 * 60 * 60 * 1000;

/** A departure memory for one aircraft: when it was last seen low at the field. */
export type FieldSighting = { nearFieldMs: number };

/** The box the tracker watches: Gorham, the mountain and the valley fields. */
export const TRAFFIC_BOUNDS = { west: -71.62, south: 44.04, east: -70.9, north: 44.62 } as const;

export const TRAFFIC_CENTER: LatLon = {
  lat: (TRAFFIC_BOUNDS.north + TRAFFIC_BOUNDS.south) / 2,
  lon: (TRAFFIC_BOUNDS.east + TRAFFIC_BOUNDS.west) / 2,
};

/** Covers the box corner to corner (~23.5 NM) with margin. */
export const ADSB_QUERY_RADIUS_NM = 30;

/** How often the browser re-asks; the route holds its own upstream window. */
export const CLIENT_POLL_MS = 60_000;

export type TrafficSource = "ogn" | "adsb";
export type TrafficKind = "glider" | "tow" | "helicopter" | "powered" | "other";

/** Display order and wording for the kinds, from the field's point of view. */
export const KIND_ORDER: Record<TrafficKind, number> = {
  glider: 0,
  tow: 1,
  helicopter: 2,
  powered: 3,
  other: 4,
};
export const KIND_LABEL: Record<TrafficKind, string> = {
  glider: "Glider",
  tow: "Tow plane",
  helicopter: "Helicopter",
  powered: "Aircraft",
  other: "Traffic",
};

export type LiveFlight = {
  /** Stable between polls: "ogn:<device>" or "adsb:<hex>". */
  id: string;
  source: TrafficSource;
  kind: TrafficKind;
  /** What the field calls it: competition id, callsign, or registration. */
  ident: string;
  registration: string | null;
  /** ICAO type designator (ADS-B), where the feed carries one. */
  aircraftType: string | null;
  /** The ICAO 24-bit address when one is known — how the two networks collide. */
  address: string | null;
  lat: number;
  lon: number;
  altitudeFt: number | null;
  groundSpeedKt: number | null;
  climbFpm: number | null;
  trackDeg: number | null;
  /** Seconds since the network last saw it. */
  ageSec: number;
  /** From Gorham 2G8. */
  distanceNm: number;
  bearingDeg: number;
};

export type LiveTraffic = {
  /** When the route assembled this snapshot (ISO). */
  updatedAt: string;
  /** Which of the two networks answered this round. */
  sources: { ogn: boolean; adsb: boolean };
  flights: LiveFlight[];
};

/** The ground's interest order: gliders, then tugs, then everyone else, nearest first. */
export function sortFlights(flights: LiveFlight[]): LiveFlight[] {
  return [...flights].sort(
    (a, b) =>
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
      a.distanceNm - b.distanceNm ||
      a.ident.localeCompare(b.ident),
  );
}

/** Whether the aircraft reads as sitting at the field right now. */
export function isAtField(flight: LiveFlight): boolean {
  return (
    flight.distanceNm <= FIELD_ZONE_NM &&
    flight.altitudeFt !== null &&
    flight.altitudeFt < FIELD_LOW_FT
  );
}

/**
 * Whether the page has watched — during this visit or a remembered earlier one —
 * this aircraft operate from Gorham.
 */
export function hasFieldEvidence(
  flight: LiveFlight,
  sighting: FieldSighting | undefined,
  nowMs: number,
): boolean {
  if (isAtField(flight)) return true;
  return sighting !== undefined && nowMs - sighting.nearFieldMs < FIELD_MEMORY_MS;
}

/** Climbing harder than this counts as flying, wherever the glider is. */
const CLIMB_OUT_FPM = 150;

/**
 * A live glider flight: a glider beyond the field zone, or one climbing out of
 * it. Inside the zone at zero climb is an aircraft parked on the grass with its
 * FLARM still on — evidence of a glider, not of a flight.
 */
export function isAirborneGlider(flight: LiveFlight): boolean {
  if (flight.kind !== "glider") return false;
  if (flight.distanceNm > FIELD_ZONE_NM) return true;
  return (flight.climbFpm ?? 0) > CLIMB_OUT_FPM;
}

const EARTH_RADIUS_NM = 3440.065; // 6371.0088 km

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** Great-circle distance in nautical miles. */
export function distanceNm(from: LatLon, to: LatLon): number {
  const dLat = toRadians(to.lat - from.lat);
  const dLon = toRadians(to.lon - from.lon);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_NM * Math.asin(Math.sqrt(a));
}

/** Initial great-circle bearing from one point to another, degrees from north. */
export function bearingDeg(from: LatLon, to: LatLon): number {
  const fromLat = toRadians(from.lat);
  const toLat = toRadians(to.lat);
  const dLon = toRadians(to.lon - from.lon);
  const y = Math.sin(dLon) * Math.cos(toLat);
  const x = Math.cos(fromLat) * Math.sin(toLat) - Math.sin(fromLat) * Math.cos(toLat) * Math.cos(dLon);
  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}

const COMPASS_POINTS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;

/** The eight-wind name for a bearing — "SW" reads better on the ground than "225°". */
export function compassPoint(bearing: number): string {
  return COMPASS_POINTS[Math.round((((bearing % 360) + 360) % 360) / 45) % 8];
}

export function insideBounds(point: LatLon): boolean {
  return (
    point.lat >= TRAFFIC_BOUNDS.south &&
    point.lat <= TRAFFIC_BOUNDS.north &&
    point.lon >= TRAFFIC_BOUNDS.west &&
    point.lon <= TRAFFIC_BOUNDS.east
  );
}

const M_TO_FT = 3.28084;
const KMH_TO_KT = 0.5399568;
const MS_TO_FPM = 196.8504;

const round1 = (value: number): number => Math.round(value * 10) / 10;

const fromField = (lat: number, lon: number) => ({
  distanceNm: round1(distanceNm(GORHAM_FIELD, { lat, lon })),
  bearingDeg: Math.round(bearingDeg(GORHAM_FIELD, { lat, lon })),
});

/** OGN's aircraft type index, from its own map's legend. */
const OGN_KINDS: TrafficKind[] = [
  "other", // 0 unknown
  "glider", // 1 glider / motor glider
  "tow", // 2 tow plane
  "helicopter", // 3
  "other", // 4 parachute
  "other", // 5 drop plane
  "other", // 6 hang glider
  "other", // 7 paraglider
  "powered", // 8 plane
  "powered", // 9 jet
  "other", // 10 unused
  "other", // 11 balloon
  "other", // 12 airship
  "other", // 13 drone
  "other", // 14 unused
  // 15 is a static ground object — the marker list carries ground stations too.
];

/** A number from a wire string, with empty and unparsable fields read as unknown. */
const numeric = (value: string): number | null => {
  if (value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export function parseOgnMarkers(xml: string): LiveFlight[] {
  const flights: LiveFlight[] = [];
  for (const match of xml.matchAll(/<m\s+a="([^"]*)"/g)) {
    const field = match[1].split(",");
    if (field.length < 14) continue;
    const [
      latRaw,
      lonRaw,
      competitionRaw,
      registeredAs,
      altRaw,
      ,
      ageRaw,
      trackRaw,
      speedRaw,
      climbRaw,
      typeRaw,
      ,
      deviceRaw,
      code,
    ] = field;

    const lat = numeric(latRaw);
    const lon = numeric(lonRaw);
    const typeIndex = Number(typeRaw);
    if (lat === null || lon === null) continue;
    if (typeIndex === 15) continue; // a ground station, not an aircraft

    const device = deviceRaw !== "" && deviceRaw !== "0" ? deviceRaw : code;
    const registration = registeredAs === "hidden" || registeredAs === "" ? null : registeredAs;
    const competition = competitionRaw !== "" && !competitionRaw.startsWith("_") ? competitionRaw : null;
    const altitudeM = numeric(altRaw);
    const speedKmh = numeric(speedRaw);
    const climbMs = numeric(climbRaw);

    flights.push({
      id: `ogn:${device}`,
      source: "ogn",
      kind: OGN_KINDS[typeIndex] ?? "other",
      ident: competition ?? registration ?? device,
      registration,
      aircraftType: null,
      address: /^[0-9a-f]{6}$/i.test(device) ? device.toLowerCase() : null,
      lat,
      lon,
      altitudeFt: altitudeM !== null && altitudeM > 0 ? Math.round(altitudeM * M_TO_FT) : null,
      groundSpeedKt: speedKmh !== null ? Math.round(speedKmh * KMH_TO_KT) : null,
      climbFpm: climbMs !== null ? Math.round(climbMs * MS_TO_FPM) : null,
      trackDeg: numeric(trackRaw),
      ageSec: numeric(ageRaw) ?? 0,
      ...fromField(lat, lon),
    });
  }
  return flights;
}

type AdsbAircraft = {
  hex?: string;
  flight?: string;
  r?: string;
  t?: string;
  type?: string;
  alt_baro?: number | "ground";
  gs?: number;
  track?: number;
  baro_rate?: number;
  geom_rate?: number;
  seen_pos?: number;
  lat?: number;
  lon?: number;
  category?: string;
};

export function parseAdsbAircraft(payload: unknown): LiveFlight[] {
  const aircraftList = (payload as { ac?: AdsbAircraft[] } | null)?.ac;
  if (!Array.isArray(aircraftList)) throw new Error("adsb payload missing ac[]");

  const flights: LiveFlight[] = [];
  for (const aircraft of aircraftList) {
    const lat = typeof aircraft.lat === "number" ? aircraft.lat : null;
    const lon = typeof aircraft.lon === "number" ? aircraft.lon : null;
    if (lat === null || lon === null || !aircraft.hex) continue;
    if (aircraft.alt_baro === "ground") continue; // taxiing, not flying
    // TIS-B-only rows are ground-radar rebroadcasts of aircraft heard another way
    // (in the wave they surface as anonymous "~" ghosts of the gliders OGN already
    // reports) — duplicates without an identity, and the networks call them that.
    if (aircraft.type?.startsWith("tisb")) continue;
    const seen = typeof aircraft.seen_pos === "number" ? aircraft.seen_pos : 0;
    if (seen > 90) continue; // a dropout, not a position

    const callsign = aircraft.flight?.trim() || null;
    const registration = aircraft.r ?? null;

    // ADS-B declares its own kind: category B1 is a glider/sailplane, A7 a
    // rotorcraft, and some gliders send the GLID type designator instead.
    const kind: TrafficKind =
      aircraft.category === "B1" || aircraft.t === "GLID"
        ? "glider"
        : aircraft.category === "A7"
          ? "helicopter"
          : "powered";

    flights.push({
      id: `adsb:${aircraft.hex.toLowerCase()}`,
      source: "adsb",
      kind,
      ident: callsign ?? registration ?? aircraft.hex.toUpperCase(),
      registration,
      aircraftType: aircraft.t ?? null,
      address: aircraft.hex.toLowerCase(),
      lat,
      lon,
      altitudeFt: typeof aircraft.alt_baro === "number" ? aircraft.alt_baro : null,
      groundSpeedKt: typeof aircraft.gs === "number" ? Math.round(aircraft.gs) : null,
      climbFpm:
        typeof aircraft.baro_rate === "number"
          ? Math.round(aircraft.baro_rate)
          : typeof aircraft.geom_rate === "number"
            ? Math.round(aircraft.geom_rate)
            : null,
      trackDeg: typeof aircraft.track === "number" ? aircraft.track : null,
      ageSec: seen,
      ...fromField(lat, lon),
    });
  }
  return flights;
}
