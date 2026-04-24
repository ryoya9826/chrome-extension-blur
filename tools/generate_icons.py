"""Generate PNG icons for the Blur Focus chrome extension.

Run with:
    uv run --with pillow tools/generate_icons.py
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "icons"
SIZES = (16, 48, 128)

# Brand palette: deep blue body + soft accent.
BG_COLOR = (0, 123, 255, 255)   # bootstrap primary blue
EYE_COLOR = (255, 255, 255, 255)
PUPIL_COLOR = (33, 37, 41, 255)


def draw_icon(size: int) -> Image.Image:
    """Create a square 'blurred eye' app icon at the requested size.

    The icon is rendered in a doubled internal canvas then downsampled to
    keep edges crisp regardless of target size.
    """
    s = size * 4
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    radius = int(s * 0.22)
    draw.rounded_rectangle((0, 0, s - 1, s - 1), radius=radius, fill=BG_COLOR)

    eye_w = int(s * 0.7)
    eye_h = int(s * 0.45)
    eye_x = (s - eye_w) // 2
    eye_y = (s - eye_h) // 2
    draw.ellipse((eye_x, eye_y, eye_x + eye_w, eye_y + eye_h), fill=EYE_COLOR)

    pupil_d = int(s * 0.22)
    pupil_x = (s - pupil_d) // 2
    pupil_y = (s - pupil_d) // 2
    draw.ellipse(
        (pupil_x, pupil_y, pupil_x + pupil_d, pupil_y + pupil_d), fill=PUPIL_COLOR
    )

    blur = img.filter(ImageFilter.GaussianBlur(radius=max(1, s // 64)))
    return blur.resize((size, size), Image.LANCZOS)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for size in SIZES:
        path = OUT_DIR / f"icon{size}.png"
        draw_icon(size).save(path, format="PNG")
        print(f"wrote {path}")


if __name__ == "__main__":
    main()
