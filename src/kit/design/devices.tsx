import { T } from './spec';
import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { Meta } from './type';
import { stickerLand, useMotion } from './motion';
import { inkOn, type Palette, type World } from './worlds';
import { GradedImage, LookContext, type LookSpec } from './look';

// The graphic devices of docs/design-system.md, section 6. Sizes are in px; callers pass multiples of the unit u.

export type Rect = { x: number; y: number; w: number; h: number };
export type Pic = {
  src: string;                    // under public/
  cut?: boolean;                  // a transparent cut-out (contain, anchored) instead of a photo (cover)
  layer?: string;                 // the subject cut out at the picture's own size (tools/cutout.py --keep): moves on its own in motion
  focus?: [number, number];       // photo focus, in % of the picture
  grade?: 'duo' | 'mono' | 'none';// duo: the world's colour story; mono: black and white
  anchor?: string;                // cut-out anchor, CSS object-position (default bottom centre)
  scale?: number;                 // cut-out scale inside its box
  flip?: boolean;
  look?: LookSpec;                // this photo's own look over the piece's ('none': untouched, e.g. a floor plan)
};

const hex = (c: string) => { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255); };

/** SVG filters for photo grades: `duo` maps shadows to the ground, mid-tones toward the accent, highlights to the ink. */
export const GradeDefs: React.FC<{ pal: Palette; id: string }> = ({ pal, id }) => {
  const [a, b, c] = [hex(pal.ground), hex(pal.accent), hex(pal.ink)];
  const mid = a.map((v, i) => v * 0.35 + b[i] * 0.35 + c[i] * 0.3);
  const t = (i: number) => `${a[i]} ${mid[i]} ${c[i]}`;
  return (
    <svg width={0} height={0} style={{ position: 'absolute' }}>
      <filter id={`duo-${id}`} colorInterpolationFilters="sRGB">
        <feColorMatrix type="matrix" values="0.3 0.59 0.11 0 0  0.3 0.59 0.11 0 0  0.3 0.59 0.11 0 0  0 0 0 1 0" />
        <feComponentTransfer><feFuncR type="table" tableValues={t(0)} /><feFuncG type="table" tableValues={t(1)} /><feFuncB type="table" tableValues={t(2)} /></feComponentTransfer>
      </filter>
      <filter id={`mono-${id}`} colorInterpolationFilters="sRGB">
        <feColorMatrix type="saturate" values="0" /><feComponentTransfer><feFuncR type="linear" slope="1.25" intercept="-0.1" /><feFuncG type="linear" slope="1.25" intercept="-0.1" /><feFuncB type="linear" slope="1.25" intercept="-0.1" /></feComponentTransfer>
      </filter>
    </svg>
  );
};

/** A picture in a box: a photo fills it (cover), a cut-out stands in it (contain) with a drop or floor shadow. */
export const Picture: React.FC<{ pic: Pic; r: Rect; gid: string; shadow?: 'floor' | 'drop' | 'none'; radius?: number; style?: React.CSSProperties }> = ({ pic, r, gid, shadow = 'drop', radius = 0, style }) => {
  const filter = pic.grade && pic.grade !== 'none' ? `url(#${pic.grade}-${gid})` : undefined;
  if (pic.cut) {
    const anchor = pic.anchor ?? '50% 100%';
    return (
      <div style={{ position: 'absolute', left: r.x, top: r.y, width: r.w, height: r.h, ...style }}>
        {shadow === 'floor' && <div style={{ position: 'absolute', left: '18%', right: '18%', bottom: '1%', height: r.h * 0.05, borderRadius: '50%', background: 'rgba(0,0,0,.5)', filter: `blur(${r.h * 0.02}px)` }} />}
        <Img src={staticFile(pic.src)} style={{ position: 'absolute', inset: 0, width: '100%', height: shadow === 'floor' ? '97%' : '100%', objectFit: 'contain', objectPosition: anchor, transform: `scale(${pic.scale ?? 1})${pic.flip ? ' scaleX(-1)' : ''}`, transformOrigin: anchor, filter: [filter, shadow !== 'none' ? `drop-shadow(0 ${r.h * 0.02}px ${r.h * 0.03}px rgba(0,0,0,.35))` : ''].filter(Boolean).join(' ') || undefined }} />
      </div>
    );
  }
  const [fx, fy] = pic.focus ?? [50, 50];
  const base = React.useContext(LookContext);
  const look = pic.look === 'none' || filter ? undefined : base || pic.look ? { ...(base ?? {}), ...(pic.look ?? {}) } : undefined;
  if (look) return (
    <div style={{ position: 'absolute', left: r.x, top: r.y, width: r.w, height: r.h, borderRadius: radius, overflow: 'hidden', ...style }}>
      <GradedImage src={pic.src} w={r.w} h={r.h} focus={[fx, fy]} look={look} />
    </div>
  );
  return <Img src={staticFile(pic.src)} style={{ position: 'absolute', left: r.x, top: r.y, width: r.w, height: r.h, objectFit: 'cover', objectPosition: `${fx}% ${fy}%`, borderRadius: radius, filter, transform: pic.flip ? 'scaleX(-1)' : undefined, ...style }} />;
};

/** A huge number or word behind the title: faint fill, or an outline (tech-glow adds a glow). */
export const Ghost: React.FC<{ text: string; world: World; color: string; size: number; at: { x?: number; y: number; right?: number }; mode?: 'fill' | 'outline' | 'glow'; opacity?: number; latin?: boolean }> = ({ text, world, color, size, at, mode = 'fill', opacity = 0.1, latin }) => {
  const face = latin || !/[؀-ۿ]/.test(text) ? world.latin.family === 'Instrument Serif' ? world.display : world.latin : world.display;
  return (
    <div style={{ position: 'absolute', left: at.x, right: at.right, top: at.y, fontFamily: `"${face.family}"`, fontWeight: face.weight, fontSize: size, lineHeight: 0.85, whiteSpace: 'nowrap', direction: 'ltr', letterSpacing: '-0.02em',
      color: mode === 'fill' ? color : 'transparent', opacity: mode === 'fill' ? opacity : mode === 'glow' ? 0.9 : opacity * 3,
      WebkitTextStroke: mode !== 'fill' ? `${Math.max(2, size * 0.012)}px ${color}` : undefined,
      filter: mode === 'glow' ? `drop-shadow(0 0 ${size * 0.04}px ${color}) drop-shadow(0 0 ${size * 0.12}px ${color}66)` : undefined }}>{text}</div>
  );
};

/** A big number with a two-line label beside it and a short rule under it. */
/** A stat pair as the Al Jazeera sheets set it: the number on top (right edge in Arabic), the label under it, an accent rule. */
export const Stat: React.FC<{ value: string; label: string; world: World; pal: Palette; u: number; w: number }> = ({ value, label, world, pal, u, w }) => (
  <div data-qa="over" style={{ width: w, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: u * 0.9, direction: 'rtl' }}>
    <span style={{ fontFamily: `"${world.display.family}"`, fontWeight: world.display.weight, fontSize: u * T.h2, lineHeight: 0.9, color: pal.ink, unicodeBidi: 'plaintext' }}>{value}</span>
    <span style={{ fontFamily: `"${world.text.family}"`, fontWeight: world.text.weight, fontSize: u * T.body, lineHeight: 1.45, color: pal.dim, whiteSpace: 'pre-line' }}>{label}</span>
    <div style={{ width: u * 8, height: Math.max(2, u * 0.3), background: pal.accent }} />
  </div>
);

/** A small label: "خطوة 2", "STEP 2", a category. */
export const Pill: React.FC<{ text: string; world: World; pal: Palette; u: number; filled?: boolean; size?: number }> = ({ text, world, pal, u, filled, size = T.body }) => (
  <div data-qa="over" style={{ display: 'inline-block', padding: `${u * 0.5}px ${u * 1.6}px ${u * 0.7}px`, borderRadius: u * Math.max(world.radius, 0.3) * 2, border: `${Math.max(2, u * 0.25)}px solid ${pal.accent}`, background: filled ? pal.accent : 'transparent', color: filled ? inkOn(pal.accent, pal) : pal.accent, fontFamily: `"${world.text.family}"`, fontWeight: world.text.bold, fontSize: u * size, lineHeight: 1.2, whiteSpace: 'nowrap', direction: /[؀-ۿ]/.test(text) ? 'rtl' : 'ltr' }}>{text}</div>
);

/** Carousel position as short dashes, the current one bright. */
export const Progress: React.FC<{ i: number; n: number; pal: Palette; u: number; w: number }> = ({ i, n, pal, u, w }) => (
  <div style={{ display: 'flex', gap: u * 0.8, width: w, direction: 'rtl' }}>
    {Array.from({ length: n }, (_, k) => <div key={k} style={{ flex: 1, height: Math.max(3, u * 0.45), borderRadius: u, background: k + 1 === i ? pal.accent : pal.dim, opacity: k + 1 === i ? 1 : k + 1 < i ? 0.55 : 0.25 }} />)}
  </div>
);

export type StickerSpec = { text?: string; src?: string; x: number; y: number; w: number; rot?: number; shape?: 'circle' | 'square' | 'oval' | 'diamond' | 'burst'; fill?: string; ink?: string };
/** A rotated badge with a word or an icon (MNJM, afterbite, MIHAD tag). x, y, w are fractions of the frame. */
export const Sticker: React.FC<{ s: StickerSpec; W: number; H: number; world: World; pal: Palette; u: number }> = ({ s, W, H, world, pal, u }) => {
  const w = s.w * W, h = s.shape === 'oval' ? w * 0.62 : s.shape === 'square' || s.shape === 'diamond' || s.shape === 'circle' || s.shape === 'burst' ? w : w * 0.42;
  const fill = s.fill ?? pal.accent2 ?? pal.accent, ink = s.ink ?? inkOn(fill, pal);
  const m = useMotion();
  const clip = s.shape === 'burst' ? `polygon(${Array.from({ length: 24 }, (_, k) => { const a = (k / 24) * Math.PI * 2, r = k % 2 ? 0.42 : 0.5; return `${50 + Math.cos(a) * r * 100}% ${50 + Math.sin(a) * r * 100}%`; }).join(',')})` : s.shape === 'diamond' ? 'polygon(50% 0,100% 50%,50% 100%,0 50%)' : undefined;
  return (
    <div data-qa="sticker" style={{ position: 'absolute', left: s.x * W - w / 2, top: s.y * H - h / 2, width: w, height: h, transform: `rotate(${s.rot ?? -8}deg) ${stickerLand(m, s.y * H).transform ?? ''}`, opacity: stickerLand(m, s.y * H).opacity, filter: `drop-shadow(0 ${u * 0.6}px ${u * 0.8}px rgba(0,0,0,.28))` }}>
      <div style={{ position: 'absolute', inset: 0, background: fill, clipPath: clip, borderRadius: s.shape === 'circle' || s.shape === 'oval' ? '50%' : s.shape === 'square' ? u * 0.6 : s.shape ? 0 : u * 0.5, border: !clip ? `${Math.max(2, u * 0.35)}px solid ${ink}` : undefined, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {s.src ? <Img src={staticFile(s.src)} style={{ width: '62%', height: '62%', objectFit: 'contain' }} /> : <div style={{ fontFamily: `"${world.text.family}"`, fontWeight: world.text.bold, fontSize: w * (s.text && s.text.length > 6 ? 0.16 : 0.22), lineHeight: 1.2, color: ink, textAlign: 'center', direction: 'rtl', whiteSpace: 'pre-line', padding: '0 8%' }}>{s.text}</div>}
      </div>
    </div>
  );
};

/** A paper strip with torn ends holding a label (series name, date), slightly rotated, optional tape. */
export const PaperTag: React.FC<{ text: string; world: World; pal: Palette; u: number; rot?: number; size?: number; tape?: boolean; paper?: 'white' | 'kraft' | 'black'; style?: React.CSSProperties }> = ({ text, world, pal, u, rot = -2, size = T.lead, tape, paper = 'white', style }) => {
  // a real torn paper strip (stock scan, cut out) stretched behind the words
  const src = { white: 'textures/cut/torn-white-crumpled-strip.png', kraft: 'textures/cut/torn-kraft.png', black: 'textures/cut/torn-black-strip.png' }[paper];
  return (
    <div data-qa="over" style={{ position: 'relative', display: 'inline-block', transform: `rotate(${rot}deg)`, ...style }}>
      <Img src={staticFile(src)} style={{ position: 'absolute', left: -u * 1.6, right: -u * 1.6, top: -u * 1.2, bottom: -u * 1.2, width: `calc(100% + ${u * 3.2}px)`, height: `calc(100% + ${u * 2.4}px)`, objectFit: 'fill', filter: 'drop-shadow(0 5px 7px rgba(0,0,0,.35))' }} />
      <div style={{ position: 'relative', color: paper === 'black' ? '#f4efe6' : '#1a1410', padding: `${u * 0.7}px ${u * 2.4}px ${u * 0.9}px`, fontFamily: `"${world.text.family}"`, fontWeight: world.text.bold, fontSize: u * size, lineHeight: 1.2, whiteSpace: 'nowrap', direction: 'rtl' }}>{text}</div>
      {tape && <Img src={staticFile('textures/cut/tape-x-wrinkled.png')} style={{ position: 'absolute', top: -u * 2.4, left: '40%', width: u * 7, transform: 'rotate(8deg)', opacity: 0.85 }} />}
    </div>
  );
};

/** A scanned texture laid over the whole frame (dust, plastic wrap, paper), blended like a print. */
export const Texture: React.FC<{ src: string; blend: React.CSSProperties['mixBlendMode']; opacity: number }> = ({ src, blend, opacity }) => (
  <AbsoluteFill style={{ mixBlendMode: blend, opacity, pointerEvents: 'none' }}>
    <Img src={staticFile(src)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
  </AbsoluteFill>
);

/** A paper tear across the frame at height y: everything under it takes `fill`. */
export const Torn: React.FC<{ y: number; W: number; H: number; fill: string; seed?: number; depth?: number }> = ({ y, W, H, fill, seed = 3, depth = 14 }) => {
  let s = seed; const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const pts: string[] = [];
  for (let x = 0; x <= W; x += W / 60) pts.push(`${x},${y + (rnd() - 0.5) * depth * 2}`);
  return <svg width={W} height={H} style={{ position: 'absolute', left: 0, top: 0 }}><polygon points={`0,${H} ${pts.join(' ')} ${W},${H}`} fill={fill} style={{ filter: 'drop-shadow(0 -3px 4px rgba(0,0,0,.25))' }} /></svg>;
};

/** A brush stroke across a face or a word (documentary). Rect in px. */
export const Censor: React.FC<{ r: Rect; color: string }> = ({ r, color }) => (
  <svg style={{ position: 'absolute', left: r.x, top: r.y, overflow: 'visible' }} width={r.w} height={r.h} viewBox="0 0 100 20" preserveAspectRatio="none">
    <path d="M2 9 C 20 3, 45 5, 60 4 S 92 3, 98 8 L 97 14 C 80 17, 50 18, 30 16 S 6 16, 3 13 Z" fill={color} opacity={0.92} />
  </svg>
);

/** One line that runs across all the slides of a carousel through a node on each slide (Taiseer, seamless carousels).
 *  ys: the node height of every slide (fraction of H); x: where the node sits on a slide (fraction of W, from the left). */
export const LinePath: React.FC<{ i: number; ys: number[]; x?: number; W: number; H: number; color: string; u: number; nodeText?: string; world: World; pal: Palette; node?: boolean }> = ({ i, ys, x = 0.5, W, H, color, u, nodeText, world, pal, node: showNode = true }) => {
  const n = ys.length;
  // the strip of slides as the feed shows it: slide 2 sits to the right of slide 1 (you swipe left), whatever the language.
  // The line starts at the first slide's node and leaves the last slide by its far edge.
  const node = (k: number) => [k * W + W * x, ys[k] * H] as const;
  const pts = [...Array.from({ length: n }, (_, k) => node(k)), [n * W + W * 0.3, ys[n - 1] * H]];
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let k = 1; k < pts.length; k++) { const [x0, y0] = pts[k - 1], [x1, y1] = pts[k]; const cx = (x0 + x1) / 2; d += ` C ${cx} ${y0}, ${cx} ${y1}, ${x1} ${y1}`; }
  const [nx, ny] = node(i - 1);
  const ox = -(i - 1) * W;
  return (
    <>
      <svg width={W} height={H} style={{ position: 'absolute', left: 0, top: 0 }}><path d={d} transform={`translate(${ox} 0)`} stroke={color} strokeWidth={Math.max(3, u * 0.55)} fill="none" strokeLinecap="round" /></svg>
      {showNode && <div style={{ position: 'absolute', left: nx + ox - u * 4.5, top: ny - u * 4.5, width: u * 9, height: u * 9, borderRadius: '50%', background: pal.ground, border: `${Math.max(3, u * 0.55)}px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: `"${world.display.family}"`, fontWeight: world.display.weight, fontSize: u * T.lead, color }}>{nodeText ?? i}</div>}
    </>
  );
};

/** A word or mark repeated in rotated rows, like wrapping paper (afterbite, Chahi). */
export const Pattern: React.FC<{ text: string; world: World; color: string; size: number; W: number; H: number; rot?: number; opacity?: number }> = ({ text, world, color, size, W, H, rot = -12, opacity = 1 }) => {
  const rows = Math.ceil((H * 1.6) / (size * 1.5)), row = Array.from({ length: Math.ceil((W * 1.6) / (size * text.length * 0.5)) + 2 }, () => text).join('  ');
  return (
    <div style={{ position: 'absolute', left: -W * 0.3, top: -H * 0.3, width: W * 1.6, height: H * 1.6, transform: `rotate(${rot}deg)`, opacity, overflow: 'hidden' }}>
      {Array.from({ length: rows }, (_, k) => <div key={k} style={{ fontFamily: `"${world.display.family}"`, fontWeight: world.display.weight, fontSize: size, lineHeight: 1.5, color, whiteSpace: 'nowrap', marginLeft: (k % 2) * size * 1.4, direction: 'rtl' }}>{row}</div>)}
    </div>
  );
};

/** Film grain over everything. */
export const Grain: React.FC<{ amount: number; seed?: number }> = ({ amount, seed = 7 }) => amount <= 0 ? null : (
  <AbsoluteFill style={{ opacity: amount, mixBlendMode: 'overlay', pointerEvents: 'none' }}>
    <svg width="100%" height="100%"><filter id={`grain-${seed}`}><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={seed} /><feColorMatrix type="saturate" values="0" /></filter><rect width="100%" height="100%" filter={`url(#grain-${seed})`} /></svg>
  </AbsoluteFill>
);

/** Soft light behind a subject (ground2 glow), and a vignette at the edges. */
export const light = (c: string) => { const [r, g, b] = hex(c); return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.6; };

export const Light: React.FC<{ pal: Palette; at?: [number, number]; size?: number; vignette?: number }> = ({ pal, at = [50, 45], size = 60, vignette = 0.45 }) => light(pal.ground) && !pal.ground2 ? null : (
  <>
    {pal.ground2 && <AbsoluteFill style={{ background: `radial-gradient(circle at ${at[0]}% ${at[1]}%, ${pal.ground2} 0%, ${pal.ground2}00 ${size}%)` }} />}
    {vignette > 0 && <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(0,0,0,${vignette}) 100%)` }} />}
  </>
);

export { Meta };
