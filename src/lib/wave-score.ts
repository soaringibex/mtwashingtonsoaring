// A model-based wave signal for the Presidential Range, built around the Scorer parameter
// (l² = N²/U² — the stability of the air over the wind). Lee waves favor a Scorer parameter
// that falls with height, a steady cross-ridge flow at ridge-top, and a strong flow aloft.

export type WaveLevel = {
  hPa: number;
  altM: number;
  tempC: number;
  speedKt: number;
  dirDeg: number;
};

export type WaveScore = {
  score: number;
  stability: number;
  ridge: number;
  aloft: number;
  /** Mean l² over 800–600 hPa, m⁻². */
  lowScorer: number;
  /** Mean l² over 500–300 hPa, m⁻². */
  highScorer: number;
  /** Cross-ridge (eastward) component at ridge-top, kt. */
  ridgeKt: number;
  ridgeDirDeg: number;
  /** Cross-ridge component at 500 hPa, kt. */
  aloftKt: number;
};

const KT_TO_MS = 0.514444;
const G = 9.81;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Eastward wind component in knots — positive is a westerly (cross-ridge) wind. */
export function eastwardKt(speedKt: number, dirDeg: number): number {
  return -speedKt * Math.sin((dirDeg * Math.PI) / 180);
}

const potentialTemperature = (tempC: number, hPa: number) =>
  (tempC + 273.15) * (1000 / hPa) ** 0.2854;

const mean = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

export function computeWaveScore(levels: WaveLevel[]): WaveScore | null {
  const sorted = [...levels].sort((a, b) => b.hPa - a.hPa); // ground level first
  if (sorted.length < 4) return null;

  // l² per layer between neighbouring levels. Only layers with a stable lapse and a
  // westerly component count — otherwise the ratio below would read a decline that isn't.
  const layers: { midHPa: number; scorer: number; valid: boolean }[] = [];
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const lower = sorted[i];
    const upper = sorted[i + 1];
    const dz = upper.altM - lower.altM;
    if (!(dz > 0)) continue;
    const thetaLower = potentialTemperature(lower.tempC, lower.hPa);
    const thetaUpper = potentialTemperature(upper.tempC, upper.hPa);
    const brunt = (G / ((thetaLower + thetaUpper) / 2)) * ((thetaUpper - thetaLower) / dz); // N²
    const u =
      ((eastwardKt(lower.speedKt, lower.dirDeg) + eastwardKt(upper.speedKt, upper.dirDeg)) / 2) *
      KT_TO_MS;
    const valid = u > 0 && brunt > 0;
    layers.push({
      midHPa: (lower.hPa + upper.hPa) / 2,
      scorer: valid ? brunt / (u * u) : 0,
      valid,
    });
  }

  const windowLayers = (from: number, to: number) =>
    layers.filter((layer) => layer.midHPa >= from && layer.midHPa <= to);
  const lowLayers = windowLayers(600, 800);
  const highLayers = windowLayers(300, 500);
  const lowScorer = mean(lowLayers.map((layer) => layer.scorer));
  const highScorer = mean(highLayers.map((layer) => layer.scorer));

  // Wave-favorable when the Scorer parameter falls with height; r = high / low.
  const declining =
    lowLayers.length > 0 &&
    highLayers.length > 0 &&
    [...lowLayers, ...highLayers].every((layer) => layer.valid) &&
    lowScorer > 0;
  const stability = declining ? clamp01((0.95 - highScorer / lowScorer) / 0.6) : 0;

  const nearest = (hPa: number) =>
    sorted.reduce((best, level) =>
      Math.abs(level.hPa - hPa) < Math.abs(best.hPa - hPa) ? level : best,
    );
  const ridgeLevel = nearest(800);
  const aloftLevel = nearest(500);
  const ridgeKt = eastwardKt(ridgeLevel.speedKt, ridgeLevel.dirDeg);
  const aloftKt = eastwardKt(aloftLevel.speedKt, aloftLevel.dirDeg);

  const ridge = clamp01((ridgeKt - 8) / 32); // 8 kt → 0, 40 kt → 1
  const aloft = clamp01((aloftKt - 15) / 45); // 15 kt → 0, 60 kt → 1

  const score = Math.round(100 * (0.4 * stability + 0.35 * ridge + 0.25 * aloft));

  return {
    score,
    stability,
    ridge,
    aloft,
    lowScorer,
    highScorer,
    ridgeKt: Math.round(ridgeKt),
    ridgeDirDeg: ridgeLevel.dirDeg,
    aloftKt: Math.round(aloftKt),
  };
}
