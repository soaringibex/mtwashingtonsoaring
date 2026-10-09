"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fetchTerrainMosaic, mosaicElevation, type TerrainMosaic } from "@/lib/terrain-tiles";

/**
 * The wave-camp years in 3D. Every flight of the selected year is drawn as an
 * altitude-coloured track over a terrain mesh of the White Mountains, from a camera
 * you can orbit. No 3D library: a perspective projection on a 2D canvas, painter's
 * algorithm, and the same tile mosaic the wave map uses for its relief.
 */

// The region the tracks wander through, padded — used for the terrain fetch.
const BOUNDS = { west: -71.9, south: 43.9, east: -70.5, north: 44.9 };
const ZOOM = 10;
const MESH_X = 84;
const MESH_Y = 70;
const EXAG = 1.5;
const FOV = 50 * (Math.PI / 180);

type Track = {
  id: number;
  pilot: string;
  date: string;
  maxAltFt: number;
  wave: boolean;
  ssa: string[];
  pts: [number, number, number][]; // lon, lat, alt m
};

type YearData = { year: number; flights: Track[] };

const YEARS = [2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016];

const ramp: [number, [number, number, number]][] = [
  [800, [45, 212, 191]],
  [6000, [74, 222, 128]],
  [12000, [250, 204, 21]],
  [18000, [251, 146, 60]],
  [24000, [244, 63, 94]],
  [34000, [217, 70, 239]],
];

function altColor(ft: number, alpha: number): string {
  let lo = ramp[0];
  let hi = ramp[ramp.length - 1];
  for (let i = 0; i < ramp.length - 1; i += 1) {
    if (ft >= ramp[i][0] && ft <= ramp[i + 1][0]) {
      lo = ramp[i];
      hi = ramp[i + 1];
      break;
    }
  }
  const t = hi[0] === lo[0] ? 0 : Math.min(1, Math.max(0, (ft - lo[0]) / (hi[0] - lo[0])));
  const c = lo[1].map((v, i) => Math.round(v + (hi[1][i] - v) * t));
  return `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
}

function mix(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];
}

/** Terrain colours: dark green valleys, slate rock, snow above ~1,300 m. */
function terrainRamp(zKm: number): [number, number, number] {
  const m = zKm * 1000;
  if (m < 300) return mix([30, 45, 54], [44, 66, 74], m / 300);
  if (m < 900) return mix([44, 66, 74], [74, 92, 106], (m - 300) / 600);
  if (m < 1300) return mix([74, 92, 106], [126, 148, 168], (m - 900) / 400);
  if (m < 1600) return mix([126, 148, 168], [222, 231, 240], (m - 1300) / 300);
  return [232, 238, 246];
}

const BG_TOP: [number, number, number] = [11, 18, 32];
const BG_BOTTOM: [number, number, number] = [30, 41, 59];

type Camera = { yaw: number; pitch: number; zoom: number | null };
type Frame = { target: [number, number, number]; dist: number };

export function FlightGlobe3D() {
  const [year, setYear] = useState(2025);
  const [mosaic, setMosaic] = useState<TerrainMosaic | null>(null);
  const [error, setError] = useState(false);
  const [camera, setCamera] = useState<Camera>({ yaw: 200, pitch: 22, zoom: null });
  const [ready, setReady] = useState(0);
  const [stats, setStats] = useState<YearData | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const yearCache = useRef(new Map<number, YearData>());
  const dataRef = useRef<YearData | null>(null);

  // Terrain once.
  useEffect(() => {
    let cancelled = false;
    fetchTerrainMosaic(BOUNDS, ZOOM)
      .then((next) => {
        if (!cancelled) setMosaic(next);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // The selected year's tracks.
  useEffect(() => {
    let cancelled = false;
    const cached = yearCache.current.get(year);
    if (cached) {
      dataRef.current = cached;
      setStats(cached);
      setReady((v) => v + 1);
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
        setReady((v) => v + 1);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [year]);

  // The mesh: world coordinates in km — x east, y north, z altitude (exaggerated).
  const mesh = useMemo(() => {
    if (!mosaic) return null;
    const midLat = (BOUNDS.south + BOUNDS.north) / 2;
    const midLon = (BOUNDS.west + BOUNDS.east) / 2;
    const kmPerLon = 111.32 * Math.cos((midLat * Math.PI) / 180);
    const kmPerLat = 110.9;
    const spanX = (BOUNDS.east - BOUNDS.west) * kmPerLon;
    const spanY = (BOUNDS.north - BOUNDS.south) * kmPerLat;
    const verts: number[] = []; // x, y, z
    const heightKm: number[] = [];
    for (let j = 0; j < MESH_Y; j += 1) {
      const lat = BOUNDS.north - ((BOUNDS.north - BOUNDS.south) * j) / (MESH_Y - 1);
      for (let i = 0; i < MESH_X; i += 1) {
        const lon = BOUNDS.west + ((BOUNDS.east - BOUNDS.west) * i) / (MESH_X - 1);
        const mx = (lon - mosaic.west) / mosaic.lonStep;
        const my = (mosaic.north - lat) / mosaic.latStep;
        const m = mosaicElevation(mosaic, mx, my);
        const z = (m / 1000) * EXAG;
        verts.push((lon - midLon) * kmPerLon, (lat - midLat) * kmPerLat, z);
        heightKm.push(z);
      }
    }
    // Per-quad base colours with a light from the NW (map convention of the site).
    const quads: { i0: number; i1: number; i2: number; i3: number; color: [number, number, number] }[] = [];
    for (let j = 0; j < MESH_Y - 1; j += 1) {
      for (let i = 0; i < MESH_X - 1; i += 1) {
        const a = j * MESH_X + i;
        const b = a + 1;
        const c = a + MESH_X;
        const d = c + 1;
        const dzdx = (heightKm[b] - heightKm[a]) / (spanX / (MESH_X - 1));
        const dzdy = (heightKm[c] - heightKm[a]) / (spanY / (MESH_Y - 1));
        // Normal ≈ (−dzdx, −dzdy, 1) normalized; light from NW, 45°.
        const len = Math.hypot(dzdx, dzdy, 1);
        const nx = -dzdx / len;
        const ny = -dzdy / len;
        const nz = 1 / len;
        const lx = -0.5;
        const ly = 0.5;
        const lz = Math.SQRT1_2;
        const light = Math.max(0, nx * lx + ny * ly + nz * lz);
        const base = terrainRamp((heightKm[a] + heightKm[d]) / 2);
        const lit = 0.35 + 0.75 * light;
        quads.push({ i0: a, i1: b, i2: d, i3: c, color: [Math.min(255, base[0] * lit), Math.min(255, base[1] * lit), Math.min(255, base[2] * lit)] as [number, number, number] });
      }
    }
    return { verts, quads, midLat, midLon, kmPerLon, kmPerLat };
  }, [mosaic]);

  // Frame each year: median centre, 95th-percentile radius, so one far-wandering
  // flight doesn't zoom the whole camp out of view.
  const frame: Frame = useMemo(() => {
    if (!mesh || !stats) return { target: [0, 0, 1.4], dist: 80 };
    const xs: number[] = [];
    const ys: number[] = [];
    let sumZ = 0;
    let n = 0;
    let maxZ = 0;
    for (const flight of stats.flights) {
      for (const [lon, lat, alt] of flight.pts) {
        xs.push((lon - mesh.midLon) * mesh.kmPerLon);
        ys.push((lat - mesh.midLat) * mesh.kmPerLat);
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
  }, [mesh, stats]);

  // Render on camera/year/mesh changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mesh || !dataRef.current) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const bg = ctx.createLinearGradient(0, 0, 0, cssH);
    bg.addColorStop(0, `rgb(${BG_TOP.join(",")})`);
    bg.addColorStop(1, `rgb(${BG_BOTTOM.join(",")})`);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, cssW, cssH);

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
    // Camera basis.
    const f = [target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]];
    const fLen = Math.hypot(f[0], f[1], f[2]);
    f[0] /= fLen; f[1] /= fLen; f[2] /= fLen;
    const r = [f[1] * 1 - f[2] * 0, f[2] * 0 - f[0] * 1, 0]; // cross(f, up(0,0,1)) = (f.y, -f.x, 0)
    const rLen = Math.hypot(f[0], f[1]) || 1;
    r[0] = f[1] / rLen; r[1] = -f[0] / rLen; r[2] = 0;
    const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
    const fscale = (cssH / 2) / Math.tan(FOV / 2);
    const cx = cssW / 2;
    const cy = cssH / 2;

    const project = (x: number, y: number, z: number): [number, number, number] | null => {
      const dx = x - eye[0];
      const dy = y - eye[1];
      const dz = z - eye[2];
      const zc = dx * f[0] + dy * f[1] + dz * f[2];
      if (zc < 1) return null;
      const xc = dx * r[0] + dy * r[1] + dz * r[2];
      const yc = dx * u[0] + dy * u[1] + dz * u[2];
      return [cx + (xc * fscale) / zc, cy - (yc * fscale) / zc, zc];
    };

    // Project the mesh vertices once.
    const nVerts = mesh.verts.length / 3;
    const px = new Float32Array(nVerts * 3);
    for (let v = 0; v < nVerts; v += 1) {
      const p = project(mesh.verts[v * 3], mesh.verts[v * 3 + 1], mesh.verts[v * 3 + 2]);
      if (p) {
        px[v * 3] = p[0]; px[v * 3 + 1] = p[1]; px[v * 3 + 2] = p[2];
      } else {
        px[v * 3 + 2] = -1;
      }
    }

    type Item = { depth: number; draw: () => void };
    const items: Item[] = [];

    const fogNear = dist * 0.55;
    const fogFar = dist * 1.75;

    for (const q of mesh.quads) {
      const d0 = px[q.i0 * 3 + 2];
      const d1 = px[q.i1 * 3 + 2];
      const d2 = px[q.i2 * 3 + 2];
      const d3 = px[q.i3 * 3 + 2];
      if (d0 < 0 || d1 < 0 || d2 < 0 || d3 < 0) continue;
      const depth = (d0 + d1 + d2 + d3) / 4;
      const fog = Math.max(0, Math.min(1, (depth - fogNear) / (fogFar - fogNear))) * 0.9;
      const c = mix(q.color, BG_BOTTOM, fog);
      const fill = `rgb(${c[0]},${c[1]},${c[2]})`;
      const x0 = px[q.i0 * 3], y0 = px[q.i0 * 3 + 1];
      const x1 = px[q.i1 * 3], y1 = px[q.i1 * 3 + 1];
      const x2 = px[q.i2 * 3], y2 = px[q.i2 * 3 + 1];
      const x3 = px[q.i3 * 3], y3 = px[q.i3 * 3 + 1];
      // Skip quads that are sub-pixel.
      const w = Math.max(x0, x1, x2, x3) - Math.min(x0, x1, x2, x3);
      const h = Math.max(y0, y1, y2, y3) - Math.min(y0, y1, y2, y3);
      if (w * h < 1.2) continue;
      items.push({
        depth,
        draw: () => {
          ctx.fillStyle = fill;
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.lineTo(x3, y3);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = fill; // close hairline seams between quads
          ctx.lineWidth = 0.6;
          ctx.stroke();
        },
      });
    }

    const CHUNK = 10;
    for (const flight of dataRef.current.flights) {
      const pts = flight.pts;
      if (pts.length < 2) continue;
      const projected: ([number, number, number] | null)[] = [];
      for (let i = 0; i < pts.length; i += 1) {
        const lon = pts[i][0];
        const lat = pts[i][1];
        const x = (lon - mesh.midLon) * mesh.kmPerLon;
        const y = (lat - mesh.midLat) * mesh.kmPerLat;
        const z = (pts[i][2] / 1000) * EXAG;
        projected.push(project(x, y, z));
      }
      const width = flight.ssa.length ? 3 : flight.wave ? 2 : 1.3;
      const alpha = flight.wave || flight.ssa.length ? 0.95 : 0.5;
      for (let a = 0; a < projected.length - 1; a += CHUNK - 1) {
        const b = Math.min(projected.length - 1, a + CHUNK - 1);
        const seg: [number, number][] = [];
        let depthSum = 0;
        let maxAlt = 0;
        let ok = false;
        for (let i = a; i <= b; i += 1) {
          const p = projected[i];
          if (p) {
            seg.push([p[0], p[1]]);
            depthSum += p[2];
            maxAlt = Math.max(maxAlt, pts[i][2]);
            ok = true;
          }
        }
        if (!ok || seg.length < 2) continue;
        const depth = depthSum / seg.length;
        const stroke = altColor(maxAlt * 3.28084, alpha);
        items.push({
          depth,
          draw: () => {
            ctx.strokeStyle = stroke;
            ctx.lineWidth = width;
            ctx.lineJoin = "round";
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(seg[0][0], seg[0][1]);
            for (let k = 1; k < seg.length; k += 1) ctx.lineTo(seg[k][0], seg[k][1]);
            ctx.stroke();
          },
        });
      }
    }

    items.sort((a, b) => b.depth - a.depth);
    for (const item of items) item.draw();
  }, [mesh, camera, frame, ready, year]);

  // Orbit + zoom.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let pinch = 0;
    const pointers = new Map<number, { x: number; y: number }>();

    const down = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) {
        dragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
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
      setCamera((c) => ({
        ...c,
        yaw: (c.yaw - dx * 0.35 + 360) % 360,
        pitch: Math.min(84, Math.max(2, c.pitch + dy * 0.25)),
      }));
    };
    const up = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size === 0) dragging = false;
      if (pointers.size < 2) pinch = 0;
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
                year === y
                  ? "bg-sky-400/90 text-slate-950"
                  : "bg-white/10 text-slate-200 hover:bg-white/20"
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
        {error ? (
          <p className="absolute inset-0 grid place-items-center text-sm text-slate-300">
            The 3D view is unavailable right now.
          </p>
        ) : null}
        {!mosaic && !error ? (
          <p className="absolute inset-0 grid place-items-center text-sm text-slate-400">Loading terrain…</p>
        ) : null}
        <p className="pointer-events-none absolute bottom-3 left-4 text-[11px] text-slate-400">
          drag to orbit · scroll to zoom
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 pb-5 pt-4 text-[11px] text-slate-400 sm:px-7">
        <span>Altitude</span>
        <span className="h-2 w-44 rounded-full" style={{ background: `linear-gradient(to right, ${ramp.map(([ft, c]) => `rgb(${c.join(",")}) ${((ft - 800) / (34000 - 800)) * 100}%`).join(", ")})` }} />
        <span className="tabular-nums">800 ft → 34,000 ft</span>
        <span className="ml-auto">
          wave flights bright · everything else dim · GPS altitudes read a little high
        </span>
      </div>
    </div>
  );
}
