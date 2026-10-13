/**
 * The colours and short names of the 2026-10-12 flight's phases — shared by the
 * 3D scene (WebGL vertex colours, canvas labels, SVG barogram) and the article's
 * scroll cards, so the two can never drift apart. Keep in step with the phase
 * ids in public/data/flights/three-ways-into-the-wave.json.
 */

export const PHASE_COLORS: Record<string, string> = {
  tow: "#94a3b8",
  ridge: "#f59e0b",
  transit: "#22d3ee",
  rotor: "#34d399",
  wave: "#f472b6",
  upwind: "#a78bfa",
  home: "#94a3b8",
};

export const PHASE_SHORT: Record<string, string> = {
  tow: "Tow & sink",
  ridge: "The ridge",
  transit: "Below the rotor",
  rotor: "Rotor climb",
  wave: "Wave climb",
  upwind: "Upwind",
  home: "Home",
};

/** "#f59e0b" → [0.96, 0.62, 0.04] for WebGL attribute colours. */
export function hexToUnitRgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  const n = Number.parseInt(value.length === 3 ? value.replace(/(.)/g, "$1$1") : value, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
