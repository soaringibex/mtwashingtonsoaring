import { DocCard } from "@/components/ui/DocCard";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { legal, required } from "@/lib/flying";
import { PageCard, Placeholder } from "./DraftShared";

const legalDocs = [...legal, required[3]];

export function BetweenStage({ campDatesLabel }: { campDatesLabel: string }) {
  return (
    <div className="space-y-16 sm:space-y-20">
      <section>
        <SectionHeading title="Stay on the list" />
        <div className="mt-6 max-w-3xl space-y-4 text-[1.0625rem] leading-8 text-slate-700">
          <p>
            Camp news and signup run through the email list:{" "}
            <a
              href="mailto:mwsoaring@googlegroups.com"
              className="font-medium text-sky-700 underline underline-offset-4 hover:text-sky-600"
            >
              mwsoaring@googlegroups.com
            </a>
            .
          </p>
          <p>The next camp runs {campDatesLabel} at Gorham Municipal Airport (2G8).</p>
        </div>
      </section>

      <section>
        <SectionHeading title="Keep reading" />
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <PageCard
            href="/history"
            title="History"
            description="From Lewin Barringer's first wave flight in 1938 to today's annual camps — a century of flying the White Mountain wave."
          />
          <PageCard
            href="/stories"
            title="Stories"
            description="First-hand accounts from the wave — bailouts, first visits, recollections from the early camps, and the camp logbooks."
          />
          <PageCard
            href="/accomplishments"
            title="Accomplishments"
            description="The record book — Gold and Diamond altitude climbs, Lennie Pins and the New Hampshire altitude record."
          />
        </div>
        <div className="mt-6 max-w-3xl">
          <Placeholder topic="a reading list on wave flying" />
        </div>
      </section>

      <section>
        <details className="group rounded-3xl bg-white shadow-sm ring-1 ring-slate-900/5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 [&::-webkit-details-marker]:hidden">
            <span className="font-display text-xl font-bold tracking-tight text-slate-900">
              Legal background
            </span>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="size-5 shrink-0 text-slate-400 transition-transform group-open:rotate-180"
              aria-hidden="true"
            >
              <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </summary>
          <div className="border-t border-slate-100 px-6 py-6">
            <p className="max-w-3xl text-sm leading-7 text-slate-600">
              The FAA interpretations behind the airspace operations and the current LOA
              revalidation.
            </p>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {legalDocs.map((doc) => (
                <DocCard key={doc.href ?? doc.page ?? doc.title} doc={doc} />
              ))}
            </div>
          </div>
        </details>
      </section>

      <section>
        <SectionHeading title="The lost cross-country document" />
        <div className="mt-6 max-w-3xl space-y-4 text-[1.0625rem] leading-8 text-slate-700">
          <p>
            “Mt. Washington Area Wave Cross-Country Glider Flights” has not been recovered. If you
            have a copy, send it to{" "}
            <a
              href="mailto:mwsoaring@googlegroups.com"
              className="font-medium text-sky-700 underline underline-offset-4 hover:text-sky-600"
            >
              mwsoaring@googlegroups.com
            </a>
            .
          </p>
          <p>
            The routes it describes are covered in{" "}
            <a
              href="#during"
              className="font-medium text-sky-700 underline underline-offset-4 hover:text-sky-600"
            >
              During
            </a>
            .
          </p>
        </div>
      </section>

      <section>
        <SectionHeading title="Off-season prep" />
        <div className="mt-6 max-w-3xl">
          <Placeholder topic="off-season prep (oxygen system service, altitude chamber training, wave flying elsewhere)" />
        </div>
      </section>
    </div>
  );
}
