import { documentTexts } from "@/lib/document-texts";

export const LOGBOOK_SLUG = "2026-wave-camp-logbook-glen-kelley";
export const LOGBOOK_HREF = `/stories/${LOGBOOK_SLUG}`;

export type LogbookEntry = { heading: string; paragraphs: string[] };

/** The newest logbook entry — everything after its last dated heading. */
export function latestLogbookEntry(): LogbookEntry | null {
  const blocks = documentTexts[LOGBOOK_SLUG]?.blocks ?? [];
  let entry: LogbookEntry | null = null;
  for (const block of blocks) {
    if (block.type === "h") entry = { heading: block.text, paragraphs: [] };
    else if (block.type === "p" && entry) entry.paragraphs.push(block.text);
  }
  return entry && entry.paragraphs.length > 0 ? entry : null;
}
