import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Legacy Wild Apricot URLs → new locations
      { source: "/blog", destination: "/", permanent: true },
      { source: "/blog/2", destination: "/", permanent: true },
      {
        source: "/blog/news-2/when-is-the-gorham-wave-camp-held-1",
        destination: "/",
        permanent: true,
      },
      { source: "/contactus", destination: "/contact", permanent: true },
      { source: "/year-2024-documents", destination: "/flying", permanent: true },
      { source: "/year-2025-documents", destination: "/flying", permanent: true },
      { source: "/year-2026-documents", destination: "/flying", permanent: true },
      { source: "/important-reading", destination: "/flying", permanent: true },
      { source: "/documents", destination: "/flying", permanent: true },
      { source: "/documents/:year", destination: "/flying", permanent: true },
      { source: "/press", destination: "/more", permanent: true },
      { source: "/links", destination: "/more", permanent: true },
    ];
  },
};

export default nextConfig;
