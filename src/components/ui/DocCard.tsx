import type { DocLink } from "@/lib/flying";

export function DocCard({ doc }: { doc: DocLink }) {
  const action = doc.external ? "Open link" : doc.href.endsWith(".pdf") ? "Download PDF" : "Download";

  return (
    <a
      href={doc.href}
      {...(doc.external ? { target: "_blank", rel: "noreferrer" } : {})}
      className="group flex h-full flex-col rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5 transition hover:shadow-md"
    >
      <span className="flex items-start justify-between gap-4">
        <span className="font-display text-base font-semibold text-slate-900 group-hover:text-sky-700">
          {doc.title}
        </span>
        {doc.meta ? (
          <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {doc.meta}
          </span>
        ) : null}
      </span>
      {doc.description ? (
        <span className="mt-3 flex-1 text-sm leading-7 text-slate-600">{doc.description}</span>
      ) : null}
      <span className="mt-4 text-sm font-medium text-sky-700">
        {action}
        <span aria-hidden="true"> →</span>
      </span>
    </a>
  );
}
