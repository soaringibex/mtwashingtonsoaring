import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { PageHero } from "@/components/ui/PageHero";
import { FlightArchive } from "@/components/flights/FlightArchive";

export const metadata: Metadata = {
  title: "Flights",
  description:
    "Every WeGlide-logged flight from the October wave camps at Gorham, 2016–2025 — with each flight's peak altitude, its badges and the state record — links straight to WeGlide.",
};

export default function FlightsPage() {
  return (
    <>
      <PageHero
        eyebrow="The camps, logged"
        title="Flights"
        lede="Every flight logged on WeGlide that took off from Gorham in the October camps, 2016 through 2025 — with the peak altitude each one reached, the badges it earned, and a link straight to its trace."
        image="/images/scenic/lenticular-wing.webp"
        imageAlt="A lenticular cloud seen past a glider's wing"
        priority
      />

      <section className="py-16 sm:py-20">
        <Container width="5xl">
          <div className="grid gap-3 rounded-3xl bg-slate-50 p-6 text-sm leading-6 text-slate-600 ring-1 ring-slate-900/5 sm:p-7">
            <p>
              <span className="font-semibold text-slate-900">What is here.</span> 229 flights took
              off from Gorham (2G8) in the camp Octobers of 2016–2025 and were logged on WeGlide —
              149 of them connected to the wave, and every one is in the tables below. The peak
              altitude is read from the flight&apos;s own GPS trace.
            </p>
            <p>
              <span className="font-semibold text-slate-900">The marks.</span>{" "}
              <span className="mr-1 inline-flex translate-y-0.5 items-center">
                <svg viewBox="0 0 24 24" className="size-4 text-sky-700" aria-hidden="true">
                  <circle cx="12" cy="14.5" r="6" fill="none" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M8.5 2.5l3.5 6 3.5-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              a medal means the flight collected a badge — a WeGlide achievement (Silver, Gold,
              Diamond, Astronaut…) or one of the club&apos;s altitude pins; hover to see which.{" "}
              <span className="mr-1 inline-flex translate-y-0.5 items-center">
                <svg viewBox="0 0 24 24" className="size-4 text-amber-600" aria-hidden="true">
                  <path d="M7 4h10v3.5a5 5 0 01-10 0z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                  <path d="M12 12.5v4M8.5 20h7l-.8-3.5h-5.4z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              a trophy marks a New Hampshire record. A <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700 ring-1 ring-sky-100">wave</span> tag
              means the trace shows the flight climbed to 2,500 m or more, or reached 2,000 m on a
              sustained wave climb well above the ridgeline — the flights without it took off in the
              camp but stayed on thermals and slope lift below the crest.
            </p>
            <p>
              <span className="font-semibold text-slate-900">One caveat.</span> Altitudes come from
              each flight&apos;s GPS trace and read a little high — the official 32,513 ft record day
              (Tim Chow, October 9, 2018) shows ~34,000 ft here. Treat the numbers as a comparison
              between flights, not as calibrated MSL. The record itself is on the{" "}
              <a href="/accomplishments" className="font-medium text-sky-700 hover:text-sky-600">
                accomplishments page
              </a>
              . Flights, badges and traces live on{" "}
              <a
                href="https://weglide.org"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-sky-700 hover:text-sky-600"
              >
                WeGlide
              </a>
              .
            </p>
          </div>

          <div className="mt-14">
            <FlightArchive />
          </div>
        </Container>
      </section>
    </>
  );
}
