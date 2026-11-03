import React from 'react';
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

/** Motion for designs (docs/design-system.md 12): the same still, built up in reading order.
 *  Nothing is keyed by hand: a block starts when the eye would reach it (its top edge, top to bottom),
 *  lines of a headline follow one another, bars wipe in from the reading side, stickers land last. */
type M = { on: boolean; t: number; fps: number; start: number; H: number };
const Ctx = React.createContext<M>({ on: false, t: 0, fps: 30, start: 0, H: 1 });
export const useMotion = () => React.useContext(Ctx);

const C = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const out = Easing.bezier(0.16, 1, 0.3, 1);   // fast out, long settle: the house curve
export const BEGIN = 0.25;                    // first block, seconds
export const SPAN = 1.1;                       // seconds from the top block to the bottom one

export const MotionRoot: React.FC<{ on: boolean; H: number; children: React.ReactNode }> = ({ on, H, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return <Ctx.Provider value={{ on, t: frame / fps, fps, start: 0, H }}>{children}</Ctx.Provider>;
};

/** Seconds at which a block whose top edge is at y starts. */
export const startAt = (y: number, H: number) => BEGIN + Math.max(0, Math.min(1, y / H)) * SPAN;
export const ramp = (t: number, a: number, d: number) => interpolate(t, [a, a + d], [0, 1], { ...C, easing: out });

/** A block rises into place when the reading order reaches it; its children know when it started. */
export const Enter: React.FC<{ y: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ y, children, style }) => {
  const m = useMotion();
  if (!m.on) return <>{children}</>;
  const start = startAt(y, m.H);
  const k = ramp(m.t, start, 0.6);
  return (
    <Ctx.Provider value={{ ...m, start }}>
      <div style={{ opacity: Math.min(1, k * 1.6), transform: `translateY(${(1 - k) * 28}px)`, ...style }}>{children}</div>
    </Ctx.Provider>
  );
};

/** One line of a headline rises out of its own baseline: the line box clips, the words slide up inside it. */
export const lineReveal = (m: M, i: number): { outer: React.CSSProperties; inner: React.CSSProperties } => {
  if (!m.on) return { outer: {}, inner: {} };
  const k = ramp(m.t, m.start + 0.08 + i * 0.13, 0.6);
  return { outer: k < 1 ? { clipPath: 'inset(-40% -10% -30% -10%)' } : {}, inner: { transform: `translateY(${(1 - k) * 175}%)` } };   // the mask sits under the descenders (no dot pops in at the end); 175% puts marks above the box (hamza, tanween) out of sight too
};

/** A highlight bar wipes in from the reading side, then its words fade up. */
export const barReveal = (m: M, i: number, rtl: boolean): { bar: React.CSSProperties; words: React.CSSProperties } => {
  if (!m.on) return { bar: {}, words: {} };
  const a = m.start + 0.05 + i * 0.12;
  const k = ramp(m.t, a, 0.45), w = ramp(m.t, a + 0.18, 0.4);
  return { bar: { clipPath: rtl ? `inset(0 0 0 ${(1 - k) * 100}%)` : `inset(0 ${(1 - k) * 100}% 0 0)` }, words: { opacity: w, transform: `translateY(${(1 - w) * 0.2}em)`, display: 'inline-block' } };
};

/** A sticker lands with a small overshoot after the words around it. */
export const stickerLand = (m: M, y: number): React.CSSProperties => {
  if (!m.on) return {};
  const s = spring({ frame: (m.t - startAt(y, m.H) - 0.45) * m.fps, fps: m.fps, config: { damping: 11, stiffness: 170 } });
  return { transform: `scale(${s})`, opacity: s > 0.02 ? 1 : 0 };
};

/** The full-frame picture settles from slightly closer: the camera has just arrived. */
export const settle = (m: M, depth = 0): React.CSSProperties => {
  if (!m.on) return {};
  const k = ramp(m.t, 0, 4.5), from = 1.08 + depth * 0.06;   // a nearer layer travels further: parallax
  return { transform: `scale(${from - (from - 1) * k})`, transformOrigin: '50% 45%' };
};

/** Frame furniture and texture: a quiet fade at the start. */
export const fadeIn = (m: M, at = 0.1, d = 0.5): React.CSSProperties => (m.on ? { opacity: ramp(m.t, at, d) } : {});

export const Settle: React.FC<{ children: React.ReactNode }> = ({ children }) => <AbsoluteFill style={settle(useMotion())}>{children}</AbsoluteFill>;

/** Wraps furniture (frame, texture) in the start fade. */
export const Fade: React.FC<{ at?: number; children: React.ReactNode }> = ({ at, children }) => <AbsoluteFill style={fadeIn(useMotion(), at)}>{children}</AbsoluteFill>;

/** Children of one column, one after another (kicker, title, sub, blocks, stats): each starts 0.14 s after the last.
 *  A child that pushes itself down with marginTop: auto keeps doing so through its wrapper. */
export const Seq: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const m = useMotion();
  if (!m.on) return <>{children}</>;
  let i = 0;
  return (
    <>
      {React.Children.map(children, (ch) => {
        if (!React.isValidElement(ch)) return ch;
        const st = (ch.props as { style?: React.CSSProperties }).style;
        const start = m.start + i++ * 0.14;
        const k = ramp(m.t, start, 0.6);
        return (
          <Ctx.Provider value={{ ...m, start }}>
            <div style={{ marginTop: st?.marginTop === 'auto' ? 'auto' : undefined, flexShrink: 0, opacity: Math.min(1, k * 1.6), transform: `translateY(${(1 - k) * 22}px)` }}>{ch}</div>
          </Ctx.Provider>
        );
      })}
    </>
  );
};
