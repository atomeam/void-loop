#!/usr/bin/env python3
"""Write 192 and 512 PNG icons for a sealed install. Hold-gate: do not publish without the tracking issue saying sealed."""
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError as exc:
    raise SystemExit("Pillow is required to write the PNG icons.") from exc

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "icons"
OUT.mkdir(exist_ok=True)


def render(size: int, dest: Path) -> None:
    img = Image.new("RGB", (size, size), (11, 11, 11))
    draw = ImageDraw.Draw(img)
    margin = max(8, size // 16)
    draw.rectangle(
        [margin, margin, size - 1 - margin, size - 1 - margin],
        outline=(212, 160, 23),
        width=max(2, size // 64),
    )
    font = None
    for path in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf",
        "/Library/Fonts/Georgia.ttf",
    ):
        if Path(path).exists():
            font = ImageFont.truetype(path, int(size * 0.52))
            break
    text = "A"
    if font:
        box = draw.textbbox((0, 0), text, font=font)
        tw, th = box[2] - box[0], box[3] - box[1]
        x = (size - tw) / 2 - box[0]
        y = (size - th) / 2 - box[1] - size * 0.02
        draw.text((x, y), text, fill=(236, 232, 223), font=font)
    img.save(dest, "PNG")


if __name__ == "__main__":
    render(192, OUT / "icon-192.png")
    render(512, OUT / "icon-512.png")
    print("wrote", OUT / "icon-192.png")
    print("wrote", OUT / "icon-512.png")
