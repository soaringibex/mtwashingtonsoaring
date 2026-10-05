import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocumentView } from "@/components/documents/DocumentView";
import { documentTexts } from "@/lib/document-texts";
import { flyingDocs } from "@/lib/flying";

const prefix = "/flying/";

function docForSlug(slug: string) {
  return flyingDocs.find((doc) => doc.page === `${prefix}${slug}`);
}

export function generateStaticParams() {
  return flyingDocs
    .filter((doc) => doc.page?.startsWith(prefix))
    .map((doc) => ({ slug: doc.page!.slice(prefix.length) }));
}

export async function generateMetadata(props: PageProps<"/flying/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const doc = docForSlug(slug);
  if (!doc) return {};
  return { title: doc.title, description: doc.description };
}

export default async function FlyingDocPage(props: PageProps<"/flying/[slug]">) {
  const { slug } = await props.params;
  const doc = docForSlug(slug);
  const text = documentTexts[slug];
  if (!doc || !text) notFound();

  return <DocumentView doc={doc} text={text} backHref="/flying" backLabel="Flying here" />;
}
