# Mt Washington Soaring Association — website

A modern rebuild of [mtwashingtonsoaring.org](https://www.mtwashingtonsoaring.org), the home of the
Mount Washington wave flying community in Gorham, New Hampshire.

**Live:** https://mtwashingtonsoaring.vercel.app

Built with **Next.js (App Router) + Tailwind CSS v4**, TypeScript, and `next/font` / `next/image`.
Every page is statically prerendered — deployable to Vercel with zero configuration.

## Getting started

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # asset check + production build (all routes prerendered)
npm run check:assets # fail if any /files or /images reference is missing
npm run lint         # ESLint
npm start            # serve the production build
```

## Pages

| Route | Content source |
| --- | --- |
| `/` | Home — hero with the 2026 camp recap, photo carousel and next-camp reading, club intro, gallery preview, founding clubs |
| `/history` | Full history essay, 1938 → today |
| `/accomplishments` | Lennie Pin / Diamond / Gold records by year |
| `/gallery` | Photo albums with a lightbox (2008–2026, archive) |
| `/news`, `/news/when-is-the-gorham-wave-camp-held` | News posts |
| `/press` | Published articles, rehosted PDFs where archived |
| `/videos` | Member videos from the wave camps, as embedded players |
| `/more` | Press clippings and the link groups — founding clubs, weather, education |
| `/important-reading` | Required briefing material, charts, navigation files |
| `/documents` + `/documents/2026 · 2025 · 2024` | Season paperwork and camp archive |

Legacy Wild Apricot URLs (`/blog/2`, `/contactus`, `/year-2024-documents`, …) redirect in
`next.config.ts`.

## Editing content

Content lives in typed data modules under `src/lib/` — edit these rather than page markup:

- `site.ts` — site metadata, nav, wave-camp date logic (Columbus Day weekend)
- `news.ts` — news posts (add an object; routes and sitemap update automatically)
- `documents.ts` — year documents, archive, navigation files
- `accomplishments.ts` — award records
- `links.ts` / `videos.ts` / `press.ts` / `gallery.ts` — everything else

Assets:

- `public/images/…` — scenic, gallery, reading charts, brand
- `public/files/…` — PDFs and the IGC/KMZ downloads (the waypoints and airspace files are
  built live from the Soaring Turnpoint Exchange — see `src/lib/nav-files.ts`)

## Legacy site tooling

The original Wild Apricot site was scraped by script so assets could be rehosted:

```bash
node scripts/fetch-legacy.mjs     # stage pages/assets into .legacy/ (gitignored)
node scripts/arrange-assets.mjs   # copy curated assets into public/
```

## Visual QA

Full-page screenshots of a running server, via Chrome DevTools Protocol:

```bash
npx next start -p 3001
BASE_URL=http://localhost:3001 node scripts/capture-pages.mjs   # → .screenshots/full/
```

## Deployment

Vercel hosts this site. Push the repository and import it at vercel.com — no environment
variables or special build settings are required. `www.mtwashingtonsoaring.org` can be pointed at
the deployment once DNS is moved.

## Analytics

Traffic is measured with [Umami Cloud](https://umami.is) — cookieless and privacy-friendly, so no
consent banner is needed. The tracker lives in `src/app/layout.tsx`; its website id and the
production-domain allow-list are in `src/lib/analytics.ts`. The id comes from the Umami dashboard
(Website → Tracking code).

Download clicks are recorded as `Download` events with `file` and `document` properties via
`data-umami-event-*` attributes. Add the same attributes to any new download link; the tracker
ignores everything else. Local development and Vercel preview deployments are excluded by
`data-domains`.

## Notes

- The association has no officers and no dues; the site is intentionally a static brochure with no
  member login. The old Wild Apricot sign-in area is not reproduced.
- There is no contact page and no contact address anywhere on the site: the club's mailing list
  is deliberately left off it, so it cannot collect drive-by signups — and with no contact form,
  no backend is needed.
