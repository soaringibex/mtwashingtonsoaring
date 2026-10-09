"use client";


import { useEffect, useMemo, useRef, useState } from "react";
import { fetchTerrainMosaic, mosaicElevation, type TerrainMosaic } from "@/lib/terrain-tiles";

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
  const mvpRef = useRef<{ mvp: Float32Array; cssW: number; cssH: number } | null>(null);
  const sceneRef = useRef<{ midLon: number; midLat: number; kmPerLon: number; kmPerLat: number } | null>(null);
  const [glError, setGlError] = useState(false);
  const [dataError, setDataError] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const glRef = useRef<{
    gl: WebGLRenderingContext;
    sky: WebGLProgram;
    terrain: WebGLProgram;
    track: WebGLProgram;
    skyBuf: WebGLBuffer;
    terra: { vbo: WebGLBuffer; ibo: WebGLBuffer; tex: WebGLTexture; count: number } | null;
    trackBuf: WebGLBuffer | null;
    trackVerts: number;
    tracksFor: number;
  } | null>(null);
  const glFailedRef = useRef(false);
  const uploadedRef = useRef<{ scene: unknown; trackData: unknown }>({ scene: null, trackData: null });
  const yearCache = useRef(new Map<number, YearData>());
  const dataRef = useRef<YearData | null>(null);

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
      dataRef.current = cached;
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
        dataRef.current = data;
        setStats(data);
        setSelected(null);
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

    return { verts, idx, vertCount: GX * GY, indexCount: idx.length, texData, TW, TH, midLat, midLon, kmPerLon, kmPerLat };
  }, [mosaic]);

  // Frame each year: median centre, 95th-percentile radius.
  const frame: Frame = useMemo(() => {
    if (!scene || !stats) return { target: [0, 0, 1.4], dist: 80 };
    const xs: number[] = [];
    const ys: number[] = [];
    let sumZ = 0;
    let n = 0;
    let maxZ = 0;
    for (const flight of stats.flights) {
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
  }, [scene, stats]);

  useEffect(() => {
    sceneRef.current = scene;
  }, [scene]);

  // Track ribbons for the selected year.
  const trackData = useMemo(() => {
    if (!scene || !stats) return null;
    const segs: number[] = [];
    let segCount = 0;
    for (const flight of stats.flights) {
      const pts = flight.pts;
      if (pts.length < 2) continue;
      const width = flight.ssa.length ? 3 : flight.wave ? 2 : 1.3;
      const alpha = flight.wave || flight.ssa.length ? 0.95 : 0.5;
      const flightIdx = stats.flights.indexOf(flight);
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
  }, [scene, stats]);

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
        state = { gl, sky, terrain, track, skyBuf, terra: null, trackBuf: null, trackVerts: 0, tracksFor: 0 };
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

    // Upload tracks once per year data.
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

    // Tracks.
    if (state.trackBuf && state.trackVerts > 0) {
      gl.useProgram(track);
      gl.bindBuffer(gl.ARRAY_BUFFER, state.trackBuf);
      const stride = 48;
      const aPos = gl.getAttribLocation(track, "aPos");
      const aOther = gl.getAttribLocation(track, "aOther");
      const aSide = gl.getAttribLocation(track, "aSide");
      const aColor = gl.getAttribLocation(track, "aColor");
      const aWidth = gl.getAttribLocation(track, "aWidth");
      const aFlight = gl.getAttribLocation(track, "aFlight");
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, stride, 0);
      gl.enableVertexAttribArray(aOther);
      gl.vertexAttribPointer(aOther, 3, gl.FLOAT, false, stride, 12);
      gl.enableVertexAttribArray(aSide);
      gl.vertexAttribPointer(aSide, 1, gl.FLOAT, false, stride, 24);
      gl.enableVertexAttribArray(aColor);
      gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, stride, 28);
      gl.enableVertexAttribArray(aWidth);
      gl.vertexAttribPointer(aWidth, 1, gl.FLOAT, false, stride, 40);
      gl.enableVertexAttribArray(aFlight);
      gl.vertexAttribPointer(aFlight, 1, gl.FLOAT, false, stride, 44);
      gl.uniformMatrix4fv(gl.getUniformLocation(track, "uMVP"), false, mvp);
      gl.uniform2f(gl.getUniformLocation(track, "uViewport"), cssW, cssH);
      const selIndex = selected !== null && stats ? stats.flights.findIndex((f) => f.id === selected) : -1;
      gl.uniform1f(gl.getUniformLocation(track, "uSel"), selIndex);
      gl.drawArrays(gl.TRIANGLES, 0, state.trackVerts);
    }

  }, [scene, stats, camera, frame, trackData, selected]);

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
      const data = dataRef.current;
      if (!cam || !data || !sceneRef.current) return null;
      const rect = canvas.getBoundingClientRect();
      const px = clientX - rect.left;
      const py = clientY - rect.top;
      const m = cam.mvp;
      let best: number | null = null;
      let bestD = 14 * 14;
      for (const flight of data.flights) {
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
          setCamera((c) => ({ ...c, zoom: Math.min(320, Math.max(35, (c.zoom ?? frame.dist) * factor)) }));
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
        zoom: Math.min(320, Math.max(35, (c.zoom ?? frame.dist) * (1 + e.deltaY * 0.0012))),
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
    <div className="overflow-hidden rounded-3xl bg-slate-950 shadow-xl ring-1 ring-slate-900/10">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 sm:px-7">
        <div className="flex flex-wrap items-center gap-1.5">
          {YEARS.map((y) => (
            <button
              key={y}
              type="button"
              aria-pressed={year === y}
              onClick={() => setYear(y)}
              className={`rounded-full px-3 py-1 text-sm font-medium tabular-nums transition-colors ${
                year === y ? "bg-sky-400/90 text-slate-950" : "bg-white/10 text-slate-200 hover:bg-white/20"
              }`}
            >
              {y}
            </button>
          ))}
        </div>
        {stats ? (
          <p className="text-sm text-slate-300 tabular-nums">
            {stats.flights.length} flights · best{" "}
            {new Intl.NumberFormat("en-US").format(Math.max(...stats.flights.map((f) => f.maxAltFt)))} ft
          </p>
        ) : null}
      </div>

      <div className="relative mt-4">
        <canvas
          ref={canvasRef}
          className="block h-[420px] w-full cursor-grab touch-none select-none active:cursor-grabbing sm:h-[560px]"
          aria-label={`Three-dimensional view of the ${year} wave camp flights over the White Mountains`}
        />
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
        <p className="pointer-events-none absolute bottom-3 left-4 text-[11px] text-slate-400">
          drag to orbit · scroll to zoom · click a track
        </p>
        {selected !== null && stats ? (() => {
          const flight = stats.flights.find((f) => f.id === selected);
          if (!flight) return null;
          return (
            <div className="absolute left-4 top-4 max-w-[16rem] rounded-2xl bg-slate-950/80 p-4 ring-1 ring-white/15 backdrop-blur-sm">
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
              <p className="mt-1 text-[11px] text-slate-400">
                {flight.wave ? "wave flight" : "thermal flight"}
                {flight.ssa.length ? ` · ${flight.ssa.join(" · ")}` : ""}
              </p>
            </div>
          );
        })() : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 pb-5 pt-4 text-[11px] text-slate-400 sm:px-7">
        <span>Altitude</span>
        <span
          className="h-2 w-44 rounded-full"
          style={{
            background: `linear-gradient(to right, ${ALT_RAMP.map(
              ([ft, c]) => `rgb(${c.join(",")}) ${((ft - 800) / (34000 - 800)) * 100}%`,
            ).join(", ")})`,
          }}
        />
        <span className="tabular-nums">800 ft → 34,000 ft</span>
        <span className="ml-auto">wave flights bright · everything else dim · GPS altitudes read a little high</span>
      </div>
    </div>
  );
}
