import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { FlightGlobe3D } from "@/components/flights/FlightGlobe3D";

export const metadata: Metadata = {
  title: "Flights in 3D",
  description:
    "Every wave-camp flight of each October, 2016–2025, drawn as a three-dimensional track over the White Mountains — orbit the year and see where the wave carried them.",
};

export default function Flights3DPage() {
  return (
    <section className="bg-slate-50 py-12 sm:py-16">
      <Container>
        <p className="font-display text-xs font-semibold uppercase tracking-[0.3em] text-sky-700">
          The camps, in three dimensions
        </p>
        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Flights in 3D
          </h1>
          <Link href="/flights" className="text-sm font-medium text-sky-700 hover:text-sky-600">
            ← The flight archive
          </Link>
        </div>
        <p className="mt-3 max-w-3xl text-[1.0625rem] leading-8 text-slate-600">
          Pick a year: every flight logged from Gorham that October is drawn as a track through the
          atmosphere, coloured by the altitude it reached. The wave flights stand out bright —
          long climbs climbing straight up the lee of the range — while the thermal afternoons
          stay dim below the ridgelines.
        </p>

        <div className="mt-8">
          <FlightGlobe3D />
        </div>

        <p className="mt-6 max-w-3xl text-[11px] leading-5 text-slate-400">
          Terrain from the same AWS tile mosaic the wave map draws; tracks decimated from each
          flight&apos;s WeGlide GPS trace (about one point per minute) and raised 1.5× vertically
          so the climbing reads. Altitudes are GPS and read a little high. Flights and traces live
          on{" "}
          <a href="https://weglide.org" target="_blank" rel="noreferrer" className="font-medium text-sky-700 hover:text-sky-600">
            WeGlide
          </a>
          ; the badges and the archive are on the{" "}
          <Link href="/flights" className="font-medium text-sky-700 hover:text-sky-600">
            flights page
          </Link>
          .
        </p>
      </Container>
    </section>
  );
}
