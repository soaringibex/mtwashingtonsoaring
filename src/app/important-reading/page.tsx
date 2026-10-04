import type { Metadata } from "next";
import Image from "next/image";
import { PageHero } from "@/components/ui/PageHero";
import { Container } from "@/components/ui/Container";
import { DocCard } from "@/components/ui/DocCard";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { navFiles, type DocLink } from "@/lib/documents";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Important reading",
  description:
    "Required reading for flying the Mount Washington wave — the Mount Washington Brief, oxygen talk, airport procedures, legal references and navigational material for the Gorham wave camp.",
};

const required: DocLink[] = [
  {
    title: "Mount Washington Brief",
    href: "/files/mount-washington-brief.pdf",
    description:
      "Flying the Mt. Washington area wave from Gorham, NH, by John F. Good. This is required reading for all attending the wave camp — print a copy and bring it with you. Please respect John's copyright and do not reproduce this document for any purpose other than your own personal use.",
    meta: "PDF",
  },
  {
    title: "Oxygen Talk",
    href: "/files/oxygen-talk-1995.pdf",
    description:
      "The talk on oxygen systems given by Steele Lipe at the 1995 SSA Convention.",
    meta: "PDF",
  },
];

const oxygen: DocLink[] = [
  {
    title: "Hypoxia — Soaring, August 2018",
    href: "https://topfly-aero.com/wp-content/uploads/2018/12/SOARING-2018-08-Hypoxia-Article-proof.pdf",
    description:
      "The physiology of oxygen starvation at altitude, why it steals your judgment first, and what to do about it.",
    meta: "PDF",
    external: true,
  },
  {
    title: "Oxygen systems at high altitude (OSTIV/SSA, 2018)",
    href: "http://topfly.free.fr/2018_OXY_SSA_OSTIV.pdf",
    description:
      "A technical companion to the hypoxia article — oxygen equipment, delivery methods and failure modes.",
    meta: "PDF",
    external: true,
  },
  {
    title: "High altitude is hard on your brain — Soaring, May–July 2023",
    href: "https://drive.google.com/drive/folders/14BLIa1jBp8iw3Vl3JdCQwVyr0K_0Et_o",
    description:
      "A three-part series on decompression sickness: what it is, how to recognize it, and how to treat it. The treatment notes are blunt — recurrent symptoms warrant a hyperbaric chamber on 100% oxygen, and after DCS, no matter how mild, stand down for at least three days.",
    meta: "3 PDFs",
    external: true,
  },
];

const legal: DocLink[] = [
  {
    title: "Class A airspace waivers — Northcraft 2024 legal interpretation",
    href: "/files/2024-northcraft-legal-interpretation.pdf",
    description: "FAA Office of the Chief Counsel. Re: 14 CFR 91.135 — operations in Class A airspace.",
    meta: "PDF",
  },
  {
    title: "2026 Letter of Authorization (LOA)",
    href: "/files/2026-loa.pdf",
    description:
      "The current Certificate of Waiver or Authorization issued to the Mt Washington Soaring Association. A copy is hosted here for convenience; the signed original is kept at the field.",
    meta: "PDF",
  },
];

const charts = [
  {
    src: "/images/reading/moria-carter-se.webp",
    full: "/images/reading/moria-carter-se-full.png",
    alt: "Aerial view of the Moriah and Carter ranges looking southeast",
    caption: "Moriah Carter to SE",
    width: 690,
    height: 527,
  },
  {
    src: "/images/reading/presidential-range-nw.webp",
    full: "/images/reading/presidential-range-nw-full.png",
    alt: "Aerial view of the Presidential Range looking northwest",
    caption: "Presidential Range to NW",
    width: 690,
    height: 528,
  },
  {
    src: "/images/reading/gorham-area-nnw.webp",
    full: "/images/reading/gorham-area-nnw-full.png",
    alt: "Aerial view of the Gorham area looking north-northwest",
    caption: "Gorham Area to the NNW",
    width: 690,
    height: 526,
  },
];

export default function ImportantReadingPage() {
  return (
    <>
      <PageHero
        eyebrow="Before you fly"
        title="Important reading"
        lede="Wave flying is dangerous — one of the more dangerous activities that humans voluntarily engage in. With experience and care the risks can be lowered, but not eliminated. Read the published documents before you launch."
        image="/images/scenic/lenticular-wing.webp"
        imageAlt="A lenticular cloud seen past the wing of a glider"
        priority
      />

      <section className="py-16 sm:py-20">
        <Container>
          <div className="max-w-3xl space-y-6 text-[1.0625rem] leading-8 text-slate-700">
            <blockquote className="border-l-2 border-sky-300 pl-6 italic text-slate-600">
              “The best way to get sent to the back of the launch grid is to show up not having
              studied the published documents.”
            </blockquote>
            <p>
              Some aspects of safety in wave and mountain flying are presented here, but this is
              far from a complete discussion, and some of this material is not aimed at beginners.
              Pilots should strive to develop the judgment that will keep them safe, understanding
              that mountains such as these can present conditions in which even excellent aircraft
              and skilled pilots cannot safely fly.
            </p>
          </div>

          <div className="mt-14 space-y-20">
            <section>
              <SectionHeading
                eyebrow="Start here"
                title="Required reading"
                lede="Everyone attending the wave camp is expected to have studied these documents."
              />
              <div className="mt-8 grid gap-4 md:grid-cols-2">
                {required.map((doc) => (
                  <DocCard key={doc.href} doc={doc} />
                ))}
              </div>
            </section>

            <section>
              <SectionHeading
                eyebrow="Going high"
                title="Oxygen and the altitude brain"
                lede="Wave camp climbs routinely end above 12,500 feet, and the good ones above 18,000 — where oxygen, not skill, keeps the decisions sound. Read at least the hypoxia article before you fly high."
              />
              <div className="mt-8 grid gap-4 md:grid-cols-2">
                {oxygen.map((doc) => (
                  <DocCard key={doc.href} doc={doc} />
                ))}
              </div>
            </section>

            <section>
              <SectionHeading
                eyebrow="Weather judgment"
                title="Mind the window"
                lede="The wave lives and dies with its window. A day that looks flyable can close overhead within minutes — the question is never whether you are high enough, but whether you can still get down."
              />
              <p className="mt-6 max-w-3xl text-[1.0625rem] leading-8 text-slate-700">
                Above 18,000 feet, watch for the upstream openings: if the way in from the west is
                still clear, you have time. Below that — or on any day when the upstream sky has
                gone flat — you may get very little warning before the window snaps shut. Keep the
                downwind escape over Maine in mind as an option rather than a last resort, and
                choose it while you are still high, not once you are on the cloud tops. The
                camp&apos;s briefings put it shorter still: if it is not clear downwind, don&apos;t
                go up.
              </p>
            </section>

            <section>
              <SectionHeading
                eyebrow="Legal & regulatory"
                title="Airspace and authorization"
                lede="Legal interpretations and regulatory information pertinent to the wave camp."
              />
              <div className="mt-8 grid gap-4 md:grid-cols-2">
                {legal.map((doc) => (
                  <DocCard key={doc.href} doc={doc} />
                ))}
              </div>
            </section>

            <section>
              <SectionHeading
                eyebrow="Gorham (2G8)"
                title="Airport information"
                lede="Wave camp operations are based at Gorham Municipal Airport. Print a copy of the procedures — they are briefed at the daily pilots' meetings."
              />
              <div className="mt-8 grid gap-6 lg:grid-cols-2 lg:items-start">
                <DocCard
                  doc={{
                    title: "Gorham (2G8) pattern procedures (2023)",
                    href: "/files/gorham-pattern-procedures-2023.pdf",
                    description:
                      "Airport procedures for all wave campers. Print a copy and study it before the first launch.",
                    meta: "PDF",
                  }}
                />
                <figure className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-900/5">
                  <a
                    href="/images/reading/gorham-airport-zones-full.png"
                    target="_blank"
                    rel="noreferrer"
                    className="block"
                  >
                    <Image
                      src="/images/reading/gorham-airport-zones.webp"
                      alt="Parking map of the Gorham airport showing trailer and tiedown zones"
                      width={690}
                      height={317}
                      className="w-full"
                    />
                  </a>
                  <figcaption className="flex items-center justify-between gap-4 border-t border-slate-100 px-6 py-4">
                    <span className="text-sm text-slate-600">
                      Parking map — designated trailer and tiedown locations, and areas to keep
                      clear at all times.
                    </span>
                    <a
                      href="/images/reading/gorham-airport-zones-full.png"
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 text-sm font-medium text-sky-700 hover:text-sky-600"
                    >
                      View larger
                    </a>
                  </figcaption>
                </figure>
              </div>
            </section>

            <section>
              <SectionHeading
                eyebrow="Know the ground"
                title="Navigational references"
                lede="Pine Mountain, Hayes, Carter Dome, Mt Moriah, Madison, Jefferson, Washington, The Horn, Wildcat, The Great Gulf, Tuckerman's Ravine, Huntington Ravine, the Pilot Range and the Crescent Range are all good things to know."
              />
              <div className="mt-8 grid gap-6 md:grid-cols-3">
                {charts.map((chart) => (
                  <figure
                    key={chart.src}
                    className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-900/5"
                  >
                    <a href={chart.full} target="_blank" rel="noreferrer" className="block">
                      <Image
                        src={chart.src}
                        alt={chart.alt}
                        width={chart.width}
                        height={chart.height}
                        className="w-full"
                      />
                    </a>
                    <figcaption className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-3.5">
                      <span className="text-sm text-slate-700">{chart.caption}</span>
                      <a
                        href={chart.full}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 text-sm font-medium text-sky-700 hover:text-sky-600"
                      >
                        View larger
                      </a>
                    </figcaption>
                  </figure>
                ))}
              </div>

              <figure className="mt-6 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-900/5">
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
                    <a
                      href="/files/45-minute-diamond.igc"
                      className="text-sky-700 hover:text-sky-600"
                    >
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
            </section>

            <section id="electronic-files">
              <SectionHeading
                eyebrow="For your moving map"
                title="Electronic files"
                lede="Waypoints, airspace and task files for the Gorham area. Airspace files depict the 10-mile wave airspace (courtesy of Dave Sherrill)."
              />
              <div className="mt-8 grid gap-4 md:grid-cols-2">
                {navFiles.map((doc) => (
                  <DocCard key={doc.href} doc={doc} />
                ))}
              </div>
              <p className="mt-6 text-sm leading-7 text-slate-600">
                The Gorham, NH waypoint database is also maintained at{" "}
                <a
                  href="https://soaringweb.org/TP/Gorham"
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-sky-700 underline underline-offset-4 hover:text-sky-600"
                >
                  soaringweb.org/TP/Gorham
                </a>
                .
              </p>
            </section>

            <section>
              <SectionHeading
                eyebrow="Going somewhere"
                title="Wave cross-country flights"
                lede="When flagpole sitting in wave becomes routine, the area offers meaningful cross-country routes — but the landing options on the northern routes are sparse and sometimes distant from the course line."
              />
              <p className="mt-6 max-w-3xl text-sm leading-7 text-slate-600">
                The original “Mt. Washington Area Wave Cross-Country Glider Flights” document
                describes some possible routes. Not only the condition, but even the existence of
                some of the reported landing areas must be confirmed before attempting these
                routes. The original file has not been recovered — if you have a copy, please write
                to{" "}
                <a
                  href={`mailto:${site.email}`}
                  className="font-medium text-sky-700 underline underline-offset-4 hover:text-sky-600"
                >
                  {site.email}
                </a>
                .
              </p>
            </section>
          </div>
        </Container>
      </section>
    </>
  );
}
