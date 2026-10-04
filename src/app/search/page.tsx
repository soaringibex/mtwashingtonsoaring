import type { Metadata } from "next";
import { PageHero } from "@/components/ui/PageHero";
import { Container } from "@/components/ui/Container";
import { SearchForm } from "@/components/search/SearchForm";

export const metadata: Metadata = {
  title: "Search",
  description:
    "Search the Mount Washington Soaring Association site — documents, important reading, photos, press and the accomplishment record book.",
  robots: { index: false, follow: true },
};

export default function SearchPage() {
  return (
    <>
      <PageHero
        eyebrow="Looking for something"
        title="Search"
        lede="Across every page, document, photo album and press clipping — including the full accomplishment record book."
      />

      <section className="py-16 sm:py-20">
        <Container className="max-w-3xl">
          <SearchForm />
        </Container>
      </section>
    </>
  );
}
