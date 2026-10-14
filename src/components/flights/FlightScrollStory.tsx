"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ConnectWithWave3D } from "@/components/flights/ConnectWithWave3D";

/**
 * The story page's scrollytelling frame: a sticky 3D stage under the site header,
 * with the phase cards (children, each marked `data-phase`) scrolling over it. The
 * step crossing the viewport's focus line becomes the active phase, and the scene
 * flies to it and retraces that segment.
 *
 * The page holds at each card's resting line until that phase's track run has
 * finished — going back up is always free, and the hold lets go on its own: when
 * the scene reports the run, when the reader takes over the scrubber, or when the
 * safety timer expires. A phase already watched never holds again.
 */

// Mirrors the site header heights (h-16 / 4.5rem / 5rem), like /flights/3d does.
const STICKY = "sticky top-16 z-0 sm:top-[4.5rem] xl:top-20";
const HEIGHT = "h-[calc(100svh-4rem)] sm:h-[calc(100svh-4.5rem)] xl:h-[calc(100svh-5rem)]";
const OVERLAP = "-mt-[calc(100svh-4rem)] sm:-mt-[calc(100svh-4.5rem)] xl:-mt-[calc(100svh-5rem)]";
/** The hold gives up after this long, whatever the scene is doing — the longest
 * phase (the ridge) runs ~8.1 s at the constant rate, plus the camera flight. */
const HOLD_MAX_MS = 11000;

export function FlightScrollStory({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLElement | null>(null);
  const [active, setActive] = useState("whole");
  /** While set, the page cannot scroll past `y` — the active card's resting line. */
  const holdRef = useRef<{ phase: string; y: number } | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  const playedRef = useRef<Set<string>>(new Set());

  const releaseHold = useCallback((completedPhase?: string) => {
    if (completedPhase) playedRef.current.add(completedPhase);
    holdRef.current = null;
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  // The scene reports each phase's track run — or that the reader took the scrubber.
  const onPhasePlayed = useCallback(
    (id: string) => {
      releaseHold(id);
    },
    [releaseHold],
  );

  // Focus tracking and the hold — one pass of listeners.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const steps = Array.from(root.querySelectorAll<HTMLElement>("[data-phase]"));
    if (steps.length === 0) return;

    let raf = 0;
    const update = () => {
      raf = 0;
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
      const hold = holdRef.current;
      if (hold && window.scrollY > hold.y) {
        // A tick that slips in before the hold lands can overshoot the line (a wheel
        // event can commit before the hold effect runs, on some displays at subpixel
        // geometry). Absorb a small overshoot by moving the line down to the reader —
        // no visible bounce — and only clamp back for a genuine leap past the stop.
        if (window.scrollY - hold.y <= window.innerHeight * 0.25) {
          hold.y = window.scrollY;
        } else {
          window.scrollTo(0, hold.y);
        }
      }
      if (!raf) raf = requestAnimationFrame(update);
    };

    const onWheel = (e: WheelEvent) => {
      const hold = holdRef.current;
      if (!hold || e.deltaY <= 0) return;
      if (window.scrollY >= hold.y - 1) {
        // At the resting line: swallow the tick whole, so nothing nudges back and forth.
        e.preventDefault();
        return;
      }
      if (window.scrollY + e.deltaY > hold.y) {
        // The tick that would cross the line settles at it instead of fighting it.
        e.preventDefault();
        window.scrollTo(0, hold.y);
      }
    };

    let touchY = 0;
    const onTouchStart = (e: TouchEvent) => {
      touchY = e.touches[0]?.clientY ?? 0;
    };
    const onTouchMove = (e: TouchEvent) => {
      const hold = holdRef.current;
      if (!hold) return;
      const dy = (e.touches[0]?.clientY ?? 0) - touchY;
      if (dy < 0 && window.scrollY >= hold.y - 2) {
        e.preventDefault();
        window.scrollTo(0, hold.y);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const hold = holdRef.current;
      if (!hold) return;
      const forward =
        e.key === "ArrowDown" || e.key === "PageDown" || e.key === " " || e.key === "Spacebar";
      if (!forward) return;
      const step = e.key === "ArrowDown" ? 40 : window.innerHeight * 0.9;
      if (window.scrollY + step > hold.y) {
        e.preventDefault();
        window.scrollTo(0, hold.y);
      }
    };

    const onResize = () => {
      releaseHold();
      if (!raf) raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [releaseHold]);

  // A new phase takes focus: hold the page at its card until the track run finishes.
  useEffect(() => {
    if (active === "whole" || playedRef.current.has(active)) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = rootRef.current?.querySelector<HTMLElement>(`[data-phase="${active}"]`);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const restY = window.scrollY + rect.top + rect.height / 2 - window.innerHeight * 0.55;
    holdRef.current = { phase: active, y: Math.max(restY, window.scrollY) };
    if (holdTimerRef.current !== null) window.clearTimeout(holdTimerRef.current);
    holdTimerRef.current = window.setTimeout(() => releaseHold(), HOLD_MAX_MS);
  }, [active, releaseHold]);

  return (
    <section
      ref={rootRef}
      aria-label="The flight of October 12, 2026, told phase by phase as you scroll"
      className="relative bg-slate-950"
    >
      <div className={`${STICKY} ${HEIGHT}`}>
        <ConnectWithWave3D phase={active} scroll onPhasePlayed={onPhasePlayed} />
      </div>

      {/* The steps overlay the sticky stage's flow space; only the cards take pointers. */}
      <div className={`relative z-10 ${OVERLAP} pointer-events-none`}>
        <div className="flex h-[36svh] items-end justify-center pb-16">
          <p className="rounded-full bg-slate-950/60 px-4 py-1.5 text-xs text-slate-300 ring-1 ring-white/10 backdrop-blur-sm">
            Keep scrolling — the flight plays itself, phase by phase
          </p>
        </div>
        {children}
      </div>
    </section>
  );
}
