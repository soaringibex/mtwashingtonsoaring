#!/usr/bin/env python3
"""Erase the wordmark from the artwork so only the illustration is traced.

Usage:
  python3 scripts/logo-strip-text.py <src.png> <dest.png>

The two text bands (right of the mountain) are filled white; the mountain's
tip, the wave and the glider are preserved. The wordmark is later re-added to
the SVG as real text by scripts/logo-add-text.py.
"""

import sys
from pathlib import Path

import numpy as np
from PIL import Image


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: python3 scripts/logo-strip-text.py <src.png> <dest.png>")

    source, destination = Path(sys.argv[1]), Path(sys.argv[2])
    pixels = np.array(Image.open(source).convert("RGB")).copy()

    # MOUNT WASHINGTON band, then SOARING ASSOCIATION band. The second erase
    # starts at x=1150 so the mountain's right tip (x <= 1101) survives.
    pixels[430:516, 1030:] = 255
    pixels[520:588, 1150:] = 255

    Image.fromarray(pixels).save(destination)
    print(f"wrote {destination} ({pixels.shape[1]}x{pixels.shape[0]})")


if __name__ == "__main__":
    main()
