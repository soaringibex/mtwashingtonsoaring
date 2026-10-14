import type { Metadata } from "next";
import Image from "next/image";
import type { ReactNode } from "react";
import { FlightScrollStory } from "@/components/flights/FlightScrollStory";
import { Container } from "@/components/ui/Container";
import { PHASE_COLORS, PHASE_SHORT } from "@/lib/flight-phases";

export const metadata: Metadata = {
  title: "Three ways into the wave",
  description:
    "Monday's flight at the 2026 Gorham camp, told as a scroll: a tow that didn't connect, a low save down to 1,857 ft on the Moriah–Carter ridge, and a climb through the rotor to around 8,000 ft. All three ways into the Mt Washington wave, drawn in 3D as you read.",
};

/** One phase of the flight: a scroll step whose card crosses the scene's focus line. */
function Step({
  id,
  time,
  heading,
  side = "left",
  children,
}: {
  id: string;
  time: string;
  heading: string;
  side?: "left" | "right";
  children: ReactNode;
}) {
  const place =
    side === "right"
      ? "sm:ml-auto sm:mr-4 lg:mr-10 xl:mr-16"
      : "sm:ml-4 lg:ml-10 xl:ml-16";
  return (
    <div
      data-phase={id}
      className="flex min-h-[80svh] items-end px-3 pb-24 sm:min-h-[92svh] sm:items-center sm:px-6 sm:pb-0 lg:px-10"
    >
      <article
        className={`pointer-events-auto w-full max-w-md rounded-2xl bg-slate-950/85 p-5 shadow-xl ring-1 ring-white/15 backdrop-blur-sm ${place}`}
      >
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: PHASE_COLORS[id] ?? "#9ca3af" }}
          />
          {PHASE_SHORT[id] ?? id} · {time}
        </p>
        <h3 className="mt-3 font-display text-xl font-semibold tracking-tight text-white">{heading}</h3>
        <div className="mt-3 space-y-3 text-sm leading-6 text-slate-300">{children}</div>
      </article>
    </div>
  );
}

export default function ThreeWaysPage() {
  return (
    <>
      {/* Full-screen opener — the flight scrolls up over it. */}
      <section className="sticky top-0 z-0 h-[100svh] min-h-[560px]">
        <Image
          src="/images/gallery/2026/the-summit-from-the-wing.webp"
          alt="The summit cone of Mount Washington seen from the wing of a glider, with an undercast beyond"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-slate-950/10" />
        <Container className="absolute inset-x-0 bottom-0 pb-14 sm:pb-16">
          <p className="font-display text-xs font-semibold uppercase tracking-[0.3em] text-sky-300">
            From the 2026 camp
          </p>
          <h1 className="mt-4 max-w-3xl font-display text-4xl font-bold tracking-tight text-white text-balance sm:text-5xl">
            Three ways into the wave
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-200">
            Monday&apos;s forecast called for a weak start and stronger conditions in the afternoon with threat
            of the sky below closing in on us. Getting to 8,000 ft that day required a mix of mountain flying
            techniques ranging from a low save to climbing a ridge to get back up, and a turbulent rotor climb
            to transition upwind into the wave.
          </p>
          <p className="mt-4 text-sm text-slate-300/90">
            Thomas Van de Velde · October 12, 2026 · Gorham (2G8)
          </p>
          <p className="mt-8 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-300/70">
            Scroll <span aria-hidden="true">↓</span>
          </p>
        </Container>
      </section>

      {/* Everything else scrolls up over the pinned opener. */}
      <div className="relative z-10">
        <FlightScrollStory>
          <Step id="tow" time="12:12 – 12:27" heading="A no-contact release">
            <p>
              The first tow was the direct kind, out toward the primary, and it went nowhere. I released at
              4,300 ft into air that wasn&apos;t working yet. I spent ten minutes probing the lee side and made
              one fast run east looking for a window, before giving up. By 12:27 I was down to 2,300 ft and
              heading back towards Gorham looking for a last ditch save at the Moriah–Carter ridge. I found a
              small thermal just strong enough to lift me on the foothills of the Carters.
            </p>
          </Step>

          <Step id="ridge" time="12:27 – 12:55" heading="Working the ridge">
            <p>
              The next half hour was the real work of the day. The ridge&apos;s northwest-facing flank was
              giving just enough — true ridge lift plus the odd scrap of rotor — to hold and slowly gain. I
              worked it in the low 2,000s between Imp Face and Mount Surprise, never far off the rocks.
            </p>
            <p>
              At 12:35 came the low point of the flight: 1,857 ft. There is nothing to land on down that
              flank, so I stayed with the ridge until it gave me enough altitude to leave.
            </p>
          </Step>

          <Step id="transit" time="12:55 – 13:00" heading="Crossing the valley" side="right">
            <p>
              Then the day began to change, as forecast. By 12:55 the ridge had carried me to 3,900 ft, and I
              left it to cross the valley west, under the rotor, for the lee of the Presidential range. The
              crossing cost about 700 ft and bottomed at 3,200; low, but with a rotor cloud in sight.
            </p>
            <figure>
              <Image
                src="/images/gallery/2026/clouds-spilling-over-the-ridge.webp"
                alt="Cloud spilling over a mountain ridge, with an undercast beyond and blue sky above"
                width={2016}
                height={1134}
                sizes="(min-width: 640px) 26rem, 92vw"
                className="w-full rounded-xl ring-1 ring-white/10"
              />
              <figcaption className="mt-2 text-xs leading-5 text-slate-400">
                Cloud spilling over the ridge while the wave gets going.
              </figcaption>
            </figure>
          </Step>

          <Step id="rotor" time="13:00 – 13:11" heading="Climbing out in the rotor">
            <p>
              Finally. I climbed out of the valley in the rotor&apos;s turbulent air, circling in broken lift
              for twelve steady minutes, from 3,500 to 5,700 ft. The best five of them averaged 350 ft/min.
            </p>
          </Step>

          <Step id="wave" time="13:11 – 13:19" heading="The wave climb">
            <p>
              Reaching the top of the rotor, I pushed upwind into the primary wave. Nauseating turbulence
              changed to long straight legs back and forth across the lift, the vario finally steady, and the
              altimeter winding up faster than it had all flight. By 13:20 I was at 7,600 ft.
            </p>
          </Step>

          <Step id="upwind" time="13:19 – 13:25" heading="Pushing upwind">
            <p>
              The last move was the upwind one. I pushed northwest into the strongest part of the primary,
              over the rim of the Great Gulf near The Horn, and topped out around 8,000 ft when we received
              the radio call about the closing sky over Gorham airport. The summit cone slid by under the left
              wing (see the photo at the top of this page), with the undercast lying over everything north of
              the mountain.
            </p>
          </Step>

          <Step id="home" time="13:25 – 13:36" heading="Going home">
            <p>
              The camp was already shutting down below me: the ceiling was lowering, the gusts were up, and
              the tow pilots had called the recall while the wave was only starting to cook. I took one more
              look at the mountain, turned downwind, and rode the long glide home. I landed at 13:36.
            </p>
            <figure>
              <Image
                src="/images/gallery/2026/cockpit-over-the-summit.webp"
                alt="Cockpit view of a glider over the mountains, with the flight computer showing 7,559 feet at 13:25"
                width={2016}
                height={1518}
                sizes="(min-width: 640px) 26rem, 92vw"
                className="w-full rounded-xl ring-1 ring-white/10"
              />
              <figcaption className="mt-2 text-xs leading-5 text-slate-400">
                13:25 — 7,559 ft on the panel, Gorham six miles out.
              </figcaption>
            </figure>
          </Step>
        </FlightScrollStory>
      </div>
    </>
  );
}
