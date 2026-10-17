import type { Metadata } from "next";
import Image from "next/image";
import { PageHero } from "@/components/ui/PageHero";
import { Container } from "@/components/ui/Container";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { DocCard } from "@/components/ui/DocCard";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { NavFilesMap } from "@/components/flying/NavFilesMap";
import { campDocs, gorham, legal, oxygen, required } from "@/lib/flying";

export const metadata: Metadata = {
  title: "Flying here",
  description:
    "For pilots flying the Mount Washington wave — required reading, oxygen and altitude safety, airspace and the LOA, Gorham airport procedures, charts and moving-map files.",
};

export default function FlyingPage() {
  return (
    <>
      <PageHero
        eyebrow="For attending pilots"
        title="Flying here"
        lede="Everything needed before and during the wave camp — required reading, airspace and paperwork, the airport, and the files for your moving map."
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
            <section id="required">
              <SectionHeading
                eyebrow="Start here"
                title="Required reading"
                lede="Everyone attending the wave camp is expected to have studied these documents and reviewed the current waiver."
              />
              <div className="mt-8 grid gap-4 md:grid-cols-2">
                {required.filter((doc) => !doc.hidden).map((doc) => (
                  <DocCard key={doc.href ?? doc.page} doc={doc} />
                ))}
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
                    Above 18,000 feet, watch for the upstream openings: if the way in from the west
                    is still clear, you have time. Below that — or on any day when the upstream sky
                    has gone flat — you may get very little warning before the window snaps shut.
                    Keep the downwind escape over Maine in mind as an option rather than a last
                    resort, and choose it while you are still high, not once you are on the cloud
                    tops. The camp&apos;s briefings put it shorter still: if it is not clear
                    downwind, don&apos;t go up.
                  </p>
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
                      The sky closing over the ridge — Rick Roelke&apos;s timelapse from the 2026
                      camp.
                    </figcaption>
                  </figure>
                </div>
              </div>
            </section>

            <section>
              <SectionHeading
                eyebrow="Staying sharp"
                title="Safety at altitude"
                lede="Wave camp climbs routinely end above 12,500 feet, and the good ones above 18,000 — where oxygen, not skill, keeps the decisions sound. Read at least the hypoxia article before you fly high."
              />
              <div className="mt-8 grid gap-4 md:grid-cols-2">
                {oxygen.filter((doc) => !doc.hidden).map((doc) => (
                  <DocCard key={doc.href ?? doc.page} doc={doc} />
                ))}
              </div>
            </section>

            <section>
              <SectionHeading
                eyebrow="Legal & airspace"
                title="Airspace and paperwork"
                lede="The FAA legal interpretations behind the airspace operations. The current waiver itself lives in the required reading above."
              />
              <div className="mt-8 grid gap-4 md:grid-cols-2">
                {legal.filter((doc) => !doc.hidden).map((doc) => (
                  <DocCard key={doc.href ?? doc.page} doc={doc} />
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
                <div className="grid gap-4">
                  {gorham.filter((doc) => !doc.hidden).map((doc) => (
                    <DocCard key={doc.href ?? doc.page} doc={doc} />
                  ))}
                </div>
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

            <section id="electronic-files">
              <SectionHeading
                eyebrow="For your moving map"
                title="Electronic files"
                lede="The exchange's current Gorham waypoints and the LOA's Glider Area on one map — with every file in the viewer, built when it is asked for."
              />
              <div className="mt-8">
                <NavFilesMap />
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-5 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5 sm:p-7">
                <div className="max-w-2xl">
                  <p className="font-display text-base font-semibold text-slate-900">
                    The printable chart — range rings on paper
                  </p>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    The wave country from above at 1:450,000 on a full tabloid sheet: grey
                    dotted 5 NM glide rings around Gorham (2G8), each labelled with the
                    altitude home to 1,000 ft; the exchange&apos;s turnpoints, airports marked
                    with airplane icons; the rivers and lakes — and the LOA&apos;s glider area
                    ringed in red on the map and enlarged as the corner disc.
                  </p>
                </div>
                <ButtonLink
                  href="/files/gorham-range-rings.pdf"
                  variant="secondary"
                  track={{ event: "Download", file: "gorham-range-rings.pdf" }}
                >
                  Open the PDF
                </ButtonLink>
              </div>
            </section>

            <section>
              <SectionHeading
                eyebrow="Camp paperwork"
                title="Camp documents"
                lede="The camp information package and paperwork from past encampments."
              />
              <div className="mt-8 grid gap-4 md:grid-cols-2">
                {campDocs.filter((doc) => !doc.hidden).map((doc) => (
                  <DocCard key={doc.href ?? doc.page} doc={doc} />
                ))}
              </div>
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
                routes. The original file has not been recovered.
              </p>
            </section>
          </div>
        </Container>
      </section>
    </>
  );
}
