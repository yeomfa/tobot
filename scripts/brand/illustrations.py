"""Turns the chosen Flow originals into the app's illustrations.

    ~/.cache/tobot-brand/venv/bin/python scripts/brand/illustrations.py [name ...]

Needs Pillow, NumPy and SciPy. Each original was drawn on one flat colour —
the banner's navy for the scenes with Tobot, pure white for the spots — so
lifting it off is not guesswork: the background is that colour wherever it
reaches the edge of the image. It becomes transparent with a soft edge, and
the colour it left in the anti-aliased pixels is taken back out, so nothing
keeps a rim of navy or white. A navy visor or a white page inside a drawing
is left alone, since the background never reaches it.

Each result is trimmed to what it shows, scaled to twice the size it is
displayed at, and written as WebP to src/assets/illustrations/<name>.webp.
"""
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
SOURCE = os.path.join(ROOT, "identity", "ilustraciones", "originales")
OUT = os.path.join(ROOT, "src", "assets", "illustrations")

# name: (original, largest width, largest height) — twice the displayed size.
PIECES = {
    "banner-saved": ("banner-saved-navy-v1.png", 900, 420),
    "banner-challenges": ("banner-challenges-navy-v1.png", 900, 420),
    "banner-examples": ("banner-examples-navy-v1.png", 900, 420),
    "banner-concepts": ("banner-concepts-navy-v1.png", 900, 420),
    "landing-step-build": ("landing-step-build-navy-v1.png", 640, 480),
    "landing-step-understand": ("landing-step-understand-navy-v1.png", 640, 480),
    "landing-step-run": ("landing-step-run-navy-v1.png", 640, 480),
    "landing-for-students": ("landing-for-students-navy-v1.png", 720, 440),
    "landing-for-teachers": ("landing-for-teachers-navy-v1.png", 720, 440),
    "landing-closing": ("landing-closing-navy-v1.png", 760, 460),
    "spot-library": ("spot-library-v1.png", 400, 400),
    "spot-editor": ("spot-editor-v1.png", 400, 400),
    "spot-console": ("spot-console-v1.png", 400, 400),
    "spot-flowchart": ("spot-flowchart-v1.png", 400, 400),
    "spot-search": ("spot-search-v1.png", 400, 400),
}

# How far from the background a pixel may be and still be partly background:
# up to SOFT it is gone, from HARD it is all drawing, between them it fades.
SOFT, HARD = 8, 52


def lift(path):
    px = np.asarray(Image.open(path).convert("RGB")).astype(np.float32)
    edge = np.concatenate([px[0], px[-1], px[:, 0], px[:, -1]])
    bg = np.median(edge, axis=0)
    distance = np.abs(px - bg).max(-1)

    # Only background the edge can reach: a navy visor or a white page inside
    # the drawing has the same colour and must stay.
    near = distance < HARD
    labels, _ = ndimage.label(near)
    border = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
    reached = np.isin(labels, border[border > 0])

    alpha = np.ones(distance.shape, np.float32)
    alpha[reached] = np.clip((distance[reached] - SOFT) / (HARD - SOFT), 0, 1)

    # What a half-transparent pixel shows is part drawing, part background;
    # keep only the drawing, so a shadow stays a shadow on any colour.
    a = alpha[..., None]
    rgb = np.where(a > 0.01, (px - (1 - a) * bg) / np.maximum(a, 0.01), 0)
    rgba = np.dstack([np.clip(rgb, 0, 255), alpha * 255]).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA"), bg


def trim(image, pad=0.03):
    alpha = np.asarray(image)[..., 3]
    ys, xs = np.nonzero(alpha > 12)
    p = int(pad * max(image.size))
    box = (max(xs.min() - p, 0), max(ys.min() - p, 0), min(xs.max() + p + 1, image.width), min(ys.max() + p + 1, image.height))
    return image.crop(box)


def main(names):
    os.makedirs(OUT, exist_ok=True)
    for name, (source, max_w, max_h) in PIECES.items():
        if names and name not in names:
            continue
        image, bg = lift(os.path.join(SOURCE, source))
        image = trim(image)
        scale = min(max_w / image.width, max_h / image.height, 1)
        image = image.resize((round(image.width * scale), round(image.height * scale)), Image.LANCZOS)
        out = os.path.join(OUT, name + ".webp")
        image.save(out, "WEBP", quality=86, alpha_quality=90, method=6)
        print(f"{name}.webp  {image.width}×{image.height}  {os.path.getsize(out) // 1024} KB  (background {'#%02X%02X%02X' % tuple(int(v) for v in bg)})")


if __name__ == "__main__":
    main(set(sys.argv[1:]))
