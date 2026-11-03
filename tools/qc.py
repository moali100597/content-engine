#!/usr/bin/env python3
"""Check a finished render before anyone watches it: the checks done by hand after every render until now.

  python3 tools/qc.py <render.mp4> [--mix public/<video>/mix.wav] [--fps 24] [--seconds 62.4] [--sheet out.jpg]

Prints one line per check and PASS or FAIL at the end (exit code 1 on a fail):
  size, fps, length    against --fps / --seconds when given (the length of the mix when --mix is given)
  repeated frames      share of frames identical to the one before (a 24 fps source on a 30 fps timeline repeats every
                       4th frame: about 20%; holds and the end card's still frame count too, so read it with the film)
  loudness             integrated LUFS and true peak (target -14 LUFS, peak at most -1 dBTP)
  sound is the mix     the render's sound follows the mix it should carry (envelope correlation above 0.98): catches a
                       render made before the last mix was copied in
  sheet                a contact sheet of the whole film, one frame every 3 s (default <render>-sheet.jpg)
Needs ffmpeg and ffprobe; the mix comparison also needs numpy."""
import json, re, subprocess, sys

def run(cmd): return subprocess.run(cmd, capture_output=True, text=True)

def main(a):
    if not a: sys.exit(__doc__)
    src = a[0]; opt = lambda k: a[a.index(k) + 1] if k in a else None
    fails = []
    j = json.loads(run(['ffprobe', '-v', 'error', '-show_entries', 'stream=codec_type,width,height,r_frame_rate,nb_frames:format=duration', '-of', 'json', src]).stdout)
    v = next(s for s in j['streams'] if s['codec_type'] == 'video'); has_audio = any(s['codec_type'] == 'audio' for s in j['streams'])
    n, d = v['r_frame_rate'].split('/'); fps = float(n) / float(d); dur = float(j['format']['duration'])
    print(f"size        {v['width']}x{v['height']}, {fps:g} fps, {dur:.2f} s, sound {'yes' if has_audio else 'NO'}")
    if not has_audio: fails.append('no sound')
    if opt('--fps') and abs(fps - float(opt('--fps'))) > 0.01: fails.append(f'fps {fps:g}, expected {opt("--fps")}')
    want = float(opt('--seconds')) if opt('--seconds') else None
    if opt('--mix'):
        want = want or float(run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', opt('--mix')]).stdout)
    if want and abs(dur - want) > 0.15: fails.append(f'length {dur:.2f} s, expected {want:.2f} s')
    # repeated frames: mpdecimate drops a frame that matches the one before
    kept = len(re.findall(r'pts_time', run(['ffmpeg', '-hide_banner', '-i', src, '-vf', 'mpdecimate=hi=64*4:lo=64*2:frac=0.33,showinfo', '-an', '-f', 'null', '-']).stderr))
    total = round(dur * fps); rep = 100 * (1 - kept / max(1, total))
    print(f'repeated    {rep:.1f}% of {total} frames repeat the frame before')
    if has_audio:
        e = run(['ffmpeg', '-hide_banner', '-i', src, '-af', 'ebur128=peak=true', '-f', 'null', '-']).stderr
        I = float(re.findall(r'I:\s+(-?[\d.]+) LUFS', e)[-1]); P = float(re.findall(r'Peak:\s+(-?[\d.]+) dBFS', e)[-1])
        print(f'loudness    {I:.1f} LUFS, true peak {P:.1f} dBTP')
        if abs(I + 14) > 1: fails.append(f'loudness {I:.1f} LUFS (target -14)')
        if P > -0.5: fails.append(f'true peak {P:.1f} dBTP (at most -1)')
    if opt('--mix') and has_audio:
        import numpy as np
        pcm = lambda p: np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-ac', '1', '-ar', '8000', '-f', 'f32le', '-'], capture_output=True).stdout, np.float32)
        x, y = pcm(src), pcm(opt('--mix')); m = min(len(x), len(y)); h = 800
        env = lambda s: np.array([np.sqrt(np.mean(s[i:i + h] ** 2)) for i in range(0, m - h, h)])
        c = float(np.corrcoef(env(x[:m]), env(y[:m]))[0, 1])
        print(f'sound       follows {opt("--mix")}: correlation {c:.4f}')
        if c < 0.98: fails.append('the sound is not the latest mix (render again after copying the mix)')
    sheet = opt('--sheet') or re.sub(r'\.mp4$', '', src) + '-sheet.jpg'
    cols = 10; rows = max(1, -(-int(dur // 3 + 1) // cols))
    run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-vf', f"fps=1/3,scale=180:-1,drawtext=text='%{{pts\\:hms}}':x=4:y=4:fontsize=14:fontcolor=yellow:box=1:boxcolor=black@0.6,tile={cols}x{rows}", '-frames:v', '1', sheet])
    print(f'sheet       {sheet}')
    print('FAIL: ' + '; '.join(fails) if fails else 'PASS')
    sys.exit(1 if fails else 0)

if __name__ == '__main__':
    main(sys.argv[1:])
