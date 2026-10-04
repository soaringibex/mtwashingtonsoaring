"use client";

import { useEffect, useState } from "react";
import type { ClimbTier } from "@/lib/accomplishments";

const ftFormat = new Intl.NumberFormat("en-US");

type Readout = {
  ft: number;
  position: number;
  active: number;
};

/**
 * A sticky instrument panel that reads the "current altitude" as the page is
 * scrolled. Altitude is interpolated between the tier anchor sections, so the
 * readout climbs smoothly from the field at Gorham to the top of the record book.
 */
export function AltitudeRail({ tiers }: { tiers: ClimbTier[] }) {
  const [readout, setReadout] = useState<Readout>({ ft: tiers[0].ft, position: 0, active: 0 });

  useEffect(() => {
    let raf = 0;

    const update = () => {
      raf = 0;
      const vh = window.innerHeight;
      const y = window.scrollY;
      // Probe slightly above the viewport centre — where a reader's eye is.
      const probe = y + vh * 0.45;
      const bounds = tiers.map((tier) => {
        const el = document.getElementById(tier.id);
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        const top = rect.top + y;
        return { top, bottom: top + rect.height };
      });

      const last = tiers.length - 1;
      let position = last;
      let ft = tiers[last].ft;

      if (bounds.every((b) => b !== null)) {
        const sections = bounds as { top: number; bottom: number }[];
        if (probe <= sections[0].top) {
          position = 0;
          ft = tiers[0].ft;
        } else {
          let settled = false;
          for (let i = 0; i < last && !settled; i += 1) {
            if (probe < sections[i + 1].top) {
              if (probe <= sections[i].bottom) {
                // Reading station i — hold its altitude.
                position = i;
                ft = tiers[i].ft;
              } else {
                // Between stations — climbing toward the next one.
                const span = Math.max(1, sections[i + 1].top - sections[i].bottom);
                const t = Math.min(1, (probe - sections[i].bottom) / span);
                position = i + t;
                ft = tiers[i].ft + (tiers[i + 1].ft - tiers[i].ft) * t;
              }
              settled = true;
            }
          }
        }
      }

      setReadout({
        ft: Math.round(ft),
        position,
        active: Math.round(position),
      });
    };

    const schedule = () => {
      if (raf === 0) raf = requestAnimationFrame(update);
    };

    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (raf !== 0) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [tiers]);

  const activeTier = tiers[readout.active] ?? tiers[0];
  const markerTop = (readout.position / (tiers.length - 1)) * 100;

  return (
    <div className="sticky top-[45%] -translate-y-1/2" aria-hidden="true">
      <div className="flex w-20 flex-col items-center rounded-3xl border border-slate-900/10 bg-white/85 px-2 py-4 shadow-xl shadow-sky-950/10 backdrop-blur-md">
        <p className="font-display text-[9px] font-semibold uppercase tracking-[0.25em] text-slate-500">
          Climb
        </p>

        <div className="relative my-5 h-64 w-12">
          <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-gradient-to-b from-slate-300 via-sky-500/60 to-slate-300/50" />

          {tiers.map((tier, index) => (
            <span
              key={tier.id}
              className={`absolute left-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full ${
                index <= readout.active ? "bg-sky-600" : "bg-slate-300"
              }`}
              style={{ top: `${(index / (tiers.length - 1)) * 100}%` }}
            />
          ))}

          <span
            className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ top: `${markerTop}%` }}
          >
            <span className="block size-3 rounded-full border-2 border-white bg-sky-600 shadow-md shadow-sky-950/30" />
          </span>
        </div>

        <p className="font-display text-lg font-bold tabular-nums leading-none text-slate-900">
          {ftFormat.format(readout.ft)}
        </p>
        <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500">
          feet
        </p>

        <div className="mt-3 h-px w-10 bg-slate-200" />

        <p className="mt-3 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-700">
          {activeTier.label}
        </p>
      </div>
    </div>
  );
}
