"""Generate the ELMA Flasher Windows icon used by the portable build."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("output", type=Path)
    arguments = parser.parse_args()
    arguments.output.parent.mkdir(parents=True, exist_ok=True)

    size = 256
    image = Image.new("RGBA", (size, size), "#f7f5ef")
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((8, 8, size - 8, size - 8), radius=52, fill="#ef8b00")
    draw.rounded_rectangle((28, 28, size - 28, size - 28), radius=38, fill="#fffdf8")
    draw.arc((58, 50, 198, 190), 35, 325, fill="#ef8b00", width=18)
    draw.polygon(((177, 51), (211, 72), (175, 87)), fill="#ef8b00")
    try:
        font = ImageFont.truetype("arialbd.ttf", 70)
    except OSError:
        font = ImageFont.load_default()
    label = "E"
    bounds = draw.textbbox((0, 0), label, font=font)
    x = (size - (bounds[2] - bounds[0])) / 2
    y = (size - (bounds[3] - bounds[1])) / 2 - 8
    draw.text((x, y), label, font=font, fill="#2a2926")
    image.save(arguments.output, format="ICO", sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])


if __name__ == "__main__":
    main()
