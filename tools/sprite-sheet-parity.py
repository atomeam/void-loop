"""The parity check for void-live-deploy/lib/sprite-sheet.js: runs the original generate2dsprite cleanup (MIT, Copyright (c) 2026 0x0funky) on the
same test sheet tools/sprite-sheet.test.mjs builds, with Pillow's resize set to NEAREST as the port does, and prints the sha256 of each result.
The test holds the port to these hashes. Run: python3 -I tools/sprite-sheet-parity.py (needs Pillow and numpy)."""
import hashlib, importlib.util, pathlib, sys
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "archive/repos/fire-ember-mountain-cabin/.grok/skills/generate2dsprite/scripts/generate2dsprite.py"
spec = importlib.util.spec_from_file_location("g2d", SRC); g = importlib.util.module_from_spec(spec); spec.loader.exec_module(g)
_resize = Image.Image.resize
Image.Image.resize = lambda self, size, resample=None, *a, **k: _resize(self, size, Image.Resampling.NEAREST)


def sheet():
    # the same pixels as testSheet() in tools/sprite-sheet.test.mjs
    W, H, R, C = 256, 128, 2, 4
    img = Image.new("RGBA", (W, H), (255, 0, 255, 255)); px = img.load()
    for r in range(R):
        for c in range(C):
            x0, y0 = c * 64, r * 64
            cx, cy, rad = x0 + 32 + (c * 5 % 11) - 5, y0 + 32 + (r * 7 % 9) - 4, 10 + (r * 4 + c) * 3 % 11
            for y in range(y0, y0 + 64):
                for x in range(x0, x0 + 64):
                    d2 = (x - cx) ** 2 + (y - cy) ** 2
                    if d2 < rad * rad: px[x, y] = (40 + r * 90, 120 + c * 30, 60, 255)
                    elif d2 < (rad + 2) ** 2: px[x, y] = (230, 60, 220, 255)
            px[x0 + 6, y0 + 6] = (200, 200, 30, 255)
            for y in range(y0, y0 + 64): px[x0, y] = (10, 10, 10, 255)
    return img


h = lambda im: hashlib.sha256(im.tobytes()).hexdigest()
img = sheet()
print("input", h(img))
print("keyed", h(g.remove_bg_magenta(img.copy(), 100, 150)))
for mode, align in (("all", "center"), ("largest", "feet")):
    frames, _ = g.split_grid(img.copy(), 2, 4, 48, 100, 150, align=align, component_mode=mode, shared_scale=(mode == "largest"))
    print(mode, h(g.compose_sheet(frames, 2, 4, 48)))
