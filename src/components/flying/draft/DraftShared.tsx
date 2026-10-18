import Link from "next/link";
import type { ReactNode } from "react";
import type { DocLink } from "@/lib/flying";

/** A missing section the association still has to write. */
export function Placeholder({ topic }: { topic: string }) {
  return (
    <div className="rounded-3xl border-2 border-dashed border-amber-300 bg-amber-50/80 px-5 py-5 sm:px-6">
      <p className="text-sm leading-7 text-amber-950">
        <span className="font-semibold">To be written: {topic}.</span> Needs input from camp
        organizers.
      </p>
    </div>
  );
}

/** A route or document link, rendered the way the rest of the site draws a card. */
export function DocAnchor({
  doc,
  className = "",
  children,
}: {
  doc: DocLink;
  className?: string;
  children: ReactNode;
}) {
  const href = doc.page ?? doc.href ?? "#";
  if (doc.page) {
    return (
      <Link href={doc.page} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <a
      href={href}
      {...(doc.external ? { target: "_blank", rel: "noreferrer" } : {})}
      className={className}
    >
      {children}
    </a>
  );
}

/** One row of the required-reading checklist. */
export function ChecklistItem({ doc, note }: { doc: DocLink; note: string }) {
  return (
    <li className="flex gap-4 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-900/5 sm:p-6">
      <span
        aria-hidden="true"
        className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-sky-600 text-white"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-3.5">
          <path d="m5 12 4 4L19 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <div className="min-w-0">
        <DocAnchor
          doc={doc}
          className="font-display text-base font-semibold text-slate-900 underline decoration-sky-300 decoration-2 underline-offset-4 transition-colors hover:text-sky-700"
        >
          {doc.title}
        </DocAnchor>
        <p className="mt-2 text-sm font-medium text-slate-700">{note}</p>
        {doc.description ? (
          <p className="mt-2 text-sm leading-7 text-slate-600">{doc.description}</p>
        ) : null}
      </div>
    </li>
  );
}

/** A page elsewhere on the site, as a short card. */
export function PageCard({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex h-full flex-col rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5 transition hover:shadow-md"
    >
      <span className="font-display text-base font-semibold text-slate-900 group-hover:text-sky-700">
        {title}
      </span>
      <span className="mt-3 flex-1 text-sm leading-7 text-slate-600">{description}</span>
      <span className="mt-4 text-sm font-medium text-sky-700">
        Open<span aria-hidden="true"> →</span>
      </span>
    </Link>
  );
}
