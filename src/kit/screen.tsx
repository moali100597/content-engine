import React from 'react';
import { AbsoluteFill, Easing, Freeze, Img, OffthreadVideo, Sequence, staticFile, useVideoConfig } from 'remotion';
import { lerp, ramp } from './anim';

/** Real footage playing on a screen inside a take (a TV, a phone, a laptop, a billboard). First made for the TV in the
 *  g80 film (approved 2026-10-09). The screen is measured on the take once with tools/screen.py, which writes:
 *    mask   the screen's own matte, full frame (rounded CRT corners, a phone's notch stay as they are)
 *    rim    the bezel recoloured: a blank screen in a generated take lights its frame (blue, green); once real footage
 *           plays there the frame should take the room's tone
 *    matrix a CSS matrix3d that warps a `box.w` x `box.h` window onto the screen's four corners (perspective included)
 *  Place it inside the shot's layer so it moves, grades and transitions with the shot. */
export type Screen = {
  src: string;                                   // footage under public/
  size: [number, number];                        // the footage's own width and height
  box: { w: number; h: number; x: number };      // the window of the footage shown: w x h, starting x px from its left edge
  matrix: string;                                // from tools/screen.py, for this box
  mask: string;                                  // full-frame matte png under public/
  rim?: { src: string; x: number; y: number; w: number; h: number };
  length: number;                                // seconds of footage; it holds its last frame after that
  frame: [number, number];                       // the take's frame size (the mask is drawn at this size)
  crt?: boolean;                                 // scan lines, dark edge, curved-glass light; off for a modern flat screen
};

/** `local`: seconds since the shot began; `start`: the shot's start on the film clock; `on`: when the screen switches on. */
export const ScreenInsert: React.FC<{ s: Screen; local: number; start: number; on?: number }> = ({ s, local, start, on: at = 0 }) => {
  const { fps } = useVideoConfig();
  if (local < at) return null;
  const on = local - at;
  const open = ramp(on, 0, 0.16, Easing.out(Easing.cubic));                 // the picture opens from a bright line
  const flash = 1 - ramp(on, 0.05, 0.5);
  const hold = Math.round((s.length - 0.08) * fps);
  const vid = <OffthreadVideo src={staticFile(s.src)} muted style={{ width: s.size[0], height: s.size[1], display: 'block' }} />;
  const crt = s.crt ?? true;
  return (
    <>
      {s.rim && <Img src={staticFile(s.rim.src)} style={{ position: 'absolute', left: s.rim.x, top: s.rim.y, width: s.rim.w, height: s.rim.h, opacity: open }} />}
      <AbsoluteFill style={{ WebkitMaskImage: `url(${staticFile(s.mask)})`, maskImage: `url(${staticFile(s.mask)})`, WebkitMaskSize: `${s.frame[0]}px ${s.frame[1]}px`, maskSize: `${s.frame[0]}px ${s.frame[1]}px` }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: s.box.w, height: s.box.h, transformOrigin: '0 0', transform: s.matrix, overflow: 'hidden', background: '#0d1418' }}>
          <div style={{ position: 'absolute', left: -s.box.x, top: 0, transformOrigin: `${s.box.x + s.box.w / 2}px 50%`, transform: `scaleY(${lerp(0.015, 1, open)})`,
            filter: `brightness(${1.12 + flash * 1.6}) contrast(1.06) saturate(1.12) blur(0.5px)` }}>
            <Sequence from={Math.round((start + at) * fps)} layout="none">
              {on < s.length - 0.08 ? vid : <Freeze frame={hold}>{vid}</Freeze>}
            </Sequence>
          </div>
          {crt && <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(0deg, rgba(0,0,0,.2) 0 1px, transparent 1px 3px)' }} />}
          {crt && <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 75% 75% at 50% 50%, transparent 58%, rgba(0,10,20,.55) 100%)' }} />}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(125deg, rgba(255,255,255,.16) 0%, rgba(255,255,255,.04) 28%, transparent 45%)' }} />
        </div>
      </AbsoluteFill>
    </>
  );
};
