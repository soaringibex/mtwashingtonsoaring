#!/usr/bin/env python3
"""Compose the final logo SVG: traced illustration + replacement glider + text.

Usage:
  python3 scripts/logo-add-text.py <base.svg> <out.svg> \
      --x 1105 --mount-baseline 326 --soar-baseline 396 --width 987 \
      --mount-cap 67 --soar-cap 46 \
      --glider <glider.svg> --glider-x 851 --glider-y -42 --glider-width 560 \
      --glider-ink 0,3.8,1279.5,631.5 --pad-top 60

- The base SVG comes from tracing the text-and-glider-free artwork with
  scripts/make-logo-svg.py.
- Both text lines are justified to --width; the woff2 subsets in
  scripts/logo-fonts are embedded so the wordmark renders identically
  everywhere, including inside an <img>.
- --glider places the replacement glider's own vector paths (navy fill),
  fitted so its ink box (--glider-ink in the glider file's viewBox units)
  lands at (--glider-x, --glider-y) with the given width. --pad-top extends
  the canvas upwards for artwork that rises above the traced illustration.
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
SOAR_COLOR = "#a9d1f2"  # the top wave's light blue


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


def glider_group(flags: dict[str, str]) -> str:
    """The replacement glider's vector paths, fitted and recoloured."""
    source = Path(flags["glider"])
    svg = source.read_text()
    inner = re.search(r"<g[^>]*>.*</g>", svg, re.S)
    if inner is None:
        raise SystemExit(f"no <g> found in {source}")
    inner = inner.group(0).replace('fill="#000000"', f'fill="{MOUNT_COLOR}"')

    ink_x, ink_y, ink_w, ink_h = (float(v) for v in flags["glider_ink"].split(","))
    target_x = float(flags["glider_x"])
    target_y = float(flags["glider_y"])
    target_w = float(flags["glider_width"])
    scale = target_w / ink_w
    translate_x = target_x - ink_x * scale
    translate_y = target_y - ink_y * scale
    print(
        f"glider: ink {ink_w:.0f}x{ink_h:.0f} -> {target_w:.0f}px "
        f"(scale {scale:.4f}) at ({target_x:.0f},{target_y:.0f})"
    )
    return f'<g transform="translate({translate_x:.2f} {translate_y:.2f}) scale({scale:.6f})">{inner}</g>'


def main() -> None:
    if len(sys.argv) < 3:
        raise SystemExit(
            "usage: python3 scripts/logo-add-text.py <base.svg> <out.svg> "
            "--x <n> --mount-baseline <n> --soar-baseline <n> --width <n> "
            "--mount-cap <n> --soar-cap <n> [glider flags]"
        )

    base, destination = Path(sys.argv[1]), Path(sys.argv[2])
    flags = parse_flags(sys.argv[3:])
    x = float(flags["x"])
    mount_baseline = float(flags["mount_baseline"])
    soar_baseline = float(flags["soar_baseline"])
    width = float(flags["width"])
    mount_cap = float(flags["mount_cap"])
    soar_cap = float(flags["soar_cap"])
    mount_color = flags.get("mount_color", MOUNT_COLOR)
    soar_color = flags.get("soar_color", SOAR_COLOR)
    pad_top = float(flags.get("pad_top", "0"))

    svg = base.read_text()
    match = re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', svg)
    if match is None:
        raise SystemExit("base SVG has no viewBox")
    base_width, base_height = float(match.group(1)), float(match.group(2))

    # Grow the canvas so the text and the glider fit with a small margin.
    new_width = max(base_width, x + width + 8)
    new_height = max(base_height, soar_baseline + 8) + pad_top
    svg = svg.replace(
        match.group(0),
        f'viewBox="0 {-pad_top:.0f} {new_width:.0f} {new_height:.0f}"',
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
        f'fill="{mount_color}">{MOUNT_TEXT}</text>\n'
        f'<text x="{soar_x:.1f}" y="{soar_baseline:.0f}" font-family="{FAMILY}" '
        f'font-weight="500" font-size="{soar_size:.2f}" letter-spacing="{soar_spacing:.2f}" '
        f'fill="{soar_color}">{SOAR_TEXT}</text>'
    )

    glider = glider_group(flags) if "glider" in flags else ""
    svg = svg.replace("</svg>", f"{glider}\n{style}\n{text}\n</svg>")
    destination.write_text(svg)

    size_kb = destination.stat().st_size / 1024
    print(
        f"wrote {destination} ({new_width:.0f}x{new_height:.0f}, {size_kb:.0f} KB) — "
        f"MOUNT {mount_size:.1f}px @ y{mount_baseline:.0f}, "
        f"SOARING {soar_size:.1f}px spacing {soar_spacing:.2f}px @ y{soar_baseline:.0f}"
    )


if __name__ == "__main__":
    main()
