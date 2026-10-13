import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { FlightScrollStory } from "@/components/flights/FlightScrollStory";
import { Container } from "@/components/ui/Container";
import { Prose } from "@/components/ui/Prose";
import { PHASE_COLORS, PHASE_SHORT } from "@/lib/flight-phases";

export const metadata: Metadata = {
  title: "Three ways into the wave",
  description:
    "Monday's flight at the 2026 Gorham camp, told as a scroll: a tow that didn't connect, a low save down to 1,857 ft on the Moriah–Carter ridge, and a climb through the rotor to 7,943 ft. All three ways into the Mt Washington wave, drawn in 3D as you read.",
};

/** One phase of the flight: a scroll step whose card crosses the scene's focus line. */
function Step({
  id,
  time,
  heading,
  children,
}: {
  id: string;
  time: string;
  heading: string;
  children: ReactNode;
}) {
  return (
    <div
      data-phase={id}
      className="flex min-h-[80svh] items-end px-3 pb-24 sm:min-h-[92svh] sm:items-center sm:px-6 sm:pb-0 lg:px-10"
    >
      <article className="pointer-events-auto w-full max-w-md rounded-2xl bg-slate-950/85 p-5 shadow-xl ring-1 ring-white/15 backdrop-blur-sm sm:ml-4 lg:ml-10 xl:ml-16">
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
            Monday&apos;s forecast called for a weak start and a strong finish, and it delivered both. Getting to
            7,943 ft took all three of the ways into the Mt Washington wave: the long tow, the ridge, and the
            rotor.
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
          <Step id="tow" time="12:12 – 12:27" heading="A tow that went nowhere">
            <p>
              The first tow was the direct kind, out toward the primary, and it went nowhere. I released at
              4,300 ft into air that wasn&apos;t working yet. I spent ten minutes probing the lee side and made
              one fast run east looking for a window, before giving up. By 12:27 I was down to 2,300 ft and
              heading back towards Gorham looking for a last ditch save at the Moriah–Carter ridge.
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

          <Step id="transit" time="12:55 – 13:00" heading="Crossing the valley">
            <p>
              Then the day began to change, as forecast. By 12:55 the ridge had carried me to 3,900 ft, and I
              left it to cross the valley west, under the rotor, for the lee of the Presidential range. The
              crossing cost about 700 ft and bottomed at 3,200 — low, but under the right sky.
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
              Then the third method started to work. I climbed out of the valley in the rotor&apos;s churned
              air, circling in broken lift for twelve steady minutes, from 3,500 to 5,700 ft. The best five of
              them averaged 350 ft/min.
            </p>
          </Step>

          <Step id="wave" time="13:11 – 13:19" heading="The wave climb">
            <p>
              The air smoothed out and the climb changed character. Now it was the wave: long straight legs
              back and forth across the lift, the vario finally steady, and the altimeter winding up faster
              than it had all flight. By 13:20 I was at 7,600 ft.
            </p>
          </Step>

          <Step id="upwind" time="13:19 – 13:25" heading="Pushing upwind">
            <p>
              The last move was the upwind one. I pushed northwest into the strongest part of the primary,
              over the rim of the Great Gulf near The Horn, and topped out at 7,943 ft at 13:24. The summit
              cone slid by under the left wing (see the photo at the top of this page), with the undercast
              lying over everything north of the mountain.
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

        <div className="bg-white">
          <Container width="2xl" className="pb-20">
            <Prose className="pt-16">
              <p>
                By the numbers: 84 minutes, most of the first hour below 4,000 ft, and a top-out at 7,943 ft.
                What follows is a closer look at the three routes — how each one works, and what each one
                costs.
              </p>

              <h2>1 · The direct tow</h2>
              <p>
                The first way up is the simplest: pay for a long tow to the wave. The tow takes you down the
                valley toward the mountain and releases you in lift, often lower than you would guess; wave
                can be found well below the summit. The most reliable window anywhere on the mountain is near{" "}
                <Link href="/flying">The Horn</Link>, the northern shoulder above the Great Gulf. It works,
                and it is how most of us get our first wave contact here.
              </p>
              <p>
                The drawbacks are practical. Long tows aren&apos;t cheap, and each one keeps the towplane busy
                while other gliders wait on the grid. The ride out passes through the rotor, which on a rough
                day is the worst air you will touch all flight. And the glider that arrives on the rope has no
                picture of the lower air at all: you know where the wave is, but nothing about what the
                valley is doing. If the wave lets go, you are a long glide from a landing with no plan B.
              </p>

              <h2>2 · The high road, over the Carters</h2>
              <p>
                The second way is to get high first. A 3,000 ft tow puts you on the Moriah–Carter ridge
                southeast of the field. From there the ridge is a ladder: work it south, climb in ridge lift
                and whatever scrap of rotor or thermal you find, and at your best height turn west for the lee
                side of the Presidential range, aiming at the wave line you think is working.
              </p>
              <p>
                The pilot brief describes this as the usual route, and it has an honest logic: you cross the
                valley with altitude in hand, and the ridge stays behind you as an escape. The spoiler is that
                the wave can starve the same ridge you are climbing. When its sink settles on the ridge, the
                lift that was supposed to carry you south simply isn&apos;t there, and every mile south is a
                mile further from the field over ground with nowhere to land. You also make the jump west
                with whatever altitude you have managed, which may not be much.
              </p>

              <h2>3 · The low road, climbing in rotor</h2>
              <p>
                The third way starts from underneath. On the lee side of the mountains the air below the wave
                curls back on itself — the rotor. It is not smooth lift. It comes in broken, punchy pieces
                with sink on all sides, and on most days it is marked by shredded clouds. When the wave is
                late, or a tow doesn&apos;t connect, it is the way up that&apos;s left.
              </p>
              <p>
                You climb it in small bites, staying near a place you can retreat to, working downwind as you
                gain altitude until the air smooths into wave. Then you push upwind into the primary. That
                last move costs altitude and is easy to get wrong, but it is the one that saves the day.
              </p>

              <h2>What I took away from it</h2>
              <p>
                On paper, this climb cost more than it should have. A long tow on a day when it works would
                have put me in the wave in fifteen minutes; the low road took an hour and most of my margin.
                What it bought instead is a picture the tow never gives you: where the rotor actually sits on
                a northwest day, how the valley feels when the wave is late, and which parts of the ridge to
                trust. I&apos;ll take that trade.
              </p>
              <p>
                All three ways work; the day decides which one you get. Monday offered the low road, with a
                marginal ridge and a late wave, and then spent an hour proving it was the one that would
                connect. When the wave is forecast to build, it usually does. Having the patience to climb to
                it is most of the game.
              </p>
            </Prose>

            <p className="mt-10 text-sm leading-7 text-slate-500">
              The trace is logged at{" "}
              <a
                href="https://weglide.org/flight/1253598"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-sky-700 hover:text-sky-600"
              >
                WeGlide ↗
              </a>
              . The day also appears in{" "}
              <Link
                href="/stories/2026-wave-camp-logbook-glen-kelley"
                className="font-medium text-sky-700 hover:text-sky-600"
              >
                Glen Kelley&apos;s camp logbook
              </Link>
              , and every camp flight since 2016 is drawn in{" "}
              <Link href="/flights/3d" className="font-medium text-sky-700 hover:text-sky-600">
                the 3D archive
              </Link>
              .
            </p>

            <p className="mt-10">
              <Link
                href="/stories"
                className="text-sm font-medium text-sky-700 transition-colors hover:text-sky-600"
              >
                <span aria-hidden="true">←</span> All stories
              </Link>
            </p>
          </Container>
        </div>
      </div>
    </>
  );
}
