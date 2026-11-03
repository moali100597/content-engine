#!/usr/bin/env python3
"""Camera footage: look at everything that was shot, then prepare the chosen pieces for the edit.

  python3 tools/footage.py index <folder with clips> <name> [--rotate ccw|cw|180] [--budget seconds]
      Reads every clip, measures it, and writes footage/<name>/index.json plus contact sheets
      (footage/<name>/sheets/clips_NN.jpg, four frames per clip). The numbers are for choosing, not for show:
        sharp   focus and motion blur together (higher is crisper; compare clips of the same scene)
        clip    percent of the picture burnt to white (over 3 is a visibly overexposed shot)
        dark    percent of the picture crushed to black
        luma    median brightness 0..255 (a normal exposure sits around 105..135)
        sat     how loud the colours are, 0..255 (over 150 is cartoon-level and usually needs calming)
        shake   how much the camera's movement changes from frame to frame, in percent of frame width (a smooth pan reads low; over 0.5 wants steadying)
        skin    brightness of the main face, when there is one (a good exposure puts it around 135..165)
        face    where that face is: centre x%, centre y%, height% of the frame

  python3 tools/footage.py prep <name> <selects.json> [--force]
      Cuts the chosen pieces and corrects each one from its own measurements, in the order a colourist works:
      rotate, steady (only if it shakes), exposure judged on skin, highlight roll-off. No look is applied here: the look belongs to the film.
      Writes public/<video>/<id>.mp4, footage/<name>/prep.json (what was done to each piece and why)
      and footage/<name>/sheets/prep_before_after.jpg to check by eye.

      selects.json:  {"video": "my-video", "folder": "<folder with clips>", "rotate": "ccw",
                      "selects": [{"id": "balls", "clip": "1E1A4474.MP4", "in": 2.9, "out": 4.9, "steady": false, "audio": false}]}
      Per select you may force: "steady": true|false, "gamma": 1.1, "sat": 0.9, "keep": true (no correction at all).

  python3 tools/footage.py faces <video> [--step 0.25]
      Finds every face in every clip of public/<video>/ (every `step` seconds) and writes src/videos/<video>/faces.json:
      {"<clip>.mp4": {"w": 1080, "h": 1920, "boxes": [[t, x, y, w, h], ...]}} with x, y, w, h in fractions of the frame.
      Give a shot its track (`faces: faces['tramp.mp4']`) and the reel keeps text off those faces (kit/reel.tsx).

The source files are never changed. Frame rate is left as shot: the edit decides how a 25 fps clip sits in a 30 fps film.
"""
import json, math, os, subprocess, sys, time
import cv2
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROT = {'ccw': 'transpose=2', 'cw': 'transpose=1', '180': 'hflip,vflip', None: None}
VIDEO = ('.mp4', '.mov', '.mts', '.m4v', '.avi', '.mkv')


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def probe(path):
    r = run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate:format=duration', '-of', 'json', path])
    j = json.loads(r.stdout or '{}')
    s = (j.get('streams') or [{}])[0]
    a, b = (s.get('r_frame_rate') or '0/1').split('/')
    return {'w': s.get('width'), 'h': s.get('height'), 'fps': round(float(a) / max(1.0, float(b)), 3), 'dur': round(float(j.get('format', {}).get('duration', 0)), 3)}


def frame(path, t, rotate=None, width=480):
    """One frame as an RGB array, rotated the way the shot was held."""
    vf = ','.join(x for x in [ROT[rotate], f'scale={width}:-2'] if x)
    r = subprocess.run(['ffmpeg', '-v', 'error', '-ss', f'{max(0, t):.3f}', '-i', path, '-frames:v', '1', '-vf', vf, '-f', 'image2pipe', '-vcodec', 'png', '-'], capture_output=True)
    if not r.stdout:                                                # past the end of the clip
        return None
    a = cv2.imdecode(np.frombuffer(r.stdout, np.uint8), cv2.IMREAD_COLOR)
    return None if a is None else cv2.cvtColor(a, cv2.COLOR_BGR2RGB)


_det = None


def face(rgb):
    """The largest face in the frame as (x, y, w, h), or None. Needs tools/models/face_yunet.onnx (OpenCV's YuNet)."""
    global _det
    model = os.path.join(ROOT, 'tools', 'models', 'face_yunet.onnx')
    if _det is None:
        _det = cv2.FaceDetectorYN.create(model, '', (rgb.shape[1], rgb.shape[0]), 0.7) if os.path.exists(model) else False
    if not _det:
        return None
    _det.setInputSize((rgb.shape[1], rgb.shape[0]))
    _, found = _det.detect(cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR))
    if found is None:
        return None
    x, y, w, h = max(found, key=lambda r: r[2] * r[3])[:4]
    x, y = max(0, int(x)), max(0, int(y))
    return (x, y, int(w), int(h)) if w > 12 and h > 12 else None


def faces_all(rgb):
    """Every face in the frame as (x, y, w, h) in pixels."""
    face(rgb)                                                       # makes sure the detector exists
    if not _det:
        return []
    _det.setInputSize((rgb.shape[1], rgb.shape[0]))
    _, found = _det.detect(cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR))
    return [tuple(int(v) for v in r[:4]) for r in (found if found is not None else []) if r[2] > 12 and r[3] > 12]


def cmd_faces(video, step=0.25):
    folder = os.path.join(ROOT, 'public', video)
    out = os.path.join(ROOT, 'src', 'videos', video, 'faces.json')
    data = {}
    for f in sorted(os.listdir(folder)):
        if not f.lower().endswith(VIDEO):
            continue
        p = probe(os.path.join(folder, f))
        boxes = []
        for k in range(int(max(0, p['dur'] - 0.05) / step) + 1):
            t = k * step
            rgb = frame(os.path.join(folder, f), t, None, width=640)
            if rgb is None:
                continue
            H, W = rgb.shape[:2]
            boxes += [[round(t, 2), round(x / W, 4), round(y / H, 4), round(w / W, 4), round(h / H, 4)] for x, y, w, h in faces_all(rgb)]
        data[f] = {'w': p['w'], 'h': p['h'], 'boxes': boxes}
        print(f'{f}: {len(boxes)} face boxes', flush=True)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    json.dump(data, open(out, 'w'), separators=(',', ':'))
    print(f'-> src/videos/{video}/faces.json')


def measure(path, t0, t1, rotate=None, n=5):
    """Exposure, colour, sharpness and shake of the stretch t0..t1."""
    ts = [t0 + (t1 - t0) * (k + 0.5) / n for k in range(n)]
    lum, sat, sharp, shake, frames, skin, faces = [], [], [], [], [], [], []
    step = 1 / 25
    for t in ts:
        f = frame(path, t, rotate)
        if f is None:
            continue
        frames.append(f)
        hsv = cv2.cvtColor(f, cv2.COLOR_RGB2HSV)
        y = cv2.cvtColor(f, cv2.COLOR_RGB2GRAY)
        lum.append(y)
        sat.append(hsv[..., 1])
        sharp.append(cv2.Laplacian(y, cv2.CV_64F).var())
        g, g2 = frame(path, t + step, rotate), frame(path, t + 2 * step, rotate)      # the next two frames: a pan moves the same way twice, shake does not
        if g is not None and g2 is not None:
            y1, y2 = cv2.cvtColor(g, cv2.COLOR_RGB2GRAY), cv2.cvtColor(g2, cv2.COLOR_RGB2GRAY)
            (ax, ay), _ = cv2.phaseCorrelate(np.float32(y), np.float32(y1))
            (bx, by), _ = cv2.phaseCorrelate(np.float32(y1), np.float32(y2))
            shake.append(math.hypot(bx - ax, by - ay) / y.shape[1] * 100)
        box = face(f)                                             # the biggest face: its brightness is what exposure is judged on, and its place is what text must keep clear of
        if box is not None:
            x, yy, w, h = box
            skin.append(y[yy + h // 5: yy + h * 4 // 5, x + w // 5: x + w * 4 // 5].ravel())
            faces.append([round((x + w / 2) / f.shape[1] * 100), round((yy + h / 2) / f.shape[0] * 100), round(h / f.shape[0] * 100)])
    if not lum:
        return None
    y = np.concatenate([a.ravel() for a in lum])
    s = np.concatenate([a.ravel() for a in sat])
    sk = np.concatenate(skin) if skin else np.array([])
    return {
        'skin': round(float(np.median(sk)), 1) if sk.size else None,                       # brightness of the main face, when there is one
        'face': faces[len(faces) // 2] if faces else None,                                 # its centre x%, y% and height% of the frame
        'sharp': round(float(np.median(sharp)), 1), 'clip': round(float((y >= 250).mean() * 100), 2), 'dark': round(float((y <= 6).mean() * 100), 2),
        'luma': round(float(np.median(y)), 1), 'p2': round(float(np.percentile(y, 2)), 1), 'p98': round(float(np.percentile(y, 98)), 1),
        'sat': round(float(np.percentile(s, 90)), 1), 'shake': round(float(np.median(shake)) if shake else 0.0, 3),
    }, frames


def sheet(rows, out, cell=(216, 384), label_h=22):
    """rows: [(label, [RGB arrays])] -> one jpg, a row per item."""
    cols = max(len(r[1]) for r in rows)
    w, h = cell
    im = Image.new('RGB', (w * cols, (h + label_h) * len(rows)), (18, 18, 18))
    d = ImageDraw.Draw(im)
    for i, (label, frames) in enumerate(rows):
        y = i * (h + label_h)
        d.text((4, y + 4), label, fill=(255, 220, 0))
        for k, f in enumerate(frames):
            p = Image.fromarray(f)
            p.thumbnail((w, h))
            im.paste(p, (k * w + (w - p.width) // 2, y + label_h + (h - p.height) // 2))
    os.makedirs(os.path.dirname(out), exist_ok=True)
    im.save(out, quality=84)


def cmd_index(folder, name, rotate=None, budget=0):
    out = os.path.join(ROOT, 'footage', name)
    os.makedirs(out, exist_ok=True)
    idx = os.path.join(out, 'index.json')
    files = sorted(f for f in os.listdir(folder) if f.lower().endswith(VIDEO))
    clips = json.load(open(idx))['clips'] if os.path.exists(idx) else []      # run again to continue where it stopped
    done, page, started = {c['clip'] for c in clips}, [], time.time()
    for i, f in enumerate(files):
        if f in done:
            continue
        if budget and time.time() - started > budget:
            print(f'stopped at the time limit with {len(clips)}/{len(files)} done: run the same command again to continue')
            break
        p = os.path.join(folder, f)
        info = probe(p)
        m = measure(p, 0, info['dur'], rotate, n=4)
        if not m:
            continue
        stats, frames = m
        clips.append({'clip': f, **info, **stats})
        page.append((f"{f}  {info['dur']:.1f}s  sharp {stats['sharp']:.0f}  clip {stats['clip']}%  luma {stats['luma']:.0f}  sat {stats['sat']:.0f}  shake {stats['shake']}", frames))
        if len(page) == 10 or i == len(files) - 1:
            landscape = frames[0].shape[1] > frames[0].shape[0]
            sheet(page, os.path.join(out, 'sheets', f'clips_{(len(clips) - 1) // 10 + 1:02d}.jpg'), cell=(384, 216) if landscape else (216, 384))
            page = []
            json.dump({'folder': folder, 'rotate': rotate, 'clips': clips}, open(idx, 'w'), indent=1)      # saved a page at a time
        print(f'{i + 1}/{len(files)} {f}', flush=True)
    print(f'{len(clips)} clips, {sum(c["dur"] for c in clips):.0f} s -> footage/{name}/index.json')


def correction(m, s):
    """The filter chain for one piece, from its measurements. Returns (filters, notes)."""
    if s.get('keep'):
        return [], ['left as shot']
    f, notes = [], []
    gamma = s.get('gamma')
    if gamma is None:
        # Expose for the people, not for the room: a ball pit is bright by nature and must stay bright.
        # Skin is judged when there is enough of it in frame; otherwise the whole picture's median is used.
        # With no face in frame the shot is left alone unless it is plainly dark: a guess from the whole picture ruins bright sets.
        gamma = 1.0
        if m.get('skin'):
            anchor, target, what = m['skin'], 150.0, 'face'
            if abs(anchor - target) > 14:                           # skin legitimately varies; only step in when it is clearly off
                gamma = math.log(max(8.0, min(247.0, anchor)) / 255) / math.log(target / 255)     # eq's gamma brightens above 1
        elif m['luma'] < 70:
            anchor, target, what = m['luma'], 100.0, 'picture'
            gamma = math.log(max(8.0, anchor) / 255) / math.log(target / 255)
        gamma = max(0.85, min(1.18, gamma))
        if gamma > 1 and m['clip'] > 2:                             # already burning: brightening would burn more
            gamma = 1.0
        if gamma != 1.0:
            notes.append(f"{what} brightness {anchor:.0f} (aim {target:.0f}), gamma {gamma:.2f}")
    if gamma != 1.0:
        f.append(f'eq=gamma={gamma:.3f}')
    if m['clip'] > 1.0 or m['p98'] > 244:                           # burnt whites cannot come back, but a soft shoulder stops them shouting
        f.append("curves=all='0/0 0.5/0.5 0.8/0.775 0.92/0.87 1/0.93'")
        notes.append(f"{m['clip']}% burnt to white, highlights rolled off")
    sat = s.get('sat', 1.0)                                          # colour is the film's decision (the look), never an automatic fix
    if sat != 1.0:
        f.append(f'eq=saturation={sat:.3f}')
        notes.append(f"colour level {m['sat']:.0f}, saturation {sat:.2f}")
    return f, notes or ['already in range']


def cmd_prep(name, spec_path):
    spec = json.load(open(spec_path, encoding='utf-8'))
    out_dir = os.path.join(ROOT, 'public', spec['video'])
    foot = os.path.join(ROOT, 'footage', name)
    os.makedirs(out_dir, exist_ok=True)
    os.makedirs(foot, exist_ok=True)
    rotate, rows = spec.get('rotate'), []
    report = os.path.join(foot, 'prep.json')
    log = json.load(open(report, encoding='utf-8')) if os.path.exists(report) else []
    force = '--force' in sys.argv
    for s in spec['selects']:
        same = next((x for x in log if x['id'] == s['id'] and x['clip'] == s['clip'] and x['in'] == float(s['in']) and x['out'] == float(s['out'])), None)
        if same and not force and os.path.exists(os.path.join(out_dir, f"{s['id']}.mp4")):      # run again to continue; a changed in/out is redone
            print(f"{s['id']}: already prepared", flush=True)
            continue
        log = [x for x in log if x['id'] != s['id']]
        src = os.path.join(spec['folder'], s['clip'])
        t0, t1 = float(s['in']), float(s['out'])
        m, before = measure(src, t0, t1, rotate, n=3)
        chain, notes = correction(m, s)
        steady = s.get('steady')
        if steady is None:
            steady = m['shake'] > 0.5
        vf = [ROT[rotate]] if ROT[rotate] else []
        trf = os.path.join(foot, f"_{s['id']}.trf")
        if steady:                                                  # two passes: measure the movement, then smooth it
            run(['ffmpeg', '-v', 'error', '-y', '-ss', str(t0), '-t', str(t1 - t0), '-i', src, '-vf', ','.join(vf + [f'vidstabdetect=shakiness=6:accuracy=15:result={trf}']), '-f', 'null', '-'])
            vf += [f'vidstabtransform=input={trf}:smoothing=12:optzoom=1:interpol=bicubic', 'unsharp=5:5:0.6:3:3:0.3']
            notes.append(f"shake {m['shake']}% per frame, steadied")
        vf += chain
        dst = os.path.join(out_dir, f"{s['id']}.mp4")
        audio = ['-c:a', 'aac', '-b:a', '192k'] if s.get('audio') else ['-an']
        tmp = os.path.join(foot, '_tmp.mp4')
        r = run(['ffmpeg', '-v', 'error', '-y', '-ss', str(t0), '-t', str(t1 - t0), '-i', src, '-vf', ','.join(vf) or 'null', '-c:v', 'libx264', '-crf', '14', '-preset', 'fast', '-pix_fmt', 'yuv420p', *audio, tmp])
        if r.returncode != 0 or not os.path.exists(tmp):
            print(f"FAILED {s['id']}: {r.stderr.strip()[-300:]}")
            continue
        with open(tmp, 'rb') as a, open(dst, 'wb') as b:           # write over in place (deleting may not be allowed in this folder)
            b.write(a.read())
        open(tmp, 'wb').close()
        after_m, after = measure(dst, 0, t1 - t0, None, n=3)
        log.append({'id': s['id'], 'clip': s['clip'], 'in': t0, 'out': t1, 'before': m, 'after': after_m, 'did': notes})
        json.dump(log, open(report, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)      # saved piece by piece
        sheet([(f"{s['id']}  before: skin {m.get('skin')} luma {m['luma']:.0f} clip {m['clip']}% sat {m['sat']:.0f} shake {m['shake']}   |   after: skin {after_m.get('skin')} luma {after_m['luma']:.0f} clip {after_m['clip']}% sat {after_m['sat']:.0f} shake {after_m['shake']}", before + after)], os.path.join(foot, 'sheets', f"prep_{s['id']}.jpg"))
        print(f"{s['id']}: {'; '.join(notes)}", flush=True)
    strips = [Image.open(os.path.join(foot, 'sheets', f"prep_{s['id']}.jpg")) for s in spec['selects'] if os.path.exists(os.path.join(foot, 'sheets', f"prep_{s['id']}.jpg"))]
    if strips:                                                      # every piece, before on the left and after on the right
        im = Image.new('RGB', (max(x.width for x in strips), sum(x.height for x in strips)), (18, 18, 18))
        y = 0
        for x in strips:
            im.paste(x, (0, y))
            y += x.height
        im.save(os.path.join(foot, 'sheets', 'prep_before_after.jpg'), quality=84)
    print(f'{len(log)} pieces -> public/{spec["video"]}/, report footage/{name}/prep.json')


if __name__ == '__main__':
    a = sys.argv[1:]
    rot = a[a.index('--rotate') + 1] if '--rotate' in a else None
    if len(a) >= 3 and a[0] == 'index':
        cmd_index(a[1], a[2], rot, float(a[a.index('--budget') + 1]) if '--budget' in a else 0)
    elif len(a) >= 3 and a[0] == 'prep':
        cmd_prep(a[1], a[2])
    elif len(a) >= 2 and a[0] == 'faces':
        cmd_faces(a[1], float(a[a.index('--step') + 1]) if '--step' in a else 0.25)
    else:
        print(__doc__)
        sys.exit(1)
