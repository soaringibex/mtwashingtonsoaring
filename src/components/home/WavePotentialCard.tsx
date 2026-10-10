"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/fetch-json";
import { mergedSeries } from "@/lib/forecast-model";
import { computeWaveScore, signalLabel, WAVE_LEVELS, type WaveLevel } from "@/lib/wave-score";
import { wxApiPath } from "@/lib/wx-datasets";

const REFRESH_MS = 45 * 60 * 1000;

type Potential = { average: number; hours: number };

/**
 * Today's 10 AM–4 PM average of the same Scorer-parameter signal the Wavecast
 * dashboard computes hour by hour.
 */
async function fetchTodayPotential(variant: "hrrr" | "hrdps"): Promise<Potential> {
  const data = (await fetchJson(wxApiPath("wave-forecast", { models: variant }))) as {
    hourly: Record<string, unknown>;
  };
  const hourly = data.hourly;
  const times = hourly.time as unknown as string[];
  if (!times || times.length === 0) throw new Error("missing wave forecast");

  const at = (key: string, index: number): number | null => {
    // A single requested model comes back with plain keys; a merged pair is suffixed.
    const series =
      variant === "hrdps"
        ? mergedSeries(hourly, key)
        : ((hourly[key] as (number | null)[] | undefined) ?? null);
    if (!series) return null;
    const value = series[index];
    return typeof value === "number" ? value : null;
  };

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
  const scores: number[] = [];
  for (let i = 0; i < times.length; i += 1) {
    const time = times[i];
    if (!time.startsWith(today)) continue;
    const hour = Number(time.slice(11, 13));
    if (hour < 10 || hour > 16) continue;

    const levels: WaveLevel[] = [];
    let complete = true;
    for (const hPa of WAVE_LEVELS) {
      const altM = at(`geopotential_height_${hPa}hPa`, i);
      const speedKt = at(`wind_speed_${hPa}hPa`, i);
      const dirDeg = at(`wind_direction_${hPa}hPa`, i);
      const tempC = at(`temperature_${hPa}hPa`, i);
      if (altM === null || speedKt === null || dirDeg === null || tempC === null) {
        complete = false;
        break;
      }
      levels.push({
        hPa,
        altM,
        speedKt,
        dirDeg,
        tempC,
        cloudCover: at(`cloud_cover_${hPa}hPa`, i),
      });
    }
    if (!complete) continue;

    const score = computeWaveScore(levels);
    if (score) scores.push(score.score);
  }
  if (scores.length < 2) throw new Error("no wave hours today");

  const average = Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length);
  return { average, hours: scores.length };
}

/** Today's wave potential — the home page's hand-off to the Wavecast dashboard. */
export function WavePotentialCard() {
  const [potential, setPotential] = useState<Potential | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const next = await fetchTodayPotential("hrrr").catch(() => fetchTodayPotential("hrdps"));
        if (!cancelled) setPotential(next);
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

  if (!potential) return null;

  return (
    <Link
      href="/wx"
      className="group block rounded-3xl border border-white/15 bg-white/10 p-6 backdrop-blur-md transition-colors hover:bg-white/15 sm:p-7"
    >
      <p className="font-display text-xs font-semibold uppercase tracking-[0.28em] text-sky-300">
        Wave potential · today
      </p>
      <p className="mt-3 flex items-baseline gap-3">
        <span className="font-display text-4xl font-bold tabular-nums text-white">
          {potential.average}
        </span>
        <span className="text-sm font-medium text-sky-200">{signalLabel(potential.average)}</span>
      </p>
      <p className="mt-2 text-sm text-slate-200">
        10 AM – 4 PM average · {potential.hours} hours
      </p>
      <p className="mt-4 text-sm font-medium text-sky-200 group-hover:text-white">
        Open the Wavecast <span aria-hidden="true">→</span>
      </p>
    </Link>
  );
}
