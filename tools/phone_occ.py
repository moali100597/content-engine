#!/usr/bin/env python3
"""Rebuild the occluder stills (o###.webp) for a track: inside the quad, everything that is not glass (thumb, notch,
bezel, the table past the phone) is kept on top of the UI; the light fringe around the white glass counts as glass.
  python3 tools/phone_occ.py <frames dir> <track.json> [--until N]"""
import json, sys, os
import cv2, numpy as np
d, tj = sys.argv[1:3]
until = int(sys.argv[sys.argv.index('--until') + 1]) if '--until' in sys.argv else None
T = json.load(open(tj)); N = len(T['corners']) if until is None else until + 1
for i in range(N):
    f = cv2.imread(os.path.join(d, 't%03d.jpg' % i)); q = np.array(T['corners'][i], float)
    m = np.zeros(f.shape[:2], np.uint8); cv2.fillConvexPoly(m, ((q - q.mean(0)) * 1.04 + q.mean(0)).astype(np.int32), 255)
    h = cv2.cvtColor(f, cv2.COLOR_BGR2HSV); wm = ((h[..., 2] > 200) & (h[..., 1] < 50)).astype(np.uint8)
    fringe = (cv2.dilate(wm, np.ones((7, 7), np.uint8)) > 0) & (h[..., 1] < 70) & (h[..., 2] > 110)
    glass = cv2.morphologyEx(((wm > 0) | fringe).astype(np.uint8) * 255, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    # the top band of the glass (the notch and the status bar): the plate's notch leaves a ragged halo, so the band is
    # handed to the UI, which draws its own clean notch; only a thumb there would stay on top
    tw = q[1] - q[0]; tv = q[3] - q[0]
    band = np.array([q[0] - 0.02 * tv, q[1] - 0.02 * tv, q[1] + 0.075 * tv, q[0] + 0.075 * tv])
    bm = np.zeros(f.shape[:2], np.uint8); cv2.fillConvexPoly(bm, band.astype(np.int32), 255)
    sk = (((h[..., 0] < 22) | (h[..., 0] > 170)) & (h[..., 1] > 55) & (h[..., 2] > 60)).astype(np.uint8) * 255
    edge = cv2.bitwise_and(bm, cv2.bitwise_not(cv2.dilate(sk, np.ones((5, 5), np.uint8))))
    # keep the band inside the bezel only: the bezel line itself (outside the widened long sides) stays from the plate
    inner = np.zeros(f.shape[:2], np.uint8); wd = T.get('widen', 0); w = tw / (1 + 2 * wd) * wd
    gq = q.copy(); gq[0] += w; gq[3] += w; gq[1] -= w; gq[2] -= w
    cv2.fillConvexPoly(inner, ((gq - gq.mean(0)) * 0.995 + gq.mean(0)).astype(np.int32), 255)
    glass = cv2.bitwise_or(glass, cv2.bitwise_and(edge, inner))
    occ = cv2.bitwise_and(m, cv2.bitwise_not(glass))
    occ = cv2.morphologyEx(occ, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)); occ = cv2.GaussianBlur(occ, (5, 5), 0)   # a soft matte edge on the thumb, like a feathered roto
    rgba = np.dstack([f, occ]); rgba[occ == 0] = 0
    cv2.imwrite(os.path.join(d, 'o%03d.webp' % i), rgba, [cv2.IMWRITE_WEBP_QUALITY, 101])
print('occluders', N)
