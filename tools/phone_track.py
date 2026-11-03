#!/usr/bin/env python3
"""Track a blank white phone screen through a take, so our own UI can be drawn on it (kit/phone.tsx).

  python3 tools/phone_track.py <take.mp4 | still.png> <out prefix> [--pick X,Y] [--off]

Generate the take with the phone screen plain flat white (the prompt says so). Writes:
  <prefix>.track.json   fps, frame size and, for every frame, the screen's four corners [TL, TR, BR, BL] (smoothed)
  <prefix>.occ.webm     (takes only) everything that lies over the screen (a thumb, the notch, the bezel's edge) with
                        alpha, to lay on top of the UI so the thumb stays in front of it
  <prefix>.check.jpg    a sheet of frames with the tracked screen outlined, to look at before using it
  <prefix>.off.png      with --off: the first frame with the screen switched off (dark glass), for the shot before it lights
How: the screen is the white region nearest the point given with --pick (default: the frame centre); its four edges
are fitted on the visible outline (a thumb hides part of an edge, not all of it), and the outline is drawn a little
larger than the glass: the occluder layer puts the bezel and the thumb back on top, so the UI shows only on the glass. Corners are smoothed over time (the hands move the phone a little; the camera is locked off)."""
import json, subprocess, sys
import cv2
import numpy as np


def white(f):
    hsv = cv2.cvtColor(f, cv2.COLOR_BGR2HSV)
    return ((hsv[..., 2] > 205) & (hsv[..., 1] < 45)).astype(np.uint8)


def screen_component(m, near):
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    n, lab, st, cen = cv2.connectedComponentsWithStats(m)
    best, bd = None, 1e18
    for i in range(1, n):
        if st[i][4] < 3000: continue
        d = (cen[i][0] - near[0]) ** 2 + (cen[i][1] - near[1]) ** 2
        if d < bd: best, bd = i, d
    if best is None: return None, near
    return (lab == best).astype(np.uint8), tuple(cen[best])


def corners(c):
    ys, xs = np.nonzero(c)
    tl = np.array((xs[ys.argmin()], ys.min()), float)          # topmost
    tr = np.array((xs.max(), ys[xs.argmax()]), float)          # rightmost
    bl = np.array((xs.min(), ys[xs.argmin()]), float)          # leftmost
    q0 = np.array([tl, tr, tr + bl - tl, bl])                  # first guess: a parallelogram
    cs, _ = cv2.findContours(c, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    pts = max(cs, key=len).reshape(-1, 2).astype(float)
    lines = []
    for i in range(4):                                         # refit each edge on the outline points lying along it
        a, b = q0[i], q0[(i + 1) % 4]; d = (b - a) / np.linalg.norm(b - a); nrm = np.array([-d[1], d[0]])
        s = (pts - a) @ d; L = np.linalg.norm(b - a)
        near = pts[(np.abs((pts - a) @ nrm) < 14) & (s > 0.12 * L) & (s < 0.88 * L)]
        if len(near) > 25:
            vx, vy, x0, y0 = cv2.fitLine(near.astype(np.float32), cv2.DIST_HUBER, 0, 0.01, 0.01).ravel()
            lines.append((np.array([x0, y0]), np.array([vx, vy])))
        else:
            lines.append((a, d))
    def meet(l1, l2):
        (p1, d1), (p2, d2) = l1, l2
        A = np.array([d1, -d2]).T
        if abs(np.linalg.det(A)) < 1e-6: return None
        k = np.linalg.solve(A, p2 - p1); return p1 + k[0] * d1
    q = []
    for i in range(4):                                         # corner i joins edge i-1 and edge i
        m = meet(lines[i - 1], lines[i]); q.append(m if m is not None and np.linalg.norm(m - q0[i]) < 60 else q0[i])
    q = np.array(q); ctr = q.mean(0)
    return ctr + (q - ctr) * 1.08             # a little larger than the glass: the occluder layer hides any overlap


def smooth(Q, k=5):
    Q = np.array(Q); out = Q.copy()
    for i in range(len(Q)):
        a, b = max(0, i - k), min(len(Q), i + k + 1)
        out[i] = np.median(Q[a:b], axis=0)
    for i in range(1, len(out)): out[i] = out[i - 1] * 0.5 + out[i] * 0.5
    return out


def main():
    src, prefix = sys.argv[1], sys.argv[2]
    pick = None
    if '--pick' in sys.argv: pick = tuple(map(float, sys.argv[sys.argv.index('--pick') + 1].split(',')))
    still = src.lower().endswith(('.png', '.jpg', '.jpeg', '.webp'))
    if still:
        frames = [cv2.imread(src)]; fps = 24
    else:
        cap = cv2.VideoCapture(src); fps = cap.get(cv2.CAP_PROP_FPS); frames = []
        while True:
            ok, f = cap.read()
            if not ok: break
            frames.append(f)
    H, W = frames[0].shape[:2]
    near = pick or (W / 2, H / 2)
    Q, comps = [], []
    for f in frames:
        c, near = screen_component(white(f), near)
        if c is None: sys.exit('no white screen found: give --pick X,Y on the screen')
        Q.append(corners(c)); comps.append(c)
    Qs = smooth(Q) if len(Q) > 1 else np.array(Q)
    json.dump({'fps': fps, 'size': [W, H], 'corners': [[[round(x, 1) for x in p] for p in q] for q in Qs.tolist()]}, open(prefix + '.track.json', 'w'))
    # check sheet
    idx = np.linspace(0, len(frames) - 1, min(6, len(frames))).astype(int)
    tiles = []
    for i in idx:
        f = frames[i].copy(); cv2.polylines(f, [Qs[i].astype(np.int32)], True, (255, 0, 255), 2)
        x0, y0 = Qs[i].min(0).astype(int) - 60; x1, y1 = Qs[i].max(0).astype(int) + 60
        tiles.append(cv2.resize(f[max(0, y0):y1, max(0, x0):x1], (360, 360)))
    cv2.imwrite(prefix + '.check.jpg', np.hstack(tiles))
    if '--off' in sys.argv:                      # the first frame with the screen switched off: dark glass, a soft sheen
        f0 = frames[0].astype(np.float32); q = Qs[0]
        g = cv2.GaussianBlur(cv2.dilate(comps[0], np.ones((5, 5), np.uint8)).astype(np.float32), (5, 5), 0)[..., None]
        yy, xx = np.mgrid[0:H, 0:W]; d = (xx - q[0][0]) * 0.6 + (yy - q[0][1]) * 0.8
        sheen = np.clip(1 - np.abs(d - 60) / 120, 0, 1) * 26
        dark = np.dstack([13 + sheen, 11 + sheen, 9 + sheen])
        cv2.imwrite(prefix + '.off.png', (f0 * (1 - g) + dark * g).astype(np.uint8))
    if still: return
    # occluders: inside the screen outline, whatever is not white screen
    p = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgra', '-s', f'{W}x{H}', '-r', str(fps), '-i', '-',
                          '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '4M', '-auto-alt-ref', '0', '-deadline', 'realtime', '-cpu-used', '8', '-row-mt', '1', prefix + '.occ.webm'], stdin=subprocess.PIPE)
    for f, q, c in zip(frames, Qs, comps):
        inside = np.zeros((H, W), np.uint8); cv2.fillPoly(inside, [q.astype(np.int32)], 255)
        inside = cv2.dilate(inside, np.ones((21, 21), np.uint8))
        glass = cv2.dilate(c, np.ones((5, 5), np.uint8)).astype(np.float32)        # the screen itself, its soft edge included
        glass = cv2.GaussianBlur(glass, (5, 5), 0)
        a = (1 - glass) * (inside / 255.0)       # only the glass lets the UI through; a light counter beside the phone does not
        rgba = np.dstack([f, (a * 255).astype(np.uint8)])
        p.stdin.write(rgba.tobytes())
    p.stdin.close(); p.wait()


if __name__ == '__main__':
    main()
