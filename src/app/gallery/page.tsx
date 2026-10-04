import type { Metadata } from "next";
import { PageHero } from "@/components/ui/PageHero";
import { Container } from "@/components/ui/Container";
import { PhotoGrid } from "@/components/gallery/PhotoGrid";
import { albums } from "@/lib/gallery";

export const metadata: Metadata = {
  title: "Photos",
  description:
    "Photos from the Mount Washington wave camps — 2025, 2024, 2023 and the archive — plus gliders, lenticular clouds and the summit seen from the air.",
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
          <PhotoGrid albums={albums} />
        </Container>
      </section>
    </>
  );
}
