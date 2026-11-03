import React from 'react';
import { AbsoluteFill, Easing } from 'remotion';
import '@fontsource/alexandria/400.css';
import '@fontsource/alexandria/800.css';
import { ramp } from '../../kit/anim';
import { portrait } from '../../kit/layout';
import { Reel, reelFrames, ReelSpec, Shot } from '../../kit/reel';

/** Hello reel: the shape of a format 2 film (kit/reel.tsx) with no media at all, so it renders on a fresh clone.
 *  Every shot here is a layer drawn in code. To cut real footage, put clips in public/hello-reel/ and write shots like
 *    { src: 'hello-reel/clip.mp4', from: 1.2, dur: 2.4, tr: 'whip', move: 'in', grade: 'film' }
 *  (trim, speed, crop focus, slow move, colour grade, the way the shot arrives, text on top, sound). */
export const FPS = 30;
export const W = portrait.W, H = portrait.H;
const ease = Easing.out(Easing.cubic);

const Card = (ground: [string, string], line: string, sub: string): React.FC<{ t: number }> => ({ t }) => {
  const a = ramp(t, 0.1, 0.7, ease), b = ramp(t, 0.45, 1.05, ease);
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse 90% 70% at 50% 40%, ${ground[0]} 0%, ${ground[1]} 100%)`, justifyContent: 'center', alignItems: 'center', direction: 'rtl' }}>
      <div style={{ fontFamily: 'Alexandria, sans-serif', fontWeight: 800, fontSize: 120, color: '#fff', opacity: a, transform: `translateY(${(1 - a) * 40}px)`, textAlign: 'center', lineHeight: 1.2 }}>{line}</div>
      <div style={{ marginTop: 28, fontFamily: 'Alexandria, sans-serif', fontWeight: 400, fontSize: 48, color: 'rgba(255,255,255,.75)', opacity: b }}>{sub}</div>
    </AbsoluteFill>
  );
};
const layer = (over: React.FC<{ t: number }>, x: Partial<Shot>): Shot => ({ dur: 2.2, dark: true, move: 'none', over, ...x });

export const reel: ReelSpec = {
  shots: [
    layer(Card(['#3b2a1a', '#120c07'], 'لقطة', 'كل لقطة لها مدة وطريقة دخول'), { tr: 'fade' }),
    layer(Card(['#123a4a', '#06141a'], 'قطع', 'whip · flash · zoom · blur · light · burn'), { tr: 'whip' }),
    layer(Card(['#4a1d1d', '#170707'], 'لون', 'grades: film · teal · gold · mono'), { tr: 'flash', grade: 'film' }),
    layer(Card(['#1d2b4a', '#070b17'], 'جاهز', 'حط الفوتيج بتاعك في public/'), { tr: 'zoom', dur: 2.6 }),
  ],
  vignette: 0.25,
  grain: 0.04,
};
export const frames = reelFrames(reel, FPS);
export const Film: React.FC = () => <Reel reel={reel} layout={portrait} />;
