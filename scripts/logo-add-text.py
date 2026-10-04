#!/usr/bin/env python3
"""Compose the final logo SVG: traced illustration + real, font-embedded text.

Usage:
  python3 scripts/logo-add-text.py <base.svg> <out.svg> \
      --x 1066 --mount-baseline 326 --soar-baseline 396 --width 987 \
      --mount-cap 67 --soar-cap 46

The base SVG comes from tracing the text-stripped artwork with
scripts/make-logo-svg.py. Both text lines are justified to --width using
textLength/lengthAdjust="spacing". The woff2 subsets in scripts/logo-fonts
are embedded as data URIs, so the wordmark renders identically everywhere —
including inside an <img>, where external font files are not allowed.
"""

import base64
import re
import sys
from pathlib import Path

from fontTools.ttLib import TTFont

FONT_DIR = Path(__file__).resolve().parent / "logo-fonts"
MOUNT_FONT = FONT_DIR / "mwsa-800.woff2"
SOAR_FONT = FONT_DIR / "mwsa-500.woff2"
FAMILY = "MWSA Logo"
MOUNT_TEXT = "MOUNT WASHINGTON"
SOAR_TEXT = "SOARING ASSOCIATION"
MOUNT_COLOR = "#052a5b"
SOAR_COLOR = "#a9d1f2"


def parse_flags(argv: list[str]) -> dict[str, str]:
    flags: dict[str, str] = {}
    index = 0
    while index < len(argv) - 1:
        if argv[index].startswith("--"):
            flags[argv[index][2:].replace("-", "_")] = argv[index + 1]
            index += 2
        else:
            index += 1
    return flags


def lsb_em(path: Path, character: str) -> float:
    font = TTFont(path)
    glyph = font.getBestCmap()[ord(character)]
    return font["hmtx"][glyph][1] / font["head"].unitsPerEm


def cap_em(path: Path) -> float:
    font = TTFont(path)
    return font["OS/2"].sCapHeight / font["head"].unitsPerEm


def natural_width_em(path: Path, text: str) -> float:
    font = TTFont(path)
    cmap = font.getBestCmap()
    hmtx = font["hmtx"]
    units = font["head"].unitsPerEm
    return sum(hmtx[cmap[ord(character)]][0] for character in text) / units


def font_face(weight: int, path: Path) -> str:
    data = base64.b64encode(path.read_bytes()).decode()
    return (
        f'@font-face{{font-family:"{FAMILY}";font-style:normal;font-weight:{weight};'
        f'src:url(data:font/woff2;base64,{data}) format("woff2");}}'
    )


def main() -> None:
    if len(sys.argv) < 3:
        raise SystemExit(
            "usage: python3 scripts/logo-add-text.py <base.svg> <out.svg> "
            "--x <n> --mount-baseline <n> --soar-baseline <n> --width <n> "
            "--mount-cap <n> --soar-cap <n>"
        )

    base, destination = Path(sys.argv[1]), Path(sys.argv[2])
    flags = parse_flags(sys.argv[3:])
    x = float(flags["x"])
    mount_baseline = float(flags["mount_baseline"])
    soar_baseline = float(flags["soar_baseline"])
    width = float(flags["width"])
    mount_cap = float(flags["mount_cap"])
    soar_cap = float(flags["soar_cap"])

    svg = base.read_text()
    match = re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', svg)
    if match is None:
        raise SystemExit("base SVG has no viewBox")
    base_width, base_height = float(match.group(1)), float(match.group(2))

    # Grow the canvas so the text fits with a small margin.
    new_width = max(base_width, x + width + 8)
    new_height = max(base_height, soar_baseline + 8)
    svg = svg.replace(
        match.group(0), f'viewBox="0 0 {new_width:.0f} {new_height:.0f}"'
    )

    mount_size = mount_cap / cap_em(MOUNT_FONT)
    soar_size = soar_cap / cap_em(SOAR_FONT)
    mount_x = x - lsb_em(MOUNT_FONT, MOUNT_TEXT[0]) * mount_size
    soar_x = x - lsb_em(SOAR_FONT, SOAR_TEXT[0]) * soar_size
    mount_spacing = (width - natural_width_em(MOUNT_FONT, MOUNT_TEXT) * mount_size) / (
        len(MOUNT_TEXT) - 1
    )
    soar_spacing = (width - natural_width_em(SOAR_FONT, SOAR_TEXT) * soar_size) / (
        len(SOAR_TEXT) - 1
    )

    style = "<style>" + font_face(800, MOUNT_FONT) + font_face(500, SOAR_FONT) + "</style>"
    text = (
        f'<text x="{mount_x:.1f}" y="{mount_baseline:.0f}" font-family="{FAMILY}" '
        f'font-weight="800" font-size="{mount_size:.2f}" letter-spacing="{mount_spacing:.2f}" '
        f'fill="{MOUNT_COLOR}">{MOUNT_TEXT}</text>\n'
        f'<text x="{soar_x:.1f}" y="{soar_baseline:.0f}" font-family="{FAMILY}" '
        f'font-weight="500" font-size="{soar_size:.2f}" letter-spacing="{soar_spacing:.2f}" '
        f'fill="{SOAR_COLOR}">{SOAR_TEXT}</text>'
    )

    svg = svg.replace("</svg>", f"{style}\n{text}\n</svg>")
    destination.write_text(svg)

    size_kb = destination.stat().st_size / 1024
    print(
        f"wrote {destination} ({new_width:.0f}x{new_height:.0f}, {size_kb:.0f} KB) — "
        f"MOUNT {mount_size:.1f}px spacing {mount_spacing:.2f}px @ y{mount_baseline:.0f}, "
        f"SOARING {soar_size:.1f}px spacing {soar_spacing:.2f}px @ y{soar_baseline:.0f}"
    )


if __name__ == "__main__":
    main()
