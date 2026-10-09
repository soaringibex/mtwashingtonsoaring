"use client";


import { useEffect, useMemo, useRef, useState } from "react";
import { fetchTerrainMosaic, mosaicElevation, type TerrainMosaic } from "@/lib/terrain-tiles";
import { fetchRoadLines, type RoadLine } from "@/lib/roads";

/**
 * The wave-camp years in 3D — rendered with WebGL so the mountain keeps its detail:
 * the geometry is a half-kilometre grid of the White Mountains, but the relief itself
 * is a full-resolution hillshaded texture built from the z11 terrain tiles (~55 m per
 * pixel), which is what makes the ravines and the summit cone read. Flights are drawn
 * as camera-facing ribbons, depth-tested, so ridges occlude tracks correctly.
 */

const BOUNDS = { west: -71.62, south: 44.02, east: -70.86, north: 44.82 };
const ZOOM = 11;
const EXAG = 2.3;
const FOV = (50 * Math.PI) / 180;
const MAX_TEX = 2048;

type Track = {
  id: number;
  pilot: string;
  date: string;
  maxAltFt: number;
  wave: boolean;
  ssa: string[];
  pts: [number, number, number][];
};

type YearData = { year: number; flights: Track[] };

const YEARS = [2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016];

/** The summits worth a label, each snapped to its own top on the terrain mesh. */
const PEAKS = [
  { name: "Mt Washington", lat: 44.27246, lon: -71.30402 },
  { name: "Mt Adams", lat: 44.32266, lon: -71.29234 },
  { name: "Mt Jefferson", lat: 44.30609, lon: -71.31706 },
  { name: "Mt Madison", lat: 44.33046, lon: -71.27724 },
  { name: "Mt Monroe", lat: 44.25784, lon: -71.32187 },
  { name: "Mt Eisenhower", lat: 44.24321, lon: -71.35071 },
  { name: "Mt Pierce", lat: 44.22957, lon: -71.36581 },
  { name: "Mt Jackson", lat: 44.20715, lon: -71.31157 },
  { name: "Wildcat Mountain", lat: 44.26174, lon: -71.20239 },
  { name: "Carter Dome", lat: 44.26953, lon: -71.17973 },
  { name: "Kearsarge North", lat: 44.10966, lon: -71.09459 },
];

const ALT_RAMP: [number, [number, number, number]][] = [
  [800, [45, 212, 191]],
  [6000, [74, 222, 128]],
  [12000, [250, 204, 21]],
  [18000, [251, 146, 60]],
  [24000, [244, 63, 94]],
  [34000, [217, 70, 239]],
];

function altRgb(ft: number): [number, number, number] {
  let lo = ALT_RAMP[0];
  let hi = ALT_RAMP[ALT_RAMP.length - 1];
  for (let i = 0; i < ALT_RAMP.length - 1; i += 1) {
    if (ft >= ALT_RAMP[i][0] && ft <= ALT_RAMP[i + 1][0]) {
      lo = ALT_RAMP[i];
      hi = ALT_RAMP[i + 1];
      break;
    }
  }
  const t = hi[0] === lo[0] ? 0 : Math.min(1, Math.max(0, (ft - lo[0]) / (hi[0] - lo[0])));
  return [0, 1, 2].map((i) => (lo[1][i] + (hi[1][i] - lo[1][i]) * t) / 255) as [number, number, number];
}

function mix(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** Terrain palette: dark valley green, slate rock, snow above ~1,300 m. */
function terrainRgb(m: number): [number, number, number] {
  if (m < 300) return mix([30, 45, 54], [44, 66, 74], m / 300);
  if (m < 900) return mix([44, 66, 74], [74, 92, 106], (m - 300) / 600);
  if (m < 1300) return mix([74, 92, 106], [126, 148, 168], (m - 900) / 400);
  if (m < 1600) return mix([126, 148, 168], [222, 231, 240], (m - 1300) / 300);
  return [232, 238, 246];
}

const SKY_TOP: [number, number, number] = [11 / 255, 18 / 255, 32 / 255];
const SKY_BOTTOM: [number, number, number] = [30 / 255, 41 / 255, 59 / 255];

// ---- tiny matrix helpers (column-major, WebGL order) ----

function perspective(fovy: number, aspect: number, near: number, far: number): Float32Array {
  const f = 1 / Math.tan(fovy / 2);
  const nf = 1 / (near - far);
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
}

function lookAt(eye: [number, number, number], center: [number, number, number]): Float32Array {
  let z0 = eye[0] - center[0];
  let z1 = eye[1] - center[1];
  let z2 = eye[2] - center[2];
  let len = 1 / Math.hypot(z0, z1, z2);
  z0 *= len;
  z1 *= len;
  z2 *= len;
  // cross(worldUp = (0,0,1), z)
  let cx = -z1;
  let cy = z0;
  let cz = 0;
  len = Math.hypot(cx, cy, cz) || 1;
  cx /= len;
  cy /= len;
  cz /= len;
  const ux = z1 * cz - z2 * cy;
  const uy = z2 * cx - z0 * cz;
  const uz = z0 * cy - z1 * cx;
  return new Float32Array([
    cx, ux, z0, 0,
    cy, uy, z1, 0,
    cz, uz, z2, 0,
    -(cx * eye[0] + cy * eye[1] + cz * eye[2]),
    -(ux * eye[0] + uy * eye[1] + uz * eye[2]),
    -(z0 * eye[0] + z1 * eye[1] + z2 * eye[2]),
    1,
  ]);
}

function multiply(a: Float32Array, b: Float32Array): Float32Array {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c += 1) {
    for (let r = 0; r < 4; r += 1) {
      out[c * 4 + r] =
        a[0 * 4 + r] * b[c * 4 + 0] + a[1 * 4 + r] * b[c * 4 + 1] + a[2 * 4 + r] * b[c * 4 + 2] + a[3 * 4 + r] * b[c * 4 + 3];
    }
  }
  return out;
}

// ---- shaders ----

const SKY_VS = `attribute vec2 aPos; void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;
const SKY_FS = `precision mediump float;
uniform vec3 uTop; uniform vec3 uBottom; uniform float uH;
void main() {
  float t = clamp(gl_FragCoord.y / uH, 0.0, 1.0);
  gl_FragColor = vec4(mix(uBottom, uTop, pow(t, 0.85)), 1.0);
}`;

const TERRAIN_VS = `attribute vec3 aPos; attribute vec2 aUv;
uniform mat4 uMVP; uniform mat4 uMV;
varying vec2 vUv; varying float vDepth;
void main() {
  vUv = aUv;
  vec4 mv = uMV * vec4(aPos, 1.0);
  vDepth = -mv.z;
  gl_Position = uMVP * vec4(aPos, 1.0);
}`;
const TERRAIN_FS = `precision mediump float;
uniform sampler2D uTex; uniform vec3 uFogColor; uniform float uFogNear; uniform float uFogFar;
varying vec2 vUv; varying float vDepth;
void main() {
  vec3 c = texture2D(uTex, vUv).rgb;
  float f = clamp((vDepth - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0);
  gl_FragColor = vec4(mix(c, uFogColor, f * 0.75), 1.0);
}`;

const TRACK_VS = `attribute vec3 aPos; attribute vec3 aOther; attribute float aSide; attribute vec3 aColor; attribute float aWidth; attribute float aFlight;
uniform mat4 uMVP; uniform vec2 uViewport; uniform float uSel;
varying vec3 vColor;
void main() {
  float isSel = abs(aFlight - uSel) < 0.5 ? 1.0 : 0.0;
  float keep = uSel < -0.5 ? 1.0 : mix(0.22, 1.0, isSel);
  vColor = mix(vec3(0.12, 0.16, 0.23), aColor, keep) * (isSel > 0.5 && uSel > -0.5 ? 1.35 : 1.0);
  float w = aWidth * (isSel > 0.5 ? 1.6 : 1.0);
  vec4 cp = uMVP * vec4(aPos, 1.0);
  vec4 co = uMVP * vec4(aOther, 1.0);
  vec2 np = cp.xy / cp.w;
  vec2 no = co.xy / co.w;
  vec2 dir = normalize((no - np) * uViewport + vec2(1e-6));
  vec2 nrm = vec2(-dir.y, dir.x);
  vec2 off = nrm * aSide * w * 2.0 / uViewport;
  vec4 p = cp;
  p.xy = (np + off) * cp.w;
  gl_Position = p;
}`;
const TRACK_FS = `precision mediump float;
varying vec3 vColor;
void main() { gl_FragColor = vec4(vColor, 1.0); }`;

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("shader");
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) ?? "shader compile");
  }
  return shader;
}

function program(gl: WebGLRenderingContext, vs: string, fs: string): WebGLProgram {
  const p = gl.createProgram();
  if (!p) throw new Error("program");
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(p) ?? "program link");
  }
  return p;
}

type Camera = { yaw: number; pitch: number; zoom: number | null };
type Frame = { target: [number, number, number]; dist: number };

export function FlightGlobe3D() {
  const [year, setYear] = useState(2025);
  const [mosaic, setMosaic] = useState<TerrainMosaic | null>(null);
  const [stats, setStats] = useState<YearData | null>(null);
  const [camera, setCamera] = useState<Camera>({ yaw: 200, pitch: 22, zoom: null });
  const [selected, setSelected] = useState<number | null>(null);
  const [sizeTick, setSizeTick] = useState(0);
  const [roads, setRoads] = useState<RoadLine[] | null>(null);
  const [pilotSel, setPilotSel] = useState<Set<string>>(new Set());
  const [panelOpen, setPanelOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState<string | null>(null);
  const [dateTo, setDateTo] = useState<string | null>(null);
  const mvpRef = useRef<{ mvp: Float32Array; cssW: number; cssH: number } | null>(null);
  const sceneRef = useRef<{ midLon: number; midLat: number; kmPerLon: number; kmPerLat: number } | null>(null);
  const visibleRef = useRef<Track[]>([]);
  const [glError, setGlError] = useState(false);
  const [dataError, setDataError] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const labelCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const glRef = useRef<{
    gl: WebGLRenderingContext;
    sky: WebGLProgram;
    terrain: WebGLProgram;
    track: WebGLProgram;
    skyBuf: WebGLBuffer;
    terra: { vbo: WebGLBuffer; ibo: WebGLBuffer; tex: WebGLTexture; count: number } | null;
    trackBuf: WebGLBuffer | null;
    trackVerts: number;
    roadBuf: WebGLBuffer | null;
    roadVerts: number;
    tracksFor: number;
  } | null>(null);
  const glFailedRef = useRef(false);
  const uploadedRef = useRef<{ scene: unknown; trackData: unknown; roadData: unknown }>({
    scene: null,
    trackData: null,
    roadData: null,
  });
  const yearCache = useRef(new Map<number, YearData>());

  useEffect(() => {
    let cancelled = false;
    fetchRoadLines()
      .then((lines) => {
        if (!cancelled) setRoads(lines);
      })
      .catch(() => {
        if (!cancelled) setRoads([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchTerrainMosaic(BOUNDS, ZOOM)
      .then((next) => {
        if (!cancelled) setMosaic(next);
      })
      .catch(() => {
        if (!cancelled) setDataError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const cached = yearCache.current.get(year);
    if (cached) {
      setStats(cached);
      return;
    }
    fetch(`/data/flights3d/${year}.json`)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<YearData>;
      })
      .then((data) => {
        if (cancelled) return;
        yearCache.current.set(year, data);
        setStats(data);
        setSelected(null);
        setPilotSel(new Set());
        setDateFrom(null);
        setDateTo(null);
      })
      .catch(() => {
        if (!cancelled) setDataError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [year]);

  // Geometry + the full-resolution hillshaded relief texture.
  const scene = useMemo(() => {
    if (!mosaic) return null;
    const midLat = (BOUNDS.south + BOUNDS.north) / 2;
    const midLon = (BOUNDS.west + BOUNDS.east) / 2;
    const kmPerLon = 111.32 * Math.cos((midLat * Math.PI) / 180);
    const kmPerLat = 110.9;

    const sample = (lon: number, lat: number) =>
      mosaicElevation(mosaic, (lon - mosaic.west) / mosaic.lonStep, (mosaic.north - lat) / mosaic.latStep);

    // Vertices: a grid across the region.
    const GX = 512;
    const GY = 400;
    const verts = new Float32Array(GX * GY * 5); // x, y, z, u, v
    for (let j = 0; j < GY; j += 1) {
      const lat = BOUNDS.north - ((BOUNDS.north - BOUNDS.south) * j) / (GY - 1);
      for (let i = 0; i < GX; i += 1) {
        const lon = BOUNDS.west + ((BOUNDS.east - BOUNDS.west) * i) / (GX - 1);
        const o = (j * GX + i) * 5;
        verts[o] = (lon - midLon) * kmPerLon;
        verts[o + 1] = (lat - midLat) * kmPerLat;
        verts[o + 2] = (sample(lon, lat) / 1000) * EXAG;
        verts[o + 3] = i / (GX - 1);
        verts[o + 4] = j / (GY - 1);
      }
    }

    const heights = new Float32Array(GX * GY);
    for (let v = 0; v < GX * GY; v += 1) heights[v] = verts[v * 5 + 2];
    const meshZ = (lon: number, lat: number): number => {
      const fi = ((lon - BOUNDS.west) / (BOUNDS.east - BOUNDS.west)) * (GX - 1);
      const fj = ((BOUNDS.north - lat) / (BOUNDS.north - BOUNDS.south)) * (GY - 1);
      const i = Math.min(Math.max(fi, 0), GX - 1.001);
      const j = Math.min(Math.max(fj, 0), GY - 1.001);
      const i0 = Math.floor(i);
      const j0 = Math.floor(j);
      const ti = i - i0;
      const tj = j - j0;
      const a = heights[j0 * GX + i0];
      const b = heights[j0 * GX + i0 + 1];
      const c = heights[(j0 + 1) * GX + i0];
      const d = heights[(j0 + 1) * GX + i0 + 1];
      return a * (1 - ti) * (1 - tj) + b * ti * (1 - tj) + c * (1 - ti) * tj + d * ti * tj;
    };

    // Indices (32-bit; the caller falls back to a smaller grid if unsupported).
    const idx = new Uint32Array((GX - 1) * (GY - 1) * 6);
    let k = 0;
    for (let j = 0; j < GY - 1; j += 1) {
      for (let i = 0; i < GX - 1; i += 1) {
        const a = j * GX + i;
        const b = a + 1;
        const c = a + GX;
        const d = c + 1;
        idx[k] = a;
        idx[k + 1] = c;
        idx[k + 2] = b;
        idx[k + 3] = b;
        idx[k + 4] = c;
        idx[k + 5] = d;
        k += 6;
      }
    }

    // Relief texture: per-pixel hillshade from the tile mosaic itself.
    const W = mosaic.width;
    const H = mosaic.height;
    const scale = Math.min(1, MAX_TEX / Math.max(W, H));
    const TW = Math.max(2, Math.round(W * scale));
    const TH = Math.max(2, Math.round(H * scale));
    const elev = mosaic.elevations;
    const pxPerDegLon = 1 / mosaic.lonStep;
    const pxPerDegLat = 1 / mosaic.latStep;
    const texData = new Uint8Array(TW * TH * 4);
    const lx = -0.5;
    const ly = 0.5;
    const lz = Math.SQRT1_2;
    for (let ty = 0; ty < TH; ty += 1) {
      const sy = Math.min(H - 1, Math.round(ty / scale));
      for (let tx = 0; tx < TW; tx += 1) {
        const sx = Math.min(W - 1, Math.round(tx / scale));
        const i = sy * W + sx;
        const h = elev[i];
        const hx = elev[sy * W + Math.min(W - 1, sx + 1)] - elev[sy * W + Math.max(0, sx - 1)];
        const hy = elev[Math.max(0, sy - 1) * W + sx] - elev[Math.min(H - 1, sy + 1) * W + sx];
        // Gradients per metre of ground distance.
        const dzdx = hx / (2 * (pxPerDegLon > 0 ? 1 / pxPerDegLon : 1) * 111320 * Math.cos((midLat * Math.PI) / 180));
        const dzdy = hy / (2 * (1 / pxPerDegLat) * 110900);
        const len = Math.hypot(dzdx, dzdy, 1);
        const light = Math.max(0, (-dzdx / len) * lx + (dzdy / len) * ly + (1 / len) * lz);
        const base = terrainRgb(h);
        const lit = 0.5 + 0.78 * light;
        const o = (ty * TW + tx) * 4;
        texData[o] = Math.min(255, base[0] * lit);
        texData[o + 1] = Math.min(255, base[1] * lit);
        texData[o + 2] = Math.min(255, base[2] * lit);
        texData[o + 3] = 255;
      }
    }

    return { verts, idx, vertCount: GX * GY, indexCount: idx.length, texData, TW, TH, midLat, midLon, kmPerLon, kmPerLat, meshZ };
  }, [mosaic]);

  // The flights the filters keep.
  const visibleFlights = useMemo(() => {
    if (!stats) return [];
    return stats.flights.filter(
      (f) =>
        (pilotSel.size === 0 || pilotSel.has(f.pilot)) &&
        (dateFrom === null || f.date >= dateFrom) &&
        (dateTo === null || f.date <= dateTo),
    );
  }, [stats, pilotSel, dateFrom, dateTo]);

  const pilotList = useMemo(() => {
    if (!stats) return [];
    const counts = new Map<string, number>();
    for (const f of stats.flights) counts.set(f.pilot, (counts.get(f.pilot) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [stats]);

  const dateBounds = useMemo(() => {
    if (!stats) return { min: "", max: "" };
    const dates = stats.flights.map((f) => f.date).sort();
    return { min: dates[0], max: dates[dates.length - 1] };
  }, [stats]);

  const filtered = visibleFlights.length !== (stats?.flights.length ?? 0);
  const selectedFlight = selected !== null ? (visibleFlights.find((f) => f.id === selected) ?? null) : null;

  const togglePilot = (pilot: string) =>
    setPilotSel((prev) => {
      const next = new Set(prev);
      if (next.has(pilot)) next.delete(pilot);
      else next.add(pilot);
      return next;
    });

  // Roads, draped on the rendered mesh and drawn through the same ribbon pipeline.
  const roadData = useMemo(() => {
    if (!scene || !roads || roads.length === 0) return null;
    const segs: number[] = [];
    let segCount = 0;
    const c = mix([196, 208, 224].map((v) => v / 255) as [number, number, number], SKY_BOTTOM, 0.6);
    for (const line of roads) {
      const pts = line.p;
      if (pts.length < 2) continue;
      const width = line.k >= 2 ? 1.2 : 0.9;
      for (let i = 0; i < pts.length - 1; i += 1) {
        const [lon1, lat1] = pts[i];
        const [lon2, lat2] = pts[i + 1];
        const a: [number, number, number] = [
          (lon1 - scene.midLon) * scene.kmPerLon,
          (lat1 - scene.midLat) * scene.kmPerLat,
          scene.meshZ(lon1, lat1) + 0.045,
        ];
        const b: [number, number, number] = [
          (lon2 - scene.midLon) * scene.kmPerLon,
          (lat2 - scene.midLat) * scene.kmPerLat,
          scene.meshZ(lon2, lat2) + 0.045,
        ];
        if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.02) continue;
        for (const [p, other, side] of [
          [a, b, 1],
          [a, b, -1],
          [b, a, 1],
          [b, a, -1],
          [a, b, -1],
          [b, a, 1],
        ] as [[number, number, number], [number, number, number], number][]) {
          segs.push(p[0], p[1], p[2], other[0], other[1], other[2], side, c[0], c[1], c[2], width, -1);
        }
        segCount += 1;
      }
    }
    return { data: new Float32Array(segs), verts: segCount * 6 };
  }, [scene, roads]);

  // Frame the visible flights: median centre, 95th-percentile radius.
  const frame: Frame = useMemo(() => {
    if (!scene || !stats) return { target: [0, 0, 1.4], dist: 80 };
    const xs: number[] = [];
    const ys: number[] = [];
    let sumZ = 0;
    let n = 0;
    let maxZ = 0;
    for (const flight of visibleFlights) {
      for (const [lon, lat, alt] of flight.pts) {
        xs.push((lon - scene.midLon) * scene.kmPerLon);
        ys.push((lat - scene.midLat) * scene.kmPerLat);
        sumZ += (alt / 1000) * EXAG;
        maxZ = Math.max(maxZ, (alt / 1000) * EXAG);
        n += 1;
      }
    }
    if (!n) return { target: [0, 0, 1.4], dist: 80 };
    xs.sort((a, b) => a - b);
    ys.sort((a, b) => a - b);
    const mx = xs[Math.floor(n / 2)];
    const my = ys[Math.floor(n / 2)];
    const radii = xs.map((x, i) => Math.hypot(x - mx, ys[i] - my)).sort((a, b) => a - b);
    const r95 = radii[Math.floor(n * 0.95)] ?? 10;
    const tz = Math.min(maxZ * 0.7, sumZ / n + r95 * 0.22);
    const dist = Math.min(300, Math.max(38, (r95 * 1.9) / Math.tan(FOV / 2)));
    return { target: [mx, my, tz], dist };
  }, [scene, stats, visibleFlights]);

  useEffect(() => {
    sceneRef.current = scene;
  }, [scene]);

  useEffect(() => {
    visibleRef.current = visibleFlights;
  }, [visibleFlights]);

  // Track ribbons for the selected year.
  const trackData = useMemo(() => {
    if (!scene || !stats) return null;
    const segs: number[] = [];
    let segCount = 0;
    let flightIdx = -1;
    for (const flight of visibleFlights) {
      const pts = flight.pts;
      if (pts.length < 2) continue;
      const width = flight.ssa.length ? 3 : flight.wave ? 2 : 1.3;
      const alpha = flight.wave || flight.ssa.length ? 0.95 : 0.5;
      flightIdx += 1;
      const world = pts.map(([lon, lat, alt]) => [
        (lon - scene.midLon) * scene.kmPerLon,
        (lat - scene.midLat) * scene.kmPerLat,
        (alt / 1000) * EXAG,
      ] as [number, number, number]);
      for (let i = 0; i < world.length - 1; i += 1) {
        const a = world[i];
        const b = world[i + 1];
        const dist = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
        if (dist < 0.02) continue;
        const altMid = ((pts[i][2] + pts[i + 1][2]) / 2) * 3.28084;
        const c = mix(altRgb(altMid), SKY_BOTTOM, 1 - alpha);
        const w = width; // CSS pixels — the shader expands the ribbon in screen space
        for (const [p, other, side] of [
          [a, b, 1],
          [a, b, -1],
          [b, a, 1],
          [b, a, -1],
          [a, b, -1],
          [b, a, 1],
        ] as [[number, number, number], [number, number, number], number][]) {
          segs.push(p[0], p[1], p[2], other[0], other[1], other[2], side, c[0], c[1], c[2], w, flightIdx);
        }
        segCount += 1;
      }
    }
    return { data: new Float32Array(segs), verts: segCount * 6 };
  }, [scene, stats, visibleFlights]);

  // Draw — and lazily create the GL context, upload whatever changed.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let state = glRef.current;
    if (!state) {
      if (glFailedRef.current) return;
      const gl = canvas.getContext("webgl", { antialias: true, alpha: false, powerPreference: "high-performance" });
      const ok = gl && gl.getExtension("OES_element_index_uint");
      if (!gl || !ok) {
        glFailedRef.current = true;
        queueMicrotask(() => setGlError(true));
        return;
      }
      try {
        const sky = program(gl, SKY_VS, SKY_FS);
        const terrain = program(gl, TERRAIN_VS, TERRAIN_FS);
        const track = program(gl, TRACK_VS, TRACK_FS);
        const skyBuf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, skyBuf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.BACK);
        state = {
          gl,
          sky,
          terrain,
          track,
          skyBuf,
          terra: null,
          trackBuf: null,
          trackVerts: 0,
          roadBuf: null,
          roadVerts: 0,
          tracksFor: 0,
        };
        glRef.current = state;
      } catch {
        glFailedRef.current = true;
        queueMicrotask(() => setGlError(true));
        return;
      }
    }
    const { gl, sky, terrain, track } = state;

    // Upload terrain once per scene.
    if (scene && uploadedRef.current.scene !== scene) {
      if (state.terra) {
        gl.deleteBuffer(state.terra.vbo);
        gl.deleteBuffer(state.terra.ibo);
        gl.deleteTexture(state.terra.tex);
      }
      const vbo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferData(gl.ARRAY_BUFFER, scene.verts, gl.STATIC_DRAW);
      const ibo = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, scene.idx, gl.STATIC_DRAW);
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, scene.TW, scene.TH, 0, gl.RGBA, gl.UNSIGNED_BYTE, scene.texData);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      state.terra = { vbo, ibo, tex, count: scene.indexCount };
      uploadedRef.current.scene = scene;
    }

    // Upload tracks once per year data, roads once per scene.
    if (trackData && uploadedRef.current.trackData !== trackData) {
      if (!state.trackBuf) state.trackBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, state.trackBuf);
      gl.bufferData(gl.ARRAY_BUFFER, trackData.data, gl.STATIC_DRAW);
      state.trackVerts = trackData.verts;
      uploadedRef.current.trackData = trackData;
    }
    if (roadData && uploadedRef.current.roadData !== roadData) {
      if (!state.roadBuf) state.roadBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, state.roadBuf);
      gl.bufferData(gl.ARRAY_BUFFER, roadData.data, gl.STATIC_DRAW);
      state.roadVerts = roadData.verts;
      uploadedRef.current.roadData = roadData;
    }

    if (!scene || !state.terra) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    const bw = Math.round(cssW * dpr);
    const bh = Math.round(cssH * dpr);
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
    gl.viewport(0, 0, bw, bh);

    const { yaw, pitch } = camera;
    const dist = camera.zoom ?? frame.dist;
    const yawR = (yaw * Math.PI) / 180;
    const pitchR = (pitch * Math.PI) / 180;
    const target = frame.target;
    const eye: [number, number, number] = [
      target[0] + dist * Math.cos(pitchR) * Math.sin(yawR),
      target[1] + dist * Math.cos(pitchR) * Math.cos(yawR),
      target[2] + dist * Math.sin(pitchR),
    ];
    const proj = perspective(FOV, cssW / cssH, 0.5, dist * 4 + 400);
    const view = lookAt(eye, target);
    const mvp = multiply(proj, view);
    mvpRef.current = { mvp, cssW, cssH };

    // Sky.
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(sky);
    gl.bindBuffer(gl.ARRAY_BUFFER, state.skyBuf);
    const skyA = gl.getAttribLocation(sky, "aPos");
    gl.enableVertexAttribArray(skyA);
    gl.vertexAttribPointer(skyA, 2, gl.FLOAT, false, 0, 0);
    gl.uniform3fv(gl.getUniformLocation(sky, "uTop"), SKY_TOP);
    gl.uniform3fv(gl.getUniformLocation(sky, "uBottom"), SKY_BOTTOM);
    gl.uniform1f(gl.getUniformLocation(sky, "uH"), bh);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.DEPTH_TEST);

    // Terrain.
    gl.useProgram(terrain);
    gl.bindBuffer(gl.ARRAY_BUFFER, state.terra.vbo);
    const posA = gl.getAttribLocation(terrain, "aPos");
    const uvA = gl.getAttribLocation(terrain, "aUv");
    gl.enableVertexAttribArray(posA);
    gl.vertexAttribPointer(posA, 3, gl.FLOAT, false, 20, 0);
    gl.enableVertexAttribArray(uvA);
    gl.vertexAttribPointer(uvA, 2, gl.FLOAT, false, 20, 12);
    gl.uniformMatrix4fv(gl.getUniformLocation(terrain, "uMVP"), false, mvp);
    gl.uniformMatrix4fv(gl.getUniformLocation(terrain, "uMV"), false, view);
    gl.uniform3fv(gl.getUniformLocation(terrain, "uFogColor"), SKY_BOTTOM);
    gl.uniform1f(gl.getUniformLocation(terrain, "uFogNear"), dist * 0.62);
    gl.uniform1f(gl.getUniformLocation(terrain, "uFogFar"), dist * 1.85);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, state.terra.tex);
    gl.uniform1i(gl.getUniformLocation(terrain, "uTex"), 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, state.terra.ibo);
    gl.drawElements(gl.TRIANGLES, state.terra.count, gl.UNSIGNED_INT, 0);

    // Roads and tracks share the ribbon program: one setup, two buffers.
    const setupRibbons = (buffer: WebGLBuffer) => {
      gl.useProgram(track);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      const stride = 48;
      gl.enableVertexAttribArray(gl.getAttribLocation(track, "aPos"));
      gl.vertexAttribPointer(gl.getAttribLocation(track, "aPos"), 3, gl.FLOAT, false, stride, 0);
      gl.enableVertexAttribArray(gl.getAttribLocation(track, "aOther"));
      gl.vertexAttribPointer(gl.getAttribLocation(track, "aOther"), 3, gl.FLOAT, false, stride, 12);
      gl.enableVertexAttribArray(gl.getAttribLocation(track, "aSide"));
      gl.vertexAttribPointer(gl.getAttribLocation(track, "aSide"), 1, gl.FLOAT, false, stride, 24);
      gl.enableVertexAttribArray(gl.getAttribLocation(track, "aColor"));
      gl.vertexAttribPointer(gl.getAttribLocation(track, "aColor"), 3, gl.FLOAT, false, stride, 28);
      gl.enableVertexAttribArray(gl.getAttribLocation(track, "aWidth"));
      gl.vertexAttribPointer(gl.getAttribLocation(track, "aWidth"), 1, gl.FLOAT, false, stride, 40);
      gl.enableVertexAttribArray(gl.getAttribLocation(track, "aFlight"));
      gl.vertexAttribPointer(gl.getAttribLocation(track, "aFlight"), 1, gl.FLOAT, false, stride, 44);
      gl.uniformMatrix4fv(gl.getUniformLocation(track, "uMVP"), false, mvp);
      gl.uniform2f(gl.getUniformLocation(track, "uViewport"), cssW, cssH);
    };

    if (state.roadBuf && state.roadVerts > 0) {
      setupRibbons(state.roadBuf);
      gl.uniform1f(gl.getUniformLocation(track, "uSel"), -1);
      gl.drawArrays(gl.TRIANGLES, 0, state.roadVerts);
    }

    if (state.trackBuf && state.trackVerts > 0) {
      setupRibbons(state.trackBuf);
      const selIndex = selected !== null ? visibleFlights.findIndex((f) => f.id === selected) : -1;
      gl.uniform1f(gl.getUniformLocation(track, "uSel"), selIndex);
      gl.drawArrays(gl.TRIANGLES, 0, state.trackVerts);
    }

    // Summit labels on the transparent overlay canvas.
    const labelCanvas = labelCanvasRef.current;
    if (labelCanvas) {
      if (labelCanvas.width !== bw || labelCanvas.height !== bh) {
        labelCanvas.width = bw;
        labelCanvas.height = bh;
      }
      const lctx = labelCanvas.getContext("2d");
      if (lctx) {
        lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        lctx.clearRect(0, 0, cssW, cssH);
        lctx.font = "500 11px ui-sans-serif, system-ui, sans-serif";
        lctx.textAlign = "center";
        lctx.textBaseline = "bottom";
        const placed: { x0: number; y0: number; x1: number; y1: number }[] = [];
        for (const peak of PEAKS) {
          const x = (peak.lon - scene.midLon) * scene.kmPerLon;
          const y = (peak.lat - scene.midLat) * scene.kmPerLat;
          const z = scene.meshZ(peak.lon, peak.lat) + 0.06;
          const w = mvp[3] * x + mvp[7] * y + mvp[11] * z + mvp[15];
          if (w <= 0.5) continue;
          const sx = ((mvp[0] * x + mvp[4] * y + mvp[8] * z + mvp[12]) / w / 2 + 0.5) * cssW;
          const sy = (0.5 - (mvp[1] * x + mvp[5] * y + mvp[9] * z + mvp[13]) / w / 2) * cssH;
          if (sx < -60 || sy < -20 || sx > cssW + 60 || sy > cssH + 20) continue;
          // Keep the labels legible: the most important summit wins the spot, the
          // rest shift vertically until they clear an earlier one (or drop out).
          const textW = lctx.measureText(peak.name).width;
          let ty: number | null = null;
          for (const dy of [0, -13, 13, -26, 26, -39, 39, -52, 52]) {
            const y1 = sy - 4 + dy;
            const rect = { x0: sx - textW / 2 - 3, y0: y1 - 13, x1: sx + textW / 2 + 3, y1 };
            const hits = placed.some((p) => rect.x0 < p.x1 && rect.x1 > p.x0 && rect.y0 < p.y1 && rect.y1 > p.y0);
            if (!hits) {
              placed.push(rect);
              ty = y1;
              break;
            }
          }
          if (ty === null) continue;
          lctx.beginPath();
          lctx.arc(sx, sy, 1.6, 0, Math.PI * 2);
          lctx.fillStyle = "rgba(226,232,240,0.9)";
          lctx.fill();
          if (Math.abs(ty - (sy - 4)) > 2) {
            lctx.beginPath();
            lctx.moveTo(sx, sy - 3);
            lctx.lineTo(sx, ty + 2);
            lctx.strokeStyle = "rgba(226,232,240,0.35)";
            lctx.lineWidth = 1;
            lctx.stroke();
          }
          lctx.lineWidth = 3;
          lctx.strokeStyle = "rgba(2,6,23,0.85)";
          lctx.strokeText(peak.name, sx, ty);
          lctx.fillStyle = "#e2e8f0";
          lctx.fillText(peak.name, sx, ty);
        }
      }
    }

  }, [scene, stats, camera, frame, trackData, roadData, selected, sizeTick, visibleFlights]);

  // Redraw on viewport changes (the canvas is sized from its CSS box).
  useEffect(() => {
    const onResize = () => setSizeTick((v) => v + 1);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Orbit + zoom.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let pinch = 0;
    let downX = 0;
    let downY = 0;
    let moved = false;
    const pointers = new Map<number, { x: number; y: number }>();

    // Nearest flight to a click, in screen space — a few hundredths of a millisecond
    // over the decimated tracks.
    const pick = (clientX: number, clientY: number): number | null => {
      const cam = mvpRef.current;
      const data = visibleRef.current;
      if (!cam || !data || !sceneRef.current) return null;
      const rect = canvas.getBoundingClientRect();
      const px = clientX - rect.left;
      const py = clientY - rect.top;
      const m = cam.mvp;
      let best: number | null = null;
      let bestD = 14 * 14;
      for (const flight of data) {
        for (const [lon, lat, alt] of flight.pts) {
          const x = (lon - sceneRef.current.midLon) * sceneRef.current.kmPerLon;
          const y = (lat - sceneRef.current.midLat) * sceneRef.current.kmPerLat;
          const z = (alt / 1000) * EXAG;
          const w = m[3] * x + m[7] * y + m[11] * z + m[15];
          if (w <= 0) continue;
          const sx = ((m[0] * x + m[4] * y + m[8] * z + m[12]) / w / 2 + 0.5) * cam.cssW;
          const sy = (0.5 - (m[1] * x + m[5] * y + m[9] * z + m[13]) / w / 2) * cam.cssH;
          const dx = sx - px;
          const dy = sy - py;
          const d = dx * dx + dy * dy;
          if (d < bestD) {
            bestD = d;
            best = flight.id;
          }
        }
      }
      return best;
    };

    const down = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) {
        dragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
        downX = e.clientX;
        downY = e.clientY;
        moved = false;
      } else if (pointers.size === 2) {
        const [p1, p2] = [...pointers.values()];
        pinch = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      }
    };
    const move = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [p1, p2] = [...pointers.values()];
        const d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        if (pinch > 0) {
          const factor = pinch / d;
          setCamera((c) => ({ ...c, zoom: Math.min(320, Math.max(2, (c.zoom ?? frame.dist) * factor)) }));
        }
        pinch = d;
        return;
      }
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      if (Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY) > 5) moved = true;
      setCamera((c) => ({
        ...c,
        yaw: (c.yaw - dx * 0.35 + 360) % 360,
        pitch: Math.min(84, Math.max(2, c.pitch + dy * 0.25)),
      }));
    };
    const up = (e: PointerEvent) => {
      const wasSingle = pointers.size === 1;
      pointers.delete(e.pointerId);
      if (pointers.size === 0) dragging = false;
      if (pointers.size < 2) pinch = 0;
      if (wasSingle && !moved) {
        setSelected(pick(e.clientX, e.clientY));
      }
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      setCamera((c) => ({
        ...c,
        zoom: Math.min(320, Math.max(2, (c.zoom ?? frame.dist) * (1 + e.deltaY * 0.0012))),
      }));
    };

    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("wheel", wheel, { passive: false });
    return () => {
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      canvas.removeEventListener("wheel", wheel);
    };
  }, [frame.dist]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-950">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block h-full w-full cursor-grab touch-none select-none active:cursor-grabbing"
        aria-label={`Three-dimensional view of the ${year} wave camp flights over the White Mountains`}
      />
      <canvas ref={labelCanvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 block h-full w-full" />

      <div className="pointer-events-none absolute left-3 top-3 z-10 flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-1.5">
        {YEARS.map((y) => (
          <button
            key={y}
            type="button"
            aria-pressed={year === y}
            onClick={() => setYear(y)}
            className={`pointer-events-auto rounded-full px-3 py-1 text-sm font-medium tabular-nums backdrop-blur-sm transition-colors ${
              year === y
                ? "bg-sky-400/90 text-slate-950"
                : "bg-slate-950/50 text-slate-200 ring-1 ring-white/10 hover:bg-slate-800/70"
            }`}
          >
            {y}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={panelOpen}
          onClick={() => setPanelOpen((v) => !v)}
          className={`pointer-events-auto rounded-full px-3 py-1 text-sm font-medium backdrop-blur-sm transition-colors ${
            panelOpen || filtered
              ? "bg-sky-400/90 text-slate-950"
              : "bg-slate-950/50 text-slate-200 ring-1 ring-white/10 hover:bg-slate-800/70"
          }`}
        >
          Pilots &amp; dates{filtered ? ` · ${visibleFlights.length}` : ""}
        </button>
      </div>

      {stats ? (
        <p className="pointer-events-none absolute right-3 top-4 z-10 hidden rounded-full bg-slate-950/50 px-3 py-1 text-sm text-slate-200 tabular-nums ring-1 ring-white/10 backdrop-blur-sm sm:block">
          {filtered ? `${visibleFlights.length} of ${stats.flights.length}` : stats.flights.length} flights
          {visibleFlights.length
            ? ` · best ${new Intl.NumberFormat("en-US").format(Math.max(...visibleFlights.map((f) => f.maxAltFt)))} ft`
            : ""}
        </p>
      ) : null}

      {panelOpen && stats ? (
        <div className="absolute left-3 top-24 z-10 max-h-[62%] w-64 overflow-y-auto rounded-2xl bg-slate-950/85 p-4 ring-1 ring-white/15 backdrop-blur-sm sm:top-14">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Pilots</p>
            {pilotSel.size ? (
              <button
                type="button"
                onClick={() => setPilotSel(new Set())}
                className="text-[11px] font-medium text-sky-300 hover:text-sky-200"
              >
                clear
              </button>
            ) : null}
          </div>
          <ul className="mt-2 grid gap-0.5">
            {pilotList.map(([pilot, count]) => {
              const on = pilotSel.has(pilot);
              return (
                <li key={pilot}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => togglePilot(pilot)}
                    className={`w-full rounded-lg px-2 py-1 text-left text-xs transition-colors ${
                      on ? "bg-sky-400/90 font-medium text-slate-950" : "text-slate-200 hover:bg-white/10"
                    }`}
                  >
                    {pilot} <span className={on ? "opacity-70" : "text-slate-400"}>({count})</span>
                  </button>
                </li>
              );
            })}
          </ul>

          <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Dates</p>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="date"
              aria-label="From date"
              min={dateBounds.min}
              max={dateBounds.max}
              value={dateFrom ?? ""}
              onChange={(e) => setDateFrom(e.target.value === "" ? null : e.target.value)}
              className="w-full rounded-lg bg-slate-900 px-2 py-1 text-xs text-slate-200 ring-1 ring-white/10 [color-scheme:dark]"
            />
            <span className="text-xs text-slate-500">→</span>
            <input
              type="date"
              aria-label="To date"
              min={dateBounds.min}
              max={dateBounds.max}
              value={dateTo ?? ""}
              onChange={(e) => setDateTo(e.target.value === "" ? null : e.target.value)}
              className="w-full rounded-lg bg-slate-900 px-2 py-1 text-xs text-slate-200 ring-1 ring-white/10 [color-scheme:dark]"
            />
          </div>
          {dateFrom || dateTo ? (
            <button
              type="button"
              onClick={() => {
                setDateFrom(null);
                setDateTo(null);
              }}
              className="mt-2 text-[11px] font-medium text-sky-300 hover:text-sky-200"
            >
              clear dates
            </button>
          ) : null}

          {filtered ? (
            <p className="mt-3 text-[11px] text-slate-400">
              {visibleFlights.length} of {stats.flights.length} flights shown
            </p>
          ) : null}
        </div>
      ) : null}

      {selectedFlight ? (() => {
        const flight = selectedFlight;
        if (!flight) return null;
        return (
          <div className="absolute right-3 top-24 z-10 max-w-[16rem] rounded-2xl bg-slate-950/80 p-4 ring-1 ring-white/15 backdrop-blur-sm sm:top-14">
            <div className="flex items-start justify-between gap-3">
              <p className="font-display text-sm font-semibold text-white">{flight.pilot}</p>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="Clear the selection"
                className="rounded-full px-1.5 text-slate-400 transition-colors hover:text-white"
              >
                ✕
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-300">
              {new Date(`${flight.date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              {" · "}
              <span className="tabular-nums">
                {new Intl.NumberFormat("en-US").format(flight.maxAltFt)} ft
              </span>
            </p>
            {flight.ssa.length ? (
              <p className="mt-1 text-[11px] text-slate-400">{flight.ssa.join(" · ")}</p>
            ) : null}
          </div>
        );
      })() : null}

      {glError ? (
        <p className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-slate-300">
          This view needs WebGL, which this browser isn&apos;t providing right now.
        </p>
      ) : null}
      {!glError && (!mosaic || !stats) && !dataError ? (
        <p className="absolute inset-0 grid place-items-center text-sm text-slate-400">Loading terrain…</p>
      ) : null}
      {dataError && !glError ? (
        <p className="absolute inset-0 grid place-items-center text-sm text-slate-300">
          The 3D terrain is unavailable right now.
        </p>
      ) : null}

      <p className="pointer-events-none absolute bottom-11 left-4 z-10 text-[11px] text-slate-400">
        drag to orbit · scroll to zoom · click a track
      </p>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-wrap items-center gap-x-4 gap-y-1 bg-gradient-to-t from-slate-950/85 to-transparent px-4 pb-3 pt-10 text-[11px] text-slate-300">
        <span>Altitude</span>
        <span
          className="h-2 w-40 rounded-full"
          style={{
            background: `linear-gradient(to right, ${ALT_RAMP.map(
              ([ft, c]) => `rgb(${c.join(",")}) ${((ft - 800) / (34000 - 800)) * 100}%`,
            ).join(", ")})`,
          }}
        />
        <span className="tabular-nums">800 ft → 34,000 ft</span>
        <span className="ml-auto hidden sm:inline">wave flights bright · everything else dim · GPS altitudes read a little high</span>
      </div>
    </div>
  );
}
