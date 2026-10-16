// Electronic files for the moving map — the waypoint and airspace downloads the
// flying page serves, and the upstream discovery that keeps them current.
//
// Nothing is checked in:
//
// - The Gorham turnpoint set is Evan Ludeman's package on the Worldwide Soaring
//   Turnpoint Exchange (soaringweb.org/TP/Gorham). The exchange republishes it under
//   its own file name; this module reads the exchange's listing and serves whatever
//   it currently publishes, so a checked-in copy cannot fall years behind.
// - The all-USA airspace file is the exchange's NASR-derived package, reissued every
//   AIRAC cycle. The club's glider area — the LOA's 10 NM cylinder, 18,000–24,000 ft
//   — is merged into the current file at download time, and generated on its own for
//   the glider-area-only files.
//
// The parsers and builders are pure so they can be exercised directly; the fetch
// helpers carry the cache windows and are used by the /api/nav routes.

import { AREA_RADIUS_NM, GLIDER_AREA } from "@/lib/wx-grid";

/** The exchange's pages — the index carries the package date, files.html the links. */
export const WSTX_GORHAM_PAGE = "https://soaringweb.org/TP/Gorham/";
export const WSTX_GORHAM_FILES = "https://soaringweb.org/TP/Gorham/files.html";

/** Airspace for North America — the all-USA file turns over with each AIRAC cycle. */
export const WSTX_AIRSPACE_PAGE = "https://soaringweb.org/Airspace/NA/HomePage.html";

/** Upstream freshness — the exchange changes rarely, so half a day is generous. */
const UPSTREAM_REVALIDATE = 12 * 60 * 60;

/**
 * The glider area's own numbers — the LOA's cylinder as the airspace files state it.
 * The centre and radius come from the site's one definition in @/lib/wx-grid; the
 * vertical limits live only here.
 */
export const GLIDER_AREA_BASE_FT = 18_000;
export const GLIDER_AREA_TOPS_FT = 24_000;

export type AirspaceFormat = "sua" | "openair";

/* ------------------------------- waypoints --------------------------------- */

/** One row of the exchange's CUP file, as the map and the tooltip need it. */
export type CupWaypoint = {
  name: string;
  code: string;
  lat: number;
  lon: number;
  /** Feet above sea level; null when the exchange carries no elevation. */
  elevationFt: number | null;
  /** The CUP style number: 1 turn point, 2/5 airfields, 3 outlanding, 0 other. */
  style: number;
  description: string;
};

/** The exchange's current package: the file it publishes, its date, the points. */
export type GorhamWaypoints = {
  /** The CUP file the exchange currently publishes. */
  url: string;
  /** The exchange's own "Dated:" line, verbatim — the package is not a live feed. */
  dated: string | null;
  waypoints: CupWaypoint[];
};

/**
 * One CSV row of a CUP file: quoted fields may contain commas, and a doubled
 * quote is a literal quote.
 */
function splitCupRow(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const character = line[i];
    if (quoted) {
      if (character === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        current += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      fields.push(current);
      current = "";
    } else {
      current += character;
    }
  }
  fields.push(current);
  return fields;
}

/** `4316.667N` — degrees and decimal minutes, with the hemisphere's sign. */
function parseCupCoordinate(value: string, negative: string): number | null {
  const match = value.trim().match(/^(\d{2,3})(\d{2}\.\d+)([NSEW])$/);
  if (!match) return null;
  const degrees = Number(match[1]) + Number(match[2]) / 60;
  return match[3] === negative ? -degrees : degrees;
}

/**
 * Parse a CUP waypoint file. The rows between the header and the
 * `-----Related Tasks-----` trailer are the waypoints; anything unparseable is
 * skipped rather than failing the whole list.
 */
export function parseCup(text: string): CupWaypoint[] {
  const waypoints: CupWaypoint[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith("Title,")) continue;
    // The trailer opens the task section; waypoint rows never follow it.
    if (line.startsWith("-----")) break;
    const fields = splitCupRow(line);
    if (fields.length < 7) continue;
    const lat = parseCupCoordinate(fields[3], "S");
    const lon = parseCupCoordinate(fields[4], "W");
    if (lat === null || lon === null) continue;
    const elevation = Number.parseFloat(fields[5]);
    waypoints.push({
      name: fields[0].trim(),
      code: fields[1].trim(),
      lat,
      lon,
      elevationFt: Number.isFinite(elevation) ? elevation : null,
      style: Number.parseInt(fields[6], 10) || 0,
      description: fields[10]?.trim() ?? "",
    });
  }
  return waypoints;
}

/**
 * The CUP link the exchange's files page carries — its plain package, not the
 * `_nm` variant that repeats the control point number in the name.
 */
export function discoverWaypointCup(html: string): string | null {
  const links = [...html.matchAll(/href="([^"]+\.cup)"/gi)].map((match) => match[1]);
  const plain = links.find((href) => !href.includes("_nm")) ?? links[0];
  return plain ? new URL(plain, WSTX_GORHAM_FILES).toString() : null;
}

/** The GPX links on the exchange's files page: the Garmin one first, then the SkyDemon export. */
export function discoverWaypointGpx(html: string): string[] {
  const links = [...html.matchAll(/href="([^"]+\.gpx)"/gi)].map((match) => match[1]);
  const unique = [...new Set(links)];
  return [...unique.filter((href) => !href.includes("SkyDemon")), ...unique.filter((href) => href.includes("SkyDemon"))].map(
    (href) => new URL(href, WSTX_GORHAM_FILES).toString(),
  );
}

/** The exchange's "Dated:" line, which marks how old the package is. */
export function discoverWaypointDated(html: string): string | null {
  const match = html.match(/Dated:\s*([^<\n]+)/i);
  return match ? match[1].trim() : null;
}

export type GorhamFileSet = {
  cup: string;
  /**
   * In preference order. The exchange's own Garmin link has answered 404 for a
   * while, so the SkyDemon GPX stands behind it rather than leaving GPX broken.
   */
  gpx: string[];
  dated: string | null;
};

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    next: { revalidate: UPSTREAM_REVALIDATE },
    headers: { "User-Agent": "mtwashingtonsoaring.org flying page" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response.text();
}

/** The exchange's current file set for Gorham — discovered fresh, cached upstream. */
export async function fetchGorhamFileSet(): Promise<GorhamFileSet> {
  const [filesHtml, pageHtml] = await Promise.all([
    fetchText(WSTX_GORHAM_FILES),
    fetchText(WSTX_GORHAM_PAGE),
  ]);
  const cup = discoverWaypointCup(filesHtml);
  if (!cup) throw new Error("the exchange lists no CUP file for Gorham");
  return {
    cup,
    gpx: discoverWaypointGpx(filesHtml),
    dated: discoverWaypointDated(pageHtml),
  };
}

/** Download the exchange's current CUP file, parsed. */
export async function fetchGorhamWaypoints(): Promise<GorhamWaypoints> {
  const files = await fetchGorhamFileSet();
  const waypoints = parseCup(await fetchText(files.cup));
  if (waypoints.length === 0) throw new Error("the exchange's CUP file carried no waypoints");
  return { url: files.cup, dated: files.dated, waypoints };
}

/**
 * The raw exchange file for one of the waypoint formats, for downloading. The GPX
 * sides walk the discovered candidates: an exchange link that has gone stale falls
 * through to the next export instead of failing the download.
 */
export async function fetchWaypointDownload(format: "cup" | "gpx"): Promise<string> {
  const files = await fetchGorhamFileSet();
  if (format === "cup") return fetchText(files.cup);
  if (files.gpx.length === 0) throw new Error("the exchange lists no GPX file for Gorham");
  let lastError: unknown = null;
  for (const url of files.gpx) {
    try {
      return await fetchText(url);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("no GPX file served");
}

/* -------------------------------- airspace --------------------------------- */

/** The exchange's current all-USA package: its version and the two format URLs. */
export type UsaAirspace = {
  /** e.g. `v26.09-03.1` — the exchange's own label for the issue. */
  version: string;
  /** ISO date the NASR data is effective, derived from the version label. */
  effective: string | null;
  sua: string;
  openair: string;
};

/**
 * Discover the current all-USA file from the exchange's North America page. The
 * page lists the formats side by side under one version; if old versions linger in
 * the markup too, the newest is kept.
 */
export function discoverUsaAirspace(html: string): UsaAirspace | null {
  const found = new Map<
    string,
    { version: string; sua?: string; openair?: string }
  >();
  // The version label carries dots of its own (`v26.09-03.1`), so everything up to
  // the format extension is captured lazily.
  for (const match of html.matchAll(/href="([^"]*allusa\.(v[^"]+?)\.(sua|txt|cub|kmz))"/gi)) {
    const [, href, version, format] = match;
    const entry = found.get(version) ?? { version };
    if (format === "sua") entry.sua = new URL(href, WSTX_AIRSPACE_PAGE).toString();
    if (format === "txt") entry.openair = new URL(href, WSTX_AIRSPACE_PAGE).toString();
    found.set(version, entry);
  }
  const complete = [...found.values()].filter((entry) => entry.sua && entry.openair);
  if (complete.length === 0) return null;
  const newest = complete.sort(compareAirspaceVersions)[0];
  return {
    version: newest.version,
    effective: effectiveFromVersion(newest.version),
    sua: newest.sua as string,
    openair: newest.openair as string,
  };
}

/** Version labels read `v26.09-03.1` — year, month, day, then the revision. */
function versionParts(version: string): number[] {
  const match = version.match(/^v(\d{2})\.(\d{2})-(\d{2})\.(\d+)$/);
  if (!match) return [0];
  return [Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4])];
}

function compareAirspaceVersions(a: { version: string }, b: { version: string }): number {
  const left = versionParts(a.version);
  const right = versionParts(b.version);
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const difference = (right[i] ?? 0) - (left[i] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function effectiveFromVersion(version: string): string | null {
  const match = version.match(/^v(\d{2})\.(\d{2})-(\d{2})/);
  return match ? `20${match[1]}-${match[2]}-${match[3]}` : null;
}

/** The effective date the NASR header states, when the version label was silent. */
function effectiveFromHeader(text: string): string | null {
  const match = text.match(/EFFECTIVE\s+(\d{4}-\d{2}-\d{2})/i);
  return match ? match[1] : null;
}

/** `441726` / `0711340` — the degrees-minutes-seconds strings the airspace files use. */
function degMinSec(value: number, degreeDigits: number): string {
  const absolute = Math.abs(value);
  let degrees = Math.floor(absolute);
  let minutes = Math.floor((absolute - degrees) * 60);
  let seconds = Math.round((absolute - degrees - minutes / 60) * 3600);
  if (seconds === 60) {
    seconds = 0;
    minutes += 1;
  }
  if (minutes === 60) {
    minutes = 0;
    degrees += 1;
  }
  return `${String(degrees).padStart(degreeDigits, "0")}${String(minutes).padStart(2, "0")}${String(seconds).padStart(2, "0")}`;
}

/** The glider area as the two airspace cultures write a cylinder. */
export function gliderAreaBlock(format: AirspaceFormat): string {
  const lat = degMinSec(GLIDER_AREA.lat, 2);
  const lon = degMinSec(GLIDER_AREA.lon, 3);
  const base = GLIDER_AREA_BASE_FT.toLocaleString("en-US");
  const tops = GLIDER_AREA_TOPS_FT.toLocaleString("en-US");
  if (format === "sua") {
    return [
      "### MT WASHINGTON WAVE GLIDER AREA",
      `# The LOA's ${AREA_RADIUS_NM} NM cylinder, ${base}-${tops} ft MSL.`,
      "INCLUDE=YES",
      "TITLE=GLIDER AREA",
      "TYPE=GSEC",
      `BASE=${GLIDER_AREA_BASE_FT}`,
      `TOPS=${GLIDER_AREA_TOPS_FT}`,
      `CIRCLE RADIUS=${AREA_RADIUS_NM} CENTRE=N${lat} W${lon}`,
      "#",
      "",
    ].join("\n");
  }
  return [
    "* ## MT WASHINGTON WAVE GLIDER AREA",
    `* The LOA's ${AREA_RADIUS_NM} NM cylinder, ${base}-${tops} ft MSL.`,
    "AC W",
    "AN GLIDER AREA",
    `AL ${GLIDER_AREA_BASE_FT} MSL`,
    `AH ${GLIDER_AREA_TOPS_FT} MSL`,
    `V X=${lat.slice(0, 2)}:${lat.slice(2, 4)}:${lat.slice(4)} N ${lon.slice(0, 3)}:${lon.slice(3, 5)}:${lon.slice(5)} W`,
    `DC ${AREA_RADIUS_NM.toFixed(2)}`,
    "",
  ].join("\n");
}

/**
 * Insert the glider area into a downloaded all-USA file. The block goes after the
 * file's own attribution header — anchored on the line every issue of the NASR
 * package has carried — and before the first airspace entry.
 */
export function mergeGliderArea(base: string, format: AirspaceFormat): string {
  const lines = base.split(/\r?\n/);
  let insertAt = -1;
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (/any redistribution must/i.test(lines[i])) {
      insertAt = i + 1;
      break;
    }
  }
  if (insertAt < 0) {
    const comment = format === "sua" ? "#" : "*";
    insertAt = 0;
    while (
      insertAt < lines.length &&
      (lines[insertAt].trim() === "" || lines[insertAt].startsWith(comment))
    ) {
      insertAt += 1;
    }
  }
  return [...lines.slice(0, insertAt), ...gliderAreaBlock(format).split("\n"), ...lines.slice(insertAt)].join("\n");
}

/** The exchange's current all-USA package, merged with the club's glider area. */
export async function fetchAllUsaAirspace(
  format: AirspaceFormat,
): Promise<{ text: string; version: string; effective: string | null }> {
  const airspace = discoverUsaAirspace(await fetchText(WSTX_AIRSPACE_PAGE));
  if (!airspace) throw new Error("the exchange lists no all-USA airspace file");
  const base = await fetchText(format === "sua" ? airspace.sua : airspace.openair);
  return {
    text: mergeGliderArea(base, format),
    version: airspace.version,
    effective: airspace.effective ?? effectiveFromHeader(base),
  };
}

/** Just the exchange's current version label and effective date, for the viewer. */
export async function fetchUsaAirspaceIssue(): Promise<Omit<UsaAirspace, "sua" | "openair">> {
  const airspace = discoverUsaAirspace(await fetchText(WSTX_AIRSPACE_PAGE));
  if (!airspace) throw new Error("the exchange lists no all-USA airspace file");
  return { version: airspace.version, effective: airspace.effective };
}

/* ------------------------------- downloads --------------------------------- */

export type NavDownloadId =
  | "waypoints-cup"
  | "waypoints-gpx"
  | "airspace-glider-sua"
  | "airspace-glider-openair"
  | "airspace-allusa-sua"
  | "airspace-allusa-openair";

export type NavDownload = {
  id: NavDownloadId;
  /** The file name the download is served under. */
  file: string;
  /** The format, as the button reads it. */
  meta: string;
  /** Which moving maps and flight computers read it. */
  apps: string;
};

export type NavDownloadGroup = {
  id: "waypoints" | "glider" | "allusa";
  title: string;
  description: string;
};

/**
 * The download shelf. The waypoint and airspace files are built by
 * /api/nav/download at request time; the file names keep the names the old static
 * files had, so links in camp emails keep working.
 */
export const NAV_DOWNLOAD_GROUPS: NavDownloadGroup[] = [
  {
    id: "waypoints",
    title: "Gorham area waypoints",
    description: "The exchange's 250-point package for the wave country — the current file, straight from soaringweb.org.",
  },
  {
    id: "glider",
    title: "Glider area airspace",
    description: "Just the LOA's 10 NM cylinder, 18,000–24,000 ft — for devices that only need the wave airspace.",
  },
  {
    id: "allusa",
    title: "All USA airspace + glider area",
    description: "The exchange's current NASR file with the glider area merged in automatically — nothing to keep in step.",
  },
];

export const NAV_DOWNLOADS: (NavDownload & { group: NavDownloadGroup["id"] })[] = [
  { id: "waypoints-cup", group: "waypoints", file: "gorham-waypoints.cup", meta: "CUP", apps: "SeeYou, XCSoar, TopHat, LK8000" },
  { id: "waypoints-gpx", group: "waypoints", file: "gorham-waypoints.gpx", meta: "GPX", apps: "Garmin, ForeFlight, most apps" },
  { id: "airspace-glider-sua", group: "glider", file: "mwsa-glider-area.sua", meta: "SUA", apps: "Newport-Peace format" },
  { id: "airspace-glider-openair", group: "glider", file: "mwsa-glider-area.txt", meta: "TXT", apps: "OpenAir (XCSoar, SeeYou Navigator)" },
  { id: "airspace-allusa-sua", group: "allusa", file: "allusa-with-mwsa-glider-area.sua", meta: "SUA", apps: "Newport-Peace format" },
  { id: "airspace-allusa-openair", group: "allusa", file: "allusa-with-mwsa-glider-area.txt", meta: "TXT", apps: "OpenAir (XCSoar, SeeYou Navigator)" },
];

export function navDownloadHref(id: NavDownloadId): string {
  return `/api/nav/download?file=${id}`;
}
