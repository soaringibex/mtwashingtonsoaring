import Image from "next/image";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Container } from "@/components/ui/Container";
import { Eyebrow, SectionHeading } from "@/components/ui/SectionHeading";
import { SummitWinds } from "@/components/home/SummitWinds";
import { WavePotentialCard } from "@/components/home/WavePotentialCard";
import { WindProfile } from "@/components/home/WindProfile";
import { Reveal } from "@/components/ui/Reveal";
import { linkGroups } from "@/lib/links";
import { LOGBOOK_HREF, latestLogbookEntry } from "@/lib/camp-logbook";
import { site } from "@/lib/site";

const stats = [
  {
    value: "1938",
    label:
      "The first wave flight in the United States — Lewin Barringer, in the lee of the Presidential Range.",
  },
  {
    value: "231 mph",
    label: "The highest surface wind speed ever measured — recorded on the summit in 1934.",
  },
  {
    value: "32,513 ft",
    label: "The New Hampshire altitude record — Timothy Chow, in the Mount Washington wave, October 2018.",
  },
  {
    value: "10+ days",
    label: "Of flying each October, based at Gorham Municipal Airport (2G8).",
  },
];

const waveCards = [
  {
    title: "The mountain",
    image: "/images/scenic/summit-observatory.webp",
    alt: "Aerial view of the snow-covered Mount Washington summit and its observatory",
    body: "At 6,288 feet, Mount Washington anchors the Presidential Range — the highest peak in the northeastern United States and home to some of the worst weather on Earth.",
  },
  {
    title: "The wave",
    image: "/images/scenic/lenticular-wing.webp",
    alt: "A lenticular cloud seen past the wing of a glider",
    body: "Winds forced over the ridges create a standing mountain wave. In its lift, gliders have climbed past 30,000 feet above sea level — some without ever starting an engine.",
  },
  {
    title: "The camp",
    image: "/images/scenic/ground-crew.webp",
    alt: "Pilots preparing gliders on the grass at Gorham",
    body: "Every October since 1966, pilots gather at Gorham, New Hampshire, for the annual wave camp — more than ten days of tows, briefings and diamond climbs.",
  },
];

const galleryPreview = [
  {
    src: "/images/scenic/ridge-glider.webp",
    alt: "A glider soaring over a dark ridge in the White Mountains",
  },
  {
    src: "/images/gallery/2024/oct-2.jpg",
    alt: "Gliders lined up on the field at Gorham before a morning launch",
  },
  {
    src: "/images/scenic/clouddeck.webp",
    alt: "A cloud deck seen from high altitude in the wave",
  },
  {
    src: "/images/scenic/canopy-tow.webp",
    alt: "The tow plane seen through a glider canopy",
  },
  {
    src: "/images/scenic/sun-silhouette.webp",
    alt: "A glider silhouetted against the sun above a wooded ridge",
  },
  {
    src: "/images/scenic/wingtip-ridges.webp",
    alt: "A wingtip over blue ridges stretching into the distance",
  },
];

export default function HomePage() {
  const clubs = linkGroups.find((group) => group.id === "clubs")?.links ?? [];
  const entry = latestLogbookEntry();

  return (
    <>
      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-slate-950">
        <Image
          src="/images/home/presidential-range-from-the-air.webp"
          alt="The snow-dusted Presidential Range seen from the air, fall color in the valleys below"
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-70"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-slate-900/20" />
        <Container className="relative flex min-h-[92svh] flex-col justify-end pb-14 pt-32 sm:pb-20">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
            <div className="animate-fade-up">
              <p className="font-display text-xs font-semibold uppercase tracking-[0.3em] text-sky-300">
                {site.name}
              </p>
              <h1 className="mt-4 max-w-3xl font-display text-4xl font-bold tracking-tight text-white text-balance sm:text-6xl">
                2026 Wave Camp
              </h1>
              {entry ? (
                <div className="mt-6 max-w-2xl border-l-2 border-sky-300/80 pl-5">
                  <p className="font-display text-xs font-semibold uppercase tracking-[0.3em] text-sky-300">
                    camp logbook · Glen Kelley
                  </p>
                  <p className="mt-3 font-display text-xl font-semibold leading-snug text-white text-balance sm:text-2xl">
                    {entry.heading}
                  </p>
                  <div className="mt-3 space-y-2.5">
                    {entry.paragraphs.map((paragraph, index) => (
                      <p key={index} className="text-base leading-7 text-slate-200">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                  <Link
                    href={LOGBOOK_HREF}
                    className="mt-4 inline-block text-sm font-medium text-sky-200 transition-colors hover:text-white"
                  >
                    Read the full logbook <span aria-hidden="true">→</span>
                  </Link>
                </div>
              ) : null}
              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href="/flying">Plan for wave camp</ButtonLink>
                <ButtonLink href="/flying#required" variant="light">
                  Required reading
                </ButtonLink>
              </div>
            </div>
            <div className="animate-fade-up space-y-4 lg:animate-fade-up [animation-delay:150ms]">
              <SummitWinds />
              <WavePotentialCard />
            </div>
          </div>
        </Container>
      </section>

      {/* Current conditions */}
      <section id="conditions" className="bg-slate-50 py-20 sm:py-24">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_520px] lg:items-center">
            <Reveal>
              <Eyebrow>Current conditions</Eyebrow>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-slate-900 text-balance sm:text-4xl">
                See what the wind is doing right now.
              </h2>
              <div className="mt-6 space-y-5 text-[1.0625rem] leading-8 text-slate-700">
                <p>
                  Wave days are written in the vertical wind profile — a steady cross-ridge flow at
                  altitude, with stable air through the layer. This is the live column of wind over
                  Mount Washington from the latest model run: the same first look pilots take
                  before heading to the field.
                </p>
              </div>
              <div className="mt-8">
                <ButtonLink href="/more#weather" variant="secondary">
                  Weather links
                </ButtonLink>
              </div>
            </Reveal>
            <Reveal delay={120}>
              <WindProfile />
            </Reveal>
          </div>
        </Container>
      </section>

      {/* The club */}
      <section className="py-20 sm:py-28">
        <Container>
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <Reveal>
              <Eyebrow>The club</Eyebrow>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-slate-900 text-balance sm:text-4xl">
                A soaring club with only members.
              </h2>
              <div className="mt-6 space-y-5 text-[1.0625rem] leading-8 text-slate-700">
                <p>
                  The Mount Washington Soaring Association is unique amongst soaring clubs: it has
                  only members — no dues, and no officers. Its whole undertaking is the annual
                  October wave camp at Gorham, and everything about it is voluntary.
                </p>
                <p>
                  During the weeks leading up to each encampment, information — including the
                  signup sheet — is distributed on the email list:{" "}
                  <a
                    href={`mailto:${site.email}`}
                    className="font-medium text-sky-700 underline underline-offset-4 hover:text-sky-600"
                  >
                    {site.email}
                  </a>
                  .
                </p>
              </div>
              <div className="mt-8">
                <ButtonLink href={`mailto:${site.email}`} variant="dark">
                  {site.email}
                </ButtonLink>
              </div>
            </Reveal>
            <Reveal delay={120}>
              <div className="grid grid-cols-2 gap-3">
                <Image
                  src="/images/scenic/summit-glider.webp"
                  alt="A glider above the Mount Washington summit and its antennas"
                  width={660}
                  height={439}
                  className="aspect-[4/5] w-full rounded-3xl object-cover"
                />
                <Image
                  src="/images/scenic/towplane-tow.webp"
                  alt="A tow plane pulling a glider over autumn mountains"
                  width={660}
                  height={490}
                  className="aspect-[4/5] w-full rounded-3xl object-cover"
                />
                <Image
                  src="/images/scenic/canopy-tow.webp"
                  alt="The tow plane seen through a glider canopy"
                  width={660}
                  height={442}
                  className="aspect-[4/3] w-full rounded-3xl object-cover"
                />
                <Image
                  src="/images/scenic/parked-glider.webp"
                  alt="A white and red glider parked on the grass at the airfield"
                  width={660}
                  height={494}
                  className="aspect-[4/3] w-full rounded-3xl object-cover"
                />
              </div>
            </Reveal>
          </div>

          <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat, index) => (
              <Reveal key={stat.value} delay={index * 80}>
                <div className="h-full rounded-3xl bg-slate-50 p-6 ring-1 ring-slate-900/5">
                  <p className="font-display text-3xl font-bold tracking-tight text-sky-700">
                    {stat.value}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{stat.label}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* Why here */}
      <section className="bg-slate-50 py-20 sm:py-28">
        <Container>
          <SectionHeading
            eyebrow="Why here"
            title="Mount Washington makes the wave."
            lede="Three things come together at Gorham: a mountain that disturbs the wind, a standing wave that reaches the flight levels, and a group of pilots who show up every fall to use it."
          />
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {waveCards.map((card, index) => (
              <Reveal key={card.title} delay={index * 100}>
                <article className="group h-full overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-900/5">
                  <div className="relative aspect-[16/10] overflow-hidden">
                    <Image
                      src={card.image}
                      alt={card.alt}
                      fill
                      sizes="(max-width: 768px) 100vw, 33vw"
                      className="object-cover transition duration-500 ease-out group-hover:scale-[1.03]"
                    />
                  </div>
                  <div className="p-6">
                    <h3 className="font-display text-lg font-semibold text-slate-900">
                      {card.title}
                    </h3>
                    <p className="mt-3 text-sm leading-7 text-slate-600">{card.body}</p>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* Quote band */}
      <section className="relative isolate overflow-hidden bg-slate-950 py-20 sm:py-28">
        <Image
          src="/images/scenic/ridge-yellow.webp"
          alt=""
          fill
          sizes="100vw"
          className="object-cover opacity-25"
        />
        <Container className="relative">
          <Reveal>
            <blockquote className="max-w-3xl">
              <p className="font-display text-2xl font-semibold leading-snug text-white text-balance sm:text-3xl">
                “On the last and strongest thermal I climbed over 1,500 feet above the sea of
                clouds until my altimeter read just over 9,500 feet.”
              </p>
              <footer className="mt-6 text-sm font-medium text-sky-300">
                Lewin Barringer, on the first wave flight in the United States — Mount Washington,
                1938
              </footer>
            </blockquote>
          </Reveal>
          <div className="mt-10">
            <ButtonLink href="/history" variant="light">
              Read the full history
            </ButtonLink>
          </div>
        </Container>
      </section>

      {/* Gallery preview */}
      <section className="py-20 sm:py-28">
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeading
              eyebrow="Photos"
              title="October at Gorham."
              lede="Gliders on the grid, lenticulars over the valley, and the summit from 30,000 feet."
            />
            <ButtonLink href="/gallery" variant="secondary" className="shrink-0">
              All photos
            </ButtonLink>
          </div>
          <div className="mt-10 grid grid-cols-2 gap-3 lg:grid-cols-3">
            {galleryPreview.map((photo, index) => (
              <Reveal key={photo.src} delay={index * 60}>
                <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-slate-100">
                  <Image
                    src={photo.src}
                    alt={photo.alt}
                    fill
                    sizes="(max-width: 640px) 50vw, 33vw"
                    className="object-cover transition duration-500 ease-out hover:scale-[1.03]"
                  />
                </div>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* Founding clubs */}
      <section className="bg-slate-50 py-20 sm:py-28">
        <Container>
          <SectionHeading
            eyebrow="Who makes it happen"
            title="Four clubs, one camp."
            lede="Founding clubs (GBSC, FSA, PMSC and NESA) and their members provide the necessary resources toward the organization, carrying out and oversight of the wave camp."
          />
          <Reveal>
            <blockquote className="mt-8 max-w-3xl border-l-2 border-sky-300 pl-6 text-[1.0625rem] italic leading-8 text-slate-600">
              “There are many people who get together to make this happen: arranging availability
              of facilities at the airport, moving equipment to the airport (tow planes, gliders,
              golf carts), moving the runway cones to make the airport more glider friendly, then
              moving them back at the end, acquiring oxygen, renting porta potties, coordinating
              with the FAA and more. The list is extensive.”
            </blockquote>
          </Reveal>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {clubs.map((club, index) => (
              <Reveal key={club.href} delay={index * 80}>
                <a
                  href={club.href}
                  className="group flex h-full flex-col rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5 transition hover:shadow-md"
                >
                  <span className="font-display text-base font-semibold text-slate-900 group-hover:text-sky-700">
                    {club.title}
                  </span>
                  <span className="mt-2 flex-1 text-sm leading-7 text-slate-600">
                    {club.description}
                  </span>
                  <span className="mt-4 text-sm font-medium text-sky-700">
                    Visit site
                    <span aria-hidden="true"> →</span>
                  </span>
                </a>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* CTA */}
      <section className="py-20 sm:py-28">
        <Container>
          <Reveal>
            <div className="flex h-full flex-col justify-between rounded-3xl bg-gradient-to-br from-sky-600 to-sky-900 p-8 text-white sm:p-10">
              <div>
                <p className="font-display text-xs font-semibold uppercase tracking-[0.28em] text-sky-200">
                  Camp information
                </p>
                <h3 className="mt-3 font-display text-2xl font-bold tracking-tight text-balance">
                  Camp information and signups go out by email.
                </h3>
                <p className="mt-4 max-w-3xl text-[1.0625rem] leading-8 text-sky-100">
                  A few weeks before each encampment, the mailing list gets the signup sheet,
                  schedule and logistics.
                </p>
              </div>
              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href={`mailto:${site.email}`} variant="light">
                  {site.email}
                </ButtonLink>
                <ButtonLink href="/flying" variant="light">
                  For pilots
                </ButtonLink>
              </div>
            </div>
          </Reveal>
        </Container>
      </section>
    </>
  );
}
