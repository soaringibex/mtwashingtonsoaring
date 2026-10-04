# Mt Washington Soaring Association — website

A modern rebuild of [mtwashingtonsoaring.org](https://www.mtwashingtonsoaring.org), the home of the
Mount Washington wave flying community in Gorham, New Hampshire.

**Live:** https://mtwashingtonsoaring-tawny.vercel.app

Built with **Next.js (App Router) + Tailwind CSS v4**, TypeScript, and `next/font` / `next/image`.
Every page is statically prerendered — deployable to Vercel with zero configuration.

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build (all routes prerendered)
npm run lint       # ESLint
npm start          # serve the production build
```

## Pages

| Route | Content source |
| --- | --- |
| `/` | Home — hero, countdown to the next wave camp, club intro, gallery preview, founding clubs |
| `/history` | Full history essay, 1938 → today |
| `/accomplishments` | Lennie Pin / Diamond / Gold records by year |
| `/gallery` | Photo albums with a lightbox (2024, 2023, archive) |
| `/news`, `/news/when-is-the-gorham-wave-camp-held` | News posts |
| `/press` | Published articles, rehosted PDFs where archived |
| `/links` | Founding clubs, weather, videos, educational references |
| `/important-reading` | Required briefing material, charts, navigation files |
| `/documents` + `/documents/2026 · 2025 · 2024` | Season paperwork and camp archive |
| `/contact` | Mailing list, location, webmaster |

Legacy Wild Apricot URLs (`/blog/2`, `/contactus`, `/year-2024-documents`, …) redirect in
`next.config.ts`.

## Editing content

Content lives in typed data modules under `src/lib/` — edit these rather than page markup:

- `site.ts` — site metadata, nav, mailing list address, wave-camp date logic (Columbus Day weekend)
- `news.ts` — news posts (add an object; routes and sitemap update automatically)
- `documents.ts` — year documents, archive, navigation files
- `accomplishments.ts` — award records
- `links.ts` / `press.ts` / `gallery.ts` — everything else

Assets:

- `public/images/…` — scenic, gallery, reading charts, brand
- `public/files/…` — PDFs, IGC/KMZ/CUP/SUA downloads

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

## Notes

- The association has no officers and no dues; the site is intentionally a static brochure with no
  member login. The old Wild Apricot sign-in area is not reproduced.
- Contact flows use the public mailing list address (`mwsoaring@googlegroups.com`) rather than a
  form, so no backend is needed.
