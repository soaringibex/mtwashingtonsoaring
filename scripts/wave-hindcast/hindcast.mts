// Hindcast the site's 3-D linear wave solve for every flight hour and sample it at each
// straight-flight glider observation. Mirrors src/lib/wave-solve.ts solveWaveField3D, with
// knobs for the experiments. Usage (repo root):
//   node scripts/wave-hindcast/hindcast.mts '{"damping":1e-3}' .wave-hindcast/runs/x.csv
// Defaults reproduce the site exactly (DEFAULT_DAMPING_S, saturateWave = WAVE_GAIN + cap).
// Options: damping, launch ("divider"|"mean"), saturate (false = raw linear solve), column
// ("upwind"|"gorham"), gain (extra factor on top), scale (along-wind stretch about the
// summit), shiftM (along-wind shift).
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { inflateSync } from "node:zlib";
import { buildWaveColumn, divideStreamline, saturateWave, type WaveColumnLevel } from "../../src/lib/linear-wave.ts";
import { buildRotatedTerrainGrid, sampleField, solveLinearWave3D } from "../../src/lib/linear-wave-3d.ts";

const S = resolve(import.meta.dirname, "../../.wave-hindcast");
mkdirSync(`${S}/tiles`, { recursive: true });
const opts = { gain: 1, scale: 1, shiftM: 0, damping: undefined as number | undefined, launch: "divider", saturate: true, column: "upwind", turnMax: 90, zMin: 0, ...(JSON.parse(process.argv[2] ?? "{}")) };
const outPath = process.argv[3] ?? `${S}/hc.csv`;
mkdirSync(resolve(outPath, ".."), { recursive: true });

// site constants (wx-grid.ts, wave-solve.ts)
const MAP_LAT_MIN = 44.06, MAP_LAT_SPAN = 0.42, MAP_LON_MIN = -71.55, MAP_LON_SPAN = 0.604;
const CENTRE = { lat: MAP_LAT_MIN + MAP_LAT_SPAN / 2, lon: MAP_LON_MIN + MAP_LON_SPAN / 2 };
const SIZE = 256, DX = 500;
const MLAT = 110900, MLON = 111320 * Math.cos((44.26 * Math.PI) / 180);
const GA = { lat: 44.290556, lon: -71.227778 };
const SUMMIT = { lat: 44.2706, lon: -71.3033 };

// ---- terrain mosaic, z10 Terrarium tiles straight from AWS, cached on disk
const TILE = 256, Z = 10;
const lonToX = (lon: number) => ((lon + 180) / 360) * 2 ** Z;
const latToY = (lat: number) => { const r = (lat * Math.PI) / 180; return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** Z; };
const xToLon = (x: number) => (x / 2 ** Z) * 360 - 180;
const yToLat = (y: number) => (180 / Math.PI) * Math.atan(Math.sinh(Math.PI - (2 * Math.PI * y) / 2 ** Z));
function decodePng(buf: Buffer) {
  let pos = 8, width = 0, height = 0, ct = 0; const idat: Buffer[] = [];
  while (pos + 8 <= buf.length) { const len = buf.readUInt32BE(pos), type = buf.toString("ascii", pos + 4, pos + 8), d = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") { width = d.readUInt32BE(0); height = d.readUInt32BE(4); ct = d[9]; } else if (type === "IDAT") idat.push(d); else if (type === "IEND") break; pos += 12 + len; }
  const bpp = ct === 6 ? 4 : 3, raw = inflateSync(Buffer.concat(idat)), stride = width * bpp, px = new Uint8Array(width * height * bpp);
  const pa = (a: number, b: number, c: number) => { const p = a + b - c, x = Math.abs(p - a), y = Math.abs(p - b), z = Math.abs(p - c); return x <= y && x <= z ? a : y <= z ? b : c; };
  for (let y = 0; y < height; y++) { const f = raw[y * (stride + 1)], row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), o = y * stride, pr = (y - 1) * stride;
    for (let x = 0; x < stride; x++) { const a = x >= bpp ? px[o + x - bpp] : 0, b = y > 0 ? px[pr + x] : 0, c = x >= bpp && y > 0 ? px[pr + x - bpp] : 0; let v = row[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1; else if (f === 4) v += pa(a, b, c); px[o + x] = v & 0xff; } }
  return { px, bpp };
}
const half = (SIZE / 2) * DX * 1.5;
const x0 = Math.floor(lonToX(CENTRE.lon - half / MLON)), x1 = Math.floor(lonToX(CENTRE.lon + half / MLON));
const y0 = Math.floor(latToY(CENTRE.lat + half / MLAT)), y1 = Math.floor(latToY(CENTRE.lat - half / MLAT));
const cols = x1 - x0 + 1, rows = y1 - y0 + 1, W = cols * TILE, H = rows * TILE, elev = new Float32Array(W * H);
for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
  const p = `${S}/tiles/${Z}_${tx}_${ty}.png`;
  if (!existsSync(p)) { const r = await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${Z}/${tx}/${ty}.png`); if (!r.ok) throw new Error(`tile ${tx},${ty}`); writeFileSync(p, Buffer.from(await r.arrayBuffer())); }
  const { px, bpp } = decodePng(readFileSync(p)), ox = (tx - x0) * TILE, oy = (ty - y0) * TILE;
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) { const o = (y * TILE + x) * bpp; elev[(oy + y) * W + ox + x] = px[o] * 256 + px[o + 1] + px[o + 2] / 256 - 32768; }
}
const north = yToLat(y0), west = xToLon(x0), lonStep = 360 / 2 ** Z / TILE, latStep = (north - yToLat(y0 + 1)) / TILE;
const sampleTerrain = (lat: number, lon: number) => {
  const fx = Math.min(Math.max((lon - west) / lonStep, 0), W - 1.001), fy = Math.min(Math.max((north - lat) / latStep, 0), H - 1.001);
  const a = Math.floor(fx), b = Math.floor(fy), tx = fx - a, ty = fy - b, i = b * W + a;
  return elev[i] * (1 - tx) * (1 - ty) + elev[i + 1] * tx * (1 - ty) + elev[i + W] * (1 - tx) * ty + elev[i + W + 1] * tx * ty;
};

// ---- observations
type Obs = { fid: string; t: number; lat: number; lon: number; pa: number; wobs: number; turn: number; day: string };
const lines = readFileSync(`${S}/samples.csv`, "utf8").trim().split(/\r?\n/); const hdr = lines[0].split(",");
const ix = (k: string) => hdr.indexOf(k);
const keep = new Set<string>((JSON.parse(readFileSync(`${S}/keep_fids.json`, "utf8")) as number[]).map(String));
const byHour = new Map<string, Obs[]>();
for (const l of lines.slice(1)) {
  const c = l.split(",");
  if (c[ix("engine_ok")] !== "1" || !keep.has(c[ix("fid")])) continue;
  if (Number(c[ix("gs")]) > 90) continue;
  const turn = Number(c[ix("turn")]); if (turn >= opts.turnMax) continue;
  const t = Number(c[ix("t")]); const hk = new Date((t + 1800) * 1000).toISOString().slice(0, 13);
  const o = { fid: c[ix("fid")], t, lat: Number(c[ix("lat")]), lon: Number(c[ix("lon")]), pa: Number(c[ix("pa")]), wobs: Number(c[ix("vario")]) + Number(c[ix("sink")]), turn, day: c[ix("day")] };
  if (!byHour.has(hk)) byHour.set(hk, []); byHour.get(hk)!.push(o);
}

const waveAzimuth = (levels: WaveColumnLevel[]) => { for (const hPa of [800, 825, 775, 850, 750, 700]) { const l = levels.find((e) => e.hPa === hPa); if (l && Number.isFinite(l.dirDeg) && l.speedMs > 5) return l.dirDeg; } return 305; };
const paToHeight = (pa: number, col: WaveColumnLevel[]) => {
  const p = 1013.25 * Math.pow(1 - pa / 44330.8, 5.25588);
  for (let i = 0; i < col.length - 1; i++) { const a = col[i], b = col[i + 1]; if (p <= a.hPa && p >= b.hPa) { const f = Math.log(a.hPa / p) / Math.log(a.hPa / b.hPa); return a.zM + f * (b.zM - a.zM); } }
  return pa;
};

const out: string[] = ["hour,fid,day,t,lat,lon,z,wobs,wmod,froude,zD,az,u800,inGrid"];
const meta: string[] = ["hour,az,froude,zD,u800,peak3k,peak4k,peakGA3k,upwindU700"];
const files = readdirSync(`${S}/cols`).filter((f) => f.endsWith(".json")).sort();
for (const f of files) {
  const hour = f.slice(0, 13); const obs = byHour.get(hour) ?? [];
  const C = JSON.parse(readFileSync(`${S}/cols/${f}`, "utf8")) as Record<string, WaveColumnLevel[]>;
  const local = C.gorham; const windFrom = waveAzimuth(local); const bucket = (Math.round(windFrom / 5) * 5) % 360;
  const levels = opts.column === "gorham" ? local : C[`u${bucket}`];
  const az = (windFrom + 180) % 360;
  const rad = (az * Math.PI) / 180, aE = Math.sin(rad), aN = Math.cos(rad), cE = Math.sin(rad + Math.PI / 2), cN = Math.cos(rad + Math.PI / 2);
  const terrain = buildRotatedTerrainGrid({ size: SIZE, dxM: DX, centreLat: CENTRE.lat, centreLon: CENTRE.lon, metresPerDegLat: MLAT, metresPerDegLon: MLON, azimuthDeg: az, sample: sampleTerrain });
  let mean = 0, crest = -Infinity; for (const h of terrain) { mean += h; if (h > crest) crest = h; } mean /= terrain.length;
  const div = divideStreamline(levels, az, mean, crest);
  const zLaunch = opts.launch === "mean" ? mean : opts.launch === "fixed" ? opts.launchM : div.zD;
  const col = buildWaveColumn(levels, az, zLaunch); if (!col) { console.error(hour, "no column"); continue; }
  const clipped = Float64Array.from(terrain, (h) => Math.max(h, zLaunch));
  let raw = solveLinearWave3D({ terrainM: clipped, size: SIZE, dxM: DX, column: col, damping: opts.damping }); if (!raw) continue;
  if (opts.gain !== 1) raw = { zM: raw.zM, w: raw.w.map((line) => line.map((v) => v * opts.gain)) };
  const solve = opts.saturate ? saturateWave(raw, col) : raw;
  const zM = solve.zM; const u800 = levels.find((l) => l.hPa === 800)?.speedMs ?? NaN;
  const mid = (SIZE - 1) / 2;
  const at = (lat: number, lon: number, z: number) => {
    const dE = (lon - CENTRE.lon) * MLON, dN = (lat - CENTRE.lat) * MLAT;
    const sE = (SUMMIT.lon - CENTRE.lon) * MLON, sN = (SUMMIT.lat - CENTRE.lat) * MLAT, sA = sE * aE + sN * aN;
    const along = sA + (dE * aE + dN * aN - sA) * opts.scale + opts.shiftM;
    const fi = mid + along / DX, fj = mid + (dE * cE + dN * cN) / DX;
    const inGrid = fi > SIZE / 8 && fi < SIZE - SIZE / 8 && fj > SIZE / 8 && fj < SIZE - SIZE / 8 ? 1 : 0;
    let k = 0; while (k < zM.length - 1 && zM[k + 1] < z) k++;
    if (z <= zM[0]) return { w: sampleField(solve.w[0], SIZE, fi, fj), inGrid };
    if (k >= zM.length - 1) return { w: sampleField(solve.w[zM.length - 1], SIZE, fi, fj), inGrid };
    const t = (z - zM[k]) / (zM[k + 1] - zM[k]);
    return { w: (1 - t) * sampleField(solve.w[k], SIZE, fi, fj) + t * sampleField(solve.w[k + 1], SIZE, fi, fj), inGrid };
  };
  // hour metadata: peak |w| over the display map at ~3 km and ~4 km, and within 10 km of the Glider Area at 3 km
  let p3 = 0, p4 = 0, pga = 0;
  for (let la = MAP_LAT_MIN; la <= MAP_LAT_MIN + MAP_LAT_SPAN; la += 0.01) for (let lo = MAP_LON_MIN; lo <= MAP_LON_MIN + MAP_LON_SPAN; lo += 0.014) {
    const a3 = at(la, lo, 3000).w, a4 = at(la, lo, 4000).w; p3 = Math.max(p3, a3); p4 = Math.max(p4, a4);
    if (Math.hypot((la - GA.lat) * MLAT, (lo - GA.lon) * MLON) < 10000) pga = Math.max(pga, a3);
  }
  const u700 = levels.find((l) => l.hPa === 700)?.speedMs ?? NaN;
  meta.push([hour, az.toFixed(0), div.froude.toFixed(2), zLaunch.toFixed(0), u800.toFixed(1), p3.toFixed(2), p4.toFixed(2), pga.toFixed(2), u700.toFixed(1)].join(","));
  for (const o of obs) {
    const z = paToHeight(o.pa, local); if (z < opts.zMin) continue;
    const m = at(o.lat, o.lon, z);
    out.push([hour, o.fid, o.day, o.t, o.lat, o.lon, z.toFixed(0), o.wobs.toFixed(2), m.w.toFixed(3), div.froude.toFixed(2), zLaunch.toFixed(0), az.toFixed(0), u800.toFixed(1), m.inGrid].join(","));
  }
}
writeFileSync(outPath, out.join("\n") + "\n");
writeFileSync(outPath.replace(/\.csv$/, ".meta.csv"), meta.join("\n") + "\n");
console.log(`${files.length} hours, ${out.length - 1} samples -> ${outPath}`);
