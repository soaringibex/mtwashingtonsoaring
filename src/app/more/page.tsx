import type { Metadata } from "next";
import { PageHero } from "@/components/ui/PageHero";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { linkGroups } from "@/lib/links";
import { press } from "@/lib/press";

export const metadata: Metadata = {
  title: "More",
  description:
    "Press and links — pieces published about the Mount Washington wave camps, plus the founding clubs, weather, videos and background reading.",
};

export default function MorePage() {
  return (
    <>
      <PageHero
        eyebrow="Press & links"
        title="More"
        lede="Pieces that have been published about the camps, and the links worth having — the founding clubs, weather for a wave day, videos and background reading."
        image="/images/scenic/wingtip-ridges.webp"
        imageAlt="A glider wingtip over ridges stretching into the distance"
        priority
      />

      <section className="py-16 sm:py-20">
        <Container>
          <div className="space-y-24">
            <section id="press">
              <SectionHeading
                eyebrow="In print"
                title="Press"
                lede="Pieces that have been published about the camps, gathered here for reference."
              />
              <p className="mt-8 max-w-3xl rounded-3xl bg-slate-50 p-6 text-sm leading-7 text-slate-600 ring-1 ring-slate-900/5">
                All articles that appear here are republished with permission from the original
                publisher. All rights other than appearing on this website are reserved by the
                original publisher. If you wish to contact us about information you would like to
                publish, please reach out through the{" "}
                <a href="/contact" className="font-medium text-sky-700 underline underline-offset-4">
                  contact page
                </a>
                .
              </p>
              <div className="mt-10 space-y-4">
                {press.map((item) => (
                  <article
                    key={`${item.date}-${item.title}`}
                    className="flex flex-col gap-3 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
                  >
                    <div className="min-w-0">
                      <p className="font-display text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">
                        {item.source} · {item.date}
                      </p>
                      <h3 className="mt-2 font-display text-lg font-semibold text-slate-900">
                        {item.title}
                      </h3>
                      {item.description ? (
                        <p className="mt-2 text-sm leading-6 text-slate-500">{item.description}</p>
                      ) : null}
                    </div>

                    {item.unavailable ? (
                      <span className="shrink-0 self-start rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:self-center">
                        Not archived
                      </span>
                    ) : (
                      <a
                        href={item.href}
                        className="shrink-0 self-start rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-500 sm:self-center"
                        {...(item.external ? { target: "_blank", rel: "noreferrer" } : {})}
                      >
                        {item.external ? "Read it" : "Download PDF"}
                      </a>
                    )}
                  </article>
                ))}
              </div>
            </section>

            <section id="links">
              <SectionHeading
                eyebrow="Elsewhere"
                title="Links"
                lede="Planning your wave day in the Mount Washington area? Start with the weather links — then the clubs, videos and background reading that go with the wave."
              />

              <nav aria-label="Link sections" className="mt-8 flex flex-wrap gap-2">
                {linkGroups.map((group) => (
                  <a
                    key={group.id}
                    href={`#${group.id}`}
                    className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-sky-50 hover:text-sky-700"
                  >
                    {group.title}
                  </a>
                ))}
              </nav>

              <div className="mt-14 space-y-16">
                {linkGroups.map((group) => (
                  <section key={group.id} id={group.id} aria-labelledby={`${group.id}-title`}>
                    <div className="max-w-3xl">
                      <h3
                        id={`${group.id}-title`}
                        className="font-display text-2xl font-bold tracking-tight text-slate-900"
                      >
                        {group.title}
                      </h3>
                      {group.blurb ? (
                        <p className="mt-4 text-[1.0625rem] leading-8 text-slate-600">
                          {group.blurb}
                        </p>
                      ) : null}
                    </div>

                    <div
                      className={
                        group.id === "clubs" ? "mt-8 grid gap-4 sm:grid-cols-2" : "mt-8 grid gap-3"
                      }
                    >
                      {group.links.map((link) => (
                        <a
                          key={link.href}
                          href={link.href}
                          target="_blank"
                          rel="noreferrer"
                          className="group flex h-full flex-col rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5 transition hover:shadow-md"
                        >
                          <span className="flex items-baseline justify-between gap-4">
                            <span className="font-display text-base font-semibold text-slate-900 group-hover:text-sky-700">
                              {link.title}
                            </span>
                            <span
                              aria-hidden="true"
                              className="text-slate-400 transition-colors group-hover:text-sky-600"
                            >
                              ↗
                            </span>
                          </span>
                          {link.description ? (
                            <span className="mt-2 text-sm leading-7 text-slate-600">
                              {link.description}
                            </span>
                          ) : null}
                        </a>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </section>
          </div>
        </Container>
      </section>
    </>
  );
}
