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
          "Charles Stover, King George, Virginia, #1916",
          "Dan MacMonagle, Stoneham, Massachusetts, #1920",
        ],
      },
      { year: "2013", entries: ["Chris Giacomo, Huber Heights, Ohio, #1910"] },
      {
        year: "2011",
        entries: [
          "Roy Bourgeois, Worcester, Massachusetts, #1894",
          "Mark Hermann, Glastonbury, Connecticut, #pending",
          "Evan Ludeman, New Boston, New Hampshire, #1897",
          "Steve Waitekaitis, Norwell, Massachusetts, #1893",
          "Tim Chow, Norwich, Vermont, #1895",
        ],
      },
      {
        year: "2010",
        entries: [
          "John Good, Mill Creek, Pennsylvania, #1881",
          "Peter Stauble, Hollis, New Hampshire, #1882",
          "Todd Smith, Milford, Connecticut, #1883",
          "Jess Pauley, Campton, New Hampshire, #1884",
          "Doug Smith, Waltham, Massachusetts, #1887",
        ],
      },
      {
        year: "2007",
        entries: [
          "Jim David, Westford, Massachusetts, #1855",
          "Steve Voigt, Norwich, Vermont, #1854",
        ],
      },
      { year: "2002", entries: ["Andrew Lumley, Lyme Center, New Hampshire, #1782"] },
      { year: "2001", entries: ["Rick Roelke, Bedford, New Hampshire, #1748"] },
      {
        year: "2000",
        entries: [
          "Kevin Brooker, Post Mills, Vermont, #1727",
          "Andy Lawrence, Sanbornton, New Hampshire, #1728",
          "Rick Sheppe, Post Mills, Vermont, #1729",
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
      { year: "2024", entries: ["David Lysy, Lyme, New Hampshire"] },
      { year: "2016", entries: ["Glen Kelley, Bedford, New Hampshire"] },
      {
        year: "2015",
        entries: [
          "Daniel Sazhin, Brooklyn, New York",
          "Charles Stover, King George, Virginia",
          "Dan MacMonagle, Stoneham, Massachusetts",
          "Greg Hanlon, Lyme, New Hampshire",
          "Greg Delp, Woodbury, Connecticut",
          "Bill Hanson, Belle Harbor, New York",
          "George Young, Madison, Connecticut",
        ],
      },
      {
        year: "2013",
        entries: [
          "Chuck Waldo, Wolcott, Connecticut",
          "Pete Dodd, Solomons, Maryland",
          "Hank Nixon, Wayne, New Jersey",
          "Chris Giacomo, Huber Heights, Ohio",
        ],
      },
      { year: "2011", entries: ["Roy Bourgeois, Worcester, Massachusetts"] },
      {
        year: "2010",
        entries: [
          "Bob Morehardt, Longmeadow, Massachusetts",
          "Evan Ludeman, New Boston, New Hampshire",
          "Steve Arndt, Concord, New Hampshire",
          "Tom Hopper, Concord, New Hampshire",
          "Richard Kaleta, Bronx, New York",
          "Doug Smith, Waltham, Massachusetts",
          "Steve Waitekaitis, Norwell, Massachusetts",
          "Jess Pauley, Campton, New Hampshire",
          "Tim Chow, Norwich, Vermont",
        ],
      },
      { year: "2009", entries: ["Lee Blair, West Hartford, Connecticut"] },
      { year: "2008", entries: ["Andrzej Kobus, Lee, New Hampshire"] },
      {
        year: "2007",
        entries: [
          "Todd Smith, Milford, Connecticut",
          "Steve Voigt, Norwich, Vermont",
          "Thomas Scheidegger, Lebanon, New Hampshire",
        ],
      },
      { year: "2006", entries: ["Jim David, Westford, Massachusetts"] },
      {
        year: "2003",
        entries: [
          "Paul Acres, Hubbardston, Massachusetts",
          "Juan Mandelbaum, Brookline, Massachusetts",
        ],
      },
      {
        year: "2002",
        entries: [
          "Andrew Lumley, Lyme Center, New Hampshire",
          "Peter Stauble, Hollis, New Hampshire",
        ],
      },
      {
        year: "2001",
        entries: [
          "Rick Roelke, Bedford, New Hampshire",
          "Richard Kellerman, Kennett Square, Pennsylvania",
        ],
      },
      {
        year: "2000",
        entries: [
          "Kevin Brooker, Post Mills, Vermont",
          "Andy Lawrence, Sanbornton, New Hampshire",
          "Rick Sheppe, Post Mills, Vermont",
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
      { year: "2025", entries: ["Thomas Van de Velde, Brookline, Massachusetts"] },
      { year: "2024", entries: ["Emilie Phillips, Mason, New Hampshire", "David Sherrill, Westford, Massachusetts", "Tyson Sawyer, Mason, New Hampshire", "Nelson Howe, Marlborough, New Hampshire", "David Lysy, Lyme, New Hampshire"] },
      { year: "2017", entries: ["David Joyce, Brookline, New Hampshire"] },
      {
        year: "2015",
        entries: [
          "Robert Janney, Hackettstown, New Jersey, pending",
          "Robert Dunning, Bangor, Pennsylvania, pending",
          "Greg Delp, Woodbury, Connecticut",
          "Dan MacMonagle, Stoneham, Massachusetts",
        ],
      },
      { year: "2014", entries: ["George Young, Madison, Connecticut"] },
      {
        year: "2013",
        entries: [
          "Chris Giacomo, Huber Heights, Ohio",
          "Robert Rippstein, Hopewell Junction, New York",
          "Nikola Gradinski, New York, New York",
        ],
      },
      { year: "2012", entries: ["Greg Hanlon, Lyme, New Hampshire"] },
      { year: "2011", entries: ["Roy Bourgeois, Worcester, Massachusetts"] },
      {
        year: "2010",
        entries: [
          "Mark Hermann, Glastonbury, Connecticut",
          "Pete Dodd, Dowley, Maryland",
          "Sonny Cilley, Royalton, Vermont",
        ],
      },
      { year: "2009", entries: ["Tim Chow, Norwich, Vermont"] },
      { year: "2008", entries: ["Steve Arndt, Concord, New Hampshire"] },
      {
        year: "2007",
        entries: ["Doug Smith, Waltham, Massachusetts", "Steve Voigt, Norwich, Vermont"],
      },
      { year: "2004", entries: ["Jim David, Westford, Massachusetts"] },
      {
        year: "2003",
        entries: [
          "Steven Waitekaitis, Norwell, Massachusetts",
          "Peter Kettle, Fitchburg, Massachusetts",
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
