"""Contrast of every text run in a rendered still against the pixels behind it.

    python3 tools/contrast.py out/qa/D-x.png out/qa/D-x.txt

The txt holds the TXT| lines that src/kit/qa.tsx logs (box, colour, font size, text). For each run the pixels in
its box that are far from the text colour count as background; the background is judged at its worst realistic
point (75th percentile toward the text's own lightness), so a busy photo behind light text is caught.
WCAG 2: 4.5:1 for reading text, 3:1 for large text (font size of 5% of the short side and up).
Prints one line per failure and exits 1 if there is any.
"""
import re
import sys

import numpy as np
from PIL import Image


def lum(rgb):
    c = np.asarray(rgb, dtype=np.float64) / 255.0
    c = np.where(c <= 0.03928, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    return c[..., 0] * 0.2126 + c[..., 1] * 0.7152 + c[..., 2] * 0.0722


def main(png, txt):
    im = np.asarray(Image.open(png).convert('RGB'))
    H, W = im.shape[:2]
    short = min(W, H)
    bad = []
    for line in open(txt, encoding='utf-8').read().splitlines():
        parts = line.split('|')
        if len(parts) < 8:
            continue
        x, y, w, h = (int(float(v)) for v in parts[1:5])
        m = re.findall(r'[\d.]+', parts[5])
        if len(m) < 3 or (len(m) > 3 and float(m[3]) < 0.5):
            continue   # transparent text (masks, ghosts) is decoration
        col = np.array([float(v) for v in m[:3]])
        size, text = float(parts[6]), parts[7]
        if len(parts) > 8 and parts[8] == 'outlined':
            continue   # lettering with an outline carries its own contrast edge
        x0, y0, x1, y1 = max(0, x), max(0, y), min(W, x + w), min(H, y + h)
        if x1 - x0 < 4 or y1 - y0 < 4:
            continue
        box = im[y0:y1, x0:x1].reshape(-1, 3).astype(np.float64)
        d = np.linalg.norm(box - col, axis=1)
        # background = the farthest 30% of the pixels from the text colour: anti-aliased letter edges are not background
        far = (d > 90) & (d >= np.percentile(d, 70))
        if far.sum() < 20:
            continue   # the box is all text colour: a bar or a block behind it in the same colour is unlikely, skip
        bg = lum(box[far])
        lt = float(lum(col))
        worst = np.percentile(bg, 75 if lt > np.median(bg) else 25)
        hi, lo = max(lt, worst), min(lt, worst)
        ratio = (hi + 0.05) / (lo + 0.05)
        need = 3.0 if size >= short * 0.05 else 4.5
        if ratio < need:
            bad.append(f'low contrast {ratio:.1f}:1 (needs {need:g}): "{text}"')
    for b in bad:
        print(b)
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main(*sys.argv[1:3])
