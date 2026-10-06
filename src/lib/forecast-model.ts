// The forecast model behind the profile and summit cards: GEM-HRDPS (2.5 km, four runs
// a day) over the northeast, with GFS as the per-variable fallback so a missing level
// (HRDPS has no 975 hPa) cannot empty a card.
//
// HRRR is real on Open-Meteo as `ncep_hrrr_conus` — verified 2026-10-06 against pure
// `gfs_global`. Careful: `gfs_seamless` itself blends HRRR with GFS over CONUS, so it
// is not a pure-GFS baseline. The wave forecast runs on HRRR directly; these cards run
// HRDPS with the GFS fill.

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
