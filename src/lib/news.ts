export type Post = {
  slug: string;
  title: string;
  date: string;
  dateLabel: string;
  author: string;
  excerpt: string;
  body: string[];
};

export const posts: Post[] = [
  {
    slug: "when-is-the-gorham-wave-camp-held",
    title: "When is the Gorham Wave Camp held?",
    date: "2025-02-05",
    dateLabel: "February 5, 2025",
    author: "Data Minds",
    excerpt:
      "The Gorham Wave Camp is an annual event held from Columbus Day weekend through the following weekend in Gorham, New Hampshire. Glider pilots gather to experience spectacular soaring conditions created by wave lift over the Presidential Range, particularly Mount Washington.",
    body: [
      "The Gorham Wave Camp is an annual event held from Columbus Day weekend through the following weekend in Gorham, New Hampshire. Glider pilots gather to experience spectacular soaring conditions created by wave lift over the Presidential Range, particularly Mount Washington.",
      "Interested pilots should check with local gliding clubs for registration and related information.",
    ],
  },
];
