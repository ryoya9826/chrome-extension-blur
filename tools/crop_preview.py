"""Crop preview helper.

Crops a region of the source figure and writes it to a small preview file
so we can iterate on the coordinates visually.
"""

from pathlib import Path
import sys

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "fig" / "Gemini_Generated_Image_69xcub69xcub69xc.png"


def main(left: int, top: int, right: int, bottom: int):
    img = Image.open(SRC)
    print("source size:", img.size)
    crop = img.crop((left, top, right, bottom))
    print("crop size:", crop.size)

    out = ROOT / "fig" / "preview.png"
    crop.thumbnail((400, 400), Image.LANCZOS)
    crop.save(out, format="PNG")
    print(f"wrote preview {out}")


if __name__ == "__main__":
    args = list(map(int, sys.argv[1:5]))
    main(*args)
