#!/usr/bin/env python3
"""Planar track of a phone in a generated take (replaces the white-edge fit of phone_track.py, which guessed the corners
a thumb hides). The screen's four corners are measured once on the frame where the white screen is most fully visible;
every other frame is reached by a homography estimated from features on the phone's body and bezel (skin and the
blank screen are masked out), tracked frame to frame in both directions, with a forward-backward check.
Then the occluder (thumb, notch, bezel over the glass) is cut per frame from the same quad.

  python3 tools/phone_track2.py <frames dir with t###.jpg> <out track.json> [--until N]
writes o###.webp beside the frames and a check sheet <out>.check.jpg"""
import json, sys, glob, os
import cv2, numpy as np

d, out = sys.argv[1], sys.argv[2]
until = int(sys.argv[sys.argv.index('--until') + 1]) if '--until' in sys.argv else None
fs = sorted(glob.glob(os.path.join(d, 't*.jpg')))
if until: fs = fs[:until + 1]
F = [cv2.imread(f) for f in fs]
H_, W_ = F[0].shape[:2]

def white(f):
    hsv = cv2.cvtColor(f, cv2.COLOR_BGR2HSV)
    return ((hsv[..., 2] > 200) & (hsv[..., 1] < 50)).astype(np.uint8)

def skin(f):
    hsv = cv2.cvtColor(f, cv2.COLOR_BGR2HSV)
    return (((hsv[..., 0] < 22) | (hsv[..., 0] > 170)) & (hsv[..., 1] > 55) & (hsv[..., 2] > 60)).astype(np.uint8)

def screen_blob(f):
    m = cv2.morphologyEx(white(f), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    n, lab, st, cen = cv2.connectedComponentsWithStats(m)
    # the screen: a large white blob, not touching the frame border, the most rectangular (area / hull area)
    best, bs = None, 0
    for i in range(1, n):
        x, y, w, h, a = st[i]
        if a < 0.004 * W_ * H_ or x <= 1 or y <= 1 or x + w >= W_ - 1 or y + h >= H_ - 1: continue
        c = (lab == i).astype(np.uint8)
        cs, _ = cv2.findContours(c, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        hull = cv2.convexHull(cs[0]); sol = a / max(1, cv2.contourArea(hull))
        if sol * a > bs: best, bs = (c, hull, a, sol), sol * a
    return best

def quad_of(hull):
    peri = cv2.arcLength(hull, True)
    for e in np.linspace(0.005, 0.08, 60):
        ap = cv2.approxPolyDP(hull, e * peri, True)
        if len(ap) == 4: break
    p = ap.reshape(-1, 2).astype(np.float64)
    if len(p) != 4: return None
    # order TL, TR, BR, BL by the long axis: top = the short edge nearest the notch side (smaller y on average)
    c = p.mean(0); ang = np.arctan2(p[:, 1] - c[1], p[:, 0] - c[0]); p = p[np.argsort(ang)]   # clockwise from left
    # rotate so the first point is the one with the smallest x + y (top-left-ish)
    k = np.argmin(p[:, 0] + p[:, 1]); p = np.roll(p, -k, 0)
    return p

# 1. reference frame: the fullest, most rectangular screen
# the reference corners are read by eye on a zoomed, gridded frame (a thumb always hides part of the glass, so no
# automatic fit is trusted):  --ref 59 --quad x,y,x,y,x,y,x,y  (TL TR BR BL, the glass's inner edge)
ref = int(sys.argv[sys.argv.index('--ref') + 1])
Q = np.array([float(v) for v in sys.argv[sys.argv.index('--quad') + 1].split(',')]).reshape(4, 2)
print('reference frame', ref, Q.tolist())

# 2. homographies frame to frame from features on the phone body (a band around the screen), skin and screen masked
def ring_mask(f, q):
    m = np.zeros(f.shape[:2], np.uint8)
    big = (q - q.mean(0)) * 1.18 + q.mean(0)
    cv2.fillConvexPoly(m, big.astype(np.int32), 1)
    m[skin(f) > 0] = 0
    small = (q - q.mean(0)) * 0.9 + q.mean(0)
    cv2.fillConvexPoly(m, small.astype(np.int32), 0)
    # the screen's own edges (glass against bezel) are the strongest features: keep a thin band inside the glass
    return m

def step(a, b, q):
    ga, gb = cv2.cvtColor(F[a], cv2.COLOR_BGR2GRAY), cv2.cvtColor(F[b], cv2.COLOR_BGR2GRAY)
    m = ring_mask(F[a], q)
    pts = cv2.goodFeaturesToTrack(ga, 400, 0.005, 5, mask=m, blockSize=5)
    if pts is None or len(pts) < 8: return np.eye(3)
    p1, st, _ = cv2.calcOpticalFlowPyrLK(ga, gb, pts, None, winSize=(25, 25), maxLevel=4)
    p0b, st2, _ = cv2.calcOpticalFlowPyrLK(gb, ga, p1, None, winSize=(25, 25), maxLevel=4)
    ok = (st.ravel() == 1) & (st2.ravel() == 1) & (np.linalg.norm((p0b - pts).reshape(-1, 2), axis=1) < 0.8)
    if ok.sum() < 8: return np.eye(3)
    H, inl = cv2.findHomography(pts[ok], p1[ok], cv2.RANSAC, 1.5)
    return H if H is not None else np.eye(3)

def apply(H, q):
    return cv2.perspectiveTransform(q.reshape(-1, 1, 2), H).reshape(-1, 2)

N = len(F); QS = [None] * N; QS[ref] = Q
for i in range(ref, N - 1): QS[i + 1] = apply(step(i, i + 1, QS[i]), QS[i])
for i in range(ref, 0, -1): QS[i - 1] = apply(step(i, i - 1, QS[i]), QS[i])

# 3. light temporal smoothing (the generated video wobbles by a pixel; the hand's motion is slow)
A = np.array(QS); S = A.copy()
for i in range(N):
    lo, hi = max(0, i - 1), min(N, i + 2); S[i] = A[lo:hi].mean(0)

# 4. occluder: everything inside the glass that is not the white screen (thumb, notch), soft-edged
for i, f in enumerate(F):
    m = np.zeros((H_, W_), np.uint8)
    cv2.fillConvexPoly(m, ((S[i] - S[i].mean(0)) * 1.012 + S[i].mean(0)).astype(np.int32), 255)
    scr = cv2.morphologyEx(white(f) * 255, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    occ = cv2.bitwise_and(m, cv2.bitwise_not(scr))
    occ = cv2.morphologyEx(occ, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    occ = cv2.GaussianBlur(occ, (3, 3), 0)
    # outside the glass nothing is drawn by the UI, so the occluder there is not needed
    rgba = np.dstack([f[..., 2], f[..., 1], f[..., 0], occ]); rgba[occ == 0] = 0
    cv2.imwrite(os.path.join(d, 'o%03d.webp' % i), cv2.cvtColor(rgba, cv2.COLOR_RGBA2BGRA), [cv2.IMWRITE_WEBP_QUALITY, 101])

json.dump({'fps': 24.0, 'size': [W_, H_], 'corners': [[[round(float(x), 1), round(float(y), 1)] for x, y in q] for q in S]}, open(out, 'w'))

# 5. check sheet: 16 frames with the quad
idx = np.linspace(0, N - 1, 16).astype(int); tiles = []
for i in idx:
    im = F[i].copy(); cv2.polylines(im, [S[i].astype(np.int32)], True, (0, 255, 0), 3)
    cv2.putText(im, str(i), (20, 60), cv2.FONT_HERSHEY_SIMPLEX, 2, (0, 255, 255), 4)
    tiles.append(cv2.resize(im, (W_ // 4, H_ // 4)))
rows = [np.hstack(tiles[r * 4:r * 4 + 4]) for r in range(4)]
cv2.imwrite(out.replace('.json', '.check.jpg'), np.vstack(rows))
print('done', N)
