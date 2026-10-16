import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Imagery ships with the deployment and new photos get new filenames, so both
        // the browser and the image optimizer may keep these forever. Without this the
        // files answer `max-age=0, must-revalidate`, and that low max-age also caps the
        // optimizer's own cache — so every cold miss re-encodes the photo (seconds).
        source: "/images/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
  images: {
    // Belt and braces with the header above: the optimizer keeps its variants a year
    // rather than the 4-hour default, inside each deployment (URLs carry the build id).
    minimumCacheTTL: 31536000,
  },
  async redirects() {
    return [
      // The moving-map files are built at request time now — waypoints straight from
      // the Soaring Turnpoint Exchange, airspace from its current NASR issue with the
      // club's glider area merged in. Old links (camp emails, bookmarks) land on the
      // live downloads.
      {
        source: "/files/gorham-waypoints.cup",
        destination: "/api/nav/download?file=waypoints-cup",
        permanent: true,
      },
      {
        source: "/files/allusa-with-mwsa-glider-area.sua",
        destination: "/api/nav/download?file=airspace-allusa-sua",
        permanent: true,
      },
      {
        source: "/files/allusa-with-mwsa-glider-area.txt",
        destination: "/api/nav/download?file=airspace-allusa-openair",
        permanent: true,
      },
      {
        source: "/files/mwsa-glider-area.sua",
        destination: "/api/nav/download?file=airspace-glider-sua",
        permanent: true,
      },
      {
        source: "/files/mwsa-glider-area.txt",
        destination: "/api/nav/download?file=airspace-glider-openair",
        permanent: true,
      },
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
      // The LOA revalidation memo stays in its original format — no web edition; the
      // brief-lived reading URL points at the signed PDF.
      {
        source: "/flying/2027-2028-loa-revalidation",
        destination: "/files/2027-2028-loa-revalidation.pdf",
        permanent: true,
      },
      // The wave story's route now matches its title.
      {
        source: "/stories/three-ways-into-the-wave",
        destination: "/stories/stepping-up-to-the-wave",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
