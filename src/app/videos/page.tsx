import type { Metadata } from "next";
import { PageHero } from "@/components/ui/PageHero";
import { Container } from "@/components/ui/Container";
import { videos } from "@/lib/videos";

export const metadata: Metadata = {
  title: "Videos",
  description:
    "Member videos from the Mount Washington wave camps — climbs in the wave over the Presidential Range, the view from the cockpit, the field at Gorham, and a 2026 timelapse of the sky closing over the ridge.",
};

export default function VideosPage() {
  return (
    <>
      <PageHero
        eyebrow="From the camps"
        title="Videos"
        lede="Camp films from members and friends — the wave over the Presidentials, the view from the cockpit, the field at Gorham on a launch morning, and the 2026 sky closing over the ridge. Press play, or open the YouTube films for the full screen."
        image="/images/scenic/summit-glider.webp"
        imageAlt="A glider climbing over the snow-covered summit of Mount Washington"
        priority
      />

      <section className="py-16 sm:py-20">
        <Container>
          <div className="grid gap-6 md:grid-cols-2">
            {videos.map((video) => (
              <article
                key={video.id ?? video.src}
                className="flex h-full flex-col overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-900/5"
              >
                <div className="aspect-video w-full shrink-0 bg-slate-950">
                  {video.id ? (
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${video.id}`}
                      title={video.title}
                      loading="lazy"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      referrerPolicy="strict-origin-when-cross-origin"
                      allowFullScreen
                      className="h-full w-full"
                    />
                  ) : (
                    <video
                      controls
                      preload="metadata"
                      playsInline
                      poster={video.poster}
                      className="h-full w-full"
                    >
                      <source src={video.src} type="video/mp4" />
                    </video>
                  )}
                </div>

                <div className="flex flex-1 flex-col p-6">
                  <p className="font-display text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">
                    {[video.year, video.credit].filter(Boolean).join(" · ")}
                  </p>
                  <h2 className="mt-2 font-display text-lg font-semibold text-slate-900">
                    {video.title}
                  </h2>
                  {video.description ? (
                    <p className="mt-2 flex-1 text-sm leading-7 text-slate-600">
                      {video.description}
                    </p>
                  ) : null}
                  {video.id ? (
                    <a
                      href={`https://www.youtube.com/watch?v=${video.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-block text-sm font-medium text-sky-700 transition-colors hover:text-sky-600"
                    >
                      Watch on YouTube <span aria-hidden="true">↗</span>
                    </a>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </Container>
      </section>
    </>
  );
}
