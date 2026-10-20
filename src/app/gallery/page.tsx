import type { Metadata } from "next";
import { PageHero } from "@/components/ui/PageHero";
import { Container } from "@/components/ui/Container";
import { PhotoGrid } from "@/components/gallery/PhotoGrid";
import { albums } from "@/lib/gallery";

export const metadata: Metadata = {
  title: "Photos",
  description:
    "Photos from the Mount Washington wave camps — 2014 to 2026, plus slides recovered from the 2008–2010 camps and the archive — gliders, lenticular clouds and the summit seen from the air.",
};

export default function GalleryPage() {
  return (
    <>
      <PageHero
        eyebrow="Wave Camp"
        title="Photos"
        lede="Gliders on the grid at Gorham, wave clouds over the valley, and the summit from the air. Photos come from members and friends of the association."
        image="/images/gallery/2024/oct-7.jpg"
        imageAlt="A white glider on the grass between yellow runway cones at Gorham"
        priority
      />

      <section className="py-16 sm:py-20">
        <Container>
          <nav
            aria-label="Jump to an album year"
            className="mb-12 flex flex-wrap items-center gap-x-0.5 gap-y-1 border-b border-slate-900/5 pb-5 sm:gap-x-1 sm:gap-y-2"
          >
            <span className="mr-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              Jump to
            </span>
            {albums.map((album) => {
              const label = album.id === "archive" ? "Archive" : album.id;
              return (
                <a
                  key={album.id}
                  href={`#album-${album.id}`}
                  className="rounded-full px-2 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-sky-50 hover:text-sky-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 sm:px-3"
                >
                  {label}
                </a>
              );
            })}
          </nav>
          <PhotoGrid albums={albums} />
        </Container>
      </section>
    </>
  );
}
