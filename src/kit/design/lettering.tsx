import React from 'react';
import { lineReveal, useMotion } from './motion';
import { rich } from './type';
import type { Face, Palette, World } from './worlds';

/* Lettering: a headline built as one block, the way the studied campaign lettering is built (Egyptian campaign lettering,
   MIHAD, El Haddad covers, Al Jazeera documentary titles), instead of a line of text in a font.
   - every line is sized so the lines share one width (a justified block), or keeps its own scale;
   - a line can be stretched with kashida instead of being scaled (Arabic justification, never letter-spacing);
   - each line may take its own face and colour; markup (*accent*, _hand_, {Latin}) works inside a line;
   - tight leading lets ascenders and descenders interlock;
   - effects: extruded 3D block, outline, hard shadow; a tag label can sit on a line like a sticker. */

export type LockLine = {
  text: string;
  face?: Face;            // default: the world's display face
  color?: string;         // default: ink
  size?: number;          // relative size when the line is not justified (1 = the block's base)
  fit?: boolean;          // false: keep `size` instead of filling the block width
  kashida?: boolean;      // fill the width by stretching one connection with tatweel instead of scaling
  tag?: { text: string; fill?: string; ink?: string; rot?: number; at?: 'start' | 'end' };
};
export type Fx = {
  extrude?: { depth: number; color: string; angle?: number };   // depth in em/100
  outline?: { width: number; color: string };                   // width in em/100
  shadow?: { x: number; y: number; color: string };             // hard shadow, em/100
  print?: { light?: string; dark?: string; glow?: string };       // printed-in-the-scene look: top light edge, soft bevel shadow, ambient glow
};

// letters that never join the next one: a kashida cannot follow them
const NON_JOIN = new Set([...'اأإآٱدذرزوؤةىءـ']);
const AR = /[ؠ-ي]/;
/** Where a tatweel may go: after a joining letter that is followed by another letter of the same word. */
const kashidaSpots = (s: string) => {
  const spots: number[] = [];
  for (let i = 0; i < s.length - 1; i++) if (AR.test(s[i]) && !NON_JOIN.has(s[i]) && AR.test(s[i + 1])) spots.push(i + 1);
  return spots;
};
/** The spot used: in the longest word of the line, the last joint before its final letter (how letterers stretch a word). */
const pickSpot = (s: string) => {
  const spots = kashidaSpots(s.replace(/[*_{}^]/g, ' '));
  if (!spots.length) return -1;
  const words = [...s.matchAll(/[ؠ-ي]+/g)].sort((a, b) => b[0].length - a[0].length);
  const w = words[0];
  const inWord = spots.filter((p) => w && p > w.index! && p < w.index! + w[0].length - 1);
  return (inWord.length ? inWord : spots)[(inWord.length ? inWord : spots).length - 1];
};
const stretch = (s: string, n: number) => { const p = pickSpot(s); return p < 0 || n <= 0 ? s : s.slice(0, p) + 'ـ'.repeat(n) + s.slice(p); };

const fxStyle = (fx: Fx | undefined, size: number): React.CSSProperties => {
  if (!fx) return {};
  const shadows: string[] = [];
  if (fx.extrude) {
    const a = ((fx.extrude.angle ?? 135) * Math.PI) / 180, d = (fx.extrude.depth / 100) * size, steps = Math.max(2, Math.round(d));
    for (let i = 1; i <= steps; i++) shadows.push(`${(-Math.cos(a) * d * i) / steps}px ${(Math.sin(a) * d * i) / steps}px 0 ${fx.extrude.color}`);
  }
  if (fx.print) {
    const p = fx.print;
    shadows.push(`0 ${-size * 0.008}px 0 ${p.light ?? 'rgba(255,255,255,.55)'}`, `0 ${size * 0.02}px ${size * 0.01}px ${p.dark ?? 'rgba(0,0,0,.45)'}`, `0 ${size * 0.06}px ${size * 0.12}px rgba(0,0,0,.5)`);
    if (p.glow) shadows.push(`0 0 ${size * 0.25}px ${p.glow}`);
  }
  if (fx.shadow) shadows.push(`${(fx.shadow.x / 100) * size}px ${(fx.shadow.y / 100) * size}px 0 ${fx.shadow.color}`);
  return {
    textShadow: shadows.length ? shadows.join(',') : undefined,
    WebkitTextStroke: fx.outline ? `${(fx.outline.width / 100) * size}px ${fx.outline.color}` : undefined,
    paintOrder: fx.outline ? 'stroke fill' : undefined,
  };
};

export type LockupProps = {
  lines: LockLine[]; world: World; pal: Palette;
  width: number;            // the block width: fitted lines reach it, no line passes it
  maxH: number;             // the block never grows taller than this (it shrinks as a whole)
  maxSize?: number;         // no line grows past this font size
  gap?: number;             // space between the ink of two lines, as a fraction of the smaller line's size (default 0.1)
  lead?: number;            // kept for older specs: a lead under 1 tightens the gap
  align?: 'start' | 'center' | 'end';
  fx?: Fx;
  latin?: boolean;
  style?: React.CSSProperties;
};

let ctx: CanvasRenderingContext2D | null = null;
/** The ink box of a line (how far its letters really reach above and below the baseline), not the font's line box. */
const ink = (text: string, f: Face, size: number, rtl: boolean) => {
  ctx = ctx ?? document.createElement('canvas').getContext('2d');
  ctx!.font = `${f.weight} ${size}px "${f.family}"`;
  ctx!.direction = rtl ? 'rtl' : 'ltr';
  const m = ctx!.measureText(text.replace(/[*_{}^]/g, ''));
  return { up: m.actualBoundingBoxAscent, down: m.actualBoundingBoxDescent, w: m.width, fa: m.fontBoundingBoxAscent, fd: m.fontBoundingBoxDescent };
};
// heavy Arabic display faces carry wide word spaces; letterers close them up
const WORD_SPACE = -0.08;
const spaceOf = (f: Face) => f.space ?? WORD_SPACE;

/** The ink silhouette of a line, column by column: how high and how low its letters reach above/below the baseline. */
const profile = (text: string, f: Face, size: number, rtl: boolean, blockW: number, pos: number, bin: number) => {
  const m = ink(text, f, size, rtl);
  const pad = Math.ceil(size * 0.6), Hc = Math.ceil(m.up + m.down + pad * 2), Wc = Math.ceil(blockW + 2);
  const cv = document.createElement('canvas'); cv.width = Wc; cv.height = Hc;
  const c = cv.getContext('2d', { willReadFrequently: true })!;
  c.font = `${f.weight} ${size}px "${f.family}"`; c.direction = rtl ? 'rtl' : 'ltr';
  (c as unknown as { wordSpacing: string }).wordSpacing = `${spaceOf(f) * size}px`;
  c.textAlign = rtl ? 'right' : 'left'; c.textBaseline = 'alphabetic';
  const base = pad + m.up;
  c.fillText(text.replace(/[*_{}^]/g, ''), rtl ? Wc - 1 - pos : 1 + pos, base);
  const d = c.getImageData(0, 0, Wc, Hc).data;
  const n = Math.ceil(Wc / bin), top = new Array(n).fill(Infinity), bot = new Array(n).fill(-Infinity);
  for (let y = 0; y < Hc; y++) for (let x = 0; x < Wc; x++) if (d[(y * Wc + x) * 4 + 3] > 60) {
    const k = Math.floor(x / bin); const yy = y - base;
    if (yy < top[k]) top[k] = yy; if (yy > bot[k]) bot[k] = yy;
  }
  return { top, bot };
};

/** A headline block built line by line, the way a letterer builds it. Lines are sized (fitted to the block width,
 *  stretched with kashida, or kept at a relative size), then stacked by their ink silhouettes: each line comes down
 *  until its letters are one even gap away from the letters above, column by column. Ascenders slot between the
 *  descenders above them, so the block interlocks like hand lettering, and no two letters ever touch. */
export const Lockup: React.FC<LockupProps> = ({ lines, world, pal, width, maxH, maxSize = 9999, gap, lead, align = 'start', fx, latin, style }) => {
  type Row = { size: number; text: string; up: number; down: number; w: number; fa: number; fd: number; y: number; pos: number };
  const [plan, setPlan] = React.useState<{ rows: Row[]; W: number; H: number } | null>(null);
  const key = JSON.stringify(lines) + width + maxH + maxSize + gap + lead + world.name + align;
  const rtl = !latin;
  const g = gap ?? (lead !== undefined ? Math.max(0.03, 0.07 - (1 - lead) * 0.2) : 0.07);
  React.useLayoutEffect(() => {
    const B = 100;
    const face = (l: LockLine) => l.face ?? world.display;
    const wAt = (l: LockLine, text: string) => ink(text, face(l), B, rtl).w + wordGaps(text) * spaceOf(face(l)) * B;
    const fitted = lines.map((l) => l.fit === false ? B * (l.size ?? 1) : (B * width) / wAt(l, l.text));
    const others = fitted.filter((_, i) => lines[i].fit !== false && !lines[i].kashida);
    const base = others.length ? Math.min(...others) : B;
    let out = lines.map((l, i) => {
      let size = Math.min(fitted[i], maxSize), text = l.text;
      if (l.kashida && l.fit !== false) {
        // a short stretch reads as lettering, a long one as a bar: at most 2 tatweels, the rest by scale
        const target = (width / Math.min(base, maxSize)) * B;
        let n = 0;
        while (n < 2 && wAt(l, stretch(l.text, n + 1)) <= target) n++;
        text = stretch(l.text, n);
        size = Math.min((B * width) / wAt(l, text), maxSize);
      }
      return { size, text };
    });
    const widest = Math.max(...out.map((o, i) => (wAt(lines[i], o.text) * o.size) / B));
    if (widest > width) out = out.map((o) => ({ ...o, size: (o.size * width) / widest }));
    const layout = (o: typeof out) => {
      const rows = o.map((x, i) => ({ ...x, ...ink(x.text, face(lines[i]), x.size, rtl), y: 0, pos: 0 }));
      const W = Math.max(...rows.map((r, i) => r.w + wordGaps(r.text) * spaceOf(face(lines[i])) * r.size));
      rows.forEach((r, i) => { const lw = r.w + wordGaps(r.text) * spaceOf(face(lines[i])) * r.size; r.pos = align === 'center' ? (W - lw) / 2 : align === 'end' ? W - lw : 0; });
      const bin = Math.max(2, Math.round(Math.min(...rows.map((r) => r.size)) * 0.03));
      const prof = rows.map((r, i) => profile(r.text, face(lines[i]), r.size, rtl, W, r.pos, bin));
      rows[0].y = rows[0].up;
      for (let i = 1; i < rows.length; i++) {
        // extrude, outline and print add ink the canvas profile does not see: keep that much more air
        const extra = ((fx?.extrude?.depth ?? 0) + (fx?.outline?.width ?? 0) * 2) / 100;
        const gp = (g + extra) * Math.min(rows[i].size, rows[i - 1].size);
        let need = -Infinity;
        // the closest the two silhouettes may come, checked across neighbouring columns too (letters are not columns)
        for (let k = 0; k < prof[i].top.length; k++) for (let j = Math.max(0, k - 2); j <= Math.min(prof[i].top.length - 1, k + 2); j++) {
          const b = prof[i - 1].bot[j], t = prof[i].top[k];
          if (b > -Infinity && t < Infinity) need = Math.max(need, b - t);
        }
        rows[i].y = rows[i - 1].y + (need > -Infinity ? need : rows[i - 1].down + rows[i].up) + gp;
      }
      const H = rows[rows.length - 1].y + rows[rows.length - 1].down;
      return { rows, W, H };
    };
    let p = layout(out);
    if (p.H > maxH) p = layout(out.map((o) => ({ ...o, size: (o.size * maxH) / p.H })));
    setPlan(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const m = useMotion();
  if (!plan) return <div style={{ width, height: 1 }} />;
  return (
    <div data-qa="over" style={{ position: 'relative', width: plan.W, height: plan.H, flexShrink: 0, direction: rtl ? 'rtl' : 'ltr', alignSelf: align === 'center' ? 'center' : align === 'end' ? 'flex-end' : 'flex-start', ...style }}>
      {plan.rows.map((x, i) => {
        const l = lines[i], f = l.face ?? world.display, s = x.size;
        return (
          <div key={i} style={{ position: 'absolute', top: x.y - x.fa, [rtl ? 'right' : 'left']: x.pos, height: x.fa + x.fd, fontFamily: `"${f.family}"`, fontWeight: f.weight, fontSize: s, lineHeight: `${x.fa + x.fd}px`, wordSpacing: `${spaceOf(f)}em`, whiteSpace: 'nowrap', direction: /[؀-ۿ]/.test(x.text) ? 'rtl' : 'ltr', color: l.color ?? pal.ink, ...fxStyle(fx, s), ...lineReveal(m, i).outer }}>
            <span style={{ display: 'inline-block', verticalAlign: 'baseline', ...lineReveal(m, i).inner }}>{rich(x.text, world, pal)}</span>
            {l.tag && (
              <span style={{ position: 'absolute', top: x.fa - x.up, [l.tag.at === 'end' ? (rtl ? 'left' : 'right') : (rtl ? 'right' : 'left')]: 0, transform: `translateY(-70%) rotate(${l.tag.rot ?? -6}deg)`, fontFamily: `"${world.text.family}"`, fontWeight: world.text.bold, fontSize: Math.max(26, s * 0.15), lineHeight: 1.15, wordSpacing: 0, padding: '0.18em 0.6em 0.26em', background: l.tag.fill ?? pal.paper ?? pal.accent, color: l.tag.ink ?? pal.ground, textShadow: 'none', WebkitTextStroke: '0', whiteSpace: 'nowrap', boxShadow: '0 4px 10px rgba(0,0,0,.25)' }}>{l.tag.text}</span>
            )}
          </div>
        );
      })}
    </div>
  );
};
const wordGaps = (t: string) => (t.replace(/[*_{}^]/g, '').trim().match(/ +/g) ?? []).length;
