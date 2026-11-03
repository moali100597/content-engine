#!/usr/bin/env python3
"""Find frames whose corners break the motion of their neighbours (a bad edge fit on one frame) and rebuild them by
interpolating between the nearest good frames. Real motion is smooth over a few frames; a fit error is not.
  python3 tools/phone_fix.py <track.json> [--until N] [--tol 3.5]"""
import json, sys
import numpy as np
tj = sys.argv[1]; T = json.load(open(tj)); A = np.array(T['corners'], float)
N = len(A) if '--until' not in sys.argv else int(sys.argv[sys.argv.index('--until') + 1]) + 1
tol = float(sys.argv[sys.argv.index('--tol') + 1]) if '--tol' in sys.argv else 3.5
def shape(q):
    # translation/rotation/scale-free description: the four side lengths over the top side, and the four corner angles
    L = [np.linalg.norm(q[(k + 1) % 4] - q[k]) for k in range(4)]
    ang = [np.degrees(np.arccos(np.clip(np.dot(q[(k - 1) % 4] - q[k], q[(k + 1) % 4] - q[k]) / np.linalg.norm(q[(k - 1) % 4] - q[k]) / np.linalg.norm(q[(k + 1) % 4] - q[k]), -1, 1))) for k in range(4)]
    return np.array([L[1] / L[0] * 20, L[2] / L[0] * 20, L[3] / L[0] * 20] + ang)   # ratio x20 ~ degrees in weight
S = np.array([shape(A[i]) for i in range(N)])
bad = set()
for i in range(N):
    nb = [j for j in range(max(0, i - 5), min(N, i + 6)) if j != i]
    med = np.median(S[nb], 0)
    if np.abs(S[i] - med).max() > tol: bad.add(i)
good = [i for i in range(N) if i not in bad]
for i in sorted(bad):
    lo = max([j for j in good if j < i], default=None); hi = min([j for j in good if j > i], default=None)
    if lo is None: A[i] = A[hi]
    elif hi is None: A[i] = A[lo]
    else: k = (i - lo) / (hi - lo); A[i] = A[lo] * (1 - k) + A[hi] * k
T['corners'] = A.round(2).tolist(); json.dump(T, open(tj, 'w'))
print('rebuilt frames:', sorted(bad))
