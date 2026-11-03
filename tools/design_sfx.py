#!/usr/bin/env python3
"""Sound for a moving design: every sound sits on something that actually happens in the picture.

    python3 tools/design_sfx.py <clip.mp4> <qa.txt> <world> <out.mp4> [--music file.mp3 --music-db -20 --music-at 0]

1. The clip is read back frame by frame. For every text run in the QA log (box, size, kind; written by
   `node qa.mjs D-<id> check`), the frame where it starts to move in and the frame where it lands are measured
   from the pixels in its box (difference to the last frame). Runs that move together become one event.
2. Each event gets a sound chosen by what it is (headline line, reading text, highlight bar, sticker, number)
   and by the world (docs/design-system.md 12b), at a level that keeps headlines in front and small text quiet.
   The picture settling at the start gets a soft air bed; nothing sounds where nothing moves.
3. tools/sfx.py builds the effects track; the music bed (if any) fades in under it; both are mixed into the clip.
"""
import json, os, subprocess, sys, tempfile
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
FPS = 30

# sound per (world, event kind): (sound, dB). 'title' = a headline line, 'mid' = sub/kicker/bar, 'body' = reading text,
# 'sticker', 'num' = a stat number, 'mark' = a luxury wordmark, 'open' = the picture settling at the start.
PALETTE = {
    'documentary': {'open': ('syn:sub', -20), 'title': ('p:text_swish_1', -11), 'mid': ('p:paper_slide', -14), 'body': ('p:soft_tick', -20), 'num': ('p:soft_thump', -12), 'sticker': ('p:stamp_thud', -10)},
    'street':      {'open': ('syn:riser', -22), 'title': ('p:swoosh_up', -10), 'land': ('p:impact_punchy', -9), 'mid': ('p:swish_soft', -14), 'body': ('p:soft_tick', -18), 'sticker': ('p:boing', -12)},
    'luxury':      {'open': ('syn:sub', -24), 'mark': ('syn:shimmer', -16), 'title': ('p:swish_soft', -18), 'mid': ('p:swish_soft', -20), 'body': ('p:swish_soft', -22)},
    'editorial':   {'open': ('syn:sub', -24), 'title': ('p:paper_slide', -13), 'mid': ('p:soft_tick', -16), 'body': ('p:soft_tick', -20), 'sticker': ('p:stamp_thud', -12)},
    'pop':         {'open': ('syn:sub', -22), 'title': ('p:text_swish_2', -11), 'mid': ('p:bubble_pop', -14), 'body': ('p:soft_tick', -19), 'sticker': ('p:bubble_pop', -11), 'num': ('syn:pop', -12), 'glide': ('p:swoosh_down', -10)},
    'folk':        {'open': ('syn:sub', -22), 'title': ('p:swish_soft', -11), 'mid': ('p:paper_slide', -15), 'body': ('p:soft_tick', -19), 'sticker': ('p:stamp_thud', -11)},
}


def frames(mp4, w=540):
    probe = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', mp4], capture_output=True, text=True).stdout.strip().split(',')
    W, H = int(probe[0]), int(probe[1])
    h = int(round(H * w / W / 2) * 2)
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', mp4, '-vf', f'scale={w}:{h}', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, h, w).astype(np.float32), W, H, w / W


def runs(txt):
    out = []
    for line in open(txt, encoding='utf-8').read().splitlines():
        p = line.split('|')
        if len(p) < 8:
            continue
        x, y, w, h = (float(v) for v in p[1:5])
        rgb = [float(v) for v in __import__('re').findall(r'[\d.]+', p[5])[:3]]
        gray = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2] if len(rgb) == 3 else None
        out.append({'box': (x, y, w, h), 'size': float(p[6]), 'text': p[7], 'kind': p[9] if len(p) > 9 else 'over', 'gray': gray})
    return out


def timing(F, r, s):
    """When the run's own letters arrive: the share of its text pixels (pixels of the last frame close to its colour)
    that already look as they will at the end. A background that moves under it does not count."""
    x, y, w, h = (int(round(v * s)) for v in r['box'])
    x0, y0 = max(0, x), max(0, y)
    reg = F[:, y0:y0 + max(2, h), x0:x0 + max(2, w)]
    if reg.size == 0 or r['gray'] is None:
        return None
    # its letters: close to its colour at the end, and not looking like that at the start (they arrive)
    mask = (np.abs(reg[-1] - r['gray']) < 28) & (np.abs(reg[-1] - reg[0]) > 25)
    if mask.sum() < 6:
        mask = np.abs(reg[-1] - reg[0]) > 25   # letters the colour of the ground (a sticker on it): the whole piece arriving
    if mask.sum() < 6:
        return None   # nothing of it arrives (frame furniture, or already there): no sound
    cov = (np.abs(reg[:, mask] - reg[-1][mask]) < 18).mean(axis=1)
    start, land = int(np.argmax(cov > 0.15)), int(np.argmax(cov > 0.9))
    return start / FPS, land / FPS


def events(F, W, H, s, rs, furniture=0.36):
    short = min(W, H)
    ev = []
    for r in rs:
        if r['size'] < short * 0.03 and r['kind'] != 'sticker':
            continue   # frame furniture and micro labels make no sound
        t = timing(F, r, s)
        if not t or t[0] < furniture:
            continue   # the frame furniture fades in at 0.1 s; it is the set, not an event
        size = r['size']
        kind = 'sticker' if r['kind'] == 'sticker' else 'num' if r['text'].strip().isdigit() and size > short * 0.05 else \
            'title' if size >= short * 0.06 else 'mid' if size >= short * 0.036 else 'body'
        if r['text'].isascii() and any(ch.isalpha() for ch in r['text']) and size >= short * 0.06:   # a big Latin word: a wordmark
            kind = 'mark'
        ev.append({'kind': kind, 'start': t[0], 'land': t[1], 'y': r['box'][1], 'text': r['text']})
    ev.sort(key=lambda e: e['start'])
    merged = []
    for e in ev:   # runs of the same kind that start within 80 ms are one movement (words of one line, lines of a block)
        if any(m['kind'] == e['kind'] and abs(e['start'] - m['start']) < 0.08 for m in merged[-4:]):
            continue
        merged.append(e)
    # reading text: one soft sound per block that arrives, not one per line
    out, last_body = [], -9
    for e in merged:
        if e['kind'] == 'body':
            if e['start'] - last_body < 0.3:
                continue
            last_body = e['start']
        out.append(e)
    return out


def cues(evs, world, glides=()):
    pal = PALETTE.get(world, PALETTE['editorial'])
    cs = [{'t': 0.0, 's': pal['open'][0], 'db': pal['open'][1], 'fade': 0.4}]
    for g in glides:
        cs.append({'t': g, 's': pal.get('glide', ('p:swoosh_down', -11))[0], 'db': pal.get('glide', ('', -11))[1], 'al': 'peak'})
    titles = [e for e in evs if e['kind'] == 'title']
    for i, e in enumerate(evs):
        snd, db = pal.get(e['kind'], pal['mid'])
        if e['kind'] in ('sticker', 'num'):
            cs.append({'t': round(e['land'] - 0.02, 3), 's': snd, 'db': db})   # things that land sound when they land
        else:
            cs.append({'t': round(e['start'] + 0.03, 3), 's': snd, 'db': db, 'pitch': (titles.index(e) % 3) * 1.5 if e in titles else 0})
    if titles and 'land' in pal:   # the last headline line lands with a hit (the block is complete)
        cs.append({'t': round(titles[-1]['land'] - 0.05, 3), 's': pal['land'][0], 'db': pal['land'][1]})
    return cs


def mix(mp4, sfx, music, mdb, mat, dur, out):
    if music:
        # the bed is levelled on its own first (-21 LUFS less the offset), so every track sits the same under the effects;
        # the mix is then brought to -14 LUFS, the level Instagram and TikTok play at
        fc = (f'[1:a]aresample=48000[s];[2:a]aresample=48000,atrim=start={mat},asetpts=PTS-STARTPTS,atrim=0:{dur},'
              f'loudnorm=I={-21 + (mdb + 20)}:TP=-3,afade=t=in:d=0.4,afade=t=out:st={dur - 0.9}:d=0.9[m];'
              f'[s][m]amix=inputs=2:normalize=0,loudnorm=I=-14:TP=-1:LRA=11[a]')
        cmd = ['ffmpeg', '-v', 'error', '-y', '-i', mp4, '-i', sfx, '-i', music, '-filter_complex', fc]
    else:
        cmd = ['ffmpeg', '-v', 'error', '-y', '-i', mp4, '-i', sfx, '-filter_complex', '[1:a]aresample=48000,loudnorm=I=-14:TP=-1:LRA=11[a]']
    subprocess.run(cmd + ['-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-shortest', out], check=True)


def main():
    a = sys.argv[1:]
    mp4, txt, world, out = a[:4]
    music = a[a.index('--music') + 1] if '--music' in a else None
    mdb = float(a[a.index('--music-db') + 1]) if '--music-db' in a else -20
    mat = float(a[a.index('--music-at') + 1]) if '--music-at' in a else 0
    glides = [float(g) for g in a[a.index('--glides') + 1].split(',')] if '--glides' in a else []
    F, W, H, s = frames(mp4)
    dur = len(F) / FPS
    rs = runs(txt) if os.path.exists(txt) else []
    evs = events(F, W, H, s, rs)
    for e in evs:
        print(f"  {e['start']:5.2f}s  {e['kind']:7s} {e['text'][:24]}")
    spec = {'duration': dur, 'cues': cues(evs, world, glides)}
    tmp = tempfile.mkdtemp()
    json.dump(spec, open(f'{tmp}/cues.json', 'w'), ensure_ascii=False, indent=1)
    subprocess.run([sys.executable, os.path.join(HERE, 'sfx.py'), f'{tmp}/cues.json', f'{tmp}/sfx.wav'], check=True)
    mix(mp4, f'{tmp}/sfx.wav', music, mdb, mat, dur, out)
    print('->', out)


if __name__ == '__main__':
    main()
