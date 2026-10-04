#!/usr/bin/env python3
"""Vectorise the association logo into a flat-colour, transparent SVG with potrace.

Usage:
  python3 scripts/make-logo-svg.py "<logo on white>.png" public/images/brand/logo.svg

Run this against the original artwork (white background), not the processed
transparent PNG: the original still contains the white snow caps and letter
counters, which a transparency pass would have already erased.

Pixels are quantised to the artwork's blue palette (light to dark) and traced
with potrace, stacked light-under-dark with exact colour regions and hairline
self-coloured strokes so adjacent regions overlap slightly. Shape cores are
classified by nearest colour and grown outward over the anti-aliased rim, so
edges take their shape's own colour — no white fringe, no light halo.
Near-white areas (background, snow, counters) are left transparent. Requires
`potrace` on PATH.
"""

import re
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

# Light -> dark — the artwork's own flat tones, sampled with quantize-8.
# Using all of them keeps tonal boundaries exact instead of merging tones.
PALETTE = [
    "#d2e6f7",  # pale wave
    "#a9d1f2",  # light wave / mountain highlight
    "#8bb2d6",  # light slope
    "#76a2cb",  # mid blue
    "#5179a2",  # steel blue
    "#3f5f84",  # slate navy
    "#173f6e",  # deep blue
    "#052a5b",  # darkest navy (text, glider, rock shadow)
]

WHITE_CUTOFF = 240  # min-channel at or above this counts as white
MARGIN = 6  # px of padding kept around the artwork


def erode(mask: np.ndarray, iterations: int = 1) -> np.ndarray:
    """Binary erosion (4-neighbourhood) — finds shape cores for label growth."""
    result = mask
    for _ in range(iterations):
        padded = np.pad(result, 1, constant_values=False)
        result = (
            padded[:-2, 1:-1] & padded[2:, 1:-1] & padded[1:-1, :-2] & padded[1:-1, 2:]
        )
    return result


def trace(
    mask: np.ndarray, width: int, height: int, colour: str, workdir: Path, outline: bool
) -> str:
    """Trace one binary mask and return the <g>...</g> block potrace produced."""
    pbm = workdir / f"layer-{colour.lstrip('#')}.pbm"
    svg = workdir / f"layer-{colour.lstrip('#')}.svg"

    bits = np.packbits(mask.astype(np.uint8), axis=1)
    with pbm.open("wb") as handle:
        handle.write(f"P4\n{width} {height}\n".encode())
        handle.write(bits.tobytes())

    subprocess.run(
        [
            "potrace",
            "-s",
            "--turdsize",
            "12",
            "--opttolerance",
            "0.3",
            "-o",
            str(svg),
            str(pbm),
        ],
        check=True,
    )

    text = svg.read_text()
    group = re.search(r"<g[^>]*>.*</g>", text, re.S)
    if group is None:
        raise SystemExit(f"potrace produced no path for {colour}")
    # potrace draws everything black; recolour the group and its paths.
    result = group.group(0).replace('fill="#000000"', f'fill="{colour}"')
    if outline:
        # A hairline stroke in the layer's own colour guarantees it covers the
        # layer beneath, where independent smoothing leaves sub-pixel slivers.
        result = result.replace(
            'stroke="none"', f'stroke="{colour}" stroke-width="2"'
        )
    return result


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit(
            "usage: python3 scripts/make-logo-svg.py <source.png> <destination.svg>"
        )

    source, destination = Path(sys.argv[1]), Path(sys.argv[2])

    image = Image.open(source).convert("RGBA")
    pixels = np.array(image).astype(np.int16)
    rgb = pixels[..., :3]
    height, width = rgb.shape[:2]

    # Denoise before quantising: the artwork carries fine texture in the
    # mountain's slopes, which would otherwise trace as dark speckles.
    smoothed = np.array(
        image.convert("RGB").filter(ImageFilter.MedianFilter(5))
    ).astype(np.int16)

    # Everything that is not near-white is artwork. Near-white pixels are
    # background, snow or letter counters — they stay transparent.
    content = (pixels[..., 3] > 200) & (rgb.min(axis=2) < WHITE_CUTOFF)

    # Classify by nearest palette colour. This artwork's tones all share one
    # hue, so blend-line projection metrics are degenerate here; nearest-
    # neighbour is exact for the flat areas. Anti-aliased rims are handled by
    # growing the core labels below, not by the classifier.
    palette_rgb = np.array(
        [tuple(int(c[i : i + 2], 16) for i in (1, 3, 5)) for c in PALETTE]
    )
    flat = smoothed.reshape(-1, 3).astype(np.float64)
    errors = [
        ((flat - colour.astype(np.float64)) ** 2).sum(axis=1) for colour in palette_rgb
    ]
    assigned = np.stack(errors, axis=1).argmin(axis=1).reshape(height, width)

    # Line classification is reliable for solid areas but ambiguous on
    # anti-aliased rims (a navy-white edge pixel can sit closer to the slate
    # line). Classify only the shape cores and grow those labels outward over
    # the rim, preferring the darkest neighbouring label. That extends each
    # shape's own colour to its edge with no light ring.
    interior = erode(content, 3)
    labels = np.where(interior, assigned, -1)
    for _ in range(6):
        unresolved = content & (labels < 0)
        if not unresolved.any():
            break
        padded = np.pad(labels, 1, constant_values=-1)
        neighbours = (
            padded[:-2, 1:-1],
            padded[2:, 1:-1],
            padded[1:-1, :-2],
            padded[1:-1, 2:],
            padded[:-2, :-2],
            padded[:-2, 2:],
            padded[2:, :-2],
            padded[2:, 2:],
        )
        taken = np.maximum.reduce(neighbours)
        labels = np.where(unresolved & (taken >= 0), taken, labels)
    assigned = np.where(labels >= 0, labels, assigned)

    # Trim to the artwork with a small margin.
    rows = np.where(content.any(axis=1))[0]
    columns = np.where(content.any(axis=0))[0]
    top = max(int(rows[0]) - MARGIN, 0)
    bottom = min(int(rows[-1]) + MARGIN + 1, height)
    left = max(int(columns[0]) - MARGIN, 0)
    right = min(int(columns[-1]) + MARGIN + 1, width)
    content = content[top:bottom, left:right]
    assigned = assigned[top:bottom, left:right]
    height, width = content.shape

    with tempfile.TemporaryDirectory(prefix="logo-svg-") as tmp:
        workdir = Path(tmp)
        groups = []
        for index, colour in enumerate(PALETTE):
            # Exact regions, not cumulative: every shape ends where its own
            # colour ends. The hairline stroke (below) covers boundaries, so
            # glyph edges antialias against the page, not through the stack.
            mask = (assigned == index) & content
            if not mask.any():
                continue
            groups.append(trace(mask, width, height, colour, workdir, outline=index > 0))

    body = "\n".join(groups)
    destination.write_text(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}">\n'
        f"{body}\n</svg>\n"
    )

    size_kb = destination.stat().st_size / 1024
    print(f"wrote {destination} ({width}x{height}, {size_kb:.0f} KB, {len(groups)} layers)")


if __name__ == "__main__":
    main()
