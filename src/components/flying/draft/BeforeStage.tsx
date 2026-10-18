import Image from "next/image";
import { NavFilesMap } from "@/components/flying/NavFilesMap";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { DocCard } from "@/components/ui/DocCard";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { campDocs, gorham, oxygen, required } from "@/lib/flying";
import { ChecklistItem, Placeholder } from "./DraftShared";

const aerialCharts = [
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

export function BeforeStage({ campDatesLabel }: { campDatesLabel: string }) {
  return (
    <div className="space-y-16 sm:space-y-20">
      <section>
        <p className="max-w-3xl text-xl leading-9 text-slate-700">
          Arrive briefed, equipped and signed up.
        </p>
        <blockquote className="mt-8 max-w-3xl border-l-2 border-sky-300 pl-6 italic text-slate-600">
          “The best way to get sent to the back of the launch grid is to show up not having
          studied the published documents.”
        </blockquote>
      </section>

      <section>
        <SectionHeading
          title="Sign up"
          lede={`Wave camp runs ${campDatesLabel} at Gorham Municipal Airport (2G8).`}
        />
        <div className="mt-6 max-w-3xl space-y-4 text-[1.0625rem] leading-8 text-slate-700">
          <p>
            Signup is through the email list:{" "}
            <a
              href="mailto:mwsoaring@googlegroups.com"
              className="font-medium text-sky-700 underline underline-offset-4 hover:text-sky-600"
            >
              mwsoaring@googlegroups.com
            </a>
            .
          </p>
          <p>The 2016 camp information package is background on how the camp runs.</p>
        </div>
        <div className="mt-8 max-w-xl">
          <DocCard doc={campDocs[0]} />
        </div>
      </section>

      <section>
        <SectionHeading
          eyebrow="Start here"
          title="Required reading"
          lede="Everyone attending the wave camp is expected to have studied these documents and reviewed the current waiver."
        />
        <ul className="mt-8 grid gap-4">
          <ChecklistItem doc={required[0]} note="Print it and bring it with you." />
          <ChecklistItem doc={required[2]} note="Review it before arrival. Sign at the field." />
          <ChecklistItem doc={oxygen[0]} note="Soaring, August 2018. Read it before you fly high." />
        </ul>
      </section>

      <section>
        <SectionHeading
          eyebrow="Staying sharp"
          title="Oxygen and altitude"
          lede="Wave camp climbs routinely end above 12,500 feet, and the good ones above 18,000 — where oxygen, not skill, keeps the decisions sound. Read at least the hypoxia article before you fly high."
        />
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <DocCard doc={required[1]} />
          <DocCard doc={oxygen[1]} />
        </div>
        <div className="mt-6 max-w-3xl">
          <Placeholder topic="pre-trip oxygen system checklist" />
        </div>
      </section>

      <section>
        <SectionHeading
          eyebrow="Know the ground"
          title="Navigational references"
          lede="Pine Mountain, Hayes, Carter Dome, Mt Moriah, Madison, Jefferson, Washington, The Horn, Wildcat, The Great Gulf, Tuckerman's Ravine, Huntington Ravine, the Pilot Range and the Crescent Range are all good things to know."
        />
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {aerialCharts.map((chart) => (
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
        <div className="mt-6 max-w-xl">
          <DocCard doc={gorham[2]} />
        </div>
      </section>

      <section>
        <SectionHeading
          eyebrow="For your moving map"
          title="Electronic files"
          lede="The exchange's current Gorham waypoints and the LOA's Glider Area on one map — with every file in the viewer, built when it is asked for."
        />
        <div className="mt-8">
          <NavFilesMap showDiamondLink={false} />
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-5 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5 sm:p-7">
          <div className="max-w-2xl">
            <p className="font-display text-base font-semibold text-slate-900">
              The printable chart — range rings on paper
            </p>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              The wave country from above at 1:450,000 on a full tabloid sheet: grey dotted 5 NM
              glide rings around Gorham (2G8), each labelled with the altitude home to 1,000 ft;
              the exchange&apos;s turnpoints, airports marked with airplane icons; the rivers and
              lakes — and the LOA&apos;s glider area ringed in red on the map and enlarged as the
              corner disc.
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
          eyebrow="Gorham (2G8)"
          title="Airport information"
          lede="Wave camp operations are based at Gorham Municipal Airport. Print a copy of the procedures — they are briefed at the daily pilots' meetings."
        />
        <div className="mt-8 grid gap-6 lg:grid-cols-2 lg:items-start">
          <div className="grid gap-4">
            <DocCard doc={gorham[0]} />
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
                Parking map — designated trailer and tiedown locations, and areas to keep clear at
                all times.
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
        <SectionHeading title="Travel and lodging" />
        <div className="mt-6 max-w-3xl">
          <Placeholder topic="travel and lodging" />
        </div>
      </section>

      <section>
        <SectionHeading title="Packing list" />
        <div className="mt-6 max-w-3xl">
          <Placeholder topic="packing list" />
        </div>
      </section>
    </div>
  );
}
