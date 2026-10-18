import Image from "next/image";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { DocCard } from "@/components/ui/DocCard";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { gorham } from "@/lib/flying";
import { Placeholder } from "./DraftShared";

export function DuringStage() {
  return (
    <div className="space-y-16 sm:space-y-20">
      <section>
        <p className="max-w-3xl text-xl leading-9 text-slate-700">
          What you need on your phone each morning.
        </p>
      </section>

      <section>
        <SectionHeading title="Daily rhythm" />
        <div className="mt-6 max-w-3xl">
          <Placeholder topic="the daily rhythm (pilots' meeting time and place, launch grid, tow signup)" />
        </div>
      </section>

      <section>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
          <div>
            <SectionHeading
              eyebrow="Weather judgment"
              title="Mind the window"
              lede="The wave lives and dies with its window. A day that looks flyable can close overhead within minutes — the question is never whether you are high enough, but whether you can still get down."
            />
            <p className="mt-6 text-[1.0625rem] leading-8 text-slate-700">
              Above 18,000 feet, watch for the upstream openings: if the way in from the west is
              still clear, you have time. Below that — or on any day when the upstream sky has gone
              flat — you may get very little warning before the window snaps shut. Keep the
              downwind escape over Maine in mind as an option rather than a last resort, and choose
              it while you are still high, not once you are on the cloud tops. The camp&apos;s
              briefings put it shorter still: if it is not clear downwind, don&apos;t go up.
            </p>
            <div className="mt-7">
              <ButtonLink href="/wx">Wavecast: today&apos;s forecast</ButtonLink>
            </div>
          </div>
          <div className="space-y-6">
            <figure className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-900/5">
              <Image
                src="/images/gallery/2025/undercast-to-the-horizon.jpg"
                alt="A sea of undercast stretching to the horizon, seen from the wing of a glider"
                width={1600}
                height={1205}
                className="w-full"
              />
              <figcaption className="border-t border-slate-100 px-5 py-3.5 text-sm text-slate-600">
                Undercast to the horizon from the wave — October 2025.
              </figcaption>
            </figure>

            <figure className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-900/5">
              <picture>
                <source
                  media="(prefers-reduced-motion: reduce)"
                  srcSet="/images/scenic/sky-closing-still.webp"
                />
                <Image
                  src="/images/scenic/sky-closing-2026.webp"
                  alt="A timelapse of the sky closing over the ridge — the blue autumn sky giving way to a solid deck of cloud"
                  width={800}
                  height={450}
                  unoptimized
                  className="w-full"
                />
              </picture>
              <figcaption className="border-t border-slate-100 px-5 py-3.5 text-sm text-slate-600">
                The sky closing over the ridge — Rick Roelke&apos;s timelapse from the 2026 camp.
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      <section>
        <SectionHeading title="Altitude safety in brief" />
        <ul className="mt-8 grid gap-3">
          <li className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-900/5">
            <p className="font-display text-base font-semibold text-slate-900">
              Oxygen above 12,500 ft.
            </p>
          </li>
          <li className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-900/5">
            <p className="font-display text-base font-semibold text-slate-900">
              Recognize hypoxia.
            </p>
            <p className="mt-1 text-sm leading-7 text-slate-600">
              The full article is in{" "}
              <a
                href="#before"
                className="font-medium text-sky-700 underline underline-offset-4 hover:text-sky-600"
              >
                Before
              </a>
              .
            </p>
          </li>
          <li className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-900/5">
            <p className="font-display text-base font-semibold text-slate-900">
              After any DCS symptoms, stand down at least three days.
            </p>
            <p className="mt-1 text-sm leading-7 text-slate-600">
              The three-part series is in{" "}
              <a
                href="#after"
                className="font-medium text-sky-700 underline underline-offset-4 hover:text-sky-600"
              >
                After
              </a>
              .
            </p>
          </li>
        </ul>
      </section>

      <section>
        <SectionHeading title="The airport" />
        <div className="mt-6 max-w-3xl space-y-4 text-[1.0625rem] leading-8 text-slate-700">
          <p>
            Pattern procedures and the parking map are in{" "}
            <a
              href="#before"
              className="font-medium text-sky-700 underline underline-offset-4 hover:text-sky-600"
            >
              Before
            </a>
            . The signed LOA original is kept at the field.
          </p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <DocCard doc={gorham[1]} />
        </div>
      </section>

      <section>
        <SectionHeading
          eyebrow="Going somewhere"
          title="Going further"
          lede="When flagpole sitting in wave becomes routine, the area offers meaningful cross-country routes — but the landing options on the northern routes are sparse and sometimes distant from the course line."
        />

        <figure className="mt-8 max-w-4xl overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-900/5">
          <a
            href="/images/reading/mthays-transition-full.png"
            target="_blank"
            rel="noreferrer"
            className="block"
          >
            <Image
              src="/images/reading/mthays-transition.webp"
              alt="Trace showing a 45-minute diamond climb from Mt Hays to the primary wave"
              width={1055}
              height={424}
              className="w-full"
            />
          </a>
          <figcaption className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-6 py-4">
            <span className="text-sm text-slate-600">
              45-minute diamond — Mt Hays to primary transition example.
            </span>
            <span className="flex gap-4 text-sm font-medium">
              <a href="/files/45-minute-diamond.igc" className="text-sky-700 hover:text-sky-600">
                Download IGC
              </a>
              <a
                href="https://igcviewer.bgaladder.net"
                target="_blank"
                rel="noreferrer"
                className="text-sky-700 hover:text-sky-600"
              >
                Open in IGC viewer
              </a>
            </span>
          </figcaption>
        </figure>

        <div className="mt-14 max-w-3xl">
          <h3 className="font-display text-2xl font-bold tracking-tight text-slate-900">
            Wave cross-country flights
          </h3>
          <p className="mt-4 text-sm leading-7 text-slate-600">
            The original “Mt. Washington Area Wave Cross-Country Glider Flights” document describes
            some possible routes. Not only the condition, but even the existence of some of the
            reported landing areas must be confirmed before attempting these routes. The original
            file has not been recovered.
          </p>
        </div>
      </section>

      <section>
        <SectionHeading title="Emergency contacts" />
        <div className="mt-6 max-w-3xl">
          <Placeholder topic="emergency contacts (camp coordinator, airport, nearest hospital with a hyperbaric chamber)" />
        </div>
      </section>
    </div>
  );
}
