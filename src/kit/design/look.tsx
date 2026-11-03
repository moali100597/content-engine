import React from 'react';
import { continueRender, delayRender, staticFile } from 'remotion';
import type { Grade } from '../fx';
import { COMMON, GRADE } from '../fx/shaders';
import type { Palette } from './worlds';

/** Photo looks for designs run through the engine's GPU grade (kit/fx: the Lumetri-style GRADE shader). Every photo
 *  in a piece passes through one grade, so photos from different sources (a render, a phone shot, a generated image)
 *  read as one shoot in the brand's colours. A brand states its grade; a piece may override parts of it. */
export type LookSpec = Grade | 'none';
export const LookContext = React.createContext<Grade | undefined>(undefined);

const hex = (c?: string) => {
  if (!c) return [0.5, 0.5, 0.5];
  const n = parseInt(c.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
/** A colour wheel push toward a colour (for shTint / midTint / hiTint): its chroma, scaled. */
export const toward = (c: string, amount: number): [number, number, number] => {
  const v = hex(c), l = 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  return v.map((x) => +((x - l) * amount).toFixed(3)) as [number, number, number];
};
/** A grade that ties photos to a palette: shadows toward the ground, highlights toward the light colour. */
export const gradeFromPalette = (p: Palette, strength = 0.3): Grade => ({
  contrast: 0.08, vib: 0.1, shTint: toward(p.ground, strength), hiTint: toward(p.accent2 ?? p.paper ?? '#fff3dc', strength * 0.4),
  vig: 0.15, vigStart: 0.55, vigFeather: 0.7, grain: 0.025,
});

/** A photo drawn through the grade, filling its box like object-fit: cover, centred on `focus` (in %). It runs the same
 *  GRADE shader as kit/fx, but draws once, synchronously, on its own small WebGL canvas and only then releases the frame:
 *  a still with several graded photos (three capsules, a grid) must never be captured before every one has drawn. */
const VERT = `attribute vec2 p; varying vec2 vUv; void main(){ vUv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;
export const GradedImage: React.FC<{ src: string; w: number; h: number; focus?: [number, number]; look: Grade }> = ({ src, w, h, focus = [50, 50], look }) => {
  const ref = React.useRef<HTMLCanvasElement>(null);
  const [handle] = React.useState(() => delayRender(`grade ${src}`));
  const W = Math.max(1, Math.round(w)), H = Math.max(1, Math.round(h));
  React.useEffect(() => {
    let done = false;
    const finish = () => { if (!done) { done = true; continueRender(handle); } };
    const im = new Image();
    im.onload = () => {
      const cv = ref.current, gl = cv?.getContext('webgl', { preserveDrawingBuffer: true });
      if (!cv || !gl) return finish();
      const sh = (t: number, src2: string) => { const o = gl.createShader(t)!; gl.shaderSource(o, src2); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(o)); return o; };
      const pr = gl.createProgram()!;
      gl.attachShader(pr, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, COMMON + GRADE)); gl.linkProgram(pr); gl.useProgram(pr);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);   // as three.js loads textures, so the shader's uv maths holds
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
      const g = look, U = (n: string) => gl.getUniformLocation(pr, n);
      const f1 = (n: string, v: number) => gl.uniform1f(U(n), v), v3 = (n: string, v?: [number, number, number]) => gl.uniform3f(U(n), ...(v ?? [0, 0, 0]));
      gl.uniform2f(U('uSize'), W, H); f1('uTime', 0); gl.uniform1i(U('uTex'), 0);
      gl.uniform2f(U('uTexSize'), im.width, im.height); gl.uniform2f(U('uFocus'), focus[0] / 100, 1 - focus[1] / 100); f1('uZoom', g.zoom ?? 1);
      f1('uTemp', g.temp ?? 0); f1('uTint', g.tint ?? 0); f1('uExpo', g.expo ?? 1); f1('uContrast', g.contrast ?? 0);
      f1('uHi', g.hi ?? 0); f1('uSh', g.sh ?? 0); f1('uWh', g.wh ?? 0); f1('uBl', g.bl ?? 0); f1('uSat', g.sat ?? 1); f1('uVib', g.vib ?? 0); f1('uFaded', g.faded ?? 0);
      gl.uniform1i(U('uLook'), g.look ?? 0); f1('uLookAmt', g.lookAmt ?? 0);
      v3('uShTint', g.shTint); v3('uMidTint', g.midTint); v3('uHiTint', g.hiTint); v3('uCurve', g.curve);
      f1('uVig', g.vig ?? 0); f1('uVigStart', g.vigStart ?? 0.5); f1('uVigFeather', g.vigFeather ?? 0.6);
      f1('uGrain', g.grain ?? 0); f1('uGrainSize', g.grainSize ?? 1.2);
      f1('uDuo', g.duo ?? 0); v3('uDuoA', hex(g.duoA ?? '#000000') as [number, number, number]); v3('uDuoB', hex(g.duoB ?? '#ffffff') as [number, number, number]);
      gl.viewport(0, 0, W, H); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); gl.finish();
      finish();
    };
    im.onerror = finish;
    im.src = staticFile(src);
    return finish;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, W, H, JSON.stringify(look), focus[0], focus[1]]);
  return <canvas ref={ref} width={W} height={H} style={{ width: w, height: h, display: 'block' }} />;
};

/** The colours a photo is made of: k-means on a small copy, most common first. Runs in the page, no files. */
export const photoColors = (src: string, k = 5): Promise<{ hex: string; share: number; l: number; s: number }[]> => new Promise((res) => {
  const im = new Image();
  im.crossOrigin = 'anonymous';
  im.onload = () => {
    const S = 48, cv = document.createElement('canvas'); cv.width = S; cv.height = S;
    const c = cv.getContext('2d')!; c.drawImage(im, 0, 0, S, S);
    const d = c.getImageData(0, 0, S, S).data, px: number[][] = [];
    for (let i = 0; i < d.length; i += 4) px.push([d[i], d[i + 1], d[i + 2]]);
    let cent = Array.from({ length: k }, (_, i) => px[Math.floor((i + 0.5) * px.length / k)]);
    let lab: number[] = [];
    for (let it = 0; it < 12; it++) {
      lab = px.map((p) => { let b = 0, bd = Infinity; cent.forEach((q, j) => { const dd = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2; if (dd < bd) { bd = dd; b = j; } }); return b; });
      cent = cent.map((q, j) => { const m = px.filter((_, i) => lab[i] === j); return m.length ? [0, 1, 2].map((ch) => m.reduce((a, p) => a + p[ch], 0) / m.length) : q; });
    }
    const out = cent.map((q, j) => {
      const [r, g, b] = q.map((x) => x / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      return { hex: '#' + q.map((x) => Math.round(x).toString(16).padStart(2, '0')).join(''), share: lab.filter((x) => x === j).length / lab.length, l: (mx + mn) / 2, s: mx === mn ? 0 : (mx - mn) / (1 - Math.abs(mx + mn - 1)) };
    }).sort((a, b) => b.share - a.share);
    res(out);
  };
  im.onerror = () => res([]);
  im.src = staticFile(src);
});

type Swatch = { hex: string; share: number; l: number; s: number };
const toHsl = (h: string) => {
  const [r, g, b] = hex(h), mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  const hue = d === 0 ? 0 : mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [hue * 60, s, l];
};
const fromHsl = (h: number, s: number, l: number) => {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return '#' + [r, g, b].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('');
};
const lum = (h: string) => { const [r, g, b] = hex(h).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a: string, b: string) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

/** A readable palette made from a photo's own colours (for clients with no identity): the deepest colour of the photo as
 *  the ground, its most vivid colour as the accent, lifted until it reads on the ground; white ink. */
export const paletteFromPhoto = (sw: Swatch[]): Palette => {
  const byDark = [...sw].sort((a, b) => a.l - b.l), vivid = [...sw].sort((a, b) => b.s * (0.4 + b.share) - a.s * (0.4 + a.share))[0] ?? sw[0];
  const [gh, gs] = toHsl(byDark[0]?.hex ?? '#202020');
  const ground = fromHsl(gh, Math.min(gs, 0.45), 0.12), ground2 = fromHsl(gh, Math.min(gs, 0.45), 0.2);
  const [ah, as] = toHsl(vivid?.hex ?? '#e0b050');
  let l = 0.55, accent = fromHsl(ah, Math.max(as, 0.55), l);
  while (ratio(accent, ground) < 4.5 && l < 0.9) { l += 0.04; accent = fromHsl(ah, Math.max(as, 0.55), l); }
  return { ground, ground2, ink: '#ffffff', dim: fromHsl(gh, 0.12, 0.82), accent, accent2: fromHsl((ah + 30) % 360, Math.max(as, 0.5), 0.6), paper: '#fbf7f0', bar: accent, barInk: ground };
};

/** Which of a brand's own palettes suits this photo: the ground should stand apart from the photo's average tone (so the
 *  words have their own field), and the accent should sit near a colour the photo already has. */
export const pickPalette = (palettes: Record<string, Palette>, sw: Swatch[]): string => {
  const avgL = sw.reduce((a, x) => a + x.l * x.share, 0);
  const hues = sw.filter((x) => x.s > 0.2).map((x) => toHsl(x.hex)[0]);
  const near = (h: number) => hues.length ? Math.min(...hues.map((q) => Math.min(Math.abs(q - h), 360 - Math.abs(q - h)))) / 180 : 0.5;
  let best = Object.keys(palettes)[0], bs = -Infinity;
  for (const [k, p] of Object.entries(palettes)) {
    const sc = Math.abs(toHsl(p.ground)[2] - avgL) * 0.6 + (1 - near(toHsl(p.accent)[0])) * 0.4;
    if (sc > bs) { bs = sc; best = k; }
  }
  return best;
};
