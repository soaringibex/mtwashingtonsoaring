"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const LATITUDE = 44.3931;
const LONGITUDE = -71.1996;
const REFRESH_MS = 45 * 60 * 1000;
const SUMMIT_FT = 6288;
const CLASS_A_FT = 18000;

/** Pressure levels to pull, in hPa. Filtered against the surface pressure at render time. */
const LEVELS = [1000, 975, 950, 925, 900, 850, 800, 700, 600, 500, 400, 300, 250, 200];

type ProfileRow = {
  hPa: number;
  altFt: number;
  speedKt: number;
  dirDeg: number;
  tempC: number | null;
  dewpointC: number | null;
};

type Profile = {
  rows: ProfileRow[];
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

/**
 * Wind-barb geometry in the SVG's local coordinates (x right, y down):
 * the staff points toward the wind's source, and the barbs sit on the
 * clockwise side, per the northern-hemisphere station model.
 */
function barbGeometry(speedKt: number, dirDeg: number) {
  const rounded = Math.max(0, Math.round(speedKt / 5) * 5);
  const from = dirDeg * (Math.PI / 180);
  const vx = Math.sin(from);
  const vy = -Math.cos(from);
  const lx = -vy;
  const ly = vx;

  // Work out the marks first, then size the staff so they all sit on it.
  const pennantCount = Math.floor(rounded / 50);
  const fullCount = Math.floor((rounded % 50) / 10);
  const halfCount = rounded % 10 >= 5 ? 1 : 0;
  const consumed = pennantCount * 13 + fullCount * 5.5 + halfCount * 5.5;
  const staffLength = Math.max(26, 2.5 + consumed + 3);

  const tip = { x: vx * staffLength, y: vy * staffLength };
  const at = (t: number) => ({ x: tip.x - vx * t, y: tip.y - vy * t });
  const marks: { x1: number; y1: number; x2: number; y2: number }[] = [];
  const pennants: string[] = [];

  let cursor = 2.5;
  for (let i = 0; i < pennantCount; i += 1) {
    const a = at(cursor);
    const b = at(cursor + 12);
    const apex = at(cursor + 6);
    pennants.push(
      `${a.x},${a.y} ${b.x},${b.y} ${apex.x + lx * 9.5},${apex.y + ly * 9.5}`,
    );
    cursor += 13;
  }
  for (let i = 0; i < fullCount; i += 1) {
    const p = at(cursor);
    marks.push({ x1: p.x, y1: p.y, x2: p.x + lx * 8.5, y2: p.y + ly * 8.5 });
    cursor += 5.5;
  }
  if (halfCount > 0) {
    const p = at(cursor);
    marks.push({ x1: p.x, y1: p.y, x2: p.x + lx * 4.5, y2: p.y + ly * 4.5 });
  }

  return { tip, marks, pennants, rounded };
}

async function fetchProfile(): Promise<Profile> {
  const variables = [
    "wind_speed_10m",
    "wind_direction_10m",
    "temperature_2m",
    "dewpoint_2m",
    "surface_pressure",
    ...LEVELS.flatMap((level) => [
      `geopotential_height_${level}hPa`,
      `wind_speed_${level}hPa`,
      `wind_direction_${level}hPa`,
      `temperature_${level}hPa`,
      `dewpoint_${level}hPa`,
    ]),
  ];
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${LATITUDE}&longitude=${LONGITUDE}` +
    `&hourly=${variables.join(",")}&models=gfs_seamless&wind_speed_unit=kn` +
    `&timezone=UTC&forecast_days=2`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`sounding request failed: ${response.status}`);
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
      tempC: at("temperature_2m"),
      dewpointC: at("dewpoint_2m"),
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
      tempC: at(`temperature_${level}hPa`),
      dewpointC: at(`dewpoint_${level}hPa`),
    });
  }

  if (rows.length < 3) {
    throw new Error("sounding returned too few levels");
  }

  rows.sort((a, b) => a.altFt - b.altFt);

  const hourLabel = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
    timeZoneName: "short",
  }).format(new Date(Date.parse(`${times[index]}:00Z`)));

  return { rows, hourLabel };
}

function SoundingChart({ profile }: { profile: Profile }) {
  const width = 620;
  const height = 640;
  const margin = { top: 20, right: 108, bottom: 44, left: 56 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  const rows = profile.rows;
  const maxAlt = Math.max(...rows.map((row) => row.altFt), 20000);
  const yMax = Math.ceil((maxAlt + 1200) / 5000) * 5000;

  const temperatures = rows
    .flatMap((row) => [row.tempC, row.dewpointC])
    .filter((value): value is number => value !== null);
  const tMin = Math.floor((Math.min(...temperatures) - 5) / 10) * 10;
  let tMax = Math.ceil((Math.max(...temperatures) + 5) / 10) * 10;
  if (tMax - tMin < 50) tMax = tMin + 50;

  const x = (tempC: number) => margin.left + ((tempC - tMin) / (tMax - tMin)) * plotW;
  const y = (altFt: number) =>
    margin.top + (1 - Math.min(altFt, yMax) / yMax) * plotH;

  const altitudeLines: number[] = [];
  for (let alt = 0; alt <= yMax; alt += 5000) altitudeLines.push(alt);
  const tempLines: number[] = [];
  for (let temp = tMin; temp <= tMax; temp += 10) tempLines.push(temp);

  const tempPolyline = rows
    .filter((row) => row.tempC !== null)
    .map((row) => `${x(row.tempC as number)},${y(row.altFt)}`)
    .join(" ");
  const dewPolyline = rows
    .filter((row) => row.dewpointC !== null)
    .map((row) => `${x(row.dewpointC as number)},${y(row.altFt)}`)
    .join(" ");

  const barbX = margin.left + plotW + 42;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="mt-2 w-full"
      role="img"
      aria-label={`Sounding for Gorham: temperature, dew point and winds from the surface to ${yMax.toLocaleString("en-US")} feet`}
    >
      {/* Altitude grid */}
      {altitudeLines.map((alt) => (
        <g key={`alt-${alt}`}>
          <line
            x1={margin.left}
            x2={margin.left + plotW}
            y1={y(alt)}
            y2={y(alt)}
            stroke={alt % 10000 === 0 ? "#e2e8f0" : "#f1f5f9"}
          />
          {alt % 10000 === 0 ? (
            <text
              x={margin.left - 8}
              y={y(alt) + 3.5}
              textAnchor="end"
              fontSize={10}
              fill="#64748b"
            >
              {alt.toLocaleString("en-US")} ft
            </text>
          ) : null}
        </g>
      ))}

      {/* Temperature grid */}
      {tempLines.map((temp) => (
        <g key={`t-${temp}`}>
          <line
            x1={x(temp)}
            x2={x(temp)}
            y1={margin.top}
            y2={margin.top + plotH}
            stroke={temp === 0 ? "#cbd5e1" : "#f1f5f9"}
          />
          <text x={x(temp)} y={height - margin.bottom + 18} textAnchor="middle" fontSize={10} fill="#64748b">
            {temp}
          </text>
        </g>
      ))}

      {/* Reference levels */}
      <line
        x1={margin.left}
        x2={margin.left + plotW}
        y1={y(SUMMIT_FT)}
        y2={y(SUMMIT_FT)}
        stroke="#94a3b8"
        strokeDasharray="4 3"
      />
      <text x={margin.left + 4} y={y(SUMMIT_FT) - 4} fontSize={9} fill="#94a3b8">
        Summit 6,288 ft
      </text>
      <line
        x1={margin.left}
        x2={margin.left + plotW}
        y1={y(CLASS_A_FT)}
        y2={y(CLASS_A_FT)}
        stroke="#94a3b8"
        strokeDasharray="4 3"
      />
      <text x={margin.left + 4} y={y(CLASS_A_FT) - 4} fontSize={9} fill="#94a3b8">
        Class A 18,000 ft
      </text>

      {/* Curves */}
      {dewPolyline ? (
        <polyline
          points={dewPolyline}
          fill="none"
          stroke="#0ea5e9"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
      ) : null}
      {tempPolyline ? (
        <polyline
          points={tempPolyline}
          fill="none"
          stroke="#ef4444"
          strokeWidth={2}
          strokeLinejoin="round"
        />
      ) : null}
      {rows.map((row) =>
        row.tempC !== null ? (
          <circle key={`tc-${row.hPa}`} cx={x(row.tempC)} cy={y(row.altFt)} r={2} fill="#ef4444" />
        ) : null,
      )}
      {rows.map((row) =>
        row.dewpointC !== null ? (
          <circle key={`dc-${row.hPa}`} cx={x(row.dewpointC)} cy={y(row.altFt)} r={2} fill="#0ea5e9" />
        ) : null,
      )}

      {/* Wind barbs */}
      {rows.map((row) => {
        const barb = barbGeometry(row.speedKt, row.dirDeg);
        return (
          <g
            key={`barb-${row.hPa}`}
            transform={`translate(${barbX} ${y(row.altFt)})`}
            stroke="#334155"
            strokeWidth={1.4}
            strokeLinecap="round"
            fill="none"
          >
            <title>{`${Math.round(row.speedKt)} kt from ${directionLetters(row.dirDeg)}`}</title>
            {barb.rounded === 0 ? (
              <circle r={3} />
            ) : (
              <>
                <line x1={0} y1={0} x2={barb.tip.x} y2={barb.tip.y} />
                {barb.pennants.map((points, index) => (
                  <polygon key={index} points={points} fill="#334155" stroke="none" />
                ))}
                {barb.marks.map((mark, index) => (
                  <line
                    key={index}
                    x1={mark.x1}
                    y1={mark.y1}
                    x2={mark.x2}
                    y2={mark.y2}
                  />
                ))}
              </>
            )}
          </g>
        );
      })}

      {/* Axis notes */}
      <text x={margin.left} y={12} fontSize={10} fill="#94a3b8">
        ft
      </text>
      <text x={margin.left + plotW} y={height - 6} textAnchor="end" fontSize={10} fill="#94a3b8">
        °C
      </text>
    </svg>
  );
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

  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5 sm:p-7">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-display text-xs font-semibold uppercase tracking-[0.28em] text-sky-700">
          Sounding
        </p>
        <p className="text-xs text-slate-400">
          {profile ? `${profile.hourLabel} · Gorham (2G8)` : "Gorham (2G8)"}
        </p>
      </div>

      {profile ? (
        <>
          <SoundingChart profile={profile} />
          <p className="mt-3 text-[11px] leading-5 text-slate-400">
            <span className="font-medium text-red-500">Temperature</span> and{" "}
            <span className="font-medium text-sky-500">dew point</span> in °C · wind barbs point into
            the wind: half = 5 kt, full = 10 kt, flag = 50 kt. Latest model run (GFS via Open-Meteo),
            refreshed hourly —{" "}
            <Link href="/links#weather" className="font-medium text-sky-700 hover:text-sky-600">
              more weather links
            </Link>
            .
          </p>
        </>
      ) : error ? (
        <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600 ring-1 ring-slate-900/5">
          The sounding is unavailable right now.{" "}
          <Link href="/links#weather" className="font-medium text-sky-700 hover:text-sky-600">
            Weather links
          </Link>
        </p>
      ) : (
        <div className="mt-5" aria-hidden="true">
          <div className="h-[26rem] animate-pulse rounded-2xl bg-slate-100" />
          <p className="mt-3 text-xs text-slate-400">Loading the latest sounding…</p>
        </div>
      )}
    </div>
  );
}
