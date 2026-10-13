"use client";

import { useEffect, useRef, useState } from "react";
import { SectionNote } from "@/components/weather/SectionNote";

/**
 * The daily polar passes — MODIS true colour at 250 m, one or two sharp looks a day
 * instead of the GOES loop. The API route resolves "latest" (today or yesterday) and
 * reports which satellite and day it served; from there the controls step through the
 * week. The image is fetched rather than hot-linked so the panel can read those headers,
 * and it renders as a plain <img> (see eslint.config.mjs).
 */

type PassId = "morning" | "afternoon";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; layer: string; date: string; url: string; route: string }
  | { status: "missing"; date: string | null }
  | { status: "error" };

const PASSES: { id: PassId; label: string }[] = [
  { id: "morning", label: "Morning" },
  { id: "afternoon", label: "Afternoon" },
];

const LAYER_LABELS: Record<string, string> = {
  MODIS_Terra_CorrectedReflectance_TrueColor: "MODIS Terra · 250 m",
  MODIS_Aqua_CorrectedReflectance_TrueColor: "MODIS Aqua · 250 m",
  VIIRS_NOAA21_CorrectedReflectance_TrueColor: "NOAA-21 VIIRS · 750 m",
};

const MAX_WALK = 6;

const LIGHT_PILL =
  "inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-sky-50 hover:text-sky-700 disabled:pointer-events-none disabled:opacity-40";
const STEP_PILL =
  "grid size-9 place-items-center rounded-full bg-slate-100 text-lg leading-none text-slate-600 transition-colors hover:bg-sky-50 hover:text-sky-700 disabled:pointer-events-none disabled:opacity-40";
const DARK_PILL =
  "inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-medium text-slate-100 ring-1 ring-white/10 transition-colors hover:bg-white/20 disabled:pointer-events-none disabled:opacity-40";

const DAY_FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "short",
  month: "short",
  day: "numeric",
});

/** Today's calendar day in Eastern time — set on mount so server and client never disagree. */
function etToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
}

/** Shift a plain calendar day; anchored at 16:00 UTC so DST edges keep the same date. */
function etAddDays(date: string, delta: number): string {
  const at = new Date(Date.parse(`${date}T16:00:00Z`) + delta * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(at);
}

function dayLabel(date: string, today: string | null): string {
  if (today !== null && date === today) return "Today";
  if (today !== null && date === etAddDays(today, -1)) return "Yesterday";
  return DAY_FORMAT.format(new Date(`${date}T16:00:00Z`));
}

export function SatellitePasses() {
  const [today, setToday] = useState<string | null>(null);
  const [request, setRequest] = useState<{ pass: PassId; offset: number }>({
    pass: "afternoon",
    offset: 0,
  });
  const [result, setResult] = useState<{ key: string; state: LoadState } | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [fullSize, setFullSize] = useState(false);
  const baseRef = useRef<string | null>(null);
  const urlRef = useRef<string | null>(null);

  // Deferred kick, matching the dashboard header — avoids a synchronous write in the effect.
  useEffect(() => {
    const kick = window.setTimeout(() => setToday(etToday()), 0);
    return () => window.clearTimeout(kick);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const { pass, offset } = request;
    const key = `${pass}:${offset}`;
    const explicitDate =
      offset > 0 && baseRef.current !== null ? etAddDays(baseRef.current, -offset) : null;

    (async () => {
      try {
        const query = explicitDate === null ? `pass=${pass}` : `pass=${pass}&date=${explicitDate}`;
        const response = await fetch(`/api/satellite/polar?${query}`, {
          signal: controller.signal,
        });
        if (response.status === 404) {
          setResult({ key, state: { status: "missing", date: explicitDate } });
          return;
        }
        if (!response.ok) throw new Error(`status ${response.status}`);
        const layer = response.headers.get("X-Satellite-Layer");
        const date = response.headers.get("X-Satellite-Date");
        if (!layer || !date) throw new Error("missing metadata");
        const blob = await response.blob();
        if (offset === 0) baseRef.current = date;
        if (urlRef.current !== null) URL.revokeObjectURL(urlRef.current);
        const url = URL.createObjectURL(blob);
        urlRef.current = url;
        setResult({
          key,
          state: {
            status: "ready",
            layer,
            date,
            url,
            route: `/api/satellite/polar?pass=${pass}&date=${date}`,
          },
        });
      } catch {
        if (controller.signal.aborted) return;
        setResult({ key, state: { status: "error" } });
      }
    })();

    return () => controller.abort();
  }, [request]);

  // The object URL outlives the fetch it came from; release it on unmount.
  useEffect(
    () => () => {
      if (urlRef.current !== null) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  // Esc closes the review overlay and the page behind it holds still.
  useEffect(() => {
    if (!reviewOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setReviewOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [reviewOpen]);

  const requestKey = `${request.pass}:${request.offset}`;
  const state: LoadState = result?.key === requestKey ? result.state : { status: "loading" };

  const credit =
    state.status === "ready"
      ? `${dayLabel(state.date, today)} · ${LAYER_LABELS[state.layer] ?? state.layer}`
      : state.status === "loading"
        ? "Loading the pass…"
        : state.status === "missing"
          ? state.date === null
            ? "No usable pass yet"
            : `No imagery for ${dayLabel(state.date, today)}`
          : "Imagery unavailable";

  return (
    <>
      <SectionNote>
        The polar satellites cross the Northeast once or twice a day — one sharp look
        instead of a loop. Morning is the Terra pass, afternoon is Aqua; each true-colour
        view resolves the cloud at 250 metres, several times the detail of the GOES loop.
        Imagery appears a few hours after the overflight.
      </SectionNote>

      <div className="mx-auto mt-5 w-full max-w-3xl">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-full bg-slate-100 p-1" role="group" aria-label="Pass time of day">
            {PASSES.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={request.pass === option.id}
                onClick={() => {
                  setReviewOpen(false);
                  baseRef.current = null;
                  setRequest({ pass: option.id, offset: 0 });
                }}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  request.pass === option.id
                    ? "bg-sky-700 text-white"
                    : "text-slate-600 hover:text-sky-700"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setReviewOpen(true)}
            disabled={state.status !== "ready"}
            className={`ml-auto ${LIGHT_PILL}`}
          >
            Full resolution
            <span aria-hidden="true" className="text-slate-400">
              ⤢
            </span>
          </button>
        </div>

        <div className="relative mt-4 overflow-hidden rounded-2xl bg-slate-900 ring-1 ring-slate-900/10">
          {state.status === "ready" ? (
            <img
              src={state.url}
              width={2400}
              height={1540}
              alt={`Satellite pass over the Northeast — ${dayLabel(state.date, today)}`}
              className="block h-auto w-full"
            />
          ) : (
            <div className="grid aspect-[2400/1540] w-full place-items-center px-6 text-center">
              <p
                className={`text-sm text-slate-300 ${state.status === "loading" ? "animate-pulse" : ""}`}
              >
                {state.status === "loading"
                  ? "Loading the most recent pass…"
                  : state.status === "missing" && state.date !== null
                    ? `No usable imagery for ${dayLabel(state.date, today)} — step to another day.`
                    : "No pass imagery yet — check back after the next overflight."}
              </p>
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
          <button
            type="button"
            onClick={() => setRequest({ pass: request.pass, offset: Math.min(MAX_WALK, request.offset + 1) })}
            disabled={request.offset >= MAX_WALK}
            aria-label="Earlier day"
            className={STEP_PILL}
          >
            ‹
          </button>
          <p className="font-display text-sm font-semibold tabular-nums text-slate-800">{credit}</p>
          <button
            type="button"
            onClick={() => setRequest({ pass: request.pass, offset: Math.max(0, request.offset - 1) })}
            disabled={request.offset === 0}
            aria-label="Later day"
            className={STEP_PILL}
          >
            ›
          </button>
          {request.offset > 0 ? (
            <button
              type="button"
              onClick={() => setRequest({ pass: request.pass, offset: 0 })}
              className={`ml-auto ${LIGHT_PILL}`}
            >
              Latest
            </button>
          ) : null}
        </div>

        <p className="mt-3 text-xs leading-5 text-slate-400">
          NASA Worldview / GIBS · MODIS Terra and Aqua true colour at 250 m, with NOAA-21
          VIIRS (750 m) as the afternoon backup · 15 m coastlines · passes are rendered a
          few hours after the overflight, and days are Eastern.
        </p>
      </div>

      {reviewOpen && state.status === "ready" ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Satellite pass at full resolution — ${dayLabel(state.date, today)}`}
          className="fixed inset-0 z-[70] flex flex-col bg-slate-950/95 p-4 sm:p-6"
          onClick={() => setReviewOpen(false)}
        >
          <div
            className="flex flex-wrap items-center gap-x-3 gap-y-2"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="font-display text-sm font-semibold text-white">
              {dayLabel(state.date, today)}
            </p>
            <span className="text-xs text-slate-400">
              {LAYER_LABELS[state.layer] ?? state.layer} · NASA Worldview
            </span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setFullSize((value) => !value)}
                className={DARK_PILL}
                title={fullSize ? "Scale the pass to fit the window" : "Show the pass 1:1"}
              >
                {fullSize ? "Fit to screen" : "Full size"}
              </button>
              <a
                href={state.route}
                target="_blank"
                rel="noreferrer"
                className={DARK_PILL}
                title="Open the image in a new tab"
              >
                Open image <span aria-hidden="true">↗</span>
              </a>
              <button
                type="button"
                onClick={() => setReviewOpen(false)}
                aria-label="Close the full-resolution view"
                className={DARK_PILL}
              >
                ✕
              </button>
            </div>
          </div>

          <div
            className={
              fullSize ? "mt-4 min-h-0 flex-1 overflow-auto" : "relative mt-4 min-h-0 flex-1"
            }
            onClick={(event) => event.stopPropagation()}
          >
            <img
              src={state.url}
              width={2400}
              height={1540}
              alt={`Satellite pass at full resolution — ${dayLabel(state.date, today)}`}
              className={
                fullSize ? "max-w-none" : "absolute inset-0 h-full w-full object-contain"
              }
            />
          </div>

          <p
            className="mt-3 text-center text-xs text-slate-500"
            onClick={(event) => event.stopPropagation()}
          >
            Click outside or press Esc to close.
          </p>
        </div>
      ) : null}
    </>
  );
}
