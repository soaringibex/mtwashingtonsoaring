#!/usr/bin/env python3
"""Remove the traced glider from the illustration artwork.

Usage:
  python3 scripts/logo-remove-glider.py <illustration.png> <out.png>

The glider is the only dark element in the artwork's upper region, so its ink
separates from every background tone at min-channel < 150 (the 50 %-coverage
contour; the wave's lightest tone has min-channel 169). The silhouette plus a
2 px ring — its anti-aliased fringe — is painted white, leaving clean
background for the replacement glider, which scripts/logo-add-text.py places
as vector art. A red debug overlay is written as <out stem>.mask.png.
"""

import sys
from pathlib import Path

import numpy as np
from PIL import Image


def dilate(mask: np.ndarray, iterations: int = 1) -> np.ndarray:
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
    if len(sys.argv) != 3:
        raise SystemExit(
            "usage: python3 scripts/logo-remove-glider.py <illustration.png> <out.png>"
        )

    source, destination = Path(sys.argv[1]), Path(sys.argv[2])
    pixels = np.array(Image.open(source).convert("RGB"))
    minima = pixels.min(axis=2).astype(np.int16)
    height, width = minima.shape

    # The glider: dark pixels in the upper region (the mountain starts at y≈415).
    mask = np.zeros((height, width), dtype=bool)
    mask[0:400, 600:width] = minima[0:400, 600:width] < 150

    rows = np.where(mask.any(axis=1))[0]
    columns = np.where(mask.any(axis=0))[0]
    print(
        f"glider ink x {int(columns[0])}-{int(columns[-1])}, "
        f"y {int(rows[0])}-{int(rows[-1])}"
    )

    erase = dilate(mask, 2)

    result = pixels.copy()
    result[erase] = 255
    Image.fromarray(result).save(destination)

    debug = (pixels.astype(np.float64) * 0.45 + 255 * 0.55).astype(np.uint8)
    debug[erase] = (220, 40, 40)
    debug_path = destination.with_name(f"{destination.stem}.mask.png")
    Image.fromarray(debug).save(debug_path)

    print(f"wrote {destination} and {debug_path.name} ({int(erase.sum())} px erased)")


if __name__ == "__main__":
    main()
