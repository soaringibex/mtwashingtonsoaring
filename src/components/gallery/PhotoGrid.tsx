"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Album } from "@/lib/gallery";

type FlatPhoto = {
  src: string;
  alt: string;
  album: string;
  albumId: string;
  credit?: string;
};

/** The album's contributors, alphabetical by surname. */
function contributors(album: Album): string[] {
  const names: string[] = [];
  for (const photo of album.photos) {
    if (photo.credit && !names.includes(photo.credit)) names.push(photo.credit);
  }
  return names.sort((a, b) => surname(a).localeCompare(surname(b), "en", { sensitivity: "base" }));
}

function surname(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1] ?? name;
}

export function PhotoGrid({ albums }: { albums: Album[] }) {
  const [active, setActive] = useState<number | null>(null);
  const [highlight, setHighlight] = useState<{ albumId: string; credit: string } | null>(null);

  const flat = useMemo<FlatPhoto[]>(
    () =>
      albums.flatMap((album) =>
        album.photos.map((photo) => ({
          src: photo.src,
          alt: photo.alt,
          album: album.title,
          albumId: album.id,
          credit: photo.credit,
        })),
      ),
    [albums],
  );

  const close = useCallback(() => setActive(null), []);
  const step = useCallback(
    (delta: number) => {
      setActive((current) =>
        current === null ? current : (current + delta + flat.length) % flat.length,
      );
    },
    [flat.length],
  );

  useEffect(() => {
    if (active === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "ArrowRight") step(1);
      if (event.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [active, close, step]);

  const current = active === null ? null : flat[active];

  return (
    <>
      <div className="space-y-14">
        {albums.map((album) => {
          const offset = flat.findIndex((photo) => photo.albumId === album.id);
          const credits = contributors(album);
          const selected = highlight?.albumId === album.id ? highlight.credit : null;
          return (
            <section key={album.id} id={`album-${album.id}`} aria-labelledby={`album-${album.id}-title`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3
                  id={`album-${album.id}-title`}
                  className="font-display text-2xl font-bold tracking-tight text-slate-900"
                >
                  {album.title}
                </h3>
                <p className="text-sm italic text-slate-500">{album.blurb}</p>
              </div>
              {credits.length > 0 ? (
                <p className="mt-2 flex flex-wrap items-center gap-x-1 gap-y-1 text-sm text-slate-500">
                  <span className="text-slate-400">Contributors:</span>
                  {credits.map((name, index) => (
                    <span key={name} className="inline-flex items-center gap-x-1">
                      {index > 0 ? (
                        <span aria-hidden="true" className="text-slate-400">
                          ·
                        </span>
                      ) : null}
                      <button
                        type="button"
                        aria-pressed={selected === name}
                        title={
                          selected === name
                            ? "Show every photo again"
                            : `Highlight photos by ${name}`
                        }
                        onClick={() =>
                          setHighlight((current) =>
                            current && current.albumId === album.id && current.credit === name
                              ? null
                              : { albumId: album.id, credit: name },
                          )
                        }
                        className={`transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 ${
                          selected === name
                            ? "font-semibold text-sky-700"
                            : "hover:text-sky-700 hover:underline underline-offset-4"
                        }`}
                      >
                        {name}
                      </button>
                    </span>
                  ))}
                </p>
              ) : null}
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {album.photos.map((photo, index) => (
                  <button
                    key={photo.src}
                    type="button"
                    onClick={() => setActive(offset + index)}
                    className="group relative aspect-[4/3] overflow-hidden rounded-2xl bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
                    aria-label={`View larger: ${photo.alt}`}
                  >
                    <Image
                      src={photo.src}
                      alt={photo.alt}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      className={`object-cover transition duration-500 ease-out group-hover:scale-[1.04] ${
                        selected && photo.credit !== selected ? "opacity-25" : ""
                      }`}
                    />
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {current ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/95 p-4 sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label={current.alt}
          onClick={close}
        >
          <div
            className="relative w-full max-w-6xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative h-[70vh] w-full">
              <Image
                src={current.src}
                alt={current.alt}
                fill
                sizes="(max-width: 1152px) 100vw, 1152px"
                className="object-contain"
              />
            </div>
            {current.credit ? (
              <p className="mt-4 text-center text-sm text-slate-300">
                Photo: {current.credit}
              </p>
            ) : null}

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                close();
              }}
              aria-label="Close"
              className="absolute -top-2 right-0 grid size-10 place-items-center rounded-full bg-white/10 text-white ring-1 ring-white/20 transition-colors hover:bg-white/20 sm:-top-4"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              </svg>
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                step(-1);
              }}
              aria-label="Previous photo"
              className="absolute left-0 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white ring-1 ring-white/20 transition-colors hover:bg-white/20 sm:-left-14"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5" aria-hidden="true">
                <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                step(1);
              }}
              aria-label="Next photo"
              className="absolute right-0 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white ring-1 ring-white/20 transition-colors hover:bg-white/20 sm:-right-14"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5" aria-hidden="true">
                <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
