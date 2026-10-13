"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ConnectWithWave3D } from "@/components/flights/ConnectWithWave3D";

/**
 * The story page's scrollytelling frame: a sticky 3D stage under the site header,
 * with the phase cards (children, each marked `data-phase`) scrolling over it. The
 * step crossing the viewport's focus line becomes the active phase, and the scene
 * flies to it and retraces that segment.
 */

// Mirrors the site header heights (h-16 / 4.5rem / 5rem), like /flights/3d does.
const STICKY = "sticky top-16 z-0 sm:top-[4.5rem] xl:top-20";
const HEIGHT = "h-[calc(100svh-4rem)] sm:h-[calc(100svh-4.5rem)] xl:h-[calc(100svh-5rem)]";
const OVERLAP = "-mt-[calc(100svh-4rem)] sm:-mt-[calc(100svh-4.5rem)] xl:-mt-[calc(100svh-5rem)]";

export function FlightScrollStory({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLElement | null>(null);
  const [active, setActive] = useState("whole");

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const steps = Array.from(root.querySelectorAll<HTMLElement>("[data-phase]"));
    if (steps.length === 0) return;

    let raf = 0;
    const update = () => {
      raf = 0;
      // The focus line: the step crossing 55% of the viewport owns the scene.
      const line = window.innerHeight * 0.55;
      let next = "whole";
      for (const el of steps) {
        const rect = el.getBoundingClientRect();
        if (rect.top <= line && rect.bottom >= line) {
          next = el.dataset.phase ?? "whole";
          break;
        }
      }
      setActive((prev) => (prev === next ? prev : next));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section
      ref={rootRef}
      aria-label="The flight of October 12, 2026, told phase by phase as you scroll"
      className="relative border-y border-slate-900/10 bg-slate-950"
    >
      <div className={`${STICKY} ${HEIGHT}`}>
        <ConnectWithWave3D phase={active} scroll />
      </div>

      {/* The steps overlay the sticky stage's flow space; only the cards take pointers. */}
      <div className={`relative z-10 ${OVERLAP} pointer-events-none`}>
        <div className="flex h-[44svh] items-end justify-center pb-16">
          <p className="rounded-full bg-slate-950/60 px-4 py-1.5 text-xs text-slate-300 ring-1 ring-white/10 backdrop-blur-sm">
            Keep scrolling — the flight plays itself, phase by phase
          </p>
        </div>
        {children}
      </div>
    </section>
  );
}
