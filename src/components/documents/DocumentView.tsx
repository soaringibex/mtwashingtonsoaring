import Image from "next/image";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Container } from "@/components/ui/Container";
import { Prose } from "@/components/ui/Prose";
import type { DocumentText } from "@/lib/document-texts";
import type { DocLink } from "@/lib/flying";

export function DocumentView({
  doc,
  text,
  backHref,
  backLabel,
}: {
  doc: DocLink;
  text: DocumentText;
  backHref: string;
  backLabel: string;
}) {
  const size = `${(text.bytes / 1e6).toFixed(1)} MB`;

  return (
    <article className="py-16 sm:py-20">
      <Container width="2xl">
        <Link
          href={backHref}
          className="text-sm font-medium text-sky-700 transition-colors hover:text-sky-600"
        >
          <span aria-hidden="true">←</span> {backLabel}
        </Link>

        <h1 className="mt-8 font-display text-3xl font-bold tracking-tight text-slate-900 text-balance sm:text-4xl">
          {doc.title}
        </h1>
        {doc.description ? (
          <p className="mt-4 text-[1.0625rem] leading-8 text-slate-600">{doc.description}</p>
        ) : null}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <ButtonLink href={doc.href} variant="secondary">
            Download the original PDF
          </ButtonLink>
          <span className="text-xs text-slate-400">
            Original: PDF · {text.pages} {text.pages === 1 ? "page" : "pages"} · {size}
          </span>
        </div>

        <Prose className="mt-10">
          {text.blocks.map((block, index) => {
            if (block.type === "img") {
              return (
                <figure key={index} className="mx-auto" style={{ maxWidth: `${block.width}px` }}>
                  <Image
                    src={block.src}
                    alt=""
                    width={block.width}
                    height={block.height}
                    className="w-full rounded-2xl ring-1 ring-slate-900/5"
                  />
                </figure>
              );
            }
            if (block.type === "table") {
              return (
                // Data tables break out of the prose measure (they need the room for all
                // their columns); below lg they stay in-column and scroll sideways.
                <div
                  key={index}
                  className="overflow-x-auto rounded-2xl ring-1 ring-slate-900/5 lg:-mx-28 xl:-mx-32"
                >
                  <table className="w-full border-collapse text-[0.8125rem] leading-5">
                    {block.caption ? (
                      <caption className="px-4 pb-1 pt-5 text-center font-display text-[0.9375rem] font-semibold tracking-tight text-slate-900">
                        {block.caption}
                      </caption>
                    ) : null}
                    <thead>
                      <tr className="bg-slate-50 text-slate-900">
                        {block.headers.map((header, column) => (
                          <th
                            key={header}
                            scope="col"
                            className={`px-2.5 py-3 align-bottom font-semibold ${column === 0 ? "text-left" : "text-right"}`}
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {block.rows.map((row) => (
                        <tr key={row[0]} className="border-t border-slate-100">
                          {row.map((cell, column) => (
                            <td
                              key={column}
                              className={`px-2.5 py-2.5 align-top ${column === 0 ? "whitespace-nowrap font-medium text-slate-900" : "text-right tabular-nums text-slate-700"}`}
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            }
            if (block.type === "h") {
              return <h2 key={index}>{block.text}</h2>;
            }
            if (block.type === "ul" || block.type === "ol") {
              const List = block.type === "ul" ? "ul" : "ol";
              const listClass = block.type === "ul" ? "list-disc pl-6 space-y-1.5" : "list-decimal pl-6 space-y-1.5";
              return (
                <List key={index} className={listClass}>
                  {block.items.map((item, itemIndex) => (
                    <li key={itemIndex}>{item}</li>
                  ))}
                </List>
              );
            }
            return <p key={index}>{block.text}</p>;
          })}
        </Prose>

        <div className="mt-12 rounded-3xl bg-slate-50 p-7 ring-1 ring-slate-900/5">
          <p className="text-sm leading-7 text-slate-600">
            This page is a web transcription of the original document — the PDF is the
            authoritative version, and the one to print and carry.
          </p>
          <div className="mt-5">
            <ButtonLink href={doc.href} variant="secondary">
              Download the original PDF ({size})
            </ButtonLink>
          </div>
        </div>
      </Container>
    </article>
  );
}
