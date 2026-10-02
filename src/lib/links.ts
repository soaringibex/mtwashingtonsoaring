export type ExternalLink = {
  title: string;
  href: string;
  description?: string;
};

export type LinkGroup = {
  id: string;
  title: string;
  blurb?: string;
  links: ExternalLink[];
};

export const linkGroups: LinkGroup[] = [
  {
    id: "clubs",
    title: "Founding clubs",
    blurb:
      "The wave camp is carried by four New England soaring clubs. Their members provide the tow planes, gliders, equipment and people that make the encampment happen.",
    links: [
      {
        title: "Franconia Soaring Association",
        href: "http://franconiasoaring.org",
        description:
          "New Hampshire's only soaring club, based at Franconia Airport in the White Mountains. Scenic rides, introduction flights, glider rentals, instruction and towing.",
      },
      {
        title: "Greater Boston Soaring Club",
        href: "https://www.soargbsc.net",
        description:
          "A non-profit club with over 120 members, three tow planes and eight gliders — from robust trainers to speedy cross-country ships.",
      },
      {
        title: "New England Soaring Association",
        href: "https://www.flynesa.com",
        description:
          "Founded in 1951, reported to be the oldest continuously operating soaring club in the United States. Flies from Hartness State Airport (KVSF), Springfield, Vermont.",
      },
      {
        title: "Post Mills Soaring Club",
        href: "https://flypmsc.org",
        description:
          "Formed in 1987 to bring affordable soaring to the Upper Connecticut River Valley, with a fleet that includes a Schweizer 2-33, Blanik L-23, 1-26 and an HpH 304C.",
      },
    ],
  },
  {
    id: "videos",
    title: "Member videos",
    links: [
      {
        title: "2007 video from Eric Foertsch",
        href: "https://www.youtube.com/watch?v=8xAl6apxKx4",
      },
      {
        title: "2010 video from Evan Ludeman",
        href: "http://www.youtube.com/watch?v=AcrREDvTv5w",
        description: "Mount Washington yields a perfect 11-knot climb on 10/10/10.",
      },
    ],
  },
  {
    id: "education",
    title: "Educational links",
    links: [
      {
        title: "U.S. Naval Flight Surgeons Manual",
        href: "https://web.archive.org/web/20251001102151/http://www.operationalmedicine.org/TextbookFiles/FlightSurgeonsManual.pdf",
        description: "See Chapter 1 for information on oxygen. Archived copy.",
      },
      {
        title: "Mountain Waves and Downslope Winds",
        href: "https://www.meted.ucar.edu/education_training/lesson/140",
        description: "An interactive online study guide for forecasters from UCAR. Registration required.",
      },
      {
        title: "Why does the wave wave?",
        href: "https://www.youtube.com/watch?v=IqzsAvTxK6s",
        description: "Lecture by G. Dale.",
      },
    ],
  },
  {
    id: "weather",
    title: "Weather links",
    blurb: "Planning your wave day in the Mount Washington area? Start here.",
    links: [
      {
        title: "Current summit conditions",
        href: "https://mountwashington.org/weather/mount-washington-weather/",
        description: "Mount Washington summit — current weather conditions.",
      },
      {
        title: "Regional weather",
        href: "https://mountwashington.org/weather/regional-weather/",
        description: "Mount Washington Observatory — regional weather and forecasts.",
      },
      {
        title: "Weather products",
        href: "https://mountwashington.org/weather",
        description: "Mount Washington Observatory — various weather products.",
      },
      {
        title: "Other weather resources",
        href: "https://mountwashington.org/weather/weather-resources/",
        description: "All the ways the Observatory helps you discover the weather.",
      },
    ],
  },
  {
    id: "other",
    title: "Other",
    links: [
      {
        title: "Cloud Appreciation Society",
        href: "https://cloudappreciationsociety.org/",
        description:
          "The society for people who love the sky. Artists, scientists, cloudspotters and dreamers welcome.",
      },
    ],
  },
];
