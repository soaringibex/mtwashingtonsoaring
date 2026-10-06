// Extracts the text of the site's digital PDFs into src/lib/document-texts.ts so each
// document can be read as a web page (with the original PDF offered for download).
//
// Run locally after changing any source PDF or the DOCS list:
//   node scripts/extract-documents.mjs
//
// The output file is committed (Vercel's build image has no poppler tools), so re-run
// this and commit the result whenever a PDF changes. Per-document cleanups live in the
// DOCS config below (drop rules), not in the generated file.

import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";

const DOCS = [
  // Stories
  {
    slug: "the-mountains-win-again-2015",
    pdf: "public/files/the-mountains-win-again-2015.pdf",
    stripPrefix: "The Mountains Win Again",
  },
  { slug: "greenhorn-in-the-white-mountains", pdf: "public/files/greenhorn-in-the-white-mountains.pdf", figures: true },
  { slug: "recollections-of-the-wave-camps-1979-1984", pdf: "public/files/recollections-of-the-wave-camps-1979-1984.pdf", figures: true },
  // Logbooks
  { slug: "2021-wave-camp-logbook-glen-kelley", pdf: "public/files/2021-wave-camp-logbook-glen-kelley.pdf", figures: true },
  { slug: "2016-wave-camp-logbook-rick-roelke", pdf: "public/files/2016-wave-camp-logbook-rick-roelke.pdf" },
  // Flying here
  { slug: "gorham-pattern-procedures-2023", pdf: "public/files/gorham-pattern-procedures-2023.pdf" },
  { slug: "gorham-landing-sites-2013", pdf: "public/files/gorham-landing-sites-2013.pdf" },
  { slug: "2016-wave-camp-information", pdf: "public/files/2016-wave-camp-information.pdf" },
  {
    slug: "oxygen-talk-1995",
    pdf: "public/files/oxygen-talk-1995.pdf",
    figures: true,
    tables: [
      {
        // The altitude/oxygen table on page 5. Its own header lines are ragged
        // multi-line fragments, so the columns are named here; every row must split into
        // this many cells or the run fails rather than publishing a mangled table.
        start: /^Atmosphere\s+Barometric/,
        end: /^All Pressures are in Torr/,
        caption: /^Altitude vs\. Blood Oxygen$/,
        headers: [
          "Altitude",
          "Atmosphere Above",
          "Barometric Pressure",
          "Water Tension at Body Temp",
          "Carbon Dioxide Tension",
          "Oxygen Remainder",
          "Oxygen Tension in Air",
          "Arterial Blood Oxygen Tension",
          "Oxygen Saturation",
        ],
      },
    ],
  },
  { slug: "2026-loa", pdf: "public/files/2026-loa.pdf" },
  { slug: "2027-2028-loa-revalidation", pdf: "public/files/2027-2028-loa-revalidation.pdf" },
  { slug: "2024-northcraft-legal-interpretation", pdf: "public/files/2024-northcraft-legal-interpretation.pdf" },
  { slug: "2024-memo-rescinding-kortokrax", pdf: "public/files/2024-memo-rescinding-kortokrax.pdf" },
  { slug: "2024-memo-rescinding-fretwell", pdf: "public/files/2024-memo-rescinding-fretwell.pdf" },
  { slug: "2024-memo-rescinding-olshock", pdf: "public/files/2024-memo-rescinding-olshock.pdf" },
  { slug: "2024-memo-rescinding-schaffner", pdf: "public/files/2024-memo-rescinding-schaffner.pdf" },
];

// Note: national-landmark-of-soaring-dedication-2005.pdf is a scan with a garbled OCR text
// layer, so it stays PDF-only (no web edition).

function pageCount(pdf) {
  try {
    const info = execFileSync("pdfinfo", [pdf], { encoding: "utf8" });
    const match = info.match(/^Pages:\s+(\d+)/m);
    return match ? Number(match[1]) : 0;
  } catch {
    return 0;
  }
}

const WEEKDAY = "(?:mon|tues|wednes|thurs|fri|satur|sun)day";
const MONTH = "(?:january|february|march|april|may|june|july|august|september|october|november|december)";
const DATE_LINES = [
  new RegExp(`^${WEEKDAY},? \\d{1,2}(?:st|nd|rd|th)?(?: ${MONTH})?(?:,? \\d{4})?$`, "i"),
  new RegExp(`^${MONTH} \\d{1,2}(?:st|nd|rd|th)?(?:,? \\d{4})?$`, "i"),
  new RegExp(`^\\d{1,2} ${MONTH}(?: \\d{4})?$`, "i"),
];
/** True for a line that is nothing but a date ("Saturday 9 October", "October 7, 2016"). */
const looksLikeDateLine = (value) => DATE_LINES.some((pattern) => pattern.test(value));

function toBlocks(raw) {
  const text = raw.replace(/\r/g, "").replace(/\f/g, "\n\n");
  const rawBlocks = text
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  const clean = (value) => value.replace(/\s{2,}/g, " ").trim();

  const blocks = [];
  for (const block of rawBlocks) {
    if (/^\d{1,3}$/.test(block)) continue; // bare page numbers

    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    // A dated entry ("Saturday 9 October", "October 7") heads its own section even when
    // the paragraph below runs on from it in the layout with no blank line between.
    if (lines.length > 1 && looksLikeDateLine(lines[0])) {
      blocks.push({ type: "h", text: clean(lines[0]) });
      lines.shift();
    }

    // Numbered lists (as laid out by pdftotext -layout): "1. ..." / "1) ...".
    const numbered = lines.filter((line) => /^\d+[.)]\s/.test(line)).length;
    if (numbered >= 2) {
      const items = [];
      let current = null;
      const preamble = [];
      for (const line of lines) {
        if (/^\d+[.)]\s/.test(line)) {
          if (current) items.push(current);
          current = line.replace(/^\d+[.)]\s+/, "");
        } else if (current) {
          current += ` ${line}`;
        } else {
          preamble.push(line);
        }
      }
      if (current) items.push(current);
      if (preamble.length) blocks.push({ type: "p", text: clean(preamble.join(" ")) });
      blocks.push({ type: "ol", items: items.map(clean) });
      continue;
    }

    // Bullet lists: most lines start with a bullet or dash.
    const bulletLines = lines.filter((line) => /^[•·▪◦*-]\s+/.test(line));
    if (lines.length > 1 && bulletLines.length >= lines.length - 1) {
      blocks.push({
        type: "ul",
        items: lines.map((line) => clean(line.replace(/^[•·▪◦*-]\s+/, ""))),
      });
      continue;
    }

    // Reflow the block into one paragraph, undoing end-of-line hyphenation.
    let joined = "";
    for (const line of lines) {
      if (!joined) joined = line;
      else if (/[a-z]-$/.test(joined) && /^[a-z]/.test(line)) joined = joined.slice(0, -1) + line;
      else joined += ` ${line}`;
    }
    joined = clean(joined);

    const allCaps = joined === joined.toUpperCase() && /[A-Z]/.test(joined);
    const looksLikeHeading =
      joined.length <= 80 &&
      !/[.;:!?]$/.test(joined) &&
      (allCaps || looksLikeDateLine(joined) || /^(part|section|appendix|chapter)\b/i.test(joined));
    blocks.push({ type: looksLikeHeading ? "h" : "p", text: joined });
  }
  return blocks;
}

/** A per-document table spec parsed from the -layout text into one {type:"table"} block. */
function parseTable(spec, region, caption) {
  const rows = [];
  for (const line of region) {
    if (!line.trim() || !/\d/.test(line)) continue; // blank lines and ragged header fragments
    const cells = line.trim().split(/ {2,}/);
    if (cells.length !== spec.headers.length) {
      throw new Error(
        `table row has ${cells.length} cells, expected ${spec.headers.length}: ${line.trim()}`,
      );
    }
    rows.push(cells);
  }
  if (!rows.length) throw new Error(`table "${spec.headers[0]}" parsed to zero rows`);
  return caption
    ? { type: "table", caption, headers: spec.headers, rows }
    : { type: "table", headers: spec.headers, rows };
}

/** Like toBlocks, but a page carrying tables gets them pulled out as table blocks. */
function pageBlocks(pageText, tables) {
  if (!tables?.length) return toBlocks(pageText);
  const lines = pageText.split("\n");
  const blocks = [];
  let buffer = [];
  const flush = () => {
    if (buffer.some((line) => line.trim())) blocks.push(...toBlocks(buffer.join("\n")));
    buffer = [];
  };
  let index = 0;
  while (index < lines.length) {
    const spec = tables.find((table) => table.start.test(lines[index].trim()));
    if (!spec) {
      buffer.push(lines[index]);
      index += 1;
      continue;
    }
    const startLine = lines[index].trim();
    // The table's title sometimes trails the paragraph above it in the layout
    // ("Altitude vs. Blood Oxygen"); it is the table's caption, not a sentence.
    let caption;
    if (spec.caption) {
      const lastText = buffer.findLastIndex((line) => line.trim());
      if (lastText !== -1 && spec.caption.test(buffer[lastText].trim())) {
        caption = buffer[lastText].trim();
        buffer.splice(lastText, 1);
      }
    }
    flush();
    const region = [];
    index += 1;
    while (index < lines.length && !spec.end.test(lines[index].trim())) {
      region.push(lines[index]);
      index += 1;
    }
    if (index >= lines.length) throw new Error(`unterminated table: ${startLine}`);
    blocks.push(parseTable(spec, region, caption));
    // The end line stays in the stream — it is the table's caption paragraph.
  }
  flush();
  return blocks;
}

const pad3 = (value) => String(value).padStart(3, "0");

/** Pull the figures out of a slide-deck PDF, page by page, into public/images/reading/<slug>. */
function extractFigures(pdf, slug) {
  const listing = execFileSync("pdfimages", ["-list", pdf], { encoding: "utf8" });
  const wanted = [];
  for (const line of listing.split("\n").slice(2)) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 9 || !/^\d+$/.test(parts[0])) continue;
    const [page, num, , width, height] = parts;
    if (Number(width) < 60 || Number(height) < 60) continue; // skip speck artifacts
    wanted.push({ page: Number(page), num: Number(num), width: Number(width), height: Number(height) });
  }

  const tmp = `${tmpdir()}/docfigs-${process.pid}-${Date.now()}`;
  mkdirSync(tmp, { recursive: true });
  execFileSync("pdfimages", ["-j", "-p", pdf, `${tmp}/img`]);

  const outDir = `public/images/reading/${slug}`;
  mkdirSync(outDir, { recursive: true });

  const byPage = new Map();
  for (const entry of wanted) {
    const base = `img-${pad3(entry.page)}-${pad3(entry.num)}`;
    const source = ["jpg", "ppm", "pbm", "png"].find((ext) => existsSync(`${tmp}/${base}.${ext}`));
    if (!source) continue;
    const file = `p${pad3(entry.page)}-${pad3(entry.num)}.jpg`;
    const target = `${outDir}/${file}`;
    if (source === "jpg") copyFileSync(`${tmp}/${base}.${source}`, target);
    else
      execFileSync("sips", [
        "-s",
        "format",
        "jpeg",
        "-s",
        "formatOptions",
        "82",
        `${tmp}/${base}.${source}`,
        "--out",
        target,
      ]);
    const figures = byPage.get(entry.page) ?? [];
    figures.push({
      src: `/images/reading/${slug}/${file}`,
      width: entry.width,
      height: entry.height,
    });
    byPage.set(entry.page, figures);
  }
  rmSync(tmp, { recursive: true, force: true });
  return byPage;
}

const records = {};
for (const { slug, pdf, stripPrefix, figures, tables } of DOCS) {
  const raw = execFileSync("pdftotext", ["-layout", pdf, "-"], {
    maxBuffer: 64 * 1024 * 1024,
  }).toString("utf8");

  let blocks;
  if (figures || tables) {
    const byPage = figures ? extractFigures(pdf, slug) : null;
    blocks = [];
    raw.split("\f").forEach((pageText, index) => {
      blocks.push(...pageBlocks(pageText, tables));
      for (const figure of byPage?.get(index + 1) ?? []) {
        blocks.push({ type: "img", ...figure });
      }
    });
  } else {
    blocks = toBlocks(raw);
  }

  if (stripPrefix && blocks[0]?.type === "p" && blocks[0].text.startsWith(stripPrefix)) {
    blocks[0] = { type: "p", text: blocks[0].text.slice(stripPrefix.length).trim() };
  }

  // Re-join paragraphs that a page break split: a paragraph ending without terminal
  // punctuation followed by one starting lowercase is one paragraph.
  let merged = true;
  while (merged) {
    merged = false;
    for (let i = 0; i < blocks.length - 1; i += 1) {
      const a = blocks[i];
      const b = blocks[i + 1];
      if (
        a.type === "p" &&
        b.type === "p" &&
        !/[.:;!?"”)]$/.test(a.text.trim()) &&
        /^[a-z]/.test(b.text)
      ) {
        blocks = [
          ...blocks.slice(0, i),
          { type: "p", text: `${a.text} ${b.text}` },
          ...blocks.slice(i + 2),
        ];
        merged = true;
      }
    }
  }

  const bytes = statSync(pdf).size;
  const pages = pageCount(pdf);
  records[slug] = { pages, bytes, blocks };
  const chars = blocks.reduce(
    (n, b) => n + (b.text?.length ?? 0) + (b.items?.join(" ").length ?? 0),
    0,
  );
  console.log(
    `${slug}: ${blocks.length} blocks, ${chars} chars, ${pages} pages, ${(bytes / 1e6).toFixed(1)} MB`,
  );
}

const header = `// Generated by scripts/extract-documents.mjs — do not edit by hand.
// Re-run the script and commit the result whenever a source PDF changes.

export type DocBlock =
  | { type: "h"; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "img"; src: string; width: number; height: number }
  | { type: "table"; caption?: string; headers: string[]; rows: string[][] };

export type DocumentText = {
  pages: number;
  bytes: number;
  blocks: DocBlock[];
};

export const documentTexts: Record<string, DocumentText> = `;

mkdirSync("src/lib", { recursive: true });
writeFileSync("src/lib/document-texts.ts", header + JSON.stringify(records, null, 2) + ";\n");
console.log("wrote src/lib/document-texts.ts");
