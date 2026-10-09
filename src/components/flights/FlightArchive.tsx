"use client";

import { useState } from "react";
import { FlightMarks } from "@/components/flights/icons";
import { waveCampFlights, type WaveCampFlight } from "@/lib/wave-camp-flights";

const ftFormat = new Intl.NumberFormat("en-US");

function formatDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1];
  void y;
  return `${month} ${d}`;
}

function formatDuration(minutes: number | null): string {
  if (minutes === null) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

function Row({ flight }: { flight: WaveCampFlight }) {
  return (
    <tr className="border-t border-slate-100 text-slate-600">
      <td className="whitespace-nowrap py-2.5 pr-4 tabular-nums">{formatDate(flight.date)}</td>
      <td className="py-2.5 pr-4 font-medium text-slate-900">{flight.pilot}</td>
      <td className="py-2.5 pr-4">{flight.aircraft ?? "—"}</td>
      <td className="whitespace-nowrap py-2.5 pr-4 tabular-nums">{formatDuration(flight.minutes)}</td>
      <td className="whitespace-nowrap py-2.5 pr-4 tabular-nums">
        {flight.distanceKm !== null ? `${flight.distanceKm.toFixed(1)} km` : "—"}
      </td>
      <td className="whitespace-nowrap py-2.5 pr-4 text-right tabular-nums">
        {flight.maxAltFt !== null ? `${ftFormat.format(flight.maxAltFt)} ft` : "—"}
      </td>
      <td className="py-2.5 pr-4">
        <FlightMarks wave={flight.wave} record={flight.record} ssa={flight.ssa} />
      </td>
      <td className="whitespace-nowrap py-2.5 text-right">
        <a
          href={`https://weglide.org/flight/${flight.id}`}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-sky-700 hover:text-sky-600"
        >
          WeGlide ↗
        </a>
      </td>
    </tr>
  );
}

/** The same flight as a card, for phones — no sideways scrolling. */
function MobileRow({ flight }: { flight: WaveCampFlight }) {
  return (
    <li className="flex items-start justify-between gap-4 border-t border-slate-100 px-4 py-3 first:border-t-0">
      <div className="min-w-0">
        <p className="font-medium text-slate-900">{flight.pilot}</p>
        <p className="mt-0.5 text-xs leading-5 text-slate-500">
          {formatDate(flight.date)} · {flight.aircraft ?? "—"} · {formatDuration(flight.minutes)}
          {flight.distanceKm !== null ? ` · ${flight.distanceKm.toFixed(1)} km` : ""}
        </p>
        <p className="mt-1.5 flex flex-wrap items-center gap-2">
          <FlightMarks wave={flight.wave} record={flight.record} ssa={flight.ssa} />
          <a
            href={`https://weglide.org/flight/${flight.id}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-medium text-sky-700 hover:text-sky-600"
          >
            WeGlide ↗
          </a>
        </p>
      </div>
      <p className="shrink-0 text-right text-sm font-medium tabular-nums text-slate-900">
        {flight.maxAltFt !== null ? `${ftFormat.format(flight.maxAltFt)} ft` : "—"}
      </p>
    </li>
  );
}

export function FlightArchive() {
  const [waveOnly, setWaveOnly] = useState(false);

  const flights = waveOnly ? waveCampFlights.filter((f) => f.wave) : waveCampFlights;
  const years = [...new Set(flights.map((f) => f.date.slice(0, 4)))].sort().reverse();

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-pressed={!waveOnly}
          onClick={() => setWaveOnly(false)}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            waveOnly ? "bg-slate-100 text-slate-600 hover:bg-slate-200" : "bg-sky-100 text-sky-800 ring-1 ring-sky-200"
          }`}
        >
          All flights
        </button>
        <button
          type="button"
          aria-pressed={waveOnly}
          onClick={() => setWaveOnly(true)}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            waveOnly ? "bg-sky-100 text-sky-800 ring-1 ring-sky-200" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          Wave flights only
        </button>
        <span className="text-sm text-slate-500">
          {flights.length} {flights.length === 1 ? "flight" : "flights"} shown
        </span>
      </div>

      <div className="mt-10 space-y-12">
        {years.map((year) => {
          const rows = flights
            .filter((f) => f.date.startsWith(year))
            .sort((a, b) => (b.maxAltFt ?? 0) - (a.maxAltFt ?? 0));
          const pilots = new Set(rows.map((f) => f.pilot)).size;
          const wave = rows.filter((f) => f.wave).length;
          const best = Math.max(...rows.map((f) => f.maxAltFt ?? 0));
          return (
            <section key={year}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                  {year}
                </h2>
                <p className="text-sm text-slate-500 tabular-nums">
                  {rows.length} {rows.length === 1 ? "flight" : "flights"} · {pilots}{" "}
                  {pilots === 1 ? "pilot" : "pilots"} · {wave} wave · best {ftFormat.format(best)} ft
                </p>
              </div>
              <div className="mt-4 overflow-hidden rounded-2xl border border-slate-900/5 bg-white shadow-sm">
                <ul className="sm:hidden">
                  {rows.map((flight) => (
                    <MobileRow key={flight.id} flight={flight} />
                  ))}
                </ul>
                <div className="hidden overflow-x-auto sm:block">
                  <table className="w-full min-w-[46rem] text-left text-sm">
                    <thead>
                      <tr className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        <th className="py-3 pl-4 pr-4 font-semibold">Date</th>
                        <th className="py-3 pr-4 font-semibold">Pilot</th>
                        <th className="py-3 pr-4 font-semibold">Aircraft</th>
                        <th className="py-3 pr-4 font-semibold">Time</th>
                        <th className="py-3 pr-4 font-semibold">Distance</th>
                        <th className="py-3 pr-4 text-right font-semibold">Max altitude</th>
                        <th className="py-3 pr-4 font-semibold">Marks</th>
                        <th className="py-3 pr-4 text-right font-semibold" />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((flight) => (
                        <Row key={flight.id} flight={flight} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
