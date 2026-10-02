import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Prose } from "@/components/ui/Prose";
import { posts } from "@/lib/news";
import { site } from "@/lib/site";

export function generateStaticParams() {
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata(props: PageProps<"/news/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const post = posts.find((candidate) => candidate.slug === slug);
  if (!post) return {};
  return { title: post.title, description: post.excerpt };
}

export default async function NewsPostPage(props: PageProps<"/news/[slug]">) {
  const { slug } = await props.params;
  const post = posts.find((candidate) => candidate.slug === slug);
  if (!post) notFound();

  return (
    <article className="py-16 sm:py-20">
      <Container className="max-w-3xl">
        <Link
          href="/news"
          className="text-sm font-medium text-sky-700 transition-colors hover:text-sky-600"
        >
          <span aria-hidden="true">←</span> All news
        </Link>

        <p className="mt-8 text-sm text-slate-500">
          {post.dateLabel} · posted by {post.author}
        </p>
        <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-slate-900 text-balance sm:text-4xl">
          {post.title}
        </h1>

        <Prose className="mt-8">
          {post.body.map((paragraph) => (
            <p key={paragraph.slice(0, 40)}>{paragraph}</p>
          ))}
        </Prose>

        <div className="mt-12 rounded-3xl bg-slate-50 p-7 ring-1 ring-slate-900/5">
          <h2 className="font-display text-lg font-semibold text-slate-900">
            Flying the camp
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            Before you fly the Mount Washington wave, read the briefing material — it is required
            reading for everyone attending, and it is the difference between a good day and a
            long one.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <ButtonLink href="/important-reading">Important reading</ButtonLink>
            <ButtonLink href={`mailto:${site.email}`} variant="secondary">
              Join the email list
            </ButtonLink>
          </div>
        </div>
      </Container>
    </article>
  );
}
