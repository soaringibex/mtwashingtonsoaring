import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/ui/PageHero";
import { Container } from "@/components/ui/Container";
import { DocCard } from "@/components/ui/DocCard";
import { docYears } from "@/lib/documents";

export function generateStaticParams() {
  return docYears.map((year) => ({ year: year.year }));
}

export async function generateMetadata(
  props: PageProps<"/documents/[year]">,
): Promise<Metadata> {
  const { year } = await props.params;
  const record = docYears.find((candidate) => candidate.year === year);
  if (!record) return {};
  return { title: record.title, description: record.blurb };
}

export default async function DocumentYearPage(props: PageProps<"/documents/[year]">) {
  const { year } = await props.params;
  const record = docYears.find((candidate) => candidate.year === year);
  if (!record) notFound();

  return (
    <>
      <PageHero eyebrow="Documents" title={record.title} lede={record.blurb} />

      <section className="py-16 sm:py-20">
        <Container className="max-w-5xl">
          <Link
            href="/documents"
            className="text-sm font-medium text-sky-700 transition-colors hover:text-sky-600"
          >
            <span aria-hidden="true">←</span> All documents
          </Link>

          {record.docs.length > 0 ? (
            <div className="mt-10 grid gap-4 md:grid-cols-2">
              {record.docs.map((doc) => (
                <DocCard key={doc.href} doc={doc} />
              ))}
            </div>
          ) : (
            <div className="mt-10 rounded-3xl bg-slate-50 p-8 text-slate-600 ring-1 ring-slate-900/5">
              <p className="font-display text-lg font-semibold text-slate-900">
                Nothing posted yet
              </p>
              <p className="mt-2 text-sm leading-7">
                Documents for the {record.year} season will be posted here as they become
                available. In the meantime, the{" "}
                <Link
                  href="/important-reading"
                  className="font-medium text-sky-700 underline underline-offset-4"
                >
                  Important Reading
                </Link>{" "}
                page has the briefing material that applies to every season.
              </p>
            </div>
          )}
        </Container>
      </section>
    </>
  );
}
