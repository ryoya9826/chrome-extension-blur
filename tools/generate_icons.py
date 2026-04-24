"""Generate cute kawaii-style PNG icons for the Blur Focus chrome extension.

Run with:
    uv run --with pillow tools/generate_icons.py

Design:
    - Soft peach rounded square background (friendly, not aggressive)
    - White round face (high contrast, reads well at 16px)
    - Two closed-eye crescents (^ ^) — evokes "hidden / blurred"
    - Pink cheek dots and a tiny smile for kawaii vibe
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "icons"
SIZES = (16, 48, 128)

BG_COLOR = (255, 184, 192, 255)      # soft peach pink
FACE_COLOR = (255, 252, 245, 255)    # warm off-white
LINE_COLOR = (74, 60, 75, 255)       # warm dark brown
CHEEK_COLOR = (255, 145, 175, 220)   # rosy pink with slight transparency


def draw_icon(size: int) -> Image.Image:
    """Render the icon at 4x then downsample for crisp anti-aliased edges."""
    s = size * 4
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    radius = int(s * 0.26)
    draw.rounded_rectangle((0, 0, s - 1, s - 1), radius=radius, fill=BG_COLOR)

    face_d = int(s * 0.74)
    face_x = (s - face_d) // 2
    face_y = (s - face_d) // 2
    draw.ellipse(
        (face_x, face_y, face_x + face_d, face_y + face_d), fill=FACE_COLOR
    )

    # Closed crescent eyes "^ ^" — drawn as bottom half of an ellipse arc.
    eye_w = int(s * 0.16)
    eye_h = int(s * 0.13)
    eye_y = int(s * 0.40)
    line_thick = max(2, int(s * 0.035))

    left_eye_x = int(s * 0.30)
    right_eye_x = s - left_eye_x - eye_w
    for ex in (left_eye_x, right_eye_x):
        draw.arc(
            (ex, eye_y, ex + eye_w, eye_y + eye_h),
            start=180, end=360,
            fill=LINE_COLOR, width=line_thick,
        )

    # Pink cheeks
    cheek_d = int(s * 0.10)
    cheek_y = int(s * 0.58)
    for cx in (int(s * 0.24), int(s * 0.66)):
        draw.ellipse(
            (cx, cheek_y, cx + cheek_d, cheek_y + cheek_d),
            fill=CHEEK_COLOR,
        )

    # Tiny smile
    smile_w = int(s * 0.14)
    smile_h = int(s * 0.08)
    smile_x = (s - smile_w) // 2
    smile_y = int(s * 0.60)
    draw.arc(
        (smile_x, smile_y, smile_x + smile_w, smile_y + smile_h),
        start=0, end=180,
        fill=LINE_COLOR, width=line_thick,
    )

    return img.resize((size, size), Image.LANCZOS)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for size in SIZES:
        path = OUT_DIR / f"icon{size}.png"
        draw_icon(size).save(path, format="PNG")
        print(f"wrote {path}")


if __name__ == "__main__":
    main()
