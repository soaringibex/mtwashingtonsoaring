import type { Metadata } from "next";
import Link from "next/link";
import { WindProfile } from "@/components/home/WindProfile";
import { SummitHourly } from "@/components/weather/SummitHourly";
import { WaveForecast } from "@/components/weather/WaveForecast";
import { Container } from "@/components/ui/Container";
import { PageHero } from "@/components/ui/PageHero";
import { SectionHeading } from "@/components/ui/SectionHeading";

export const metadata: Metadata = {
  title: "Wx Brief",
  description:
    "The day's wave forecast for Mount Washington — a Scorer-parameter wave signal, the live column of wind aloft, the summit forecast hour by hour, and the forecasts to read before you fly.",
};

const forecastLinks = [
  {
    title: "Observatory forecast",
    href: "https://mountwashington.org/weather/regional-weather/",
    description:
      "Mount Washington Observatory's regional forecast — including the outlook for the higher summits.",
  },
  {
    title: "Summit conditions right now",
    href: "https://mountwashington.org/weather/mount-washington-weather/",
    description: "The station's live observation from the summit — what the mountain is doing now.",
  },
  {
    title: "NWS point forecast",
    href: "https://forecast.weather.gov/MapClick.php?lat=44.2705&lon=-71.3032",
    description: "The National Weather Service forecast for the summit itself.",
  },
] as const;

export default function WxPage() {
  return (
    <>
      <PageHero
        eyebrow="Weather · briefing"
        title="Wx Brief"
        lede="What the model has the wind doing over the mountain today — a wave signal built on the Scorer parameter, the column of wind aloft, and the summit forecast hour by hour."
        image="/images/scenic/lenticular-wing.webp"
        imageAlt="A lenticular cloud over the Presidential Range seen from a glider"
        priority
      />

      <section className="py-16 sm:py-20">
        <Container>
          <SectionHeading
            eyebrow="Aloft"
            title="The column of wind"
            lede="Wave days are written in the vertical wind profile — a steady cross-ridge flow at altitude, with stable air through the layer. This is the live column over Mount Washington from the latest model run."
          />
          <div className="mt-10 grid items-start gap-6 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            <WindProfile />
            <SummitHourly />
          </div>
        </Container>
      </section>

      <section className="bg-slate-50 py-16 sm:py-20">
        <Container>
          <SectionHeading
            eyebrow="The day's wave"
            title="Wave signal"
            lede="A model-based reading of the day's wave potential, built on the Scorer parameter — the atmosphere's stability against the wind, written N²/U², and the way it falls with height. A falling Scorer over a steady cross-ridge flow is what lets Mount Washington's lee wave reach the flight levels."
          />
          <div className="mt-10">
            <WaveForecast />
          </div>
        </Container>
      </section>

      <section className="py-16 sm:py-20">
        <Container>
          <SectionHeading
            eyebrow="Look further"
            title="Forecasts and observations"
            lede="The higher-summits forecast is the one to read before committing to a launch; the station observation tells you what the mountain is doing right now. And watch the window — see Mind the window on the flying page."
          />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {forecastLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="group flex h-full flex-col rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5 transition hover:shadow-md"
              >
                <span className="flex items-baseline justify-between gap-4">
                  <span className="font-display text-base font-semibold text-slate-900 group-hover:text-sky-700">
                    {link.title}
                  </span>
                  <span
                    aria-hidden="true"
                    className="text-slate-400 transition-colors group-hover:text-sky-600"
                  >
                    ↗
                  </span>
                </span>
                <span className="mt-2 text-sm leading-7 text-slate-600">{link.description}</span>
              </a>
            ))}
            <Link
              href="/more#weather"
              className="group flex h-full flex-col rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5 transition hover:shadow-md"
            >
              <span className="flex items-baseline justify-between gap-4">
                <span className="font-display text-base font-semibold text-slate-900 group-hover:text-sky-700">
                  All weather links
                </span>
                <span
                  aria-hidden="true"
                  className="text-slate-400 transition-colors group-hover:text-sky-600"
                >
                  →
                </span>
              </span>
              <span className="mt-2 text-sm leading-7 text-slate-600">
                The Observatory&apos;s other products, and the rest of the links worth having for a
                wave day.
              </span>
            </Link>
          </div>
        </Container>
      </section>
    </>
  );
}
