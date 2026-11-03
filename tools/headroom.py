"""Give a generated picture more empty room for the headline without regenerating it.
  crop:  headroom.py crop  in.png out.png  <width fraction>  <top fraction>     zoom in on a subject that came out too small
  pad:   headroom.py pad   in.png out.png  <scale>  <anchor: br|bl|b> [fade]    shrink towards a corner, grow the plain set
The set must be plain where it is grown (the picture's own edge pixels are stretched and softened)."""
import sys
import numpy as np
from PIL import Image, ImageFilter

mode, src, dst = sys.argv[1:4]
im = Image.open(src).convert('RGB'); W, H = im.size
if mode == 'crop':
    fw, top = float(sys.argv[4]), float(sys.argv[5])
    w = round(W * fw); h = round(w * H / W); x0 = (W - w) // 2; y0 = round(H * top)
    im.crop((x0, y0, x0 + w, y0 + h)).resize((W, H), Image.LANCZOS).save(dst)
else:
    s, anchor = float(sys.argv[4]), sys.argv[5]
    fade = len(sys.argv) > 6 and sys.argv[6] == 'fade'
    w, h = round(W * s), round(H * s)
    small = np.asarray(im.resize((w, h), Image.LANCZOS))
    x0 = {'br': W - w, 'bl': 0, 'b': (W - w) // 2}[anchor]; y0 = H - h
    out = np.zeros((H, W, 3), np.uint8)
    out[y0:, x0:x0 + w] = small
    # grow the set: the mean of the picture's edge strips, stretched outwards
    out[y0:, :x0] = small[:, :6].mean(1, keepdims=True)
    out[y0:, x0 + w:] = small[:, -6:].mean(1, keepdims=True)
    edge = out[y0:y0 + 6].mean(0, keepdims=True)
    if fade:   # a lit wall: the light falls off above the picture instead of running up to the top as a beam
        dark = np.percentile(edge.reshape(-1, 3), 10, axis=0)
        t = (np.linspace(0, 1, y0) ** 1.6).reshape(-1, 1, 1)          # 0 at the top, 1 at the seam
        out[:y0] = (dark + (edge - dark) * t).astype(np.uint8)
    else:
        out[:y0] = edge
    res = Image.fromarray(out)
    # soften only the grown area so stretched pixels read as a plain set, and feather the seam
    blur = res.filter(ImageFilter.GaussianBlur(28))
    mask = Image.new('L', (W, H), 255); mask.paste(0, (x0 + 14, y0 + 14, x0 + w - (14 if x0 + w < W else 0), H))
    mask = mask.filter(ImageFilter.GaussianBlur(10))
    Image.composite(blur, res, mask).save(dst)
