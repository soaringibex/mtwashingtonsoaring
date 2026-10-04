#!/usr/bin/env python3
"""Clean the glider's silhouette before vectorising.

Usage:
  python3 scripts/logo-clean-glider.py <illustration.png> <out.png>

The glider is the only dark element in the artwork's upper region, so its
solid silhouette separates from every background tone (the wave's lightest
tone has min-channel 169) at min-channel < 150 — the 50 %-coverage contour.
Median + morphological closing remove raster speckle and bridge the thin
wing tips; the cleaned shape is then painted with the exact navy, so the
vectoriser sees a solid silhouette instead of noise. A red debug overlay is
written next to the output as <out stem>.mask.png.
"""

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


def dilate(mask: np.ndarray) -> np.ndarray:
    """One-pixel 8-neighbourhood dilation."""
    padded = np.pad(mask, 1, constant_values=False)
    return (
        padded[:-2, 1:-1]
        | padded[2:, 1:-1]
        | padded[1:-1, :-2]
        | padded[1:-1, 2:]
        | padded[:-2, :-2]
        | padded[:-2, 2:]
        | padded[2:, :-2]
        | padded[2:, 2:]
    )


def closing(mask: np.ndarray) -> np.ndarray:
    """Dilate then erode by 1 px — bridges hairline gaps in the mask."""
    grown = dilate(mask)
    padded = np.pad(grown, 1, constant_values=False)
    return padded[:-2, 1:-1] & padded[2:, 1:-1] & padded[1:-1, :-2] & padded[1:-1, 2:]


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: python3 scripts/logo-clean-glider.py <illustration.png> <out.png>")

    source, destination = Path(sys.argv[1]), Path(sys.argv[2])
    pixels = np.array(Image.open(source).convert("RGB"))
    minima = pixels.min(axis=2).astype(np.int16)
    height, width = minima.shape

    # The glider: dark pixels in the upper region (the mountain starts at y≈415).
    candidate = np.zeros_like(minima, dtype=bool)
    candidate[0:400, 600:width] = minima[0:400, 600:width] < 150

    rows = np.where(candidate.any(axis=1))[0]
    columns = np.where(candidate.any(axis=0))[0]
    y0, y1 = max(int(rows[0]) - 8, 0), min(int(rows[-1]) + 9, height)
    x0, x1 = max(int(columns[0]) - 8, 0), min(int(columns[-1]) + 9, width)
    print(f"glider bbox x {x0}-{x1}, y {y0}-{y1}")

    mask = np.zeros((height, width), dtype=np.uint8)
    mask[y0:y1, x0:x1] = (minima[y0:y1, x0:x1] < 150).astype(np.uint8) * 255
    smoothed = Image.fromarray(mask).filter(ImageFilter.MedianFilter(3))
    cleaned = closing(np.array(smoothed) > 127)

    # Fatten by one pixel: the wing's outer section is only 1–2 px thick, and
    # the vectoriser's own denoise would otherwise eat it away.
    fattened = dilate(cleaned)

    result = pixels.copy()
    result[fattened] = (5, 42, 91)  # #052a5b
    Image.fromarray(result).save(destination)

    debug = (pixels.astype(np.float64) * 0.45 + 255 * 0.55).astype(np.uint8)
    debug[fattened] = (220, 40, 40)
    debug_path = destination.with_name(f"{destination.stem}.mask.png")
    Image.fromarray(debug).save(debug_path)

    print(
        f"wrote {destination} and {debug_path.name} "
        f"({int(fattened.sum())} px replaced)"
    )


if __name__ == "__main__":
    main()
