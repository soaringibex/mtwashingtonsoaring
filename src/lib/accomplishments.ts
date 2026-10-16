export type Award = {
  id: string;
  title: string;
  criterion: string;
  /** Nominal altitude for the climb visual, in feet. */
  ft: number;
  blurb: string;
  years: { year: string; entries: string[] }[];
};

export const awards: Award[] = [
  {
    id: "lennie-pin",
    title: "Lennie Pin",
    criterion: "for flights above 25,000 feet",
    ft: 25000,
    blurb:
      "The Lennie Pin recognizes pilots who have climbed above 25,000 feet in the Mount Washington wave.",
    years: [
      {
        year: "2015",
        entries: [
          "Charles Stover, King George, VA, #1916",
          "Dan MacMonagle, Stoneham, MA, #1920",
        ],
      },
      { year: "2013", entries: ["Chris Giacomo, Huber Heights, OH, #1910"] },
      {
        year: "2011",
        entries: [
          "Roy Bourgeois, Worcester, MA, #1894",
          "Mark Hermann, Glastonbury, CT, #pending",
          "Evan Ludeman, New Boston, NH, #1897",
          "Steve Waitekaitis, Norwell, MA, #1893",
          "Tim Chow, Norwich, VT, #1895",
        ],
      },
      {
        year: "2010",
        entries: [
          "John Good, Mill Creek, PA, #1881",
          "Peter Stauble, Hollis, NH, #1882",
          "Todd Smith, Milford, CT, #1883",
          "Jess Pauley, Campton, NH, #1884",
          "Doug Smith, Waltham, MA, #1887",
        ],
      },
      {
        year: "2007",
        entries: [
          "Jim David, Westford, MA, #1855",
          "Steve Voigt, Norwich, VT, #1854",
        ],
      },
      { year: "2002", entries: ["Andrew Lumley, Lyme Center, NH, #1782"] },
      { year: "2001", entries: ["Rick Roelke, Bedford, NH, #1748"] },
      {
        year: "2000",
        entries: [
          "Kevin Brooker, Post Mills, VT, #1727",
          "Andy Lawrence, Sanbornton, NH, #1728",
          "Rick Sheppe, Post Mills, VT, #1729",
        ],
      },
    ],
  },
  {
    id: "diamond-altitude",
    title: "Diamond Altitude",
    criterion: "for a climb of 5,000 meters",
    ft: 16404,
    blurb:
      "Diamond climbs are the currency of the Mount Washington wave — several hundred were recorded in the original wave camp years alone.",
    years: [
      {
        year: "2026",
        entries: [
          "Thomas Van de Velde, Brookline, MA",
          "Jared Granzow, Columbus, OH, pending",
          "Nelson Howe, Marlborough, NH, pending",
        ],
      },
      { year: "2024", entries: ["David Lysy, Lyme, NH"] },
      { year: "2016", entries: ["Glen Kelley, Bedford, NH"] },
      {
        year: "2015",
        entries: [
          "Daniel Sazhin, Brooklyn, NY",
          "Charles Stover, King George, VA",
          "Dan MacMonagle, Stoneham, MA",
          "Greg Hanlon, Lyme, NH",
          "Greg Delp, Woodbury, CT",
          "Bill Hanson, Belle Harbor, NY",
          "George Young, Madison, CT",
        ],
      },
      {
        year: "2013",
        entries: [
          "Chuck Waldo, Wolcott, CT",
          "Pete Dodd, Solomons, MD",
          "Hank Nixon, Wayne, NJ",
          "Chris Giacomo, Huber Heights, OH",
        ],
      },
      { year: "2011", entries: ["Roy Bourgeois, Worcester, MA"] },
      {
        year: "2010",
        entries: [
          "Bob Morehardt, Longmeadow, MA",
          "Evan Ludeman, New Boston, NH",
          "Steve Arndt, Concord, NH",
          "Tom Hopper, Concord, NH",
          "Richard Kaleta, Bronx, NY",
          "Doug Smith, Waltham, MA",
          "Steve Waitekaitis, Norwell, MA",
          "Jess Pauley, Campton, NH",
          "Tim Chow, Norwich, VT",
        ],
      },
      { year: "2009", entries: ["Lee Blair, West Hartford, CT"] },
      { year: "2008", entries: ["Andrzej Kobus, Lee, NH"] },
      {
        year: "2007",
        entries: [
          "Todd Smith, Milford, CT",
          "Steve Voigt, Norwich, VT",
          "Thomas Scheidegger, Lebanon, NH",
        ],
      },
      { year: "2006", entries: ["Jim David, Westford, MA"] },
      {
        year: "2003",
        entries: [
          "Paul Acres, Hubbardston, MA",
          "Juan Mandelbaum, Brookline, MA",
        ],
      },
      {
        year: "2002",
        entries: [
          "Andrew Lumley, Lyme Center, NH",
          "Peter Stauble, Hollis, NH",
        ],
      },
      {
        year: "2001",
        entries: [
          "Rick Roelke, Bedford, NH",
          "Richard Kellerman, Kennett Square, PA",
        ],
      },
      {
        year: "2000",
        entries: [
          "Kevin Brooker, Post Mills, VT",
          "Andy Lawrence, Sanbornton, NH",
          "Rick Sheppe, Post Mills, VT",
        ],
      },
    ],
  },
  {
    id: "gold-altitude",
    title: "Gold Altitude",
    criterion: "for flights above 3,000 meters",
    ft: 9843,
    blurb: "Gold climbs below 20,000 feet became known around the east as an “Eastern Diamond.”",
    years: [
      {
        year: "2026",
        entries: ["Chris Stokes, Cambridge, MA, pending", "David Tauber, New Castle, NH, pending"],
      },
      { year: "2025", entries: ["Thomas Van de Velde, Brookline, MA"] },
      { year: "2024", entries: ["Emilie Phillips, Mason, NH", "David Sherrill, Westford, MA", "Tyson Sawyer, Mason, NH", "Nelson Howe, Marlborough, NH", "David Lysy, Lyme, NH"] },
      { year: "2017", entries: ["David Joyce, Brookline, NH"] },
      {
        year: "2015",
        entries: [
          "Robert Janney, Hackettstown, NJ, pending",
          "Robert Dunning, Bangor, PA, pending",
          "Greg Delp, Woodbury, CT",
          "Dan MacMonagle, Stoneham, MA",
        ],
      },
      { year: "2014", entries: ["George Young, Madison, CT"] },
      {
        year: "2013",
        entries: [
          "Chris Giacomo, Huber Heights, OH",
          "Robert Rippstein, Hopewell Junction, NY",
          "Nikola Gradinski, New York, NY",
        ],
      },
      { year: "2012", entries: ["Greg Hanlon, Lyme, NH"] },
      { year: "2011", entries: ["Roy Bourgeois, Worcester, MA"] },
      {
        year: "2010",
        entries: [
          "Mark Hermann, Glastonbury, CT",
          "Pete Dodd, Dowley, MD",
          "Sonny Cilley, Royalton, VT",
        ],
      },
      { year: "2009", entries: ["Tim Chow, Norwich, VT"] },
      { year: "2008", entries: ["Steve Arndt, Concord, NH"] },
      {
        year: "2007",
        entries: ["Doug Smith, Waltham, MA", "Steve Voigt, Norwich, VT"],
      },
      { year: "2004", entries: ["Jim David, Westford, MA"] },
      {
        year: "2003",
        entries: [
          "Steven Waitekaitis, Norwell, MA",
          "Peter Kettle, Fitchburg, MA",
        ],
      },
    ],
  },
];

export type RecordEntry = { ft: number; pilot: string; date: string };
export type RecordRow = {
  gliderClass: string;
  absolute: RecordEntry;
  gain: RecordEntry;
};

/**
 * New Hampshire records, General category — as listed in the Soaring Society of
 * America's record table. Motorglider Multiplace, 13.5-Meter, Ultralight Glider and
 * Sports class carry no record.
 */
export const nhRecords: RecordRow[] = [
  {
    gliderClass: "Open Class Singleplace",
    absolute: { ft: 32513, pilot: "Timothy Chow", date: "October 9, 2018" },
    gain: { ft: 29537, pilot: "Timothy Chow", date: "October 9, 2018" },
  },
  {
    gliderClass: "Open Class Multiplace",
    absolute: { ft: 26414, pilot: "Alfred L. Speckman", date: "October 28, 1968" },
    gain: { ft: 20669, pilot: "Alfred L. Speckman", date: "October 28, 1968" },
  },
  {
    gliderClass: "Motorglider Singleplace",
    absolute: { ft: 33733, pilot: "Malcolm Stevenson", date: "October 25, 1985" },
    gain: { ft: 32595, pilot: "Malcolm Stevenson", date: "October 25, 1985" },
  },
  {
    gliderClass: "15-Meter Class",
    absolute: { ft: 31390, pilot: "Robert Newman", date: "October 22, 1974" },
    gain: { ft: 24950, pilot: "Todd Pattist", date: "October 14, 1997" },
  },
  {
    gliderClass: "Standard Class",
    absolute: { ft: 29000, pilot: "William Nockles", date: "October 18, 1970" },
    gain: { ft: 26000, pilot: "William Nockles", date: "October 18, 1970" },
  },
];

export type ClimbTier = {
  id: string;
  label: string;
  ft: number;
};

/** Anchor points for the altitude rail, in climb order. */
export const climbTiers: ClimbTier[] = [
  { id: "base", label: "Gorham", ft: 835 },
  { id: "tier-gold", label: "Gold", ft: 9843 },
  { id: "tier-diamond", label: "Diamond", ft: 16404 },
  { id: "tier-lennie", label: "Lennie Pin", ft: 25000 },
  { id: "tier-summit", label: "Records", ft: 33600 },
];
