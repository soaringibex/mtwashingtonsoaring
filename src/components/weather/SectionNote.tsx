import type { ReactNode } from "react";

/**
 * The plain-language line under a dashboard section title: what the view shows and how
 * to read it, written for pilots new to wave flying. One or two sentences, no jargon —
 * the technical detail stays in each card's own fine print.
 */
export function SectionNote({ children }: { children: ReactNode }) {
  return <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">{children}</p>;
}
