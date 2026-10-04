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
      { source: "/year-2024-documents", destination: "/documents/2024", permanent: true },
      { source: "/year-2025-documents", destination: "/documents", permanent: true },
      { source: "/year-2026-documents", destination: "/documents/2026", permanent: true },
    ];
  },
};

export default nextConfig;
