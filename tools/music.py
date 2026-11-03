#!/usr/bin/env python3
"""Music for a film. First look at our own composed tracks, then at free ones.

  python3 tools/music.py ours [words]
      our own library: Lyria 3 Pro tracks (`node tools/gen.mjs music`, takes kept for later work) and picks from the YouTube
      Audio Library (`yt-<style>-<title>.mp3`, no attribution), all in music/library/ (index: music/library/README.md), plus
      the film folders (music/<video>/); matches words against the name and the plan; prints length and bpm
  Free: search Kevin MacLeod's catalogue (incompetech.com, CC BY 4.0), fetch a piece, credit it.

  python3 tools/music.py find <words> [--instrument piano] [--max 4:00] [--bpm 70-110] [--n 15]
      searches title, feel, genre, instruments and description of all ~1,450 pieces; prints the best matches
      e.g.  find nostalgic warm --instrument piano     find uplifting strings --max 3:00
  python3 tools/music.py get "<exact title>"
      downloads it to music/incompetech-<slug>.mp3, writes its beats (tools/beats.py) and adds its row to
      music/CREDITS.md with the credit line to post with the piece
Listening decides. Read the loudness curve of a candidate with `python3 tools/beats.py` output and the bars before
placing it: a section that builds belongs under the ending, the quiet intro under the opening."""
import json, os, re, subprocess, sys, urllib.parse, urllib.request

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
CACHE = os.path.join(ROOT, 'music', '.incompetech-pieces.json')
URL = 'https://incompetech.com/music/royalty-free/pieces.json'

def pieces():
    if not os.path.exists(CACHE):
        os.makedirs(os.path.dirname(CACHE), exist_ok=True)
        urllib.request.urlretrieve(URL, CACHE)
    return json.load(open(CACHE, encoding='utf-8'))

def secs(s):
    p = [int(x) for x in str(s).split(':')]
    return sum(v * 60 ** i for i, v in enumerate(reversed(p)))

def find(a):
    opt = lambda k: a[a.index(k) + 1] if k in a else None
    skip = {i for i, x in enumerate(a) if x.startswith('--')} | {i + 1 for i, x in enumerate(a) if x.startswith('--')}
    words = [w.lower() for i, w in enumerate(a) if i not in skip]
    inst, mx, bpm, n = opt('--instrument'), opt('--max'), opt('--bpm'), int(opt('--n') or 15)
    rows = []
    for p in pieces():
        text = ' '.join(str(p.get(k) or '') for k in ('title', 'feel', 'genre', 'instruments', 'description')).lower()
        if inst and inst.lower() not in str(p.get('instruments') or '').lower(): continue
        if mx and secs(p.get('length') or '0') > secs(mx): continue
        if bpm and p.get('bpm'):
            lo, hi = map(int, bpm.split('-'))
            if not lo <= int(p['bpm']) <= hi: continue
        if re.search(r'\b(dark|horror|creepy|eerie)\b', text) and not any(w in ('dark', 'horror', 'creepy', 'eerie') for w in words): continue
        score = sum(text.count(w) * (3 if w in str(p.get('feel') or '').lower() else 1) for w in words)
        if score: rows.append((score, p))
    for score, p in sorted(rows, key=lambda r: -r[0])[:n]:
        print(f"{p['title']}  |  {p.get('feel')}  |  {p.get('instruments')}  |  {p.get('length')}  |  {p.get('bpm') or '-'} bpm\n    {(p.get('description') or '')[:160]}")

def ours(words):
    import glob
    words = [w.lower() for w in words]
    files = set(glob.glob(os.path.join(ROOT, 'music', 'library', '*.mp3'))) | set(glob.glob(os.path.join(ROOT, 'music', '**', '*lyria*.mp3'), recursive=True))
    for f in sorted(files):
        meta = json.load(open(f + '.json', encoding='utf-8')) if os.path.exists(f + '.json') else {}
        plan = meta.get('structure') or ''
        text = (os.path.basename(f) + ' ' + plan).lower()
        if words and not all(w in text for w in words): continue
        dur = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], capture_output=True, text=True).stdout.strip()
        bpm = re.search(r'bpm: ([\d.]+)', plan)
        bpm = bpm.group(1) if bpm else None
        beats = f[:-4] + '.beats.json'
        if not bpm and os.path.exists(beats): bpm = f"{json.load(open(beats))['bpm']} (measured)"
        print(f"{os.path.relpath(f, ROOT)}  |  {float(dur or 0):.0f} s  |  {bpm or '-'} bpm")
        first = re.search(r'\[0\.0:\] (.+)', plan)
        print('    ' + (first.group(1) if first else plan)[:160])

def get(title):
    p = next((x for x in pieces() if x['title'].lower() == title.lower()), None)
    if not p: sys.exit(f'no piece called "{title}" (use find)')
    slug = re.sub(r'[^a-z0-9]+', '-', p['title'].lower()).strip('-')
    out = os.path.join(ROOT, 'music', f'incompetech-{slug}.mp3')
    urllib.request.urlretrieve('https://incompetech.com/music/royalty-free/mp3-royaltyfree/' + urllib.parse.quote(p['filename']), out)
    subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'beats.py'), out])
    credits = os.path.join(ROOT, 'music', 'CREDITS.md')
    row = f'| {os.path.basename(out)} | "{p["title"]}", Kevin MacLeod, incompetech.com | CC BY 4.0 | Music: "{p["title"]}" Kevin MacLeod (incompetech.com), CC BY 4.0 |'
    if os.path.basename(out) not in open(credits, encoding='utf-8').read():
        with open(credits, 'a', encoding='utf-8') as f: f.write(row + '\n')
    print(out)

if __name__ == '__main__':
    a = sys.argv[1:]
    if not a or a[0] not in ('find', 'get', 'ours'): sys.exit(__doc__)
    find(a[1:]) if a[0] == 'find' else ours(a[1:]) if a[0] == 'ours' else get(' '.join(a[1:]))
