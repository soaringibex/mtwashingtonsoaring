"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export type CampCarouselPhoto = {
  src: string;
  alt: string;
  credit?: string;
};

const AUTOPLAY_MS = 6000;

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** The camp in pictures — a quiet crossfade beside the recap. */
export function CampCarousel({
  photos,
  label = "Camp photos",
  albumHref = "/gallery#album-2026",
  albumLabel = "Open the 2026 photo album",
}: {
  photos: CampCarouselPhoto[];
  label?: string;
  albumHref?: string;
  albumLabel?: string;
}) {
  const [slides, setSlides] = useState(photos);
  const [index, setIndex] = useState(0);
  const [auto, setAuto] = useState(true);
  const [paused, setPaused] = useState(false);
  const shuffled = useRef(false);

  // Shuffle once on the client, so every visit walks the whole album in a
  // different order without changing the statically rendered first paint.
  useEffect(() => {
    if (shuffled.current || photos.length < 2) return;
    shuffled.current = true;
    setSlides(shuffle(photos));
  }, [photos]);

  useEffect(() => {
    if (!auto || paused || slides.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % slides.length);
    }, AUTOPLAY_MS);

    return () => window.clearInterval(timer);
  }, [auto, paused, slides.length]);

  if (slides.length === 0) return null;

  const current = slides[index] ?? slides[0];

  const show = (next: number) => {
    setAuto(false);
    setIndex((next + slides.length) % slides.length);
  };

  return (
    <section
      aria-roledescription="carousel"
      aria-label={label}
      className="overflow-hidden rounded-3xl bg-slate-900 shadow-2xl ring-1 ring-white/20"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setAuto(false)}
    >
      <div className="relative aspect-[3/4]">
        {slides.map((photo, slide) => (
          <div
            key={photo.src}
            role="group"
            aria-roledescription="slide"
            aria-label={`${slide + 1} of ${slides.length}`}
            aria-hidden={slide !== index}
            className={`absolute inset-0 transition-opacity duration-700 ease-out ${
              slide === index ? "opacity-100" : "opacity-0"
            }`}
          >
            <Image
              src={photo.src}
              alt={photo.alt}
              fill
              priority={slide === 0}
              sizes="(max-width: 1023px) 100vw, 360px"
              className="object-cover"
            />
          </div>
        ))}

        <Link
          href={albumHref}
          aria-label={albumLabel}
          className="absolute inset-0"
        />

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/25 to-transparent" />

        <button
          type="button"
          onClick={() => show(index - 1)}
          aria-label="Previous photo"
          className="absolute left-3 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-slate-950/35 text-white ring-1 ring-white/25 backdrop-blur-sm transition hover:bg-slate-950/60"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4" aria-hidden="true">
            <path d="m14.5 5-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => show(index + 1)}
          aria-label="Next photo"
          className="absolute right-3 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-slate-950/35 text-white ring-1 ring-white/25 backdrop-blur-sm transition hover:bg-slate-950/60"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4" aria-hidden="true">
            <path d="m9.5 5 7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 p-5 pt-16">
          {current.credit ? (
            <p className="text-xs text-sky-200/75">{current.credit}</p>
          ) : null}

          <div className="mt-4 flex items-center gap-3">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/25">
              <div
                className="h-full rounded-full bg-white transition-[width] duration-500 ease-out"
                style={{ width: `${((index + 1) / slides.length) * 100}%` }}
              />
            </div>
            <p className="shrink-0 text-[10px] tabular-nums text-sky-200/60">
              {index + 1} / {slides.length}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
