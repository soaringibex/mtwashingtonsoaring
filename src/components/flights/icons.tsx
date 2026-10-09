/** The wave tag — shown first in a flight's marks. */
export function WavePill() {
  return (
    <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700 ring-1 ring-sky-100">
      wave
    </span>
  );
}

/** A gold medal, for a flight that collected a badge. */
export function BadgeIcon({ label }: { label: string }) {
  return (
    <svg viewBox="0 0 24 24" className="size-4" role="img" aria-label={label}>
      <title>{label}</title>
      <path
        d="M8.5 2.5l3.5 6 3.5-6"
        fill="none"
        stroke="#d97706"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="14.5" r="6" fill="#fbbf24" stroke="#b45309" strokeWidth="1.6" />
      <path
        d="M12 11.6l1.05 2.1 2.3.33-1.66 1.62.39 2.29L12 16.86l-2.08 1.08.39-2.29-1.66-1.62 2.3-.33z"
        fill="#b45309"
      />
    </svg>
  );
}

/** A trophy, for a state record. */
export function RecordIcon({ label }: { label: string }) {
  return (
    <svg viewBox="0 0 24 24" className="size-4 text-amber-600" role="img" aria-label={label}>
      <title>{label}</title>
      <path
        d="M7 4h10v3.5a5 5 0 01-10 0z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M7 5.5H4.5v1A3.5 3.5 0 008 10m9-4.5h2.5v1a3.5 3.5 0 01-3.5 3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path d="M12 12.5v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8.5 20h7l-.8-3.5h-5.4z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

/** The marks a flight can carry, in display order: wave tag first, then record/badge. */
export function FlightMarks({
  wave,
  record,
  badges,
}: {
  wave: boolean;
  record: boolean;
  badges: string[];
}) {
  return (
    <span className="inline-flex items-center gap-2">
      {wave ? <WavePill /> : null}
      {record ? (
        <RecordIcon label="New Hampshire state record — Open class absolute altitude and gain" />
      ) : null}
      {badges.length ? <BadgeIcon label={`Badges: ${badges.join(" · ")}`} /> : null}
    </span>
  );
}
