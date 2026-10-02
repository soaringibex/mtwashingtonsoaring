// Fetches public pages from the legacy Wild Apricot site and stages images/files.
// Usage: node scripts/fetch-legacy.mjs
// Output: .legacy/pages/*.html, .legacy/images/*, .legacy/files/*, .legacy/assets.json

import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

const BASE = "https://www.mtwashingtonsoaring.org";
const OUT = ".legacy";

const PAGES = [
  "/",
  "/history",
  "/accomplishments",
  "/gallery",
  "/links",
  "/important-reading",
  "/documents",
  "/press",
  "/year-2024-documents",
  "/year-2025-documents",
  "/year-2026-documents",
  "/contactus",
  "/blog/2",
  "/blog",
  "/blog/our-blog-1",
  "/blog/news-2/when-is-the-gorham-wave-camp-held-1",
];

const EXT_BY_TYPE = {
  "image/webp": ".webp",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/svg+xml": ".svg",
  "application/pdf": ".pdf",
  "text/plain": ".txt",
};

function slugify(page) {
  return (page === "/" ? "home" : page.replace(/^\//, ""))
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "");
}

function fileNameFor(url, contentType) {
  const decoded = decodeURIComponent(new URL(url, BASE).pathname);
  let name = decoded.replace(/^\//, "").replace(/[^a-z0-9.-]+/gi, "_");
  if (!/\.[a-z0-9]{2,5}$/i.test(name)) {
    name += EXT_BY_TYPE[contentType.split(";")[0].trim()] ?? ".bin";
  }
  return name;
}

function cleanUrl(u) {
  return u.replace(/&amp;/g, "&").split(/&#?\d+;?|&quot;/)[0];
}

async function fetchOk(url) {
  const res = await fetch(new URL(url, BASE), { redirect: "follow" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res;
}

async function main() {
  await mkdir(path.join(OUT, "pages"), { recursive: true });
  await mkdir(path.join(OUT, "images"), { recursive: true });
  await mkdir(path.join(OUT, "files"), { recursive: true });

  const imageUrls = new Set();
  const contentUrls = new Set();

  for (const page of PAGES) {
    const res = await fetchOk(BASE + page);
    const html = await res.text();
    const file = path.join(OUT, "pages", slugify(page) + ".html");
    await writeFile(file, html);
    for (const m of html.matchAll(/\/web\/image\/[^"'\s<>\\)]+/g)) imageUrls.add(cleanUrl(m[0]));
    for (const m of html.matchAll(/\/web\/content\/[^"'\s<>\\)]+/g)) contentUrls.add(cleanUrl(m[0]));
    console.log(`page ${page} -> ${imageUrls.size} images, ${contentUrls.size} content refs so far`);
  }

  const images = [];
  for (const url of [...imageUrls].sort()) {
    try {
      const res = await fetchOk(url);
      const type = res.headers.get("content-type") ?? "";
      const name = fileNameFor(url, type);
      const dest = path.join(OUT, "images", name);
      const buf = Buffer.from(await res.arrayBuffer());
      if (!(await exists(dest))) await writeFile(dest, buf);
      images.push({ url, name, type, bytes: buf.length });
      console.log(`image ${name} (${buf.length}b)`);
    } catch (err) {
      console.log(`image FAILED ${url}: ${err.message}`);
    }
  }

  const files = [];
  for (const url of [...contentUrls].sort()) {
    try {
      const res = await fetchOk(url);
      const type = res.headers.get("content-type") ?? "";
      const name = fileNameFor(url, type);
      const dest = path.join(OUT, "files", name);
      const buf = Buffer.from(await res.arrayBuffer());
      if (!(await exists(dest))) await writeFile(dest, buf);
      files.push({ url, name, type, bytes: buf.length });
      console.log(`file ${name} (${type}, ${buf.length}b)`);
    } catch (err) {
      console.log(`file FAILED ${url}: ${err.message}`);
    }
  }

  await writeFile(path.join(OUT, "assets.json"), JSON.stringify({ images, files }, null, 2));
  console.log(`\nDONE: ${images.length} images, ${files.length} files`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
