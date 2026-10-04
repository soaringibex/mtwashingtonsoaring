#!/usr/bin/env python3
"""Shift the mountain range of the Mount Washington logo horizontally.

Usage:
  python3 scripts/logo-mountain-shift.py <source.png> <destination.png> <dx>

The mountain is isolated by a flood fill seeded along the baseline strip
(the wave, glider and text never reach it), so the wave, glider and wordmark
stay exactly where they are. A red-on-artwork debug image is written next to
the destination as `<destination stem>.selection.png` for review.
"""

import sys
from pathlib import Path

import numpy as np
from PIL import Image


def dilate(mask: np.ndarray, iterations: int) -> np.ndarray:
    result = mask
    for _ in range(iterations):
        padded = np.pad(result, 1, constant_values=False)
        result = (
            padded[:-2, 1:-1]
            | padded[2:, 1:-1]
            | padded[1:-1, :-2]
            | padded[1:-1, 2:]
            | padded[:-2, :-2]
            | padded[:-2, 2:]
            | padded[2:, :-2]
            | padded[2:, 2:]
        )
    return result


def main() -> None:
    if len(sys.argv) != 4:
        raise SystemExit(
            "usage: python3 scripts/logo-mountain-shift.py <source.png> <destination.png> <dx>"
        )

    source, destination, dx = Path(sys.argv[1]), Path(sys.argv[2]), int(sys.argv[3])

    image = Image.open(source).convert("RGB")
    pixels = np.array(image)
    height, width, _ = pixels.shape
    content = pixels.min(axis=2) < 240

    rows = np.arange(height)[:, None]
    columns = np.arange(width)[None, :]

    # Seed along the baseline strip, left of the wordmark; flood fill the
    # connected mountain.
    region = content & (rows >= 560) & (columns < 1000)
    while True:
        grown = dilate(region, 1) & content
        if grown.sum() == region.sum():
            break
        region = grown

    # Pull in nearby fragments (snow-separated ridge bands); the nearest wave
    # pixel is ~40 px away, so a 10 px growth cannot reach it.
    selection = dilate(region, 10) & content

    debug = np.array(image).copy()
    debug[selection] = (255, 0, 0)
    debug_path = destination.with_name(f"{destination.stem}.selection.png")
    Image.fromarray(debug).save(debug_path)

    canvas = np.array(image).copy()
    canvas[selection] = (255, 255, 255)

    ys, xs = np.where(selection)
    target_x = xs + dx
    keep = target_x >= 0
    ys, xs, target_x = ys[keep], xs[keep], target_x[keep]
    canvas[ys, target_x] = pixels[ys, xs]

    Image.fromarray(canvas).save(destination)

    print(
        f"moved {int(selection.sum())} px by {dx}; wrote {destination} and {debug_path.name}"
    )


if __name__ == "__main__":
    main()
