#!/usr/bin/env python3
"""Refine a phone track: every frame is aligned DIRECTLY to the reference frame (no drift from chaining), by ECC on the
phone's bezel and glass edge with the hand masked out, then the quad is widened across the short axis so no white of the
blank screen survives at the long sides; the occluder is rebuilt without the light fringe around the white glass.
  python3 tools/phone_refine.py <frames dir> <track.json> <ref> [--until N] [--widen 0.07]"""
import json, sys, os
import cv2, numpy as np
d, tj, ref = sys.argv[1], sys.argv[2], int(sys.argv[3])
until = int(sys.argv[sys.argv.index('--until') + 1]) if '--until' in sys.argv else None
widen = float(sys.argv[sys.argv.index('--widen') + 1]) if '--widen' in sys.argv else 0.07
T = json.load(open(tj)); C = [np.array(c, np.float64) for c in T['corners']]
N = len(C) if until is None else until + 1
F = lambda i: cv2.imread(os.path.join(d, 't%03d.jpg' % i))
def hsvm(f):
    h = cv2.cvtColor(f, cv2.COLOR_BGR2HSV); return h
def white(f):
    h = hsvm(f); return ((h[..., 2] > 200) & (h[..., 1] < 50)).astype(np.uint8)
def skin(f):
    h = hsvm(f); return (((h[..., 0] < 22) | (h[..., 0] > 170)) & (h[..., 1] > 55) & (h[..., 2] > 60)).astype(np.uint8)
R = F(ref); Q0 = C[ref]
# work in a crop around everywhere the phone goes, at half size (ECC on full frames is far too slow)
allq = np.vstack(C[:N]); cx0, cy0 = np.maximum(0, allq.min(0) - 120).astype(int); cx1, cy1 = (allq.max(0) + 120).astype(int)
K = 0.5
def prep(f): return cv2.GaussianBlur(cv2.cvtColor(cv2.resize(f[cy0:cy1, cx0:cx1], None, fx=K, fy=K, interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2GRAY), (3, 3), 0).astype(np.float32)
def toC(q): return ((q - [cx0, cy0]) * K).astype(np.float32)
def fromC(q): return q / K + [cx0, cy0]
g0 = prep(R)
m0 = np.zeros(g0.shape, np.uint8)
cv2.fillConvexPoly(m0, ((toC(Q0) - toC(Q0).mean(0)) * 1.25 + toC(Q0).mean(0)).astype(np.int32), 255)
sk = cv2.resize(cv2.dilate(skin(R), np.ones((9, 9), np.uint8))[cy0:cy1, cx0:cx1], (g0.shape[1], g0.shape[0]), interpolation=cv2.INTER_NEAREST)
m0[sk > 0] = 0
def leak(f, q):
    m = np.zeros(f.shape[:2], np.uint8); cv2.fillConvexPoly(m, q.astype(np.int32), 1)
    w = white(f); return int(((w > 0) & (m == 0) & (cv2.dilate(m, np.ones((41, 41), np.uint8)) > 0)).sum())
crit = (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 40, 1e-4)
out = [c.copy() for c in C]; before = after = 0
for i in range(N):
    g = prep(F(i))
    Hinit = cv2.getPerspectiveTransform(toC(Q0), toC(C[i])).astype(np.float32)
    try:
        _, H = cv2.findTransformECC(g0, g, Hinit.copy(), cv2.MOTION_HOMOGRAPHY, crit, m0, 3)
        q = fromC(cv2.perspectiveTransform(toC(Q0).reshape(-1, 1, 2), H).reshape(-1, 2).astype(np.float64))
        if np.abs(q - C[i]).max() > 25: q = C[i]   # a failed alignment keeps the planar track
    except cv2.error:
        q = C[i]
    out[i] = q
# no temporal smoothing: each frame is aligned to the reference on its own; smoothing makes the screen lag a moving phone
S = np.array(out)
for i in range(N):
    q = S[i]; w = q[1] - q[0]
    q = q.copy(); q[0] -= widen * w; q[3] -= widen * w; q[1] += widen * w; q[2] += widen * w
    f = F(i); out[i] = q
    # occluder: inside the quad, everything that is not glass; the light fringe around the white glass is glass too
    m = np.zeros(f.shape[:2], np.uint8); cv2.fillConvexPoly(m, ((q - q.mean(0)) * 1.012 + q.mean(0)).astype(np.int32), 255)
    h = hsvm(f); wm = white(f)
    fringe = (cv2.dilate(wm, np.ones((7, 7), np.uint8)) > 0) & (h[..., 1] < 70) & (h[..., 2] > 110)
    glass = ((wm > 0) | fringe).astype(np.uint8) * 255
    glass = cv2.morphologyEx(glass, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    occ = cv2.bitwise_and(m, cv2.bitwise_not(glass))
    occ = cv2.morphologyEx(occ, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)); occ = cv2.GaussianBlur(occ, (3, 3), 0)
    rgba = np.dstack([f[..., 0], f[..., 1], f[..., 2], occ]); rgba[occ == 0] = 0
    cv2.imwrite(os.path.join(d, 'o%03d.webp' % i), rgba, [cv2.IMWRITE_WEBP_QUALITY, 101])
T['widen'] = widen
T['corners'] = [[[round(float(x), 1), round(float(y), 1)] for x, y in c] for c in out]
json.dump(T, open(tj, 'w'))
print('refined', N)
