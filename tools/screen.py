#!/usr/bin/env python3
"""Measure a blank screen inside a take, so real footage can play on it (kit/screen.tsx).

  python3 tools/screen.py <take.mp4> <out prefix> --footage <insert.mp4> [--key blue|green|white] [--at 2.0] [--crop 0.5]

Generate the take with the screen showing one flat glowing colour (a blank blue CRT, a green phone screen): that colour
is the key. Writes <prefix>-mask.png (full-frame matte), <prefix>-rim.png (the bezel recoloured to the room) and prints
the `Screen` object for kit/screen.tsx (box, matrix, rim position) to paste into the film.
  --at     second of the take used for the matte (pick one where nothing crosses the screen)
  --crop   how much of the footage's width shows: the window keeps the screen's own shape and is centred on the footage
Checks that the screen holds still over the whole take (a moving camera would need tracking, which this tool does not do)."""
import json, subprocess, sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

def frame(p, t):
    r = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', p], capture_output=True, text=True)
    w, h = map(int, r.stdout.strip().split(','))
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-ss', str(t), '-i', p, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(h, w, 3).astype(np.int16), w, h

def key(fr, kind):
    r, g, b = fr[..., 0], fr[..., 1], fr[..., 2]
    m = {'blue': (b > 150) & (g > 120) & (b - r > 60), 'green': (g > 150) & (g - r > 60) & (g - b > 40), 'white': (r > 225) & (g > 225) & (b > 225)}[kind]
    m = ndimage.binary_opening(m, iterations=2)
    lab, n = ndimage.label(m)
    if not n: sys.exit(f'no {kind} screen found at this second')
    m = lab == (ndimage.sum(m, lab, range(1, n + 1)).argmax() + 1)
    return ndimage.binary_fill_holes(m)

def corners(m):
    ys, xs = np.nonzero(m); s, d = xs + ys, xs - ys
    return np.array([(xs[s.argmin()], ys[s.argmin()]), (xs[d.argmax()], ys[d.argmax()]), (xs[s.argmax()], ys[s.argmax()]), (xs[d.argmin()], ys[d.argmin()])], float)

def homography(w, h, Q):
    S = np.array([[0, 0], [w, 0], [w, h], [0, h]], float); A, B = [], []
    for (x, y), (u, v) in zip(S, Q):
        A.append([x, y, 1, 0, 0, 0, -u * x, -u * y]); B.append(u); A.append([0, 0, 0, x, y, 1, -v * x, -v * y]); B.append(v)
    H = np.append(np.linalg.solve(np.array(A), np.array(B)), 1).reshape(3, 3)
    m = [H[0, 0], H[1, 0], 0, H[2, 0], H[0, 1], H[1, 1], 0, H[2, 1], 0, 0, 1, 0, H[0, 2], H[1, 2], 0, 1]
    return 'matrix3d(' + ','.join(f'{x:.8g}' for x in m) + ')'

def main(a):
    if len(a) < 2 or '--footage' not in a: sys.exit(__doc__)
    take, prefix = a[0], a[1]
    opt = lambda k, d: a[a.index(k) + 1] if k in a else d
    kind, at, crop = opt('--key', 'blue'), float(opt('--at', 2.0)), float(opt('--crop', 0.5))
    fr, W, H = frame(take, at)
    m = key(fr, kind); Q = corners(m)
    # the screen must hold still: compare the corners at four other moments
    dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', take], capture_output=True, text=True).stdout)
    drift = max(np.abs(corners(key(frame(take, t)[0], kind)) - Q).max() for t in np.linspace(1, dur - 0.5, 4))
    if drift > 4: print(f'warning: the screen moves {drift:.0f} px over the take: a fixed warp will slide; choose a locked-off take')
    md = ndimage.binary_dilation(m, iterations=7)                        # cover the dim inner edge of the glow too
    Image.fromarray((md * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.5)).save(f'{prefix}-mask.png')
    # the bezel lit by the key colour, recoloured to a neutral dark tone of its own brightness
    ring = ndimage.binary_dilation(md, iterations=20) & ~ndimage.binary_erosion(md, iterations=2)
    r, g, b = fr[..., 0].astype(float), fr[..., 1].astype(float), fr[..., 2].astype(float)
    tint = {'blue': b - np.maximum(r, g), 'green': g - np.maximum(r, b), 'white': np.minimum(np.minimum(r, g), b) - 200}[kind]
    alpha = np.array(Image.fromarray((np.clip(tint / 60, 0, 1) * ring * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2))) / 255
    lum = 0.3 * r + 0.55 * g + 0.15 * b
    rgba = np.dstack([np.clip(np.stack([lum * 0.62 + 12, lum * 0.52 + 8, lum * 0.45 + 6], -1), 0, 255), alpha * 255]).astype(np.uint8)
    ys, xs = np.nonzero(alpha > 0.01)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    Image.fromarray(rgba[y0:y1, x0:x1], 'RGBA').save(f'{prefix}-rim.png')
    # the footage window: the screen's own aspect, centred, `crop` of the width at most
    r2 = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', opt('--footage', '')], capture_output=True, text=True)
    fw, fh = map(int, r2.stdout.strip().split(','))
    aspect = (np.linalg.norm(Q[1] - Q[0]) + np.linalg.norm(Q[2] - Q[3])) / (np.linalg.norm(Q[3] - Q[0]) + np.linalg.norm(Q[2] - Q[1]))
    bw = int(min(fw * max(crop, 0.1), fh * aspect * 1.1)); bx = (fw - bw) // 2
    c = Q.mean(0); Qx = c + (Q - c) * 1.13                                # past the matte's edge, which then cuts it
    out = {'src': '<footage under public/>', 'size': [fw, fh], 'box': {'w': bw, 'h': fh, 'x': bx}, 'matrix': homography(bw, fh, Qx),
           'mask': f'{prefix}-mask.png', 'rim': {'src': f'{prefix}-rim.png', 'x': int(x0), 'y': int(y0), 'w': int(x1 - x0), 'h': int(y1 - y0)},
           'length': '<seconds of footage>', 'frame': [W, H]}
    print(json.dumps(out, indent=1))
    print(f'screen corners {Q.astype(int).tolist()}, aspect {aspect:.2f}, drift over the take {drift:.1f} px')

if __name__ == '__main__':
    main(sys.argv[1:])
