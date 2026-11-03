#!/usr/bin/env python3
"""Beats of a music track, for cutting on the music.
Usage: python3 tools/beats.py <music file> [<out.json>]      (default out: next to the music, <name>.beats.json)
Writes {"bpm": 110.2, "beats": [seconds...], "bars": [seconds of every 4th beat, starting on the strongest]}.
Use in a reel:  import beats from './beats.json';  const shots = onBeats(SHOTS, beats.beats);
How: spectral flux gives an onset strength curve; its autocorrelation between 70 and 180 BPM gives the tempo; the grid
offset with the most onset energy gives the phase; each beat is then moved to the strongest onset within 40 ms."""
import json, os, subprocess, sys
import numpy as np

SR, N, HOP = 22050, 1024, 256

def load(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).astype(np.float64)

def onset_curve(x):
    win = np.hanning(N)
    frames = np.lib.stride_tricks.sliding_window_view(x, N)[::HOP] * win
    mag = np.log1p(np.abs(np.fft.rfft(frames, axis=1)) * 10)
    flux = np.maximum(0, np.diff(mag, axis=0)).sum(axis=1)
    flux = np.concatenate([[0], flux])
    flux -= np.convolve(flux, np.ones(16) / 16, mode='same')          # keep what stands out from its neighbourhood
    return np.maximum(flux, 0)

def main(path, out):
    x = load(path)
    env = onset_curve(x)
    fps = SR / HOP
    ac = np.correlate(env, env, mode='full')[len(env) - 1:]
    lags = np.arange(len(ac))
    bpm_of = lambda lag: 60 * fps / lag
    ok = (lags > 60 * fps / 180) & (lags < 60 * fps / 70)
    weight = np.exp(-0.5 * (np.log2(np.maximum(bpm_of(np.maximum(lags, 1)), 1) / 115)) ** 2)   # prefer tempos near 115 when two octaves fit
    lag = lags[ok][np.argmax(ac[ok] * weight[ok])]
    period = lag / fps
    phases = np.arange(0, period, 1 / fps)
    score = [env[np.clip(np.round((np.arange(p, len(env) / fps, period)) * fps).astype(int), 0, len(env) - 1)].sum() for p in phases]
    phase = phases[int(np.argmax(score))]
    beats = []
    for b in np.arange(phase, len(x) / SR, period):
        i = int(round(b * fps)); w = int(0.04 * fps)
        lo, hi = max(0, i - w), min(len(env), i + w + 1)
        j = lo + int(np.argmax(env[lo:hi])) if hi > lo else i
        beats.append(round(j / fps, 3))
    strength = [sum(env[min(len(env) - 1, int(round(beats[k] * fps)))] for k in range(s, len(beats), 4)) for s in range(4)]
    first = int(np.argmax(strength))
    data = {'bpm': round(60 / period, 1), 'beats': beats, 'bars': beats[first::4]}
    json.dump(data, open(out, 'w'), indent=1)
    print(f'{data["bpm"]} BPM, {len(beats)} beats, {len(data["bars"])} bars -> {out}')

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(__doc__); sys.exit(1)
    src = sys.argv[1]
    main(src, sys.argv[2] if len(sys.argv) > 2 else os.path.splitext(src)[0] + '.beats.json')
