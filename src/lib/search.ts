import { awards } from "@/lib/accomplishments";
import { archiveDocs, docYears, navFiles } from "@/lib/documents";
import { albums } from "@/lib/gallery";
import { linkGroups } from "@/lib/links";
import { press } from "@/lib/press";
import { legal, oxygen, required } from "@/lib/reading";

export type SearchKind =
  | "page"
  | "reading"
  | "document"
  | "press"
  | "photo"
  | "history"
  | "achievement"
  | "link";

export type SearchEntry = {
  title: string;
  href: string;
  kind: SearchKind;
  section?: string;
  text?: string;
  keywords?: string;
};

export const kindLabels: Record<SearchKind, string> = {
  page: "Pages",
  reading: "Reading",
  document: "Documents",
  press: "Press",
  photo: "Photos",
  history: "History",
  achievement: "Accomplishments",
  link: "Links",
};

export const kindOrder: SearchKind[] = [
  "page",
  "reading",
  "document",
  "history",
  "press",
  "photo",
  "achievement",
  "link",
];

const pages: SearchEntry[] = [
  {
    title: "Home",
    href: "/",
    kind: "page",
    text: "The Mount Washington wave, the October encampment at Gorham, and the countdown to the next wave camp.",
    keywords: "index start wave camp gorham october columbus day dates next camp countdown",
  },
  {
    title: "Vertical wind profile — current conditions",
    href: "/#conditions",
    kind: "page",
    text: "The live column of wind over Gorham from the latest model run — speeds, directions and heights, refreshed hourly.",
    keywords: "current conditions wind live weather profile sounding gorham heights speeds",
  },
  {
    title: "History",
    href: "/history",
    kind: "page",
    text: "From Lewin Barringer's first wave flight in 1938 to today's annual camps — a century of flying the White Mountain wave.",
    keywords: "timeline 1938 1966 north conway gorham history",
  },
  {
    title: "Accomplishments",
    href: "/accomplishments",
    kind: "page",
    text: "The record book — Gold and Diamond altitude climbs, Lennie Pins and the New Hampshire altitude record.",
    keywords: "badges awards records climb altitude gold diamond lennie pin",
  },
  {
    title: "Photos",
    href: "/gallery",
    kind: "page",
    text: "Wave camp photo albums — the recent seasons and the archive.",
    keywords: "gallery pictures images albums wave camp",
  },
  {
    title: "Press",
    href: "/press",
    kind: "page",
    text: "Articles about the Mount Washington wave camps, from Soaring, Windswept, WMUR and more.",
    keywords: "media newspaper magazine articles clippings",
  },
  {
    title: "Documents",
    href: "/documents",
    kind: "page",
    text: "Season paperwork, letters of authorization, signup sheets and archived documents.",
    keywords: "loa waiver paperwork seasons signup",
  },
  {
    title: "Important reading",
    href: "/important-reading",
    kind: "page",
    text: "Required reading before you fly — the Mount Washington Brief, oxygen, airport procedures and navigational material.",
    keywords: "reading required brief oxygen procedure",
  },
  {
    title: "Links",
    href: "/links",
    kind: "page",
    text: "Founding clubs, member videos, educational and weather links.",
    keywords: "clubs videos weather education external sites",
  },
  {
    title: "Contact",
    href: "/contact",
    kind: "page",
    text: "Join the email list, find the field at Gorham (2G8), or reach the webmaster.",
    keywords: "email mailing list address location gorham map airport 2g8",
  },
];

const history: SearchEntry[] = [
  {
    title: "First wave flight in the United States (1938)",
    href: "/history",
    kind: "history",
    text: "Lewin Barringer's Ross R-2 Ibis climbed to 9,500 feet downwind of Mount Washington — later recognized as the first American wave flight.",
    keywords: "barringer ibis 1938 first wave",
  },
  {
    title: "The first Mount Washington wave camp (1966)",
    href: "/history",
    kind: "history",
    text: "Allan MacNicol's group returned to North Conway and found six diamonds and 14 gold climbs in nine days, starting the annual tradition.",
    keywords: "macnicol 1966 first camp diamonds gold",
  },
  {
    title: "Guy Gosselin and the summit observatory (1967)",
    href: "/history",
    kind: "history",
    text: "The Mount Washington Observatory's chief meteorologist began helping the glider pilots — then took his own eventful wave flight.",
    keywords: "gosselin observatory meteorologist weather 1967",
  },
  {
    title: "44 diamonds in a single day (1969)",
    href: "/history",
    kind: "history",
    text: "The best day in the original camp years — 44 diamond climbs claimed in one October day.",
    keywords: "1969 diamonds best day record",
  },
  {
    title: "The New Hampshire altitude record — 31,900 ft (1969)",
    href: "/history",
    kind: "history",
    text: "Bob Neumann's flight established the state altitude record, still the official mark.",
    keywords: "neumann record altitude 31900",
  },
  {
    title: "Walter Weir's 33,600 ft climb (1985)",
    href: "/history",
    kind: "history",
    text: "The unofficial altitude record, set on the 47th anniversary of Barringer's flight.",
    keywords: "weir record altitude 33600 unofficial 1985",
  },
  {
    title: "Wylie Apte's White Mountain Airport",
    href: "/history",
    kind: "history",
    text: "The old North Conway field — Rattlesnake ridge, the eight-mile dash to Fryeburg, and the land that is now the Settlers' Green outlets.",
    keywords: "north conway wylie airstrip rattlesnake fryeburg settlers green outlets airport",
  },
  {
    title: "Walter Striedieck at Gorham",
    href: "/history",
    kind: "history",
    text: "For many years a fixture on the tow line, flying his Pawnee and PW6 up from North Carolina.",
    keywords: "striedieck pawnee pw6 tow",
  },
  {
    title: "A National Landmark of Soaring (2005)",
    href: "/history",
    kind: "history",
    text: "Mount Washington dedicated as a National Landmark of Soaring, October 8, 2005.",
    keywords: "landmark 2005 dedication national",
  },
];

const reading: SearchEntry[] = [
  ...required.map((doc) => ({
    title: doc.title,
    href: doc.href,
    kind: "reading" as const,
    section: "Required reading",
    text: doc.description,
    keywords: "required reading pdf",
  })),
  ...oxygen.map((doc) => ({
    title: doc.title,
    href: doc.href,
    kind: "reading" as const,
    section: "Oxygen and the altitude brain",
    text: doc.description,
    keywords: "oxygen hypoxia decompression dcs altitude health",
  })),
  ...legal.map((doc) => ({
    title: doc.title,
    href: doc.href,
    kind: "reading" as const,
    section: "Airspace and authorization",
    text: doc.description,
    keywords: "legal loa waiver class a faa certificate authorization",
  })),
  {
    title: "Mind the window — weather judgment",
    href: "/important-reading",
    kind: "reading",
    section: "Weather judgment",
    text: "Wave windows close without much warning. Watch the upstream openings, keep the downwind escape over Maine in mind, and don't go up if it isn't clear downwind.",
    keywords: "window cloud imc downwind fryeburg safety briefing weather",
  },
  {
    title: "Aerial reference charts",
    href: "/important-reading",
    kind: "reading",
    section: "Know the ground",
    text: "Aerial photographs of the Moriah–Carter range, the Presidential Range and the Gorham area, for putting names to the landmarks below.",
    keywords: "moriah carter presidential range gorham aerial chart landmarks",
  },
];

const documents: SearchEntry[] = [
  ...docYears.flatMap((year) =>
    year.docs.map((doc) => ({
      title: doc.title,
      href: doc.href,
      kind: "document" as const,
      section: year.title,
      text: doc.description,
      keywords: /LOA/i.test(doc.title)
        ? "loa letter of authorization waiver certificate faa class a"
        : `${year.year} season paperwork`,
    })),
  ),
  ...archiveDocs.map((doc) => ({
    title: doc.title,
    href: doc.href,
    kind: "document" as const,
    section: "Archive",
    text: doc.description,
    keywords: "archive logbook briefing landing sites",
  })),
  ...navFiles.map((doc) => ({
    title: doc.title,
    href: doc.href,
    kind: "document" as const,
    section: "Navigational files",
    text: doc.description,
    keywords: "waypoints airspace cup igc kmz sua moving map",
  })),
];

const pressEntries: SearchEntry[] = press.map((item) => ({
  title: item.title,
  href: item.unavailable ? "/press" : (item.href ?? "/press"),
  kind: "press",
  section: `${item.source} · ${item.date}`,
  text: item.description,
  keywords: "article media press",
}));

const links: SearchEntry[] = linkGroups.flatMap((group) =>
  group.links.map((link) => ({
    title: link.title,
    href: link.href,
    kind: "link" as const,
    section: group.title,
    text: link.description,
    keywords: `${group.title} external`,
  })),
);

const photos: SearchEntry[] = albums.map((album) => ({
  title: album.title,
  href: "/gallery",
  kind: "photo",
  section: "Photo album",
  text: album.blurb,
  keywords: "photos pictures album images",
}));

const achievements: SearchEntry[] = awards.flatMap((award) =>
  award.years.flatMap((year) =>
    year.entries.map((entry) => ({
      title: entry,
      href: "/accomplishments",
      kind: "achievement" as const,
      section: `${award.title} · ${year.year}`,
      keywords: `${award.title} ${year.year} ${award.criterion}`,
    })),
  ),
);

export const searchEntries: SearchEntry[] = [
  ...pages,
  ...reading,
  ...documents,
  ...history,
  ...pressEntries,
  ...photos,
  ...achievements,
  ...links,
];

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const tokenize = (value: string) => normalize(value).split(/[^a-z0-9]+/).filter(Boolean);

type IndexedEntry = SearchEntry & {
  titleTokens: string[];
  sectionTokens: string[];
  keywordTokens: string[];
  bodyTokens: string[];
};

const indexed: IndexedEntry[] = searchEntries.map((entry) => ({
  ...entry,
  titleTokens: tokenize(entry.title),
  sectionTokens: tokenize(entry.section ?? ""),
  keywordTokens: tokenize(entry.keywords ?? ""),
  bodyTokens: tokenize(entry.text ?? ""),
}));

function bestTokenScore(token: string, tokens: string[], exact: number, prefix: number): number {
  let best = 0;
  for (const candidate of tokens) {
    if (candidate === token) return exact;
    if (candidate.startsWith(token)) best = Math.max(best, prefix);
  }
  return best;
}

export type SearchResult = SearchEntry & { score: number };

export function searchSite(query: string): SearchResult[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  const results: SearchResult[] = [];
  for (const entry of indexed) {
    let score = 0;
    let matchedAll = true;
    for (const token of tokens) {
      const best = Math.max(
        bestTokenScore(token, entry.titleTokens, 6, 4),
        bestTokenScore(token, entry.sectionTokens, 3.5, 2.5),
        bestTokenScore(token, entry.keywordTokens, 2, 1.5),
        bestTokenScore(token, entry.bodyTokens, 1, 1),
      );
      if (best === 0) {
        matchedAll = false;
        break;
      }
      score += best;
    }
    if (matchedAll) {
      results.push({
        title: entry.title,
        href: entry.href,
        kind: entry.kind,
        section: entry.section,
        text: entry.text,
        keywords: entry.keywords,
        score,
      });
    }
  }

  return results.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}
