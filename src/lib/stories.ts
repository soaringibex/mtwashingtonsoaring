import type { DocLink } from "@/lib/flying";

export type StoryGroup = {
  id: string;
  title: string;
  blurb?: string;
  stories: DocLink[];
};

export const storyGroups: StoryGroup[] = [
  {
    id: "accounts",
    title: "First-hand accounts",
    blurb: "What it is actually like up there — including the days that go sideways.",
    stories: [
      {
        title: "The Mountains Win Again",
        href: "/files/the-mountains-win-again-2015.pdf",
        page: "/stories/the-mountains-win-again-2015",
        description:
          "Chris Giacomo's account of his 2015 bailout, with lessons learned — required reading in spirit as much as in fact.",
        meta: "PDF",
      },
      {
        title: "Greenhorn in the White Mountains",
        href: "/files/greenhorn-in-the-white-mountains.pdf",
        page: "/stories/greenhorn-in-the-white-mountains",
        description:
          "A novice's preparation and experience at the 2013 encampment.",
        meta: "PDF",
      },
    ],
  },
  {
    id: "early-years",
    title: "From the early years",
    blurb: "The camps before Gorham — White Mountain Airport, North Conway.",
    stories: [
      {
        title: "Recollections of the wave camps: 1979–1984",
        href: "/files/recollections-of-the-wave-camps-1979-1984.pdf",
        page: "/stories/recollections-of-the-wave-camps-1979-1984",
        description:
          "Wayne Knapp, November 29, 2018 — wave camps at White Mountain Airport, North Conway.",
        meta: "PDF",
      },
      {
        title: "National Landmark of Soaring dedication — October 8, 2005",
        href: "/files/national-landmark-of-soaring-dedication-2005.pdf",
        description:
          "The program from the day Mount Washington was dedicated as a National Landmark of Soaring.",
        meta: "PDF",
      },
    ],
  },
  {
    id: "logbooks",
    title: "Camp logbooks",
    blurb: "Day-by-day records from past encampments.",
    stories: [
      {
        title: "2021 camp logbook — Glen Kelley",
        href: "/files/2021-wave-camp-logbook-glen-kelley.pdf",
        page: "/stories/2021-wave-camp-logbook-glen-kelley",
        meta: "PDF",
      },
      {
        title: "2016 camp logbook — Rick Roelke",
        href: "/files/2016-wave-camp-logbook-rick-roelke.pdf",
        page: "/stories/2016-wave-camp-logbook-rick-roelke",
        meta: "PDF",
      },
    ],
  },
];

export const stories: DocLink[] = storyGroups.flatMap((group) => group.stories);
