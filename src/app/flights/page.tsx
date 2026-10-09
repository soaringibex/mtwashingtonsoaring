import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { PageHero } from "@/components/ui/PageHero";
import { FlightArchive } from "@/components/flights/FlightArchive";
import { BadgeIcon, DiamondIcon, RecordIcon, WavePill } from "@/components/flights/icons";
import {
  countsAsFlight,
  WAVE_CLIMB_M,
  WAVE_HIGH_TOP_M,
  WAVE_STRAIGHT_TOP_M,
  waveCampFlights,
} from "@/lib/wave-camp-flights";

export const metadata: Metadata = {
  title: "Flights",
  description:
    "Every WeGlide-logged flight from the October wave camps at Gorham, 2016–2025 — with each flight's peak altitude, its badges and the state record — links straight to WeGlide.",
};

export default function FlightsPage() {
  const flights = waveCampFlights.filter(countsAsFlight);
  const waveCount = flights.filter((flight) => flight.wave).length;
  const toFt = (m: number) => (Math.round((m * 3.28084) / 100) * 100).toLocaleString("en-US");

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
              <span className="font-semibold text-slate-900">What is here.</span>{" "}
              {flights.length} flights took off from Gorham (2G8) in the camp Octobers of
              2016–2025 and were logged on WeGlide — {waveCount} of them connected to the wave, and
              every one is in the tables below (a two-seat flight both pilots logged appears under
              each name but counts once). The peak altitude is read from the flight&apos;s own
              GPS trace.
            </p>
            <p>
              <span className="font-semibold text-slate-900">The marks.</span>{" "}
              <span className="mr-1 inline-flex translate-y-0.5 items-center">
                <WavePill />
              </span>
              a wave tag means the flight&apos;s own engine-free flying — after release, with any
              engine run left out — caught the wave: either it climbed at least{" "}
              {toFt(WAVE_CLIMB_M)} feet in ten minutes of straight flight, without circling, to above
              {" "}{toFt(WAVE_STRAIGHT_TOP_M)} feet — well over the summit, where ridge lift and
              thermals don&apos;t reach — or it got above {toFt(WAVE_HIGH_TOP_M)} feet, which October
              thermals and tows never do. Straight flight can only be read from loggers that stamp
              every fix; phone-app logs are judged on height alone.{" "}
              <span className="mr-1 inline-flex translate-x-1 translate-y-0.5 items-center">
                <BadgeIcon label="SSA Gold" />
              </span>
              <span className="mr-1 inline-flex translate-y-0.5 items-center">
                <DiamondIcon label="SSA Diamond" />
              </span>
              a gold medal or diamond marks the rare flight that earned its pilot an SSA badge —
              Gold or Diamond — checked against the SSA badge database, where the award date lands
              on the flight. WeGlide&apos;s own stickers and pilot-mileage badges are left off.{" "}
              <span className="mr-1 inline-flex translate-y-0.5 items-center">
                <RecordIcon label="A record" />
              </span>
              a trophy marks a New Hampshire record.
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
