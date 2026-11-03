import React from 'react';
import { AbsoluteFill, Easing } from 'remotion';
import { Copy, CopyState, ramp } from './anim';
import { useLayout } from './layout';
import { useBrand } from './brand';

export type Tr = 'none' | 'whip' | 'iris';
/** One beat of the film: starts at `a` (story seconds), enters with `tr`; iris opens from `at`. */
export type Scene = { a: number; accent: string; tr: Tr; at?: [number, number]; dark?: boolean; Stage: React.FC<{ t: number; accent: string }>; copy: CopyState[] };

/** Camera shake envelope: a short decaying kick 0.1 s after each impact time. */
export const makeShake = (impacts: number[]) => (t: number) => impacts.reduce((a, c) => (t >= c + 0.1 && t < c + 0.55 ? a + Math.exp(-(t - c - 0.1) * 11) : a), 0);

const WHIP = 0.12;
const xIn = (t: number, a: number, W: number) => -(1 - ramp(t, a - WHIP, a + 0.22, Easing.out(Easing.cubic))) * W;
const xOut = (t: number, b: number, W: number) => ramp(t, b - WHIP, b + 0.1, Easing.in(Easing.cubic)) * W;

export const SceneView: React.FC<{ s: Scene; next?: Scene; t: number; i: number; end: number }> = ({ s, next, t, i, end }) => {
  const L = useLayout();
  const B = useBrand();
  const b = next?.a ?? end;
  const lead = s.tr === 'none' ? 0 : s.tr === 'whip' ? WHIP : 0.1;
  const tail = !next ? 0 : next.tr === 'none' ? 0 : 0.3;
  if (t < s.a - lead || t >= b + tail) return null;
  const pos = (tt: number) => (s.tr === 'whip' ? xIn(tt, s.a, L.W) : 0) + (next?.tr === 'whip' ? xOut(tt, b, L.W) : 0);
  const x = pos(t);
  const blur = Math.min(60, Math.abs(x - pos(t - 1 / 30)) * 0.28);
  const pre = next?.tr === 'whip' ? Math.sin(ramp(t, b - 0.3, b - WHIP, Easing.inOut(Easing.quad)) * Math.PI * 0.5) : 0;
  const clip = s.tr === 'iris' && t < s.a + 0.4 ? `circle(${ramp(t, s.a - 0.1, s.a + 0.28, Easing.in(Easing.quad)) * 2300}px at ${(L.iris ?? s.at!)[0]}px ${(L.iris ?? s.at!)[1]}px)` : undefined;
  return (
    <AbsoluteFill style={{ background: s.dark ? B.dark.bg : s.tr === 'iris' ? B.paper : undefined, clipPath: clip, transform: `translateX(${x}px) scale(${1 - pre * 0.05}) rotate(${pre * 1.2}deg)`, filter: blur > 0.5 ? `url(#whip${i})` : undefined }}>
      {blur > 0.5 && <svg width="0" height="0" style={{ position: 'absolute' }}><filter id={`whip${i}`} x="-20%" width="140%"><feGaussianBlur stdDeviation={`${blur} 0`} /></filter></svg>}
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transformOrigin: `${L.stage.ox}px ${L.stage.oy}px`, transform: `translate(${L.stage.tx}px, ${L.stage.ty}px) scale(${L.stage.scale + 0.03 * ramp(t, s.a, b, (n) => n)})` }}><s.Stage t={t} accent={s.accent} /></div>
      <Copy t={t} states={s.copy} accent={s.accent} fg={s.dark ? B.dark.fg : B.ink} dim={s.dark ? B.dark.dim : B.grey} end={b} />
    </AbsoluteFill>
  );
};
