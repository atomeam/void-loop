#!/usr/bin/env python3
"""A paint-by-number template from any image, worked out offline (owner, 2026-10-26: "make sure its a better
version of color by number though").

Real paint-by-number art is flat colour areas with a number in each: this reads an image, quantises it to a
small palette, flood-fills the areas, and writes the template the page paints from, plus a preview of the
"paper" a person starts with (white areas, numbers on them) so the art can be judged before it ships.

  python tools/paint-template.py <image> <out.json> [--name NAME] [--source URL] [--credit TEXT]
                                [--colors 12] [--size 220] [--min-px 120] [--preview out.png]

The template is JSON: the palette as hex, the label per pixel run-length encoded (flat art compresses hard),
and one row per area with the pixel its number is drawn on. No network, no state: the same image always
gives the same template, which is what lets the gate check its counts.
"""
import argparse
import json
import os
import sys
from collections import deque

from PIL import Image, ImageDraw, ImageFilter, ImageFont

PAPER = (252, 251, 247)


def load(path, size, smooth=3, work=110):
    im = Image.open(path).convert("RGB")
    w, h = im.size
    s = min(w, h)  # a square crop of the middle: the page paints a square
    im = im.crop(((w - s) // 2, (h - s) // 2, (w + s) // 2, (h + s) // 2))
    im = im.resize((work, work), Image.LANCZOS)
    for _ in range(smooth):
        im = im.filter(ImageFilter.MedianFilter(3))
    im = im.resize((size, size), Image.NEAREST)  # grow back: areas keep hard edges
    return im


def quantise(im, colors):
    """The palette Pillow picks for this image, as RGB triples and as hex."""
    q = im.convert("P", palette=Image.ADAPTIVE, colors=colors)
    pal = q.getpalette()[: colors * 3]
    rgb = [tuple(pal[i * 3: i * 3 + 3]) for i in range(colors)]
    used = sorted({v for v in q.getdata()})
    return q, rgb, used


def regions_of(labels, w, h, colors, min_px):
    """4-connected areas of one label, with a pixel near the middle of each to draw its number on."""
    seen = bytearray(w * h)
    out = []
    for start in range(w * h):
        if seen[start]:
            continue
        label = labels[start]
        if label >= colors:
            seen[start] = 1
            continue
        q, members, sx, sy = deque([start]), [], 0, 0
        seen[start] = 1
        while q:
            p = q.popleft()
            members.append(p)
            x, y = p % w, p // w
            sx += x
            sy += y
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if 0 <= nx < w and 0 <= ny < h:
                    r = ny * w + nx
                    if not seen[r] and labels[r] == label:
                        seen[r] = 1
                        q.append(r)
        if len(members) < min_px:
            border = {}
            for p in members:
                x, y = p % w, p // w
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h:
                        nl = labels[ny * w + nx]
                        if nl != label:
                            border[nl] = border.get(nl, 0) + 1
            take = max(border, key=border.get) if border else None
            if take is not None and take < colors:
                for p in members:
                    labels[p] = take
            continue
        cx, cy = int(sx / len(members)), int(sy / len(members))
        # the middle may sit in a hole of a bent area: take the member nearest it
        best = min(members, key=lambda p: (p % w - cx) ** 2 + (p // w - cy) ** 2)
        out.append({"c": int(label), "n": len(members), "x": best % w, "y": best // w})
    return out


def rle(labels):
    runs, prev, n = [], None, 0
    for v in labels:
        if v == prev:
            n += 1
        else:
            if prev is not None:
                runs.append([prev, n])
            prev, n = v, 1
    runs.append([prev, n])
    return runs


def preview(rgb, labels, regions, w, h, path, show_numbers=True):
    """The sheet a person starts with: paper, an outline round every area, a number in each."""
    im = Image.new("RGB", (w, h), PAPER)
    d = ImageDraw.Draw(im)
    # the outline: every edge where two areas meet, which is what makes it a colouring sheet
    for y in range(h):
        for x in range(w):
            p = y * w + x
            if x + 1 < w and labels[p] != labels[p + 1]:
                d.point((x, y), fill=(70, 66, 78))
            if y + 1 < h and labels[p] != labels[p + w]:
                d.point((x, y), fill=(70, 66, 78))
    size = max(7, w // 30)
    try:
        font = ImageFont.truetype("arial.ttf", size)
    except Exception:
        font = ImageFont.load_default()
    if show_numbers:
        # a number needs room for its digits to be read: small areas keep their colour, none are numbered
        need = (len(str(len(rgb))) * size * 0.62 + 3) * (size + 3)
        for r in regions:
            if r["n"] < need:
                continue
            d.text((r["x"], r["y"]), str(r["c"] + 1), fill=(46, 42, 54), font=font, anchor="mm")
    im.save(path)
    art = Image.new("RGB", (w, h))
    art.putdata([rgb[v] if v < len(rgb) else PAPER for v in labels])
    art.save(path.replace(".png", "-art.png"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("image")
    ap.add_argument("out")
    ap.add_argument("--name", default="")
    ap.add_argument("--source", default="")
    ap.add_argument("--credit", default="")
    ap.add_argument("--colors", type=int, default=12)
    ap.add_argument("--size", type=int, default=220)
    ap.add_argument("--min-px", type=int, default=120)
    ap.add_argument("--preview", default="")
    a = ap.parse_args()

    im = load(a.image, a.size)
    q, rgb, used = quantise(im, a.colors)
    labels = list(q.getdata())
    regions = regions_of(labels, a.size, a.size, a.colors, a.min_px)
    palette = ["#%02x%02x%02x" % rgb[i] for i in range(len(rgb))]
    paintable = sum(1 for v in labels if v < len(palette))
    tpl = {
        "id": os.path.splitext(os.path.basename(a.out))[0],
        "name": a.name or os.path.splitext(os.path.basename(a.out))[0],
        "source": a.source,
        "credit": a.credit,
        "w": a.size,
        "h": a.size,
        "palette": palette,
        "regions": regions,
        "paintable": paintable,
        "rle": rle(labels),
    }
    with open(a.out, "w", encoding="utf-8") as f:
        json.dump(tpl, f, separators=(",", ":"))
    if a.preview:
        preview(rgb, labels, regions, a.size, a.size, a.preview)
    print("%s: %d colours, %d regions, %d paintable px, %.1f KB"
          % (tpl["id"], len(palette), len(regions), paintable, os.path.getsize(a.out) / 1024))


if __name__ == "__main__":
    sys.exit(main())
