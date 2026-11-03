import React from 'react';
import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { useLayout } from './layout';
import { useBrand } from './brand';

export const FPS = 30;
/** Story time in seconds. Every timing is written against the original voice-over; pass speed > 1 when that voice-over is played faster. */
/** Film time in seconds, at the composition's own frame rate (a 24 fps cut of 24 fps takes shows every source frame once). */
export const useT = (speed = 1) => (useCurrentFrame() / useVideoConfig().fps) * speed;
const C = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
export const ramp = (t: number, a: number, b: number, ease: (n: number) => number = Easing.out(Easing.cubic)) => interpolate(t, [a, b], [0, 1], { ...C, easing: ease });
export const sp = (t: number, start: number, damping = 14, stiffness = 180, mass = 1) => (t < start ? 0 : spring({ frame: (t - start) * FPS, fps: FPS, config: { damping, stiffness, mass } }));
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** Spring pop: fades in over 4 frames, scales from 0.82 with a small overshoot. */
export const Pop: React.FC<{ t: number; at: number; out?: number; from?: number; rot?: number; y?: number; style?: React.CSSProperties; children: React.ReactNode }> = ({ t, at, out, from = 0.82, rot = 0, y = 0, style, children }) => {
  const k = sp(t, at, 11, 200);
  const o = ramp(t, at, at + 0.13) * (out === undefined ? 1 : 1 - ramp(t, out, out + 0.15));
  if (o <= 0) return null;
  return <div style={{ opacity: o, transform: `translateY(${(1 - k) * y}px) scale(${lerp(from, 1, k)}) rotate(${rot}deg)`, ...style }}>{children}</div>;
};

/** Words rise one by one from behind their own baseline. */
export const Words: React.FC<{ t: number; at: number; text: string; gap?: number; damping?: number; style?: React.CSSProperties; pad?: string; qa?: string }> = ({ t, at, text, gap = 0.11, damping = 15, style, pad = '0.32em', qa = 'copy' }) => (
  <div style={style} data-qa={qa}>
    {text.split(' ').map((w, i) => {
      const k = sp(t, at + i * gap, damping, 190);
      return (
        <span key={i} style={{ display: 'inline-block', overflow: 'hidden', padding: `${pad} 0.06em`, margin: `-${pad} 0`, verticalAlign: 'top' }}>
          <span style={{ display: 'inline-block', transform: `translateY(${(1 - k) * 125}%)`, whiteSpace: 'pre', opacity: k > 0.002 ? 1 : 0 }}>{w}{i < text.split(' ').length - 1 ? ' ' : ''}</span>
        </span>
      );
    })}
  </div>
);

export type Line = { k: 'lead' | 'big' | 'accent' | 'latin' | 'num' | 'sub'; text: string; at?: number; size?: number; color?: string; strike?: number; underline?: boolean; to?: number; from?: number; prefix?: string; suffix?: string };
export type CopyState = { at: number; lines: Line[] };

/** One headline state. Column layout for 16:9. In wrap layouts the words flow in rows and the block shrinks to fit the box height. */
const State: React.FC<{ wrap: boolean; scale: number; height: number; out: number; children: React.ReactNode }> = ({ wrap, scale, height, out, children }) => {
  const ref = React.useRef<HTMLDivElement>(null);
  const [k, setK] = React.useState(scale);
  React.useLayoutEffect(() => {
    if (!wrap || !ref.current) return;
    const h = ref.current.offsetHeight, fit = h * scale > height ? height / h : scale;
    if (Math.abs(fit - k) > 0.002) setK(fit);
  });
  if (!wrap) return <div data-qa-group style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', opacity: 1 - out, transform: `translateY(${-out * 26}px)` }}>{children}</div>;
  return (
    <div ref={ref} data-qa-group style={{ position: 'absolute', right: 0, top: '50%', width: `${100 / scale}%`, display: 'flex', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 34, transformOrigin: 'center right', opacity: 1 - out, transform: `translateY(calc(-50% - ${out * 26}px)) scale(${k})` }}>{children}</div>
  );
};

const num = (n: number) => Math.round(n).toLocaleString('en-US');
/** The headline block. One state at a time; the old one drops out as the next begins. */
export const Copy: React.FC<{ t: number; states: CopyState[]; accent: string; fg?: string; dim?: string; end: number }> = ({ t, states, accent, fg: fg0, dim: dim0, end }) => {
  const { copy } = useLayout();
  const { font, ink, grey } = useBrand();
  const fg = fg0 ?? ink, dim = dim0 ?? grey;
  const wrap = copy.wrap;
  return (
  <div style={{ position: 'absolute', ...copy.box, direction: 'rtl' }}>
    {states.map((s, si) => {
      const until = states[si + 1]?.at ?? end;
      if (t < s.at - 0.02 || t > until + 0.16) return null;
      const out = ramp(t, until - 0.04, until + 0.12, Easing.in(Easing.quad));
      return (
        <State key={si} wrap={wrap} scale={copy.scale} height={Number(copy.box.height)} out={out}>
          {s.lines.map((l, i) => {
            const at = l.at ?? s.at + i * 0.22;
            if (l.k === 'lead' || l.k === 'sub') return <Words key={i} t={t} at={at} text={l.text} gap={0.07} style={{ fontFamily: font.sans, fontWeight: 500, fontSize: l.size ?? (l.k === 'lead' ? 54 : 46), lineHeight: 1.35, color: l.color ?? dim, marginTop: l.k === 'sub' ? (wrap ? 6 : 34) : 0, ...(wrap ? { flexBasis: '100%' } : {}) }} />;
            if (l.k === 'big') {
              const st = l.strike === undefined ? 0 : ramp(t, l.strike, l.strike + 0.2);
              return (
                <div key={i} style={{ position: 'relative', width: 'fit-content', flexShrink: 0 }}>
                  <Words t={t} at={at} text={l.text} style={{ fontFamily: font.sans, fontWeight: 800, fontSize: l.size ?? 128, lineHeight: 1.16, color: l.color ?? fg, whiteSpace: 'nowrap', opacity: 1 - st * 0.55 }} />
                  {st > 0 && <div style={{ position: 'absolute', right: -10, left: -10, top: '54%', height: 12, borderRadius: 6, background: accent, transformOrigin: 'right', transform: `scaleX(${st}) rotate(-2deg)` }} />}
                </div>
              );
            }
            if (l.k === 'latin') return <Words key={i} t={t} at={at} text={l.text} damping={11} style={{ fontFamily: font.latin, fontStyle: 'italic', fontSize: l.size ?? 132, lineHeight: 1.1, color: l.color ?? accent, direction: 'ltr', textAlign: 'right', whiteSpace: 'nowrap' }} />;
            if (l.k === 'num') {
              const k = ramp(t, at, at + 1.5);
              return <div key={i} data-qa="copy" style={{ fontFamily: font.mono, fontWeight: 700, fontSize: l.size ?? 170, lineHeight: 1.1, letterSpacing: -6, color: l.color ?? fg, direction: 'ltr', textAlign: 'right', opacity: ramp(t, at, at + 0.15) }}>{l.prefix}{num(lerp(l.from ?? 0, l.to ?? 0, k))}{l.suffix}</div>;
            }
            const u = ramp(t, at + 0.45, at + 0.7);
            return (
              <div key={i} style={{ position: 'relative', width: 'fit-content', flexShrink: 0, marginTop: (l.size ?? 200) * (wrap ? 0.06 : 0.17), marginBottom: (l.size ?? 200) * (wrap ? 0.1 : 0.2) }}>
                <Words t={t} at={at} text={l.text} damping={10} pad="0.5em" style={{ fontFamily: font.accent, fontWeight: 700, fontSize: l.size ?? 200, lineHeight: 1.12, color: l.color ?? accent, whiteSpace: 'nowrap' }} />
                {l.underline && <svg width="100%" height="36" viewBox="0 0 520 40" preserveAspectRatio="none" style={{ position: 'absolute', right: 0, bottom: -30 }}><path d="M512 22 C400 6, 260 34, 140 14 S 20 22, 8 12" stroke={accent} strokeWidth="9" strokeLinecap="round" fill="none" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - u} /></svg>}
              </div>
            );
          })}
        </State>
      );
    })}
  </div>
  );
};

export const Type: React.FC<{ t: number; at: number; text: string; cps?: number; caret?: string; style?: React.CSSProperties }> = ({ t, at, text, cps = 38, caret, style }) => {
  const n = Math.max(0, Math.min(text.length, Math.floor((t - at) * cps)));
  const typing = t >= at && n < text.length;
  return <span style={style}>{text.slice(0, n)}{caret && (typing || Math.floor(t * 2.2) % 2 === 0) && t >= at ? <span style={{ display: 'inline-block', width: '0.5em', height: '1.05em', background: caret, marginLeft: 4, verticalAlign: '-0.16em' }} /> : null}</span>;
};

export const Count: React.FC<{ t: number; at: number; dur?: number; from: number; to: number; prefix?: string; suffix?: string; plain?: boolean; ease?: (n: number) => number; style?: React.CSSProperties }> = ({ t, at, dur = 1.4, from, to, prefix = '', suffix = '', plain, ease, style }) => (
  <span style={{ fontVariantNumeric: 'tabular-nums', ...style }}>{prefix}{plain ? Math.round(lerp(from, to, ramp(t, at, at + dur, ease))) : num(lerp(from, to, ramp(t, at, at + dur, ease)))}{suffix}</span>
);

/** Stamp: lands hard from 3.5x with two fading rings. */
export const Stamp: React.FC<{ t: number; at: number; rot?: number; color: string; children: React.ReactNode; style?: React.CSSProperties; rings?: boolean }> = ({ t, at, rot = -6, color, children, style, rings = true }) => {
  if (t < at) return null;
  const k = ramp(t, at, at + 0.1, Easing.in(Easing.cubic));
  const r = ramp(t, at + 0.1, at + 0.8);
  return (
    <div style={{ position: 'absolute', ...style }}>
      {rings && [0, 1].map((i) => <div key={i} style={{ position: 'absolute', left: '50%', top: '50%', width: 200, height: 200, margin: -100, borderRadius: '50%', border: `3px solid ${color}`, opacity: (1 - r) * 0.7, transform: `scale(${1 + r * (2.2 + i * 1.4)})` }} />)}
      <div style={{ opacity: k, transform: `rotate(${rot}deg) scale(${lerp(3.5, 1, k)})`, filter: k < 1 ? `blur(${(1 - k) * 10}px)` : undefined }}>{children}</div>
    </div>
  );
};

export const Cursor: React.FC<{ t: number; path: [number, number, number][]; click?: number[]; color?: string }> = ({ t, path, click = [], color = '#2457E6' }) => {
  if (t < path[0][0] || t > path[path.length - 1][0] + 0.6) return null;
  let x = path[0][1], y = path[0][2];
  for (let i = 1; i < path.length; i++) {
    const k = ramp(t, path[i - 1][0], path[i][0], Easing.inOut(Easing.cubic));
    if (t >= path[i - 1][0]) { x = lerp(path[i - 1][1], path[i][1], k); y = lerp(path[i - 1][2], path[i][2], k) - Math.sin(k * Math.PI) * 26; }
  }
  const o = ramp(t, path[0][0], path[0][0] + 0.15) * (1 - ramp(t, path[path.length - 1][0] + 0.4, path[path.length - 1][0] + 0.6));
  return (
    <>
      {click.map((c) => { const r = ramp(t, c, c + 0.45); return t >= c && r < 1 ? <div key={c} style={{ position: 'absolute', left: x - 40, top: y - 40, width: 80, height: 80, borderRadius: '50%', border: `3px solid ${color}`, opacity: 1 - r, transform: `scale(${0.3 + r * 1.6})` }} /> : null; })}
      <svg width="40" height="40" viewBox="0 0 24 24" style={{ position: 'absolute', left: x, top: y, opacity: o, transform: `scale(${click.some((c) => t >= c && t < c + 0.08) ? 0.82 : 1})`, transformOrigin: 'top left' }}><path d="M4 2l15 9-7 1.6L9 20z" fill="#15130F" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" /></svg>
    </>
  );
};
