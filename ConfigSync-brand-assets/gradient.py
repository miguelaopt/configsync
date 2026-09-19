"""
Regenerates the app's background light at any size:

    python3 ConfigSync-brand-assets/gradient.py 3840 2160 out.png

The numbers below were fitted against the original gradient.png (mean error 2.3/255, under 1%),
so this reproduces that artwork at any resolution instead of upscaling it. Needs numpy + Pillow.
"""

import numpy as np, sys
from PIL import Image

W, H, out = int(sys.argv[1]), int(sys.argv[2]), sys.argv[3]
x = np.linspace(0,1,W)[None,:]; y = np.linspace(0,1,H)[:,None]
hexc = lambda h: np.array([int(h.lstrip('#')[i:i+2],16) for i in (0,2,4)], float)

def bloom(cx, cy, rx, ry, color, strength, angle=0.0):
    a = np.radians(angle); dx = x-cx; dy = y-cy
    xr = dx*np.cos(a)-dy*np.sin(a); yr = dx*np.sin(a)+dy*np.cos(a)
    return (np.exp(-((xr/rx)**2+(yr/ry)**2)*2.2)*strength)[...,None]*color

# Base: diagonal ramp, brightest top-left, darkest bottom-right.
t = np.clip(0.5288*x + 0.4891*y, 0, 1)[...,None]
img = hexc('#161f3f')*(1-t) + hexc('#0a1021')*t
# Cool wash spilling in from the top.
img += bloom(0.30, -0.04, 0.2651, 0.2191, hexc('#2f4a9e'), 0.2344)
img += bloom(0.62, -0.10, 0.34,   0.18,   hexc('#22356f'), 0.1906)
# Violet streak out of the bottom-left corner: small hot core inside a wider halo.
img += bloom(0.075, 0.855, 0.0675, 0.1229, hexc('#4428e8'), 0.3177, angle=-18)
img += bloom(0.075, 0.855, 0.1372, 0.2871, hexc('#2b1c9a'), 0.3945, angle=-18)

img = np.clip(img, 0, 255)
# One LSB of noise: an 8-bit gradient this smooth bands visibly on a big screen without it.
img = np.clip(img + np.random.default_rng(7).normal(0, 0.9, img.shape), 0, 255)
Image.fromarray(img.astype(np.uint8)).save(out)
print('wrote', out, W, 'x', H)
