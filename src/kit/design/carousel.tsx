import React from 'react';
import { AbsoluteFill, Easing, Freeze, interpolate, Sequence, useCurrentFrame, useVideoConfig } from 'remotion';
import { Design } from './index';
import type { DesignSpec } from './spec';
import { FORMATS } from './spec';

/** A carousel played as one clip: the slides sit side by side like the swipe, the camera glides from one to the next
 *  and each slide builds itself when it arrives. The line that runs across the slides (LinePath) stays continuous,
 *  because the slides are really next to each other. */
export const HOLD = 2.6, PAN = 0.7;   // seconds on a slide, seconds of glide
export const carouselFrames = (n: number, fps = 30) => Math.round((n * HOLD + (n - 1) * PAN) * fps);

export const Carousel: React.FC<{ slides: DesignSpec[] }> = ({ slides }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { W, H } = FORMATS[slides[0].format];
  const t = frame / fps;
  let x = 0;
  slides.forEach((_, i) => {
    if (i === 0) return;
    const a = i * HOLD + (i - 1) * PAN;
    x += interpolate(t, [a, a + PAN], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.65, 0, 0.35, 1) });
  });
  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: '#000' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: W * slides.length, height: H, transform: `translateX(${-x * W}px)` }}>
        {slides.map((s, i) => {
          // a slide's clock starts 0.4 s before the glide toward it: its first block is timed by its height on the slide
          // (BEGIN + y share of SPAN), so words low on the slide still land right as the glide ends, not a second later
          const start = Math.max(0, Math.round((i === 0 ? 0 : i * HOLD + (i - 1) * PAN - 0.4) * fps));
          const body = <Design spec={s} motion />;
          return (
            <div key={i} style={{ position: 'absolute', left: i * W, top: 0, width: W, height: H, overflow: 'hidden' }}>
              {frame < start ? <Freeze frame={0}>{body}</Freeze> : <Sequence from={start} layout="none">{body}</Sequence>}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
