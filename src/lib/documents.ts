export type DocLink = {
  title: string;
  href: string;
  description?: string;
  meta?: string;
  external?: boolean;
};

export type DocYear = {
  year: string;
  title: string;
  blurb: string;
  docs: DocLink[];
};

export const docYears: DocYear[] = [
  {
    year: "2026",
    title: "2026 documents",
    blurb: "Current-season paperwork for the 2026 wave camp.",
    docs: [
      {
        title: "2026 Letter of Agreement (LOA)",
        href: "/files/2026-loa.pdf",
        description:
          "Certificate of Waiver or Authorization issued to the Mt Washington Soaring Association. A copy is hosted here for convenience.",
        meta: "PDF",
      },
    ],
  },
  {
    year: "2025",
    title: "2025 documents",
    blurb: "Documents for the 2025 season will be posted here as they become available.",
    docs: [],
  },
  {
    year: "2024",
    title: "2024 documents",
    blurb: "Season paperwork, legal interpretations and the 2024 letter of authorization.",
    docs: [
      {
        title: "Wave Camp 2024 signup",
        href: "https://docs.google.com/spreadsheets/d/1QqAfY1uB0M5ioKqful38e9puV7iPFJ9299Z0-GEaUps/edit?gid=0#gid=0",
        description: "Signup spreadsheet for the 2024 encampment.",
        meta: "Google Sheets",
        external: true,
      },
      {
        title: "Class A airspace waivers — Northcraft 2024 legal interpretation",
        href: "/files/2024-northcraft-legal-interpretation.pdf",
        description: "Re: 14 CFR 91.135 — operations in Class A airspace.",
        meta: "PDF",
      },
      {
        title: "2024 LOA",
        href: "/files/2024-loa.pdf",
        description:
          "Certificate of Waiver or Authorization issued to the Mt Washington Soaring Association.",
        meta: "PDF",
      },
      {
        title: "Rescinding the Kortokrax legal interpretation",
        href: "/files/2024-memo-rescinding-kortokrax.pdf",
        description:
          "Memorandum, August 16, 2024 — the Kortokrax interpretation (August 22, 2006) was rescinded as of July 23, 2023.",
        meta: "PDF",
      },
      {
        title: "Rescinding the Fretwell legal interpretation",
        href: "/files/2024-memo-rescinding-fretwell.pdf",
        description:
          "Memorandum, August 16, 2024 — the Fretwell interpretation (September 18, 1995) was rescinded as of July 23, 2023.",
        meta: "PDF",
      },
      {
        title: "Rescinding the Olshock legal interpretation",
        href: "/files/2024-memo-rescinding-olshock.pdf",
        description:
          "Memorandum, August 16, 2024 — the Olshock interpretation (May 4, 2007) was rescinded as of July 23, 2023.",
        meta: "PDF",
      },
      {
        title: "Rescinding the Schaffner legal interpretation",
        href: "/files/2024-memo-rescinding-schaffner.pdf",
        description:
          "Memorandum, August 16, 2024 — the Schaffner interpretation (May 5, 2014) was rescinded as of July 23, 2023.",
        meta: "PDF",
      },
    ],
  },
];

export const archiveDocs: DocLink[] = [
  {
    title: "Mount Washington Brief",
    href: "/files/mount-washington-brief.pdf",
    description:
      "Flying the Mt. Washington area wave from Gorham, NH, by John F. Good. Required reading for everyone attending the wave camp. Please respect the author's copyright and do not reproduce this document for any purpose other than personal use.",
    meta: "PDF",
  },
  {
    title: "Gorham (2G8) pattern procedures (2023)",
    href: "/files/gorham-pattern-procedures-2023.pdf",
    description:
      "Airport procedures for wave campers. Print a copy — they are briefed at the daily pilots' meetings.",
    meta: "PDF",
  },
  {
    title: "2021 camp logbook — Glen Kelley",
    href: "/files/2021-wave-camp-logbook-glen-kelley.pdf",
    meta: "PDF",
  },
  {
    title: "2016 camp logbook — Rick Roelke",
    href: "/files/2016-wave-camp-logbook-rick-roelke.pdf",
    meta: "PDF",
  },
  {
    title: "Mount Washington wave camp information (2016)",
    href: "/files/2016-wave-camp-information.pdf",
    meta: "PDF",
  },
  {
    title: "The Mountains Win Again",
    href: "/files/the-mountains-win-again-2015.pdf",
    description: "Chris Giacomo's account of his 2015 bailout, with lessons learned.",
    meta: "PDF",
  },
  {
    title: "Greenhorn in the White Mountains",
    href: "/files/greenhorn-in-the-white-mountains.pdf",
    description: "A novice's preparation and experience at the 2013 encampment.",
    meta: "PDF",
  },
  {
    title: "Unofficial list of Gorham landing sites (May 2, 2013)",
    href: "/files/gorham-landing-sites-2013.pdf",
    description:
      "Worldwide Soaring Turnpoint Exchange coordinates for Gorham control points and landmarks, courtesy of Evan Ludeman.",
    meta: "PDF",
  },
  {
    title: "National Landmark of Soaring dedication — October 8, 2005",
    href: "/files/national-landmark-of-soaring-dedication-2005.pdf",
    description:
      "Mount Washington, New Hampshire, dedicated as a National Landmark of Soaring.",
    meta: "PDF",
  },
  {
    title: "Soaring Magazine, March 1987",
    href: "/files/soaring-magazine-1987-03.pdf",
    description:
      "Locate “Or What's a Heaven For” on page 15 — and check page 44 for the Soaring Safety Foundation article on oxygen systems and high-altitude physiology.",
    meta: "PDF",
  },
  {
    title: "Recollections of the wave camps: 1979–1984",
    href: "/files/recollections-of-the-wave-camps-1979-1984.pdf",
    description: "Wayne Knapp, November 29, 2018 — wave camps at White Mountain Airport, North Conway.",
    meta: "PDF",
  },
];

export const navFiles: DocLink[] = [
  {
    title: "45-Minute Diamond",
    href: "/files/45-minute-diamond.igc",
    description: "IGC file showing the Mt Hays to primary transition.",
    meta: "IGC",
  },
  {
    title: "Landing places — Gorham 100-mile area",
    href: "/files/gorham-landing-places.kmz",
    description:
      "Open in Google Earth. Shows landing places within about 100 miles of Gorham. There is no guarantee any field will be landable when you need it — use your own judgment.",
    meta: "KMZ",
  },
  {
    title: "Gorham area waypoints",
    href: "/files/gorham-waypoints.cup",
    description: "Waypoint file appropriate for the wave camp.",
    meta: "CUP",
  },
  {
    title: "Glider area only — Newport-Peace (TopHat, XCSoar)",
    href: "/files/mwsa-glider-area.sua",
    meta: "SUA",
  },
  {
    title: "All USA airspace with the glider area — Newport-Peace",
    href: "/files/allusa-with-mwsa-glider-area.sua",
    description: "Courtesy of Dave Sherrill — depicts the 10-mile wave airspace on your moving map.",
    meta: "SUA",
  },
  {
    title: "Glider area only — OpenAir (SeeYou Navigator)",
    href: "/files/mwsa-glider-area.txt",
    meta: "TXT",
  },
  {
    title: "All USA airspace with the glider area — OpenAir",
    href: "/files/allusa-with-mwsa-glider-area.txt",
    meta: "TXT",
  },
];
