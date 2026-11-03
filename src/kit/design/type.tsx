import React from 'react';
import { barReveal, lineReveal, useMotion } from './motion';
import { contrast, type Face, type Palette, type World } from './worlds';

/* Markup used in every text of a spec:
     line breaks   "\n"    each line is a phrase, kept whole (never re-wrapped)
     *words*               the accent phrase, in the accent colour
     _word_                one word in the world's second voice (hand / calligraphic)
     {Latin}               Latin words in the world's Latin face, optically matched (0.86)
     ^Latin^               micro Latin tucked between Arabic lines (MNJM device), tiny, accent2
   Kashida is typed into the text itself (شايـــل), never letter-spacing. */

export type Box = { w: number; h: number };
const css = (face: Face): React.CSSProperties => ({ fontFamily: `"${face.family}"`, fontWeight: face.weight });

export const rich = (text: string, world: World, pal: Palette, base: { accent?: string; chip?: { bg: string; fg: string } } = {}): React.ReactNode[] => {
  const out: React.ReactNode[] = [];
  const re = /\*([^*]+)\*|_([^_]+)_|\{([^}]+)\}|\^([^^]+)\^/g;
  let last = 0, m: RegExpExecArray | null, k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) out.push(<span key={k++} style={base.chip ? { display: 'inline-block', background: base.chip.bg, color: base.chip.fg, padding: '0.12em 0.3em 0.2em', margin: '-0.12em 0 -0.2em', marginInlineStart: m.index === 0 ? '-0.3em' : '0.06em', marginInlineEnd: m.index + m[0].length === text.length ? '-0.3em' : '0.06em' } : { color: base.accent ?? pal.accent }}>{m[1]}</span>);
    else if (m[2]) out.push(<span key={k++} style={{ ...css(world.hand ?? world.display), color: base.accent ?? pal.accent }}>{m[2]}</span>);
    else if (m[3]) out.push(<span key={k++} style={{ ...css(world.latin), fontSize: '0.86em', textTransform: world.latin.upper ? 'uppercase' : undefined, letterSpacing: world.latin.track ? `${world.latin.track}em` : undefined, unicodeBidi: 'isolate' }}>{m[3]}</span>);
    else if (m[4]) out.push(<span key={k++} style={{ ...css(world.latin), display: 'inline-block', fontSize: '0.2em', lineHeight: 1.05, width: '4.6em', verticalAlign: 'middle', margin: '0 0.6em', color: pal.accent2 ?? pal.accent, direction: 'ltr', textAlign: 'left', whiteSpace: 'normal', textTransform: world.latin.upper ? 'uppercase' : undefined }}>{m[4]}</span>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
};

/** Shrinks its font size until the content fits the box (width and height), in one layout pass. */
export const useFit = (max: number, min: number, box: Box, deps: unknown[]) => {
  const ref = React.useRef<HTMLDivElement>(null);
  const [size, setSize] = React.useState(max);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let s = max;
    el.style.fontSize = `${s}px`;
    while (s > min && (el.scrollWidth > box.w + 1 || el.scrollHeight > box.h + 1)) { s = Math.max(min, s * 0.97); el.style.fontSize = `${s}px`; }
    setSize(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [max, min, box.w, box.h, ...deps]);
  return { ref, size };
};

export type LinesProps = {
  text: string; world: World; pal: Palette; face?: Face; lead?: number;
  size: number; min?: number; box: Box;
  color?: string; align?: 'start' | 'center' | 'end'; latin?: boolean;
  bars?: { fill?: string; ink?: string; alt?: string[] };   // highlight bars: each line on its own box
  shadow?: string; stroke?: { w: number; color: string }; upper?: boolean; track?: number;
  qa?: string; style?: React.CSSProperties;
};

/** Headline lines as authored, fitted to a box. With `bars`, every line sits on its own tight box. */
export const Lines: React.FC<LinesProps> = (p) => {
  const face = p.face ?? p.world.display;
  const lead = p.lead ?? (p.bars ? 1.0 : p.world.display.lead);
  const lines = p.text.split('\n');
  const { ref, size } = useFit(p.size, p.min ?? p.size * 0.3, p.box, [p.text, face.family]);
  const m = useMotion();
  const dir = p.latin ? 'ltr' : 'rtl';
  const sticker = p.world.fx === 'sticker' && !p.bars && face === p.world.display;
  const stroke = p.stroke ?? (sticker ? { w: size * 0.1, color: p.pal.accent } : undefined);
  const shadow = p.shadow ?? (sticker ? `0 ${size * 0.06}px 0 rgba(0,0,0,.35)` : undefined);
  const items = p.align === 'center' ? 'center' : p.align === 'end' ? 'flex-end' : 'flex-start';
  // an accent word on a bar of the accent's own colour would vanish: it becomes an inverted chip on the bar instead
  const barFill = (i: number) => p.bars?.alt?.[i % p.bars.alt.length] ?? p.bars?.fill ?? p.pal.bar ?? p.pal.ink;
  const barAccent = (i: number) => /^#/.test(barFill(i)) && contrast(p.pal.accent, barFill(i)) < 3 ? { chip: { bg: p.bars?.ink ?? p.pal.barInk ?? p.pal.ground, fg: barFill(i) } } : { accent: p.pal.accent };
  return (
    <div ref={ref} data-qa={p.qa ?? 'over'} style={{ ...css(face), fontSize: size, lineHeight: lead, color: p.color ?? p.pal.ink, direction: dir, width: p.box.w, maxHeight: p.box.h, display: 'flex', flexDirection: 'column', alignItems: items, gap: p.bars ? '0.1em' : 0, textTransform: p.upper ? 'uppercase' : undefined, letterSpacing: p.track ? `${p.track}em` : undefined, ...p.style }}>
      {lines.map((ln, i) => (
        <div key={i} style={{ whiteSpace: 'nowrap', textAlign: p.align === 'center' ? 'center' : undefined, ...(p.bars ? { background: p.bars.alt?.[i % p.bars.alt.length] ?? p.bars.fill ?? p.pal.bar ?? p.pal.ink, color: p.bars.ink ?? p.pal.barInk ?? p.pal.ground, padding: '0.12em 0.3em 0.2em', lineHeight: 1.18 } : {}), textShadow: shadow, WebkitTextStroke: stroke ? `${stroke.w}px ${stroke.color}` : undefined, paintOrder: stroke ? 'stroke fill' : undefined, ...(p.bars ? barReveal(m, i, !p.latin).bar : lineReveal(m, i).outer) }}>
          <span style={p.bars ? barReveal(m, i, !p.latin).words : { display: 'inline-block', ...lineReveal(m, i).inner }}>{rich(ln, p.world, p.pal, p.bars ? barAccent(i) : sticker ? { accent: p.pal.accent2 ?? p.pal.ink } : {})}</span>
        </div>
      ))}
    </div>
  );
};

/** Reading text (body, labels): wraps naturally, fitted to its box. */
/** Reading text (body, labels, captions). Rules from docs/design-system.md 3.3: Arabic leads 1.65, Latin 1.5; lines
 *  break "pretty" (no lone word on the last line); the measure is capped near 40 Arabic characters; it never shrinks under
 *  `min` (the floor that keeps it readable on a phone), and over a photo it gets a soft shadow so it never disappears. */
export const Text: React.FC<{ text: string; world: World; pal: Palette; size: number; min?: number; box: Box; color?: string; bold?: boolean; align?: 'start' | 'center'; lead?: number; latin?: boolean; onPhoto?: boolean; style?: React.CSSProperties }> = (p) => {
  const w = Math.min(p.box.w, p.size * (p.latin ? 30 : 24));
  const { ref, size } = useFit(p.size, Math.max(p.min ?? 0, p.size * 0.75), { w, h: p.box.h }, [p.text]);
  return (
    <div ref={ref} data-qa="over" style={{ fontFamily: `"${p.world.text.family}"`, fontWeight: p.bold ? p.world.text.bold : p.world.text.weight, fontSize: size, lineHeight: p.lead ?? (p.latin ? 1.5 : 1.65), color: p.color ?? p.pal.dim, direction: p.latin ? 'ltr' : 'rtl', textAlign: p.align === 'center' ? 'center' : undefined, width: w, maxHeight: p.box.h, marginInline: p.align === 'center' ? 'auto' : undefined, textWrap: p.text.length <= 140 ? 'balance' : 'pretty', letterSpacing: 0, wordSpacing: 0, textShadow: p.onPhoto ? `0 1px ${size * 0.25}px rgba(0,0,0,.65), 0 0 ${size * 0.6}px rgba(0,0,0,.35)` : undefined, ...p.style } as React.CSSProperties}>
      {p.text.split('\n').map((ln, i) => <div key={i}>{rich(ln, p.world, p.pal, { accent: p.pal.ink })}</div>)}
    </div>
  );
};

/** One short meta line (frame furniture, labels): mono or Latin when the world has one. */
export const Meta: React.FC<{ text: string; world: World; color: string; size: number; style?: React.CSSProperties }> = ({ text, world, color, size, style }) => {
  const latin = !/[؀-ۿ]/.test(text);
  const face = latin ? world.mono ?? world.latin : world.text;
  return <div data-qa="over" style={{ fontFamily: `"${face.family}"`, fontWeight: face.weight, fontSize: size, color, letterSpacing: latin ? '0.08em' : 0, textTransform: latin ? 'uppercase' : undefined, direction: latin ? 'ltr' : 'rtl', whiteSpace: 'nowrap', lineHeight: 1.2, ...style }}>{text}</div>;
};
