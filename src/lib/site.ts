export const site = {
  name: "Mt Washington Soaring Association",
  shortName: "Mt Washington Soaring",
  url: "https://www.mtwashingtonsoaring.org",
  description:
    "The Mount Washington Soaring Association explores the atmospheric wave of the White Mountains of New Hampshire in gliders. Every October, pilots gather at Gorham for the annual wave camp.",
  email: "mwsoaring@googlegroups.com",
  location: {
    airport: "Gorham Municipal Airport (2G8)",
    town: "Gorham, New Hampshire",
  },
  sponsor: {
    name: "Data Minds Consulting",
    url: "https://www.data-minds.com",
  },
  nav: [
    { href: "/flying", label: "Flying here", beta: false },
    { href: "/stories", label: "Stories", beta: false },
    { href: "/history", label: "History", beta: false },
    { href: "/accomplishments", label: "Accomplishments", beta: false },
    { href: "/flights", label: "Flights", beta: false },
    { href: "/gallery", label: "Photos", beta: false },
    { href: "/more", label: "More", beta: false },
    { href: "/wx", label: "Wavecast", beta: true },
  ],
} as const;

/** The Friday before Columbus Day — the day the annual wave camp opens (flying starts the next morning). */
export function waveCampStart(year: number): Date {
  // Columbus Day (US) is the second Monday of October.
  const oct1 = new Date(year, 9, 1);
  const firstMonday = 1 + ((8 - oct1.getDay()) % 7);
  const columbusDay = new Date(year, 9, firstMonday + 7);
  // The camp opens the Friday before Columbus Day, and runs through the Sunday a week later.
  return new Date(year, 9, columbusDay.getDate() - 3);
}

export function nextWaveCamp(from: Date = new Date()): { start: Date; end: Date } {
  let year = from.getFullYear();
  let start = waveCampStart(year);
  // If the following weekend has fully passed, aim at next year.
  const end = new Date(start);
  end.setDate(end.getDate() + 9);
  if (from > end) {
    year += 1;
    start = waveCampStart(year);
    end.setDate(start.getDate() + 9);
    end.setFullYear(start.getFullYear());
  }
  return { start, end };
}
