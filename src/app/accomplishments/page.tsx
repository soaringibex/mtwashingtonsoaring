import type { Metadata } from "next";
import { PageHero } from "@/components/ui/PageHero";
import { Container } from "@/components/ui/Container";
import { awards } from "@/lib/accomplishments";

export const metadata: Metadata = {
  title: "Accomplishments",
  description:
    "Lennie Pins, diamond altitude climbs and gold altitude flights recorded in the Mount Washington wave, listed by year.",
};

export default function AccomplishmentsPage() {
  return (
    <>
      <PageHero
        eyebrow="The record book"
        title="Accomplishments"
        lede="Climbs above 25,000 feet, diamond altitude gains and gold climbs recorded in the Mount Washington wave. Several hundred diamonds were claimed in the original wave camp years alone — the best single day, in 1969, produced 44 of them."
        image="/images/scenic/summit-glider.webp"
        imageAlt="A glider high above the Mount Washington summit"
        priority
      />

      <section className="py-16 sm:py-20">
        <Container>
          <nav aria-label="Awards" className="flex flex-wrap gap-2">
            {awards.map((award) => (
              <a
                key={award.id}
                href={`#${award.id}`}
                className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-sky-50 hover:text-sky-700"
              >
                {award.title}
              </a>
            ))}
          </nav>

          <div className="mt-14 space-y-20">
            {awards.map((award) => (
              <section key={award.id} id={award.id} aria-labelledby={`${award.id}-title`}>
                <div className="max-w-3xl">
                  <h2
                    id={`${award.id}-title`}
                    className="font-display text-3xl font-bold tracking-tight text-slate-900"
                  >
                    {award.title}
                  </h2>
                  <p className="mt-2 font-display text-sm font-semibold uppercase tracking-[0.2em] text-sky-700">
                    {award.criterion}
                  </p>
                  <p className="mt-4 text-[1.0625rem] leading-8 text-slate-600">{award.blurb}</p>
                </div>

                <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {award.years.map((group) => (
                    <div
                      key={group.year}
                      className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5"
                    >
                      <p className="font-display text-xl font-bold tracking-tight text-sky-700">
                        {group.year}
                      </p>
                      <ul className="mt-4 space-y-2.5 text-sm leading-6 text-slate-700">
                        {group.entries.map((entry) => (
                          <li key={entry} className="flex gap-2.5">
                            <span
                              aria-hidden="true"
                              className="mt-2 size-1.5 shrink-0 rounded-full bg-sky-400"
                            />
                            <span>{entry}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </Container>
      </section>
    </>
  );
}
