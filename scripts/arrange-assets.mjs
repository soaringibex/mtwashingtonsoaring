// Copies curated assets from .legacy staging into public/ with semantic names.
// Run scripts/fetch-legacy.mjs first. Usage: node scripts/arrange-assets.mjs

import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";

const SRC = { images: ".legacy/images", files: ".legacy/files" };
const PUBLIC = "public";

const IMAGES = [
  ["web_image_website_1_logo_Mt_Washington_Soaring.webp", "images/brand/logo.webp"],

  // Scenic
  ["web_image_1143-439ae5bb_120504.webp", "images/scenic/summit-glider.webp"],
  ["web_image_902-442a6446_120503.webp", "images/scenic/ridge-glider.webp"],
  ["web_image_899-26b66e68_120505.webp", "images/scenic/towplane-tow.webp"],
  ["web_image_900-243bd759_Cover.webp", "images/scenic/summit-cover.webp"],
  ["web_image_930-a91ca837_120507.webp", "images/scenic/parked-glider.webp"],
  ["web_image_932-fc746b8f_120509.webp", "images/scenic/lenticular-wing.webp"],
  ["web_image_931-543003dd_120510.webp", "images/scenic/canopy-tow.webp"],
  ["web_image_933-d6b53e2f_120511.webp", "images/scenic/ground-crew.webp"],
  ["web_image_934-6181f576_120512.webp", "images/scenic/ridge-yellow.webp"],
  ["web_image_1202-a058a553_120513.webp", "images/scenic/clouddeck.webp"],
  ["web_image_936-371ec120_120529.webp", "images/scenic/wingtip-ridges.webp"],
  ["web_image_935-5ec7785a_120530.webp", "images/scenic/sun-silhouette.webp"],
  ["web_image_1243-dde6fe12_120506.webp", "images/scenic/summit-observatory.webp"],

  // Gallery — 2024
  ["web_image_1185-8d142bd3_IMG_3462.webp", "images/gallery/2024/trailer-row.webp"],
  ["web_image_1256-95d18f1a_Suzanne_flight_wDaveS.jpeg", "images/gallery/2024/suzanne-flight.jpg"],
  ["web_image_1289-c7f23346_October_2024_-_1.jpg", "images/gallery/2024/oct-1.jpg"],
  ["web_image_1290-abfd2299_October_2024_-_2.jpg", "images/gallery/2024/oct-2.jpg"],
  ["web_image_1291-91a192fa_October_2024_-_3.jpg", "images/gallery/2024/oct-3.jpg"],
  ["web_image_1295-e39e3770_October_2024_-_4.jpg", "images/gallery/2024/oct-4.jpg"],
  ["web_image_1296-ccf54d8d_October_2024_-_6.jpg", "images/gallery/2024/oct-6.jpg"],
  ["web_image_1297-c05be0d6_October_2024_-_7.jpg", "images/gallery/2024/oct-7.jpg"],

  // Gallery — 2023
  ["web_image_1236-10195d4c_image0.jpeg", "images/gallery/2023/lenticular-town.jpg"],
  ["web_image_1239-0538f795_image1.jpeg", "images/gallery/2023/gliders-field.jpg"],
  ["web_image_1240-3b2ba773_image2.jpeg", "images/gallery/2023/sunset-wing.jpg"],
  ["web_image_1241-18291e95_image3.jpeg", "images/gallery/2023/cloudscape-wing.jpg"],
  ["web_image_1300-fd732b9b_October_2023.jpg", "images/gallery/2023/glider-portrait.jpg"],

  // Gallery — archive
  ["web_image_1245-d52e0113_IMG_0880.JPG", "images/gallery/archive/img-0880.jpg"],
  ["web_image_1246-d51190f4_IMG_0879.JPG", "images/gallery/archive/img-0879.jpg"],
  ["web_image_1248-95ee4ce0_IMG_0920.JPG", "images/gallery/archive/img-0920.jpg"],

  // Reading charts (display + full size)
  ["web_image_1188-a61223bd_Moria_Carter_to_SE.webp", "images/reading/moria-carter-se.webp"],
  ["web_image_1187-a1f43aa6_Moria_Carter_to_SE.png", "images/reading/moria-carter-se-full.png"],
  ["web_image_1192-ac4fcec6_Presidential_Range_to_NW.webp", "images/reading/presidential-range-nw.webp"],
  ["web_image_1190-e1576c30_Presidential_Range_to_NW.png", "images/reading/presidential-range-nw-full.png"],
  ["web_image_1195-a6ef9b34_Gorham_Area_to_the_NNW.webp", "images/reading/gorham-area-nnw.webp"],
  ["web_image_1193-c9521717_Gorham_Area_to_the_NNW.png", "images/reading/gorham-area-nnw-full.png"],
  ["web_image_1223-a84e148c_Gorham_Airport_Zones.webp", "images/reading/gorham-airport-zones.webp"],
  ["web_image_1222-b4babede_Gorham_Airport_Zones.png", "images/reading/gorham-airport-zones-full.png"],
  ["web_image_1206-ea3016b9_MtHaysToPrimaryTransitionExample.webp", "images/reading/mthays-transition.webp"],
  ["web_image_1203-ef0067db_MtHaysToPrimaryTransitionExample.png", "images/reading/mthays-transition-full.png"],
];

const FILES = [
  // Core reading
  ["web_content_1275.pdf", "files/mount-washington-brief.pdf"],
  ["web_content_1011.pdf", "files/oxygen-talk-1995.pdf"],
  ["web_content_1186.pdf", "files/gorham-pattern-procedures-2023.pdf"],

  // Legal & regulatory
  ["web_content_1181.pdf", "files/2024-loa.pdf"],
  ["web_content_1172.pdf", "files/2024-northcraft-legal-interpretation.pdf"],
  ["web_content_1177.pdf", "files/2024-memo-rescinding-kortokrax.pdf"],
  ["web_content_1178.pdf", "files/2024-memo-rescinding-fretwell.pdf"],
  ["web_content_1180.pdf", "files/2024-memo-rescinding-olshock.pdf"],
  ["web_content_1179.pdf", "files/2024-memo-rescinding-schaffner.pdf"],

  // Story archives
  ["web_content_1162.pdf", "files/the-mountains-win-again-2015.pdf"],
  ["web_content_1159.pdf", "files/greenhorn-in-the-white-mountains.pdf"],
  ["web_content_1165.pdf", "files/recollections-of-the-wave-camps-1979-1984.pdf"],
  ["web_content_1167.pdf", "files/national-landmark-of-soaring-dedication-2005.pdf"],
  ["web_content_1158.pdf", "files/soaring-magazine-1987-03.pdf"],
  ["web_content_1163.pdf", "files/2016-wave-camp-information.pdf"],
  ["web_content_1164.pdf", "files/2016-wave-camp-logbook-rick-roelke.pdf"],
  ["web_content_1166.pdf", "files/2021-wave-camp-logbook-glen-kelley.pdf"],
  ["web_content_1168.pdf", "files/gorham-landing-sites-2013.pdf"],

  // Electronic files
  ["web_content_1205.txt", "files/45-minute-diamond.igc"],
  ["web_content_1221.bin", "files/gorham-landing-places.kmz"],
  ["web_content_1197.bin", "files/gorham-waypoints.cup"],
  ["web_content_1198.txt", "files/mwsa-glider-area.sua"],
  ["web_content_1199.txt", "files/allusa-with-mwsa-glider-area.sua"],
  ["web_content_1200.txt", "files/mwsa-glider-area.txt"],
  ["web_content_1258.txt", "files/allusa-with-mwsa-glider-area.txt"],

  // Press reprints
  ["web_content_1211.pdf", "files/press/glimpse-of-a-timeless-sky-windswept-2005.pdf"],
  ["web_content_1212.pdf", "files/press/riding-the-wave-windswept-2002.pdf"],
  ["web_content_1213.pdf", "files/press/letter-from-the-mt-washington-wave-soaring-1971.pdf"],
  ["web_content_1214.pdf", "files/press/the-1968-mount-washington-wave-camp.pdf"],
  ["web_content_1215.pdf", "files/press/a-timeless-sky-soaring-1968.pdf"],
  ["web_content_1216.pdf", "files/press/waves-east-and-west-soaring-1967.pdf"],
];

async function main() {
  let count = 0;
  for (const [from, to] of IMAGES) {
    const dest = path.join(PUBLIC, to);
    await mkdir(path.dirname(dest), { recursive: true });
    await copyFile(path.join(SRC.images, from), dest);
    count++;
  }
  for (const [from, to] of FILES) {
    const dest = path.join(PUBLIC, to);
    await mkdir(path.dirname(dest), { recursive: true });
    await copyFile(path.join(SRC.files, from), dest);
    count++;
  }
  console.log(`Copied ${count} assets into public/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
