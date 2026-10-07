// Shared pieces of the wave-field views: the vertical-velocity handling and the colour
// ramp the cross-section, the map and the map's canvas all read from. Both scales are
// labelled in knots of climb — what a vario shows — matching how wave forecasts are
// read in the cockpit (1 m/s of w ≈ 1.94 kt).

/**
 * Open-Meteo serves HRRR's vertical velocity at pressure levels already in m/s
 * (verified against `hourly_units` — not omega), so this is a null guard, kept as the
 * one place the two views pass their values through.
 */
export function wMs(value: number | null | undefined): number | null {
  return typeof value === "number" ? value : null;
}

export type WaveScale = "linear" | "hrrr" | "wrf";

type Band = { min: number; className: string; rgb: [number, number, number] };

/**
 * The HRRR product's own range — its smoothed pressure-level field tops out near
 * ±0.5 m/s, so the bands stay tight. Thresholds in m/s, shown in kt.
 */
const HRRR_BANDS: Band[] = [
  { min: 0.5, className: "fill-red-600/85", rgb: [220, 38, 38] },
  { min: 0.3, className: "fill-orange-500/85", rgb: [249, 115, 22] },
  { min: 0.15, className: "fill-amber-400/85", rgb: [251, 191, 36] },
  { min: 0.05, className: "fill-amber-200/85", rgb: [253, 230, 138] },
  { min: -0.05, className: "fill-slate-200/70", rgb: [226, 232, 240] },
  { min: -0.15, className: "fill-sky-200/85", rgb: [186, 230, 253] },
  { min: -0.3, className: "fill-sky-300/85", rgb: [125, 211, 252] },
  { min: -Infinity, className: "fill-sky-500/85", rgb: [14, 165, 233] },
];

/**
 * The linear estimate reaches several m/s on resonant days — bands every 0.1 kt up
 * low, stretching to 4 kt, so the cores read rather than saturate.
 */
const LINEAR_BANDS: Band[] = [
  { min: 2.0574, className: "fill-purple-900/85", rgb: [88, 28, 135] },
  { min: 1.286, className: "fill-rose-700/85", rgb: [190, 18, 60] },
  { min: 0.7716, className: "fill-red-600/85", rgb: [220, 38, 38] },
  { min: 0.4115, className: "fill-orange-500/85", rgb: [249, 115, 22] },
  { min: 0.1543, className: "fill-amber-400/85", rgb: [251, 191, 36] },
  { min: 0.0514, className: "fill-amber-200/85", rgb: [253, 230, 138] },
  { min: -0.0514, className: "fill-slate-200/70", rgb: [226, 232, 240] },
  { min: -0.1543, className: "fill-sky-200/85", rgb: [186, 230, 253] },
  { min: -0.4115, className: "fill-sky-300/85", rgb: [125, 211, 252] },
  { min: -0.7716, className: "fill-sky-500/85", rgb: [14, 165, 233] },
  { min: -1.286, className: "fill-sky-700/85", rgb: [3, 105, 161] },
  { min: -Infinity, className: "fill-indigo-900/85", rgb: [49, 46, 129] },
];

/**
 * The WRF 1 km field is an explicit simulation: its crest cores reach ±10 m/s
 * (≈ ±20 kt), so the HRRR ramp pinned the whole cross-section to one saturated
 * blob. This ramp runs out to 12 kt, so the wave train reads as bands.
 */
const WRF_BANDS: Band[] = [
  { min: 6.1734, className: "fill-purple-900/85", rgb: [88, 28, 135] }, // ≥12 kt
  { min: 4.1155, className: "fill-rose-700/85", rgb: [190, 18, 60] }, // 8
  { min: 2.5722, className: "fill-red-600/85", rgb: [220, 38, 38] }, // 5
  { min: 1.5433, className: "fill-orange-500/85", rgb: [249, 115, 22] }, // 3
  { min: 0.7717, className: "fill-amber-400/85", rgb: [251, 191, 36] }, // 1.5
  { min: 0.2572, className: "fill-amber-200/85", rgb: [253, 230, 138] }, // 0.5
  { min: -0.2572, className: "fill-slate-200/70", rgb: [226, 232, 240] },
  { min: -0.7717, className: "fill-sky-200/85", rgb: [186, 230, 253] },
  { min: -1.5433, className: "fill-sky-300/85", rgb: [125, 211, 252] },
  { min: -2.5722, className: "fill-sky-500/85", rgb: [14, 165, 233] },
  { min: -4.1155, className: "fill-sky-700/85", rgb: [3, 105, 161] },
  { min: -Infinity, className: "fill-indigo-900/85", rgb: [49, 46, 129] },
];

const WAVE_BANDS: Record<WaveScale, Band[]> = { hrrr: HRRR_BANDS, linear: LINEAR_BANDS, wrf: WRF_BANDS };

export function cellFill(w: number, scale: WaveScale = "hrrr"): string {
  const bands = WAVE_BANDS[scale];
  return bands.find((band) => w >= band.min)?.className ?? bands[bands.length - 1].className;
}

export function cellRgb(w: number, scale: WaveScale = "hrrr"): [number, number, number] {
  const bands = WAVE_BANDS[scale];
  return bands.find((band) => w >= band.min)?.rgb ?? bands[bands.length - 1].rgb;
}

const WAVE_LEGEND: Record<WaveScale, { className: string; label: string }[]> = {
  hrrr: [
    { className: "bg-sky-500/85", label: "≤−1.0" },
    { className: "bg-sky-300/85", label: "−0.6" },
    { className: "bg-sky-200/85", label: "−0.3" },
    { className: "bg-slate-200/70", label: "−0.1" },
    { className: "bg-amber-200/85", label: "0.1" },
    { className: "bg-amber-400/85", label: "0.3" },
    { className: "bg-orange-500/85", label: "0.6" },
    { className: "bg-red-600/85", label: "≥1.0" },
  ],
  linear: [
    { className: "bg-indigo-900/85", label: "≤−4" },
    { className: "bg-sky-700/85", label: "−2.5" },
    { className: "bg-sky-500/85", label: "−1.5" },
    { className: "bg-sky-300/85", label: "−0.8" },
    { className: "bg-sky-200/85", label: "−0.3" },
    { className: "bg-slate-200/70", label: "−0.1" },
    { className: "bg-amber-200/85", label: "0.1" },
    { className: "bg-amber-400/85", label: "0.3" },
    { className: "bg-orange-500/85", label: "0.8" },
    { className: "bg-red-600/85", label: "1.5" },
    { className: "bg-rose-700/85", label: "2.5" },
    { className: "bg-purple-900/85", label: "≥4" },
  ],
  wrf: [
    { className: "bg-indigo-900/85", label: "≤−12" },
    { className: "bg-sky-700/85", label: "−8" },
    { className: "bg-sky-500/85", label: "−5" },
    { className: "bg-sky-300/85", label: "−3" },
    { className: "bg-sky-200/85", label: "−1.5" },
    { className: "bg-slate-200/70", label: "−0.5" },
    { className: "bg-amber-200/85", label: "0.5" },
    { className: "bg-amber-400/85", label: "1.5" },
    { className: "bg-orange-500/85", label: "3" },
    { className: "bg-red-600/85", label: "5" },
    { className: "bg-rose-700/85", label: "8" },
    { className: "bg-purple-900/85", label: "≥12" },
  ],
};

const WAVE_CAPTIONS: Record<WaveScale, string> = {
  hrrr: "climb rate, kt (HRRR) — warm is lift, blue is sink",
  linear: "climb rate, kt — linear-theory estimate; warm is lift, blue is sink",
  wrf: "climb rate, kt (WRF 1 km) — warm is lift, blue is sink",
};

/** The swatch row shared by both views. */
export function WaveLegend({ scale = "hrrr" }: { scale?: WaveScale }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="flex flex-wrap items-center gap-1" aria-hidden="true">
        {WAVE_LEGEND[scale].map((entry) => (
          <span key={entry.label} className="flex w-9 flex-col items-center gap-0.5">
            <span className={`h-2.5 w-full rounded-sm ${entry.className}`} />
            <span className="text-[9px] tabular-nums text-slate-400">{entry.label}</span>
          </span>
        ))}
      </div>
      <p className="text-[11px] text-slate-400">{WAVE_CAPTIONS[scale]}</p>
    </div>
  );
}
