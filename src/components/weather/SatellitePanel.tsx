"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SatellitePasses } from "@/components/weather/SatellitePasses";
import { SatellitePin, usePinBox } from "@/components/weather/SatellitePin";
import { SectionNote } from "@/components/weather/SectionNote";
import { GOES_PIN_PIXELS, GOES_SIZE } from "@/lib/satellite";

/**
 * GOES-East satellite review — the highest-resolution imagery NOAA publishes for the
 * Northeast, stepped as five-minute stills.
 *
 * Frames are plain JPEGs on NOAA's STAR CDN (GOES19 is the current GOES-East), named by
 * UTC scan slot. A new frame lands about five minutes after its scan, so the list stops
 * a few minutes behind the clock, and a failed scan shows up as one missing frame rather
 * than a stuck loop. They render as raw <img> elements with an explicit srcset: every URL
 * is a fresh five-minute JPEG, so the Next image optimizer would only add latency and
 * spend its quota re-encoding them.
 */

const CDN = "https://cdn.star.nesdis.noaa.gov/GOES19/ABI/SECTOR/ne/GEOCOLOR";
const STEP_MS = 5 * 60 * 1000;
/** Scans publish about five minutes after their slot; stay further back than that. */
const LEAD_MS = 6 * 60 * 1000;
/** The slider's range: six hours of five-minute frames, newest first. */
const WINDOW_FRAMES = 73;
/** Play loops the two hours ending at the selected frame. */
const LOOP_FRAMES = 24;
const PLAY_MS = 450;
const SIZES = "(min-width: 768px) 768px, calc(100vw - 96px)";

const LIGHT_PILL =
  "inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-sky-50 hover:text-sky-700 disabled:pointer-events-none disabled:opacity-40";
const MODES: { id: "loop" | "passes"; label: string }[] = [
  { id: "loop", label: "Loop" },
  { id: "passes", label: "Daily passes" },
];
const PLAY_PILL =
  "inline-flex items-center gap-1.5 rounded-full bg-sky-700 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-800";
const DARK_PILL =
  "inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-medium text-slate-100 ring-1 ring-white/10 transition-colors hover:bg-white/20 disabled:pointer-events-none disabled:opacity-40";

const TIME_FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
});

type FrameSize = "600x600" | "1200x1200" | "2400x2400";

/** NOAA's scan stamp: year + day-of-year + HHMM, all UTC. */
function frameStamp(ms: number): string {
  const date = new Date(ms);
  const year = date.getUTCFullYear();
  const day = Math.floor((ms - Date.UTC(year, 0, 1)) / 86_400_000) + 1;
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  return `${year}${String(day).padStart(3, "0")}${hh}${mm}`;
}

function frameUrl(ms: number, size: FrameSize): string {
  return `${CDN}/${frameStamp(ms)}_GOES19-ABI-ne-GEOCOLOR-${size}.jpg`;
}

function frameSrcSet(ms: number): string {
  return `${frameUrl(ms, "600x600")} 600w, ${frameUrl(ms, "1200x1200")} 1200w`;
}

/** The newest published slot: the five-minute grid at minute :01, kept behind the clock. */
function newestFrameMs(now: number): number {
  return Math.floor((now - LEAD_MS - 60_000) / STEP_MS) * STEP_MS + 60_000;
}

/** Warm the browser cache for an upcoming frame, resolving the same srcset candidate the display uses. */
function preloadFrame(ms: number): void {
  const image = new Image();
  image.sizes = SIZES;
  image.srcset = frameSrcSet(ms);
  image.src = frameUrl(ms, "1200x1200");
}

export function SatellitePanel() {
  const [now, setNow] = useState<number | null>(null);
  const [mode, setMode] = useState<"loop" | "passes">("loop");
  const [offset, setOffset] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loadedStamp, setLoadedStamp] = useState<string | null>(null);
  const [missing, setMissing] = useState<ReadonlySet<string>>(() => new Set());
  const [reviewOpen, setReviewOpen] = useState(false);
  const [loadedReviewStamp, setLoadedReviewStamp] = useState<string | null>(null);
  const [fullSize, setFullSize] = useState(false);
  const loop = useRef({ start: 0, end: 0 });
  const reviewImageRef = useRef<HTMLImageElement | null>(null);
  const pinBox = usePinBox(reviewImageRef, reviewOpen);

  // Fresh frames every five minutes; catch up the moment a background tab returns.
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = window.setInterval(tick, STEP_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const frames = useMemo(() => {
    if (now === null) return [];
    const newest = newestFrameMs(now);
    return Array.from({ length: WINDOW_FRAMES }, (_, index) => newest - index * STEP_MS);
  }, [now]);

  // Before the clock lands (server render and first paint) these placeholders are computed
  // but never shown — the skeleton branch below returns before this is rendered.
  const selected = frames[Math.min(offset, Math.max(frames.length - 1, 0))] ?? 0;
  const stamp = frameStamp(selected);
  const label = TIME_FORMAT.format(selected);
  const isMissing = missing.has(stamp);
  const reviewLoaded = loadedReviewStamp === stamp;

  // Playback steps toward the present, waiting for each frame to arrive before moving on.
  useEffect(() => {
    if (!playing || loadedStamp !== stamp) return;
    const timer = window.setTimeout(() => {
      setOffset((prev) => {
        const next = prev - 1;
        return next < loop.current.end ? loop.current.start : next;
      });
    }, PLAY_MS);
    return () => window.clearTimeout(timer);
  }, [playing, loadedStamp, stamp]);

  // Keep a few frames ahead of the loop warm.
  useEffect(() => {
    if (!playing) return;
    for (let ahead = 1; ahead <= 4; ahead += 1) {
      const ms = frames[offset - ahead];
      if (ms !== undefined) preloadFrame(ms);
    }
  }, [playing, offset, frames]);

  // While the review overlay is open: Esc closes it, arrow keys step frames, page scroll locks.
  useEffect(() => {
    if (!reviewOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setReviewOpen(false);
        return;
      }
      const delta = event.key === "ArrowLeft" ? 1 : event.key === "ArrowRight" ? -1 : 0;
      if (delta === 0) return;
      setPlaying(false);
      setOffset((prev) => Math.min(frames.length - 1, Math.max(0, prev + delta)));
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [reviewOpen, frames.length]);

  // Every frame change in the overlay reloads the full-resolution image — the loaded
  // stamp is compared against the selected frame, so no reset effect is needed.

  function stepBy(delta: number) {
    setPlaying(false);
    setOffset((prev) => Math.min(frames.length - 1, Math.max(0, prev + delta)));
  }

  function togglePlay() {
    if (playing) {
      setPlaying(false);
      return;
    }
    const end = Math.min(offset, frames.length - 1 - LOOP_FRAMES);
    const start = Math.min(frames.length - 1, end + LOOP_FRAMES);
    loop.current = { start, end };
    setOffset(start);
    setPlaying(true);
  }

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="font-display text-xs font-semibold uppercase tracking-[0.28em] text-sky-700">
        Satellite
      </p>
      <div className="flex rounded-full bg-slate-100 p-1" role="group" aria-label="Satellite view">
        {MODES.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={mode === option.id}
            onClick={() => {
              setPlaying(false);
              setMode(option.id);
            }}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
              mode === option.id ? "bg-sky-700 text-white" : "text-slate-600 hover:text-sky-700"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );

  if (now === null) {
    // The clock is client-side only (same as the dashboard header) so server and client
    // can never disagree about which five-minute frame is current.
    return (
      <section
        aria-label="Satellite"
        className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5 sm:p-7"
      >
        {header}
        <SectionNote>
          Five-minute frames of the Northeast from the GOES-East satellite — a minute-by-minute view
          of the wave&rsquo;s cloud as it builds, sits, and washes out. Step through the last six
          hours, or open any frame full size to read the structure up close.
        </SectionNote>
        <div className="mx-auto mt-5 w-full max-w-3xl" aria-hidden="true">
          <div className="aspect-square w-full animate-pulse rounded-2xl bg-slate-100" />
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label="Satellite"
      className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5 sm:p-7"
    >
      {header}

      {mode === "passes" ? (
        <SatellitePasses />
      ) : (
        <>
        <SectionNote>
          Five-minute frames of the Northeast from the GOES-East satellite — a minute-by-minute view
          of the wave&rsquo;s cloud as it builds, sits, and washes out. Step through the last six
          hours, or open any frame full size to read the structure up close.
        </SectionNote>

        <div className="mx-auto mt-5 w-full max-w-3xl">
          <div className="relative overflow-hidden rounded-2xl bg-slate-900 ring-1 ring-slate-900/10">
            <img
              src={frameUrl(selected, "1200x1200")}
              srcSet={frameSrcSet(selected)}
              sizes={SIZES}
              width={2400}
              height={2400}
              alt={`GOES-East GeoColor satellite frame — ${label}`}
              className="block h-auto w-full"
              decoding="async"
              onLoad={() => setLoadedStamp(stamp)}
              onError={() => {
                setMissing((prev) => new Set(prev).add(stamp));
                setLoadedStamp(stamp);
              }}
            />
            {isMissing ? (
              <div className="absolute inset-0 grid place-items-center bg-slate-900/85 px-6 text-center text-sm text-slate-200">
                No frame for this time — that scan is missing. Step to another frame.
              </div>
            ) : null}
            <SatellitePin
              style={{
                left: `${(GOES_PIN_PIXELS.x / GOES_SIZE.width) * 100}%`,
                top: `${(GOES_PIN_PIXELS.y / GOES_SIZE.height) * 100}%`,
              }}
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
            <p className="font-display text-sm font-semibold tabular-nums text-slate-800">{label}</p>
            {offset === 0 ? (
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700 ring-1 ring-emerald-600/20">
                latest
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setPlaying(false);
                setReviewOpen(true);
              }}
              disabled={isMissing}
              className={`ml-auto ${LIGHT_PILL}`}
            >
              Full resolution
              <span aria-hidden="true" className="text-slate-400">
                ⤢
              </span>
            </button>
          </div>

          <input
            type="range"
            min={0}
            max={frames.length - 1}
            value={frames.length - 1 - offset}
            onChange={(event) => {
              setPlaying(false);
              setOffset(frames.length - 1 - Number(event.target.value));
            }}
            aria-label="Frame time — left is six hours ago, right is the latest frame"
            className="mt-4 w-full cursor-pointer accent-sky-700"
          />
          <div className="mt-1 flex justify-between text-[11px] text-slate-400">
            <span>−6 hours</span>
            <span>latest</span>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => stepBy(1)}
              disabled={offset >= frames.length - 1}
              title="Back five minutes"
              className={LIGHT_PILL}
            >
              <span aria-hidden="true">◀</span> 5 min
            </button>
            <button
              type="button"
              onClick={togglePlay}
              disabled={isMissing}
              title="Play the two hours up to this frame"
              className={PLAY_PILL}
            >
              {playing ? "Pause" : "Play"}
            </button>
            <button
              type="button"
              onClick={() => stepBy(-1)}
              disabled={offset <= 0}
              title="Forward five minutes"
              className={LIGHT_PILL}
            >
              5 min <span aria-hidden="true">▶</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setPlaying(false);
                setOffset(0);
              }}
              disabled={offset === 0}
              title="Jump to the latest frame"
              className={`ml-auto ${LIGHT_PILL}`}
            >
              Latest
            </button>
          </div>

          <p className="mt-3 text-xs leading-5 text-slate-400">
            NOAA/NESDIS STAR · GOES-East (GOES-19) GeoColor · five-minute scans. Full-resolution
            frames are 2400 × 2400 — NOAA&rsquo;s largest rendering of this view. Frame times are
            Eastern; the timestamp inside the image is UTC.
          </p>
        </div>
        </>
      )}

      {mode === "loop" && reviewOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Satellite frame at full resolution — ${label}`}
          className="fixed inset-0 z-[70] flex flex-col bg-slate-950/95 p-4 sm:p-6"
          onClick={() => setReviewOpen(false)}
        >
          <div
            className="flex flex-wrap items-center gap-x-3 gap-y-2"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="font-display text-sm font-semibold tabular-nums text-white">{label}</p>
            <span className="text-xs text-slate-400">2400 × 2400 · NOAA GOES-East</span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => stepBy(1)}
                disabled={offset >= frames.length - 1}
                className={DARK_PILL}
                title="Back five minutes"
              >
                <span aria-hidden="true">◀</span> 5 min
              </button>
              <button
                type="button"
                onClick={() => stepBy(-1)}
                disabled={offset <= 0}
                className={DARK_PILL}
                title="Forward five minutes"
              >
                5 min <span aria-hidden="true">▶</span>
              </button>
              <button
                type="button"
                onClick={() => setFullSize((value) => !value)}
                className={DARK_PILL}
                title={fullSize ? "Scale the frame to fit the window" : "Show the frame 1:1"}
              >
                {fullSize ? "Fit to screen" : "Full size"}
              </button>
              <a
                href={frameUrl(selected, "2400x2400")}
                target="_blank"
                rel="noreferrer"
                className={DARK_PILL}
                title="Open the JPEG in a new tab"
              >
                Open JPEG <span aria-hidden="true">↗</span>
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
              fullSize
                ? "relative mt-4 min-h-0 flex-1 overflow-auto"
                : "relative mt-4 min-h-0 flex-1"
            }
            onClick={(event) => event.stopPropagation()}
          >
            {isMissing ? (
              <p
                className={
                  fullSize
                    ? "text-sm text-slate-300"
                    : "absolute inset-0 grid place-items-center px-6 text-center text-sm text-slate-300"
                }
              >
                No frame for this time — that scan is missing. Step to another frame.
              </p>
            ) : (
              <>
                {!reviewLoaded ? (
                  <p
                    className={
                      fullSize
                        ? "text-sm text-slate-300"
                        : "absolute inset-0 grid place-items-center text-sm text-slate-300"
                    }
                  >
                    Loading the full-resolution frame…
                  </p>
                ) : null}
                <img
                  ref={reviewImageRef}
                  src={frameUrl(selected, "2400x2400")}
                  width={2400}
                  height={2400}
                  alt={`GOES-East GeoColor satellite frame at full resolution — ${label}`}
                  className={
                    reviewLoaded
                      ? fullSize
                        ? "max-w-none"
                        : "absolute inset-0 h-full w-full object-contain"
                      : "hidden"
                  }
                  onLoad={() => setLoadedReviewStamp(stamp)}
                />
                {reviewLoaded && pinBox ? (
                  <SatellitePin
                    style={{
                      left: pinBox.offsetX + GOES_PIN_PIXELS.x * pinBox.scale,
                      top: pinBox.offsetY + GOES_PIN_PIXELS.y * pinBox.scale,
                    }}
                  />
                ) : null}
              </>
            )}
          </div>

          <p
            className="mt-3 text-center text-xs text-slate-500"
            onClick={(event) => event.stopPropagation()}
          >
            Click outside or press Esc to close — arrow keys step frames.
          </p>
        </div>
      ) : null}
    </section>
  );
}
