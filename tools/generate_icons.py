"""Generate PNG icons for the Blur Focus chrome extension by cropping the
Gemini-generated reference figure in `fig/`.

Run with:
    uv run --with pillow tools/generate_icons.py

Strategy:
    1. Open the source figure (multi-icon mock-up).
    2. Crop a tight square region around the bottom-row 128x128 puzzle
       artwork (the cleaner / less-blurred version in the figure).
    3. Optionally place it on a soft pastel rounded-square background so
       the icon reads well in the Chrome toolbar (the original puzzle has
       transparent/white edges that disappear against light themes).
    4. Resize with LANCZOS to 128 / 48 / 16 px and write to `icons/`.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "fig" / "Gemini_Generated_Image_69xcub69xcub69xc.png"
OUT_DIR = ROOT / "icons"
SIZES = (16, 48, 128)

# Crop box (left, top, right, bottom) in source pixel coordinates.
# Determined interactively via tools/crop_preview.py — covers the
# bottom-left 128x128 puzzle artwork from the reference figure.
CROP_BOX = (290, 1010, 620, 1340)

# Background plate so small icons stay visible on light/dark Chrome themes.
USE_BACKDROP = True
BACKDROP_COLOR = (255, 255, 255, 255)  # crisp white plate
BACKDROP_RADIUS_RATIO = 0.20  # corner radius as fraction of icon size


def render_base() -> Image.Image:
    """Return the cropped puzzle artwork as a square RGBA image."""
    src = Image.open(SRC).convert("RGBA")
    crop = src.crop(CROP_BOX)
    side = max(crop.size)
    if crop.size != (side, side):
        # Pad to a perfect square so resizing keeps proportions.
        square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
        offset = ((side - crop.size[0]) // 2, (side - crop.size[1]) // 2)
        square.paste(crop, offset)
        crop = square
    return crop


def make_icon(base: Image.Image, size: int) -> Image.Image:
    """Resize `base` to `size`x`size` and optionally place on a soft plate."""
    # Render at a higher internal resolution for crispness, then downsample.
    work_size = size * 4
    puzzle = base.resize((work_size, work_size), Image.LANCZOS)

    if not USE_BACKDROP:
        return puzzle.resize((size, size), Image.LANCZOS)

    canvas = Image.new("RGBA", (work_size, work_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    radius = int(work_size * BACKDROP_RADIUS_RATIO)
    draw.rounded_rectangle(
        (0, 0, work_size - 1, work_size - 1),
        radius=radius,
        fill=BACKDROP_COLOR,
    )

    # Inset puzzle slightly so the rounded corners breathe.
    inset = int(work_size * 0.04)
    inner = puzzle.resize(
        (work_size - inset * 2, work_size - inset * 2), Image.LANCZOS
    )
    canvas.alpha_composite(inner, dest=(inset, inset))

    return canvas.resize((size, size), Image.LANCZOS)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    base = render_base()
    print(f"cropped base: {base.size}")
    for size in SIZES:
        path = OUT_DIR / f"icon{size}.png"
        make_icon(base, size).save(path, format="PNG")
        print(f"wrote {path}")


if __name__ == "__main__":
    main()
