"use client";

import { useEffect, useState } from "react";
import { Container } from "@/components/ui/Container";

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "short",
  month: "short",
  day: "numeric",
});

const TIME_FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZoneName: "short",
});

const UTC_FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** The station header: identity, a live clock, and the page's one-line brief. */
export function DashboardHeader() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const update = () => setNow(new Date());
    // Deferred kick so the first paint isn't a synchronous state write in the effect.
    const kick = setTimeout(update, 0);
    const timer = setInterval(update, 15_000);
    return () => {
      clearTimeout(kick);
      clearInterval(timer);
    };
  }, []);

  return (
    <div className="border-b border-sky-400/20 bg-slate-950 text-white">
      <Container className="flex flex-wrap items-center gap-x-8 gap-y-3 py-5">
        <div className="flex items-center gap-3">
          <span
            className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-500/15 ring-1 ring-sky-400/30"
            aria-hidden="true"
          >
            <svg viewBox="0 0 24 24" className="size-5 text-sky-300">
              <path
                d="M3 16c2.5-4.8 5-4.8 7.5 0s5 4.8 7.5 0"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
              <path d="M13.5 7.2l5.5-2.2-1.8 4.8z" fill="currentColor" />
            </svg>
          </span>
          <div>
            <h1 className="font-display text-lg font-bold leading-tight tracking-tight">
              Wavecast
            </h1>
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-sky-300">
              Mt Washington · station dashboard
            </p>
          </div>
        </div>

        <p className="hidden max-w-md text-xs leading-5 text-slate-400 lg:block">
          Wave potential for the Presidential Range — the Scorer-parameter signal, the column of
          wind, the summit forecast, and the fields around the mountain.
        </p>

        <div className="ml-auto flex items-center gap-x-6">
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Local</p>
            <p className="font-display text-xs font-semibold tabular-nums text-slate-100">
              {now ? `${DATE_FORMAT.format(now)} · ${TIME_FORMAT.format(now)}` : "—"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">UTC</p>
            <p className="font-display text-xs font-semibold tabular-nums text-slate-100">
              {now ? `${UTC_FORMAT.format(now)}Z` : "—"}
            </p>
          </div>
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:animate-none" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
            </span>
            live
          </span>
        </div>
      </Container>
    </div>
  );
}
