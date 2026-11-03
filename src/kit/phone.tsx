import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';

/** Our own UI on a phone screen inside a generated take (video 3, 2026-10-10). The take is generated with the screen
 *  plain white; tools/phone_track.py measures it frame by frame and writes:
 *    <take>.track.json  the screen's four corners on every frame (smoothed, drawn a little larger than the glass)
 *    <take>.occ.webm    everything over the screen (thumb, notch, bezel) with alpha
 *  The stack is: the take, then the UI warped onto the corners of the current frame, then the occluders, so the
 *  thumb stays in front of the UI and the UI shows only on the glass. Place it inside the shot's layer so it moves,
 *  grades and transitions with the shot. */
export type PhoneTrack = { fps: number; size: [number, number]; corners: number[][][]; widen?: number };

/** CSS matrix3d that maps a w x h box onto four corners [TL, TR, BR, BL] (a projective warp). */
export const quadMatrix = (w: number, h: number, q: number[][]) => {
  const src = [[0, 0], [w, 0], [w, h], [0, h]];
  const A: number[][] = [], B: number[] = [];
  src.forEach(([x, y], i) => {
    const [u, v] = q[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); B.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); B.push(v);
  });
  // Gaussian elimination
  const n = 8, M = A.map((r, i) => [...r, B[i]]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  const [a, b, c, d, e, f, g, hh] = M.map((r, i) => r[n] / r[i]);
  // homography [[a b c][d e f][g hh 1]] as a column-major matrix3d
  return `matrix3d(${a},${d},0,${g},${b},${e},0,${hh},0,0,1,0,${c},${f},0,1)`;
};

/** `t`: film seconds; `start`: the film second at which this use of the take begins; `from`: the take's second shown
 *  then; `rate`: playback speed. `box`: the UI's own size in px (the screen's proportions); the UI is drawn at that size
 *  and warped onto the glass. */
export const PhoneScreen: React.FC<{ take: string; track: PhoneTrack; occ: string; t: number; start: number; from?: number; rate?: number; box: [number, number];
  showTake?: boolean; occUntil?: number; children: React.ReactNode }> = ({ take, track, occ, t, start, from: takeFrom = 0, rate = 1, box, showTake = true, occUntil, children }) => {
  // One source position drives everything: the take, its hand matte and the screen's corners. A slowed take shows
  // on one source frame at a time; the screen's corners belong to that same frame, so the UI stays glued to the glass.
  const local = takeFrom + Math.max(0, t - start) * rate;
  const pos = Math.max(0, Math.min(track.corners.length - 1, local * track.fps));
  const i0 = Math.floor(pos + 1e-6), i1 = Math.min(track.corners.length - 1, i0 + 1), a = 0;   // each source frame is held whole (blending two frames left a ghost of the moving hand)
  // the corners are used exactly as tracked for this frame: any temporal smoothing makes the screen lag a moving phone
  const c0 = track.corners[i0], c1 = track.corners[i1];
  const corners = c0.map((p, n) => [p[0] + (c1[n][0] - p[0]) * a, p[1] + (c1[n][1] - p[1]) * a]) as typeof c0;
  const m = quadMatrix(box[0], box[1], corners);
  // integration with the plate (as a compositor would): the generated take is soft, so the UI gets the same softness
  // (about 0.8 px on the plate) plus motion blur when the phone moves between source frames; and a warm daylight sheen
  const gw = Math.hypot(corners[1][0] - corners[0][0], corners[1][1] - corners[0][1]) / (1 + 2 * (track.widen ?? 0));
  const k = box[0] / Math.max(1, gw);                              // UI px per plate px
  const pv = track.corners[Math.max(0, i0 - 1)];
  const mv0 = Math.max(...corners.map((p, n) => Math.hypot(p[0] - pv[n][0], p[1] - pv[n][1])));   // plate px per source frame
  const mv = mv0 > 40 ? 0 : mv0;   // a cut inside the generated take is not motion
  const soft = Math.min(1.6, 0.35 + 0.08 * mv) * Math.min(1, k / 2.5);   // measured on renders: CSS blur here reads close to plate px
  // the take and its hand matte are read as numbered stills (public/v3/takes/frames/<take>/t###.jpg, o###.webp): seeking
  // a VP9 alpha video frame by frame returned broken mattes on some frames
  const dir = take.replace(/^.*\//, '').replace(/\.mp4$/, '');
  const n3 = (i: number) => String(i).padStart(3, '0');
  const img = (kind: 't' | 'o', i: number, o = 1) => (
    <Img src={staticFile(`v3/takes/frames/${dir}/${kind}${n3(i)}.${kind === 't' ? 'jpg' : 'webp'}`)} style={{ position: 'absolute', left: 0, top: 0, width: track.size[0], height: track.size[1], opacity: o }} />
  );
  return (
    <AbsoluteFill style={{ width: track.size[0], height: track.size[1] }}>
      {showTake && img('t', i0)}
      {showTake && a > 0.02 && img('t', i1, a)}
      <div style={{ position: 'absolute', left: 0, top: 0, width: box[0], height: box[1], transformOrigin: '0 0', transform: m, overflow: 'hidden', background: '#07080C',
        // the quad's corners follow the phone's rounded corners, so the widened box never pokes past the bezel onto the table
        borderRadius: `${box[0] * 0.15}px / ${box[0] * 0.12}px` }}>
       {/* the track's quad is wider than the glass (track.widen per side, so no white of the blank take survives at the
           long sides); the UI is narrowed by the same amount, so it lands exactly on the glass */}
       <div style={{ position: 'absolute', inset: 0, transform: `scaleX(${1 / (1 + 2 * (track.widen ?? 0))})`, transformOrigin: '50% 50%', filter: `blur(${soft.toFixed(2)}px) contrast(.94) brightness(1.04)` }}>
        {children}
        {/* the phone's own notch, drawn clean (the plate's notch is handed to the UI: see tools/phone_occ.py) */}
        <div style={{ position: 'absolute', left: '31.5%', width: '37%', top: -box[0] * 0.01, height: box[0] * 0.085, background: '#050608', borderRadius: `0 0 ${box[0] * 0.05}px ${box[0] * 0.05}px`, pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', left: '30%', width: '40%', top: '42%', height: box[0] * 0.014, borderRadius: 99, background: '#15171D' }} />
          <div style={{ position: 'absolute', left: '74%', width: box[0] * 0.022, top: '38%', height: box[0] * 0.022, borderRadius: 99, background: '#0D1424', boxShadow: 'inset 0 0 2px rgba(80,110,200,.6)' }} />
        </div>
        {/* the display's own black border and rounded corners, a soft inner shadow where the glass meets the bezel, so the
            UI's edge never shows as a cut line */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: box[0] * 0.11, boxShadow: `0 0 0 ${box[0] * 0.2}px #07080C, inset 0 0 ${box[0] * 0.035}px ${box[0] * 0.012}px rgba(4,5,8,.85)` }} />
        {/* the glass over the display: a soft sky reflection and a slight lift of the blacks, so the UI sits under glass */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(118deg, rgba(255,250,240,.16) 0%, rgba(255,250,240,.05) 34%, rgba(255,255,255,0) 52%, rgba(255,244,225,.07) 100%)', mixBlendMode: 'screen' }} />
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'rgba(255,214,170,.06)', mixBlendMode: 'screen' }} />
       </div>
      </div>
      {(occUntil === undefined || t < occUntil) && img('o', a > 0.5 ? i1 : i0)}
    </AbsoluteFill>
  );
};
