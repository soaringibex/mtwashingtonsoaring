import type { MetadataRoute } from "next";
import { docYears } from "@/lib/documents";
import { posts } from "@/lib/news";
import { site } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const pages = [
    { path: "", priority: 1 },
    { path: "/history", priority: 0.8 },
    { path: "/important-reading", priority: 0.8 },
    { path: "/documents", priority: 0.8 },
    { path: "/gallery", priority: 0.7 },
    { path: "/accomplishments", priority: 0.6 },
    { path: "/news", priority: 0.6 },
    { path: "/press", priority: 0.5 },
    { path: "/links", priority: 0.5 },
    { path: "/contact", priority: 0.5 },
  ];

  return [
    ...pages.map((page) => ({
      url: `${site.url}${page.path}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: page.priority,
    })),
    ...docYears.map((year) => ({
      url: `${site.url}/documents/${year.year}`,
      lastModified: now,
      changeFrequency: "yearly" as const,
      priority: 0.4,
    })),
    ...posts.map((post) => ({
      url: `${site.url}/news/${post.slug}`,
      lastModified: new Date(post.date),
      changeFrequency: "yearly" as const,
      priority: 0.4,
    })),
  ];
}
