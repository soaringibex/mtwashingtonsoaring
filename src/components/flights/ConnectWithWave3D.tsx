"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PHASE_COLORS, PHASE_SHORT, hexToUnitRgb } from "@/lib/flight-phases";
import { fetchTerrainMosaic, mosaicElevation, type TerrainMosaic } from "@/lib/terrain-tiles";

/**
 * The flight of 2026-10-12 in three dimensions — one glider's track over the
 * Presidential and Carter ranges, drawn with the same WebGL terrain pipeline as
 * the camp's /flights/3d view, but built to tell one story.
 *
 * Two ways to drive it:
 *  - standalone ("explore"): its own phase buttons, note cards and barogram;
 *  - scroll mode (`phase` + `scroll` props): the story page's scroll position
 *    picks the phase — the camera flies there and the barogram retraces that
 *    segment — while the barogram's play/scrub stay available.
 *
 * Terrain comes from the shared /api/terrain mosaic at zoom 12 (~27 m per
 * pixel); the track is the pilot's own IGC file, decimated to one fix per four
 * seconds (scripts/build-flight-story.mjs).
 */

const BOUNDS = { west: -71.355, south: 44.215, east: -71.095, north: 44.44 };
const ZOOM = 12;
const EXAG = 2.3;
const FOV = (50 * Math.PI) / 180;
const MAX_TEX = 2048;
const PLAY_SECONDS = 75; // whole flight in 75 s when playing
/**
 * One constant playback speed for every phase's track run — calibrated on the tow
 * leg: its 876 s of flight play in 4.2 s. A longer phase simply takes longer, so
 * the marker never speeds up from card to card.
 */
const SEGMENT_RATE = 876 / 4.2; // flight seconds per real second

type TrackPoint = [number, number, number, number]; // lon, lat, alt m, unix sec

type Phase = {
  id: string;
  label: string;
  tone: "key" | "context";
  from: number;
  to: number;
  note: string;
};

type TrackData = {
  id: number;
  date: string;
  pilot: string;
  aircraft: string;
  takeoff: number;
  landing: number;
  maxAltFt: number;
  utcOffsetHours: number;
  points: TrackPoint[];
  phases: Phase[];
};

/** The summits worth a label, each snapped to its own top on the terrain mesh. */
const PEAKS = [
  { name: "Mt Washington", lat: 44.27049, lon: -71.3033 },
  { name: "Mt Madison", lat: 44.32879, lon: -71.27667 },
  { name: "Mt Adams", lat: 44.32058, lon: -71.29164 },
  { name: "Mt Jefferson", lat: 44.30423, lon: -71.31675 },
  { name: "Mt Monroe", lat: 44.25506, lon: -71.3215 },
  { name: "The Horn", lat: 44.2947, lon: -71.2789 },
  { name: "Mt Moriah", lat: 44.34053, lon: -71.13172 },
  { name: "Carter Dome", lat: 44.2674, lon: -71.17912 },
  { name: "Wildcat", lat: 44.2592, lon: -71.20161 },
  { name: "Pine Mountain", lat: 44.36588, lon: -71.21519 },
  { name: "Gorham (2G8)", lat: 44.3934, lon: -71.1934 },
];

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
  gl_FragColor = vec4(mix(c, uFogColor, f * 0.55), 1.0);
}`;

const TRACK_VS = `attribute vec3 aPos; attribute vec3 aDir; attribute float aSide; attribute vec3 aColor; attribute float aWidth; attribute float aPhase;
uniform mat4 uMVP; uniform vec2 uViewport; uniform float uSel;
varying vec3 vColor;
void main() {
  float isSel = abs(aPhase - uSel) < 0.5 ? 1.0 : 0.0;
  float keep = uSel < -0.5 ? 1.0 : mix(0.22, 1.0, isSel);
  vColor = mix(vec3(0.1, 0.13, 0.19), aColor, keep) * (isSel > 0.5 && uSel > -0.5 ? 1.3 : 1.0);
  float w = aWidth * (isSel > 0.5 ? 1.7 : 1.0);
  vec4 cp = uMVP * vec4(aPos, 1.0);
  vec4 cq = uMVP * vec4(aPos + aDir, 1.0);
  vec2 np = cp.xy / cp.w;
  vec2 nq = cq.xy / cq.w;
  vec2 dir = normalize((nq - np) * uViewport + vec2(1e-6));
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

/** A spinning circulation arrow: an arc with a head, drawn in screen space. */
function drawArcArrow(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, start: number, color: string): void {
  const sweep = Math.PI * 1.5;
  const a1 = start + sweep;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(cx, cy, r, start, a1);
  ctx.stroke();
  const px = cx + r * Math.cos(a1);
  const py = cy + r * Math.sin(a1);
  const angle = Math.atan2(Math.cos(a1), -Math.sin(a1));
  const size = 10;
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px - size * Math.cos(angle - 0.5), py - size * Math.sin(angle - 0.5));
  ctx.moveTo(px, py);
  ctx.lineTo(px - size * Math.cos(angle + 0.5), py - size * Math.sin(angle + 0.5));
  ctx.stroke();
  ctx.restore();
}

/** A small puffy cloud of overlapping lobes, drawn in screen space. */
function drawCloud(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  const lobes: [number, number, number][] = [
    [-22, 6, 13],
    [-6, -6, 18],
    [14, 0, 14],
    [30, 7, 11],
    [2, 9, 13],
  ];
  ctx.save();
  ctx.fillStyle = "rgba(241,245,249,0.95)";
  for (const [dx, dy, r] of lobes) {
    ctx.beginPath();
    ctx.arc(cx + dx, cy + dy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** The up-slope wind arrow: a dashed shaft marching toward the ridge, with a head. */
function drawWindArrow(
  ctx: CanvasRenderingContext2D,
  a: [number, number, number],
  b: [number, number, number],
  tick: number,
): void {
  const [ax, ay] = a;
  const [bx, by] = b;
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy);
  if (len < 36) return;
  ctx.save();
  ctx.strokeStyle = "rgba(125,211,252,0.95)";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.setLineDash([14, 10]);
  ctx.lineDashOffset = -((tick * 1.8) % 24);
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.stroke();
  ctx.setLineDash([]);
  const angle = Math.atan2(dy, dx);
  const size = 15;
  ctx.beginPath();
  ctx.moveTo(bx, by);
  ctx.lineTo(bx - size * Math.cos(angle - 0.45), by - size * Math.sin(angle - 0.45));
  ctx.moveTo(bx, by);
  ctx.lineTo(bx - size * Math.cos(angle + 0.45), by - size * Math.sin(angle + 0.45));
  ctx.stroke();
  ctx.restore();
}

type Camera = { yaw: number; pitch: number; zoom: number; tx: number; ty: number; tz: number };

/** Fixed camera poses per phase — tuned so the terrain reads and the track crosses the frame. */
const PHASE_VIEWS: Record<string, { yaw: number; pitch: number }> = {
  whole: { yaw: 205, pitch: 29 },
  tow: { yaw: 118, pitch: 34 },
  ridge: { yaw: 318, pitch: 28 },
  transit: { yaw: 140, pitch: 36 },
  rotor: { yaw: 155, pitch: 34 },
  wave: { yaw: 130, pitch: 30 },
  upwind: { yaw: 190, pitch: 36 },
  home: { yaw: 75, pitch: 36 },
};

/** Which way the frame's bias points (see phaseView) — opposite the story card's
 * side, so the card never lands on the phase. The transit card sits on the right. */
const PHASE_BIAS: Record<string, number> = { transit: -1 };

const fmt = new Intl.NumberFormat("en-US");

export type ConnectWithWave3DProps = {
  /** Controlled phase spotlight (scroll mode); omitted → the scene manages it. */
  phase?: string;
  /** Scroll-story mode: no built-in buttons or note cards; each phase flies and plays as it is set. */
  scroll?: boolean;
  /** Scroll-story mode: a phase's track run finished — or the reader took over the scrubber. */
  onPhasePlayed?: (phaseId: string) => void;
};

export function ConnectWithWave3D({ phase, scroll = false, onPhasePlayed }: ConnectWithWave3DProps = {}) {
  const [track, setTrack] = useState<TrackData | null>(null);
  const [mosaic, setMosaic] = useState<TerrainMosaic | null>(null);
  const [dataError, setDataError] = useState(false);
  const [glError, setGlError] = useState(false);
  const [sizeTick, setSizeTick] = useState(0);

  const [internalSelection, setInternalSelection] = useState<string>("whole");
  const selection = phase ?? internalSelection;
  const [time, setTime] = useState<number | null>(null); // scrub position, unix sec
  const [playing, setPlaying] = useState(false);
  const [noteDismissed, setNoteDismissed] = useState(false);
  /** Advances while the rotor and ridge annotations animate (~30 fps). */
  const [spinTick, setSpinTick] = useState(0);
  /** Bumped to cancel an in-flight scroll segment when the phase changes or the reader takes over. */
  const autoTokenRef = useRef(0);
  /** Kept in a ref so an unstable parent callback cannot restart a segment mid-flight. */
  const onPhasePlayedRef = useRef(onPhasePlayed);
  useEffect(() => {
    onPhasePlayedRef.current = onPhasePlayed;
  }, [onPhasePlayed]);

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
  } | null>(null);
  const glFailedRef = useRef(false);
  const uploadedRef = useRef<{ scene: unknown; trackData: unknown }>({ scene: null, trackData: null });
  const camRef = useRef<Camera | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/data/flights/three-ways-into-the-wave.json")
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<TrackData>;
      })
      .then((data) => {
        if (!cancelled) setTrack(data);
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

  // Geometry + the hillshaded relief texture, and a world-space projection.
  const scene = useMemo(() => {
    if (!mosaic) return null;
    const midLat = (BOUNDS.south + BOUNDS.north) / 2;
    const midLon = (BOUNDS.west + BOUNDS.east) / 2;
    const kmPerLon = 111.32 * Math.cos((midLat * Math.PI) / 180);
    const kmPerLat = 110.9;

    const sample = (lon: number, lat: number) =>
      mosaicElevation(mosaic, (lon - mosaic.west) / mosaic.lonStep, (mosaic.north - lat) / mosaic.latStep);

    const GX = 384;
    const GY = 408;
    const verts = new Float32Array(GX * GY * 5);
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

    const W = mosaic.width;
    const H = mosaic.height;
    // A power-of-two square texture so WebGL 1 can build mipmaps for it — without
    // them the relief aliases into crawling noise at the grazing angles the phase
    // views use. Sampling stretches the square back over the mosaic's rectangle;
    // the mesh's 0..1 UVs keep the content aligned either way.
    const TW = Math.max(2, Math.min(MAX_TEX, 2 ** Math.ceil(Math.log2(Math.max(W, H)))));
    const TH = TW;
    const elev = mosaic.elevations;
    const pxPerDegLon = 1 / mosaic.lonStep;
    const pxPerDegLat = 1 / mosaic.latStep;
    const texData = new Uint8Array(TW * TH * 4);
    const lx = -0.5;
    const ly = 0.5;
    const lz = Math.SQRT1_2;
    for (let ty = 0; ty < TH; ty += 1) {
      const sy = Math.min(H - 1, Math.round((ty / (TH - 1)) * (H - 1)));
      for (let tx = 0; tx < TW; tx += 1) {
        const sx = Math.min(W - 1, Math.round((tx / (TW - 1)) * (W - 1)));
        const i = sy * W + sx;
        const h = elev[i];
        const hx = elev[sy * W + Math.min(W - 1, sx + 1)] - elev[sy * W + Math.max(0, sx - 1)];
        const hy = elev[Math.max(0, sy - 1) * W + sx] - elev[Math.min(H - 1, sy + 1) * W + sx];
        const dzdx = hx / (2 * (pxPerDegLon > 0 ? 1 / pxPerDegLon : 1) * 111320 * Math.cos((midLat * Math.PI) / 180));
        const dzdy = hy / (2 * (1 / pxPerDegLat) * 110900);
        const len = Math.hypot(dzdx, dzdy, 1);
        const light = Math.max(0, (-dzdx / len) * lx + (dzdy / len) * ly + (1 / len) * lz);
        const base = terrainRgb(h);
        const lit = 0.56 + 0.72 * light;
        const o = (ty * TW + tx) * 4;
        texData[o] = Math.min(255, base[0] * lit);
        texData[o + 1] = Math.min(255, base[1] * lit);
        texData[o + 2] = Math.min(255, base[2] * lit);
        texData[o + 3] = 255;
      }
    }

    const worldX = (lon: number) => (lon - midLon) * kmPerLon;
    const worldY = (lat: number) => (lat - midLat) * kmPerLat;
    const worldZ = (altM: number) => (altM / 1000) * EXAG;
    return { verts, idx, vertCount: GX * GY, indexCount: idx.length, texData, TW, TH, midLat, midLon, kmPerLon, kmPerLat, meshZ, worldX, worldY, worldZ };
  }, [mosaic]);

  const phaseIndexAt = useCallback(
    (t: number): number => {
      if (!track) return 0;
      for (let i = 0; i < track.phases.length; i += 1) {
        if (t >= track.phases[i].from && t < track.phases[i].to) return i;
      }
      return t < track.phases[0].from ? 0 : track.phases.length - 1;
    },
    [track],
  );

  // Track ribbons: per-point tangent, phase colour and width, one buffer.
  const trackData = useMemo(() => {
    if (!scene || !track) return null;
    const segs: number[] = [];
    let segCount = 0;
    const pts = track.points;
    const world = pts.map(
      ([lon, lat, alt]) => [scene.worldX(lon), scene.worldY(lat), scene.worldZ(alt)] as [number, number, number],
    );
    const tangent = world.map((_, i) => {
      const a = world[Math.max(0, i - 2)];
      const b = world[Math.min(world.length - 1, i + 2)];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const dz = b[2] - a[2];
      const len = Math.hypot(dx, dy, dz) || 1;
      return [dx / len, dy / len, dz / len] as [number, number, number];
    });
    const styleAt = (i: number): { color: [number, number, number]; width: number; phase: number } => {
      const phase = phaseIndexAt(pts[i][3]);
      const def = track.phases[phase];
      const key = def.tone === "key";
      const c = hexToUnitRgb(PHASE_COLORS[def.id] ?? "#9ca3af");
      return { color: key ? c : mix(c, SKY_BOTTOM, 0.35), width: key ? 1.25 : 0.55, phase };
    };
    for (let i = 0; i < world.length - 1; i += 1) {
      const a = world[i];
      const b = world[i + 1];
      const dist = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      if (dist < 0.02) continue;
      const sa = styleAt(i);
      const sb = styleAt(i + 1);
      const sb2 = sb.phase === sa.phase ? sb : sa;
      const ta = tangent[i];
      const tb = tangent[i + 1];
      for (const [p, t, c, side] of [
        [a, ta, sa.color, 1],
        [a, ta, sa.color, -1],
        [b, tb, sb2.color, 1],
        [a, ta, sa.color, -1],
        [b, tb, sb2.color, -1],
        [b, tb, sb2.color, 1],
      ] as [[number, number, number], [number, number, number], [number, number, number], number][]) {
        segs.push(p[0], p[1], p[2], t[0], t[1], t[2], side, c[0], c[1], c[2], sa.width, sa.phase);
      }
      segCount += 1;
    }
    // Terrain height beneath the track, for the barogram's ground profile.
    const groundFt = pts.map(([lon, lat]) => (scene.meshZ(lon, lat) / EXAG) * 1000 * 3.28084);
    return { data: new Float32Array(segs), verts: segCount * 6, groundFt };
  }, [scene, track, phaseIndexAt]);

  // Points the overlay annotates: the middle of each key phase, and three
  // moments worth their own number (release, the low point, the top).
  const labelPoints = useMemo(() => {
    if (!track) return { phases: [] as { id: string; pt: TrackPoint }[], calls: [] as { text: string; pt: TrackPoint }[] };
    const nearest = (t: number): TrackPoint => {
      let best = track.points[0];
      let bd = Infinity;
      for (const p of track.points) {
        const d = Math.abs(p[3] - t);
        if (d < bd) {
          bd = d;
          best = p;
        }
      }
      return best;
    };
    const midnight = Math.floor(track.takeoff / 86400) * 86400;
    const at = (hh: number, mm: number, ss: number) => midnight + (hh - track.utcOffsetHours) * 3600 + mm * 60 + ss;
    const phases = track.phases.filter((p) => p.tone === "key").map((p) => ({ id: p.id, pt: nearest((p.from + p.to) / 2) }));
    const calls = [
      { text: "release · 4,300 ft", pt: nearest(at(12, 18, 2)) },
      { text: "low point · 1,857 ft", pt: nearest(at(12, 35, 0)) },
      { text: "top · 8,000 ft", pt: nearest(at(13, 24, 10)) },
    ];
    return { phases, calls };
  }, [track]);

  // Frame the whole flight once.
  const wholeView = useMemo(() => {
    if (!scene || !track) return null;
    const xs: number[] = [];
    const ys: number[] = [];
    let sumZ = 0;
    for (const [lon, lat, alt] of track.points) {
      xs.push(scene.worldX(lon));
      ys.push(scene.worldY(lat));
      sumZ += scene.worldZ(alt);
    }
    const n = xs.length;
    xs.sort((a, b) => a - b);
    ys.sort((a, b) => a - b);
    const mx = xs[Math.floor(n / 2)];
    const my = ys[Math.floor(n / 2)];
    const radii = xs.map((x, i) => Math.hypot(x - mx, ys[i] - my)).sort((a, b) => a - b);
    const r95 = radii[Math.floor(n * 0.95)] ?? 10;
    const dist = Math.min(300, Math.max(13, (r95 * 0.95) / Math.tan(FOV / 2)));
    return { tx: mx, ty: my, tz: Math.min(sumZ / n + r95 * 0.18, 8), dist };
  }, [scene, track]);

  // World anchors for the rotor and ridge annotations.
  const annot = useMemo(() => {
    if (!scene || !track) return null;
    const wp = (lon: number, lat: number): [number, number, number] => [
      scene.worldX(lon),
      scene.worldY(lat),
      scene.meshZ(lon, lat) + 0.04,
    ];
    const rotor = track.phases.find((p) => p.id === "rotor");
    let rotorAnchor: [number, number, number] | null = null;
    if (rotor) {
      const sel = track.points.filter(([, , , t]) => t >= rotor.from && t < rotor.to);
      if (sel.length > 0) {
        const lon = sel.reduce((a, [l]) => a + l, 0) / sel.length;
        const lat = sel.reduce((a, [, l]) => a + l, 0) / sel.length;
        rotorAnchor = wp(lon, lat);
      }
    }
    return {
      rotor: rotorAnchor,
      // Up the working face: from the valley northwest of the ridge toward its foot.
      ridge: { tail: wp(-71.205, 44.36), head: wp(-71.185, 44.345) },
    };
  }, [scene, track]);

  const phaseView = useCallback(
    (id: string): { yaw: number; pitch: number; zoom: number; tx: number; ty: number; tz: number } | null => {
      if (!scene || !track || !wholeView) return null;
      const view = PHASE_VIEWS[id] ?? PHASE_VIEWS.whole;
      if (id === "whole") {
        return { yaw: view.yaw, pitch: view.pitch, zoom: wholeView.dist, tx: wholeView.tx, ty: wholeView.ty, tz: wholeView.tz };
      }
      const phase = track.phases.find((p) => p.id === id);
      if (!phase) return null;
      const sel = track.points.filter(([, , , t]) => t >= phase.from && t < phase.to);
      if (sel.length === 0) return null;
      // Fit the phase's bounding box to the frame: height by the vertical FOV,
      // width by the aspect-scaled horizontal one.
      const xs = sel.map(([lon]) => scene.worldX(lon));
      const ys = sel.map(([, lat]) => scene.worldY(lat));
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const halfE = Math.max(0.4, (maxX - minX) / 2);
      const halfN = Math.max(0.4, (maxY - minY) / 2);
      const aspect = (canvasRef.current?.clientWidth ?? 1440) / (canvasRef.current?.clientHeight ?? 900);
      const fit = Math.max(halfN / Math.tan(FOV / 2), halfE / (Math.tan(FOV / 2) * aspect));
      const dist = Math.min(260, Math.max(5.5, fit * 1.25));
      const zs = sel.map(([, , alt]) => scene.worldZ(alt)).sort((a, b) => a - b);
      const cz = zs[Math.floor(zs.length / 2)];
      // Bias the frame so the story card — a column on the left, or a sheet at the
      // bottom on phones — never covers the phase. The content shifts right (and a
      // little up) by a fixed fraction of the view.
      const halfH = Math.tan(FOV / 2) * dist;
      const yawR = (view.yaw * Math.PI) / 180;
      const bias = PHASE_BIAS[id] ?? 1;
      const shift = halfH * aspect * 0.32 * bias;
      return {
        yaw: view.yaw,
        pitch: view.pitch,
        zoom: dist,
        tx: (minX + maxX) / 2 + Math.cos(yawR) * shift,
        ty: (minY + maxY) / 2 - Math.sin(yawR) * shift,
        tz: Math.max(1.6, Math.min(cz, 8.5)) - halfH * 0.1,
      };
    },
    [scene, track, wholeView],
  );

  const [camera, setCamera] = useState<Camera>({ yaw: 208, pitch: 28, zoom: 90, tx: 0, ty: 0, tz: 2 });
  const cameraReady = useRef(false);
  const animRef = useRef<{ from: Camera; to: Camera; t0: number; dur: number } | null>(null);
  const rafRef = useRef<number | null>(null);

  const flyTo = useCallback(
    (target: Camera) => {
      const now = performance.now();
      const from = camRef.current ?? target;
      const fromYaw = from.yaw;
      let dyaw = target.yaw - fromYaw;
      if (dyaw > 180) dyaw -= 360;
      if (dyaw < -180) dyaw += 360;
      animRef.current = { from, to: { ...target, yaw: fromYaw + dyaw }, t0: now, dur: 750 };
      if (rafRef.current === null) {
        const step = () => {
          const anim = animRef.current;
          if (!anim) {
            rafRef.current = null;
            return;
          }
          const k = Math.min(1, (performance.now() - anim.t0) / anim.dur);
          const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2; // easeInOutQuad
          const lerp = (a: number, b: number) => a + (b - a) * e;
          setCamera({
            yaw: lerp(anim.from.yaw, anim.to.yaw),
            pitch: lerp(anim.from.pitch, anim.to.pitch),
            zoom: lerp(anim.from.zoom, anim.to.zoom),
            tx: lerp(anim.from.tx, anim.to.tx),
            ty: lerp(anim.from.ty, anim.to.ty),
            tz: lerp(anim.from.tz, anim.to.tz),
          });
          if (k >= 1) {
            animRef.current = null;
            rafRef.current = null;
            return;
          }
          rafRef.current = requestAnimationFrame(step);
        };
        rafRef.current = requestAnimationFrame(step);
      }
    },
    [],
  );

  useEffect(() => () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    animRef.current = null;
  }, []);

  // Open framed on the whole flight once the scene exists.
  useEffect(() => {
    if (!wholeView || cameraReady.current) return;
    cameraReady.current = true;
    const view = PHASE_VIEWS.whole;
    const cam = { yaw: view.yaw, pitch: view.pitch, zoom: wholeView.dist, tx: wholeView.tx, ty: wholeView.ty, tz: wholeView.tz };
    camRef.current = cam;
    setCamera(cam);
  }, [wholeView]);

  const select = (id: string) => {
    setInternalSelection(id);
    setNoteDismissed(false);
    autoTokenRef.current += 1; // a hand-picked phase outranks a scroll segment
    const view = phaseView(id);
    if (view) flyTo(view);
  };

  const start = track?.takeoff ?? 0;
  const end = track?.landing ?? 1;
  const timeRef = useRef<number | null>(null);
  const seek = useCallback((t: number) => {
    timeRef.current = t;
    setTime(t);
  }, []);
  const scrubTime = time === null ? null : Math.min(Math.max(time, start), end);

  // Scroll-story mode: when the reader's scroll picks a phase, fly to it and retrace
  // that segment on the barogram (cancelled if they press play or drag the scrubber).
  // The run reports back when it finishes so the page's scroll interlock can let go.
  useEffect(() => {
    if (!scroll || !phase) return;
    const view = phaseView(phase);
    if (view) flyTo(view);
    if (phase === "whole" || !track) return;
    const p = track.phases.find((x) => x.id === phase);
    if (!p) return;
    setPlaying(false);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // No autoplay motion: show the segment's end state and release the page.
      seek(p.to);
      onPhasePlayedRef.current?.(p.id);
      return;
    }
    const token = ++autoTokenRef.current;
    const t0 = performance.now();
    const dur = ((p.to - p.from) / SEGMENT_RATE) * 1000;
    let raf = requestAnimationFrame(function step(now: number) {
      if (autoTokenRef.current !== token) return;
      const k = Math.min(1, (now - t0) / dur);
      seek(p.from + (p.to - p.from) * k);
      if (k < 1) {
        raf = requestAnimationFrame(step);
      } else {
        onPhasePlayedRef.current?.(p.id);
      }
    });
    return () => {
      cancelAnimationFrame(raf);
      autoTokenRef.current += 1;
    };
  }, [scroll, phase, track, phaseView, flyTo, seek]);

  // The rotor's arrows spin and the ridge's wind dashes march — a ~30 fps tick
  // while those phases are on screen, a still frame otherwise.
  const rotorVisible = selection === "rotor";
  const ridgeVisible = selection === "ridge";
  useEffect(() => {
    if (!rotorVisible && !ridgeVisible) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let last = 0;
    const loop = (now: number) => {
      if (now - last >= 33) {
        last = now;
        setSpinTick((t) => (t + 1) % 100000);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [rotorVisible, ridgeVisible]);

  // Play through the flight.
  useEffect(() => {
    if (!playing || !track) return;
    let raf: number;
    let last = performance.now();
    const step = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const from = timeRef.current ?? start;
      const next = from + dt * ((end - start) / PLAY_SECONDS);
      if (next >= end) {
        seek(end);
        setPlaying(false);
        return;
      }
      seek(next);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, track, start, end, seek]);

  // Draw — lazily create the GL context, upload what changed, project the overlays.
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
        const trackProgram = program(gl, TRACK_VS, TRACK_FS);
        const skyBuf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, skyBuf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.BACK);
        state = { gl, sky, terrain, track: trackProgram, skyBuf, terra: null, trackBuf: null, trackVerts: 0 };
        glRef.current = state;
      } catch {
        glFailedRef.current = true;
        queueMicrotask(() => setGlError(true));
        return;
      }
    }
    const { gl, sky, terrain, track: trackProgram } = state;

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
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.generateMipmap(gl.TEXTURE_2D);
      state.terra = { vbo, ibo, tex, count: scene.indexCount };
      uploadedRef.current.scene = scene;
    }

    if (trackData && uploadedRef.current.trackData !== trackData) {
      if (!state.trackBuf) state.trackBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, state.trackBuf);
      gl.bufferData(gl.ARRAY_BUFFER, trackData.data, gl.STATIC_DRAW);
      state.trackVerts = trackData.verts;
      uploadedRef.current.trackData = trackData;
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
    const dist = camera.zoom;
    const yawR = (yaw * Math.PI) / 180;
    const pitchR = (pitch * Math.PI) / 180;
    const target: [number, number, number] = [camera.tx, camera.ty, camera.tz];
    const eye: [number, number, number] = [
      target[0] + dist * Math.cos(pitchR) * Math.sin(yawR),
      target[1] + dist * Math.cos(pitchR) * Math.cos(yawR),
      target[2] + dist * Math.sin(pitchR),
    ];
    const proj = perspective(FOV, cssW / cssH, 0.5, dist * 4 + 400);
    const view = lookAt(eye, target);
    const mvp = multiply(proj, view);

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
    gl.uniform1f(gl.getUniformLocation(terrain, "uFogNear"), dist * 0.78);
    gl.uniform1f(gl.getUniformLocation(terrain, "uFogFar"), dist * 2.7);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, state.terra.tex);
    gl.uniform1i(gl.getUniformLocation(terrain, "uTex"), 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, state.terra.ibo);
    gl.drawElements(gl.TRIANGLES, state.terra.count, gl.UNSIGNED_INT, 0);

    if (state.trackBuf && state.trackVerts > 0) {
      gl.useProgram(trackProgram);
      gl.bindBuffer(gl.ARRAY_BUFFER, state.trackBuf);
      const stride = 48;
      gl.enableVertexAttribArray(gl.getAttribLocation(trackProgram, "aPos"));
      gl.vertexAttribPointer(gl.getAttribLocation(trackProgram, "aPos"), 3, gl.FLOAT, false, stride, 0);
      gl.enableVertexAttribArray(gl.getAttribLocation(trackProgram, "aDir"));
      gl.vertexAttribPointer(gl.getAttribLocation(trackProgram, "aDir"), 3, gl.FLOAT, false, stride, 12);
      gl.enableVertexAttribArray(gl.getAttribLocation(trackProgram, "aSide"));
      gl.vertexAttribPointer(gl.getAttribLocation(trackProgram, "aSide"), 1, gl.FLOAT, false, stride, 24);
      gl.enableVertexAttribArray(gl.getAttribLocation(trackProgram, "aColor"));
      gl.vertexAttribPointer(gl.getAttribLocation(trackProgram, "aColor"), 3, gl.FLOAT, false, stride, 28);
      gl.enableVertexAttribArray(gl.getAttribLocation(trackProgram, "aWidth"));
      gl.vertexAttribPointer(gl.getAttribLocation(trackProgram, "aWidth"), 1, gl.FLOAT, false, stride, 40);
      gl.enableVertexAttribArray(gl.getAttribLocation(trackProgram, "aPhase"));
      gl.vertexAttribPointer(gl.getAttribLocation(trackProgram, "aPhase"), 1, gl.FLOAT, false, stride, 44);
      gl.uniformMatrix4fv(gl.getUniformLocation(trackProgram, "uMVP"), false, mvp);
      gl.uniform2f(gl.getUniformLocation(trackProgram, "uViewport"), cssW, cssH);
      const selIndex = track ? track.phases.findIndex((p) => p.id === selection) : -1;
      gl.uniform1f(gl.getUniformLocation(trackProgram, "uSel"), selIndex);
      gl.drawArrays(gl.TRIANGLES, 0, state.trackVerts);
    }

    // Labels, callouts and the moving marker on the transparent overlay canvas.
    const labelCanvas = labelCanvasRef.current;
    if (labelCanvas && track) {
      if (labelCanvas.width !== bw || labelCanvas.height !== bh) {
        labelCanvas.width = bw;
        labelCanvas.height = bh;
      }
      const lctx = labelCanvas.getContext("2d");
      if (lctx) {
        lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        lctx.clearRect(0, 0, cssW, cssH);
        const project = (x: number, y: number, z: number): [number, number, number] | null => {
          const w = mvp[3] * x + mvp[7] * y + mvp[11] * z + mvp[15];
          if (w <= 0.5) return null;
          const sx = ((mvp[0] * x + mvp[4] * y + mvp[8] * z + mvp[12]) / w / 2 + 0.5) * cssW;
          const sy = (0.5 - (mvp[1] * x + mvp[5] * y + mvp[9] * z + mvp[13]) / w / 2) * cssH;
          return [sx, sy, w];
        };

        lctx.textAlign = "center";
        lctx.textBaseline = "bottom";
        // A tiny collision pass: the numbers carry the story, the phase names come
        // next, and the summits yield — each tries a few spots and gives up if the
        // frame is full there.
        const placed: { x0: number; y0: number; x1: number; y1: number }[] = [];
        const tryPlace = (font: string, sx: number, sy: number, text: string, offsets: number[], mandatory = false): number | null => {
          lctx.font = font;
          const w = lctx.measureText(text).width;
          for (const dy of offsets) {
            const y = sy + dy;
            if (y < -14 || y > cssH + 14) continue;
            const rect = { x0: sx - w / 2 - 3, y0: y - 12, x1: sx + w / 2 + 3, y1: y + 3 };
            const hits = placed.some((p) => rect.x0 < p.x1 && rect.x1 > p.x0 && rect.y0 < p.y1 && rect.y1 > p.y0);
            if (!hits) {
              placed.push(rect);
              return y;
            }
          }
          if (mandatory && offsets.length > 0) {
            const y = sy + offsets[0];
            placed.push({ x0: sx - w / 2 - 3, y0: y - 12, x1: sx + w / 2 + 3, y1: y + 3 });
            return y;
          }
          return null;
        };
        const drawLabel = (text: string, sx: number, y: number, color: string) => {
          lctx.lineWidth = 3;
          lctx.strokeStyle = "rgba(2,6,23,0.85)";
          lctx.strokeText(text, sx, y);
          lctx.fillStyle = color;
          lctx.fillText(text, sx, y);
        };

        // The moments that carry numbers.
        for (const call of labelPoints.calls) {
          const p = project(scene.worldX(call.pt[0]), scene.worldY(call.pt[1]), scene.worldZ(call.pt[2]));
          if (!p) continue;
          const [sx, sy] = p;
          if (sx < -90 || sx > cssW + 90) continue;
          const y = tryPlace("600 10px ui-sans-serif, system-ui, sans-serif", sx, sy, call.text, [-12, 18, -32, 38], true);
          if (y !== null) drawLabel(call.text, sx, y, "#f8fafc");
        }

        // Phase labels at the midpoint of each key phase.
        for (const { id, pt } of labelPoints.phases) {
          const p = project(scene.worldX(pt[0]), scene.worldY(pt[1]), scene.worldZ(pt[2]));
          if (!p) continue;
          const [sx, sy] = p;
          if (sx < -60 || sx > cssW + 60) continue;
          const text = PHASE_SHORT[id] ?? id;
          const y = tryPlace("600 10px ui-sans-serif, system-ui, sans-serif", sx, sy, text, [18, -12, 40, -32]);
          if (y === null) continue;
          drawLabel(text, sx, y, PHASE_COLORS[id] ?? "#e2e8f0");
        }

        // Summits last — map furniture for the reader who orbits.
        for (const peak of PEAKS) {
          const x = scene.worldX(peak.lon);
          const y = scene.worldY(peak.lat);
          const z = scene.meshZ(peak.lon, peak.lat) + 0.06;
          const p = project(x, y, z);
          if (!p) continue;
          const [sx, sy] = p;
          if (sx < -80 || sy < -24 || sx > cssW + 80 || sy > cssH + 24) continue;
          lctx.beginPath();
          lctx.arc(sx, sy, 1.6, 0, Math.PI * 2);
          lctx.fillStyle = "rgba(226,232,240,0.9)";
          lctx.fill();
          const y2 = tryPlace("500 11px ui-sans-serif, system-ui, sans-serif", sx, sy, peak.name, [-5, 17, -26, 30]);
          if (y2 === null) continue;
          drawLabel(peak.name, sx, y2, "#e2e8f0");
        }

        // Phase annotations: the rotor's circulation and the ridge's up-slope wind.
        const spin = spinTick * 0.08;
        if (rotorVisible && annot?.rotor) {
          const p = project(annot.rotor[0], annot.rotor[1], annot.rotor[2]);
          if (p) {
            const [rx, ry] = p;
            drawCloud(lctx, rx, ry - 78 + Math.sin(spinTick * 0.05) * 3);
            drawArcArrow(lctx, rx - 36, ry, 22, spin, "rgba(52,211,153,0.95)");
            drawArcArrow(lctx, rx + 36, ry, 22, spin, "rgba(52,211,153,0.95)");
          }
        }
        if (ridgeVisible && annot) {
          const a = project(annot.ridge.tail[0], annot.ridge.tail[1], annot.ridge.tail[2]);
          const b = project(annot.ridge.head[0], annot.ridge.head[1], annot.ridge.head[2]);
          if (a && b) drawWindArrow(lctx, a, b, spinTick);
        }

        // The moving marker.
        if (scrubTime !== null) {
          let best: TrackPoint | null = null;
          let prev: TrackPoint | null = null;
          for (let i = 0; i < track.points.length; i += 1) {
            if (track.points[i][3] <= scrubTime) {
              prev = track.points[i];
            } else {
              best = track.points[i];
              break;
            }
          }
          const a = prev ?? track.points[0];
          const b = best ?? track.points[track.points.length - 1];
          const span = Math.max(1, b[3] - a[3]);
          const k = Math.min(1, Math.max(0, (scrubTime - a[3]) / span));
          const lon = a[0] + (b[0] - a[0]) * k;
          const lat = a[1] + (b[1] - a[1]) * k;
          const alt = a[2] + (b[2] - a[2]) * k;
          const p = project(scene.worldX(lon), scene.worldY(lat), scene.worldZ(alt));
          if (p) {
            const [sx, sy] = p;
            for (const [radius, alpha] of [
              [13, 0.14],
              [8, 0.25],
              [5, 1],
            ] as [number, number][]) {
              lctx.beginPath();
              lctx.arc(sx, sy, radius, 0, Math.PI * 2);
              lctx.fillStyle =
                alpha === 1 ? "rgba(255,255,255,0.98)" : `rgba(125,211,252,${alpha})`;
              lctx.fill();
            }
            lctx.beginPath();
            lctx.arc(sx, sy, 5, 0, Math.PI * 2);
            lctx.lineWidth = 1.5;
            lctx.strokeStyle = "rgba(2,6,23,0.9)";
            lctx.stroke();
          }
        }
      }
    }
  }, [scene, track, trackData, labelPoints, annot, camera, selection, scrubTime, sizeTick, spinTick, rotorVisible, ridgeVisible]);

  useEffect(() => {
    const onResize = () => setSizeTick((v) => v + 1);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Orbit + pan + zoom.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let dragging = false;
    let panning = false;
    let lastX = 0;
    let lastY = 0;
    let pinch = 0;
    const pointers = new Map<number, { x: number; y: number }>();

    const panBy = (dxPx: number, dyPx: number) => {
      const cam = camRef.current;
      if (!cam) return;
      const yawR = (cam.yaw * Math.PI) / 180;
      const pitchR = (cam.pitch * Math.PI) / 180;
      const scale = (2 * cam.zoom * Math.tan(FOV / 2)) / canvas.clientHeight;
      const rx = -Math.cos(yawR);
      const ry = Math.sin(yawR);
      const fx = -Math.sin(yawR) / Math.max(0.35, Math.cos(pitchR));
      const fy = -Math.cos(yawR) / Math.max(0.35, Math.cos(pitchR));
      setCamera((c) => ({
        ...c,
        tx: c.tx + (-rx * dxPx + fx * dyPx) * scale,
        ty: c.ty + (-ry * dxPx + fy * dyPx) * scale,
      }));
    };

    const down = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) {
        panning = e.button === 2 || e.button === 1;
        dragging = !panning;
        lastX = e.clientX;
        lastY = e.clientY;
      } else if (pointers.size === 2) {
        dragging = false;
        const [p1, p2] = [...pointers.values()];
        pinch = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        lastX = (p1.x + p2.x) / 2;
        lastY = (p1.y + p2.y) / 2;
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
          setCamera((c) => ({ ...c, zoom: Math.min(320, Math.max(3, c.zoom * factor)) }));
        }
        pinch = d;
        const cxp = (p1.x + p2.x) / 2;
        const cyp = (p1.y + p2.y) / 2;
        if (Math.abs(cxp - lastX) + Math.abs(cyp - lastY) > 2) {
          panBy(cxp - lastX, cyp - lastY);
        }
        lastX = cxp;
        lastY = cyp;
        return;
      }
      if (panning) {
        panBy(e.clientX - lastX, e.clientY - lastY);
        lastX = e.clientX;
        lastY = e.clientY;
        return;
      }
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      setCamera((c) => ({
        ...c,
        yaw: (c.yaw - dx * 0.35 + 360) % 360,
        pitch: Math.min(84, Math.max(2, c.pitch + dy * 0.25)),
      }));
    };
    const up = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size === 0) {
        dragging = false;
        panning = false;
      }
      if (pointers.size < 2) pinch = 0;
    };
    const contextMenu = (e: MouseEvent) => e.preventDefault();
    const wheel = (e: WheelEvent) => {
      // In scroll-story mode the wheel belongs to the page: the scene zooms only
      // in the standalone viewer, where the canvas is a full page of its own.
      if (scroll) return;
      e.preventDefault();
      setCamera((c) => ({ ...c, zoom: Math.min(320, Math.max(3, c.zoom * (1 + e.deltaY * 0.0012))) }));
    };

    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("contextmenu", contextMenu);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("wheel", wheel, { passive: false });
    return () => {
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("contextmenu", contextMenu);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      canvas.removeEventListener("wheel", wheel);
    };
  }, [scroll]);

  useEffect(() => {
    camRef.current = camera;
  }, [camera]);

  // ---- derived UI values ----

  const clock = useCallback(
    (t: number): string => {
      const off = track?.utcOffsetHours ?? -4;
      const s = (((t + off * 3600) % 86400) + 86400) % 86400;
      return `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}`;
    },
    [track],
  );

  const markerInfo = useMemo(() => {
    if (!track || scrubTime === null || !scene) return null;
    const pts = track.points;
    let prev = pts[0];
    let next = pts[pts.length - 1];
    for (let i = 0; i < pts.length; i += 1) {
      if (pts[i][3] <= scrubTime) prev = pts[i];
      else {
        next = pts[i];
        break;
      }
    }
    const span = Math.max(1, next[3] - prev[3]);
    const k = Math.min(1, Math.max(0, (scrubTime - prev[3]) / span));
    const lon = prev[0] + (next[0] - prev[0]) * k;
    const lat = prev[1] + (next[1] - prev[1]) * k;
    const alt = prev[2] + (next[2] - prev[2]) * k;
    const altFt = alt * 3.28084;
    const groundFt = (scene.meshZ(lon, lat) / EXAG) * 1000 * 3.28084;
    const dtSec = Math.max(1, next[3] - prev[3]);
    const km = Math.hypot((next[0] - prev[0]) * 111.32 * Math.cos((44.3 * Math.PI) / 180), (next[1] - prev[1]) * 110.9);
    const gs = km / dtSec / 1.852 * 3600;
    return { altFt, aglFt: altFt - groundFt, gs, clock: clock(scrubTime) };
  }, [track, scrubTime, scene, clock]);

  const profile = useMemo(() => {
    if (!track || !scene || !trackData) return null;
    const width = 1000;
    const height = 88;
    const startT = track.takeoff;
    const endT = track.landing;
    const altMin = 600;
    const altMax = 8600;
    const x = (t: number) => ((t - startT) / (endT - startT)) * width;
    const y = (ft: number) => height - ((Math.min(altMax, Math.max(altMin, ft)) - altMin) / (altMax - altMin)) * (height - 10);
    const pts = track.points;
    const altPath = pts
      .map((p, i) => `${i === 0 ? "M" : "L"}${x(p[3]).toFixed(1)},${y(p[2] * 3.28084).toFixed(1)}`)
      .join("");
    const groundPath =
      pts
        .map((p, i) => `${i === 0 ? "M" : "L"}${x(p[3]).toFixed(1)},${y(trackData.groundFt[i]).toFixed(1)}`)
        .join("") + `L${width},${height} L0,${height} Z`;
    const bands = track.phases.map((p) => ({
      id: p.id,
      x0: x(p.from),
      x1: x(p.to),
      color: PHASE_COLORS[p.id] ?? "#9ca3af",
    }));
    const widthPx = (t: number) => x(t);
    return { width, height, altPath, groundPath, bands, widthPx };
  }, [track, scene, trackData]);

  const selectedPhase = track?.phases.find((p) => p.id === selection) ?? null;
  const noteVisible = selectedPhase !== null && !noteDismissed;

  return (
    <div className="relative h-full w-full bg-slate-950">
      <canvas
        ref={canvasRef}
        className={
          scroll
            ? "pointer-events-none absolute inset-0 block h-full w-full select-none touch-none lg:pointer-events-auto lg:cursor-grab lg:active:cursor-grabbing"
            : "absolute inset-0 block h-full w-full cursor-grab touch-none select-none active:cursor-grabbing"
        }
        aria-label="Three-dimensional view of the flight of 12 October 2026 over the White Mountains"
      />
      <canvas ref={labelCanvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 block h-full w-full" />

      {/* Phase buttons — pinned below the site header while the section is on screen.
          Hidden in scroll mode: the scroll cards are the navigation there. */}
      {!scroll ? (
      <div className="pointer-events-none sticky top-16 z-20 sm:top-[4.5rem] xl:top-20">
        <div className="flex items-start gap-2 px-3 pt-3">
          <div className="pointer-events-auto flex flex-1 flex-wrap items-center gap-1.5">
            <button
              type="button"
              aria-pressed={selection === "whole"}
              onClick={() => select("whole")}
              className={`rounded-full px-3 py-1 text-xs font-medium backdrop-blur-sm transition-colors ${
                selection === "whole"
                  ? "bg-sky-400/90 text-slate-950"
                  : "bg-slate-950/50 text-slate-200 ring-1 ring-white/10 hover:bg-slate-800/70"
              }`}
            >
              Whole flight
            </button>
            {track?.phases.map((phase) => {
              const active = selection === phase.id;
              return (
                <button
                  key={phase.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => select(phase.id)}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium backdrop-blur-sm transition-colors ${
                    active
                      ? "bg-slate-100 text-slate-950"
                      : phase.tone === "context"
                        ? "bg-slate-950/50 text-slate-300/80 ring-1 ring-white/10 hover:bg-slate-800/70"
                        : "bg-slate-950/50 text-slate-100 ring-1 ring-white/15 hover:bg-slate-800/70"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: PHASE_COLORS[phase.id] ?? "#9ca3af" }}
                  />
                  {PHASE_SHORT[phase.id] ?? phase.label}
                </button>
              );
            })}
          </div>
          {track ? (
            <p className="pointer-events-none hidden shrink-0 rounded-full bg-slate-950/50 px-3 py-1 text-xs text-slate-200 tabular-nums ring-1 ring-white/10 backdrop-blur-sm md:block">
              {track.date} · 84 min · 49 km · to {fmt.format(track.maxAltFt)} ft
            </p>
          ) : null}
        </div>
      </div>
      ) : null}

      {/* Phase note */}
      {!scroll && noteVisible && selectedPhase ? (
        <div className="pointer-events-auto absolute bottom-20 left-3 right-3 z-20 rounded-2xl bg-slate-950/85 p-4 ring-1 ring-white/15 backdrop-blur-sm sm:right-auto sm:w-80">
          <div className="flex items-start justify-between gap-3">
            <p className="font-display text-sm font-semibold text-white">{selectedPhase.label}</p>
            <button
              type="button"
              onClick={() => setNoteDismissed(true)}
              aria-label="Hide the phase note"
              className="rounded-full px-1 text-slate-400 transition-colors hover:text-white"
            >
              ✕
            </button>
          </div>
          <p className="mt-1 text-[11px] font-medium tabular-nums text-sky-300">
            {clock(selectedPhase.from)} – {clock(selectedPhase.to)}
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-300">{selectedPhase.note}</p>
        </div>
      ) : null}

      {/* Transport + barogram */}
      <div className="absolute inset-x-0 bottom-0 z-20 border-t border-white/10 bg-slate-950/85 px-3 pb-2 pt-1.5 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (!track) return;
              autoTokenRef.current += 1; // the reader takes over from any scroll segment
              if (scroll && phase) onPhasePlayedRef.current?.(phase);
              if (time === null || time >= track.landing) seek(track.takeoff);
              setPlaying((p) => !p);
            }}
            aria-label={playing ? "Pause the flight replay" : "Play the flight replay"}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sky-400 text-slate-950 transition-colors hover:bg-sky-300"
          >
            {playing ? (
              <svg width="10" height="12" viewBox="0 0 10 12" aria-hidden="true">
                <rect x="0" y="0" width="3.4" height="12" rx="1" fill="currentColor" />
                <rect x="6.6" y="0" width="3.4" height="12" rx="1" fill="currentColor" />
              </svg>
            ) : (
              <svg width="11" height="12" viewBox="0 0 11 12" aria-hidden="true">
                <path d="M1 1.2v9.6c0 .9 1 1.5 1.8 1L10 7.1c.8-.5.8-1.7 0-2.2L2.8.2C2-.3 1 .3 1 1.2Z" fill="currentColor" />
              </svg>
            )}
          </button>

          <div className="min-w-0 flex-1">
            <svg
              viewBox={`0 0 1000 88`}
              preserveAspectRatio="none"
              className="h-14 w-full cursor-crosshair sm:h-16"
              onPointerDown={(e) => {
                if (!track) return;
                autoTokenRef.current += 1;
                if (scroll && phase) onPhasePlayedRef.current?.(phase);
                setPlaying(false);
                const el = e.currentTarget;
                const rect = el.getBoundingClientRect();
                const seekAt = (clientX: number) => {
                  const k = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
                  seek(track.takeoff + k * (track.landing - track.takeoff));
                };
                seekAt(e.clientX);
                el.setPointerCapture(e.pointerId);
                const move = (ev: PointerEvent) => seekAt(ev.clientX);
                const up = () => {
                  el.removeEventListener("pointermove", move);
                  el.removeEventListener("pointerup", up);
                };
                el.addEventListener("pointermove", move);
                el.addEventListener("pointerup", up);
              }}
              role="slider"
              aria-label="Fly through the flight"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={
                scrubTime !== null && track
                  ? Math.round(((scrubTime - track.takeoff) / (track.landing - track.takeoff)) * 100)
                  : 0
              }
            >
              {profile ? (
                <>
                  {profile.bands.map((band) => (
                    <rect
                      key={band.id}
                      x={band.x0}
                      y={0}
                      width={Math.max(1, band.x1 - band.x0)}
                      height={profile.height}
                      fill={band.color}
                      opacity={selection === "whole" || selection === band.id ? 0.16 : 0.05}
                    />
                  ))}
                  <path d={profile.groundPath} fill="rgba(148,163,184,0.3)" />
                  <path d={profile.altPath} fill="none" stroke="rgba(125,211,252,0.95)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
                  {profile.bands.map((band) => (
                    <rect
                      key={`bar-${band.id}`}
                      x={band.x0}
                      y={profile.height - 3}
                      width={Math.max(1, band.x1 - band.x0)}
                      height={3}
                      fill={band.color}
                      opacity={selection === "whole" || selection === band.id ? 1 : 0.35}
                    />
                  ))}
                  {scrubTime !== null ? (
                    <g>
                      <line
                        x1={profile.widthPx(scrubTime)}
                        x2={profile.widthPx(scrubTime)}
                        y1={0}
                        y2={profile.height}
                        stroke="rgba(255,255,255,0.85)"
                        strokeWidth="1"
                        vectorEffect="non-scaling-stroke"
                      />
                      <circle
                        cx={profile.widthPx(scrubTime)}
                        cy={(() => {
                          if (!track) return profile.height;
                          let alt = 0;
                          for (const p of track.points) if (p[3] <= scrubTime) alt = p[2];
                          const ft = alt * 3.28084;
                          return profile.height - ((Math.min(8600, Math.max(600, ft)) - 600) / (8600 - 600)) * (profile.height - 10);
                        })()}
                        r="4"
                        fill="#fff"
                        stroke="rgba(2,6,23,0.9)"
                        strokeWidth="1.5"
                        vectorEffect="non-scaling-stroke"
                      />
                    </g>
                  ) : null}
                </>
              ) : null}
            </svg>
          </div>

          <div className="w-28 shrink-0 text-right text-[10px] leading-4 text-slate-300 tabular-nums sm:w-40 sm:text-[11px]">
            {markerInfo ? (
              <>
                <span className="font-semibold text-white">{markerInfo.clock}</span>
                <br />
                {fmt.format(Math.round(markerInfo.altFt))} ft · {fmt.format(Math.round(markerInfo.aglFt))} AGL
              </>
            ) : (
              <span className="text-slate-500">scrub or play</span>
            )}
          </div>
        </div>
      </div>

      {glError ? (
        <p className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-slate-300">
          This view needs WebGL, which this browser isn&apos;t providing right now.
        </p>
      ) : null}
      {!glError && (!mosaic || !track) && !dataError ? (
        <p className="absolute inset-0 grid place-items-center text-sm text-slate-400">Loading the terrain and the track…</p>
      ) : null}
      {dataError && !glError ? (
        <p className="absolute inset-0 grid place-items-center text-sm text-slate-300">
          The terrain or the flight track could not be loaded right now.
        </p>
      ) : null}

      {!scroll ? (
        <p className="pointer-events-none absolute bottom-[4.8rem] right-3 z-10 hidden text-[11px] text-slate-400 sm:block">
          drag to orbit · right-drag to pan · scroll to zoom
        </p>
      ) : null}
    </div>
  );
}
