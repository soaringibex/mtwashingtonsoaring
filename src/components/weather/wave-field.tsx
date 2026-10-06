// Shared pieces of the wave-field views: the vertical-velocity handling and the colour
// ramp both the cross-section and the map read from.

/**
 * Open-Meteo serves HRRR's vertical velocity at pressure levels already in m/s
 * (verified against `hourly_units` — not omega), so this is a null guard, kept as the
 * one place the two views pass their values through.
 */
export function wMs(value: number | null | undefined): number | null {
  return typeof value === "number" ? value : null;
}

/**
 * The divergent ramp both wave-field views share. Thresholds sit in the range the
 * HRRR pressure-level field actually reaches over the Presidentials — peaks of a few
 * tenths of a m/s, not metres — so the banding keeps its contrast.
 */
export function cellFill(w: number): string {
  if (w >= 0.5) return "fill-red-600/85";
  if (w >= 0.3) return "fill-orange-500/85";
  if (w >= 0.15) return "fill-amber-400/85";
  if (w >= 0.05) return "fill-amber-200/85";
  if (w >= -0.05) return "fill-slate-200/70";
  if (w >= -0.15) return "fill-sky-200/85";
  if (w >= -0.3) return "fill-sky-300/85";
  return "fill-sky-500/85";
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
