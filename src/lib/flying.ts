export type DocLink = {
  title: string;
  /** Download of the original document — normally the PDF. Absent for web-native stories. */
  href?: string;
  /** Web edition of the document, when one exists (the PDF stays as the download). */
  page?: string;
  description?: string;
  meta?: string;
  external?: boolean;
  /** Kept in the data so the page stays reachable by direct link, but not listed on
   * the flying page or in search — e.g. content awaiting review. */
  hidden?: boolean;
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
    description:
      "The current Certificate of Waiver or Authorization issued to the Mt Washington Soaring Association — all attendees review and sign it before flying. A copy is hosted here for convenience; the signed original is kept at the field.",
    meta: "PDF",
  },
  {
    title: "2027–2028 LOA revalidation — Boston ARTCC memo",
    href: "/files/2027-2028-loa-revalidation.pdf",
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
  {
    title: "Refilling an oxygen bottle",
    page: "/flying/oxygen-refill",
    description:
      "A step-by-step cascade transfill, demonstrated by Rick Roelke at the 2026 camp — from purging the line to bleeding it before the fittings come apart.",
    meta: "Guide",
    hidden: true,
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
  {
    title: "Scouting the Glen House Fields",
    page: "/stories/scouting-the-glen-house-fields",
    description:
      "David Sherrill's 2026 ground survey of the fields behind The Glen House, at the base of the Mt. Washington Auto Road — walked, measured and photographed, with what a landing there would really be like.",
    meta: "Report",
  },
];

/** Paperwork for the camp itself. */
export const campDocs: DocLink[] = [
  {
    title: "Mount Washington wave camp information (2016)",
    href: "/files/2016-wave-camp-information.pdf",
    page: "/flying/2016-wave-camp-information",
    description: "Camp information package from the 2016 encampment — still useful background.",
    meta: "PDF",
  },
];

/** Every flying-here document, for the reading routes and the sitemap. */
export const flyingDocs: DocLink[] = [
  ...required,
  ...oxygen,
  ...legal,
  ...gorham,
  ...campDocs,
];
