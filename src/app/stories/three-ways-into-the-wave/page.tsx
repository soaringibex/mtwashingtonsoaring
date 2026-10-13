import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ConnectWithWave3D } from "@/components/flights/ConnectWithWave3D";
import { Container } from "@/components/ui/Container";
import { PageHero } from "@/components/ui/PageHero";
import { Prose } from "@/components/ui/Prose";

export const metadata: Metadata = {
  title: "Three ways into the wave",
  description:
    "Monday's flight at the 2026 Gorham camp — and the three ways into the Mount Washington wave: the direct tow, the high road over the Carters, and the low road through the rotor.",
};

export default function ThreeWaysPage() {
  return (
    <>
      <PageHero
        eyebrow="From the 2026 camp"
        title="Three ways into the wave"
        lede="Monday's flight began with a tow into air that wasn't working and finished 7,900 feet over the summit. In between, it ran through every way there is to reach the Mount Washington wave — including the ones that didn't work."
        image="/images/gallery/2026/the-summit-from-the-wing.webp"
        imageAlt="The summit cone of Mount Washington seen from the wing of a glider, with an undercast beyond"
        priority
      />

      <article className="py-14 sm:py-18">
        <Container width="2xl">
          <Link
            href="/stories"
            className="text-sm font-medium text-sky-700 transition-colors hover:text-sky-600"
          >
            <span aria-hidden="true">←</span> All stories
          </Link>

          <p className="mt-8 text-sm text-slate-500">Thomas Van de Velde · October 12, 2026 · Gorham (2G8)</p>

          <Prose className="mt-8">
            <p>
              The forecast for Monday said the day would start weak and get stronger, and that cloud and gusts
              would shut it down before it was through. It did all three. I launched at 12:12 into air that was
              barely moving, and by the time the wave was getting serious, the camp was being recalled.
            </p>
            <p>
              I got 84 minutes out of it, and for most of the first hour I was below four thousand feet, working
              for every foot of the way up. That turned out to be the interesting part. From Gorham there are
              three ways into the Mount Washington wave, and Monday&apos;s flight managed to visit all of them.
            </p>

            <h2>1 · The direct tow</h2>
            <p>
              The simplest way up is the one you pay for. The tow runs down the valley toward the mountain and
              delivers you into the wave — often lower than you would guess; wave can be found well below the
              summit — and the most reliable window anywhere on the mountain is near{" "}
              <Link href="/flying">The Horn</Link>, the northern shoulder just above the Great Gulf.
            </p>
            <p>
              That is the appeal: minutes after the rope comes tight you can be in smooth air with thousands of
              feet of climb ahead of you. The catch is everything around it. Tows into the wave are long, and
              every long tow is several launches the field doesn&apos;t get. The ride out passes through the
              rotor, which can be the roughest air of the day — the passenger on the rope gets the rodeo. And a
              glider that arrives this way has no picture of the lower air at all. You know where the wave is;
              you don&apos;t know what the valley is doing. If the wave lets go, you are suddenly flying a plan
              you never made.
            </p>

            <h2>2 · The high road, over the Carters</h2>
            <p>
              The second way is to get high first. A short tow — three thousand feet can be enough — puts you on
              the Moriah–Carter ridge southeast of the field. From there the ridge is a ladder: work it south,
              climb in whatever ridge lift and scraps of rotor and thermal you find, and at your best height
              punch out west for the lee side of the Presidential range, aiming for the wave line you think is
              working.
            </p>
            <p>
              This is the route the club&apos;s pilot brief describes as the usual one, and it has an honest
              logic: you cross the valley with height in hand, and you keep the ridge behind you as an escape.
              It also has a bill. The ridge you are climbing can be starved by the very wave you are chasing —
              when the wave&apos;s sink sits down on it, the lift that was supposed to carry you south simply is
              not there. Every mile south is a mile further from the field, over country with nowhere to land.
              And the punch-out happens at the altitude you have earned, not the one you wanted.
            </p>

            <h2>3 · The low road, climbing in rotor</h2>
            <p>
              The third way works from underneath. Below the wave, on the lee side of the mountains, the air
              curls back on itself: the rotor. It is not smooth lift. It is broken, punchy and local, marked by
              shredded cloud, with sink waiting on every side — but on a day when the wave is late, or a tow
              hasn&apos;t connected, it is the way up that is left.
            </p>
            <p>
              You climb it the way you climb anything you don&apos;t entirely trust: in small bites, staying
              close to a retreat, moving downwind as you gain height until the air smooths into wave — and then,
              if you are positioned right, pushing upwind into the primary. That last move costs altitude and is
              easy to get wrong. It is also the move that turns a sinking day into a save.
            </p>

            <h2>Monday&apos;s flight</h2>
            <p>
              Monday ran the whole list, in order. I launched at 12:12; the first tow was the direct kind, out
              toward the primary; and it went nowhere.
            </p>
          </Prose>
        </Container>

        <section
          aria-label="The flight of October 12, 2026 in 3D"
          className="mt-12 border-y border-slate-900/10 bg-slate-950"
        >
          <div className="h-[72svh] max-h-[780px] min-h-[520px]">
            <ConnectWithWave3D />
          </div>
        </section>

        <Container width="2xl">
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-slate-500">
            The whole flight in 3D — drag to orbit, scroll to zoom, and the buttons walk the stages.{" "}
            <span className="text-amber-600">Amber</span> is the low work on the Moriah–Carter ridge;{" "}
            <span className="text-cyan-600">cyan</span>, the crossing below the rotor;{" "}
            <span className="text-emerald-600">green</span>, the climb; and{" "}
            <span className="text-violet-600">violet</span>, the push upwind into the primary. The barogram along
            the bottom is a scrubber — play the flight, or drag to any minute; the grey mass under the line is
            the terrain directly beneath the track.
          </p>

          <Prose className="mt-10">
            <p>
              The tow released me at 4,300 feet into air that wasn&apos;t working yet. I spent the next ten
              minutes hoping it would change — a couple of probes on the lee side, one fast run east looking for
              a window — before conceding. By 12:27 I was down to 2,300 feet and pointing at the only thing that
              was working at all: the Moriah–Carter ridge.
            </p>
            <p>
              The next half hour was the real work of the day. The ridge&apos;s northwest-facing flank was
              giving just enough — true ridge lift, plus the odd scrap of rotor — to hold and slowly gain. I
              worked it in the low two thousands, crossing the slope between Imp Face and Mount Surprise, never
              far off the rocks. At 12:35 came the low point of the flight: 1,857 feet. Thin air, on a flank
              with no landing options anywhere below it. That is the kind of moment that decides whether a
              flight becomes a story or an incident.
            </p>

            <figure>
              <Image
                src="/images/gallery/2026/clouds-spilling-over-the-ridge.webp"
                alt="Cloud spilling over a mountain ridge, with an undercast beyond and blue sky above"
                width={2016}
                height={1134}
                className="w-full rounded-2xl ring-1 ring-slate-900/5"
              />
              <figcaption className="mt-3 text-sm leading-6 text-slate-500">
                Cloud spilling over the ridge while the wave gets going — the rotor&apos;s signature, below the
                smooth air I was working toward.
              </figcaption>
            </figure>

            <p>
              Then the day began to change, as forecast. By 12:55 the ridge had carried me up to 3,900 feet, and
              I made the second decision: leave the ridge and cross the valley west, under the rotor, for the
              lee of the Presidential range. The crossing cost about 700 feet and bottomed at 3,200 — low, but
              under the right sky.
            </p>
            <p>
              What followed was the third method, working exactly as it is drawn up. From 12:58 I climbed,
              first in the rotor&apos;s churned air over the valley, until the lift smoothed and steepened into
              real wave — the kind you can circle in like a thermal. In twenty-two minutes I went from 3,400 to
              7,600 feet; the best five minutes of it, shortly after one o&apos;clock, averaged 350 feet a
              minute.
            </p>
            <p>
              The last move was the upwind one. I pushed northwest into the strongest part of the primary, over
              the rim of the Great Gulf near The Horn, and topped out at 7,943 feet at 13:24. The summit cone
              slid by below the left wing — as the photograph at the top of this piece shows — with the
              undercast lying over everything north of the mountain.
            </p>

            <figure>
              <Image
                src="/images/gallery/2026/cockpit-over-the-summit.webp"
                alt="Cockpit view of a glider over the mountains, with the flight computer showing 7,559 feet at 13:25"
                width={2016}
                height={1518}
                className="w-full rounded-2xl ring-1 ring-slate-900/5"
              />
              <figcaption className="mt-3 text-sm leading-6 text-slate-500">
                13:25 on the panel: 7,559 feet and Gorham six miles out, turning for home with the wave still
                building.
              </figcaption>
            </figure>

            <p>
              Below me, the camp was already shutting down. The ceiling was lowering, the gusts were up, and the
              tow pilots had called the recall while the wave was only beginning to cook. I gave the mountain
              one more look, turned downwind, and rode the long descent home. Landing came at 13:36.
            </p>

            <h2>What the hard way is worth</h2>
            <p>
              The arithmetic is easy to do and easy to misread. A long tow on a day when it works would have put
              me in the wave in fifteen minutes; the low road took an hour and most of my margin. What it bought
              instead is the picture the tow never gives you: where the rotor actually sits on a northwest day,
              how the valley feels when the wave is late, and which parts of the ridge to trust. That is the
              currency the wave accepts.
            </p>
            <p>
              All three ways work — the trick is reading which one the day is offering. Monday offered the low
              road, with a marginal ridge and a late wave, and then spent an hour proving it was the one that
              would connect. When the wave is forecast to build, it usually does. Having the patience to climb
              to it is most of the game.
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
        </Container>
      </article>
    </>
  );
}
