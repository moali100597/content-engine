#!/usr/bin/env python3
"""Build the whole soundtrack of one video with one command.
Usage: python3 tools/audio.py <video>          e.g.  python3 tools/audio.py hello-film
Reads  src/videos/<video>/sfx-cues.json:
  duration  story seconds (the original voice-over clock)
  speed     voice-over playback speed (1 = untouched). Cue times stay in story seconds.
  voice     {"src": "vo/<file>", "filter": "<ffmpeg filters>"}   filter is optional; default is loudness only.
            Rule: no tone processing on the voice unless it was approved by ear on a 10 s sample.
  music     {"src": "music/<file>", "db": -6, "dips": [[from, to], [from, to, gain], ...]}   optional; story seconds where the bed drops (0.55), or takes the given gain (above 1 lifts it, e.g. after the voice ends)
  cues      sound effects, see tools/sfx.py
  loudness  integrated LUFS of the finished mix (default -14, true peak -1 dBTP). YouTube turns anything louder down to -14;
            TikTok and Meta publish no target and sit near -14. A hotter master (-11) is a deliberate choice for a loud feed.
Writes public/<video>/vo.wav, sfx.wav and mix.wav (voice + effects + music ducked under the voice, limited, then brought to the loudness target).

A film cut from speaking takes (a film cut from talking footage) has no voice-over file: its sfx-cues.json names
the cut's timeline instead, and the dialogue is built from the takes themselves:
  timeline  "edit.json" (in the video folder): {total, shots: [{id, src, in, dur, tr, start, words}]}; picture and sound read it
  dialogue  {"level": -20, "voice": "public/<v>/dia.voice.mp3", "room": {"src": "public/<v>/dia.amb.wav", "db": -3}}
            every take's line is levelled to `level` LUFS (measured on its words only) and placed on the film clock; the whole
            track is written to public/<v>/dia.wav (what goes to Demucs and the voice changer); once the converted `voice`
            exists it replaces the takes' voices, and `room` (the takes' sound without the voice) goes back under it
  music     a list of pieces placed on the film: {"src", "from" (second of the piece), "at", "until" or "len", "lufs" (the level
            of the part that plays), "in"/"out" (fades), "filter" (e.g. a TV speaker)}; times may name the cut:
            "@s3" (start of shot s3), "@s3.end", "@s3.tr" (its arrival), "end" (the film's end), with + and -
  cues      sounds placed on the film: {"src": "<wav>", "at": <time>, "db": -14}
  duck      the music under the dialogue: {"threshold", "ratio", "attack", "release"}"""
import json, os, re, subprocess, sys
sys.path.insert(0, os.path.dirname(__file__))
import sfx

ROOT = os.path.join(os.path.dirname(__file__), '..')

def ff(args):
    subprocess.run(['ffmpeg', '-v', 'error', '-y'] + args, check=True, cwd=ROOT)

def loudness(path, target):
    """First pass of ffmpeg's loudnorm: the measured loudness of a file."""
    r = subprocess.run(['ffmpeg', '-hide_banner', '-i', path, '-af', f'loudnorm=I={target}:TP=-1:LRA=11:print_format=json', '-f', 'null', '-'], capture_output=True, text=True, cwd=ROOT)
    return json.loads(re.findall(r'\{[^{}]*\}', r.stderr)[-1])

def takes_film(video, spec):
    vdir = os.path.join(ROOT, 'src', 'videos', video)
    E = json.load(open(os.path.join(vdir, spec['timeline']), encoding='utf-8'))
    SH, TOTAL, SR = E['shots'], spec.get('total', E['total']), 48000   # a longer version of the same cut (an extra ending) sets its own total
    idx = {s['id']: s for s in SH}
    # reading-time holds (edit.json "holds": [[story s, seconds], ...]): the story stops, the music plays on
    H = sorted(E.get('holds', [])); HT = sum(d for _, d in H)
    def mp(t): return t + sum(d for a, d in H if a < t - 1e-6)    # story second -> film second
    OUT_T = TOTAL + HT
    def at(x):
        if isinstance(x, (int, float)): return float(x)
        expr = re.sub(r'@([\w]+)\.end', lambda m: str(idx[m.group(1)]['start'] + idx[m.group(1)]['dur']), x)
        expr = re.sub(r'@([\w]+)\.tr', lambda m: str(idx[m.group(1)]['tr']), expr)
        expr = re.sub(r'@([\w]+)', lambda m: str(idx[m.group(1)]['start']), expr).replace('end', str(TOTAL))
        if not re.fullmatch(r'[\d.+\- ]+', expr): sys.exit(f'bad time "{x}"')
        return float(eval(expr))
    def lufs(path, extra=''):
        r = subprocess.run(['ffmpeg', '-hide_banner', '-i', path, '-af', (extra + ',' if extra else '') + 'loudnorm=print_format=json', '-f', 'null', '-'], capture_output=True, text=True, cwd=ROOT)
        return json.loads(re.findall(r'\{[^{}]*\}', r.stderr)[-1])
    out = os.path.join('public', video); d = spec.get('dialogue', {}); level = d.get('level', -20)
    # 1. dialogue: one stem per take, levelled on its words, on the film clock
    stems = []
    for i, s in enumerate(SH):
        if not s.get('words'): continue                  # a silent shot (a reaction) adds no dialogue
        nxt = s.get('tail', max(0.04, SH[i + 1]['tr']) if i + 1 < len(SH) else 0.6)   # a hard cut still gets a 40 ms tail (no click); 'tail' overrides (a cut word)
        src = os.path.join('public', s['src']); w0, w1 = s['words'][0][0], s['words'][-1][1]
        if w1 - w0 < 0.6: c = (w0 + w1) / 2; w0, w1 = max(0.0, c - 0.3), c + 0.3   # loudness needs >= 0.4 s of audio: a one-word line measured on 0.35 s reads silent and gets +50 dB
        gain = s.get('level', level) - float(lufs(src, f'atrim={w0}:{w1}')['input_i'])   # a shot may set its own level (a whisper stays a whisper)
        stem = os.path.join(out, f'_d{i}.wav')
        ff(['-ss', str(s['in']), '-t', str(s['dur'] + nxt), '-i', src, '-af',
            f"highpass=f={d.get('highpass', 70)},volume={gain:.2f}dB,apad=whole_dur={s['dur'] + nxt},afade=t=in:d={max(0.08, s['tr'])},afade=t=out:st={s['dur']:.3f}:d={nxt}",
            '-ar', str(SR), '-ac', '1', stem])
        stems.append((stem, s['start'])); print(f"{s['id']}: line levelled {gain:+.1f} dB")
    if not stems:                                        # a cut with no spoken line (music and effects only): one silent stem keeps the graph whole
        ff(['-f', 'lavfi', '-t', f'{TOTAL:.3f}', '-i', f'anullsrc=r={SR}:cl=mono', f'{out}/_silence.wav']); stems = [(f'{out}/_silence.wav', 0.0)]
    ins = sum((['-i', st] for st, _ in stems), [])
    ff(ins + ['-filter_complex', ''.join(f'[{j}:a]adelay={int(a * 1000)}:all=1,apad=whole_dur={TOTAL}[d{j}];' for j, (_, a) in enumerate(stems))
        + ''.join(f'[d{j}]' for j in range(len(stems))) + f'amix=inputs={len(stems)}:normalize=0[o]', '-map', '[o]', '-t', f'{TOTAL:.3f}', '-ar', str(SR), '-ac', '1', f'{out}/dia.wav'])
    voice = d.get('voice'); room = d.get('room') if voice and os.path.exists(os.path.join(ROOT, voice)) else None
    if voice and os.path.exists(os.path.join(ROOT, voice)):
        gain = float(lufs(f'{out}/dia.wav')['input_i']) - float(lufs(voice)['input_i'])
        ff(['-i', voice, '-af', f'volume={gain:.2f}dB,apad=whole_dur={TOTAL}', '-t', f'{TOTAL:.3f}', '-ar', str(SR), '-ac', '1', f'{out}/_dvoice.wav'])
        for st, _ in stems: os.remove(os.path.join(ROOT, st))
        stems = [(f'{out}/_dvoice.wav', 0.0)]; print(f'dialogue: the converted voice {voice} ({gain:+.1f} dB to match the takes)')
    if room and not os.path.exists(os.path.join(ROOT, room['src'])): room = None
    def held(src, dst, cl):
        """A story-clock track laid out on the film clock: cut at every hold, silence for its length."""
        g, prev = '', 0.0
        for i, (a, dd) in enumerate(H):
            g += f'[0:a]atrim={prev:.4f}:{a:.4f},asetpts=PTS-STARTPTS[s{i}];anullsrc=r={SR}:cl={cl},atrim=0:{dd:.4f}[z{i}];'; prev = a
        g += f'[0:a]atrim={prev:.4f},asetpts=PTS-STARTPTS[s{len(H)}];' + ''.join(f'[s{i}][z{i}]' for i in range(len(H))) + f'[s{len(H)}]concat=n={2 * len(H) + 1}:v=0:a=1[o]'
        ff(['-i', src, '-filter_complex', g, '-map', '[o]', '-ar', str(SR), '-ac', '1' if cl == 'mono' else '2', dst])
    if H:
        src = stems[0][0] if len(stems) == 1 and stems[0][1] == 0.0 else f'{out}/dia.wav'
        held(src, f'{out}/_dhold.wav', 'mono')
        for st, _ in stems:
            if os.path.exists(os.path.join(ROOT, st)): os.remove(os.path.join(ROOT, st))
        stems = [(f'{out}/_dhold.wav', 0.0)]
        if room:
            held(room['src'], f'{out}/_rhold.wav', 'stereo'); room = dict(room, src=f'{out}/_rhold.wav')
        print(f'holds: {len(H)}, +{HT:.2f} s (story {TOTAL:.2f} s -> film {OUT_T:.2f} s)')
    # 2. music pieces and cues on the film clock
    music = []
    for m in spec.get('music', []):
        s0 = at(m.get('at', 0)); a0 = mp(s0); ss = at(m['from']) if 'from' in m else 0.0
        ln = mp(at(m['until'])) - a0 if 'until' in m else mp(s0 + at(m['len'])) - a0 if 'len' in m else float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', m['src']], capture_output=True, text=True, cwd=ROOT).stdout)
        g = m['lufs'] - float(lufs(m['src'], f'atrim={ss:.3f}:{ss + ln:.3f}')['input_i'])
        fl = f"volume={g:.2f}dB" + (f",{m['filter']}" if m.get('filter') else '') + f",afade=t=in:d={m.get('in', 0.5)},afade=t=out:st={ln - m.get('out', 1.0):.2f}:d={m.get('out', 1.0)}"
        music.append((m['src'], ss, ln, a0, fl)); print(f"music {os.path.basename(m['src'])} {ss:.1f}+{ln:.1f} s at {a0:.2f}, {g:+.2f} dB")
    args, chains, labels = [], [], []
    for j, (stem, a) in enumerate(stems):
        args += ['-i', stem]; chains.append(f'[{j}:a]adelay={int(a * 1000)}:all=1,apad=whole_dur={OUT_T}[d{j}]'); labels.append(f'[d{j}]')
    n = len(stems); mlabels = []
    for j, (p, ss, ln, a, fl) in enumerate(music):
        args += ['-ss', f'{ss:.3f}', '-t', f'{ln:.3f}', '-i', p]
        chains.append(f'[{n + j}:a]aformat=sample_rates={SR}:channel_layouts=stereo,{fl},adelay={int(a * 1000)}:all=1,apad=whole_dur={OUT_T}[m{j}]'); mlabels.append(f'[m{j}]')
    n += len(music); extra = []
    if room:
        args += ['-i', room['src']]; chains.append(f"[{n}:a]aformat=sample_rates={SR}:channel_layouts=stereo,volume={room.get('db', -3)}dB,apad=whole_dur={OUT_T}[room]"); extra.append('[room]'); n += 1
    for j, c in enumerate(spec.get('cues', [])):
        args += ['-i', c['src']]; chains.append(f"[{n}:a]aformat=sample_rates={SR}:channel_layouts=stereo,volume={c.get('db', -14)}dB,adelay={int(mp(at(c['at'])) * 1000)}:all=1,apad=whole_dur={OUT_T}[c{j}]"); extra.append(f'[c{j}]'); n += 1
    k = spec.get('duck', {})
    g = ';'.join(chains)
    g += f";{''.join(labels)}amix=inputs={len(labels)}:normalize=0,pan=stereo|c0=c0|c1=c0,asplit=2[dia][key]"
    g += f";{''.join(mlabels)}amix=inputs={len(mlabels)}:normalize=0[mus]"
    g += f";[mus][key]sidechaincompress=threshold={k.get('threshold', 0.02)}:ratio={k.get('ratio', 5)}:attack={k.get('attack', 60)}:release={k.get('release', 520)}:makeup=1[duck]"
    g += f";[dia][duck]{''.join(extra)}amix=inputs={2 + len(extra)}:normalize=0,alimiter=limit=0.89:attack=3:release=60:level=disabled[out]"
    ff(args + ['-filter_complex', g, '-map', '[out]', '-t', f'{OUT_T:.3f}', '-ar', str(SR), f'{out}/mix.pre.wav'])
    for st, _ in stems: os.remove(os.path.join(ROOT, st))
    if room and room['src'].endswith('_rhold.wav'): os.remove(os.path.join(ROOT, room['src']))
    return OUT_T

def main(video):
    spec_path = os.path.join(ROOT, 'src', 'videos', video, 'sfx-cues.json')
    spec = json.load(open(spec_path, encoding='utf-8'))
    out = os.path.join('public', video); os.makedirs(os.path.join(ROOT, out), exist_ok=True)
    if 'timeline' in spec:
        real = takes_film(video, spec)
        master(video, out, spec, real)
        return
    speed = spec.get('speed', 1.0); real = spec['duration'] / speed
    v = spec['voice']; chain = [v['filter']] if v.get('filter') else []
    if abs(speed - 1) > 1e-3: chain.append(f'rubberband=tempo={speed}:formant=preserved:pitchq=quality')
    chain.append('loudnorm=I=-17:TP=-1.5:LRA=11')
    ff(['-i', v['src'], '-af', ','.join(chain), '-ar', '48000', '-ac', '1', f'{out}/vo.wav'])
    sfx.main(spec_path, os.path.join(ROOT, out, 'sfx.wav'))
    inputs = ['-i', f'{out}/vo.wav', '-i', f'{out}/sfx.wav']
    graph = f'[0:a]pan=stereo|c0=c0|c1=c0,asplit=2[v][sc0];[sc0]apad=whole_dur={real:.3f}[sc];[1:a]volume=-2dB[s];'   # the key is padded: the music must not stop when the voice does
    m = spec.get('music')
    if m:
        dips = ''.join(f",volume='if(between(t,{a / speed:.2f},{b / speed:.2f}),{(k or [0.55])[0]},1)':eval=frame" for a, b, *k in m.get('dips', []))
        inputs += ['-i', m['src']]
        graph += (f"[2:a]atrim=0:{real},acompressor=threshold=-24dB:ratio=4:attack=30:release=600,volume={m.get('db', -6)}dB{dips},"
                  f"afade=t=in:d=0.4,afade=t=out:st={real - 3:.2f}:d=3,aformat=channel_layouts=stereo[m0];"
                  "[m0][sc]sidechaincompress=threshold=0.03:ratio=3:attack=40:release=450[m];[v][s][m]amix=inputs=3:normalize=0:duration=longest")
    else:
        graph += '[sc]anullsink;[v][s]amix=inputs=2:normalize=0:duration=longest'
    graph += ',alimiter=limit=0.89:attack=3:release=60:level=disabled[out]'
    ff(inputs + ['-filter_complex', graph, '-map', '[out]', '-t', f'{real:.3f}', '-ar', '48000', f'{out}/mix.pre.wav'])
    master(video, out, spec, real)

def master(video, out, spec, real):
    """Two-pass loudness on mix.pre.wav to the target, written as mix.wav (true peak -1)."""
    target = spec.get('loudness', -14)
    m = loudness(os.path.join(ROOT, out, 'mix.pre.wav'), target)
    ff(['-i', f'{out}/mix.pre.wav', '-af', f"loudnorm=I={target}:TP=-1:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true", '-ar', '48000', f'{out}/mix.wav'])
    os.remove(os.path.join(ROOT, out, 'mix.pre.wav'))
    after = loudness(os.path.join(ROOT, out, 'mix.wav'), target)
    print(f"loudness {m['input_i']} -> {after['input_i']} LUFS (target {target}), true peak {after['input_tp']} dBTP")
    print(f'{video}: {real:.2f} s -> {out}/mix.wav')

if __name__ == '__main__':
    main(sys.argv[1])
