"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/fetch-json";
import { localStampFrom } from "@/lib/wx-window";
import { cellFill, wMs, WaveLegend } from "@/components/weather/wave-field";

const SUMMIT = { lat: 44.2705, lon: -71.3032 };
/** Azimuth of the transect, degrees from north — NW (windward) to SE (lee) through the summit. */
const AZIMUTH = 125;
const STEP_KM = 2;
const DISTANCES = Array.from({ length: 14 }, (_, i) => -12 + i * STEP_KM);
const LEVELS = [950, 900, 850, 800, 700, 600, 500, 400, 300, 250, 200, 150];
const REFRESH_MS = 45 * 60 * 1000;
const FT_PER_M = 3.28084;

const COORDS = DISTANCES.map((d) => {
  const az = (AZIMUTH * Math.PI) / 180;
  const dLat = (Math.cos(az) * d) / 111;
  const dLon = (Math.sin(az) * d) / (111 * Math.cos((SUMMIT.lat * Math.PI) / 180));
  return { lat: SUMMIT.lat + dLat, lon: SUMMIT.lon + dLon };
});

type CrossLevel = {
  hPa: number;
  w: (number | null)[];
  altFt: (number | null)[];
};

type CrossPoint = { distanceKm: number; elevationFt: number; levels: CrossLevel[] };
type CrossData = { times: string[]; offsetSeconds: number; points: CrossPoint[]; defaultIndex: number };

async function fetchCrossSection(): Promise<CrossData> {
  const variables = LEVELS.flatMap((hPa) => [
    `vertical_velocity_${hPa}hPa`,
    `geopotential_height_${hPa}hPa`,
  ]);
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${COORDS.map((c) => c.lat.toFixed(4)).join(",")}` +
    `&longitude=${COORDS.map((c) => c.lon.toFixed(4)).join(",")}` +
    `&hourly=${variables.join(",")}&models=ncep_hrrr_conus` +
    `&temperature_unit=celsius&timezone=America%2FNew_York&forecast_days=2`;

  const data = (await fetchJson(url)) as unknown;
  const locations = (Array.isArray(data) ? data : [data]) as {
    elevation?: number;
    utc_offset_seconds?: number;
    hourly?: Record<string, (number | null)[]>;
  }[];
  const first = locations[0];
  const times = (first?.hourly?.time ?? []) as unknown as string[];
  if (locations.length !== COORDS.length || times.length === 0) {
    throw new Error("missing cross-section");
  }
  const offsetSeconds = first?.utc_offset_seconds ?? 0;

  const points: CrossPoint[] = locations.map((location, i) => {
    const hourly = location.hourly ?? {};
    return {
      distanceKm: DISTANCES[i],
      elevationFt: (location.elevation ?? 0) * FT_PER_M,
      levels: LEVELS.map((hPa) => ({
        hPa,
        w: hourly[`vertical_velocity_${hPa}hPa`] ?? [],
        altFt: (hourly[`geopotential_height_${hPa}hPa`] ?? []).map((z) =>
          typeof z === "number" ? z * FT_PER_M : null,
        ),
      })),
    };
  });

  // The hour containing now, resolved once here where the clock is allowed.
  const now = Date.now();
  let defaultIndex = 0;
  for (let i = 0; i < times.length; i += 1) {
    if (Date.parse(`${times[i]}:00Z`) - offsetSeconds * 1000 <= now) defaultIndex = i;
    else break;
  }

  return { times, offsetSeconds, points, defaultIndex };
}

/** The model's own vertical velocity along a ridge-normal transect through the summit. */
export function WaveCrossSection({ selectedTime }: { selectedTime: string | null }) {
  const [data, setData] = useState<CrossData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchCrossSection()
        .then((next) => {
          if (!cancelled) {
            setData(next);
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

  let index = data?.defaultIndex ?? 0;
  if (data && selectedTime) {
    const found = data.times.indexOf(selectedTime);
    if (found >= 0) index = found;
  }

  const W = 1000;
  const H = 330;
  const padL = 44;
  const padR = 12;
  const padT = 10;
  const padB = 30;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  let content: React.ReactNode = null;
  if (data) {
    const xMin = DISTANCES[0];
    const xMax = DISTANCES[DISTANCES.length - 1];
    const x = (d: number) => padL + ((d - xMin) / (xMax - xMin)) * plotW;

    const topAlt = Math.max(
      ...data.points.flatMap((point) =>
        point.levels.map((level) => level.altFt[index] ?? 0),
      ),
      10000,
    );
    const yMax = Math.ceil(Math.min(topAlt + 1500, 52000) / 5000) * 5000;
    const y = (altFt: number) =>
      padT + (1 - Math.min(Math.max(altFt, 0), yMax) / yMax) * plotH;

    const altTicks: number[] = [];
    for (let alt = 10000; alt <= yMax; alt += 10000) altTicks.push(alt);
    const distTicks = DISTANCES.filter((d) => d % 4 === 0);

    const cells: React.ReactNode[] = [];
    for (let i = 0; i < data.points.length - 1; i += 1) {
      const a = data.points[i];
      const b = data.points[i + 1];
      for (let j = 0; j < LEVELS.length - 1; j += 1) {
        const al = a.levels[j];
        const au = a.levels[j + 1];
        const bl = b.levels[j];
        const bu = b.levels[j + 1];
        const za0 = al.altFt[index];
        const za1 = au.altFt[index];
        const zb0 = bl.altFt[index];
        const zb1 = bu.altFt[index];
        if (za0 === null || za1 === null || zb0 === null || zb1 === null) continue;
        const corners = [
          wMs(al.w[index]),
          wMs(au.w[index]),
          wMs(bl.w[index]),
          wMs(bu.w[index]),
        ].filter((value): value is number => value !== null);
        if (corners.length === 0) continue;
        const w = corners.reduce((sum, value) => sum + value, 0) / corners.length;
        cells.push(
          <polygon
            key={`${i}-${j}`}
            points={`${x(a.distanceKm).toFixed(1)},${y(za0).toFixed(1)} ${x(b.distanceKm).toFixed(1)},${y(zb0).toFixed(1)} ${x(b.distanceKm).toFixed(1)},${y(zb1).toFixed(1)} ${x(a.distanceKm).toFixed(1)},${y(za1).toFixed(1)}`}
            className={cellFill(w)}
          />,
        );
      }
    }

    const terrainPoints = data.points
      .map((point) => `${x(point.distanceKm).toFixed(1)},${y(point.elevationFt).toFixed(1)}`)
      .join(" ");
    const terrainPath = `M ${x(xMin).toFixed(1)},${padT + plotH} L ${terrainPoints} L ${x(xMax).toFixed(1)},${padT + plotH} Z`;
    const peak = data.points.reduce((best, point) =>
      point.elevationFt > best.elevationFt ? point : best,
    );

    content = (
      <>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="mt-3 w-full"
          role="img"
          aria-label="Vertical velocity cross-section through Mount Washington"
        >
          {cells}
          {altTicks.map((alt) => (
            <g key={alt}>
              <line
                x1={padL}
                x2={W - padR}
                y1={y(alt)}
                y2={y(alt)}
                className="stroke-slate-900/10"
                strokeDasharray="4 4"
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={padL - 6}
                y={y(alt) + 3}
                textAnchor="end"
                className="fill-slate-400 text-[9px] tabular-nums"
              >
                {alt / 1000}k
              </text>
            </g>
          ))}
          <path d={terrainPath} className="fill-slate-300" />
          <text
            x={x(peak.distanceKm)}
            y={y(peak.elevationFt) - 5}
            textAnchor="middle"
            className="fill-slate-500 text-[9px]"
          >
            {peak.distanceKm === 0 ? "Mt Washington" : "Presidential Range"}
          </text>
          {distTicks.map((d) => (
            <text
              key={d}
              x={x(d)}
              y={H - 8}
              textAnchor="middle"
              className="fill-slate-400 text-[9px] tabular-nums"
            >
              {d > 0 ? `+${d}` : d}
            </text>
          ))}
          <text
            x={padL + plotW / 2}
            y={H - 8}
            textAnchor="middle"
            className="fill-slate-400 text-[9px]"
          >
            km from the summit · NW (windward) to SE (lee)
          </text>
          <text x={padL - 6} y={padT + 8} textAnchor="end" className="fill-slate-400 text-[9px]">
            ft
          </text>
        </svg>
        <WaveLegend />
      </>
    );
  }

  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5 sm:p-7">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-display text-xs font-semibold uppercase tracking-[0.28em] text-sky-700">
          Wave field · cross-section
        </p>
        <p className="text-xs text-slate-400">
          {data ? `${localStampFrom(data.times[index], data.offsetSeconds)} · HRRR` : "HRRR"}
        </p>
      </div>

      {data ? (
        <>
          {content}
          <p className="mt-3 text-[11px] leading-5 text-slate-400">
            The model&apos;s own vertical velocity along the line through the summit, grey being
            the model terrain — follows the hour selected above. Warm colours are lift, blue is
            sink; the ridge-normal transect runs about 26 km from the Great Gulf side across to
            Bartlett.
          </p>
        </>
      ) : error ? (
        <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600 ring-1 ring-slate-900/5">
          The cross-section is unavailable right now.{" "}
          <a
            href="https://open-meteo.com/"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-sky-700 hover:text-sky-600"
          >
            Open-Meteo
          </a>
        </p>
      ) : (
        <div className="mt-4 grid gap-2" aria-hidden="true">
          <div className="h-[300px] animate-pulse rounded-2xl bg-slate-100" />
        </div>
      )}
    </div>
  );
}
