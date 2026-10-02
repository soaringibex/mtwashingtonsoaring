import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/ui/PageHero";
import { Container } from "@/components/ui/Container";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { DocCard } from "@/components/ui/DocCard";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { archiveDocs, docYears } from "@/lib/documents";

export const metadata: Metadata = {
  title: "Documents & files",
  description:
    "Season paperwork for the wave camp, the Mount Washington Brief, legal references and the camp archive — logbooks, stories and history.",
};

export default function DocumentsPage() {
  return (
    <>
      <PageHero
        eyebrow="Paperwork & archives"
        title="Documents & files"
        lede="Season paperwork, safety briefings, legal references and a growing archive of logbooks and stories from past wave camps."
        image="/images/scenic/canopy-tow.webp"
        imageAlt="The tow plane seen through a glider canopy"
        priority
      />

      <section className="py-16 sm:py-20">
        <Container>
          <SectionHeading
            eyebrow="By season"
            title="Camp documents by year"
            lede="Signups, letters of authorization and legal interpretations for each season."
          />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {docYears.map((year) => (
              <Link
                key={year.year}
                href={`/documents/${year.year}`}
                className="group flex h-full flex-col rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-900/5 transition hover:shadow-md"
              >
                <span className="font-display text-4xl font-bold tracking-tight text-sky-700">
                  {year.year}
                </span>
                <span className="mt-3 font-display text-base font-semibold text-slate-900 group-hover:text-sky-700">
                  {year.title}
                </span>
                <span className="mt-2 flex-1 text-sm leading-7 text-slate-600">
                  {year.blurb}
                </span>
                <span className="mt-5 text-sm font-medium text-sky-700">
                  {year.docs.length > 0
                    ? `${year.docs.length} document${year.docs.length === 1 ? "" : "s"}`
                    : "View page"}
                  <span aria-hidden="true"> →</span>
                </span>
              </Link>
            ))}
          </div>

          <div className="mt-20">
            <SectionHeading
              eyebrow="Reading & safety"
              title="Required briefing material"
              lede="The Mount Washington Brief, oxygen talk, airport procedures and airspace references live on the Important Reading page — start there before any season's flying."
            />
            <div className="mt-8">
              <ButtonLink href="/important-reading">Go to Important Reading</ButtonLink>
            </div>
          </div>

          <div className="mt-20">
            <SectionHeading
              eyebrow="Archive"
              title="Stories, logbooks & history"
              lede="First-hand accounts and records from the camps — from a 2015 bailout to recollections of the 1979–1984 seasons at North Conway."
            />
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {archiveDocs.map((doc) => (
                <DocCard key={doc.href} doc={doc} />
              ))}
            </div>
          </div>

          <div className="mt-20">
            <SectionHeading
              eyebrow="Navigation"
              title="Task & airspace files"
              lede="IGC, KMZ, waypoint and airspace downloads for the Gorham area are gathered on the Important Reading page under “Electronic files.”"
            />
            <div className="mt-8">
              <ButtonLink href="/important-reading#electronic-files" variant="secondary">
                Electronic files
              </ButtonLink>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
