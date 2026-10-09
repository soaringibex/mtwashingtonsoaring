/** A gold medal, for an SSA Gold badge or Gold Altitude leg. */
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

/** A diamond, for an SSA Diamond badge or Diamond Altitude leg. */
export function DiamondIcon({ label }: { label: string }) {
  return (
    <svg viewBox="0 0 24 24" className="size-4" role="img" aria-label={label}>
      <title>{label}</title>
      <path
        d="M7 4h10l4 4.5L12 20.5 3 8.5z"
        fill="#bae6fd"
        stroke="#075985"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M7 4l5 4.5L17 4M3 8.5h18M12 20.5V8.5"
        fill="none"
        stroke="#075985"
        strokeWidth="1.1"
        strokeLinejoin="round"
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

/** The marks a flight can carry, in display order: record, SSA badges. */
export function FlightMarks({
  record,
  ssa,
}: {
  record: boolean;
  ssa: string[];
}) {
  const gold = ssa.filter((badge) => badge.includes("Gold"));
  const diamond = ssa.filter((badge) => badge.includes("Diamond"));
  const note = "earned on this flight — verified in the SSA badge database";
  return (
    <span className="inline-flex items-center gap-2">
      {record ? (
        <RecordIcon label="New Hampshire state record — Open class absolute altitude and gain" />
      ) : null}
      {gold.length ? <BadgeIcon label={`${gold.join(" · ")} — ${note}`} /> : null}
      {diamond.length ? <DiamondIcon label={`${diamond.join(" · ")} — ${note}`} /> : null}
    </span>
  );
}
