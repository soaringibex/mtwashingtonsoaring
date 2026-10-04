"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const LATITUDE = 44.3931;
const LONGITUDE = -71.1996;
const REFRESH_MS = 45 * 60 * 1000;

/** Pressure levels to pull, in hPa. Filtered against the surface pressure at render time. */
const LEVELS = [1000, 975, 950, 925, 900, 850, 800, 700, 600, 500, 400, 300, 250, 200];

type ProfileRow = {
  hPa: number;
  altFt: number;
  speedKt: number;
  dirDeg: number;
  tempF: number | null;
};

type Profile = {
  rows: ProfileRow[];
  maxSpeedKt: number;
  hourLabel: string;
};

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

function speedBar(kt: number): string {
  if (kt >= 55) return "bg-red-500";
  if (kt >= 40) return "bg-orange-500";
  if (kt >= 30) return "bg-amber-400";
  if (kt >= 20) return "bg-sky-500";
  if (kt >= 10) return "bg-sky-300";
  return "bg-slate-300";
}

async function fetchProfile(): Promise<Profile> {
  const variables = [
    "wind_speed_10m",
    "wind_direction_10m",
    "temperature_2m",
    "surface_pressure",
    ...LEVELS.flatMap((level) => [
      `geopotential_height_${level}hPa`,
      `wind_speed_${level}hPa`,
      `wind_direction_${level}hPa`,
      `temperature_${level}hPa`,
    ]),
  ];
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${LATITUDE}&longitude=${LONGITUDE}` +
    `&hourly=${variables.join(",")}&models=gfs_seamless&wind_speed_unit=kn` +
    `&temperature_unit=fahrenheit&timezone=UTC&forecast_days=2`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`wind profile request failed: ${response.status}`);
  }

  const data: { hourly: Record<string, (number | null)[]> } = await response.json();
  const hourly = data.hourly;
  const times = hourly.time as unknown as string[];

  // The latest full hour at or before now (times are hourly UTC stamps, ascending).
  const now = Date.now();
  let index = 0;
  for (let i = 0; i < times.length; i += 1) {
    if (Date.parse(`${times[i]}:00Z`) <= now) index = i;
    else break;
  }

  const at = (key: string): number | null => {
    const series = hourly[key];
    if (!series) return null;
    const value = series[index];
    return typeof value === "number" ? value : null;
  };

  const surfacePressure = at("surface_pressure") ?? 1013;
  const rows: ProfileRow[] = [];

  const surfaceSpeed = at("wind_speed_10m");
  const surfaceDir = at("wind_direction_10m");
  if (surfaceSpeed !== null && surfaceDir !== null) {
    rows.push({
      hPa: Math.round(surfacePressure),
      altFt: 835,
      speedKt: surfaceSpeed,
      dirDeg: surfaceDir,
      tempF: at("temperature_2m"),
    });
  }

  for (const level of LEVELS) {
    // Skip levels that sit below the terrain (higher pressure than the surface).
    if (level > surfacePressure) continue;
    const height = at(`geopotential_height_${level}hPa`);
    const speed = at(`wind_speed_${level}hPa`);
    const dir = at(`wind_direction_${level}hPa`);
    if (height === null || speed === null || dir === null) continue;
    const altFt = Math.round(height * 3.28084);
    if (altFt < 800) continue;
    rows.push({
      hPa: level,
      altFt,
      speedKt: speed,
      dirDeg: dir,
      tempF: at(`temperature_${level}hPa`),
    });
  }

  // Highest altitude first, so the column reads like the sky does.
  rows.sort((a, b) => b.altFt - a.altFt);

  const maxSpeedKt = Math.max(40, ...rows.map((row) => Math.ceil(row.speedKt / 10) * 10));

  const hourLabel = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
    timeZoneName: "short",
  }).format(new Date(Date.parse(`${times[index]}:00Z`)));

  return { rows, maxSpeedKt, hourLabel };
}

type TemperaturePoint = { x: number; y: number; tempF: number; altFt: number };

/** Map each row's temperature across the central column — a °F curve drawn over the bars. */
function buildTemperatureProfile(
  rows: ProfileRow[],
): { points: string; dots: TemperaturePoint[]; height: number } | null {
  const present = rows
    .map((row) => row.tempF)
    .filter((value): value is number => value !== null);
  if (present.length < 2) return null;
  const lo = Math.floor((Math.min(...present) - 4) / 10) * 10;
  let hi = Math.ceil((Math.max(...present) + 4) / 10) * 10;
  if (hi - lo < 20) hi = lo + 20;

  const height = rows.length * 10;
  const dots = rows
    .map((row, index) =>
      row.tempF === null
        ? null
        : {
            x: 6 + ((row.tempF - lo) / (hi - lo)) * 88,
            y: index * 10 + 5,
            tempF: row.tempF,
            altFt: row.altFt,
          },
    )
    .filter((dot): dot is TemperaturePoint => dot !== null);

  return { points: dots.map((dot) => `${dot.x},${dot.y}`).join(" "), dots, height };
}

export function WindProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchProfile()
        .then((next) => {
          if (!cancelled) {
            setProfile(next);
            setError(false);
          }
        })
        .catch(() => {
          if (!cancelled) setError(true);
        });
    };
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const temperature = profile ? buildTemperatureProfile(profile.rows) : null;

  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5 sm:p-7">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-display text-xs font-semibold uppercase tracking-[0.28em] text-sky-700">
          Vertical wind profile
        </p>
        <p className="text-xs text-slate-400">
          {profile ? `${profile.hourLabel} · Mt Washington` : "Mt Washington"}
        </p>
      </div>

      {profile ? (
        <>
          <div className="relative mt-5">
            <ul className="grid gap-2">
              {profile.rows.map((row) => (
                <li
                  key={`${row.hPa}-${row.altFt}`}
                  className="grid grid-cols-[4.25rem_0.875rem_minmax(0,1fr)_4.25rem] items-center gap-2 sm:grid-cols-[5rem_1rem_minmax(0,1fr)_5.5rem] sm:gap-2.5"
                >
                  <span
                    className="text-right text-[11px] tabular-nums text-slate-500"
                    title={`${row.hPa} hPa`}
                  >
                    {row.altFt.toLocaleString("en-US")} ft
                  </span>
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="size-4 text-sky-600"
                    style={{ transform: `rotate(${row.dirDeg + 180}deg)` }}
                  >
                    <path d="M12 3.5 18 19l-6-3-6 3z" fill="currentColor" />
                  </svg>
                  <span className="relative block h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <span
                      className={`absolute inset-y-0 left-0 z-10 rounded-full ${speedBar(row.speedKt)}`}
                      style={{
                        width: `${Math.max(4, (row.speedKt / profile.maxSpeedKt) * 100)}%`,
                      }}
                    />
                  </span>
                  <span className="text-right text-xs font-medium tabular-nums text-slate-700">
                    {directionLetters(row.dirDeg)} {Math.round(row.speedKt)} kt
                  </span>
                </li>
              ))}
            </ul>
            {/* A stylized west-to-east profile of Mount Washington, drawn behind the bars so the
                wind at mountain heights reads against the mountain itself. The peak sits at the
                summit's altitude (between the 4,977 ft and 6,594 ft rows). */}
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
              className="pointer-events-none absolute bottom-0 left-[6.125rem] right-[4.75rem] h-40 sm:left-[7.25rem] sm:right-[6.125rem]"
            >
              <path
                d="M0 100 L2 95 L5 88 L8 79 L10 72 L13 64 L16 56 L18.5 49 L21 42 L23.5 34 L26 26 L28.5 17 L30.5 9 L32 5 L33.5 5 L36 10 L39.5 18 L44 28 L49.5 38 L56 48 L63.5 58 L71.5 68 L80 77 L88 85 L94.5 91 L100 95 L100 100 Z"
                className="fill-slate-300/80"
              />
            </svg>
            {temperature ? (
              <svg
                viewBox={`0 0 100 ${temperature.height}`}
                preserveAspectRatio="none"
                aria-hidden="true"
                className="pointer-events-none absolute left-[6.125rem] right-[4.75rem] top-0 z-20 h-full sm:left-[7.25rem] sm:right-[6.125rem]"
              >
                <polyline
                  points={temperature.points}
                  fill="none"
                  stroke="#ffffff"
                  strokeOpacity={0.85}
                  strokeWidth={5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
                <polyline
                  points={temperature.points}
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
                {temperature.dots.map((dot) => (
                  <circle
                    key={`${dot.altFt}-${dot.tempF}`}
                    cx={dot.x}
                    cy={dot.y}
                    r={2.2}
                    fill="#ef4444"
                    className="pointer-events-auto"
                  >
                    <title>{`${Math.round(dot.tempF)}°F at ${dot.altFt.toLocaleString("en-US")} ft`}</title>
                  </circle>
                ))}
              </svg>
            ) : null}
          </div>
          <p className="mt-4 text-[11px] leading-5 text-slate-400">
            Arrows point the way the wind is blowing; the red curve is the temperature profile in
            °F. Mount Washington&apos;s summit is 6,288 ft and the Class A floor is 18,000 ft.
            Latest model run (
            <a
              href="https://open-meteo.com/"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-sky-700 hover:text-sky-600"
            >
              GFS via Open-Meteo
            </a>
            ), refreshed hourly —{" "}
            <Link href="/links#weather" className="font-medium text-sky-700 hover:text-sky-600">
              more weather links
            </Link>
            .
          </p>
        </>
      ) : error ? (
        <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600 ring-1 ring-slate-900/5">
          The wind profile is unavailable right now.{" "}
          <Link href="/links#weather" className="font-medium text-sky-700 hover:text-sky-600">
            Weather links
          </Link>
        </p>
      ) : (
        <div className="mt-5 grid gap-2" aria-hidden="true">
          {Array.from({ length: 10 }).map((_, index) => (
            <div
              key={index}
              className="grid grid-cols-[4.25rem_0.875rem_minmax(0,1fr)_4.25rem] items-center gap-2 sm:grid-cols-[5rem_1rem_minmax(0,1fr)_5.5rem] sm:gap-2.5"
            >
              <span className="h-3 animate-pulse rounded bg-slate-100" />
              <span className="size-3 animate-pulse rounded-full bg-slate-100" />
              <span className="h-2.5 animate-pulse rounded-full bg-slate-100" />
              <span className="h-3 animate-pulse rounded bg-slate-100" />
            </div>
          ))}
          <p className="mt-2 text-xs text-slate-400">Loading the latest wind profile…</p>
        </div>
      )}
    </div>
  );
}
