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
