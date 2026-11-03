"""Reading time without slowing anything: after every spoken shot add a little more of the same take's own footage
(the take keeps playing, no frozen frame, no stretched voice). A shot is only lengthened when the take really has that
footage and the added part is quiet (no words of the next line), measured on the take's own sound.
  python3 tools/breathe.py <video dir> <seconds> [--dry]      e.g. python3 tools/breathe.py src/videos/my-video 0.3"""
import sys, json, os, subprocess
import numpy as np
vd, add = sys.argv[1], float(sys.argv[2]); dry = '--dry' in sys.argv
E = json.load(open(os.path.join(vd, 'edit.json')))
def take(src):
    p = os.path.join('public', src)
    x = np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-vn', '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'], capture_output=True).stdout, np.float32)
    return x
plan = []
for s in E['shots']:
    if not s.get('words') or str(s['words'][0][2]).startswith('('): continue      # silent shots: establishing, wind
    if s['id'].startswith('h'): continue      # the hook stays tight: it is the first second that stops the scroll
    x = take(s['src']); n = len(x) / 16000
    a, b = s['in'] + s['dur'], s['in'] + s['dur'] + add
    if b > n - 0.05: plan.append([s['id'], 0, 'no footage']); continue
    e = 20 * np.log10(np.sqrt((x[:len(x) // 800 * 800].reshape(-1, 800) ** 2).mean(1)) + 1e-9)
    floor = np.percentile(e, 20); seg = e[int(a / 0.05):int(b / 0.05) + 1]
    if seg.max() > floor + 12: plan.append([s['id'], 0, f'words after the cut ({seg.max() - floor:.0f} dB over room)']); continue
    plan.append([s['id'], add, 'ok'])
for p in plan: print(*p)
if not dry:
    for sid, d, why in plan:
        if d: subprocess.run([sys.executable, 'tools/extend_shot.py', vd, sid, str(d)], check=True)
