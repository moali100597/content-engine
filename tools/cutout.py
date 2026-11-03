#!/usr/bin/env python3
"""Cut the subject out of a picture (transparent PNG), for designs and stickers. Free and local (rembg, ISNet model).
Usage: python3 tools/cutout.py <in.png|jpg> <out.png> [--max 2048] [--keep] [--model u2net_human_seg]
--keep: no crop, same size as the input, so the cut-out lies exactly on its picture (a depth layer for motion).
--model: isnet-general-use by default; u2net_human_seg keeps whole people in busy scenes (isnet kept only a head in the ball pit).
Setup once: pip install "rembg[cpu]"  (the model, 179 MB, downloads itself on the first run into ~/.rembg).
The edge is cleaned: alpha below 8 is dropped, the result is cropped to the subject with a small margin."""
import sys
from PIL import Image

def main(src, dst, size=2048, keep=False, model='isnet-general-use'):
    from rembg import new_session, remove
    im = Image.open(src).convert('RGB')
    im.thumbnail((size, size))
    out = remove(im, session=new_session(model))
    a = out.getchannel('A').point(lambda v: 0 if v < 8 else v)
    out.putalpha(a)
    box = None if keep else a.getbbox()
    if box:
        pad = int(max(out.size) * 0.02)
        out = out.crop((max(0, box[0] - pad), max(0, box[1] - pad), min(out.width, box[2] + pad), min(out.height, box[3] + pad)))
    out.save(dst)
    print(f'{src} -> {dst} {out.size[0]}x{out.size[1]}')

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print(__doc__); sys.exit(1)
    main(sys.argv[1], sys.argv[2], int(sys.argv[sys.argv.index('--max') + 1]) if '--max' in sys.argv else 2048, '--keep' in sys.argv, sys.argv[sys.argv.index('--model') + 1] if '--model' in sys.argv else 'isnet-general-use')
