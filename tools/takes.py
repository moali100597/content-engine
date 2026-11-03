#!/usr/bin/env python3
"""Review generated takes (Omni clips) before anything is cut from them: what a person checks by eye, measured.

  python3 tools/takes.py <take.mp4 | folder> [...] [--script lines.json] [--out <dir>] [--no-words]

For every take it writes, into <dir> (default: a "review" folder next to the takes):
  <id>.jpg      contact sheet, 3 frames a second with timecodes (the review the cut is chosen from)
  review.json   per take:
    fps, seconds
    jumps        seconds where the picture jumps (an internal cut, a cross-dissolve, a pop): never cut across one
    settle       how much the first second moves compared with the rest (above 1.5: the unsettled first second is visible)
    speech       [first, last] second of the voice: first word from Whisper (VAD), moved to where the sound really starts
    words        [[start, end, word], ...] with the first word moved to the real speech onset
    script       when --script gives the line for this take: missing, extra and repeated words, and "ok"
    repeats      a run of 2+ words said twice (the model filling a 10 s take with a short line)
    range        a suggested [in, out]: after the first second (or just before the speech when it starts early, flagged),
                 through the end of the speech plus a breath, never across a jump. A suggestion: the sheet decides.
lines.json: {"<take id>": "<the line exactly as written in the script>", ...}  (take id = file name without .mp4)

The accent cannot be heard by a transcript (Fusha or Gulf come out in the same letters): the dialect stays an ear check.
Needs ffmpeg, numpy, Pillow; words need faster-whisper (medium, int8, CPU; first run downloads the model)."""
import difflib, json, os, re, subprocess, sys
import numpy as np

def probe(p):
    r = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=r_frame_rate,width,height:format=duration', '-of', 'json', p], capture_output=True, text=True)
    j = json.loads(r.stdout); s = j['streams'][0]; n, d = s['r_frame_rate'].split('/')
    return float(n) / float(d), float(j['format']['duration']), s['width'], s['height']

def gray_frames(p, w=96):
    _, _, W, H = probe(p); h = int(round(w * H / W / 2) * 2)
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-vf', f'scale={w}:{h},format=gray', '-f', 'rawvideo', '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, h, w).astype(np.float32)

def jumps(f, fps):
    """A frame-to-frame change far above its neighbours' (a cut, a dissolve start, something popping in)."""
    d = np.abs(np.diff(f, axis=0)).mean(axis=(1, 2)); out = []
    for i in range(len(d)):
        nb = np.r_[d[max(0, i - 6):max(0, i - 1)], d[i + 2:i + 7]]
        if len(nb) and d[i] > 3 * np.median(nb) and d[i] > 2: out.append(round((i + 1) / fps, 2))
    settle = float(d[:int(fps)].mean() / (np.median(d[int(fps):]) + 1e-6)) if len(d) > 2 * fps else 0.0
    return out, round(settle, 2)

def audio(p, sr=16000):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-ac', '1', '-ar', str(sr), '-f', 'f32le', '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.float32)

def energy(a, sr=16000):
    h = sr // 50
    return np.array([20 * np.log10(np.sqrt(np.mean(a[i:i + h] ** 2)) + 1e-9) for i in range(0, max(1, len(a) - h), h)])

def onset(db, w0, w0end):
    """Where the first word really starts. Whisper (with VAD) puts it 0.3 to 0.8 s early; the sound tells the truth:
    the first 20 ms block above the quiet before the word (12 dB over it, and at least -34 dB). Checked on the nine g80
    takes against the onsets read by ear: exact on seven; the two with a crowd or hooves under the voice are flagged."""
    i0 = int(max(0, w0 - 0.6) / 0.02); iw = int(w0 / 0.02) + 1
    floor = float(np.percentile(db[i0:iw], 20)) if iw > i0 else float(db.min())
    thr = max(floor + 12, -34)
    busy = floor > -50 or bool((db[i0:iw] > thr).mean() > 0.3)   # a room, crowd or animals under the voice: the level cannot tell
    for i in range(max(i0, int((w0 - 0.3) / 0.02)), int(w0end / 0.02)):
        if db[i] > thr: return round(i * 0.02, 2), busy
    return round(w0, 2), busy

_model = None
def words(a):
    global _model
    from faster_whisper import WhisperModel
    if _model is None: _model = WhisperModel('medium', device='cpu', compute_type='int8')
    segs, _ = _model.transcribe(a, language='ar', word_timestamps=True, vad_filter=True)
    return [[round(float(w.start), 2), round(float(w.end), 2), w.word.strip()] for s in segs for w in s.words]

# Whisper writes Egyptian speech in its own spelling (والألوب for والقلوب, بنضور for بندور, ميسا for مايسة): compare
# sounds, not letters. ق is said as a glottal stop in Cairo; emphatic and plain pairs and long vowels are merged.
AR = str.maketrans({'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ى': 'ي', 'ة': 'ه', 'ؤ': 'ا', 'ئ': 'ا', 'ء': 'ا', 'ق': 'ا', 'ض': 'د', 'ظ': 'ز', 'ذ': 'د', 'ث': 'ت', 'ص': 'س', 'ط': 'ت'})
def norm(w): return re.sub(r'[ً-ْـ،,.!?؟"\']', '', w).translate(AR)

def script_check(said, line):
    a, b = [norm(w) for w in line.split()], [norm(w) for w in said]
    sm = difflib.SequenceMatcher(None, a, b); missing, extra = [], []
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op == 'replace' and i2 - i1 == j2 - j1 and all(difflib.SequenceMatcher(None, a[i1 + k], b[j1 + k]).ratio() >= 0.5 for k in range(i2 - i1)):
            continue                                                       # the same word heard in another spelling
        if op in ('delete', 'replace'): missing += line.split()[i1:i2]
        if op in ('insert', 'replace'): extra += said[j1:j2]
    return {'missing': missing, 'extra': extra, 'match': round(sm.ratio(), 2), 'ok': not missing and not extra}

def repeats(said):
    n = [norm(w) for w in said]
    for k in range(min(6, len(n) // 2), 1, -1):
        for i in range(len(n) - 2 * k + 1):
            for j in range(i + k, len(n) - k + 1):
                if n[i:i + k] == n[j:j + k]: return ' '.join(said[i:i + k])
    return None

def suggest(seconds, js, sp):
    start = 1.0; note = None
    if sp and sp[0] < 1.5:
        start = max(0.5, sp[0] - 0.5); note = 'speech starts inside the first second: in point before 1 s, check the sheet'
    end = seconds - 0.05
    if sp: end = min(end, sp[1] + 1.6)
    for j in js:                                   # never across a jump: stop before the first one after the in point
        if start < j < end: end = j - 0.05; break
    for j in js:
        if j <= start + 0.1 and j > start - 0.5: start = j + 0.05
    return [round(float(start), 2), round(float(end), 2)], note

def sheet(p, out, fps_sheet=3):
    from PIL import Image  # noqa: F401 (ffmpeg does the drawing; Pillow only to confirm the file opens)
    ff = ['ffmpeg', '-v', 'error', '-y', '-i', p, '-vf', f"fps={fps_sheet},scale=180:-1,drawtext=text='%{{pts\\:hms}}':x=4:y=4:fontsize=16:fontcolor=yellow:box=1:boxcolor=black@0.6,tile=10x3", '-frames:v', '1', out]
    subprocess.run(ff, check=True)

def main(argv):
    args, script, out, want_words = [], {}, None, True
    i = 0
    while i < len(argv):
        if argv[i] == '--script': script = json.load(open(argv[i + 1], encoding='utf-8')); i += 2
        elif argv[i] == '--out': out = argv[i + 1]; i += 2
        elif argv[i] == '--no-words': want_words = False; i += 1
        else: args.append(argv[i]); i += 1
    takes = []
    for a in args:
        takes += sorted(os.path.join(a, f) for f in os.listdir(a) if f.lower().endswith('.mp4')) if os.path.isdir(a) else [a]
    if not takes: sys.exit(__doc__)
    out = out or os.path.join(os.path.dirname(takes[0]) or '.', 'review'); os.makedirs(out, exist_ok=True)
    report = {}
    for p in takes:
        tid = os.path.splitext(os.path.basename(p))[0]
        fps, seconds, _, _ = probe(p)
        js, settle = jumps(gray_frames(p), fps)
        a = audio(p); db = energy(a); sp = None
        r = {'fps': round(fps, 3), 'seconds': round(seconds, 2), 'jumps': js, 'settle': settle}
        w = words(a) if want_words else []
        if w:
            on, busy = onset(db, w[0][0], w[0][1]); w[0][0] = on
            sp = [on, w[-1][1]]
            if busy: r['note_speech'] = 'sound under the first word (crowd, hooves, music): its onset is uncertain, read it on the sheet'
            r['words'] = w
            said = [x[2] for x in w]
            r['repeats'] = repeats(said)
            if tid in script: r['script'] = script_check(said, script[tid])
        r['speech'] = sp
        r['range'], note = suggest(seconds, js, sp)
        if note: r['note'] = note
        sheet(p, os.path.join(out, f'{tid}.jpg'))
        report[tid] = r
        flags = [f'{len(js)} jump(s) at {js}' if js else '', f'unsettled start x{settle}' if settle > 1.5 else '',
                 f'repeats "{r["repeats"]}"' if r.get('repeats') else '', '' if r.get('script', {}).get('ok', True) else f'script: missing {r["script"]["missing"]} extra {r["script"]["extra"]}']
        flags.append('onset uncertain' if r.get('note_speech') else '')
        print(f'{tid}: {seconds:.2f} s @ {fps:g} fps, speech {sp}, range {r["range"]}  ' + '  '.join(x for x in flags if x))
    json.dump(report, open(os.path.join(out, 'review.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'-> {out}/review.json and one contact sheet per take')

if __name__ == '__main__':
    main(sys.argv[1:])
