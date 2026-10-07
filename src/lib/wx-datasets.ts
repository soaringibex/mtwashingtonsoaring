// The single home of every Wavecast datum's shape — coordinates, pressure levels, and
// the upstream URL each dataset maps to.
//
// Open-Meteo's free tier counts every requested location against a per-minute, per-IP
// budget (~600), and a cold page used to spend ~400 of a visitor's own IP on it. Every
// request now goes through /api/wx/<dataset>, which fetches upstream once per dataset
// per refresh window and serves every visitor from cache.

import { FORECAST_MODELS } from "@/lib/forecast-model";
import { WAVE_LEVELS } from "@/lib/wave-score";
import {
  AREA_RADIUS_NM,
  CROSS_LEVELS,
  GLIDER_AREA,
  KM_PER_NM,
  MAP_COLS,
  MAP_GRID,
  MAP_LAT_MIN,
  MAP_LAT_SPAN,
  MAP_LEVELS,
  MAP_LON_MIN,
  MAP_LON_SPAN,
  MAP_ROWS,
  MODEL_DISTANCES,
  WINDOW_KM,
  alongTransect,
  azimuthBucket,
} from "@/lib/wx-grid";

// The grid/level constants themselves live in @/lib/wx-grid so the WRF pipeline
// can read them (public/wrf-contract.json); re-exported here so every existing
// import keeps working.
export {
  AREA_RADIUS_NM,
  CROSS_LEVELS,
  GLIDER_AREA,
  KM_PER_NM,
  MAP_COLS,
  MAP_GRID,
  MAP_LAT_MIN,
  MAP_LAT_SPAN,
  MAP_LEVELS,
  MAP_LON_MIN,
  MAP_LON_SPAN,
  MAP_ROWS,
  MODEL_DISTANCES,
  WINDOW_KM,
  alongTransect,
  azimuthBucket,
};

export const GORHAM = { lat: 44.3931, lon: -71.1996 };
export const SUMMIT = { lat: 44.2705, lon: -71.3032 };

/** The cross-section solve line — 1 km samples, wide enough that the taper stays outside the circle. */
export const SOLVE_DX_M = 1000;
export const SOLVE_DISTANCES = Array.from({ length: 73 }, (_, i) => i - 36);

/** The wind card's pressure levels, in hPa. */
export const WIND_DAY_LEVELS = [1000, 975, 950, 925, 900, 850, 800, 700, 600, 500, 400, 300, 250, 200];

export type WxDataset =
  | "column"
  | "column-upwind"
  | "wave-forecast"
  | "cross-section"
  | "map-field"
  | "terrain-line"
  | "wind-day"
  | "summit-hourly"
  | "summit-current"
  | "wrf-map-field"
  | "wrf-cross-section"
  | "wrf-run";

/** The client-side path for a dataset. */
export function wxApiPath(dataset: WxDataset, params?: Record<string, string | number>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) query.set(key, String(value));
  const search = query.toString();
  return `/api/wx/${dataset}${search ? `?${search}` : ""}`;
}

const FORECAST = "https://api.open-meteo.com/v1/forecast";
const ELEVATION = "https://api.open-meteo.com/v1/elevation";

const coordsOf = (points: { lat: number; lon: number }[]) =>
  `latitude=${points.map((p) => p.lat.toFixed(4)).join(",")}` +
  `&longitude=${points.map((p) => p.lon.toFixed(4)).join(",")}`;

const levelVars = (levels: readonly number[], variables: string[]) =>
  levels.flatMap((hPa) => variables.map((variable) => `${variable}_${hPa}hPa`)).join(",");

/** The elevation endpoint takes at most 100 coordinates per request. */
const elevationUrls = (points: { lat: number; lon: number }[]): string[] => {
  const urls: string[] = [];
  for (let start = 0; start < points.length; start += 100) {
    urls.push(`${ELEVATION}?${coordsOf(points.slice(start, start + 100))}`);
  }
  return urls;
};

export type UpstreamRequest = {
  urls: string[];
  /** Seconds the upstream response stays fresh. */
  revalidate: number;
  /** Elevation responses merge into one `{ elevation }` payload. */
  elevationMerge?: boolean;
  /** Chunked location responses merge into one array of locations. */
  locationsMerge?: boolean;
};

/** Keep upstream URLs under the 8 KB limit — roughly 200 locations of overhead. */
const LOCATION_CHUNK = 200;

const locationChunks = (points: { lat: number; lon: number }[]) => {
  const chunks: { lat: number; lon: number }[][] = [];
  for (let start = 0; start < points.length; start += LOCATION_CHUNK) {
    chunks.push(points.slice(start, start + LOCATION_CHUNK));
  }
  return chunks;
};

const bucketParam = (params: URLSearchParams): number | null => {
  const azimuth = Number(params.get("azimuth"));
  if (!Number.isInteger(azimuth) || azimuth % 5 !== 0 || azimuth < 0 || azimuth >= 360) return null;
  return azimuth;
};

/**
 * The WRF pipeline's Blob prefix (https://<store>.public.blob.vercel-storage.com/wrf/).
 * Unset outside camp — the WRF views read null as "no field" and stay on HRRR.
 */
function wrfBlobPrefix(): string | null {
  const base = process.env.WRF_BLOB_BASE_URL;
  if (!base) return null;
  return base.endsWith("/") ? base : `${base}/`;
}

/** The upstream request for a dataset, or null when the parameters are not in the whitelist. */
export function buildUpstreamRequest(dataset: string, params: URLSearchParams): UpstreamRequest | null {
  switch (dataset) {
    case "column":
      return {
        urls: [
          `${FORECAST}?${coordsOf([GORHAM])}` +
            `&hourly=${levelVars(WAVE_LEVELS, ["geopotential_height", "wind_speed", "wind_direction", "temperature"])}` +
            `&models=ncep_hrrr_conus&wind_speed_unit=ms&temperature_unit=celsius` +
            `&timezone=America%2FNew_York&forecast_days=2`,
        ],
        revalidate: 900,
      };

    case "column-upwind": {
      const azimuth = bucketParam(params);
      if (azimuth === null) return null;
      // The undisturbed inflow sounding: 48 km toward the wind's source. The local
      // Gorham column is inside the wave on a NW day, and the solve's amplitude
      // scales linearly with the base-plane wind it supplies.
      const point = alongTransect(GLIDER_AREA, azimuth, 48);
      return {
        urls: [
          `${FORECAST}?${coordsOf([point])}` +
            `&hourly=${levelVars(WAVE_LEVELS, ["geopotential_height", "wind_speed", "wind_direction", "temperature"])}` +
            `&models=ncep_hrrr_conus&wind_speed_unit=ms&temperature_unit=celsius` +
            `&timezone=America%2FNew_York&forecast_days=2`,
        ],
        revalidate: 900,
      };
    }

    case "wave-forecast": {
      const variant = params.get("models");
      if (variant !== "hrrr" && variant !== "hrdps") return null;
      const models = variant === "hrrr" ? "ncep_hrrr_conus" : FORECAST_MODELS;
      return {
        urls: [
          `${FORECAST}?${coordsOf([GORHAM])}` +
            `&hourly=${levelVars(WAVE_LEVELS, ["geopotential_height", "wind_speed", "wind_direction", "temperature", "cloud_cover"])}` +
            `&models=${models}&wind_speed_unit=kn&temperature_unit=celsius` +
            `&timezone=America%2FNew_York&forecast_days=2`,
        ],
        revalidate: 900,
      };
    }

    case "cross-section": {
      const azimuth = bucketParam(params);
      if (azimuth === null) return null;
      const points = MODEL_DISTANCES.map((d) => alongTransect(GLIDER_AREA, (azimuth + 180) % 360, d));
      return {
        urls: [
          `${FORECAST}?${coordsOf(points)}` +
            `&hourly=${levelVars(CROSS_LEVELS, ["vertical_velocity", "geopotential_height"])}` +
            `&models=ncep_hrrr_conus&temperature_unit=celsius` +
            `&timezone=America%2FNew_York&forecast_days=2`,
        ],
        revalidate: 900,
      };
    }

    case "map-field":
      return {
        urls: locationChunks(MAP_GRID).map(
          (chunk) =>
            `${FORECAST}?${coordsOf(chunk)}` +
            `&hourly=${levelVars(MAP_LEVELS.map((entry) => entry.hPa), ["vertical_velocity"])}` +
            `&models=ncep_hrrr_conus&timezone=America%2FNew_York&forecast_days=2`,
        ),
        revalidate: 900,
        locationsMerge: true,
      };

    case "terrain-line": {
      const azimuth = bucketParam(params);
      if (azimuth === null) return null;
      const points = SOLVE_DISTANCES.map((d) => alongTransect(GLIDER_AREA, (azimuth + 180) % 360, d));
      return { urls: elevationUrls(points), revalidate: 604800, elevationMerge: true };
    }

    case "wind-day":
      return {
        urls: [
          `${FORECAST}?${coordsOf([GORHAM])}` +
            `&hourly=${["wind_speed_10m", "wind_direction_10m", "temperature_2m", "surface_pressure", ...WIND_DAY_LEVELS.flatMap((hPa) => [`geopotential_height_${hPa}hPa`, `wind_speed_${hPa}hPa`, `wind_direction_${hPa}hPa`, `temperature_${hPa}hPa`])].join(",")}` +
            `&models=${FORECAST_MODELS}&wind_speed_unit=kn&temperature_unit=fahrenheit` +
            `&timezone=America%2FNew_York&forecast_days=2`,
        ],
        revalidate: 900,
      };

    case "summit-hourly":
      return {
        urls: [
          `${FORECAST}?${coordsOf([SUMMIT])}` +
            `&hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m,temperature_2m` +
            `&models=${FORECAST_MODELS}&wind_speed_unit=kn&temperature_unit=fahrenheit` +
            `&timezone=America%2FNew_York&forecast_days=2&elevation=1916`,
        ],
        revalidate: 900,
      };

    case "summit-current":
      return {
        urls: [
          `${FORECAST}?${coordsOf([SUMMIT])}` +
            `&current=temperature_2m,wind_speed_10m,wind_gusts_10m,wind_direction_10m` +
            `&wind_speed_unit=kn&temperature_unit=fahrenheit&elevation=1916&timezone=UTC`,
        ],
        revalidate: 300,
      };

    case "wrf-map-field": {
      const base = wrfBlobPrefix();
      return base ? { urls: [`${base}map-field.json`], revalidate: 900 } : null;
    }

    case "wrf-cross-section": {
      const azimuth = bucketParam(params);
      if (azimuth === null) return null;
      const base = wrfBlobPrefix();
      return base ? { urls: [`${base}cross-section-${azimuth}.json`], revalidate: 900 } : null;
    }

    case "wrf-run": {
      const base = wrfBlobPrefix();
      return base ? { urls: [`${base}run.json`], revalidate: 300 } : null;
    }

    default:
      return null;
  }
}
