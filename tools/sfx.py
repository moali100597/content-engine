#!/usr/bin/env python3
"""Build one SFX track from a cue list.  Usage: python3 tools/sfx.py src/sfx-cues.json public/sfx.wav
Cue: {"t": seconds, "s": sound, "db": gain, "n": repeats, "every": seconds, "pitch": semitones, "step": semitones per repeat, "pan": -1..1,
      "al": "peak" (put the loudest point on t instead of the start), "from": skip this many seconds first (pick one hit
      out of a recorded series; the hit times are listed in sfx-lib/youtube/README.md), "len": keep only this many seconds, "fade": fade in/out seconds}
Spec: {"duration": seconds, "speed": 1.08 (cue times are written against the original voice-over and divided by this), "cues": [...]}
Sound: "p:<name>" (sfx-lib/pro, generated, leading silence trimmed), "ui:<pack>/<cue>" (sfx-lib/uisfx, CC0), "k:<file>" (sfx-lib/kenney, CC0),
       "yt:<name>" (sfx-lib/youtube, real recordings from the YouTube Audio Library, free to use),
       "syn:<whoosh|whip|impact|heavy|sub|riser|crack|shimmer|tick|pop>"."""
import json, subprocess, sys, glob, os
import numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt, resample

SR = 48000
ROOT = os.path.join(os.path.dirname(__file__), '..', 'sfx-lib')
rng = np.random.default_rng(7)
_cache = {}

def env(n, a, d):  # attack/decay seconds
    t = np.arange(n) / SR
    return np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) / d)

def band(x, lo, hi):
    return sosfilt(butter(2, [lo, hi], btype='band', fs=SR, output='sos'), x)

def sweep_noise(dur, f0, f1, q=1.2, shape=2.0):
    """Noise whose colour glides from f0 to f1: fixed band filters cross-faded over time (no block seams)."""
    n = int(dur * SR); x = rng.standard_normal(n); k = np.linspace(0, 1, n); out = np.zeros(n); bands = 10
    for j in range(bands):
        c = f0 * (f1 / f0) ** (j / (bands - 1))
        w = np.exp(-((k - j / (bands - 1)) * bands / 1.6) ** 2)
        out += band(x, c / q, min(c * q, SR / 2 - 100)) * w
    return out * np.sin(np.pi * k) ** shape

def syn(name):
    if name == 'whoosh': x = sweep_noise(0.42, 500, 5200, shape=2.2)
    elif name == 'whip': x = sweep_noise(0.2, 900, 8200, q=1.35, shape=1.6)
    elif name == 'riser': x = sweep_noise(0.9, 300, 6000, shape=1.0) * np.linspace(0.05, 1, int(0.9 * SR)) ** 2
    elif name in ('impact', 'heavy'):
        d = 0.32 if name == 'impact' else 0.6; n = int(d * SR); t = np.arange(n) / SR
        f = (95 if name == 'impact' else 70) * np.exp(-t * 9) + 42
        x = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.002, d / 4.5)
        x += band(rng.standard_normal(n), 900, 5200) * env(n, 0.001, 0.02) * 0.22
        x += band(rng.standard_normal(n), 150, 900) * env(n, 0.002, 0.07) * 0.3
    elif name == 'sub':
        n = int(1.1 * SR); t = np.arange(n) / SR; f = 90 * np.exp(-t * 2.2) + 32
        x = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.03, 0.42)
    elif name == 'crack':
        n = int(0.22 * SR); x = band(rng.standard_normal(n), 1800, 9000) * env(n, 0.001, 0.035)
        for k in (0.05, 0.09, 0.13): x[int(k * SR):] += (band(rng.standard_normal(n), 2500, 11000) * env(n, 0.001, 0.012))[:n - int(k * SR)] * 0.7
    elif name == 'shimmer':
        n = int(0.7 * SR); t = np.arange(n) / SR
        x = sum(np.sin(2 * np.pi * f * t + p) for f, p in ((2637, 0), (3951, 1), (5274, 2), (7040, 3))) * 0.2 * np.sin(np.pi * t / 0.7) ** 2
        x += band(rng.standard_normal(n), 6000, 14000) * np.sin(np.pi * t / 0.7) ** 3 * 0.25
    elif name == 'tick':
        n = int(0.03 * SR); x = band(rng.standard_normal(n), 1800, 6500) * env(n, 0.0005, 0.004)
    elif name == 'pop':
        n = int(0.09 * SR); t = np.arange(n) / SR
        x = np.sin(2 * np.pi * np.cumsum(420 + 520 * np.exp(-t * 60)) / SR) * env(n, 0.002, 0.022)
    else: raise SystemExit(f'unknown synth {name}')
    return x / (np.max(np.abs(x)) + 1e-9)

def load(s):
    if s in _cache: return _cache[s]
    kind, name = s.split(':', 1)
    if kind == 'syn': x = syn(name)
    else:
        path = os.path.join(ROOT, 'pro', name + '.mp3') if kind == 'p' else os.path.join(ROOT, 'uisfx', name + '.mp3') if kind == 'ui' else os.path.join(ROOT, 'youtube', name + '.mp3') if kind == 'yt' else glob.glob(os.path.join(ROOT, 'kenney', '*', name + '.*'))[0]
        raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
        x = np.frombuffer(raw, np.float32).astype(np.float64); x = x / (np.max(np.abs(x)) + 1e-9)
        if kind == 'p':  # generated clips start late: cut to 10 ms before the first audible sample
            x = x[max(0, int(np.argmax(np.abs(x) > 0.06)) - int(0.01 * SR)):]
    _cache[s] = x
    return x

def main(cue_path, out_path):
    spec = json.load(open(cue_path)); dur = spec['duration']; speed = spec.get('speed', 1.0)
    mix = np.zeros((int(dur * SR) + SR, 2))
    for c in spec['cues']:
        base = load(c['s'])
        if 'from' in c: base = base[int(c['from'] * SR):]
        if 'len' in c:
            base = base[:int(c['len'] * SR)].copy(); f = min(len(base), int(0.06 * SR)); base[-f:] *= np.linspace(1, 0, f)
        if 'fade' in c:
            base = base.copy(); f = min(len(base) // 2, int(c['fade'] * SR)); base[:f] *= np.linspace(0, 1, f); base[-f:] *= np.linspace(1, 0, f)
        for i in range(c.get('n', 1)):
            x = base; semis = c.get('pitch', 0) + c.get('step', 0) * i + (rng.uniform(-0.6, 0.6) if c.get('n', 1) > 1 else 0)
            if abs(semis) > 0.01: x = resample(x, max(8, int(len(x) / 2 ** (semis / 12))))
            g = 10 ** ((c.get('db', -18) + (rng.uniform(-2.5, 0) if c.get('n', 1) > 1 else 0)) / 20)
            at = int((c['t'] + i * c.get('every', 0.08)) / speed * SR); pan = c.get('pan', 0)
            if c.get('al') == 'peak': at -= int(np.argmax(np.abs(x)))
            if at < 0: x = x[-at:]; at = 0
            seg = mix[at:at + len(x)]; x = x[:len(seg)] * g
            seg[:, 0] += x * np.sqrt((1 - pan) / 2) * 1.414; seg[:, 1] += x * np.sqrt((1 + pan) / 2) * 1.414
    mix = mix[:int(dur * SR)]
    peak = np.max(np.abs(mix)); mix = np.tanh(mix * 1.1) if peak > 0.9 else mix
    sf.write(out_path, mix.astype(np.float32), SR, subtype='PCM_16')
    print(f'{len(spec["cues"])} cues -> {out_path}, peak {20 * np.log10(np.max(np.abs(mix)) + 1e-9):.1f} dBFS')

if __name__ == '__main__': main(sys.argv[1], sys.argv[2])
