import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/ui/PageHero";
import { Container } from "@/components/ui/Container";
import { PhotoGrid } from "@/components/gallery/PhotoGrid";
import { albums } from "@/lib/gallery";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Photos",
  description:
    "Photos from the Mount Washington wave camps — 2024, 2023 and the archive — plus gliders, lenticular clouds and the summit seen from the air.",
};

export default function GalleryPage() {
  return (
    <>
      <PageHero
        eyebrow="From the field"
        title="Photos"
        lede="Gliders on the grid at Gorham, wave clouds over the valley, and the summit from the air. Photos come from members and friends of the association — come fly with us and add to the collection."
        image="/images/gallery/2024/oct-7.jpg"
        imageAlt="A white glider on the grass between yellow runway cones at Gorham"
        priority
      />

      <section className="py-16 sm:py-20">
        <Container>
          <p className="max-w-3xl rounded-3xl bg-amber-50 p-5 text-sm leading-7 text-amber-900 ring-1 ring-amber-200/60">
            We haven&apos;t been able to recover several pictures from the old website. If you have
            photos from previous years and would like to share them, please{" "}
            <Link href="/contact" className="font-semibold underline underline-offset-4">
              reach out to the webmaster
            </Link>{" "}
            or write to{" "}
            <a
              href={`mailto:${site.email}`}
              className="font-semibold underline underline-offset-4"
            >
              {site.email}
            </a>
            .
          </p>
          <div className="mt-12">
            <PhotoGrid albums={albums} />
          </div>
        </Container>
      </section>
    </>
  );
}
