#!/usr/bin/env python3
"""Caption cues from a voice-over: where each caption starts and ends in the audio.
Usage: python3 tools/cues.py <audio> <captions.txt> <out cues.json>
       python3 tools/cues.py --draft <script.txt> <captions.txt>     first draft of the captions file, cut at punctuation
captions.txt holds one caption per line, written as it should appear on screen (digits allowed), in spoken order.
Break a long sentence into two lines only where the voice actually pauses.
How: pauses are found in the audio; each line break is matched to the pause closest to where it should fall if speech ran
at an even pace (each caption's length against its share of the letters, over speech time only), preferring longer pauses. It does not listen to the words.
After running it, check the cues it lists as odd, plus 3 or 4 others, by ear or against frames."""
import json, re, subprocess, sys
import numpy as np

SR = 16000

def draft(text):
    out = []
    for para in re.split(r'\n\s*\n', text.strip()):
        out += [p.strip() for p in re.findall(r'[^،.:؟!?,;؛\n]+[،.:؟!?,;؛]*', para.replace('\n', ' ')) if re.search(r'\w', p)]
    return out

def weight(p):  # spoken length in letters; a digit is said as a whole word
    return len(re.sub(r'[\W\d]', '', p)) + 4 * len(re.findall(r'\d', p))

def pauses(x, min_len=0.1):
    """Silent stretches as (start, end) seconds: 20 ms frames more than 32 dB under the loud level."""
    n = int(0.02 * SR); f = x[:len(x) // n * n].reshape(-1, n)
    db = 20 * np.log10(np.sqrt((f ** 2).mean(1)) + 1e-9)
    quiet = db < np.percentile(db, 95) - 32
    out, i = [], 0
    while i < len(quiet):
        if quiet[i]:
            j = i
            while j < len(quiet) and quiet[j]: j += 1
            if (j - i) * 0.02 >= min_len: out.append((i * 0.02, j * 0.02))
            i = j
        else: i += 1
    return out

def main(audio, script, out_path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', audio, '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    x = np.frombuffer(raw, np.float32); dur = len(x) / SR
    ph = [l.strip() for l in open(script, encoding='utf8').read().splitlines() if l.strip()]
    gaps = pauses(x)
    lead = gaps[0][1] if gaps and gaps[0][0] < 0.05 else 0.0
    tail = gaps[-1][0] if gaps and gaps[-1][1] > dur - 0.05 else dur
    inner = [g for g in gaps if g[0] >= lead and g[1] <= tail and g[0] > 0.05 and g[1] < dur - 0.05]
    if len(inner) < len(ph) - 1: raise SystemExit(f'{len(ph)} captions but only {len(inner)} pauses found: join some lines')
    # Speech time (silence removed) at each pause; a caption's length should match its share of the letters.
    sil_before = np.cumsum([0] + [b - a for a, b in inner])[:-1]
    speech_total = (tail - lead) - sum(b - a for a, b in inner)
    at = np.concatenate([[0.0], [(a - lead - s) for (a, b), s in zip(inner, sil_before)], [speech_total]])   # 0 = start, last = end
    letters = np.array([weight(p) + 3 for p in ph], float)                    # +3: every caption has a little fixed overhead
    want = speech_total * letters / letters.sum()
    glen = np.concatenate([[0.6], [b - a for a, b in inner], [0.6]])
    N, G = len(ph), len(at)
    cost = np.full((N + 1, G), np.inf); cost[0, 0] = 0; back = np.zeros((N + 1, G), int)
    for k in range(1, N + 1):
        for g in range(k, G):
            if k < N and g == G - 1: continue
            prev = np.arange(k - 1, g)
            c = cost[k - 1, prev] + ((at[g] - at[prev] - want[k - 1]) / (0.3 + 0.3 * want[k - 1])) ** 2
            j = int(np.argmin(c)); cost[k, g] = c[j] - 1.5 * min(glen[g], 0.6); back[k, g] = prev[j]
    g = G - 1; pick = []
    for k in range(N, 0, -1): g = back[k, g]; pick.append(g - 1)
    pick = pick[::-1][1:]                                                     # inner pause index for each caption break
    starts = [lead] + [inner[i][1] for i in pick]; ends = [inner[i][0] for i in pick] + [tail]
    cues = [{'i': i, 'start': round(s, 2), 'end': round(e, 2), 'text': t} for i, (s, e, t) in enumerate(zip(starts, ends, ph))]
    json.dump({'audio': audio.replace('\\', '/').split('/')[-1], 'duration': round(dur, 2), 'cues': cues}, open(out_path, 'w', encoding='utf8'), ensure_ascii=False, indent=1)
    rate = [weight(c['text']) / max(0.2, c['end'] - c['start']) for c in cues]
    odd = [c['i'] for c, r in zip(cues, rate) if r > np.median(rate) * 1.9 or r < np.median(rate) / 1.9]
    print(f'{len(cues)} cues, {dur:.2f} s -> {out_path}' + (f'   check these by ear (pace looks off): {odd}' if odd else ''))

if __name__ == '__main__':
    if sys.argv[1] == '--draft':
        lines = draft(open(sys.argv[2], encoding='utf8').read()); open(sys.argv[3], 'w', encoding='utf8').write('\n'.join(lines) + '\n'); print(f'{len(lines)} lines -> {sys.argv[3]}')
    else: main(*sys.argv[1:4])
