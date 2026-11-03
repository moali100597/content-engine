import React from 'react';
import { Easing } from 'remotion';
import { ramp } from './anim';
import { useLayout } from './layout';
import { useBrand } from './brand';

export type Cue = { start: number; end: number; text: string };

/** Full caption at the bottom, one phrase at a time; the first matching entry of `highlights` is tinted with the accent. */
export const Captions: React.FC<{ t: number; cues: Cue[]; highlights: string[]; accent: string; dark: boolean }> = ({ t, cues, highlights, accent, dark }) => {
  const { caption } = useLayout();
  const B = useBrand();
  return (
  <>
    {cues.map((c, i) => {
      const end = Math.min(cues[i + 1]?.start ?? c.end + 0.5, c.end + 0.5);
      const o = ramp(t, c.start - 0.06, c.start + 0.1) * (1 - ramp(t, end - 0.2, end - 0.08));
      if (o <= 0) return null;
      const h = highlights.find((x) => c.text.includes(x));
      const [pre, post] = h ? c.text.split(h) : [c.text, ''];
      return (
        <div key={i} style={{ position: 'absolute', left: 0, right: 0, bottom: caption.bottom, display: 'flex', justifyContent: 'center', direction: 'rtl', fontFamily: B.font.sans, fontWeight: 600, fontSize: caption.size, color: dark ? B.dark.fg : B.ink, opacity: o, transform: `translateY(${(1 - ramp(t, c.start - 0.06, c.start + 0.1)) * 8 - ramp(t, end - 0.2, end - 0.08) * 8}px)` }}>
          <div data-qa="caption">{pre}{h && <span style={{ color: accent }}>{h}</span>}{post}</div>
        </div>
      );
    })}
  </>
  );
};

/** A word as it was said: seconds on the film clock (from a transcript, tools/takes.py or a voice-over). */
export type SpokenWord = { at: number; end: number; text: string };

/** Words of one or more takes, placed on the film clock and cut into phrases at the script's commas (، or ,).
 *  Each take: its words in take seconds, where the take starts in the film and its in point. */
export const phrasesFrom = (takes: { words: [number, number, string][]; start: number; in: number }[]): SpokenWord[][] => {
  const out: SpokenWord[][] = [];
  for (const s of takes) {
    let cur: SpokenWord[] = [];
    for (const [a, b, w] of s.words) {
      cur.push({ at: s.start + a - s.in, end: s.start + b - s.in, text: w });
      if (/[،,]$/.test(w)) { out.push(cur); cur = []; }
    }
    if (cur.length) out.push(cur);
  }
  return out;
};

/** Captions that follow the voice word by word (first made for the g80 film, approved 2026-10-09): one phrase on screen,
 *  each word rises in on the frame it is said, words not said yet are invisible but keep their place (the line never
 *  reflows), lines balanced, the phrase leaves just before the next one or a breath after its last word.
 *  Sits above the platform UI: `bottom` is measured from the bottom edge (9:16 feeds cover about 360 px). */
export const WordCaptions: React.FC<{ t: number; phrases: SpokenWord[][]; bottom: number; side: number; font?: string; size?: number; weight?: number; color?: string; shadow?: string; dir?: 'rtl' | 'ltr' }> = ({
  t, phrases, bottom, side, font = 'Alexandria, sans-serif', size = 58, weight = 700, color = '#FFF8EC', shadow = '0 3px 14px rgba(0,0,0,.55), 0 1px 2px rgba(0,0,0,.6)', dir = 'rtl' }) => {
  const i = phrases.findIndex((p, n) => t >= p[0].at - 0.12 && t < Math.min(p[p.length - 1].end + 0.45, (phrases[n + 1]?.[0].at ?? 1e9) - 0.12));
  if (i < 0) return null;
  const p = phrases[i];
  const next = phrases[i + 1]?.[0].at ?? 1e9;
  const outK = ramp(t, Math.min(p[p.length - 1].end + 0.3, next - 0.27), Math.min(p[p.length - 1].end + 0.45, next - 0.12));
  return (
    <div style={{ position: 'absolute', left: side, right: side, bottom, display: 'flex', justifyContent: 'center', direction: dir, opacity: 1 - outK }}>
      <div data-qa="caption" style={{ fontFamily: font, fontWeight: weight, fontSize: size, lineHeight: 1.45, textAlign: 'center', color, textWrap: 'balance', textShadow: shadow }}>
        {p.map((w, j) => {
          const k = ramp(t, w.at - 0.08, w.at + 0.14, Easing.out(Easing.cubic));
          return <span key={j} style={{ display: 'inline-block', margin: '0 0.13em', opacity: k, transform: `translateY(${(1 - k) * 12}px)` }}>{dir === 'rtl' ? w.text.replace(/[،,]$/, '') : w.text}</span>;
        })}
      </div>
    </div>
  );
};
