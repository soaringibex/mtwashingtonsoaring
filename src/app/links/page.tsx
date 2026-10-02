import type { Metadata } from "next";
import { PageHero } from "@/components/ui/PageHero";
import { Container } from "@/components/ui/Container";
import { linkGroups } from "@/lib/links";

export const metadata: Metadata = {
  title: "Links & references",
  description:
    "Weather links for planning a wave day, the clubs that make the camp happen, member videos and background reading about mountain waves.",
};

export default function LinksPage() {
  return (
    <>
      <PageHero
        eyebrow="References"
        title="Links & references"
        lede="Planning your wave day in the Mount Washington area? Start with the weather links — then the clubs, videos and background reading that go with the wave."
        image="/images/scenic/wingtip-ridges.webp"
        imageAlt="A glider wingtip over ridges stretching into the distance"
        priority
      />

      <section className="py-16 sm:py-20">
        <Container>
          <nav aria-label="Sections" className="flex flex-wrap gap-2">
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

          <div className="mt-14 space-y-20">
            {linkGroups.map((group) => (
              <section key={group.id} id={group.id} aria-labelledby={`${group.id}-title`}>
                <div className="max-w-3xl">
                  <h2
                    id={`${group.id}-title`}
                    className="font-display text-3xl font-bold tracking-tight text-slate-900"
                  >
                    {group.title}
                  </h2>
                  {group.blurb ? (
                    <p className="mt-4 text-[1.0625rem] leading-8 text-slate-600">
                      {group.blurb}
                    </p>
                  ) : null}
                </div>

                <div
                  className={
                    group.id === "clubs"
                      ? "mt-8 grid gap-4 sm:grid-cols-2"
                      : "mt-8 grid gap-3"
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
        </Container>
      </section>
    </>
  );
}
