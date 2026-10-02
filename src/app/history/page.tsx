import type { Metadata } from "next";
import Image from "next/image";
import { PageHero } from "@/components/ui/PageHero";
import { Container } from "@/components/ui/Container";
import { Prose } from "@/components/ui/Prose";

export const metadata: Metadata = {
  title: "History",
  description:
    "For almost a century, glider pilots have been drawn to the White Mountains of New Hampshire — from Lewin Barringer's first wave flight in 1938 to today's annual wave camps at Gorham.",
};

const references = [
  "Anon, “News From Clubs and Members,” Soaring, Vol. 2, No. 11, November 1938, p. 10.",
  "Anon, “Regional Ramblings,” Soaring, Vol. 32, No. 10, October 1967, p. 30.",
  "Barringer, Lewin B., “White Mountain Winds,” Soaring, Vol. 2, No. 12, December 1938, pp. 2–3, 11.",
  "Barringer, Lewin B., Flight Without Power, Pitman Publishing Corporation, New York, 1940, revised 1942, pp. 192–195.",
  "Ibid, pp. 143–144.",
  "Ibid (1940 edition), p. 220.",
  "Brooker, Kevin, Soaring, Vol. 66, No. 1, January 2002, p. 9.",
  "Brooker, Kevin, “Diamonds Before Breakfast,” Soaring, Vol. 65, No. 10, October 2001, pp. 28–30.",
  "du Pont, Stephen, “The 1968 Mount Washington Wave Camp,” Soaring, Vol. 33, No. 3, March 1969, pp. 11–13.",
  "English, William D., “The Barringer Trophy,” NSM, A Quarterly Journal of the National Soaring Museum, Vol. 2, No. 4, Fall 1978, p. 3.",
  "Good, John F., “Flying Mt. Washington Area Wave from Gorham, NH,” Ver. 3.1, PMSC Web, October 2003.",
  "Gosselin, Guy, “A Timeless Sky,” Soaring, Vol. 32, No. 2, February 1968, p. 12.",
  "MacNicol, Allan, “Waves, East and West,” Soaring, Vol. 32, No. 2, February 1967, pp. 13–15.",
  "Posegate, Ann, “Glimpse of ‘A Timeless Sky,’” Windswept, The Quarterly Bulletin of the Mount Washington Observatory, Vol. 46, No. 1, Spring 2005, pp. 38–42.",
  "Sanborn, Doug, “Riding the Wave,” Windswept, The Quarterly Bulletin of the Mount Washington Observatory, Vol. 43, No. 1, Spring 2002, pp. 30–33.",
  "Schweizer, Paul, Wings Like Eagles, Smithsonian Institution Press, Washington and London, 1988.",
  "Wolters, Richard, “A Letter from the Mt. Washington Wave,” Soaring, Vol. 35, No. 3, March 1971, pp. 20–22.",
  "Wolters, Richard A., Once Upon a Thermal, Soaring Society of America, Santa Monica, 1974, pp. 91–105.",
];

export default function HistoryPage() {
  return (
    <>
      <PageHero
        eyebrow="Since 1938"
        title="A century of flying the White Mountain wave"
        lede="For almost a century, glider pilots have been drawn to the White Mountains of New Hampshire. The remote location and rugged terrain make it unlikely that a permanent soaring site will ever be established near Mount Washington — yet pilots still make the effort to go there, and all who have experienced the Mount Washington wave have shared with each other, and with those who came before them, the pioneering spirit."
        image="/images/scenic/ridge-glider.webp"
        imageAlt="A glider soaring over a dark ridge in the White Mountains"
        priority
      />

      <section className="py-16 sm:py-24">
        <Container className="max-w-4xl">
          <Prose>
            <h2>Beginnings</h2>
            <p>
              In October 1938, Lewin Barringer traveled from Philadelphia to visit his friend Eliot
              Noyes in Intervale, New Hampshire. The purpose of the visit was to investigate the
              possibility of soaring in the vicinity of New Hampshire&apos;s White Mountains. The
              two spent an enjoyable weekend flying around the mountains in “two Wacos and two
              Aeroncas.”<sup>[1]</sup> Barringer was so impressed that he made plans to return two
              weeks later with his Ross R-2 Ibis sailplane.
            </p>
            <p>
              The results of the second trip were reported in the December 1938 issue of Soaring
              Magazine.<sup>[3]</sup> Barringer made a total of five flights in the Ibis, and one
              of them<sup>[6]</sup> is now widely considered to be the first wave flight to take
              place in the United States. His maximum altitude of 9,500 feet was achieved in the
              lee of the Presidential Range, just downwind of Mount Washington (elev. 6,288 feet).
              It is not likely that Barringer understood the standing wave phenomenon. In his
              report he described rising through a layer of stratocumulus clouds:
            </p>
            <blockquote>
              So followed an hour of dodging in and out of the clouds during which I experienced
              three times thermals of at least 20 feet per second, in the holes between the
              clouds. I also noticed that the clouds on the lee side of these holes were thicker
              than on the windward side. On the last and strongest thermal I climbed over 1,500
              feet above the sea of clouds until my altimeter read just over 9,500 feet.
              <sup>[3]</sup>
            </blockquote>
            <p>It is very unlikely that this was thermal lift.</p>
            <p>
              Barringer&apos;s failure to recognize his flight as a wave flight persisted through
              1942. In the second edition of his book, <em>Flight Without Power</em>, there is a
              section on “Altitude Soaring,” in which he describes only cloud flying as a means of
              achieving great heights.<sup>[4]</sup> Interestingly, in the “Soaring Meteorology”
              chapter of the same book, the standing wave phenomenon is properly described.
              <sup>[5]</sup> The author of that chapter, MIT Professor Karl O. Lange, gives John
              Robinson credit for the first U.S. wave flight, in 1940. Finally, Lange mentions
              Mount Washington as a place where waves might occur. One wonders if the contributors
              to this book ever read each other&apos;s chapters.
            </p>

            <div className="not-prose my-10 grid gap-3 sm:grid-cols-2">
              <Image
                src="/images/scenic/summit-cover.webp"
                alt="A glider over the snow-covered Mount Washington summit"
                width={350}
                height={263}
                className="aspect-[4/3] w-full rounded-3xl object-cover"
              />
              <Image
                src="/images/scenic/summit-observatory.webp"
                alt="The Mount Washington summit and observatory from the air"
                width={660}
                height={492}
                className="aspect-[4/3] w-full rounded-3xl object-cover"
              />
            </div>

            <h2>The middle period</h2>
            <p>
              We have no records of soaring activity at Mount Washington between 1938 and 1966.
              During that period, wave soaring techniques were developed in the Rocky Mountains,
              and many eastern pilots traveled to Tehachapi, California, and Colorado Springs to
              get their altitude diamonds. Back east, wave soaring was practiced in very few
              places, most notably in the Blue Ridge mountains of Virginia and the Green Mountains
              of Vermont.
            </p>
            <p>
              By the mid-60s, a Massachusetts pilot, Allan MacNicol, was probably the most
              experienced pilot in both Appalachian and Rocky Mountain wave systems. He knew the
              Barringer story, and decided that Mount Washington was worth another look, now that
              the mountain wave phenomenon was much better understood.
            </p>
            <p>
              In the fall of 1966 MacNicol led a hardy band of New England glider pilots in
              Barringer&apos;s footsteps: back to North Conway and the Mount Washington wave.
              <sup>[13]</sup> The results of the first “wave camp” were so good — six diamonds and
              14 gold climbs in nine days — that a tradition of annual wave camps was started.
              From 1966 to 1985 wave camps were held every October, most of them based at the
              North Conway airport. As experience was gained, fewer and fewer long aerotows to the
              primary wave were made (the airport is 17 miles from Mount Washington). Pilots
              learned that they could release in the secondary or tertiary wave, or even in ridge
              lift, and still make a good climb.
            </p>
            <p>
              Word quickly spread. Several Canadian pilots joined the group, traveling from as far
              away as Windsor, Ontario. The number of trips made by eastern pilots to California
              and Colorado diminished, and a diamond climb that stayed below 20,000 feet became
              known as an “Eastern Diamond.”
            </p>
            <p>
              Also during this period, a relationship developed between the glider pilots and the
              meteorologists on the top of the mountain. The Mount Washington Observatory has
              maintained a full-time presence on the summit since 1932 (scientists there recorded
              the highest-ever surface wind speed, 231 mph, in the spring of 1934). The chief
              meteorologist in 1967 was a man named Guy Gosselin. After helping the glider pilots
              with numerous weather observations and forecasts, Mr. Gosselin finally took a ride
              in a Schweizer 2-32 with pilot Mike Stevenson. It was an eventful flight. The two
              ridge-soared the “front side” of the mountain (a first) and landed out at the
              Gorham, New Hampshire airfield, 26 miles from North Conway. Mr. Gosselin, an
              excellent writer, published the story simultaneously in Soaring<sup>[12]</sup> and in
              the MWO Bulletin. The tradition of giving our MWO friends first-hand “atmospheric
              experiences” continues today.<sup>[14] [15]</sup>
            </p>
            <p>
              Records from this original series of wave camps survive, and several hundred diamond
              climbs were recorded during this period. The very best single day occurred in 1969,
              when 44 diamonds were claimed. In 1969 Bob Neumann established the current New
              Hampshire altitude record (31,900 feet). This altitude has been exceeded unofficially
              several times since then.
            </p>
            <p>
              The Mount Washington wave became known to readers of Soaring in a series of
              articles.<sup>[2] [9] [12] [17]</sup> Well-known soaring author Richard Wolters
              described his experiences in his book, <em>Once Upon a Thermal</em>,<sup>[18]</sup>{" "}
              and Paul Schweizer included this historical period in <em>Wings Like Eagles</em>.
              <sup>[16]</sup>
            </p>
            <p>
              For a brief time (1973–1975), Brooks Dodge ran the wave camp from Glen, New
              Hampshire, only 8 miles from the primary lift area. However, on good wave days, the
              secondary rotor was always parked right over the little airfield. Some good flights
              were made out of Glen, but in 1976 the operation moved back to North Conway.
            </p>
            <p>
              On the 47th anniversary of Barringer&apos;s flight (October 25, 1985), Walter Weir
              set the unofficial record with a flight to 33,600 feet.
            </p>
            <p>
              Then in 1986, the North Conway airport was sold to a real estate developer and closed
              for good. The airfield at Glen was also gone, and suddenly there was no access to the
              wave. An attempt was made to reach the wave from Fryeburg, Maine, in 1990, but the
              distance from the airport to the high ground was too great to be practical.
            </p>

            <h2>Recent history</h2>
            <p>
              The Nutmeg Soaring Association, led by Ron Clifford and Jim Wright, returned to
              Mount Washington in 1993. They flew from the Gorham, New Hampshire airfield, which
              was an innovative idea. Gorham had a reputation of being a tricky place to fly for
              two reasons: the primary rotor and the non-existence of any alternate place to land.
              The Nutmeggers figured out how to tow around the rotor to the primary lift, and they
              always seemed to get back to the airfield. They operated wave camps there until
              1996.
            </p>
            <p>
              During the 1999 and 2000 wave seasons, the Post Mills Soaring Club sent a few
              experienced pilots from their home field in Vermont to Gorham. They determined that,
              with certain safety precautions, Gorham could become their new base for wave camps.
              It was also clear that the challenge was to find alternatives to the long high
              aerotows to the primary.
            </p>
            <p>
              The following year, an extremely successful weekend camp was held (six diamonds,
              four Lennie pins, a flight to 32,000 feet),<sup>[7] [8]</sup> and at least two
              alternatives to the high aerotows were developed. Safety procedures were worked out,
              and a comprehensive safety briefing document was produced.<sup>[11]</sup>
            </p>
            <p>
              PMSC was joined by the largest club in New England, the Greater Boston Soaring Club,
              and now the wave camps are bigger than ever, spanning more than ten days each
              October. Lewin Barringer&apos;s spirit of exploration lives on as well: the
              feasibility of cross-country wave flights has been demonstrated, and further x-c
              flights are planned.
            </p>

            <div className="not-prose my-10">
              <Image
                src="/images/scenic/ridge-yellow.webp"
                alt="A yellow glider flying along a ridge in the White Mountains"
                width={660}
                height={442}
                className="aspect-[16/9] w-full rounded-3xl object-cover"
              />
            </div>

            <h2>References</h2>
          </Prose>

          <ol className="mt-6 grid gap-3 text-sm leading-6 text-slate-500 sm:grid-cols-2">
            {references.map((reference, index) => (
              <li key={reference} className="flex gap-2">
                <span className="shrink-0 font-semibold text-slate-400">{index + 1}.</span>
                <span>{reference}</span>
              </li>
            ))}
          </ol>
        </Container>
      </section>
    </>
  );
}
