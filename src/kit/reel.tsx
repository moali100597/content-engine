import React from 'react';
import { AbsoluteFill, Audio, Easing, Freeze, getInputProps, Img, OffthreadVideo, Sequence, staticFile, useVideoConfig } from 'remotion';
import { lerp, Pop, ramp, useT, Words } from './anim';
import { Brand, BrandProvider, personal, useBrand } from './brand';
import { useFonts } from './fonts';
import { landscape, Layout, LayoutProvider, useLayout } from './layout';
import { QA, qaOn } from './qa';
import { phrasesFrom, WordCaptions } from './captions';
import { Cam, DepthStill } from './depth';

/** A film cut from footage: generated or filmed clips and stills, in order, with text, stickers and sound on top.
 *  Times here are real seconds. Each shot plays `dur` seconds of its source starting at `from`.
 *  What an editor does, and the field that does it:
 *    arrival of a shot ............ tr: cut, fade, whip, flash, punch, zoom, slide, glitch, blur, light, burn
 *                                   (burn: the picture blooms into warm light and the cut happens inside it. Use it, not
 *                                   fade, between two shots of the same person: a cross-dissolve shows two of them, a ghost)
 *    speed, ramps, freeze frames .. speed, ramp, freeze
 *    framing ...................... focus, zoom, move, punch (quick push on a beat), hits (camera shake)
 *    colour ....................... grade (per shot or for the whole reel), vignette, grain
 *    the clip's own sound ......... audio: { volume, lead (J cut), tail (L cut) }
 *    text that keeps off faces .... faces (from tools/footage.py faces) + pos 'auto' on titles; captions move up when a face is low
 *    memes, cutouts, emoji ........ sticker overlays
 *    cuts on the music ............ onBeats() with beats from tools/beats.py */
export type Grade = 'none' | 'warm' | 'cool' | 'punch' | 'soft' | 'mono' | 'teal' | 'film' | 'bleach' | 'night' | 'gold';
export type Arrival = 'cut' | 'fade' | 'whip' | 'flash' | 'punch' | 'zoom' | 'slide' | 'glitch' | 'blur' | 'light' | 'burn';
/** Faces of one clip: source size, and boxes [t, x, y, w, h] with t in source seconds and the box in fractions of the frame. */
export type FaceTrack = { w: number; h: number; boxes: [number, number, number, number, number][] };
export type Overlay =
  | { kind: 'title'; text: string; sub?: string; at: number; out?: number; pos?: 'center' | 'top' | 'bottom' | 'auto'; accent?: string; latin?: boolean }
  | { kind: 'lower'; text: string; at: number; out?: number }                                  // small label above the bottom margin
  | { kind: 'badge'; text: string; sub?: string; at: number; out?: number; corner?: 'tl' | 'tr' | 'bl' | 'br'; color?: string }   // price / offer
  | { kind: 'caption'; text: string; at: number; out?: number }                                // one spoken line
  | { kind: 'karaoke'; text: string; at: number; out: number; accent?: string }                 // a spoken line whose words light up in turn (spread by letter count: use 'words' when the word times are known)
  | { kind: 'words'; words: [number, number, string][]; at: number; out?: number }               // the spoken line word by word on the times it is said (shot seconds; from tools/takes.py), cut at commas
  | { kind: 'sticker'; src: string; at: number; out?: number; x: number; y: number; w: number; rot?: number; enter?: 'pop' | 'slam' | 'slide'; wiggle?: number };   // meme, cutout, emoji: x, y = centre in px
export type Shot = {
  src?: string;                    // clip or still under public/; none = a plain brand card
  from?: number;                   // seconds into the source
  dur: number;
  speed?: number;                  // 0.5 = slow motion, 2 = double speed
  ramp?: [number, number][];       // speed over the shot's own seconds, [[0, 1], [0.6, 0.25], [1.4, 1]]: a speed ramp (overrides speed)
  freeze?: [number, number];       // hold the picture from shot second `at` for `dur` seconds (inside the shot's length)
  focus?: [number, number];        // which part stays in frame when cropping, in percent (default centre 50, 50)
  zoom?: number;                   // crop in around `focus` (1.3 = 30% tighter), to frame out something at the edge
  move?: 'in' | 'out' | 'left' | 'right' | 'none';   // slow push or drift over the whole shot
  punch?: number[];                // quick 12% push-ins at these shot seconds (on a beat or a word)
  hits?: number[];                 // short camera shakes at these shot seconds (an impact, a meme landing)
  tr?: Arrival;                    // how this shot arrives
  grade?: Grade;
  volume?: number;                 // the clip's own sound, 0..1 (default 0), played with the picture
  audio?: { volume?: number; lead?: number; tail?: number };   // the clip's sound as its own track: lead = J cut (heard before the picture), tail = L cut (heard after)
  faces?: FaceTrack;               // where faces are in this clip (tools/footage.py faces): text keeps off them
  dark?: boolean;                  // for a card: dark version
  text?: Overlay[];                // times count from the start of this shot
  over?: React.FC<{ t: number }>;  // a layer made for this film, drawn above the shot; t counts from the start of the shot
  cam?: Cam;                       // a still only: a camera move inside the picture by its depth map (<still>.depth.png from tools/depth.py), instead of `move`
};
export type Sound = { src: string; at: number; volume?: number };   // one spoken line or effect, placed at a second of the film
export type ReelSpec = { shots: Shot[]; music?: { src: string; volume?: number }; voice?: string; sounds?: Sound[]; over?: React.FC<{ t: number }>;   /* `over`: a layer above every shot, for motion that runs across cuts */ grade?: Grade; vignette?: number; grain?: number; brand?: Brand };

const TR: Record<Arrival, number> = { cut: 0, fade: 0.4, whip: 0.24, flash: 0.14, punch: 0.2, zoom: 0.35, slide: 0.32, glitch: 0.26, blur: 0.45, light: 0.5, burn: 0.5 };
// CSS grades (first ones, kept as they were) and tone-curve grades (per-channel curves: shadows and highlights move apart, like a LUT)
const GRADE: Partial<Record<Grade, string>> = {
  none: '', warm: 'saturate(1.08) sepia(0.14) contrast(1.04)', cool: 'saturate(0.96) hue-rotate(-6deg) contrast(1.05) brightness(0.98)',
  punch: 'contrast(1.14) saturate(1.2)', soft: 'contrast(0.94) saturate(0.92) brightness(1.04)', mono: 'grayscale(1) contrast(1.1)',
};
const CURVES: Partial<Record<Grade, { r: string; g: string; b: string; sat: number }>> = {
  teal: { r: '0 0.21 0.5 0.8 1', g: '0.02 0.26 0.5 0.75 0.97', b: '0.09 0.32 0.5 0.69 0.9', sat: 1.12 },        // teal shadows, warm skin and highlights
  film: { r: '0.06 0.28 0.53 0.78 0.96', g: '0.05 0.26 0.5 0.74 0.93', b: '0.07 0.25 0.46 0.68 0.88', sat: 0.94 },   // lifted blacks, soft warm top
  bleach: { r: '0 0.16 0.5 0.85 1', g: '0 0.16 0.5 0.85 1', b: '0 0.17 0.5 0.84 1', sat: 0.55 },                  // hard contrast, little colour
  night: { r: '0 0.17 0.4 0.62 0.86', g: '0 0.21 0.45 0.68 0.9', b: '0.05 0.3 0.56 0.8 1', sat: 0.9 },             // blue, low key
  gold: { r: '0.02 0.3 0.58 0.84 1', g: '0.01 0.25 0.5 0.75 0.95', b: '0 0.18 0.4 0.63 0.84', sat: 1.08 },          // golden hour
};
const gradeCss = (g: Grade) => (CURVES[g] ? `url(#grade-${g})` : GRADE[g] || undefined);
const GradeDefs: React.FC = () => (
  <svg width="0" height="0" style={{ position: 'absolute' }}>
    {Object.entries(CURVES).map(([k, c]) => (
      <filter key={k} id={`grade-${k}`} colorInterpolationFilters="sRGB">
        <feComponentTransfer><feFuncR type="table" tableValues={c!.r} /><feFuncG type="table" tableValues={c!.g} /><feFuncB type="table" tableValues={c!.b} /></feComponentTransfer>
        <feColorMatrix type="saturate" values={String(c!.sat)} />
      </filter>
    ))}
  </svg>
);
const isStill = (src: string) => /\.(png|jpe?g|webp)$/i.test(src);

export const reelSeconds = (r: ReelSpec) => r.shots.reduce((a, s) => a + s.dur, 0);
export const reelFrames = (r: ReelSpec, fps = 30) => Math.round(reelSeconds(r) * fps);

/** Move every cut onto the nearest beat (within `tolerance` s), keeping the order and the total roughly the same. */
export const onBeats = (shots: Shot[], beats: number[], tolerance = 0.25): Shot[] => {
  let t = 0, prev = 0;
  return shots.map((s, i) => {
    t += s.dur;
    let end = t;
    if (i < shots.length - 1) { const b = beats.reduce((best, x) => (Math.abs(x - t) < Math.abs(best - t) ? x : best), Infinity); if (Math.abs(b - t) <= tolerance && b > prev + 0.3) end = b; }
    const out = { ...s, dur: end - prev }; prev = end; return out;
  });
};

// ---------- time inside a shot: speed, ramps and freezes ----------
const speedAt = (s: Shot, u: number) => {
  if (s.freeze && u >= s.freeze[0] && u < s.freeze[0] + s.freeze[1]) return 0;
  const r = s.ramp;
  if (!r) return s.speed ?? 1;
  if (u <= r[0][0]) return r[0][1];
  for (let i = 1; i < r.length; i++) if (u <= r[i][0]) return lerp(r[i - 1][1], r[i][1], Easing.inOut(Easing.quad)((u - r[i - 1][0]) / (r[i][0] - r[i - 1][0])));
  return r[r.length - 1][1];
};
/** Seconds into the source at shot second u. */
const sourceAt = (s: Shot, u: number, fps: number) => {
  if (!s.ramp && !s.freeze) return (s.from ?? 0) + u * (s.speed ?? 1);
  let x = s.from ?? 0;
  for (let k = 0; k < Math.floor(u * fps); k++) x += speedAt(s, k / fps) / fps;
  return x;
};

// ---------- faces on screen ----------
type Box = [number, number, number, number];
/** Where the clip's faces are on the canvas at shot second u (covers the crop, focus, zoom and slow move). */
const facesOnScreen = (s: Shot, u: number, L: Layout, scale: number, drift: number, fps: number): Box[] => {
  const f = s.faces;
  if (!f || !f.boxes.length) return [];
  const src = sourceAt(s, u, fps);
  const near = f.boxes.reduce((b, x) => (Math.abs(x[0] - src) < Math.abs(b - src) ? x[0] : b), Infinity);
  const [fx, fy] = s.focus ?? [50, 50], cover = Math.max(L.W / f.w, L.H / f.h), dw = f.w * cover, dh = f.h * cover;
  const ox = (L.W - dw) * fx / 100, oy = (L.H - dh) * fy / 100, cx = L.W * fx / 100, cy = L.H * fy / 100, z = scale * (s.zoom ?? 1);
  return f.boxes.filter((b) => Math.abs(b[0] - near) < 0.01).map(([, x, y, w, h]) => {
    const X = ox + x * dw, Y = oy + y * dh;
    return [cx + (X - cx) * z + (drift / 100) * L.W, cy + (Y - cy) * z, w * dw * z, h * dh * z] as Box;
  });
};
const overlap = (a: Box, top: number, bottom: number) => Math.max(0, Math.min(a[1] + a[3], bottom) - Math.max(a[1], top)) * a[2];

type Avoid = (from: number, to: number) => Box[];
const Text: React.FC<{ o: Overlay; t: number; onDark: boolean; avoid: Avoid }> = ({ o, t, onDark, avoid }) => {
  const B = useBrand(); const L = useLayout(); const { fps } = useVideoConfig();
  const out = o.out === undefined ? 0 : ramp(t, o.out, o.out + 0.2, Easing.in(Easing.quad));
  if (t < o.at - 0.02 || out >= 1) return null;
  const fg = onDark ? '#fff' : B.ink, shadow = onDark ? '0 2px 24px rgba(0,0,0,.55), 0 1px 3px rgba(0,0,0,.5)' : undefined;
  const wide = L.W > L.H, unit = wide ? 1 : 0.86;
  const zone = { top: [L.safe.top, L.safe.top + L.H * 0.26], center: [L.H * 0.37, L.H * 0.63], bottom: [L.H - L.safe.bottom - L.H * 0.26, L.H - L.safe.bottom] } as const;
  const faces = avoid(o.at, o.out ?? o.at + 2.5);
  const busy = (z: keyof typeof zone) => faces.reduce((n, f) => n + overlap(f, zone[z][0], zone[z][1]), 0);
  const low = (faces.length > 0 && busy('bottom') > 0 && busy('top') === 0);   // a face in the caption's place, and the top is free: the line goes up
  if (o.kind === 'title') {
    const pos = o.pos === 'auto' ? (['center', 'top', 'bottom'] as const).reduce((a, z) => (busy(z) < busy(a) ? z : a), 'center' as 'center' | 'top' | 'bottom') : o.pos;
    const y = pos === 'top' ? { top: L.safe.top + 40 } : pos === 'bottom' ? { bottom: L.safe.bottom + 60 } : { top: '50%', transform: 'translateY(-50%)' };
    return (
      <div style={{ position: 'absolute', left: L.safe.side, right: L.safe.side, ...y, opacity: 1 - out, textAlign: 'center', direction: o.latin ? 'ltr' : 'rtl', textShadow: shadow }}>
        <Words qa="over" t={t} at={o.at} text={o.text} style={{ fontFamily: o.latin ? B.font.latin : B.font.sans, fontStyle: o.latin ? 'italic' : undefined, fontWeight: o.latin ? 400 : 800, fontSize: (o.latin ? 150 : 124) * unit, lineHeight: 1.2, color: o.accent ?? fg }} />
        {o.sub && <Words qa="over" t={t} at={o.at + 0.35} gap={0.07} text={o.sub} style={{ fontFamily: B.font.sans, fontWeight: 500, fontSize: 50 * unit, lineHeight: 1.4, color: fg, marginTop: 14, opacity: 0.92 }} />}
      </div>
    );
  }
  const place: React.CSSProperties = low ? { top: L.safe.top + 20 } : { bottom: L.safe.bottom + (o.kind === 'lower' ? 20 : 0) };
  if (o.kind === 'lower') {
    return (
      <div style={{ position: 'absolute', left: 0, right: 0, ...place, display: 'flex', justifyContent: 'center', opacity: 1 - out }}>
        <Pop t={t} at={o.at} y={18} from={0.94}><div data-qa="over" style={{ fontFamily: B.font.sans, fontWeight: 700, fontSize: 40 * unit, direction: 'rtl', color: '#fff', background: 'rgba(13,12,10,.78)', padding: '12px 28px', borderRadius: 16 }}>{o.text}</div></Pop>
      </div>
    );
  }
  if (o.kind === 'badge') {
    const c = o.corner ?? 'tr', size = 230 * unit;
    const pad = size * 0.16;   // the badge is tilted and overshoots as it pops: keep that inside the safe margin
    const at: React.CSSProperties = { [c[0] === 't' ? 'top' : 'bottom']: (c[0] === 't' ? L.safe.top : L.safe.bottom) + pad, [c[1] === 'l' ? 'left' : 'right']: L.safe.side + pad };
    return (
      <div style={{ position: 'absolute', ...at, opacity: 1 - out }}>
        <Pop t={t} at={o.at} from={0.4} rot={c[1] === 'l' ? -8 : 8}>
          <div data-qa="over" style={{ width: size, height: size, borderRadius: '50%', background: o.color ?? B.accents.red, color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', direction: 'rtl', fontFamily: B.font.sans, boxShadow: '0 16px 40px rgba(0,0,0,.28)' }}>
            <div style={{ fontWeight: 800, fontSize: size * 0.3, lineHeight: 1.05, unicodeBidi: 'plaintext' }}>{o.text}</div>
            {o.sub && <div style={{ fontWeight: 600, fontSize: size * 0.13, marginTop: 4 }}>{o.sub}</div>}
          </div>
        </Pop>
      </div>
    );
  }
  if (o.kind === 'sticker') {
    const k = ramp(t, o.at, o.at + (o.enter === 'slam' ? 0.12 : 0.3), o.enter === 'slam' ? Easing.in(Easing.cubic) : Easing.out(Easing.back(2)));
    const sc = o.enter === 'slam' ? lerp(2.6, 1, k) : o.enter === 'slide' ? 1 : lerp(0.3, 1, k);
    const dx = o.enter === 'slide' ? (1 - k) * (o.x < L.W / 2 ? -L.W * 0.6 : L.W * 0.6) : 0;
    const rot = (o.rot ?? 0) + (o.wiggle ? Math.sin(t * 9) * o.wiggle : 0);
    const media: React.CSSProperties = { width: o.w, display: 'block', filter: 'drop-shadow(0 14px 30px rgba(0,0,0,.45))' };
    return (
      <div style={{ position: 'absolute', left: o.x - o.w / 2, top: o.y, transform: `translate(${dx}px, -50%) scale(${sc}) rotate(${rot}deg)`, opacity: Math.min(1, k * 3) * (1 - out) }}>
        {isStill(o.src) ? <Img src={staticFile(o.src)} style={media} /> : <Sequence from={Math.round(o.at * fps)} layout="none"><OffthreadVideo src={staticFile(o.src)} muted transparent style={media} /></Sequence>}
      </div>
    );
  }
  if (o.kind === 'words') {
    return <WordCaptions t={t} phrases={phrasesFrom([{ words: o.words, start: 0, in: 0 }])} bottom={L.safe.bottom + 30} side={L.safe.side} font={B.font.sans} size={58 * unit} />;
  }
  if (o.kind === 'karaoke') {
    const words = o.text.split(' '), total = o.text.length;
    let seen = 0;
    return (
      <div style={{ position: 'absolute', left: L.safe.side, right: L.safe.side, ...place, display: 'flex', justifyContent: 'center', opacity: ramp(t, o.at - 0.05, o.at + 0.1) * (1 - out), direction: 'rtl' }}>
        <div data-qa="over" style={{ fontFamily: B.font.sans, fontWeight: 800, fontSize: 58 * unit, lineHeight: 1.35, textAlign: 'center', textShadow: '0 3px 0 rgba(0,0,0,.55), 0 0 18px rgba(0,0,0,.5)' }}>
          {words.map((w, i) => {
            const on = t >= o.at + (o.out - o.at) * (seen / total); seen += w.length + 1;
            return <span key={i} style={{ color: on ? o.accent ?? B.accents.red : '#fff', display: 'inline-block', transform: `scale(${on ? 1.06 : 1})`, margin: '0 0.12em' }}>{w}</span>;
          })}
        </div>
      </div>
    );
  }
  return (
    <div style={{ position: 'absolute', left: L.safe.side, right: L.safe.side, ...place, display: 'flex', justifyContent: 'center', opacity: ramp(t, o.at - 0.05, o.at + 0.1) * (1 - out), direction: 'rtl' }}>
      <div data-qa="over" style={{ fontFamily: B.font.sans, fontWeight: 600, fontSize: 46 * unit, color: fg, textShadow: shadow, textAlign: 'center' }}>{o.text}</div>
    </div>
  );
};

/** The light of a `burn` arrival, drawn over both shots: peaks at the cut (the middle of the arrival). */
const BurnLight: React.FC<{ t: number; at: number; len: number }> = ({ t, at, len }) => {
  const c = at + len / 2, d = (t - c) / (len * 0.34);
  if (Math.abs(d) > 3) return null;
  return <AbsoluteFill style={{ mixBlendMode: 'screen', pointerEvents: 'none', opacity: Math.exp(-d * d) * 0.85, background: 'radial-gradient(ellipse 90% 80% at 50% 42%, rgba(255,246,228,.96) 0%, rgba(255,214,160,.9) 45%, rgba(255,170,100,.75) 100%)' }} />;
};

const rnd = (n: number) => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); };

const ShotView: React.FC<{ s: Shot; next?: Shot; start: number; t: number; i: number; grade: Grade }> = ({ s, next, start, t, i, grade }) => {
  const B = useBrand(); const L = useLayout(); const { fps } = useVideoConfig();
  const tr = s.tr ?? 'cut', d = i === 0 ? 0 : TR[tr], ntr = next?.tr ?? 'cut', hold = next ? TR[ntr] : 0;      // stay under the next shot while it arrives
  const local = t - start;
  if (local < 0 || local >= s.dur + hold) return null;
  const k = d ? ramp(local, 0, d, Easing.out(Easing.cubic)) : 1, life = ramp(local, 0, s.dur + hold, (n) => n);
  const leave = next && local > s.dur ? ramp(local, s.dur, s.dur + hold, Easing.in(Easing.cubic)) : 0;
  const leaveWhip = ntr === 'whip' ? leave : 0;
  // arrival and departure of the whole layer
  let x = (tr === 'whip' ? (1 - k) * L.W : 0) - leaveWhip * L.W, y = 0, op = tr === 'fade' || tr === 'punch' || tr === 'blur' || tr === 'light' ? k : tr === 'burn' ? (local >= d / 2 ? 1 : 0) : 1, lay = 1, blurPx = 0;
  if (tr === 'zoom') { lay *= lerp(1.5, 1, k); blurPx += (1 - k) * 16; op = Math.min(1, k * 1.6); }
  if (tr === 'slide') y += (1 - k) * L.H;
  if (tr === 'blur') blurPx += (1 - k) * 22;
  if (ntr === 'zoom') { lay *= 1 + leave * 0.4; op *= 1 - leave; }
  if (ntr === 'slide') y -= leave * L.H;
  if (ntr === 'blur') blurPx += leave * 22;
  if (s.hits) for (const h of s.hits) if (local > h && local < h + 0.45) { const e = Math.exp(-(local - h) * 9); x += Math.sin(local * 70) * 16 * e; y += Math.cos(local * 61) * 12 * e; }
  const glitch = tr === 'glitch' && k < 1 ? 1 - k : 0;
  if (glitch) x += (rnd(Math.floor(local * fps) + i) - 0.5) * 60 * glitch;
  const whipBlur = tr === 'whip' && k < 1 ? (1 - k) * 46 : leaveWhip > 0 ? leaveWhip * 46 : 0;
  // framing
  const m = s.move ?? (s.src && isStill(s.src) && !s.cam ? 'in' : 'none');
  const punch = (s.punch ?? []).reduce((a, p) => a * (local > p ? 1 + 0.12 * Math.exp(-(local - p) * 7) : 1), 1);
  const scale = (m === 'in' ? lerp(1, 1.09, life) : m === 'out' ? lerp(1.09, 1, life) : m === 'none' ? 1 : 1.09) * (tr === 'punch' ? lerp(1.22, 1, k) : 1) * punch;
  const drift = m === 'left' ? lerp(3.5, -3.5, life) : m === 'right' ? lerp(-3.5, 3.5, life) : 0;
  const [fx, fy] = s.focus ?? [50, 50];
  const g = s.grade ?? grade;
  const media: React.CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${fx}% ${fy}%`, transformOrigin: `${fx}% ${fy}%`, transform: `translateX(${drift}%) scale(${scale * (s.zoom ?? 1)})`, filter: gradeCss(g) };
  const onDark = !!s.src || !!s.dark;
  const remap = !!(s.ramp || s.freeze);
  const avoid: Avoid = (a, b) => (s.faces ? Array.from({ length: 5 }, (_, n) => facesOnScreen(s, lerp(a, Math.min(b, s.dur), n / 4), L, scale, drift, fps)).flat() : []);
  const filters = [whipBlur > 0.5 ? `url(#rw${i})` : '', blurPx > 0.5 ? `blur(${blurPx}px)` : '', glitch ? `drop-shadow(${14 * glitch}px 0 0 rgba(255,0,70,.75)) drop-shadow(${-14 * glitch}px 0 0 rgba(0,220,255,.75))` : ''].filter(Boolean).join(' ');
  return (
    <AbsoluteFill style={{ opacity: op, transform: x || y || lay !== 1 ? `translate(${x}px, ${y}px) scale(${lay})` : undefined, filter: filters || undefined, background: s.src ? '#000' : s.dark ? B.dark.bg : B.paper, overflow: 'hidden' }}>
      {whipBlur > 0.5 && <svg width="0" height="0" style={{ position: 'absolute' }}><filter id={`rw${i}`} x="-20%" width="140%"><feGaussianBlur stdDeviation={`${whipBlur} 0`} /></filter></svg>}
      {s.src && (isStill(s.src)
        ? s.cam
          ? <div style={{ position: 'absolute', inset: 0, transform: `scale(${(tr === 'punch' ? lerp(1.22, 1, k) : 1) * punch})`, filter: gradeCss(g) }}><DepthStill src={s.src} p={ramp(local, 0, s.dur + hold, (n) => n)} cam={s.cam} w={L.W} h={L.H} focus={s.focus} /></div>
          : <Img src={staticFile(s.src)} style={media} />
        : remap
          ? <Freeze frame={0}><OffthreadVideo src={staticFile(s.src)} startFrom={Math.round(sourceAt(s, local, fps) * fps)} muted style={media} /></Freeze>
          : <OffthreadVideo src={staticFile(s.src)} startFrom={Math.round((s.from ?? 0) * fps)} playbackRate={s.speed ?? 1} volume={s.audio ? 0 : s.volume ?? 0} muted={!!s.audio || !s.volume} style={media} />)}
      {glitch > 0.3 && <AbsoluteFill style={{ background: `linear-gradient(transparent ${rnd(local * fps) * 80}%, rgba(255,255,255,.18) 0, transparent ${rnd(local * fps) * 80 + 4}%)` }} />}
      {(s.text ?? []).some((o) => o.kind === 'caption' || o.kind === 'lower' || o.kind === 'karaoke' || o.kind === 'words') && s.src && <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '38%', background: 'linear-gradient(transparent, rgba(0,0,0,.5))' }} />}
      {(s.text ?? []).map((o, j) => <Text key={j} o={o} t={local} onDark={onDark} avoid={avoid} />)}
      {s.over && <s.over t={local} />}
      {tr === 'flash' && local < 0.32 && <AbsoluteFill style={{ background: '#fff', opacity: 1 - ramp(local, 0, 0.32) }} />}
      {tr === 'light' && local < d && <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 70% 30%, rgba(255,236,200,.95) 0%, rgba(255,150,60,.55) 35%, transparent 70%)', mixBlendMode: 'screen', opacity: Math.sin(Math.PI * k) }} />}
    </AbsoluteFill>
  );
};

/** Platform UI on a 9:16 post (status bar, caption and buttons, the right-hand action column): drawn only when the input prop `guides` is set. */
const Guides: React.FC = () => {
  const L = useLayout();
  if (L.W > L.H) return null;
  const z = 'rgba(255,40,80,.28)';
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 150, background: z }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 280, background: z }} />
      <div style={{ position: 'absolute', right: 0, top: 150, bottom: 280, width: 90, background: z }} />
    </AbsoluteFill>
  );
};

export const Reel: React.FC<{ reel: ReelSpec; layout?: Layout }> = ({ reel, layout = landscape }) => {
  const t = useT(); const { fps } = useVideoConfig();
  const brand = reel.brand ?? personal;
  let acc = 0;
  const starts = reel.shots.map((s) => { const a = acc; acc += s.dur; return a; });
  const total = acc;
  const fonts = useFonts(brand);
  if (!fonts) return null;
  return (
    <BrandProvider value={brand}>
    <LayoutProvider value={layout}>
    <AbsoluteFill style={{ background: '#000', overflow: 'hidden' }}>
      <GradeDefs />
      {reel.music && <Audio src={staticFile(reel.music.src)} volume={(f) => (reel.music!.volume ?? 0.5) * Math.min(1, f / (0.4 * fps)) * Math.min(1, Math.max(0, (total * fps - f) / (1.5 * fps)))} />}
      {reel.voice && <Audio src={staticFile(reel.voice)} />}
      {(reel.sounds ?? []).map((a, i) => <Sequence key={i} from={Math.round(a.at * fps)} layout="none"><Audio src={staticFile(a.src)} volume={a.volume ?? 1} /></Sequence>)}
      {/* a clip's own sound as its own track, so it can start before its picture (J cut) or run on after it (L cut) */}
      {reel.shots.map((s, i) => {
        if (!s.audio || !s.src || isStill(s.src)) return null;
        const lead = Math.min(s.audio.lead ?? 0, starts[i]), tail = s.audio.tail ?? 0, len = Math.round((s.dur + lead + tail) * fps), v = s.audio.volume ?? 1;
        return (
          <Sequence key={`a${i}`} from={Math.round((starts[i] - lead) * fps)} durationInFrames={len} layout="none">
            <Audio src={staticFile(s.src)} startFrom={Math.max(0, Math.round(((s.from ?? 0) - lead * (s.speed ?? 1)) * fps))} playbackRate={s.speed ?? 1} volume={(f) => v * Math.min(1, f / (0.2 * fps)) * Math.min(1, Math.max(0, (len - f) / (0.3 * fps)))} />
          </Sequence>
        );
      })}
      {/* each shot sits in its own Sequence so a clip's clock starts with the shot: without it the clip plays from the film's time, not from `from` */}
      {reel.shots.map((s, i) => <Sequence key={i} from={Math.round(starts[i] * fps)} layout="none"><ShotView s={s} next={reel.shots[i + 1]} start={starts[i]} t={t} i={i} grade={reel.grade ?? 'none'} /></Sequence>)}
      {reel.shots.map((s, i) => (i && s.tr === 'burn' ? <BurnLight key={`burn${i}`} t={t} at={starts[i]} len={TR.burn} /> : null))}
      {reel.over && <reel.over t={t} />}
      {!!reel.vignette && <AbsoluteFill style={{ background: `radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,${reel.vignette}) 100%)`, pointerEvents: 'none' }} />}
      {!!reel.grain && (
        <AbsoluteFill style={{ opacity: reel.grain, mixBlendMode: 'overlay', pointerEvents: 'none' }}>
          <svg width="100%" height="100%"><filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={Math.floor(t * fps) % 97} /><feColorMatrix type="saturate" values="0" /></filter><rect width="100%" height="100%" filter="url(#grain)" /></svg>
        </AbsoluteFill>
      )}
      {(getInputProps() as { guides?: boolean }).guides && <Guides />}
      {qaOn() && <QA t={t} quiet={starts.some((a, i) => i > 0 && t - a >= -0.05 && t - a < 0.45)} />}
    </AbsoluteFill>
    </LayoutProvider>
    </BrandProvider>
  );
};
