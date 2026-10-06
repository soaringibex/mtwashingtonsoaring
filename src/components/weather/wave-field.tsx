// Shared pieces of the wave-field views: the vertical-velocity handling and the colour
// ramp the cross-section, the map and the map's canvas all read from.

/**
 * Open-Meteo serves HRRR's vertical velocity at pressure levels already in m/s
 * (verified against `hourly_units` — not omega), so this is a null guard, kept as the
 * one place the two views pass their values through.
 */
export function wMs(value: number | null | undefined): number | null {
  return typeof value === "number" ? value : null;
}

/**
 * The divergent ramp every wave-field view shares. Thresholds sit in the range the
 * HRRR pressure-level field actually reaches over the Presidentials — peaks of a few
 * tenths of a m/s, not metres — so the banding keeps its contrast. `rgb` mirrors the
 * Tailwind classes for the canvas pass.
 */
const WAVE_BANDS: { min: number; className: string; rgb: [number, number, number] }[] = [
  { min: 0.5, className: "fill-red-600/85", rgb: [220, 38, 38] },
  { min: 0.3, className: "fill-orange-500/85", rgb: [249, 115, 22] },
  { min: 0.15, className: "fill-amber-400/85", rgb: [251, 191, 36] },
  { min: 0.05, className: "fill-amber-200/85", rgb: [253, 230, 138] },
  { min: -0.05, className: "fill-slate-200/70", rgb: [226, 232, 240] },
  { min: -0.15, className: "fill-sky-200/85", rgb: [186, 230, 253] },
  { min: -0.3, className: "fill-sky-300/85", rgb: [125, 211, 252] },
  { min: -Infinity, className: "fill-sky-500/85", rgb: [14, 165, 233] },
];

export function cellFill(w: number): string {
  return WAVE_BANDS.find((band) => w >= band.min)?.className ?? "fill-sky-500/85";
}

export function cellRgb(w: number): [number, number, number] {
  return WAVE_BANDS.find((band) => w >= band.min)?.rgb ?? [14, 165, 233];
}

export const WAVE_LEGEND: { className: string; label: string }[] = [
  { className: "bg-sky-500/85", label: "≤−0.5" },
  { className: "bg-sky-300/85", label: "−0.3" },
  { className: "bg-sky-200/85", label: "−0.15" },
  { className: "bg-slate-200/70", label: "−0.05" },
  { className: "bg-amber-200/85", label: "0.05" },
  { className: "bg-amber-400/85", label: "0.15" },
  { className: "bg-orange-500/85", label: "0.3" },
  { className: "bg-red-600/85", label: "≥0.5" },
];

/** The swatch row shared by both views. */
export function WaveLegend({
  caption = "vertical velocity, m/s (HRRR) — warm is lift, blue is sink",
}: {
  caption?: string;
}) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="flex items-center gap-1" aria-hidden="true">
        {WAVE_LEGEND.map((entry) => (
          <span key={entry.label} className="flex w-9 flex-col items-center gap-0.5">
            <span className={`h-2.5 w-full rounded-sm ${entry.className}`} />
            <span className="text-[9px] tabular-nums text-slate-400">{entry.label}</span>
          </span>
        ))}
      </div>
      <p className="text-[11px] text-slate-400">{caption}</p>
    </div>
  );
}
