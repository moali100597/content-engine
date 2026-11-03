#!/usr/bin/env python3
"""Sound for a carousel clip (Carousel in src/kit/design/carousel.tsx): a whoosh on every glide, and each slide's own
events found the way tools/design_sfx.py finds them, inside that slide's stretch of the clip.

    python3 tools/carousel_sfx.py <clip.mp4> <world> <out.mp4> <qa1.txt,qa2.txt,...> [--music f --music-db -20 --music-at 0]
"""
import json, os, subprocess, sys, tempfile
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import design_sfx as d

HOLD, PAN = 2.6, 0.7

def main():
    a = sys.argv[1:]
    mp4, world, out, txts = a[0], a[1], a[2], a[3].split(',')
    F, W, H, s = d.frames(mp4)
    fps = d.FPS
    evs = []
    for i, txt in enumerate(txts):
        # the slide is still from the end of the glide that brings it to the start of the glide that takes it away
        a0 = 0 if i == 0 else i * HOLD + (i - 1) * PAN + PAN
        a1 = (i + 1) * HOLD + i * PAN if i < len(txts) - 1 else len(F) / fps
        lo, hi = int(a0 * fps), int(a1 * fps)
        seg = F[lo:hi]   # words that start during the glide are heard as it ends: the slide only reads once it stops
        off = lo / fps
        for e in d.events(seg, W, H, s, d.runs(txt), furniture=0.36 if i == 0 else 0):
            e['start'] += off; e['land'] += off
            evs.append(e)
    glides = [i * HOLD + (i - 1) * PAN + PAN * 0.5 for i in range(1, len(txts))]
    for e in sorted(evs, key=lambda e: e['start']):
        print(f"  {e['start']:5.2f}s  {e['kind']:7s} {e['text'][:24]}")
    dur = len(F) / fps
    tmp = tempfile.mkdtemp()
    json.dump({'duration': dur, 'cues': d.cues(evs, world, glides)}, open(f'{tmp}/cues.json', 'w'), ensure_ascii=False)
    subprocess.run([sys.executable, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sfx.py'), f'{tmp}/cues.json', f'{tmp}/sfx.wav'], check=True)
    music = a[a.index('--music') + 1] if '--music' in a else None
    mdb = float(a[a.index('--music-db') + 1]) if '--music-db' in a else -20
    mat = float(a[a.index('--music-at') + 1]) if '--music-at' in a else 0
    d.mix(mp4, f'{tmp}/sfx.wav', music, mdb, mat, dur, out)
    print('->', out)

if __name__ == '__main__':
    main()
