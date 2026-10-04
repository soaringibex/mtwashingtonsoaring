// Fails if any /files/... or /images/... reference in src/ has no matching asset in public/.
// Usage: node scripts/check-assets.mjs

import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const SRC = "src";
const PUBLIC = "public";

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else if (/\.(tsx?|css)$/.test(entry.name)) files.push(full);
  }
  return files;
}

async function exists(target) {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

const references = new Map();

for (const file of await walk(SRC)) {
  const text = await readFile(file, "utf8");
  for (const match of text.matchAll(/["'`](\/(?:files|images)\/[^"'`\s]+)["'`]/g)) {
    const url = match[1];
    if (!references.has(url)) references.set(url, new Set());
    references.get(url).add(file);
  }
}

const missing = [];
for (const [url, sources] of references) {
  if (!(await exists(path.join(PUBLIC, url)))) {
    missing.push({ url, sources: [...sources] });
  }
}

missing.sort((a, b) => a.url.localeCompare(b.url));

if (missing.length === 0) {
  console.log(`check-assets: OK — all ${references.size} referenced assets exist in public/`);
} else {
  for (const entry of missing) {
    console.log(`MISSING ${entry.url} (referenced by ${entry.sources.join(", ")})`);
  }
  process.exitCode = 1;
}
