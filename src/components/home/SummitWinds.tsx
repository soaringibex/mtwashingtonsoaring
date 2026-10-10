"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/fetch-json";
import { wxApiPath } from "@/lib/wx-datasets";

const REFRESH_MS = 10 * 60 * 1000;
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
  source: "station" | "model";
};

function observationNumber(value: unknown): number | null {
  if (value && typeof value === "object" && typeof (value as { value?: unknown }).value === "number") {
    return (value as { value: number }).value;
  }
  return null;
}

/** The summit observation (NWS station KMWN, at the observatory). */
async function fetchStation(): Promise<Summit> {
  const data = (await fetchJson("https://api.weather.gov/stations/KMWN/observations/latest", {
    headers: { Accept: "application/geo+json" },
  })) as { properties?: Record<string, unknown> };
  const properties = data?.properties ?? {};
  const tempC = observationNumber(properties.temperature);
  const windKmh = observationNumber(properties.windSpeed);
  const gustKmh = observationNumber(properties.windGust);
  const dirDeg = observationNumber(properties.windDirection);
  if (tempC === null || windKmh === null || dirDeg === null) {
    throw new Error("incomplete summit observation");
  }
  return {
    tempF: Math.round((tempC * 9) / 5 + 32),
    windKt: Math.round(windKmh * KMH_TO_KT),
    gustKt: gustKmh === null ? null : Math.round(gustKmh * KMH_TO_KT),
    dirDeg,
    observedAt:
      typeof properties.timestamp === "string" ? properties.timestamp : new Date().toISOString(),
    source: "station",
  };
}

/** Fallback: the latest model run at summit elevation. */
async function fetchModel(): Promise<Summit> {
  const data = (await fetchJson(wxApiPath("summit-current"))) as {
    current?: {
      time?: string;
      temperature_2m?: unknown;
      wind_speed_10m?: unknown;
      wind_gusts_10m?: unknown;
      wind_direction_10m?: unknown;
    };
  };
  const current = data?.current ?? {};
  if (
    typeof current.temperature_2m !== "number" ||
    typeof current.wind_speed_10m !== "number" ||
    typeof current.wind_direction_10m !== "number"
  ) {
    throw new Error("incomplete summit model data");
  }
  return {
    tempF: Math.round(current.temperature_2m),
    windKt: Math.round(current.wind_speed_10m),
    gustKt: typeof current.wind_gusts_10m === "number" ? Math.round(current.wind_gusts_10m) : null,
    dirDeg: current.wind_direction_10m,
    observedAt: new Date(`${current.time}Z`).toISOString(),
    source: "model",
  };
}

/** The wind at the summit right now — station first, model when the station is silent. */
export function SummitWinds() {
  const [summit, setSummit] = useState<Summit | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const next = await fetchStation().catch(() => fetchModel());
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
          href={
            summit.source === "station"
              ? "https://mountwashington.org/weather/current-summit-conditions/"
              : "https://open-meteo.com/"
          }
          target="_blank"
          rel="noreferrer"
          className="underline decoration-sky-200/40 underline-offset-2 transition-colors hover:text-sky-100"
        >
          {summit.source === "station" ? "Observatory station" : "Model estimate"}
        </a>{" "}
        <span aria-hidden="true">↗</span>
        {" · "}
        {observed}
      </p>
    </div>
  );
}
