import type { Metadata } from "next";
import Image from "next/image";
import { AltitudeRail } from "@/components/accomplishments/AltitudeRail";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Container } from "@/components/ui/Container";
import { awards, climbTiers, type Award } from "@/lib/accomplishments";

export const metadata: Metadata = {
  title: "Accomplishments",
  description:
    "Climb the record book of the Mount Washington wave — gold altitude climbs, diamond climbs and Lennie Pins, from the grass at Gorham to the thin air past 30,000 feet.",
};

const ftFormat = new Intl.NumberFormat("en-US");

const findAward = (id: string): Award => {
  const found = awards.find((award) => award.id === id);
  if (!found) throw new Error(`Unknown award: ${id}`);
  return found;
};

function Kicker({ children, dark }: { children: string; dark?: boolean }) {
  return (
    <p
      className={`font-display text-xs font-semibold uppercase tracking-[0.28em] ${
        dark ? "text-sky-300" : "text-sky-700"
      }`}
    >
      {children}
    </p>
  );
}

function Stat({ value, label, dark }: { value: string; label: string; dark?: boolean }) {
  return (
    <div
      className={`rounded-3xl p-6 ${
        dark
          ? "border border-white/10 bg-white/5 backdrop-blur-sm"
          : "border border-slate-900/5 bg-white/70 shadow-sm backdrop-blur-sm"
      }`}
    >
      <p
        className={`font-display text-3xl font-bold tracking-tight tabular-nums ${
          dark ? "text-white" : "text-sky-700"
        }`}
      >
        {value}
      </p>
      <p
        className={`mt-3 text-sm leading-6 ${dark ? "text-slate-300" : "text-slate-600"}`}
      >
        {label}
      </p>
    </div>
  );
}

function YearCard({
  year,
  entries,
  dark,
}: {
  year: string;
  entries: string[];
  dark: boolean;
}) {
  return (
    <div
      className={`rounded-3xl p-6 ${
        dark
          ? "border border-white/15 bg-white/10 backdrop-blur-md"
          : "border border-slate-900/5 bg-white/80 shadow-sm backdrop-blur-sm"
      }`}
    >
      <p
        className={`font-display text-xl font-bold tracking-tight tabular-nums ${
          dark ? "text-sky-300" : "text-sky-700"
        }`}
      >
        {year}
      </p>
      <ul
        className={`mt-4 space-y-2.5 text-sm leading-6 ${
          dark ? "text-slate-100" : "text-slate-700"
        }`}
      >
        {entries.map((entry) => (
          <li key={entry} className="flex gap-2.5">
            <span
              aria-hidden="true"
              className={`mt-2 size-1.5 shrink-0 rounded-full ${
                dark ? "bg-sky-300" : "bg-sky-500"
              }`}
            />
            <span>{entry}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TierSection({
  award,
  id,
  station,
  tone,
}: {
  award: Award;
  id: string;
  station: string;
  tone: "light" | "dark";
}) {
  const dark = tone === "dark";
  return (
    <section id={id} className="scroll-mt-28">
      <header>
        <Kicker dark={dark}>{station}</Kicker>
        <div className="mt-5 flex flex-wrap items-end gap-x-5 gap-y-1">
          <span
            className={`font-display text-7xl font-bold tracking-tight tabular-nums sm:text-8xl ${
              dark ? "text-white" : "text-slate-900"
            }`}
          >
            {ftFormat.format(award.ft)}
          </span>
          <span
            className={`pb-3 font-display text-base font-semibold uppercase tracking-[0.22em] ${
              dark ? "text-sky-300" : "text-sky-700"
            }`}
          >
            feet
          </span>
        </div>
        <h2
          className={`mt-6 font-display text-2xl font-bold tracking-tight sm:text-3xl ${
            dark ? "text-white" : "text-slate-900"
          }`}
        >
          {award.title}
        </h2>
        <p
          className={`mt-2 font-display text-xs font-semibold uppercase tracking-[0.22em] ${
            dark ? "text-sky-300" : "text-sky-700"
          }`}
        >
          {award.criterion}
        </p>
        <p
          className={`mt-4 max-w-2xl text-[1.0625rem] leading-8 ${
            dark ? "text-slate-200" : "text-slate-600"
          }`}
        >
          {award.blurb}
        </p>
      </header>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {award.years.map((group) => (
          <YearCard key={group.year} year={group.year} entries={group.entries} dark={dark} />
        ))}
      </div>
    </section>
  );
}

function Band({
  src,
  alt,
  altitude,
  caption,
}: {
  src: string;
  alt: string;
  altitude: string;
  caption: string;
}) {
  return (
    <figure className="relative isolate h-64 overflow-hidden rounded-[2rem] shadow-2xl shadow-sky-950/20 sm:h-80">
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(max-width: 1024px) 100vw, 70vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/10 to-transparent" />
      <figcaption className="absolute inset-x-0 bottom-0 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 p-6 sm:p-7">
        <span className="font-display text-sm font-semibold uppercase tracking-[0.22em] text-sky-200">
          {altitude}
        </span>
        <span className="max-w-md text-sm leading-6 text-white/90">{caption}</span>
      </figcaption>
    </figure>
  );
}

export default function AccomplishmentsPage() {
  const gold = findAward("gold-altitude");
  const diamond = findAward("diamond-altitude");
  const lennie = findAward("lennie-pin");

  return (
    <div
      style={{
        backgroundImage:
          "linear-gradient(180deg, #ffffff 0%, #f0f9ff 8%, #e0f2fe 17%, #bae6fd 27%, #7dd3fc 38%, #38bdf8 48%, #0284c7 55%, #0369a1 62%, #075985 70%, #0c4a6e 78%, #0f172a 88%, #020617 100%)",
      }}
    >
      {/* Hero — the view you are climbing toward */}
      <section className="relative isolate overflow-hidden bg-slate-950">
        <Image
          src="/images/scenic/clouddeck.webp"
          alt="A sea of clouds seen from high altitude in the Mount Washington wave"
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-70"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/55 to-slate-900/25" />
        <Container className="relative flex min-h-[74svh] flex-col justify-end pb-16 pt-32">
          <p className="font-display text-xs font-semibold uppercase tracking-[0.3em] text-sky-300">
            The record book
          </p>
          <h1 className="mt-4 max-w-3xl font-display text-4xl font-bold tracking-tight text-white text-balance sm:text-6xl">
            Accomplishments
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-200">
            In the Mount Washington wave, altitude is the scoreboard. Scroll down and climb —
            from the grass at Gorham to the thin air past 30,000 feet.
          </p>
          <p className="mt-8 inline-flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.3em] text-sky-300">
            Scroll to climb
            <span aria-hidden="true" className="h-px w-10 bg-sky-300/60" />
          </p>
        </Container>
      </section>

      {/* The climb */}
      <Container>
        <div className="lg:grid lg:grid-cols-[6rem_minmax(0,1fr)] lg:gap-8 xl:gap-12">
          <div className="hidden lg:block">
            <AltitudeRail tiers={climbTiers} />
          </div>

          <div className="space-y-20 pb-32 pt-20 sm:space-y-28 sm:pt-24">
            <nav aria-label="Climb stations" className="flex flex-wrap gap-2 lg:hidden">
              {[
                { href: "#base", label: "Base · 835 ft" },
                { href: "#tier-gold", label: "9,843 ft" },
                { href: "#tier-diamond", label: "16,404 ft" },
                { href: "#tier-lennie", label: "25,000 ft" },
                { href: "#tier-summit", label: "Records" },
              ].map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="rounded-full bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-900/5"
                >
                  {item.label}
                </a>
              ))}
            </nav>

            {/* Station zero */}
            <section id="base" className="scroll-mt-28">
              <Kicker>Station zero — the field</Kicker>
              <h2 className="mt-3 max-w-2xl font-display text-3xl font-bold tracking-tight text-slate-900 text-balance sm:text-4xl">
                It starts on the grass at Gorham.
              </h2>
              <div className="mt-6 max-w-3xl space-y-5 text-[1.0625rem] leading-8 text-slate-600">
                <p>
                  Every flight in this book starts the same way — a tow off the field at Gorham,
                  New Hampshire, roughly 835 feet above sea level, under the ridge line of the
                  Presidential Range. What the record book measures is everything gained above it:
                  gold climbs, diamond climbs, and the Lennie Pins past 25,000 feet.
                </p>
                <p>
                  The wave camps have been filling these lists since 1966. Several hundred diamond
                  climbs were recorded in the original camp years alone — the best single day, in
                  1969, produced 44 of them.
                </p>
              </div>
              <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Stat
                  value="1938"
                  label="The first wave flight in the United States — Lewin Barringer, in the lee of the Presidential Range."
                />
                <Stat
                  value="1966"
                  label="The first modern wave camp, flown out of North Conway by Allan MacNicol and a band of New England pilots."
                />
                <Stat
                  value="44"
                  label="Diamond climbs claimed in a single day — 1969, still the best day on record."
                />
                <Stat
                  value="30,000+"
                  label="Feet: the air the Mount Washington wave is famous for, and where this climb is headed."
                />
              </div>
            </section>

            {/* Leaving the ground */}
            <Band
              src="/images/scenic/ridge-yellow.webp"
              alt="A yellow glider working the ridge line below the summits"
              altitude="835 – 9,843 ft"
              caption="Leaving the ridge line — the first thousands of feet are earned in ridge lift and the low, ragged edge of the wave."
            />

            <TierSection award={gold} id="tier-gold" station="Station one" tone="light" />

            {/* Entering the wave */}
            <Band
              src="/images/scenic/lenticular-wing.webp"
              alt="A lenticular cloud seen from the wing of a glider in the wave"
              altitude="9,843 – 16,404 ft"
              caption="Lenticulars mark the standing wave — the engine behind every climb in this book."
            />

            <TierSection
              award={diamond}
              id="tier-diamond"
              station="Station two"
              tone="light"
            />

            {/* Into the thin air */}
            <Band
              src="/images/scenic/sun-silhouette.webp"
              alt="A glider silhouetted against the sun high in a deep blue sky"
              altitude="16,404 – 25,000 ft"
              caption="Into the cold, thin air — the sky darkens, the horizon bends away, and oxygen becomes part of the flight."
            />

            <TierSection
              award={lennie}
              id="tier-lennie"
              station="Station three"
              tone="dark"
            />

            {/* The top of the book */}
            <section id="tier-summit" className="relative scroll-mt-28">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -inset-x-8 -inset-y-16 opacity-70"
                style={{
                  backgroundImage:
                    "radial-gradient(1.5px 1.5px at 12% 18%, rgba(255,255,255,0.9), transparent 60%), radial-gradient(1px 1px at 32% 8%, rgba(255,255,255,0.7), transparent 60%), radial-gradient(1.5px 1.5px at 58% 24%, rgba(255,255,255,0.8), transparent 60%), radial-gradient(1px 1px at 78% 12%, rgba(255,255,255,0.6), transparent 60%), radial-gradient(1px 1px at 88% 34%, rgba(255,255,255,0.7), transparent 60%), radial-gradient(1.5px 1.5px at 22% 46%, rgba(255,255,255,0.6), transparent 60%), radial-gradient(1px 1px at 68% 52%, rgba(255,255,255,0.5), transparent 60%), radial-gradient(1px 1px at 44% 66%, rgba(255,255,255,0.5), transparent 60%)",
                }}
              />
              <div className="relative">
                <Kicker dark>The top of the book</Kicker>
                <div className="mt-5 flex flex-wrap items-end gap-x-5 gap-y-1">
                  <span className="font-display text-7xl font-bold tracking-tight tabular-nums text-white sm:text-8xl">
                    30,000
                  </span>
                  <span className="pb-3 font-display text-base font-semibold uppercase tracking-[0.22em] text-sky-300">
                    feet and beyond
                  </span>
                </div>
                <h2 className="mt-6 font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  The summit is below you
                </h2>
                <p className="mt-4 max-w-2xl text-[1.0625rem] leading-8 text-slate-200">
                  Flights to over 30,000 feet above sea level have been made in the atmospheric
                  waves generated by Mount Washington and the surrounding peaks. At that height
                  the mountain that makes the wave — 6,288 feet of it — is a white island under
                  the wing.
                </p>

                <div className="mt-10 grid gap-4 sm:grid-cols-3">
                  <Stat
                    value="32,513 ft"
                    label="The New Hampshire altitude record — Timothy Chow, October 9, 2018, flying the Mount Washington wave."
                    dark
                  />
                  <Stat
                    value="31,900 ft"
                    label="Bob Neumann's 1969 flight — the state record for the next forty-nine years."
                    dark
                  />
                  <Stat
                    value="33,600 ft"
                    label="The unofficial high — Walter Weir, October 25, 1985, on the 47th anniversary of Barringer's first flight."
                    dark
                  />
                </div>

                <figure className="relative isolate mt-10 h-72 overflow-hidden rounded-[2rem] shadow-2xl shadow-slate-950/40 sm:h-96">
                  <Image
                    src="/images/scenic/summit-observatory.webp"
                    alt="The snow-covered summit of Mount Washington and its observatory, seen from a glider above"
                    fill
                    sizes="(max-width: 1024px) 100vw, 70vw"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />
                  <figcaption className="absolute inset-x-0 bottom-0 p-6 text-sm text-white/90 sm:p-7">
                    6,288 feet below the wing — the summit, the observatory, and the weather that
                    makes the wave.
                  </figcaption>
                </figure>

                <div className="mt-10 flex flex-wrap gap-3">
                  <ButtonLink href="/history" variant="light">
                    How it all started
                  </ButtonLink>
                  <ButtonLink href="/flying" variant="light">
                    Fly the wave
                  </ButtonLink>
                </div>
              </div>
            </section>
          </div>
        </div>
      </Container>
    </div>
  );
}
