import type { Metadata } from "next";
import { PageHero } from "@/components/ui/PageHero";
import { Container } from "@/components/ui/Container";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { DocCard } from "@/components/ui/DocCard";
import { storyGroups } from "@/lib/stories";

export const metadata: Metadata = {
  title: "Stories",
  description:
    "First-hand accounts from the Mount Washington wave — bailouts, first visits, recollections from the early camps at North Conway, and the camp logbooks.",
};

export default function StoriesPage() {
  return (
    <>
      <PageHero
        eyebrow="From the camps"
        title="Stories"
        lede="First-hand accounts from the wave — a bailout over the Presidentials, a greenhorn's first camp, recollections from the early years, and the camp logbooks."
        image="/images/scenic/clouddeck.webp"
        imageAlt="A cloud deck seen from high altitude in the wave"
        priority
      />

      <section className="py-16 sm:py-20">
        <Container className="max-w-4xl">
          <div className="space-y-16">
            {storyGroups.map((group) => (
              <section key={group.id} id={group.id}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900">
                    {group.title}
                  </h2>
                  {group.blurb ? (
                    <p className="text-sm italic text-slate-500">{group.blurb}</p>
                  ) : null}
                </div>
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  {group.stories.map((story) => (
                    <DocCard key={story.href} doc={story} />
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div className="mt-20 rounded-3xl bg-slate-50 p-7 ring-1 ring-slate-900/5">
            <h2 className="font-display text-lg font-semibold text-slate-900">More to read</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              For the full sweep — from Lewin Barringer in 1938 to today&apos;s Gorham camps — see
              the history page, and for pieces published about the wave camps, the press page.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <ButtonLink href="/history">The full history</ButtonLink>
              <ButtonLink href="/press" variant="secondary">
                Press
              </ButtonLink>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
