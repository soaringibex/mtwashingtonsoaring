import type { Metadata } from "next";
import Link from "next/link";
import { DashboardHeader } from "@/components/weather/DashboardHeader";
import { FieldReports } from "@/components/weather/FieldReports";
import { WavePanel } from "@/components/weather/WavePanel";
import { WindPanel } from "@/components/weather/WindPanel";
import { Container } from "@/components/ui/Container";

export const metadata: Metadata = {
  title: "Wx Brief",
  description:
    "The day's wave forecast for Mount Washington — a Scorer-parameter wave signal, the live column of wind aloft, the summit forecast hour by hour, nearby field reports, and the forecasts to read before you fly.",
};

const forecastLinks = [
  {
    title: "Observatory forecast",
    href: "https://mountwashington.org/weather/regional-weather/",
  },
  {
    title: "Summit conditions",
    href: "https://mountwashington.org/weather/mount-washington-weather/",
  },
  {
    title: "NWS point forecast",
    href: "https://forecast.weather.gov/MapClick.php?lat=44.2705&lon=-71.3032",
  },
] as const;

export default function WxPage() {
  return (
    <>
      <DashboardHeader />

      <div className="bg-slate-50 py-10 sm:py-12">
        <Container>
          <div className="grid gap-6">
            <section
              aria-label="Disclaimer"
              className="rounded-3xl bg-amber-50 p-6 ring-1 ring-amber-200/80 sm:p-7"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-display text-xs font-semibold uppercase tracking-[0.28em] text-amber-800">
                  Experimental — not for flight planning
                </p>
                <p className="text-xs text-amber-700/80">read this first</p>
              </div>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-amber-900">
                The Wx Brief is an experiment built by club members for the fun of looking at the
                wave — not a weather service, and not a briefing. Its wave views are research-grade
                estimates (the linear-theory field in particular can be wrong in both directions),
                and everything here is only as good as the models behind it. For any flight, use
                an official briefing, the winds and temperatures aloft forecast, the observatory
                and field reports, and your own judgment — never this page alone.
              </p>
            </section>

            <WavePanel />

            <WindPanel />

            <FieldReports />

            <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5 sm:p-7">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-display text-xs font-semibold uppercase tracking-[0.28em] text-sky-700">
                  Reference
                </p>
                <p className="text-xs text-slate-400">forecasts &amp; observations</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {forecastLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-sky-50 hover:text-sky-700"
                  >
                    {link.title}
                    <span aria-hidden="true" className="text-slate-400">
                      ↗
                    </span>
                  </a>
                ))}
                <Link
                  href="/more#weather"
                  className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-sky-50 hover:text-sky-700"
                >
                  All weather links
                  <span aria-hidden="true" className="text-slate-400">
                    →
                  </span>
                </Link>
              </div>
            </section>
          </div>
        </Container>
      </div>
    </>
  );
}
