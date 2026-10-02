"use client";

import { useSyncExternalStore } from "react";
import { nextWaveCamp } from "@/lib/site";

// A tiny external store for "now", so the countdown re-renders each second
// without calling setState from an effect.
let currentNow = Date.now();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function tick() {
  currentNow = Date.now();
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (timer === null) {
    timer = setInterval(tick, 1_000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

const getSnapshot = () => currentNow;
const getServerSnapshot = () => null;

const dateFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

export function Countdown() {
  const now = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (now === null) {
    return (
      <div className="rounded-3xl border border-white/15 bg-white/10 p-6 backdrop-blur-md sm:p-7">
        <p className="font-display text-xs font-semibold uppercase tracking-[0.28em] text-sky-300">
          Next wave camp
        </p>
        <p className="mt-4 text-sm text-slate-200">Loading countdown…</p>
      </div>
    );
  }

  const { start, end } = nextWaveCamp(new Date(now));
  const live = now >= start.getTime() && now <= end.getTime();
  const diff = Math.max(0, start.getTime() - now);
  const parts = {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor(diff / 3_600_000) % 24,
    minutes: Math.floor(diff / 60_000) % 60,
    seconds: Math.floor(diff / 1_000) % 60,
  };

  const cells: { value: number; label: string }[] = [
    { value: parts.days, label: "Days" },
    { value: parts.hours, label: "Hours" },
    { value: parts.minutes, label: "Minutes" },
    { value: parts.seconds, label: "Seconds" },
  ];

  return (
    <div className="rounded-3xl border border-white/15 bg-white/10 p-6 backdrop-blur-md sm:p-7">
      <p className="font-display text-xs font-semibold uppercase tracking-[0.28em] text-sky-300">
        Next wave camp
      </p>
      {live ? (
        <p className="mt-3 font-display text-2xl font-bold text-white">
          The camp is on — see you at Gorham.
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-4 gap-2 sm:gap-3">
          {cells.map((cell) => (
            <div
              key={cell.label}
              className="rounded-2xl bg-slate-950/40 px-2 py-3 text-center sm:px-3 sm:py-4"
            >
              <p className="font-display text-2xl font-bold tabular-nums text-white sm:text-3xl">
                {String(cell.value).padStart(2, "0")}
              </p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-200">
                {cell.label}
              </p>
            </div>
          ))}
        </div>
      )}
      <p className="mt-4 text-sm text-slate-200">
        {`Opens ${dateFormat.format(start)} · Gorham, NH`}
      </p>
    </div>
  );
}
