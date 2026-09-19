"""
Builds the app's background from backdrop-ribbon.png.

    python3 ConfigSync-brand-assets/backdrop.py

The ribbon art is light painted on black, so it is *added* over a navy base rather than used
on its own: the ribbon keeps its curve, and everywhere it is dark the navy shows through. That
keeps the top of the rail from going black and keeps the app in the same family as the landing.

Writes both derivatives the app serves:
    public/brand/gradient.webp       3840x2160, sharp  -> the navigation rail
    public/brand/gradient-blur.webp  1920x1080, blurred -> behind the page content

Needs numpy + Pillow.
"""

import numpy as np
from PIL import Image, ImageFilter

W, H = 3840, 2160
RIBBON = "ConfigSync-brand-assets/backdrop-ribbon.png"

x = np.linspace(0, 1, W)[None, :]
y = np.linspace(0, 1, H)[:, None]
hexc = lambda h: np.array([int(h.lstrip("#")[i : i + 2], 16) for i in (0, 2, 4)], float)


def bloom(cx, cy, rx, ry, color, strength):
    d2 = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
    return (np.exp(-d2 * 2.2) * strength)[..., None] * color


# The navy the app sat on before the ribbon: a diagonal ramp plus a cool wash off the top edge.
t = np.clip(0.5288 * x + 0.4891 * y, 0, 1)[..., None]
base = hexc("#161f3f") * (1 - t) + hexc("#0a1021") * t
base += bloom(0.30, -0.04, 0.2651, 0.2191, hexc("#2f4a9e"), 0.2344)
base += bloom(0.62, -0.10, 0.34, 0.18, hexc("#22356f"), 0.1906)

ribbon = np.asarray(
    Image.open(RIBBON).convert("RGB").resize((W, H), Image.LANCZOS)
).astype(float)

# 0.88 keeps the brightest part of the curve just under clipping once the navy is under it.
img = np.clip(base + ribbon * 0.88, 0, 255)
# One LSB of noise: a gradient this smooth bands visibly on a large screen without it.
img = np.clip(img + np.random.default_rng(7).normal(0, 0.9, img.shape), 0, 255)

full = Image.fromarray(img.astype(np.uint8))
full.save("public/brand/gradient.webp", "WEBP", quality=90, method=6)
full.resize((1920, 1080), Image.LANCZOS).filter(ImageFilter.GaussianBlur(26)).save(
    "public/brand/gradient-blur.webp", "WEBP", quality=88, method=6
)
print("wrote both derivatives; peak channel", img.max(axis=(0, 1)).astype(int))
