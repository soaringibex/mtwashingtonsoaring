import type { MetadataRoute } from "next";
import { flyingDocs } from "@/lib/flying";
import { site } from "@/lib/site";
import { stories } from "@/lib/stories";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const pages = [
    { path: "", priority: 1 },
    { path: "/history", priority: 0.8 },
    { path: "/flying", priority: 0.8 },
    { path: "/wx", priority: 0.7 },
    { path: "/stories", priority: 0.6 },
    { path: "/gallery", priority: 0.7 },
    { path: "/accomplishments", priority: 0.6 },
    { path: "/more", priority: 0.5 },
    { path: "/contact", priority: 0.5 },
  ];
  const readingPage = [...stories, ...flyingDocs].filter((doc) => doc.page);

  return [
    ...pages.map((page) => ({
      url: `${site.url}${page.path}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: page.priority,
    })),
    ...readingPage.map((doc) => ({
      url: `${site.url}${doc.page}`,
      lastModified: now,
      changeFrequency: "yearly" as const,
      priority: 0.4,
    })),
  ];
}
