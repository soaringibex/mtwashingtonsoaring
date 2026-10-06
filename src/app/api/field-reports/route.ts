// METARs for the fields around the mountain and the nearest TAF, from NOAA's Aviation
// Weather Center. Served through this route because aviationweather.gov sends no CORS
// headers; responses are cached five minutes at the edge and per warm instance.

const METAR_STATIONS = ["KMWN", "KBML", "KHIE", "KIZG"];
/** Nearest first — the panel shows the first station that actually issues a TAF. */
const TAF_PREFERENCE = ["KHIE", "KCON", "KPWM"];
const CACHE_MS = 5 * 60 * 1000;

type FieldReport = {
  icaoId: string;
  raw: string;
  observedAt: string;
  flightCategory: string | null;
  windDirDeg: number | null;
  windKt: number | null;
  gustKt: number | null;
  visibility: string | null;
  ceilingFt: number | null;
  tempC: number | null;
  altimInHg: number | null;
};

type TafReport = {
  icaoId: string;
  raw: string;
  issuedAt: string | null;
  validFrom: string | null;
  validTo: string | null;
};

type Payload = { metars: FieldReport[]; taf: TafReport | null };

let cache: { at: number; payload: Payload } | null = null;

const num = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

function ceilingFromRecord(record: Record<string, unknown>): number | null {
  let lowest: number | null = null;
  const clouds = Array.isArray(record.clouds) ? record.clouds : [];
  for (const cloud of clouds) {
    const layer = cloud as { cover?: unknown; base?: unknown };
    const cover = typeof layer.cover === "string" ? layer.cover.toUpperCase() : "";
    if (cover !== "BKN" && cover !== "OVC" && cover !== "VV" && cover !== "OVX") continue;
    const base = num(layer.base);
    if (base === null) continue;
    lowest = lowest === null ? base : Math.min(lowest, base); // bases arrive in feet
  }
  if (lowest === null) {
    const vertVis = num(record.vertVis);
    if (vertVis !== null) lowest = vertVis;
  }
  return lowest;
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { "User-Agent": "mtwashingtonsoaring.org weather dashboard" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`aviationweather ${response.status}`);
  return response.json();
}

function shapeMetars(rows: unknown): FieldReport[] {
  if (!Array.isArray(rows)) return [];
  const latest = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const record = row as Record<string, unknown>;
    const id = typeof record.icaoId === "string" ? record.icaoId : null;
    if (!id) continue;
    const current = latest.get(id);
    const time = num(record.obsTime) ?? 0;
    const currentTime = current ? (num(current.obsTime) ?? 0) : -1;
    if (time > currentTime) latest.set(id, record);
  }

  const metars: FieldReport[] = [];
  for (const id of METAR_STATIONS) {
    const record = latest.get(id);
    if (!record || typeof record.rawOb !== "string") continue;
    const altim = num(record.altim);
    metars.push({
      icaoId: id,
      raw: record.rawOb,
      observedAt:
        typeof record.reportTime === "string"
          ? record.reportTime
          : new Date(((num(record.obsTime) ?? 0) as number) * 1000).toISOString(),
      flightCategory: typeof record.fltCat === "string" ? record.fltCat : null,
      windDirDeg: num(record.wdir),
      windKt: num(record.wspd),
      gustKt: num(record.wgst),
      visibility: record.visib === undefined || record.visib === null ? null : String(record.visib),
      ceilingFt: ceilingFromRecord(record),
      tempC: num(record.temp),
      altimInHg: altim === null ? null : altim > 100 ? Math.round(altim * 0.02953 * 100) / 100 : altim,
    });
  }
  return metars;
}

function shapeTaf(rows: unknown): TafReport | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const byStation = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const record = row as Record<string, unknown>;
    const id = typeof record.icaoId === "string" ? record.icaoId : null;
    if (!id) continue;
    const current = byStation.get(id);
    const issued = typeof record.bulletinTime === "string" ? record.bulletinTime : "";
    const currentIssued =
      current && typeof current.bulletinTime === "string" ? current.bulletinTime : "";
    if (issued > currentIssued) byStation.set(id, record);
  }

  for (const id of TAF_PREFERENCE) {
    const record = byStation.get(id);
    if (!record || typeof record.rawTAF !== "string") continue;
    const from = num(record.validTimeFrom);
    const to = num(record.validTimeTo);
    return {
      icaoId: id,
      raw: record.rawTAF,
      issuedAt: typeof record.bulletinTime === "string" ? record.bulletinTime : null,
      validFrom: from === null ? null : new Date(from * 1000).toISOString(),
      validTo: to === null ? null : new Date(to * 1000).toISOString(),
    };
  }
  return null;
}

export async function GET(): Promise<Response> {
  const headers = { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=120" };
  if (cache && Date.now() - cache.at < CACHE_MS) {
    return Response.json(cache.payload, { headers });
  }

  try {
    const [metarRows, tafRows] = await Promise.all([
      fetchJson(
        `https://aviationweather.gov/api/data/metar?ids=${METAR_STATIONS.join(",")}&format=json&hours=3`,
      ),
      fetchJson(`https://aviationweather.gov/api/data/taf?ids=${TAF_PREFERENCE.join(",")}&format=json`),
    ]);
    const payload: Payload = { metars: shapeMetars(metarRows), taf: shapeTaf(tafRows) };
    if (payload.metars.length === 0) throw new Error("no METARs returned");
    cache = { at: Date.now(), payload };
    return Response.json(payload, { headers });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "field reports unavailable" },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
