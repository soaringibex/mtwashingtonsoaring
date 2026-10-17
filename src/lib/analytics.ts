/**
 * Umami Cloud analytics (https://umami.is).
 *
 * The website id is not a secret — it ships in the page HTML either way — but it
 * is per-site, so it lives here rather than being repeated in the layout.
 *
 * `domains` is an allow-list: the tracker only runs on production hostnames, so
 * localhost and Vercel preview deployments stay out of the numbers. Umami matches
 * these against `window.location.hostname`, so each entry must be exact.
 */
export const umami = {
  /** Website → the site → Tracking code → `data-website-id`. */
  websiteId: "40a86b07-c043-43ea-b50c-3488e3c09d8f",
  scriptUrl: "https://cloud.umami.is/script.js",
  domains: [
    "mtwashingtonsoaring.org",
    "www.mtwashingtonsoaring.org",
    // The Vercel production alias, until the association's DNS points here.
    "mtwashingtonsoaring.vercel.app",
  ],
} as const;
