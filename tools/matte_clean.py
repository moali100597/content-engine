"""Clean the hand mattes (public/v3/takes/frames/<take>/o###.webp) the way a compositor would before the comp.

The mattes were cut from generated takes whose screen was light, so their soft edge still carries a thin rim of that light
screen: over the dark UI it reads as a pale halo around the thumb ("white edges"). The classic fix, per frame:

  colour unmixing: the soft edge of the matte is the take itself (hand mixed with the light screen behind it); the
     screen colour next to the edge is read from the take and taken out, leaving the hand's own colour (alpha untouched).

  python3 tools/matte_clean.py <frames dir> [--check out.png]    cleans every o###.webp in place (originals kept in
                                                                 <frames dir>/orig/ the first time)
"""
import sys, os, shutil
import numpy as np
from PIL import Image
from scipy import ndimage


def clean(rgba: np.ndarray, plate: np.ndarray) -> np.ndarray:
    """Colour unmixing (defringe): an edge pixel of the matte is the take's pixel C = a*F + (1-a)*B, where B is what was
    behind the hand (the light blank screen, or the table). B is read from the take next to the edge (the nearest pixel
    the matte leaves clear) and the hand's own colour F = (C - (1-a)*B)/a is solved for. The alpha is not touched, so the
    shape of the hand and of the phone's thin rim stays exactly as cut."""
    C = rgba[..., :3].astype(np.float32)
    a = rgba[..., 3].astype(np.float32) / 255
    clear = a < 0.03
    solid = a > 0.97
    # B: the plate just outside the matte, smoothed a little (normalised convolution over the clear pixels)
    w = ndimage.gaussian_filter(clear.astype(np.float32), 2.0)
    Bs = np.dstack([ndimage.gaussian_filter(plate[..., c] * clear, 2.0) for c in range(3)]) / np.maximum(w, 1e-4)[..., None]
    _, (iy, ix) = ndimage.distance_transform_edt(w < 0.05, return_indices=True)
    B = Bs[iy, ix]
    F = (C - (1 - a)[..., None] * B) / np.maximum(a, 0.25)[..., None]
    # very thin coverage cannot be unmixed reliably: lean on the nearest solid colour there
    if solid.any():
        _, (sy, sx) = ndimage.distance_transform_edt(~solid, return_indices=True)
        S = C[sy, sx]
        k = np.clip((a - 0.1) / 0.3, 0, 1)[..., None]
        F = k * F + (1 - k) * S
    yy, xx = np.mgrid[-6:7, -6:7]
    thick = ndimage.binary_opening(solid, structure=(xx * xx + yy * yy) <= 36)   # the hand; the phone's thin rim lines are left as cut
    near_hand = ndimage.binary_dilation(thick, iterations=8) if thick.any() else np.zeros_like(solid)
    edge = ~(clear | solid) & near_hand
    out = rgba.copy()
    out[..., :3] = np.where(edge[..., None], np.clip(F, 0, 255), C).astype(np.uint8)
    return out


def smooth_hand(rgba: np.ndarray, plate: np.ndarray, quad=None) -> np.ndarray:
    """The hand's outline as a compositor would leave it: the cut matte had a notched, stepped outline (a pasted-on look)
    and pin holes (a black dot on the thumb). Holes are filled, the outline is smoothed (blur then threshold, which rounds
    off notches without moving the edge), then feathered by about a pixel like a real lens edge. Colour on the new edge
    pixels comes from the take with the white screen taken out. Only the hand changes; the phone's rim and notch keep the
    cut matte."""
    a0 = rgba[..., 3].astype(np.float32) / 255
    solid = a0 > 0.5
    yy, xx = np.mgrid[-6:7, -6:7]
    hand = ndimage.binary_opening(solid, structure=(xx * xx + yy * yy) <= 36)
    if not hand.any():
        return rgba
    lab, n = ndimage.label(hand)
    keep = np.zeros_like(hand)
    for i, sz in enumerate(ndimage.sum(hand, lab, index=np.arange(1, n + 1)), start=1):
        if sz > 4000: keep |= lab == i                   # the hand itself, not stray specks
    if not keep.any():
        return rgba
    Pw = plate.astype(np.int32); glass_white = (Pw.max(-1) > 165) & ((Pw.max(-1) - Pw.min(-1)) < 0.12 * Pw.max(-1))
    def fill_small(m, most=400):                          # pin holes only; a real gap between fingers stays open
        h = ndimage.binary_fill_holes(m) & ~m
        lab2, n2 = ndimage.label(h)
        if n2 == 0: return m
        sz = ndimage.sum(h, lab2, index=np.arange(1, n2 + 1))
        fill = np.isin(lab2, 1 + np.flatnonzero(sz <= most))
        return m | (fill & ~glass_white)                   # glass seen between a finger and the rim stays glass
    # the cut stopped short of the take's soft (motion-blurred) skin edge: grow onto the skin that touches the hand
    Ci = plate.astype(np.int32); mxi, mni = Ci.max(-1), Ci.min(-1)
    skin = (Ci[..., 0] > 90) & (Ci[..., 0] > Ci[..., 1] + 10) & (Ci[..., 1] > Ci[..., 2]) & ((mxi - mni) > 0.2 * mxi)
    grown = keep.copy()
    for _ in range(5):
        grown = grown | (ndimage.binary_dilation(grown, iterations=1) & skin)
    keep = grown
    hand = fill_small(keep)
    smooth = fill_small(ndimage.gaussian_filter(hand.astype(np.float32), 2.2) > 0.5)
    soft = ndimage.gaussian_filter(smooth.astype(np.float32), 0.9)
    zone = ndimage.binary_dilation(hand | smooth, iterations=4)   # where the hand's alpha is redrawn
    a = np.where(zone, np.maximum(soft, np.where(zone, 0, a0)), a0)
    # colour: the take, with the backing (white screen) unmixed on the soft edge
    C = plate
    mx, mn = C.max(-1), C.min(-1)
    screen = (mx > 150) & ((mx - mn) < 0.16 * mx) & ~ndimage.binary_dilation(hand, iterations=1)
    out = rgba.copy()
    col = np.where(zone[..., None], C, rgba[..., :3].astype(np.float32))
    if screen.sum() > 500:
        w = ndimage.gaussian_filter(screen.astype(np.float32), 5.0)
        B = np.dstack([ndimage.gaussian_filter(C[..., c] * screen, 5.0) for c in range(3)]) / np.maximum(w, 1e-4)[..., None]
        _, (iy, ix) = ndimage.distance_transform_edt(w < 0.02, return_indices=True)
        B = B[iy, ix]
        inner = ndimage.binary_erosion(smooth, iterations=3)
        _, (sy, sx) = ndimage.distance_transform_edt(~inner, return_indices=True)
        S = C[sy, sx]                                      # nearest sure skin
        lumC = C @ np.array([0.299, 0.587, 0.114], np.float32); lumB = B @ np.array([0.299, 0.587, 0.114], np.float32)
        lumS = S @ np.array([0.299, 0.587, 0.114], np.float32)
        lit = zone & ~inner & (lumC > lumS + 4) & (lumB > lumS + 20)   # an edge pixel lit by the white screen behind it
        f = np.clip((lumC - lumS) / np.maximum(lumB - lumS, 1), 0, 1)[..., None]   # how much backing is in it
        fixed = (C - f * B) / np.maximum(1 - f, 0.25) * (f < 0.75) + S * (f >= 0.75)
        col = np.where(lit[..., None], np.clip(fixed, 0, 255), col)
    out[..., :3] = np.clip(col, 0, 255).astype(np.uint8)
    out[..., 3] = (np.clip(a, 0, 1) * 255).astype(np.uint8)
    if quad is not None:
        # only over the screen: outside it the take itself is under the hand, so the cut matte is left exactly as it was
        from PIL import ImageDraw
        h, w = plate.shape[:2]
        im = Image.new('L', (w, h), 0); ImageDraw.Draw(im).polygon([tuple(p) for p in np.array(quad, np.float32)], fill=255)
        q = ndimage.binary_erosion(np.array(im) > 0, iterations=2)
        out = np.where(q[..., None], out, rgba)
    return out


def rim_fill(rgba: np.ndarray, plate: np.ndarray, quad, widen: float) -> np.ndarray:
    """The UI quad is wider than the glass (track.widen per long side) so no white of the blank take survives at its edges;
    that strip also covers the phone's own black display border and its copper frame. Inside the strip the take is handed
    back from one smooth line outward: the line where the display's black border meets the frame, measured across the edge
    every couple of pixels along it and smoothed along the edge. Inside that line the quad's own near-black shows, so the
    display border reads as one even dark band; outside it the frame (and anything on it) is the take as shot. A finger
    over the border keeps the hand matte. (A per-pixel threshold here split the border and its highlight into a stepped,
    serrated dark band.)"""
    from PIL import ImageDraw
    from scipy.ndimage import map_coordinates
    h, w = plate.shape[:2]
    q = np.array(quad, np.float64)                       # tl, tr, br, bl as tracked (widened along tl-tr)
    k = widen / (1 + 2 * widen)
    tl, tr, br, bl = q
    g = np.array([tl + (tr - tl) * k, tr + (tl - tr) * k, br + (bl - br) * k, bl + (br - bl) * k])
    def mask(poly):
        im = Image.new('L', (w, h), 0); ImageDraw.Draw(im).polygon([tuple(p) for p in poly], fill=255)
        return np.array(im) > 0
    strip = mask(q) & ~mask(g)
    if not strip.any():
        return rgba
    lum = plate @ np.array([0.299, 0.587, 0.114], np.float32)
    centre = g.mean(0)
    yy, xx = np.mgrid[0:h, 0:w]
    alpha = np.zeros((h, w), np.float32)
    for a0p, a1p, o0, o1 in ((g[0], g[3], q[0], q[3]), (g[1], g[2], q[1], q[2])):   # left long side, right long side
        e = a1p - a0p; L = np.hypot(*e); e = e / L
        nrm = np.array([-e[1], e[0]])
        if np.dot(centre - a0p, nrm) > 0: nrm = -nrm         # outward
        sw = abs(np.dot(o0 - a0p, nrm)) + 1                  # strip width on this side
        dl, _, _ = edge_line(lum, plate, a0p, a1p, nrm, -3, sw + 3)
        us = np.arange(0, L, 2.0)
        if dl is None:
            dl = np.full(len(us), sw * 0.5)
        dl = np.clip(dl, 0, sw)
        # per pixel: position along the edge and outward distance; alpha rises over ~1.2 px across the smooth line
        rx, ry = xx - a0p[0], yy - a0p[1]
        uu = rx * e[0] + ry * e[1]; dd = rx * nrm[0] + ry * nrm[1]
        side = strip & (np.abs(dd) < sw + 4) & (uu > -sw) & (uu < L + sw)
        line = np.interp(uu[side] / 2.0, np.arange(len(us)), dl)
        alpha[side] = np.maximum(alpha[side], np.clip((dd[side] - line) / 1.2 + 0.5, 0, 1))
    alpha *= strip
    out = rgba.copy()
    a0 = out[..., 3].astype(np.float32) / 255
    # the hand (thick components of the matte) stays; thin cut lines of the old matte in the strip do not
    yk, xk = np.mgrid[-4:5, -4:5]
    hand = ndimage.binary_opening(a0 > 0.5, structure=(xk * xk + yk * yk) <= 16)
    hand = ndimage.binary_dilation(hand, iterations=2)
    keep = np.where(hand, a0, 0)
    a1 = np.where(strip, np.maximum(alpha, keep), a0)
    col = np.where((strip & (alpha > keep))[..., None], plate, out[..., :3].astype(np.float32))
    out[..., :3] = np.clip(col, 0, 255).astype(np.uint8)
    out[..., 3] = np.clip(a1 * 255 + 0.5, 0, 255).astype(np.uint8)
    return out


def edge_line(lum, plate, a0p, a1p, nrm, d_from, d_to, bars=False):
    """Across an edge of the screen (from a0p to a1p, outward normal nrm), the outward distance at which the display's
    black border meets the phone's frame, every 2 px along the edge, smoothed along it. NaN-free; None if never seen."""
    from scipy.ndimage import map_coordinates
    e = a1p - a0p; L = np.hypot(*e); e = e / L
    ds = np.arange(d_from, d_to, 0.5)
    us = np.arange(0, L, 2.0)
    P = a0p[None, None, :] + us[:, None, None] * e + ds[None, :, None] * nrm
    co = [P[..., 1], P[..., 0]]
    prof = ndimage.uniform_filter1d(map_coordinates(lum, co, order=1, mode='nearest'), 3, axis=0)
    mxp = map_coordinates(plate.max(-1), co, order=1, mode='nearest'); mnp = map_coordinates(plate.min(-1), co, order=1, mode='nearest')
    grey = (mxp - mnp) < 0.16 * np.maximum(mxp, 1)
    dr = np.full(len(us), np.nan)
    for j in range(len(us)):
        L1 = prof[j]
        wh = np.where((L1 > 150) & grey[j])[0]
        if len(wh) == 0 or ds[wh[0]] > 1.5:                 # the glass must reach the edge (else a finger is over it)
            continue
        run = wh[0]
        while True:
            while run + 1 < len(L1) and L1[run + 1] > 150 and grey[j][run + 1]: run += 1
            if not bars:
                break
            # a short side's glass can carry a home bar: a thin dark line (up to 2.5 px) with the glass's white again past
            # it (2 px or more, grey); the border is the dark run after the last of the glass
            nx = None
            for x in range(run + 2, min(run + 7, len(L1) - 4)):
                if all(L1[x:x + 4] > 150) and all(grey[j][x:x + 4]):
                    nx = x; break
            if nx is None:
                break
            run = nx
        # the first dark run after the glass is the border (up to ~10 px wide on a close phone); its darkest point, then
        # the first rise out of it (not a later, darker line of the frame)
        dk = np.where(L1[run:run + 12] < 90)[0]
        if len(dk) == 0: continue
        s0 = run + dk[0]; s1 = s0
        while s1 + 1 < len(L1) and L1[s1 + 1] < 90 and s1 - s0 < 24: s1 += 1
        m = s0 + int(np.argmin(L1[s0:s1 + 1]))
        nxt = L1[m:m + 24]
        top = nxt.max()
        if top - L1[m] < 25: continue
        half = L1[m] + 0.5 * (top - L1[m])
        c = np.where(nxt >= half)[0]
        if len(c) == 0 or c[0] == 0: continue
        c = c[0]
        x0, x1 = nxt[c - 1], nxt[c]
        dr[j] = ds[m + c - 1] + 0.5 * (half - x0) / max(x1 - x0, 1e-3)
    ok = ~np.isnan(dr)
    if ok.sum() < 8:
        return None, e, L
    # the edge is straight, so the border line is too (to perspective, close to linear): a robust straight fit, so local
    # misreads (a home bar on the glass, the frame's highlight, a finger's shadow) are thrown out; then the inliers' small
    # residual, smoothed along the edge, for a take that bends a little
    idx = np.arange(len(us)).astype(np.float64)
    inl = ok.copy()
    for tol in (3.0, 2.0, 1.2, 1.0):
        if inl.sum() < 8: inl = ok.copy(); break
        A = np.vstack([idx[inl], np.ones(inl.sum())]).T
        coef = np.linalg.lstsq(A, dr[inl], rcond=None)[0]
        res = dr - (coef[0] * idx + coef[1])
        inl = ok & (np.abs(res) <= tol)
    fit = coef[0] * idx + coef[1]
    r = np.where(inl, dr - fit, np.nan)
    if inl.sum() >= 2:
        r = np.interp(idx, idx[inl], r[inl])
    else:
        r = np.zeros_like(idx)
    return fit + ndimage.gaussian_filter1d(np.clip(r, -1.5, 1.5), 6, mode='nearest'), e, L


def fill_holes(rgba: np.ndarray, plate: np.ndarray) -> np.ndarray:
    """Pin holes in the original matte (up to 400 px, inside the hand) filled with the take's own pixels: outside the
    quad a hole is invisible over the take, but on the quad's anti-aliased edge it let the quad show through (a dark dot
    on the thumb where it crosses the screen's edge)."""
    a = rgba[..., 3] > 127
    holes = ndimage.binary_fill_holes(a) & ~a
    lab, n = ndimage.label(holes)
    if n == 0:
        return rgba
    sz = ndimage.sum(np.ones_like(lab), lab, index=np.arange(1, n + 1))
    small = np.isin(lab, np.arange(1, n + 1)[sz <= 400])
    small = ndimage.binary_dilation(small, iterations=1) & (rgba[..., 3] < 250)
    out = rgba.copy()
    out[..., :3] = np.where(small[..., None], plate.astype(np.uint8), out[..., :3])
    out[..., 3] = np.where(small, 255, out[..., 3])
    return out


def quad_blend(inside: np.ndarray, outside: np.ndarray, quad) -> np.ndarray:
    """inside the quad one matte, outside it another, across an anti-aliased edge (a binary polygon cut stair-stepped
    along the screen's edge, magnified by the dives)."""
    from PIL import ImageDraw
    h, w = inside.shape[:2]
    m = Image.new('L', (w * 4, h * 4), 0)
    ImageDraw.Draw(m).polygon([(x * 4, y * 4) for x, y in np.array(quad, np.float64)], fill=255)
    k = (np.array(m.resize((w, h), Image.BOX)).astype(np.float32) / 255)[..., None]
    ai, ao = inside[..., 3:4].astype(np.float32) / 255, outside[..., 3:4].astype(np.float32) / 255
    a = ai * k + ao * (1 - k)                                 # premultiplied, so a clear pixel's colour never bleeds in
    c = (inside[..., :3] * ai * k + outside[..., :3] * ao * (1 - k)) / np.maximum(a, 1e-4)
    return np.clip(np.concatenate([c, a * 255], -1) + 0.5, 0, 255).astype(np.uint8)


def edge_seal(rgba: np.ndarray, plate: np.ndarray, quad) -> np.ndarray:
    """The quad's own edge is anti-aliased by the browser, so along it a pixel is part UI, part take; where the matte ended
    exactly at the quad (the hand matte was cut to the screen) that half-covered pixel drew a dark seam across a thumb
    crossing the edge. In a ring of 2.5 px just outside the quad the matte is the take's own pixels (invisible over the
    take), except where the take is the glass's white (short_fill turns that into the display's black)."""
    from PIL import ImageDraw
    h, w = plate.shape[:2]
    q = np.array(quad, np.float64)
    m = Image.new('L', (w * 4, h * 4), 0)
    ImageDraw.Draw(m).polygon([(x * 4, y * 4) for x, y in q], fill=255)
    Qk = np.array(m.resize((w, h), Image.BOX)).astype(np.float32) / 255
    full = Qk > 0.999
    dist = ndimage.distance_transform_edt(~full)
    ring = (dist > 0) & (dist <= 3.0)
    mx, mn = plate.max(-1), plate.min(-1)
    lum = plate @ np.array([0.299, 0.587, 0.114], np.float32)
    sat = (mx - mn) / np.maximum(mx, 1)
    glassy = np.clip((lum - 120) / 50, 0, 1) * np.clip(1 - (sat - 0.08) / 0.08, 0, 1)
    seal = (1 - glassy) * ring * np.clip(3.5 - dist, 0, 1)
    out = rgba.copy()
    a0 = out[..., 3].astype(np.float32) / 255
    a1 = np.maximum(a0, seal)
    k = ((a1 - a0) / np.maximum(a1, 1e-4))[..., None]
    out[..., :3] = np.clip(out[..., :3].astype(np.float32) * (1 - k) + plate * k, 0, 255).astype(np.uint8)
    out[..., 3] = np.clip(a1 * 255 + 0.5, 0, 255).astype(np.uint8)
    return out


def short_fill(rgba: np.ndarray, plate: np.ndarray, quad) -> np.ndarray:
    """Along the short sides (top and bottom) the tracked quad can sit a pixel or a few inside the glass, so a sliver of the
    blank take's white showed past the UI. From the quad's edge out to the measured line where the display's black border
    meets the frame (a robust straight fit, as in rim_fill), the matte is the display's near-black, the same colour as the
    quad's own border, with a soft edge; a thumb or palm over the band stays as shot, its edge unmixed from the glass."""
    h, w = plate.shape[:2]
    q = np.array(quad, np.float64)
    lum = plate @ np.array([0.299, 0.587, 0.114], np.float32)
    centre = q.mean(0)
    yy, xx = np.mgrid[0:h, 0:w]
    paint = np.zeros((h, w), np.float32)
    for a0p, a1p in ((q[0], q[1]), (q[3], q[2])):           # top, bottom
        e = (a1p - a0p) / np.hypot(*(a1p - a0p)); nrm = np.array([-e[1], e[0]])
        if np.dot(centre - a0p, nrm) > 0: nrm = -nrm
        dl, e, L = edge_line(lum, plate, a0p, a1p, nrm, -3, 18, bars=True)
        if dl is None:
            continue
        dl = np.clip(dl, 0, 12)
        rx, ry = xx - a0p[0], yy - a0p[1]
        uu = rx * e[0] + ry * e[1]; dd = rx * nrm[0] + ry * nrm[1]
        zone = (dd > -2) & (dd < 18) & (uu > 0) & (uu < L)
        line = np.interp(uu[zone] / 2.0, np.arange(len(dl)), dl)
        # full width only along the straight part of the edge: at the rounded corners the glass curves away and a straight
        # line carried on into them drew a black tick past the phone, so there the band narrows to 1.5 px
        uz = uu[zone]
        tp = np.clip((uz - 0.12 * L) / (0.06 * L), 0, 1) * np.clip((0.88 * L - uz) / (0.06 * L), 0, 1)
        line = line * tp + np.minimum(line, 1.5) * (1 - tp)
        inside = np.clip((line - dd[zone]) / 1.2 + 0.5, 0, 1) * np.clip(dd[zone] + 1.5, 0, 1)   # from a pixel inside the quad, so its anti-aliased edge never mixes in the glass
        # and none at all in the last few percent before the quad's own corner, which lies past the glass's rounded corner
        # (a thin black line ran on from the bottom edge over the palm there)
        inside *= np.clip((uz - 0.05 * L) / (0.03 * L), 0, 1) * np.clip((0.95 * L - uz) / (0.03 * L), 0, 1)
        paint[zone] = np.maximum(paint[zone], inside)
    if not paint.any():
        return rgba
    # in this band the take shows only the display (the glass's neutral white, the border's neutral black) and whatever is
    # over it (a thumb, a palm): read per pixel from the take, never from the matte's own cut. Skin stays warm even in its
    # highlights and creases, the glass and the border do not
    mx, mn = plate.max(-1), plate.min(-1)
    sat = (mx - mn) / np.maximum(mx, 1)
    lum = plate @ np.array([0.299, 0.587, 0.114], np.float32)
    rb = plate[..., 0] - plate[..., 2]
    # glass, its grey rim, a home bar; glass next to a hand is lit a little warm by it (r-b up to ~8% of its brightness),
    # skin is far warmer (25% and more, highlights and creases alike)
    rel = rb / np.maximum(lum, 1)
    neutral = np.clip(1 - (sat - 0.1) / 0.08, 0, 1) * np.clip(1 - (rel - 0.09) / 0.07, 0, 1)
    glassy = np.clip((lum - 110) / 60, 0, 1) * neutral
    # the border: dark and not warm; below ~50 any colour is the border (a hand is never that dark here, and a dark
    # pixel's hue means little)
    darkb = np.clip((75 - lum) / 30, 0, 1) * np.maximum(np.clip(1 - (rel - 0.2) / 0.15, 0, 1), np.clip((62 - lum) / 15, 0, 1))
    hand = ndimage.gaussian_filter(1 - np.maximum(neutral, darkb), 0.6)
    # the glass's own colour next to each pixel, to take it out of a hand's mixed edge (no light halo)
    gl = (glassy > 0.9).astype(np.float32)
    wg = ndimage.gaussian_filter(gl, 4)
    B = np.dstack([ndimage.gaussian_filter(plate[..., c] * gl, 4) for c in range(3)]) / np.maximum(wg, 1e-4)[..., None]
    B = np.where((wg > 0.01)[..., None], B, 235.0)
    black = np.array([7, 8, 12], np.float32)
    hk = hand[..., None]
    X = plate - (1 - hk) * np.maximum(B - black, 0)                         # hand over black, the glass taken out
    X = np.maximum(X, black * (1 - hk))
    # the band's look X at strength paint, over whatever the matte had (premultiplied)
    out = rgba.copy()
    a0 = out[..., 3].astype(np.float32) / 255
    C = out[..., :3].astype(np.float32)
    pk = paint[..., None]
    A = paint + (1 - paint) * a0
    col = (pk * X + (1 - pk) * a0[..., None] * C) / np.maximum(A, 1e-4)[..., None]
    ch = (paint > 0.003)[..., None]
    out[..., :3] = np.where(ch, np.clip(col, 0, 255), out[..., :3]).astype(np.uint8)
    out[..., 3] = np.where(ch[..., 0], np.clip(A * 255 + 0.5, 0, 255), out[..., 3]).astype(np.uint8)
    return out


def corner_fill(rgba: np.ndarray, plate: np.ndarray, quad) -> np.ndarray:
    """At the screen's four corners the tracked quad (a little larger than the glass, and wider still on the long sides)
    reaches past the glass's rounded corner; the CSS rounding of the quad does not always follow a given phone's corner,
    so a black tick of the quad showed over the copper frame. In a zone round each corner, every quad pixel that is not
    the glass (the white connected to the screen's inside, with its anti-aliased rim) and not the display's black border
    is handed back to the take: the frame and the table stay as shot."""
    from PIL import ImageDraw
    h, w = plate.shape[:2]
    q = np.array(quad, np.float64)
    def aa(poly):
        m = Image.new('L', (w * 4, h * 4), 0); ImageDraw.Draw(m).polygon([(x * 4, y * 4) for x, y in poly], fill=255)
        return np.array(m.resize((w, h), Image.BOX)).astype(np.float32) / 255
    qk = aa(q)
    inq = qk > 0
    mx, mn = plate.max(-1), plate.min(-1)
    lum = plate @ np.array([0.299, 0.587, 0.114], np.float32)
    white = (mx > 150) & ((mx - mn) < 0.14 * mx)
    lab, n = ndimage.label(white)
    ids = np.unique(lab[ndimage.binary_erosion(inq, iterations=10) & white]); ids = ids[ids > 0]
    glass = np.isin(lab, ids)
    glass = ndimage.binary_dilation(glass, iterations=2) & (lum > 85)          # with its anti-aliased rim
    short = min(np.hypot(*(q[1] - q[0])), np.hypot(*(q[2] - q[3])))
    yy, xx = np.mgrid[0:h, 0:w]
    zone = np.zeros((h, w), bool)
    for c in q:
        zone |= np.hypot(xx - c[0], yy - c[1]) < 0.24 * short
    # the frame and the table: bright, or strongly coloured; the display's black border stays under the quad's black
    solid = np.clip((lum - 70) / 25, 0, 1)
    solid = np.maximum(solid, np.clip(((mx - mn) / np.maximum(mx, 1) - 0.25) / 0.1, 0, 1) * np.clip((mx - 60) / 30, 0, 1))
    cov = solid * (zone & inq & ~glass)
    cov = np.maximum(cov, ndimage.gaussian_filter(cov, 0.6)) * (zone & inq & ~glass)
    if cov.max() < 0.02:
        return rgba
    out = rgba.copy()
    a0 = out[..., 3].astype(np.float32) / 255
    a1 = np.maximum(a0, cov)
    k = ((a1 - a0) / np.maximum(a1, 1e-4))[..., None]                       # the share of the new coverage
    col = out[..., :3].astype(np.float32) * (1 - k) + plate * k
    out[..., :3] = np.clip(col, 0, 255).astype(np.uint8)
    out[..., 3] = np.clip(a1 * 255 + 0.5, 0, 255).astype(np.uint8)
    return out


def cover_leaks(rgba: np.ndarray, plate: np.ndarray, quad) -> np.ndarray:
    """The tracked quad is widened on the long sides only; along a short side (or where the track sits a pixel inside the
    glass) a sliver of the blank take's white glass stayed visible next to the UI (the white line at the bottom of the
    phone). Every white pixel that belongs to the glass, lies just outside the quad and is not already covered is drawn
    as the display's black edge, with a soft rim."""
    from PIL import ImageDraw
    h, w = plate.shape[:2]
    im = Image.new('L', (w, h), 0); ImageDraw.Draw(im).polygon([tuple(p) for p in np.array(quad, np.float32)], fill=255)
    q_in = np.array(im) > 0
    mx, mn = plate.max(-1), plate.min(-1)
    white = (mx > 165) & ((mx - mn) < 0.12 * mx)
    lab, n = ndimage.label(white)
    ids = np.unique(lab[ndimage.binary_erosion(q_in, iterations=8) & white]); ids = ids[ids > 0]
    glass = np.isin(lab, ids)
    ring = ndimage.binary_dilation(q_in, iterations=10) & ~q_in
    a0 = rgba[..., 3]
    leak = glass & ring & (a0 < 200)
    if not leak.any():
        return rgba
    leak = ndimage.binary_dilation(leak, iterations=1) & ring & (mx > 110) & (a0 < 200)   # its anti-aliased rim too
    soft = np.maximum(ndimage.gaussian_filter(leak.astype(np.float32), 0.6), leak * 1.0)
    out = rgba.copy()
    k = soft[..., None]
    out[..., :3] = (out[..., :3] * (1 - k) + np.array([8, 9, 13], np.float32) * k).astype(np.uint8)
    out[..., 3] = np.maximum(a0, (soft * 255).astype(np.uint8))
    return out


def main():
    d = sys.argv[1]
    check = sys.argv[sys.argv.index('--check') + 1] if '--check' in sys.argv else None
    only = sys.argv[sys.argv.index('--only') + 1] if '--only' in sys.argv else None
    import json
    tj = os.path.join(os.path.dirname(os.path.dirname(d.rstrip('/'))), os.path.basename(d.rstrip('/')) + '.track.json')
    track = json.load(open(tj)) if os.path.exists(tj) else None
    orig = os.path.join(d, 'orig')
    os.makedirs(orig, exist_ok=True)
    names = sorted(n for n in os.listdir(d) if n.startswith('o') and n.endswith('.webp'))
    if only:
        names = [n for n in names if n == only]
    if '--parity' in sys.argv:                                # split a take between two processes
        par = int(sys.argv[sys.argv.index('--parity') + 1])
        names = [n for n in names if int(n[1:-5]) % 2 == par]
    if '--upto' in sys.argv:                                  # only the source frames a film actually uses (h5: 0-111)
        upto = int(sys.argv[sys.argv.index('--upto') + 1])
        names = [n for n in names if int(n[1:-5]) <= upto]
    for n in names:
        src = os.path.join(orig, n)
        if not os.path.exists(src):
            shutil.copy2(os.path.join(d, n), src)          # keep the original once; always clean from it
        im = np.array(Image.open(src).convert('RGBA'))
        plate = np.array(Image.open(os.path.join(d, 't' + n[1:-5] + '.jpg')).convert('RGB')).astype(np.float32)
        out = smooth_hand(clean(im, plate), plate, track['corners'][int(n[1:-5])] if track is not None else None)
        if track is not None:
            out = rim_fill(out, plate, track['corners'][int(n[1:-5])], track.get('widen', 0))
            # nothing changes outside the screen: there the take itself is under the hand, and the cut matte (which is the
            # take's own pixels) is invisible; recoloured edge pixels there drew a dark outline round the hand on the table
            from PIL import ImageDraw
            hh, ww = plate.shape[:2]
            out = quad_blend(out, fill_holes(im, plate), track['corners'][int(n[1:-5])])
            out = corner_fill(out, plate, track['corners'][int(n[1:-5])])
            out = edge_seal(out, plate, track['corners'][int(n[1:-5])])
            out = short_fill(out, plate, track['corners'][int(n[1:-5])])
            # (cover_leaks, the old per-pixel cover, drew stepped edges; short_fill and rim_fill now cover the glass)
        if check:
            # the matte over a dark screen, before (left) and after (right)
            bg = np.full(im.shape[:2] + (3,), (9, 10, 14), np.float32)
            def comp(x):
                al = x[..., 3:4].astype(np.float32) / 255
                return (x[..., :3] * al + bg * (1 - al)).astype(np.uint8)
            Image.fromarray(np.hstack([comp(im), comp(out)])).save(check)
            return
        Image.fromarray(out).save(os.path.join(d, n), 'WEBP', lossless=True, quality=100, method=4)
    print(f'{len(names)} mattes cleaned in {d}')


if __name__ == '__main__':
    main()
