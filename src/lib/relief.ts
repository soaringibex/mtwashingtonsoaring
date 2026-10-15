// The terrain canvases' shared shading — one hillshade model and one ramp
// interpolator for every map that draws the AWS terrain mosaic. Each map brings its
// own ramp (the wave map's carries a data field; the live tracker wants a quiet base
// under bright traffic), but the colour maths lives only here.

export type ReliefRamp = readonly (readonly [number, readonly [number, number, number]])[];

/** Light from the northwest (map convention), 45° altitude. */
export const MAP_LIGHT = { east: -0.5, north: 0.5, up: Math.SQRT1_2 };

/**
 * The site's one terrain palette — greens at valley floors, greys and whites up the
 * Presidentials. Every map that draws the mosaic shares it, so the wave map and the
 * live tracker read as the same mountain.
 */
export const MAP_RELIEF_RAMP: ReliefRamp = [
  [150, [52, 76, 60]],
  [400, [84, 108, 74]],
  [650, [122, 132, 88]],
  [900, [160, 148, 108]],
  [1150, [172, 146, 116]],
  [1400, [166, 162, 164]],
  [1650, [210, 210, 212]],
  [1950, [238, 239, 242]],
];

/**
 * A hillshaded colour for one elevation: the ramp interpolated between its two
 * bracketing entries, then brightened or dimmed by the surface's shading factor.
 */
export function reliefColour(
  elevationM: number,
  shade: number,
  ramp: ReliefRamp,
): [number, number, number] {
  const low = ramp[0];
  const high = ramp[ramp.length - 1];
  const e = Math.min(Math.max(elevationM, low[0]), high[0]);
  let lower = low;
  let upper = high;
  for (let i = 0; i < ramp.length - 1; i += 1) {
    if (e >= ramp[i][0] && e <= ramp[i + 1][0]) {
      lower = ramp[i];
      upper = ramp[i + 1];
      break;
    }
  }
  const t = (e - lower[0]) / (upper[0] - lower[0] || 1);
  const factor = Math.min(Math.max(0.42 + 1.15 * shade, 0.3), 1.45);
  return [
    Math.round((lower[1][0] + (upper[1][0] - lower[1][0]) * t) * factor),
    Math.round((lower[1][1] + (upper[1][1] - lower[1][1]) * t) * factor),
    Math.round((lower[1][2] + (upper[1][2] - lower[1][2]) * t) * factor),
  ];
}
