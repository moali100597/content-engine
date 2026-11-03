#!/usr/bin/env python3
"""Make a generated photo read as a photograph: generated skin is too smooth and too evenly lit ("plastic").
Usage: python3 tools/photo.py <in> <out> [--grain 0.028] [--texture 0.3] [--seed 3]
What it does, in this order:
  1. texture: a fine high-pass (radius ~1.2 px) is boosted, which brings back pores, stubble and fabric weave;
  2. local contrast: a wide high-pass (radius ~1.5% of the short side) adds the light falloff real lenses have;
  3. highlight roll-off: the shiny highlights on skin are pulled down a little (soft knee above 0.82);
  4. grain: luminance-only film grain, stronger in the mid-tones, slightly clumped (two noise sizes)."""
import sys
import numpy as np
from PIL import Image, ImageFilter

def arg(name, default):
    return type(default)(sys.argv[sys.argv.index(name) + 1]) if name in sys.argv else default

def main(src, dst):
    im = Image.open(src).convert('RGB')
    a = np.asarray(im, np.float32) / 255
    short = min(im.size)
    blur = lambda r: np.asarray(im.filter(ImageFilter.GaussianBlur(r)), np.float32) / 255
    fine, wide = blur(1.2), blur(short * 0.015)
    a = a + (a - fine) * arg('--texture', 0.3)
    a = a + (a - wide) * 0.1
    l = a.mean(axis=2, keepdims=True)
    knee = 0.82
    over = np.clip(l - knee, 0, None)
    a = a - over * 0.35
    rng = np.random.default_rng(arg('--seed', 3))
    h, w = a.shape[:2]
    g = rng.normal(0, 1, (h, w)).astype(np.float32)
    g2 = np.asarray(Image.fromarray(rng.normal(128, 40, (h // 2, w // 2)).clip(0, 255).astype(np.uint8)).resize((w, h), Image.BILINEAR), np.float32) / 40 - 3.2
    g = (g * 0.7 + g2 * 0.3)[..., None]
    mid = 1 - np.abs(np.clip(l, 0, 1) - 0.5) * 1.4
    a = a + g * arg('--grain', 0.028) * np.clip(mid, 0.25, 1)
    Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)).save(dst, quality=95)
    print(f'{src} -> {dst}')

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print(__doc__); sys.exit(1)
    main(sys.argv[1], sys.argv[2])
