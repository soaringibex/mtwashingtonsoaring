"use client";

import { useState } from "react";
import { FlightMarks } from "@/components/flights/icons";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { countsAsFlight, waveCampFlights, type WaveCampFlight } from "@/lib/wave-camp-flights";

/** The "high flights" filter: well above anything thermals or a tow reach here in October. */
const HIGH_FLIGHT_FT = 9000;

/** What the tables can be ordered by — altitude is the default, largest first. */
type SortColumn = "maxAltFt" | "distanceKm";
type Sort = { column: SortColumn; descending: boolean };

const HEADING_LABELS: Record<SortColumn, string> = {
  maxAltFt: "Max altitude",
  distanceKm: "Distance",
};
/** Shorter labels for the phone pills, where the table headings aren't on screen. */
const PILL_LABELS: Record<SortColumn, string> = { maxAltFt: "Altitude", distanceKm: "Distance" };

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
        <FlightMarks record={flight.record} ssa={flight.ssa} ssaPending={flight.ssaPending} />
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

/** Order by the chosen column (descending unless reversed); rows missing the
 * value always sink to the bottom rather than posing as zeros. */
function sortFlights(rows: WaveCampFlight[], sort: Sort): WaveCampFlight[] {
  const direction = sort.descending ? -1 : 1;
  return [...rows].sort((a, b) => {
    const av = a[sort.column];
    const bv = b[sort.column];
    if (av === null) return bv === null ? 0 : 1;
    if (bv === null) return -1;
    return (av - bv) * direction;
  });
}

/** A sortable heading — the arrow shows the active order, aria-sort tells the story. */
function SortHeader({
  column,
  sort,
  onSort,
  align = "left",
}: {
  column: SortColumn;
  sort: Sort;
  onSort: (column: SortColumn) => void;
  align?: "left" | "right";
}) {
  const active = sort.column === column;
  return (
    <th
      aria-sort={active ? (sort.descending ? "descending" : "ascending") : "none"}
      className={`py-3 pr-4 font-semibold ${align === "right" ? "text-right" : ""}`}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`group inline-flex items-center gap-1 transition-colors hover:text-slate-600 ${
          active ? "text-sky-700 hover:text-sky-600" : ""
        }`}
      >
        {HEADING_LABELS[column]}
        <span
          aria-hidden="true"
          className={`text-[13px] leading-none ${active ? "" : "text-slate-300 group-hover:text-slate-400"}`}
        >
          {active ? (sort.descending ? "↓" : "↑") : "↕"}
        </span>
      </button>
    </th>
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
          <FlightMarks record={flight.record} ssa={flight.ssa} ssaPending={flight.ssaPending} />
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
  const [highOnly, setHighOnly] = useState(false);
  const [sort, setSort] = useState<Sort>({ column: "maxAltFt", descending: true });

  /** Pick a column — descending first — or reverse the one already active. */
  const toggleSort = (column: SortColumn) =>
    setSort((current) =>
      current.column === column
        ? { column, descending: !current.descending }
        : { column, descending: true },
    );

  const flights = highOnly
    ? waveCampFlights.filter((f) => (f.maxAltFt ?? 0) > HIGH_FLIGHT_FT)
    : waveCampFlights;
  const years = [...new Set(flights.map((f) => f.date.slice(0, 4)))].sort().reverse();

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-pressed={!highOnly}
          onClick={() => setHighOnly(false)}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            highOnly ? "bg-slate-100 text-slate-600 hover:bg-slate-200" : "bg-sky-100 text-sky-800 ring-1 ring-sky-200"
          }`}
        >
          All flights
        </button>
        <button
          type="button"
          aria-pressed={highOnly}
          onClick={() => setHighOnly(true)}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            highOnly ? "bg-sky-100 text-sky-800 ring-1 ring-sky-200" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          Above {HIGH_FLIGHT_FT.toLocaleString("en-US")} ft
        </button>
        <span className="text-sm text-slate-500">
          {flights.filter(countsAsFlight).length}{" "}
          {flights.filter(countsAsFlight).length === 1 ? "flight" : "flights"} shown
        </span>
        {/* On phones the cards replace the table, so their heading can't carry the
            sort — these pills do, and follow the same state. */}
        <div className="flex items-center gap-2 sm:hidden">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            Sort
          </span>
          {(["maxAltFt", "distanceKm"] as const).map((column) => {
            const active = sort.column === column;
            return (
              <button
                key={column}
                type="button"
                aria-pressed={active}
                onClick={() => toggleSort(column)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-sky-100 text-sky-800 ring-1 ring-sky-200"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {PILL_LABELS[column]}
                {active ? (
                  <>
                    <span aria-hidden="true"> {sort.descending ? "↓" : "↑"}</span>
                    <span className="sr-only">, sorted {sort.descending ? "descending" : "ascending"}</span>
                  </>
                ) : null}
              </button>
            );
          })}
        </div>
        <ButtonLink href="/flights/3d" className="ml-auto">
          See every year in 3D →
        </ButtonLink>
      </div>

      <div className="mt-10 space-y-12">
        {years.map((year) => {
          const rows = sortFlights(
            flights.filter((f) => f.date.startsWith(year)),
            sort,
          );
          const counted = rows.filter(countsAsFlight);
          const pilots = new Set(
            rows.flatMap((f) => f.pilot.split(" & ").map((name) => name.trim())),
          ).size;
          const best = Math.max(...rows.map((f) => f.maxAltFt ?? 0));
          return (
            <section key={year}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                  {year}
                </h2>
                <p className="text-sm text-slate-500 tabular-nums">
                  {counted.length} {counted.length === 1 ? "flight" : "flights"} · {pilots}{" "}
                  {pilots === 1 ? "pilot" : "pilots"} · best {ftFormat.format(best)} ft
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
                        <SortHeader column="distanceKm" sort={sort} onSort={toggleSort} />
                        <SortHeader column="maxAltFt" sort={sort} onSort={toggleSort} align="right" />
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
              {rows.some((flight) => flight.ssaPending?.length) ? (
                <p className="mt-3 text-xs text-slate-500">
                  <span className="font-bold text-amber-700" aria-hidden="true">
                    *
                  </span>{" "}
                  Pending SSA validation.
                </p>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
