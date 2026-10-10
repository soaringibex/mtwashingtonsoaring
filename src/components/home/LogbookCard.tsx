import Link from "next/link";
import { documentTexts } from "@/lib/document-texts";

const LOGBOOK_SLUG = "2026-wave-camp-logbook-glen-kelley";
const LOGBOOK_HREF = `/stories/${LOGBOOK_SLUG}`;

type Entry = { heading: string; paragraphs: string[] };

/** The newest logbook entry — everything after its last dated heading. */
function latestEntry(): Entry | null {
  const blocks = documentTexts[LOGBOOK_SLUG]?.blocks ?? [];
  let entry: Entry | null = null;
  for (const block of blocks) {
    if (block.type === "h") entry = { heading: block.text, paragraphs: [] };
    else if (block.type === "p" && entry) entry.paragraphs.push(block.text);
  }
  return entry && entry.paragraphs.length > 0 ? entry : null;
}

/** The camp's latest dispatch, sitting where the countdown used to be. */
export function LogbookCard() {
  const entry = latestEntry();
  if (!entry) return null;

  return (
    <Link
      href={LOGBOOK_HREF}
      className="group block rounded-3xl border border-white/15 bg-white/10 p-6 backdrop-blur-md transition-colors hover:bg-white/15 sm:p-7"
    >
      <p className="font-display text-xs font-semibold uppercase tracking-[0.28em] text-sky-300">
        2026 camp logbook
      </p>
      <p className="mt-3 font-display text-lg font-semibold text-white">{entry.heading}</p>
      <div className="mt-3 space-y-3">
        {entry.paragraphs.map((paragraph, index) => (
          <p key={index} className="text-sm leading-6 text-slate-200">
            {paragraph}
          </p>
        ))}
      </div>
      <p className="mt-4 text-sm font-medium text-sky-200 group-hover:text-white">
        Read the full logbook <span aria-hidden="true">→</span>
      </p>
    </Link>
  );
}
