import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const pages = [
    { path: "", priority: 1 },
    { path: "/history", priority: 0.8 },
    { path: "/flying", priority: 0.8 },
    { path: "/stories", priority: 0.6 },
    { path: "/gallery", priority: 0.7 },
    { path: "/accomplishments", priority: 0.6 },
    { path: "/press", priority: 0.5 },
    { path: "/links", priority: 0.5 },
    { path: "/contact", priority: 0.5 },
  ];

  return pages.map((page) => ({
    url: `${site.url}${page.path}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: page.priority,
  }));
}
