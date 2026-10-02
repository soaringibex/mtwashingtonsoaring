import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/ui/PageHero";
import { Container } from "@/components/ui/Container";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { posts } from "@/lib/news";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "News",
  description:
    "Camp announcements and club news from the Mount Washington Soaring Association.",
};

export default function NewsPage() {
  return (
    <>
      <PageHero
        eyebrow="Updates"
        title="News"
        lede="Camp announcements and club news. Signup sheets and logistics also go out over the email list each season."
        image="/images/scenic/clouddeck.webp"
        imageAlt="A cloud deck seen from high altitude in the wave"
        priority
      />

      <section className="py-16 sm:py-20">
        <Container className="max-w-4xl">
          <div className="space-y-6">
            {posts.map((post) => (
              <article
                key={post.slug}
                className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-900/5 transition hover:shadow-md"
              >
                <Link href={`/news/${post.slug}`} className="group block">
                  <p className="text-sm text-slate-500">
                    {post.dateLabel} · {post.author}
                  </p>
                  <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-slate-900 group-hover:text-sky-700">
                    {post.title}
                  </h2>
                  <p className="mt-3 text-[1.0625rem] leading-8 text-slate-600">
                    {post.excerpt}
                  </p>
                  <p className="mt-5 text-sm font-semibold text-sky-700">
                    Read the post<span aria-hidden="true"> →</span>
                  </p>
                </Link>
              </article>
            ))}
          </div>

          <div className="mt-10 rounded-3xl bg-gradient-to-br from-sky-600 to-sky-900 p-8 text-white">
            <h2 className="font-display text-xl font-bold tracking-tight">
              Don&apos;t miss the next camp
            </h2>
            <p className="mt-3 text-[1.0625rem] leading-8 text-sky-100">
              The signup sheet, schedule and logistics go out by email a few weeks before each
              October encampment.
            </p>
            <div className="mt-6">
              <ButtonLink href={`mailto:${site.email}`} variant="light">
                {site.email}
              </ButtonLink>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
