"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/fetch-json";
import { wxApiPath } from "@/lib/wx-datasets";

const REFRESH_MS = 5 * 60 * 1000;
const MPH_TO_KT = 0.868976;
const KMH_TO_KT = 0.539957;

const compass = [
  "N",
  "NNE",
  "NE",
  "ENE",
  "E",
  "ESE",
  "SE",
  "SSE",
  "S",
  "SSW",
  "SW",
  "WSW",
  "W",
  "WNW",
  "NW",
  "NNW",
];

function directionLetters(deg: number): string {
  return compass[Math.round(deg / 22.5) % 16];
}

type Summit = {
  tempF: number | null;
  windKt: number | null;
  gustKt: number | null;
  dirDeg: number | null;
  observedAt: string;
  source: "mwobs" | "kmwn";
};

/** The first number inside a display string like "20 mph", "37°F" or "350°(N)". */
function numberIn(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = /-?\d+(?:\.\d+)?/.exec(value);
  return match ? Number(match[0]) : null;
}

/** "2026-10-10 21:07:00" is the observatory's wall clock in America/New_York. */
function nyLocalToDate(value: string): Date {
  const asUtc = Date.parse(`${value.replace(" ", "T")}Z`);
  if (Number.isNaN(asUtc)) throw new Error("bad observatory timestamp");
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(asUtc));
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const wallMs = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return new Date(asUtc - (wallMs - asUtc));
}

/** The observatory's own live reading — the feed behind their current-conditions page. */
async function fetchMwobs(): Promise<Summit> {
  const data = (await fetchJson(wxApiPath("summit-mwobs"))) as {
    summitConditions?: {
      LastUpdated?: string;
      Imperial?: { Temperature?: string; Wind?: string; Gust?: string };
      Direction?: string;
    };
  };
  const summit = data?.summitConditions;
  const windMph = numberIn(summit?.Imperial?.Wind);
  const dirDeg = numberIn(summit?.Direction);
  if (!summit?.LastUpdated || windMph === null || dirDeg === null) {
    throw new Error("incomplete observatory reading");
  }
  const gustMph = numberIn(summit.Imperial?.Gust);
  return {
    tempF: numberIn(summit.Imperial?.Temperature),
    windKt: Math.round(windMph * MPH_TO_KT),
    gustKt: gustMph === null ? null : Math.round(gustMph * MPH_TO_KT),
    dirDeg,
    observedAt: nyLocalToDate(summit.LastUpdated).toISOString(),
    source: "mwobs",
  };
}

/** Fallback: the NWS station at the summit — same air, a plain observation, never a model. */
async function fetchStation(): Promise<Summit> {
  const data = (await fetchJson("https://api.weather.gov/stations/KMWN/observations/latest", {
    headers: { Accept: "application/geo+json" },
  })) as { properties?: Record<string, unknown> };
  const properties = data?.properties ?? {};
  const observationNumber = (key: string): number | null => {
    const value = properties[key];
    if (value && typeof value === "object" && typeof (value as { value?: unknown }).value === "number") {
      return (value as { value: number }).value;
    }
    return null;
  };
  const windKmh = observationNumber("windSpeed");
  const dirDeg = observationNumber("windDirection");
  if (windKmh === null || dirDeg === null) throw new Error("incomplete summit observation");
  const tempC = observationNumber("temperature");
  const gustKmh = observationNumber("windGust");
  return {
    tempF: tempC === null ? null : Math.round((tempC * 9) / 5 + 32),
    windKt: Math.round(windKmh * KMH_TO_KT),
    gustKt: gustKmh === null ? null : Math.round(gustKmh * KMH_TO_KT),
    dirDeg,
    observedAt:
      typeof properties.timestamp === "string" ? properties.timestamp : new Date().toISOString(),
    source: "kmwn",
  };
}

/** The wind at the summit right now — the observatory's instruments first. */
export function SummitWinds() {
  const [summit, setSummit] = useState<Summit | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const next = await fetchMwobs().catch(() => fetchStation());
        if (!cancelled) setSummit(next);
      } catch {
        /* keep the last reading; the card only appears once data arrives */
      }
    };
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  if (!summit) return null;

  const observed = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
    timeZoneName: "short",
  }).format(new Date(summit.observedAt));

  const source =
    summit.source === "mwobs"
      ? {
          href: "https://mountwashington.org/weather/current-summit-conditions/",
          label: "Mount Washington Observatory",
        }
      : {
          href: "https://www.weather.gov/wrh/timeseries?site=KMWN",
          label: "NWS summit station",
        };

  return (
    <div className="rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur-md sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-display text-xs font-semibold uppercase tracking-[0.28em] text-sky-300">
          Winds at the summit
        </p>
        <p className="text-[11px] text-sky-200/80">6,288 ft</p>
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-3">
        <div>
          <dd className="flex items-baseline gap-1.5 font-display font-bold text-white">
            {summit.dirDeg !== null ? (
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="size-4 shrink-0 self-center text-sky-300"
                style={{ transform: `rotate(${summit.dirDeg + 180}deg)` }}
              >
                <path d="M12 3.5 18 19l-6-3-6 3z" fill="currentColor" />
              </svg>
            ) : null}
            <span className="text-sm text-sky-200">
              {summit.dirDeg !== null ? directionLetters(summit.dirDeg) : ""}
            </span>
            <span className="text-2xl tabular-nums">{summit.windKt ?? "—"}</span>
          </dd>
          <dt className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-200">
            Wind kt
          </dt>
        </div>
        <div>
          <dd className="font-display text-2xl font-bold tabular-nums text-white">
            {summit.gustKt !== null ? summit.gustKt : "—"}
          </dd>
          <dt className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-200">
            Gust kt
          </dt>
        </div>
        <div>
          <dd className="font-display text-2xl font-bold tabular-nums text-white">
            {summit.tempF !== null ? `${summit.tempF}°F` : "—"}
          </dd>
          <dt className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-200">
            Temp
          </dt>
        </div>
      </dl>
      <p className="mt-3 text-[11px] text-sky-200/70">
        <a
          href={source.href}
          target="_blank"
          rel="noreferrer"
          className="underline decoration-sky-200/40 underline-offset-2 transition-colors hover:text-sky-100"
        >
          {source.label}
        </a>{" "}
        <span aria-hidden="true">↗</span>
        {" · "}
        {observed}
      </p>
    </div>
  );
}
