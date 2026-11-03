import React from 'react';

/** Where things sit for one output size. Stages and agent keyframes are always authored in 16:9 pixels (1920 x 1080);
 *  a layout says how that stage is placed on the canvas and where the headline block, caption and agent badge go. */
export type Layout = {
  name: string; W: number; H: number;
  stage: { ox: number; oy: number; tx: number; ty: number; scale: number };          // stage box (1920 x 1080) transform: origin, shift, base scale
  copy: { box: React.CSSProperties; scale: number; wrap: boolean };                   // headline block frame; wrap = big and accent words share a row
  caption: { bottom: number; size: number };
  home?: { x: number; y: number; s: number };                                         // agent badge position, in canvas pixels, when it rests beside the copy
  iris?: [number, number];                                                            // fixed iris centre (canvas pixels); otherwise the scene's own point
  qa: { left: number; right: number; top: number; bottom: number };                   // box the headline text must stay inside
  safe: { top: number; bottom: number; side: number };                                // margins that text over footage must keep (platform UI covers the rest)
};

export const landscape: Layout = {
  name: '16x9', W: 1920, H: 1080,
  stage: { ox: 110, oy: 510, tx: 0, ty: 0, scale: 1.1 },
  copy: { box: { right: 110, top: 90, width: 790, height: 820 }, scale: 1, wrap: false },
  caption: { bottom: 42, size: 44 },
  qa: { left: 1016, right: 1814, top: 0, bottom: 970 },
  safe: { top: 70, bottom: 70, side: 100 },
};

export const portrait: Layout = {
  name: '9x16', W: 1080, H: 1920,
  stage: { ox: 560, oy: 470, tx: -20, ty: 100, scale: 0.92 },                           // stage occupies y 190..940
  copy: { box: { right: 64, top: 1050, width: 952, height: 410 }, scale: 0.8, wrap: true },      // shrinks itself when a state is taller
  caption: { bottom: 352, size: 46 },                                                    // above the platform UI zone
  home: { x: 540, y: 992, s: 104 },
  iris: [540, 760],
  qa: { left: 60, right: 1020, top: 1010, bottom: 1475 },   // the agent-covers-text check guards the badge row above
  safe: { top: 220, bottom: 360, side: 70 },
};

const Ctx = React.createContext<Layout>(landscape);
export const LayoutProvider = Ctx.Provider;
export const useLayout = () => React.useContext(Ctx);

/** Map a point authored on the 16:9 stage to the canvas. */
export const onStage = (L: Layout, x: number, y: number, s = 1): [number, number, number] =>
  [L.stage.ox + L.stage.tx + (x - L.stage.ox) * L.stage.scale, L.stage.oy + L.stage.ty + (y - L.stage.oy) * L.stage.scale, s * L.stage.scale];
