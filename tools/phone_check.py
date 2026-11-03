#!/usr/bin/env python3
"""Measure a phone track against the glass edge on every frame: along each side of the (un-widened) quad, where the
glass is visible (white just inside), find the real glass/bezel edge on the normal (+-12 px) and report the offset.
Writes <out>.csv (frame, median px, max px, samples) and <out>.mp4 (frames with the quad in green), for review.
  python3 tools/phone_check.py <frames dir> <track.json> <out prefix> [--until N]"""
import json, sys, os, subprocess
import cv2, numpy as np
d, tj, out = sys.argv[1:4]
until = int(sys.argv[sys.argv.index('--until') + 1]) if '--until' in sys.argv else None
T = json.load(open(tj)); wd = T.get('widen', 0)
N = len(T['corners']) if until is None else until + 1
rows = []; os.makedirs(out + '_f', exist_ok=True)
for i in range(N):
    f = cv2.imread(os.path.join(d, 't%03d.jpg' % i)); g = cv2.cvtColor(f, cv2.COLOR_BGR2GRAY).astype(np.float32)
    hsv = cv2.cvtColor(f, cv2.COLOR_BGR2HSV); white = (hsv[..., 2] > 200) & (hsv[..., 1] < 50)
    q = np.array(T['corners'][i], float); w = (q[1] - q[0]) / (1 + 2 * wd) * wd
    q[0] += w; q[3] += w; q[1] -= w; q[2] -= w
    c = q.mean(0); offs = []
    for a, b in [(0, 1), (1, 2), (2, 3), (3, 0)]:
        e = q[b] - q[a]; L = np.linalg.norm(e); t = e / L; n = np.array([-t[1], t[0]])
        if np.dot(c - (q[a] + q[b]) / 2, n) < 0: n = -n          # n points inward
        for s in np.linspace(0.12, 0.88, 30):
            p = q[a] + e * s
            ins = (p + n * 6).astype(int)
            if not (0 <= ins[0] < f.shape[1] and 0 <= ins[1] < f.shape[0]) or not white[ins[1], ins[0]]: continue
            prof = []
            for k in range(-12, 13):
                x, y = (p + n * k).astype(int)
                prof.append(g[y, x] if 0 <= x < f.shape[1] and 0 <= y < f.shape[0] else 0)
            gr = np.diff(np.array(prof))                         # dark bezel -> white glass going inward
            offs.append(abs(int(np.argmax(gr)) - 12 + 0.5))
    rows.append((i, float(np.median(offs)) if offs else -1, float(np.max(offs)) if offs else -1, len(offs)))
    qq = np.array(T['corners'][i], float); im = f.copy()
    cv2.polylines(im, [q.astype(np.int32)], True, (0, 255, 0), 1, cv2.LINE_AA)
    cv2.putText(im, '%d  med %.1f  max %.1f px' % rows[-1][:3], (20, 50), 0, 1.2, (0, 255, 255), 2)
    cv2.imwrite(os.path.join(out + '_f', '%03d.jpg' % i), im)
open(out + '.csv', 'w').write('frame,median,max,n\n' + '\n'.join('%d,%.1f,%.1f,%d' % r for r in rows))
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', '24', '-i', out + '_f/%03d.jpg', '-vf', 'scale=iw/2:-2', '-c:v', 'libx264', '-crf', '20', '-pix_fmt', 'yuv420p', out + '.mp4'])
m = [r[1] for r in rows if r[1] >= 0]
print('frames', len(rows), 'median of medians %.1f px, worst frame median %.1f px' % (np.median(m), max(m)))
bad = [r for r in rows if r[1] > 2.5]
print('frames over 2.5 px:', [r[0] for r in bad][:60])
