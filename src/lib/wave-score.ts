// A model-based wave signal for the Presidential Range, built around the Scorer parameter
// (l² = N²/U² — the stability of the air over the wind). Lee waves favor a Scorer parameter
// that falls with height, a steady cross-ridge flow at ridge-top, and a strong flow aloft.

export type WaveLevel = {
  hPa: number;
  altM: number;
  tempC: number;
  speedKt: number;
  dirDeg: number;
  /** Cloud cover at the level, percent — used for the ceiling estimate. */
  cloudCover?: number | null;
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
  /** Low-layer Brunt–Väisälä frequency, s⁻¹. */
  bruntLow: number;
  /** Estimated strongest wave lift, ft/min — the N·h scale, tapered by the cross-ridge flow. */
  liftFpm: number;
  /** Signed l² at each pressure level, for the profile chart. */
  scorerLevels: { hPa: number; altM: number; scorer: number | null }[];
};

const KT_TO_MS = 0.514444;
const G = 9.81;
/**
 * The Presidential Range rises roughly 4,000 ft (1,200 m) above the valleys the
 * wave-making flow crosses — the h in the N·h vertical-velocity scale.
 */
export const WAVE_RELIEF_M = 1200;

/** Pressure levels pulled for the wave forecast — the full column for the profile chart. */
export const WAVE_LEVELS = [
  1000, 975, 950, 925, 900, 875, 850, 825, 800, 775, 750, 725, 700, 675, 650, 625, 600, 575, 550,
  525, 500, 475, 450, 425, 400, 375, 350, 325, 300, 275, 250, 225, 200, 175, 150, 100,
] as const;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Eastward wind component in knots — positive is a westerly (cross-ridge) wind. */
/** The ridge's lee side — the Presidential crest runs ~40°/220°, so the normal is 305°/125°. */
const RIDGE_LEE_DEG = 125;

/**
 * The wind's component across the ridge (positive toward the SE lee side). A wind along
 * the range (SW/NE) correctly scores near zero; a pure eastward projection cannot see
 * that, and over-scores along-range days.
 */
export function crossRidgeKt(speedKt: number, dirDeg: number): number {
  return speedKt * Math.cos(((dirDeg + 180 - RIDGE_LEE_DEG) * Math.PI) / 180);
}

const potentialTemperature = (tempC: number, hPa: number) =>
  (tempC + 273.15) * (1000 / hPa) ** 0.2854;

const mean = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

export type WaveTop = {
  /** Estimated usable top of the wave, ft — the physical top, or the cloud ceiling. */
  topFt: number;
  /** The propagation/tropopause estimate before any cloud cap, ft. */
  physicalTopFt: number;
  /** Cloud ceiling that pulls the effective top below the physical top, ft. */
  ceilingFt: number | null;
  /** Top of that cloud layer, ft. */
  cloudTopFt: number | null;
  /** Where l² falls below the terrain wavenumber — the resonant wave's cap, ft. */
  reflectionFt: number | null;
};

const RIDGE_FT = 6288;
const FT_PER_M = 3.28084;
/**
 * Terrain wavenumber squared for the Presidential Range: k = 2π/λ with a dominant
 * cross-ridge scale of about 16 km — the massif's half-width between the Great Gulf
 * and the Bartlett valley, which matches the lee-wave extent SkySight's cross-section
 * showed on 2026-10-06. Below l² = k² the shorter wave components turn evanescent and
 * reflect — the level pilots read as the Scorer "bend".
 */
const TERRAIN_K2 = (2 * Math.PI) ** 2 / (16000 * 16000);

/**
 * The estimated top of the usable wave: the highest level the wave still reaches —
 * the flow keeps crossing the ridge (≥ 5 kt eastward) and stays stable layer by layer,
 * capped at the estimated tropopause — then pulled down to the base of the lowest
 * significant cloud layer when that ceiling sits below. Separately reports the
 * reflection level, where l² falls below the terrain wavenumber: the resonant wave
 * caps there, though longer wavelengths keep propagating above it.
 */
export function estimateWaveTop(
  levels: WaveLevel[],
  scorerLevels?: { hPa: number; altM: number; scorer: number | null }[],
): WaveTop | null {
  const sorted = [...levels].sort((a, b) => b.hPa - a.hPa); // ground first
  if (sorted.length < 4) return null;

  // Propagation: scan upward, stop when the flow stops crossing the ridge or an
  // unstable layer interrupts the wave.
  const ridgeM = RIDGE_FT / FT_PER_M;
  let topM: number | null = null;
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const lower = sorted[i];
    const upper = sorted[i + 1];
    if (upper.altM <= ridgeM) continue;
    const u = crossRidgeKt(upper.speedKt, upper.dirDeg);
    const stable = potentialTemperature(upper.tempC, upper.hPa) > potentialTemperature(lower.tempC, lower.hPa);
    if (u < 5 || !stable) break;
    topM = upper.altM;
  }

  // Tropopause estimate (WMO): the first level above 400 hPa whose lapse rate over the
  // NEXT TWO KILOMETRES is under 2 K/km — a single thin warm layer is not enough.
  let tropopauseM: number | null = null;
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const lower = sorted[i];
    if (lower.hPa > 400) continue;
    let j = i + 1;
    while (j < sorted.length - 1 && sorted[j].altM - lower.altM < 2000) j += 1;
    const upper = sorted[j];
    const dz = upper.altM - lower.altM;
    if (dz < 2000) break; // not enough column left to confirm the criterion
    const lapsePerKm = ((upper.tempC - lower.tempC) / dz) * 1000;
    if (lapsePerKm > -2) {
      tropopauseM = lower.altM;
      break;
    }
  }

  const modelTopM = sorted[sorted.length - 1].altM;
  const physicalTopM = Math.min(topM ?? ridgeM, tropopauseM ?? modelTopM, modelTopM);
  const physicalTopFt = Math.round((physicalTopM * FT_PER_M) / 100) * 100;

  // The lowest significant cloud layer (≥ 65% cover), found from the ground up.
  let ceilingM: number | null = null;
  let cloudTopM: number | null = null;
  let insideLayer = false;
  for (const level of sorted) {
    const cover = typeof level.cloudCover === "number" ? level.cloudCover : 0;
    if (cover >= 65) {
      if (ceilingM === null) ceilingM = level.altM;
      cloudTopM = level.altM;
      insideLayer = true;
    } else if (insideLayer) {
      break;
    }
  }

  const ceilingFt = ceilingM === null ? null : Math.round((ceilingM * FT_PER_M) / 100) * 100;
  const cloudTopFt = cloudTopM === null ? null : Math.round((cloudTopM * FT_PER_M) / 100) * 100;
  const limiting = ceilingFt !== null && ceilingFt < physicalTopFt;

  // The reflection level: the first level above the ridge whose l² sits below the
  // terrain wavenumber — the resonant component's cap.
  let reflectionM: number | null = null;
  if (scorerLevels) {
    const ascending = [...scorerLevels].sort((a, b) => a.altM - b.altM);
    for (const level of ascending) {
      if (level.altM <= ridgeM) continue;
      if (level.scorer === null) continue;
      if (level.scorer < TERRAIN_K2) {
        reflectionM = level.altM;
        break;
      }
    }
  }
  const reflectionFt = reflectionM === null ? null : Math.round((reflectionM * FT_PER_M) / 100) * 100;

  return {
    topFt: limiting ? ceilingFt : physicalTopFt,
    physicalTopFt,
    ceilingFt: limiting ? ceilingFt : null,
    cloudTopFt: limiting ? cloudTopFt : null,
    reflectionFt,
  };
}

export function computeWaveScore(levels: WaveLevel[]): WaveScore | null {
  const sorted = [...levels].sort((a, b) => b.hPa - a.hPa); // ground level first
  if (sorted.length < 4) return null;

  // l² per layer between neighbouring levels. Only layers with a stable lapse and a
  // westerly component count — otherwise the ratio below would read a decline that isn't.
  const layers: {
    lowerHPa: number;
    upperHPa: number;
    midHPa: number;
    scorer: number;
    rawScorer: number | null;
    brunt: number;
    valid: boolean;
  }[] = [];
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const lower = sorted[i];
    const upper = sorted[i + 1];
    const dz = upper.altM - lower.altM;
    if (!(dz > 0)) continue;
    const thetaLower = potentialTemperature(lower.tempC, lower.hPa);
    const thetaUpper = potentialTemperature(upper.tempC, upper.hPa);
    const brunt = (G / ((thetaLower + thetaUpper) / 2)) * ((thetaUpper - thetaLower) / dz); // N²
    const u =
      ((crossRidgeKt(lower.speedKt, lower.dirDeg) + crossRidgeKt(upper.speedKt, upper.dirDeg)) / 2) *
      KT_TO_MS;
    const valid = u > 0 && brunt > 0;
    layers.push({
      lowerHPa: lower.hPa,
      upperHPa: upper.hPa,
      midHPa: (lower.hPa + upper.hPa) / 2,
      scorer: valid ? brunt / (u * u) : 0,
      // The chart keeps the signed value — unstable layers show negative, as on a
      // sounding sheet; near-zero winds are skipped rather than blowing the scale up.
      rawScorer: u > 0.25 ? brunt / (u * u) : null,
      brunt,
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
  const ridgeKt = crossRidgeKt(ridgeLevel.speedKt, ridgeLevel.dirDeg);
  const aloftKt = crossRidgeKt(aloftLevel.speedKt, aloftLevel.dirDeg);

  const ridge = clamp01((ridgeKt - 8) / 32); // 8 kt → 0, 40 kt → 1
  const aloft = clamp01((aloftKt - 15) / 45); // 15 kt → 0, 60 kt → 1

  // The wave's lift scale: w ≈ N·h over the lower layers — the standard upper scale for
  // hydrostatic mountain-wave vertical velocity — tapered when the flow is only marginal.
  const bruntLow = Math.sqrt(
    Math.max(0, mean(lowLayers.filter((layer) => layer.valid).map((layer) => layer.brunt))),
  );
  const crossFactor = clamp01((ridgeKt - 5) / 15); // 5 kt → 0, 20 kt → 1
  const liftFpm = Math.round((bruntLow * WAVE_RELIEF_M * 196.85 * crossFactor) / 100) * 100;

  // Signed l² at each level for the profile chart — the average of the layers
  // immediately above and below it.
  const scorerLevels = sorted.map((level) => {
    const adjacent = layers.filter(
      (layer) => layer.lowerHPa === level.hPa || layer.upperHPa === level.hPa,
    );
    const raw = adjacent
      .map((layer) => layer.rawScorer)
      .filter((value): value is number => value !== null);
    return {
      hPa: level.hPa,
      altM: level.altM,
      scorer: raw.length > 0 ? mean(raw) : null,
    };
  });

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
    bruntLow,
    liftFpm,
    scorerLevels,
  };
}
