#!/usr/bin/env python3
"""Snap a phone track to the real glass edges, frame by frame (the way a planar tracker's corner pin is checked against
the plate): for every side of the predicted quad, the glass/bezel edge is found on the normal at 60 points where the glass
is visible, a robust line is fitted, and the corners are the intersections of the four lines. A side hidden by the thumb
keeps its predicted line. Then the quad is widened (track.widen) across the short axis.
  python3 tools/phone_edges.py <frames dir> <in track.json> <out track.json> [--until N] [--widen 0.07]"""
import json, sys, os
import cv2, numpy as np
d, ti, to = sys.argv[1:4]
until = int(sys.argv[sys.argv.index('--until') + 1]) if '--until' in sys.argv else None
widen = float(sys.argv[sys.argv.index('--widen') + 1]) if '--widen' in sys.argv else 0.07
T = json.load(open(ti)); wd0 = T.get('widen', 0)
N = len(T['corners']) if until is None else until + 1
def unwiden(q, wd):
    q = q.copy(); w = (q[1] - q[0]) / (1 + 2 * wd) * wd; q[0] += w; q[3] += w; q[1] -= w; q[2] -= w; return q
def inter(l1, l2):
    (p, t), (r, s) = l1, l2
    A = np.array([t, -s]).T
    k = np.linalg.solve(A, r - p); return p + t * k[0]
stats = []; outc = list(T['corners'])
# --seq REF: a tracker, not a refit: start at the reference frame (corners checked by eye) and walk out both ways, each
# frame predicted from the previous result plus its velocity, then snapped to the edges
seq = int(sys.argv[sys.argv.index('--seq') + 1]) if '--seq' in sys.argv else None
order = list(range(N)) if seq is None else list(range(seq, N)) + list(range(seq - 1, -1, -1))
snapped = {}
for i in order:
    f = cv2.imread(os.path.join(d, 't%03d.jpg' % i)); H, W = f.shape[:2]
    g = cv2.GaussianBlur(cv2.cvtColor(f, cv2.COLOR_BGR2GRAY), (3, 3), 0).astype(np.float32)
    hsv = cv2.cvtColor(f, cv2.COLOR_BGR2HSV); white = (hsv[..., 2] > 195) & (hsv[..., 1] < 55)
    if seq is None or i == seq:
        q = unwiden(np.array(T['corners'][i], float), wd0)
    else:
        st = 1 if i > seq else -1; p1 = snapped[i - st]; p2 = snapped.get(i - 2 * st, p1)
        q = p1 + 0.5 * (p1 - p2)
    c = q.mean(0); lines = []; used = []
    for a, b in [(0, 1), (1, 2), (2, 3), (3, 0)]:
        e = q[b] - q[a]; L = np.linalg.norm(e); t = e / L; n = np.array([-t[1], t[0]])
        if np.dot(c - (q[a] + q[b]) / 2, n) < 0: n = -n
        pts = []
        for s in np.linspace(0.14, 0.86, 60):
            if a == 0 and 0.22 < s < 0.78: continue          # the top side: skip the notch (its lower edge is not the glass edge)
            p = q[a] + e * s
            prof = []; ok = True
            for k in range(-16, 17):
                x, y = (p + n * k).round().astype(int)
                if not (0 <= x < W and 0 <= y < H): ok = False; break
                prof.append(g[y, x])
            if not ok: continue
            gr = np.diff(np.array(prof)); k = int(np.argmax(gr))
            if gr[k] < 18: continue
            edge = p + n * (k - 16 + 0.5)
            x, y = (edge + n * 5).round().astype(int)
            if 0 <= x < W and 0 <= y < H and white[y, x]: pts.append(edge)
        pts = np.array(pts)
        if len(pts) >= 14:
            # RANSAC-like: fit, drop the worst third, refit
            for _ in range(2):
                vx, vy, x0, y0 = cv2.fitLine(pts.astype(np.float32), cv2.DIST_HUBER, 0, 0.01, 0.01).ravel()
                tt = np.array([vx, vy]); nn = np.array([-vy, vx]); r = np.abs((pts - [x0, y0]) @ nn)
                pts = pts[r <= max(1.0, np.percentile(r, 70))] if len(pts) > 20 else pts
            vx, vy, x0, y0 = cv2.fitLine(pts.astype(np.float32), cv2.DIST_HUBER, 0, 0.01, 0.01).ravel()
            lines.append((np.array([x0, y0], float), np.array([vx, vy], float))); used.append(len(pts))
        elif len(pts) >= 4:
            # a side mostly hidden by the thumb: the few visible edge points fix its position, its direction is the
            # predicted one (a short segment cannot be trusted for angle)
            lines.append((np.median(pts, 0), t)); used.append(len(pts))
        else:
            lines.append((q[a].copy(), t)); used.append(0)
    nq = np.array([inter(lines[3], lines[0]), inter(lines[0], lines[1]), inter(lines[1], lines[2]), inter(lines[2], lines[3])])
    if np.abs(nq - q).max() > 30: nq = q; used = [-1] * 4          # a bad fit keeps the prediction
    snapped[i] = nq.copy()
    m = nq.mean(0); nq = (nq - m) * 1.004 + m                          # half a pixel under the bezel, never short of it
    w = nq[1] - nq[0]; wq = nq.copy(); wq[0] -= widen * w; wq[3] -= widen * w; wq[1] += widen * w; wq[2] += widen * w
    outc[i] = [[round(float(x), 2), round(float(y), 2)] for x, y in wq]
    stats.append((i, used, float(np.abs(nq - q).max())))
# the bottom side is mostly under the thumb: its distance from the top (as a ratio of the screen's width, per long side)
# is a smooth quantity, so it is median-filtered over time; the top corners and the two long sides stay per-frame exact
A = np.array(outc[:N], float); wdv = widen
def unw(q):
    q = q.copy(); w = (q[1] - q[0]) / (1 + 2 * wdv) * wdv; q[0] += w; q[3] += w; q[1] -= w; q[2] -= w; return q
U = np.array([unw(q) for q in A]); Wd = np.linalg.norm(U[:, 1] - U[:, 0], axis=1)
rL = np.linalg.norm(U[:, 3] - U[:, 0], axis=1) / Wd; rR = np.linalg.norm(U[:, 2] - U[:, 1], axis=1) / Wd
def filt(r):
    m = np.array([np.median(r[max(0, i - 6):i + 7]) for i in range(N)])
    return np.array([m[max(0, i - 3):i + 4].mean() for i in range(N)])
fL, fR = filt(rL), filt(rR)
for i in range(N):
    q = U[i]; dl = (q[3] - q[0]) / np.linalg.norm(q[3] - q[0]); dr = (q[2] - q[1]) / np.linalg.norm(q[2] - q[1])
    q[3] = q[0] + dl * fL[i] * Wd[i]; q[2] = q[1] + dr * fR[i] * Wd[i]
    w = q[1] - q[0]; q[0] -= wdv * w; q[3] -= wdv * w; q[1] += wdv * w; q[2] += wdv * w; A[i] = q
for i in range(N): outc[i] = A[i].round(2).tolist()
# a single-frame jump of a corner (a bad fit on one frame) is replaced by its neighbours' mean; real motion is kept
for i in range(1, N - 1):
    mid = (A[i - 1] + A[i + 1]) / 2
    if np.linalg.norm(A[i] - mid, axis=1).max() > 3 and np.linalg.norm(A[i - 1] - A[i + 1], axis=1).max() < 6:
        A[i] = mid
for i in range(N): outc[i] = A[i].round(2).tolist()
T['corners'] = outc; T['widen'] = widen
json.dump(T, open(to, 'w'))
print('frames', N, 'sides snapped per frame (of 4):', np.mean([sum(1 for u in s[1] if u > 0) for s in stats]).round(2))
print('largest correction px:', max(s[2] for s in stats))
print('frames with <2 sides snapped:', [s[0] for s in stats if sum(1 for u in s[1] if u > 0) < 2][:40])
