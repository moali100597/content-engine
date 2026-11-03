#!/usr/bin/env python3
"""Solve the phone's screen as a real 3D rectangle seen by one camera (what a 3D camera tracker / Mocha's solve does), so
the screen can never take an impossible shape: a pose per frame (6 numbers) for a rectangle of fixed aspect, with one
focal length for the whole take, fitted to the glass-edge points of every visible side (robust least squares).
  python3 tools/phone_pose.py <frames dir> <in track.json> <out track.json> [--until N] [--widen 0.07]"""
import json, sys, os
import cv2, numpy as np
from scipy.optimize import least_squares
d, ti, to = sys.argv[1:4]
until = int(sys.argv[sys.argv.index('--until') + 1]) if '--until' in sys.argv else None
widen = float(sys.argv[sys.argv.index('--widen') + 1]) if '--widen' in sys.argv else 0.07
T = json.load(open(ti)); wd0 = T.get('widen', 0); W, H = T['size']
N = len(T['corners']) if until is None else until + 1
def unwiden(q, wd):
    q = q.copy(); w = (q[1] - q[0]) / (1 + 2 * wd) * wd; q[0] += w; q[3] += w; q[1] -= w; q[2] -= w; return q
Q = [unwiden(np.array(c, float), wd0) for c in T['corners'][:N]]

def edge_points(f, q):
    g = cv2.GaussianBlur(cv2.cvtColor(f, cv2.COLOR_BGR2GRAY), (3, 3), 0).astype(np.float32)
    hsv = cv2.cvtColor(f, cv2.COLOR_BGR2HSV); white = (hsv[..., 2] > 195) & (hsv[..., 1] < 55)
    c = q.mean(0); sides = []
    for a, b in [(0, 1), (1, 2), (2, 3), (3, 0)]:
        e = q[b] - q[a]; t = e / np.linalg.norm(e); n = np.array([-t[1], t[0]])
        if np.dot(c - (q[a] + q[b]) / 2, n) < 0: n = -n
        pts = []
        for s in np.linspace(0.12, 0.88, 70):
            if a == 0 and 0.22 < s < 0.78: continue
            p = q[a] + e * s; prof = []; ok = True
            for k in range(-14, 15):
                x, y = (p + n * k).round().astype(int)
                if not (0 <= x < W and 0 <= y < H): ok = False; break
                prof.append(g[y, x])
            if not ok: continue
            gr = np.diff(np.array(prof)); k = int(np.argmax(gr))
            if gr[k] < 18: continue
            edge = p + n * (k - 14 + 0.5); x, y = (edge + n * 5).round().astype(int)
            if 0 <= x < W and 0 <= y < H and white[y, x]: pts.append(edge)
        sides.append(np.array(pts).reshape(-1, 2))
    return sides

def K(fl): return np.array([[fl, 0, W / 2], [0, fl, H / 2], [0, 0, 1]], float)
def model(A): return np.array([[0, 0, 0], [1, 0, 0], [1, A, 0], [0, A, 0]], float)
def project(rv, tv, fl, A):
    p, _ = cv2.projectPoints(model(A), rv, tv, K(fl), None); return p.reshape(-1, 2)
def pnp(q, fl, A):
    ok, rv, tv = cv2.solvePnP(model(A), q.astype(np.float64), K(fl), None, flags=cv2.SOLVEPNP_IPPE)
    return rv.ravel(), tv.ravel()

# 1. focal length and aspect from the frames whose four corners are trusted (all sides snapped before)
good = list(range(0, N, max(1, N // 40)))
best = None
for fl in np.linspace(0.6, 3.0, 25) * max(W, H):
    for A in ([float(sys.argv[sys.argv.index('--aspect') + 1])] if '--aspect' in sys.argv else np.linspace(1.8, 2.9, 45)):
        err = 0
        for i in good:
            rv, tv = pnp(Q[i], fl, A); err += np.abs(project(rv, tv, fl, A) - Q[i]).sum()
        if best is None or err < best[0]: best = (err, fl, A)
_, FL, AS = best
print('focal %.0f px, screen aspect %.3f, mean corner error %.2f px' % (FL, AS, best[0] / len(good) / 8))

# 2. per frame: pose from the current corners, refined on the edge points of every visible side
def lines_of(q):
    out = []
    for a, b in [(0, 1), (1, 2), (2, 3), (3, 0)]:
        e = q[b] - q[a]; t = e / np.linalg.norm(e); out.append((q[a], np.array([-t[1], t[0]])))
    return out
res = []; outc = list(T['corners'])
def solve(i, init):
    f = cv2.imread(os.path.join(d, 't%03d.jpg' % i)); sides = edge_points(f, init)
    rv, tv = pnp(init, FL, AS)
    def r(x):
        q = project(x[:3], x[3:], FL, AS); L = lines_of(q); out = []
        for (p0, n), pts in zip(L, sides):
            if len(pts): out.append((pts - p0) @ n)
        return np.concatenate(out) if out else np.zeros(1)
    nvis = sum(1 for s in sides if len(s) >= 8)
    if nvis >= 2:
        sol = least_squares(r, np.concatenate([rv, tv]), loss='soft_l1', f_scale=1.0)
        q = project(sol.x[:3], sol.x[3:], FL, AS); rms = float(np.sqrt(np.mean(r(sol.x) ** 2)))
    else:
        q = project(rv, tv, FL, AS); rms = -1
    return q, nvis, rms
P = {}
for i in range(N):
    q, nvis, rms = solve(i, Q[i]); P[i] = (q, nvis, rms)
# a frame whose solve jumped away from both neighbours (the pose's mirror solution, or a bad input corner) is solved again
# from each neighbour's result and the better fit is kept
for _ in range(2):
    for i in range(1, N - 1):
        dp = np.abs(P[i][0] - P[i - 1][0]).max(); dn = np.abs(P[i][0] - P[i + 1][0]).max(); dpn = np.abs(P[i - 1][0] - P[i + 1][0]).max()
        if min(dp, dn) > 12 and (dpn < 12 or min(dp, dn) > 2 * min(dpn, 999)):
            cands = [P[i]] + [solve(i, P[j][0]) for j in (i - 1, i + 1)]
            cands = [c for c in cands if c[2] >= 0]
            P[i] = min(cands, key=lambda c: c[2] + 0.05 * min(np.abs(c[0] - P[i - 1][0]).max(), np.abs(c[0] - P[i + 1][0]).max()))
for i in range(N):
    q, nvis, rms = P[i]
    res.append((i, nvis, rms))
    m = q.mean(0); q = (q - m) * 1.004 + m
    w = q[1] - q[0]; q[0] -= widen * w; q[3] -= widen * w; q[1] += widen * w; q[2] += widen * w
    outc[i] = q.round(2).tolist()
T['corners'] = outc; T['widen'] = widen; T['solve'] = {'focal': round(FL, 1), 'aspect': round(AS, 4)}
json.dump(T, open(to, 'w'))
rr = [x[2] for x in res if x[2] >= 0]
print('edge rms per frame: median %.2f px, worst %.2f px; frames with <2 sides visible: %s' % (np.median(rr), max(rr), [x[0] for x in res if x[1] < 2]))
