#!/usr/bin/env python3
"""Depth map of a still, for moving the camera inside it in the edit (kit/depth.tsx).
Usage: python3 tools/depth.py <image> [<image> ...]      writes <image stem>.depth.png next to each image (near = white)
Model: Depth Anything V2 small (Apache-2.0), ONNX from the Hugging Face hub (onnx-community/depth-anything-v2-small),
downloaded on first use. Needs: pip install onnxruntime huggingface_hub pillow numpy.
Why: a still subject (a facade, a pool, a room) does not need a generated video clip; a depth map gives it a real
camera move with parallax at no cost (README.md, "Depth stills")."""
import os, sys
import numpy as np
from PIL import Image, ImageFilter

SIDE = 518                                    # the model works on multiples of 14; 518 is its training size
MEAN, STD = np.array([0.485, 0.456, 0.406]), np.array([0.229, 0.224, 0.225])

def session():
    import onnxruntime as ort
    from huggingface_hub import hf_hub_download
    return ort.InferenceSession(hf_hub_download('onnx-community/depth-anything-v2-small', 'onnx/model.onnx'), providers=['CPUExecutionProvider'])

def depth(sess, path):
    im = Image.open(path).convert('RGB'); W, H = im.size
    s = SIDE / min(W, H); w, h = round(W * s / 14) * 14, round(H * s / 14) * 14
    x = (np.asarray(im.resize((w, h), Image.BICUBIC), np.float32) / 255 - MEAN) / STD
    d = sess.run(None, {'pixel_values': x.transpose(2, 0, 1)[None].astype(np.float32)})[0][0]
    lo, hi = np.percentile(d, 1), np.percentile(d, 99.5)
    d = np.clip((d - lo) / (hi - lo + 1e-6), 0, 1)
    out = Image.fromarray((d * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC).filter(ImageFilter.GaussianBlur(max(W, H) / 900))   # soft edges: less tearing at object borders
    dst = os.path.splitext(path)[0] + '.depth.png'
    out.save(dst); return dst

if __name__ == '__main__':
    if len(sys.argv) < 2: sys.exit(__doc__)
    sess = session()
    for p in sys.argv[1:]: print(depth(sess, p))
