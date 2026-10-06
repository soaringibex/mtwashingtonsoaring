// The forecast model behind the weather cards: GEM-HRDPS (2.5 km, four runs a day) over
// the northeast, with GFS as the per-variable fallback so a missing level or an outage
// below cannot empty a card — HRDPS has no 975 hPa level, and the fallback covers gaps.
//
// HRRR was the first choice, but Open-Meteo's `ncep_hrrr_conus` id currently serves GFS
// data verbatim (verified 2026-10-06: the series are byte-identical while icon differs),
// so HRRR is not a real option on that API.

export const FORECAST_MODELS = "gem_hrdps_continental,gfs_seamless";

type Series = (number | null)[];
type Hourly = Record<string, unknown>;

/** One variable from the multi-model response: HRDPS first, GFS where HRDPS has none. */
export function mergedSeries(hourly: Hourly, key: string): Series | null {
  const primary = hourly[`${key}_gem_hrdps_continental`] as Series | undefined;
  const fallback = hourly[`${key}_gfs_seamless`] as Series | undefined;
  if (!primary && !fallback) return null;
  if (!primary) return fallback ?? null;
  if (!fallback) return primary;
  return primary.map((value, index) =>
    typeof value === "number" ? value : (fallback[index] ?? null),
  );
}
