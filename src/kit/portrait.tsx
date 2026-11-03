import React from 'react';
import { lerp, ramp, Words } from './anim';
import { Brand, personal } from './brand';
import { Layout } from './layout';

// Format 3, 9:16 pieces (first used by video 2): the night palette, type, safe zones, the one-line caption, the headline,
// and the small UI atoms its panels are built from. Zones of a 1080 x 1920 frame are in docs/motion-book.md (version 2).

export const W916 = 1080, H916 = 1920;
export const C = { bg: '#070B1A', bg2: '#131B3A', fg: '#F4F6FF', dim: '#98A2C3', line: 'rgba(140,160,255,.22)', glass: 'rgba(18,25,52,.78)', ball: '#FF5A3C', code: '#FFD23F', ok: '#3DDC97', bad: '#FF4D6D', blue: '#6F8CFF', pink: '#FF4D8D' };
export const nightBrand: Brand = { ...personal, name: 'night-studio', paper: C.bg, ink: C.fg, font: { ...personal.font, accent: '"Readex Pro", sans-serif' } };
export const sans = 'Alexandria, sans-serif', head = '"Readex Pro", Alexandria, sans-serif', mono = '"JetBrains Mono", monospace';
export const SAFE = { top: 220, bottom: 380, side: 70 };
/** The layout the layout check (qa.mjs check) reads for a format 3 film: text keeps these margins and never overlaps other text. */
export const studio916: Layout = {
  name: 'studio-9x16', W: 1080, H: 1920, stage: { ox: 0, oy: 0, tx: 0, ty: 0, scale: 1 }, copy: { box: {}, scale: 1, wrap: false },
  caption: { bottom: 380, size: 42 }, qa: { left: 0, right: 1080, top: 0, bottom: 1920 }, safe: { top: 220, bottom: 380, side: 70 },
};
export const glass: React.CSSProperties = { background: C.glass, border: `1.5px solid ${C.line}`, boxShadow: '0 30px 90px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.08)' };

export type Cue = { start: number; end: number; text: string };
/** A caption stays on one line: a long cue is cut in two at the space nearest its middle, the time shared by length. */
export const oneLine = (cues: Cue[], max = 40) => cues.flatMap((c) => {
  if (c.text.length <= max) return [c];
  const w = c.text.split(' '); let at = 1, best = 1e9, n = 0;
  w.forEach((x, i) => { n += x.length + 1; const d = Math.abs(n - c.text.length / 2); if (i < w.length - 1 && d < best) { best = d; at = i + 1; } });
  const a = w.slice(0, at).join(' '), b = w.slice(at).join(' '), mid = c.start + (c.end - c.start) * (a.length / c.text.length);
  return [{ start: c.start, end: mid, text: a }, { start: mid, end: c.end, text: b }];
});

/** The caption at the bottom: one line at a time, faded on the voice. Pass cues through `oneLine` first. */
export const Caption: React.FC<{ t: number; cues: Cue[] }> = ({ t, cues }) => (
  <>
    {cues.map((c, i) => {
      const end = Math.min(cues[i + 1]?.start ?? c.end + 0.5, c.end + 0.5);
      const o = ramp(t, c.start - 0.06, c.start + 0.1) * (1 - ramp(t, end - 0.18, end - 0.06));
      if (o <= 0) return null;
      return (
        <div key={i} style={{ position: 'absolute', left: SAFE.side, right: SAFE.side, bottom: SAFE.bottom, display: 'flex', justifyContent: 'center', opacity: o }}>
          <div data-qa="caption" style={{ fontFamily: sans, fontWeight: 600, fontSize: 42, color: C.fg, direction: 'rtl', textAlign: 'center', background: 'rgba(7,11,26,.7)', border: `1px solid ${C.line}`, padding: '12px 28px 16px', borderRadius: 20, lineHeight: 1.5 }}>{c.text}</div>
        </div>
      );
    })}
  </>
);

/** Headline at the top: a small lead line and one loud line lit from behind. */
export const Head: React.FC<{ t: number; at: number; out: number; lead?: string; big: string; tint?: [string, string]; bigAt?: number; size?: number; ltr?: boolean; top?: number }> = ({ t, at, out, lead, big, tint = ['#FFFFFF', '#B9C6FF'], bigAt, size = 104, ltr, top = SAFE.top + 20 }) => {
  if (t < at - 0.05 || t > out + 0.25) return null;
  const b = bigAt ?? at + (lead ? 0.3 : 0);
  return (
    <div style={{ position: 'absolute', left: SAFE.side, right: SAFE.side, top, textAlign: 'center', direction: 'rtl', opacity: 1 - ramp(t, out, out + 0.2) }}>
      {lead && <Words qa="over" t={t} at={at} text={lead} style={{ fontFamily: sans, fontWeight: 500, fontSize: 50, color: C.dim, lineHeight: 1.4 }} />}
      <div style={{ position: 'relative', marginTop: lead ? 4 : 0 }}>
        <div style={{ position: 'absolute', left: '15%', right: '15%', top: '25%', bottom: '5%', background: tint[1], filter: 'blur(60px)', opacity: 0.28 * ramp(t, b, b + 0.4) }} />
        <Words qa="over" t={t} at={b} gap={0.12} text={big} style={{ position: 'relative', fontFamily: ltr ? mono : head, direction: ltr ? 'ltr' : undefined, fontWeight: 700, fontSize: size, lineHeight: 1.3, whiteSpace: 'nowrap', color: tint[0], textShadow: `0 4px 0 rgba(0,0,0,.35), 0 0 42px ${tint[1]}66` }} />
      </div>
    </div>
  );
};

export const num = (n: number) => Math.round(n).toLocaleString('en-US');
export const box = (top: number, more: React.CSSProperties = {}): React.CSSProperties => ({ position: 'absolute', left: SAFE.side, right: SAFE.side, top, ...more });
export const Card: React.FC<{ style?: React.CSSProperties; children: React.ReactNode }> = ({ style, children }) => <div data-qa="over" style={{ ...glass, borderRadius: 30, ...style }}>{children}</div>;
export const code: React.CSSProperties = { fontFamily: mono, fontWeight: 500, direction: 'ltr', whiteSpace: 'pre', color: C.fg };
export const K: React.FC<{ c: string; children: React.ReactNode; glow?: number }> = ({ c, children, glow = 0 }) => <span style={{ color: c, textShadow: glow ? `0 0 ${22 * glow}px ${c}` : undefined }}>{children}</span>;
export const Dots = () => <>{['#FF5F57', '#FEBC2E', '#28C840'].map((c) => <div key={c} style={{ width: 18, height: 18, borderRadius: 9, background: c }} />)}</>;
export const Check: React.FC<{ k: number; size?: number }> = ({ k, size = 110 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{ transform: `scale(${lerp(2.2, 1, k)})`, opacity: Math.min(1, k * 3), filter: `drop-shadow(0 0 16px ${C.ok})` }}>
    <circle cx="50" cy="50" r="44" fill={C.ok} /><path d="M28 52 L44 68 L74 34" stroke="#06281A" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

/** A white pop over the whole picture: the shutter. */
export const Flash: React.FC<{ t: number; times: number[]; amt?: number; frame?: boolean }> = ({ t, times, amt = 0.5, frame }) => {
  const k = Math.max(0, ...times.map((s) => (t >= s && t < s + 0.14 ? 1 - (t - s) / 0.14 : 0)));
  if (k <= 0) return null;
  return <div style={{ position: 'absolute', inset: 0, background: `rgba(255,255,255,${amt * k})`, boxShadow: frame ? `inset 0 0 0 ${18 * k}px #fff` : undefined, pointerEvents: 'none' }} />;
};

