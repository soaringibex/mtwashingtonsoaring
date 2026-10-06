"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/fetch-json";

const REFRESH_MS = 10 * 60 * 1000;

type FieldReport = {
  icaoId: string;
  raw: string;
  observedAt: string;
  flightCategory: string | null;
  windDirDeg: number | null;
  windKt: number | null;
  gustKt: number | null;
  visibility: string | null;
  ceilingFt: number | null;
  tempC: number | null;
  altimInHg: number | null;
};

type TafReport = {
  icaoId: string;
  raw: string;
  issuedAt: string | null;
  validFrom: string | null;
  validTo: string | null;
};

type Reports = { metars: FieldReport[]; taf: TafReport | null };

const STATIONS: Record<string, { name: string; distance: string }> = {
  KMWN: { name: "Mount Washington", distance: "summit · 8 nm S" },
  KBML: { name: "Berlin Regional", distance: "≈11 nm N" },
  KHIE: { name: "Whitefield Regional", distance: "≈15 nm W" },
  KIZG: { name: "Fryeburg", distance: "≈28 nm SSE" },
  KCON: { name: "Concord", distance: "≈95 nm S" },
  KPWM: { name: "Portland Intl", distance: "≈55 nm SE" },
};

function categoryBadge(category: string | null): string {
  switch (category) {
    case "VFR":
      return "bg-emerald-50 text-emerald-700 ring-emerald-600/20";
    case "MVFR":
      return "bg-sky-50 text-sky-700 ring-sky-600/20";
    case "IFR":
      return "bg-red-50 text-red-700 ring-red-600/20";
    case "LIFR":
      return "bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-600/20";
    default:
      return "bg-slate-100 text-slate-500 ring-slate-500/20";
  }
}

/** "Oct 6 · 13:52Z" — aviation convention. */
function formatZ(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const day = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  }).format(date);
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
  return `${day} · ${time}Z`;
}

function ceilingLabel(feet: number | null): string {
  if (feet === null) return "no ceiling";
  if (feet <= 0) return "obscured";
  return `ceiling ${feet.toLocaleString("en-US")} ft`;
}

export function FieldReports() {
  const [reports, setReports] = useState<Reports | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchJson("/api/field-reports")
        .then((next) => {
          if (!cancelled) {
            setReports(next as Reports);
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

  const latest = reports?.metars.reduce<string | null>(
    (best, metar) => (best === null || metar.observedAt > best ? metar.observedAt : best),
    null,
  );

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5 sm:p-7">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-display text-xs font-semibold uppercase tracking-[0.28em] text-sky-700">
            Nearby fields · METAR
          </p>
          <p className="text-xs text-slate-400">
            {latest ? `as of ${formatZ(latest)}` : "NOAA Aviation Weather Center"}
          </p>
        </div>

        {reports ? (
          <>
            <div className="mt-4 divide-y divide-slate-100">
              {reports.metars.map((metar) => {
                const station = STATIONS[metar.icaoId];
                const gust =
                  metar.gustKt !== null && metar.windKt !== null && metar.gustKt - metar.windKt >= 3
                    ? ` G${metar.gustKt}`
                    : metar.gustKt !== null && metar.windKt === null
                      ? ` G${metar.gustKt}`
                      : "";
                const wind =
                  metar.windKt === null
                    ? "calm / unavailable"
                    : `${metar.windDirDeg !== null ? `${Math.round(metar.windDirDeg)}° ` : ""}${metar.windKt} kt${gust}`;
                return (
                  <div
                    key={metar.icaoId}
                    className="grid gap-2 py-3.5 first:pt-0 last:pb-0 sm:grid-cols-[12rem_minmax(0,1fr)]"
                  >
                    <div>
                      <p className="flex items-center gap-2">
                        <span className="font-display text-sm font-bold text-slate-900">
                          {metar.icaoId}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${categoryBadge(metar.flightCategory)}`}
                        >
                          {metar.flightCategory ?? "—"}
                        </span>
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {station?.name ?? metar.icaoId} · {station?.distance ?? ""}
                      </p>
                    </div>
                    <div>
                      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs tabular-nums text-slate-600">
                        <span className="flex items-center gap-1.5">
                          {metar.windDirDeg !== null && metar.windKt !== null ? (
                            <svg
                              viewBox="0 0 24 24"
                              aria-hidden="true"
                              className="size-3.5 text-sky-600"
                              style={{ transform: `rotate(${metar.windDirDeg + 180}deg)` }}
                            >
                              <path d="M12 3.5 18 19l-6-3-6 3z" fill="currentColor" />
                            </svg>
                          ) : null}
                          <span className="font-semibold text-slate-800">{wind}</span>
                        </span>
                        {metar.visibility ? <span>vis {metar.visibility} SM</span> : null}
                        <span>{ceilingLabel(metar.ceilingFt)}</span>
                        {metar.tempC !== null ? <span>{metar.tempC}°C</span> : null}
                        {metar.altimInHg !== null ? <span>{metar.altimInHg.toFixed(2)}&quot;</span> : null}
                      </p>
                      <p className="mt-1.5 font-mono text-[10px] leading-4 text-slate-400">
                        {metar.raw}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-4 text-[11px] leading-5 text-slate-400">
              Gorham (2G8) has no weather station — these are the nearest reporting fields,
              refreshed every 10 minutes.
            </p>
          </>
        ) : error ? (
          <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600 ring-1 ring-slate-900/5">
            The field reports are unavailable right now.{" "}
            <a
              href="https://aviationweather.gov"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-sky-700 hover:text-sky-600"
            >
              Aviation Weather Center
            </a>
          </p>
        ) : (
          <div className="mt-4 grid gap-3" aria-hidden="true">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-14 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        )}
      </div>

      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5 sm:p-7">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-display text-xs font-semibold uppercase tracking-[0.28em] text-sky-700">
            Terminal forecast · TAF
          </p>
          {reports?.taf ? (
            <p className="text-xs text-slate-400">
              nearest · {STATIONS[reports.taf.icaoId]?.name ?? reports.taf.icaoId}
            </p>
          ) : null}
        </div>

        {reports?.taf ? (
          <>
            <p className="mt-4 text-xs leading-5 text-slate-500">
              <span className="font-semibold text-slate-700">{reports.taf.icaoId}</span>
              {STATIONS[reports.taf.icaoId] ? ` · ${STATIONS[reports.taf.icaoId].name}` : ""}
              <br />
              issued {formatZ(reports.taf.issuedAt)} · valid {formatZ(reports.taf.validFrom)} →{" "}
              {formatZ(reports.taf.validTo)}
            </p>
            <p className="mt-3 whitespace-pre-wrap font-mono text-[11px] leading-5 text-slate-600">
              {reports.taf.raw}
            </p>
            <p className="mt-4 text-[11px] leading-5 text-slate-400">
              Whitefield is the closest field that issues a terminal forecast; Berlin and
              Fryeburg do not.
            </p>
          </>
        ) : error ? (
          <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600 ring-1 ring-slate-900/5">
            The terminal forecast is unavailable right now.
          </p>
        ) : (
          <div className="mt-4 grid gap-3" aria-hidden="true">
            <div className="h-16 animate-pulse rounded-2xl bg-slate-100" />
            <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
          </div>
        )}
      </div>
    </div>
  );
}
