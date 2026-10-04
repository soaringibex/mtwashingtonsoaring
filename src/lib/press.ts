export type PressItem = {
  title: string;
  source: string;
  date: string;
  href?: string;
  external?: boolean;
  unavailable?: boolean;
  description?: string;
};

export const press: PressItem[] = [
  {
    title: "UFO-like lenticular cloud forms over White Mountains",
    source: "WMUR",
    date: "November 26, 2025",
    href: "https://www.wmur.com/article/ufo-lenticular-cloud-white-mountains-nh-112525/69546486",
    external: true,
  },
  {
    title: "Diamond climbs in a 1-26 at the 1966 Mount Washington Wave Camp",
    source: "1-26 Association Newsletter",
    date: "Winter 2024–25",
    href: "https://www.126association.org/wp-content/uploads/2025/04/1-26-Newsltr-Wtr2425.pdf",
    external: true,
  },
  {
    title: "Wave camp feature",
    source: "The Berlin Reporter",
    date: "October 17, 2007",
    unavailable: true,
    description: "The original file has not been recovered.",
  },
  {
    title: "Glimpse of “A Timeless Sky”",
    source: "Windswept",
    date: "Spring 2005",
    href: "/files/press/glimpse-of-a-timeless-sky-windswept-2005.pdf",
  },
  {
    title: "Riding the Wave",
    source: "Windswept",
    date: "Spring 2002",
    href: "/files/press/riding-the-wave-windswept-2002.pdf",
  },
  {
    title: "Diamonds Before Breakfast",
    source: "Soaring Magazine",
    date: "October 2001",
    href: "https://soaringweb.org/Soaring_Index/2001/2001_issue.html#2001October",
    external: true,
  },
  {
    title: "A Letter from the Mt. Washington Wave",
    source: "Soaring Magazine",
    date: "March 1971",
    href: "/files/press/letter-from-the-mt-washington-wave-soaring-1971.pdf",
  },
  {
    title: "The 1968 Mount Washington Wave Camp",
    source: "Soaring Magazine",
    date: "March 1969",
    href: "/files/press/the-1968-mount-washington-wave-camp.pdf",
  },
  {
    title: "A Timeless Sky",
    source: "Soaring Magazine",
    date: "February 1968",
    href: "/files/press/a-timeless-sky-soaring-1968.pdf",
  },
  {
    title: "Waves, East and West",
    source: "Soaring Magazine",
    date: "February 1967",
    href: "/files/press/waves-east-and-west-soaring-1967.pdf",
  },
];
