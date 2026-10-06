export type DocLink = {
  title: string;
  href: string;
  /** Web edition of the document, when one exists (the PDF stays as the download). */
  page?: string;
  description?: string;
  meta?: string;
  external?: boolean;
};

/** Start here — required before flying the camp. */
export const required: DocLink[] = [
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
    page: "/flying/oxygen-talk-1995",
    description: "The talk on oxygen systems given by Steele Lipe at the 1995 SSA Convention.",
    meta: "PDF",
  },
  {
    title: "2026 Letter of Authorization (LOA)",
    href: "/files/2026-loa.pdf",
    page: "/flying/2026-loa",
    description:
      "The current Certificate of Waiver or Authorization issued to the Mt Washington Soaring Association — all attendees review and sign it before flying. A copy is hosted here for convenience; the signed original is kept at the field.",
    meta: "PDF",
  },
  {
    title: "2027–2028 LOA revalidation — Boston ARTCC memo",
    href: "/files/2027-2028-loa-revalidation.pdf",
    page: "/flying/2027-2028-loa-revalidation",
    description:
      "Boston ARTCC's acknowledgment that the Society wishes to continue the joint LOA dated October 14, 2021 — the agreement continues unchanged, with the next revalidation due by September 22, 2028.",
    meta: "PDF",
  },
];

/** Staying sharp at altitude. */
export const oxygen: DocLink[] = [
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

/** Airspace, waivers and the paperwork behind the operations. */
export const legal: DocLink[] = [
  {
    title: "Class A airspace waivers — Northcraft 2024 legal interpretation",
    href: "/files/2024-northcraft-legal-interpretation.pdf",
    page: "/flying/2024-northcraft-legal-interpretation",
    description: "FAA Office of the Chief Counsel. Re: 14 CFR 91.135 — operations in Class A airspace.",
    meta: "PDF",
  },
  {
    title: "Rescinding the Kortokrax legal interpretation",
    href: "/files/2024-memo-rescinding-kortokrax.pdf",
    page: "/flying/2024-memo-rescinding-kortokrax",
    description:
      "Memorandum, August 16, 2024 — the Kortokrax interpretation (August 22, 2006) was rescinded as of July 23, 2023.",
    meta: "PDF",
  },
  {
    title: "Rescinding the Fretwell legal interpretation",
    href: "/files/2024-memo-rescinding-fretwell.pdf",
    page: "/flying/2024-memo-rescinding-fretwell",
    description:
      "Memorandum, August 16, 2024 — the Fretwell interpretation (September 18, 1995) was rescinded as of July 23, 2023.",
    meta: "PDF",
  },
  {
    title: "Rescinding the Olshock legal interpretation",
    href: "/files/2024-memo-rescinding-olshock.pdf",
    page: "/flying/2024-memo-rescinding-olshock",
    description:
      "Memorandum, August 16, 2024 — the Olshock interpretation (May 4, 2007) was rescinded as of July 23, 2023.",
    meta: "PDF",
  },
  {
    title: "Rescinding the Schaffner legal interpretation",
    href: "/files/2024-memo-rescinding-schaffner.pdf",
    page: "/flying/2024-memo-rescinding-schaffner",
    description:
      "Memorandum, August 16, 2024 — the Schaffner interpretation (May 5, 2014) was rescinded as of July 23, 2023.",
    meta: "PDF",
  },
];

/** The field and the ground around it. */
export const gorham: DocLink[] = [
  {
    title: "Gorham (2G8) pattern procedures (2023)",
    href: "/files/gorham-pattern-procedures-2023.pdf",
    page: "/flying/gorham-pattern-procedures-2023",
    description:
      "Airport procedures for all wave campers. Print a copy and study it before the first launch — they are briefed at the daily pilots' meetings.",
    meta: "PDF",
  },
  {
    title: "Unofficial list of Gorham landing sites (May 2, 2013)",
    href: "/files/gorham-landing-sites-2013.pdf",
    page: "/flying/gorham-landing-sites-2013",
    description:
      "Worldwide Soaring Turnpoint Exchange coordinates for Gorham control points and landmarks, courtesy of Evan Ludeman.",
    meta: "PDF",
  },
];

/** Paperwork for the camp itself. */
export const campDocs: DocLink[] = [
  {
    title: "Wave Camp 2024 signup",
    href: "https://docs.google.com/spreadsheets/d/1QqAfY1uB0M5ioKqful38e9puV7iPFJ9299Z0-GEaUps/edit?gid=0#gid=0",
    description:
      "Last public signup spreadsheet — an example of what the current-season sheet looks like. Current signups go out over the email list each season.",
    meta: "Google Sheets",
    external: true,
  },
  {
    title: "Mount Washington wave camp information (2016)",
    href: "/files/2016-wave-camp-information.pdf",
    page: "/flying/2016-wave-camp-information",
    description: "Camp information package from the 2016 encampment — still useful background.",
    meta: "PDF",
  },
];

/** Files for the moving map and flight computer. */
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
    description:
      "Courtesy of Dave Sherrill — depicts the 10-mile wave airspace on your moving map.",
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

/** Every flying-here document, for the reading routes and the sitemap. */
export const flyingDocs: DocLink[] = [
  ...required,
  ...oxygen,
  ...legal,
  ...gorham,
  ...campDocs,
  ...navFiles,
];
