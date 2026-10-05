import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocumentView } from "@/components/documents/DocumentView";
import { documentTexts } from "@/lib/document-texts";
import { stories } from "@/lib/stories";

const prefix = "/stories/";

function storyForSlug(slug: string) {
  return stories.find((story) => story.page === `${prefix}${slug}`);
}

export function generateStaticParams() {
  return stories
    .filter((story) => story.page?.startsWith(prefix))
    .map((story) => ({ slug: story.page!.slice(prefix.length) }));
}

export async function generateMetadata(props: PageProps<"/stories/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const story = storyForSlug(slug);
  if (!story) return {};
  return { title: story.title, description: story.description };
}

export default async function StoryPage(props: PageProps<"/stories/[slug]">) {
  const { slug } = await props.params;
  const story = storyForSlug(slug);
  const text = documentTexts[slug];
  if (!story || !text) notFound();

  return <DocumentView doc={story} text={text} backHref="/stories" backLabel="Stories" />;
}
