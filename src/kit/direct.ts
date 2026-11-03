import { Easing } from 'remotion';

// Directing helpers for format 3 (first used by video 2): keyed values over story seconds, colour blends, hops and blinks,
// and camera shots blended between named presets. Pure functions of time.

/** A value keyed at times: [[t, v], ...], eased between keys (cubic in-out by default); keys 0.001 s apart make a cut. */
export const key = (t: number, pts: number[][], ease: (n: number) => number = Easing.inOut(Easing.cubic)) => {
  if (t <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (t <= pts[i][0]) { const [a, va] = pts[i - 1], [b, vb] = pts[i]; return va + (vb - va) * ease((t - a) / (b - a)); }
  return pts[pts.length - 1][1];
};
const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
/** Blend two #rrggbb colours. */
export const mix = (a: string, b: string, k: number) => '#' + hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * k).toString(16).padStart(2, '0')).join('');
export const arc = (u: number) => (u <= 0 || u >= 1 ? 0 : Math.sin(u * Math.PI));
/** A hop that dies out: height h, starting at `at`. */
export const hop = (t: number, at: number, h = 0.24) => (t < at ? 0 : Math.abs(Math.sin((t - at) * 8)) * Math.exp(-(t - at) * 3) * h);
/** A blink every 3.7 s. */
export const blinks = (t: number) => { const d = Math.abs(((t + 0.75) % 3.7) - 1.85); return d < 0.09 ? 1 - d / 0.09 : 0; };


/** Camera presets are [distance, height, lookY]; `shots` keys them over time. Returns { z, y, lookY } at t. */
export type Shot3 = number[];
export const shotAt = (t: number, shots: [number, Shot3][]) => {
  const [z, y, lookY] = [0, 1, 2].map((i) => key(t, shots.map(([at, v]) => [at, v[i]])));
  return { z, y, lookY };
};
