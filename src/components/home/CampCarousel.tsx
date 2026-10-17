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
const IMAGE_SIZES = "(max-width: 480px) 760px, (max-width: 1023px) 972px, 900px";

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
  const next = slides[(index + 1) % slides.length];

  const show = (nextIndex: number) => {
    setAuto(false);
    setIndex((nextIndex + slides.length) % slides.length);
  };

  return (
    <section
      aria-roledescription="carousel"
      aria-label={label}
      className="mx-auto w-full max-w-md overflow-hidden rounded-3xl bg-slate-900 shadow-2xl ring-1 ring-white/20 lg:mx-0"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setAuto(false)}
    >
      <div className="relative aspect-[4/3]">
        <div className="absolute inset-0">
          <Image
            key={current.src}
            src={current.src}
            alt={current.alt}
            fill
            priority
            sizes={IMAGE_SIZES}
            quality={90}
            className="animate-fade-in object-cover motion-reduce:animate-none"
          />
        </div>

        {next && next.src !== current.src ? (
          <div className="pointer-events-none absolute inset-0 opacity-0" aria-hidden="true">
            <Image
              src={next.src}
              alt=""
              fill
              sizes={IMAGE_SIZES}
              quality={90}
              className="object-cover"
            />
          </div>
        ) : null}

        <Link
          href={albumHref}
          aria-label={albumLabel}
          className="absolute inset-0"
        />

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
      </div>

      <div className="px-4 pb-4 pt-3">
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 truncate text-xs text-sky-200/80">
            {current.credit ?? "Wave Camp 2026"}
          </p>
          <p className="shrink-0 text-[10px] tabular-nums text-sky-200/60">
            {index + 1} / {slides.length}
          </p>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/15">
          <div
            className="h-full rounded-full bg-sky-300 transition-[width] duration-500 ease-out"
            style={{ width: `${((index + 1) / slides.length) * 100}%` }}
          />
        </div>
      </div>
    </section>
  );
}
