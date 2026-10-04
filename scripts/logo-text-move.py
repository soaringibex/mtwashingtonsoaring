#!/usr/bin/env python3
"""Move the logo's wordmark right and rebuild its second line.

Usage:
  python3 scripts/logo-text-move.py <src.png> <dest.png> <dx> <scale>

- Both text lines are moved dx pixels to the right (clear of the wave).
- "SOARING ASSOCIATION" is enlarged by <scale> and re-tracked so it is
  justified — left-aligned with "MOUNT WASHINGTON" and the same width.
Run this on the shifted artwork from scripts/logo-mountain-shift.py, then
vectorise with scripts/make-logo-svg.py.
"""

import sys
from pathlib import Path

import numpy as np
from PIL import Image


def row_bands(mask: np.ndarray, x0: int, y0: int) -> list[tuple[int, int]]:
    rows = mask[:, x0:].any(axis=1)
    bands = []
    start = None
    for y in range(y0, mask.shape[0]):
        if rows[y] and start is None:
            start = y
        elif not rows[y] and start is not None:
            bands.append((start, y - 1))
            start = None
    if start is not None:
        bands.append((start, mask.shape[0] - 1))
    return bands


def column_runs(mask: np.ndarray, x0: int, x1: int) -> list[tuple[int, int]]:
    columns = mask.any(axis=0)
    runs = []
    start = None
    for x in range(x0, x1):
        if columns[x] and start is None:
            start = x
        elif not columns[x] and start is not None:
            runs.append((start, x - 1))
            start = None
    if start is not None:
        runs.append((start, x1 - 1))
    return runs


def main() -> None:
    if len(sys.argv) != 5:
        raise SystemExit(
            "usage: python3 scripts/logo-text-move.py <src.png> <dest.png> <dx> <scale>"
        )

    source, destination, dx, scale = (
        Path(sys.argv[1]),
        Path(sys.argv[2]),
        int(sys.argv[3]),
        float(sys.argv[4]),
    )

    image = Image.open(source).convert("RGB")
    pixels = np.array(image)
    height, width, _ = pixels.shape
    minima = pixels.min(axis=2).astype(np.int16)
    content = minima < 240

    bands = row_bands(content, 1050, 425)
    if len(bands) < 2:
        raise SystemExit("could not locate the two text lines")
    mount_top, mount_bottom = bands[0]
    soar_top, soar_bottom = bands[1]
    print(f"MOUNT band {mount_top}-{mount_bottom}, SOARING band {soar_top}-{soar_bottom}")

    # MOUNT block, and its left edge.
    mount_y0, mount_y1 = max(mount_top - 6, 0), min(mount_bottom + 6, height)
    mount_x0 = 1040
    mount_patch = pixels[mount_y0:mount_y1, mount_x0:width]
    mount_mask = content[mount_y0:mount_y1, mount_x0:width]
    mount_columns = np.where(mount_mask.any(axis=0))[0]
    mount_left = mount_x0 + int(mount_columns.min())
    mount_right = mount_x0 + int(mount_columns.max())
    mount_width = mount_right - mount_left + 1
    print(f"MOUNT x {mount_left}-{mount_right} (width {mount_width})")

    # SOARING letters (right of the mountain's tip).
    letters = column_runs(content[soar_top:soar_bottom + 1], 1150, width)
    gaps = [letters[i + 1][0] - letters[i][1] - 1 for i in range(len(letters) - 1)]
    word_space_index = int(np.argmax(gaps))
    print(f"{len(letters)} letters; word space after letter {word_space_index} (gap {gaps[word_space_index]})")

    # New canvas, one dx wider.
    canvas = np.full((height, width + dx, 3), 255, dtype=np.uint8)
    canvas[:, :width] = pixels

    # Erase both lines from their old positions (never touching the mountain's
    # tip at x < 1150 in the SOARING band).
    canvas[mount_y0:mount_y1, mount_x0:width] = 255
    canvas[soar_top - 4:soar_bottom + 8, 1150:width] = 255

    # Paste MOUNT at +dx.
    patch = np.full((mount_y1 - mount_y0, width - mount_x0, 3), 255, dtype=np.uint8)
    patch[mount_mask] = mount_patch[mount_mask]
    canvas[mount_y0:mount_y1, mount_x0 + dx:width + dx] = patch

    # Rebuild SOARING: scale letters, justify to MOUNT's width, left-align.
    letter_widths = [x1 - x0 + 1 for x0, x1 in letters]
    scaled_widths = [wd * scale for wd in letter_widths]
    total_letters = sum(scaled_widths)
    gap_count = (len(letters) - 1) + (2.5 - 1.0)  # one gap is a wider word space
    gap = (mount_width - total_letters) / gap_count
    if gap < 3:
        raise SystemExit(f"letters too wide for the target width (gap {gap:.1f}px)")
    print(f"scale {scale}: letters {total_letters:.0f}px, gap {gap:.1f}px, word space {gap * 2.5:.1f}px")

    cursor = float(mount_left + dx)
    canvas_rgba = Image.fromarray(canvas).convert("RGBA")
    for index, (x0, x1) in enumerate(letters):
        alpha_crop = np.clip(
            (250 - minima[soar_top:soar_bottom + 1, x0:x1 + 1]) * 17, 0, 255
        ).astype(np.uint8)
        # Flat letter colour (median of the solid pixels); the resized alpha
        # mask provides the anti-aliased edge. Resizing straight-alpha RGBA
        # would mix the crop's white margins into the glyphs.
        solid = pixels[soar_top:soar_bottom + 1, x0:x1 + 1][alpha_crop > 200]
        colour = np.median(solid, axis=0).astype(np.uint8)
        target_w = max(int(round((x1 - x0 + 1) * scale)), 1)
        target_h = max(int(round((soar_bottom - soar_top + 1) * scale)), 1)
        alpha_img = Image.fromarray(alpha_crop, "L").resize((target_w, target_h), Image.LANCZOS)
        flat = np.zeros((target_h, target_w, 3), dtype=np.uint8)
        flat[:, :] = colour
        letter = Image.fromarray(np.dstack([flat, np.array(alpha_img)]), "RGBA")
        canvas_rgba.alpha_composite(letter, (int(round(cursor)), soar_top))
        cursor += target_w + gap
        if index == word_space_index:
            cursor += gap * 1.5  # extra space for the word break

    canvas = np.array(canvas_rgba.convert("RGB"))

    Image.fromarray(canvas).save(destination)
    print(f"wrote {destination} ({canvas.shape[1]}x{canvas.shape[0]})")


if __name__ == "__main__":
    main()
