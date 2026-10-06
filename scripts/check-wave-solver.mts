// Build-time invariant for the linear wave solver: subdividing each l² layer must not
// change the solution (the transfer composes exactly: T(a+b) = T(b)·T(a) for constant
// q²). A uniform test column cannot see a layer-alignment error — the shipped bug of
// 2026-10-06 shifted the whole l² staircase down one layer and was invisible to the
// analytic uniform check — so this uses a deliberately NON-uniform profile.
import { buildWaveColumn, solveLinearWave, type WaveColumnLayer } from "../src/lib/linear-wave.ts";
import type { WaveColumnLevel } from "../src/lib/linear-wave.ts";

const N_LAYERS = 44;
const levels: WaveColumnLevel[] = [];
// Non-uniform stability and wind, in a range that gives a healthy trapped response
// (a nearly-cancelled field would make any comparison hypersensitive).
for (let i = 1; i <= N_LAYERS; i += 1) {
  const zM = i * 320; // 320 m ≈ the real column mid-troposphere
  const hPa = 1000 * Math.exp(-zM / 8000);
  const n2 = 1.4e-4 * (1 + 0.35 * Math.sin(i * 0.7));
  const theta = 300 * Math.exp((n2 * zM) / 9.81);
  levels.push({
    hPa,
    zM,
    tempC: theta * Math.pow(hPa / 1000, 0.2854) - 273.15,
    speedMs: 18 + 3.5 * Math.sin(i * 0.5),
    dirDeg: 285 + 8 * Math.sin(i * 0.4),
  });
}

const terrain = Array.from({ length: 41 }, (_, i) => {
  const d = (i - 20) * 1200;
  return 400 + 1300 * Math.exp(-(d * d) / (2 * 5000 * 5000)) + 250 * Math.exp(-((d - 6000) ** 2) / (2 * 2500 ** 2));
});

const baseline = buildWaveColumn(levels, 105, 1800);
if (!baseline) throw new Error("baseline column failed");

const split = (column: NonNullable<typeof baseline>, n: number) => {
  const layers: WaveColumnLayer[] = [];
  let previousTop = 0;
  for (const layer of column.layers) {
    const span = (layer.zTopM - previousTop) / n;
    for (let i = 1; i <= n; i += 1) layers.push({ zTopM: previousTop + span * i, l2: layer.l2 });
    previousTop = layer.zTopM;
  }
  return { levels: column.levels, layers, uSurfaceMs: column.uSurfaceMs };
};

// Compare at an EXACT common level: every parent layer top also exists in the split
// (the split's sub-tops end exactly on the parent's), so no interpolation is involved
// and the invariance must hold to floating point.
const lineAt = (column: NonNullable<typeof baseline>, target: number) => {
  const solve = solveLinearWave({ terrainM: terrain, dxM: 1200, column });
  if (!solve) throw new Error("solve failed");
  let li = 0;
  for (let i = 1; i < solve.zM.length; i += 1) {
    if (solve.zM[i] <= target) li = i;
  }
  return { z: solve.zM[li], line: solve.w[li] };
};

const target = 3000;
const base = lineAt(baseline, target);
const refined = lineAt(split(baseline, 4), base.z);
if (refined.z !== base.z) throw new Error(`common level missing in the split (${base.z} vs ${refined.z})`);
const rms = (values: number[]) => Math.sqrt(values.reduce((sum, v) => sum + v * v, 0) / values.length);
const difference = Math.sqrt(base.line.reduce((sum, v, i) => sum + (v - refined.line[i]) ** 2, 0) / base.line.length);
const relative = difference / rms(base.line);
if (relative > 0.01) {
  throw new Error(
    `wave solver split-invariance failed at z=${base.z} m: RMS difference ${(100 * relative).toFixed(1)}% of ${rms(base.line).toFixed(2)} m/s — layer alignment or transfer bug`,
  );
}
console.log(`wave solver: split-invariance ok at z=${base.z} m (RMS difference ${(100 * relative).toFixed(3)}% of ${rms(base.line).toFixed(2)} m/s)`);
