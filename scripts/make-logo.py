#!/usr/bin/env python3
"""Prepare the header logo: turn the artwork's white background transparent
and trim the surrounding empty padding.

Usage:
  python3 scripts/make-logo.py <source.png> <destination.png>

Near-white pixels become transparent with a short ramp so anti-aliased edges
stay soft; anything with actual colour (navy artwork, pale blue wave) is kept.
"""

import sys

import numpy as np
from PIL import Image

if len(sys.argv) != 3:
    raise SystemExit("usage: python3 scripts/make-logo.py <source.png> <destination.png>")

source, destination = sys.argv[1], sys.argv[2]

image = Image.open(source).convert("RGBA")
pixels = np.array(image).astype(np.int16)

# min-channel whiteness: 0 for black, 255 for white
whiteness = pixels[..., :3].min(axis=2)
# fully transparent at >= 250, fully opaque at <= 235, linear in between
alpha = np.clip((250 - whiteness) * (255 / 15), 0, 255)
pixels[..., 3] = alpha.astype(np.uint8)

prepared = Image.fromarray(pixels.astype(np.uint8), "RGBA")

# Trim to the visible artwork with a small breathing margin.
box = prepared.getchannel("A").point(lambda value: 255 if value > 8 else 0).getbbox()
if box is not None:
    margin = 6
    left = max(box[0] - margin, 0)
    top = max(box[1] - margin, 0)
    right = min(box[2] + margin, prepared.width)
    bottom = min(box[3] + margin, prepared.height)
    prepared = prepared.crop((left, top, right, bottom))

prepared.save(destination, optimize=True)

width, height = prepared.size
print(f"wrote {destination} ({width}x{height})")
