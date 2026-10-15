export type Video = {
  /** YouTube video id — the embed and watch URLs are built from it. */
  id: string;
  title: string;
  /** Year of the camp or flight, when known. */
  year?: number;
  /** Who filmed it. */
  credit?: string;
  description?: string;
};

/** Newest first. */
export const videos: Video[] = [
  {
    id: "ZSoiPQ-SPuE",
    title: "Ascent from Crawford Notch",
    year: 2021,
    credit: "Evan Ludeman",
    description:
      "Evan Ludeman's late-afternoon flight — 40 minutes of raw video that starts at Crawford Notch and ends near 18,000 feet in the wave over Mount Washington.",
  },
  {
    id: "KPZrNwZzhqU",
    title: "Wave camp 2015",
    year: 2015,
    credit: "Steve Waitekaitis",
    description: "The field at Gorham during the 2015 camp.",
  },
  {
    id: "0FJJH6CjBNY",
    title: "Mt Washington Wave Camp 2014",
    year: 2014,
    credit: "Steve Waitekaitis",
    description: "From the cockpit — climbing above the cloud deck at the 2014 camp.",
  },
  {
    id: "WaQm3Y7Njj8",
    title: "Wave Camp Mt Washington 2013",
    year: 2013,
    credit: "Steve Waitekaitis",
    description: "A wave flight over the Presidential Range during the 2013 camp.",
  },
  {
    id: "AcrREDvTv5w",
    title: "Mt Washington 10/10/10",
    year: 2010,
    credit: "Evan Ludeman",
    description: "Mount Washington yields a perfect 11-knot climb on 10/10/10.",
  },
  {
    id: "8xAl6apxKx4",
    title: "Soaring the Wave at Mt. Washington",
    year: 2007,
    credit: "Eric Foertsch",
  },
];
