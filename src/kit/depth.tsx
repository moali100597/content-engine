import React from 'react';
import { continueRender, delayRender, staticFile } from 'remotion';

/** A camera moving inside a still: the picture is displaced by its depth map (tools/depth.py), so near things slide
 *  further than far ones and the still reads as a filmed shot. Used for still subjects instead of a generated clip
 *  (README.md, "Depth stills"). Keep moves small (|x|, |y| up to ~0.04, dolly up to ~0.12): bigger ones tear at object edges.
 *  p goes 0..1 over the shot. Every value is [at p=0, at p=1]. */
export type Cam = {
  x?: [number, number];        // sideways slide of the camera, fraction of the width (near layers move this much more than far)
  y?: [number, number];        // up/down
  zoom?: [number, number];     // plain zoom of the whole frame (1 = cover)
  dolly?: [number, number];    // depth-aware push: near things grow more than far ones (0.1 = a push of about 10% on the nearest plane)
  focal?: number;              // depth that stays put (0 far .. 1 near), default 0.35
  blur?: number;               // depth of field: largest blur in picture px for things far from the focus depth (0 = all sharp)
  fd?: [number, number];       // focus depth (0 far .. 1 near), moving over the shot: a rack focus
};

const VERT = 'attribute vec2 p; varying vec2 vUv; void main(){ vUv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }';
const FRAG = `precision highp float;
varying vec2 vUv;
uniform sampler2D uTex, uDepth;
uniform vec2 uScale, uOff, uFocus;   // cover fit: uv in the picture = uFocus + (vUv - 0.5) * uScale
uniform vec2 uShift, uPx; uniform float uZoom, uDolly, uFocal, uBlur, uFD;
float d(vec2 s){ return texture2D(uDepth, s).r; }
void main(){
  vec2 c = vec2(0.5);
  vec2 base = uFocus + (vUv - c) * uScale / uZoom;
  vec2 s = base;
  for (int i = 0; i < 5; i++) {                       // find the source point that lands here after the move
    float k = d(s) - uFocal;
    s = base - uShift * k;
    s = uFocus + (s - uFocus) / (1.0 + uDolly * k);
  }
  s = clamp(s, vec2(0.001), vec2(0.999));
  float coc = uBlur * clamp(abs(d(s) - uFD) * 2.2, 0.0, 1.0);
  if (coc < 0.3) { gl_FragColor = vec4(texture2D(uTex, s).rgb, 1.0); return; }
  vec3 acc = vec3(0.0); float wsum = 0.0;
  for (int i = 0; i < 24; i++) {                      // a golden-angle disc: a soft round lens blur
    float r = sqrt((float(i) + 0.5) / 24.0), a = float(i) * 2.39996;
    vec2 o = vec2(cos(a), sin(a)) * r * coc * uPx;
    vec2 q = clamp(s + o, vec2(0.001), vec2(0.999));
    float w = 1.0 + 1.5 * step(abs(d(q) - uFD) * 2.2 * uBlur, coc + 0.5);   // keep sharp foreground from bleeding in
    acc += texture2D(uTex, q).rgb * w; wsum += w;
  }
  gl_FragColor = vec4(acc / wsum, 1.0);
}`;

const lerp = (a: [number, number] | undefined, p: number, dflt: number) => (a ? a[0] + (a[1] - a[0]) * p : dflt);
const ease = (p: number) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2) * 0.35 + p * 0.65;   // mostly linear, soft ends: a camera operator's move

type GLState = { gl: WebGLRenderingContext; pr: WebGLProgram; iw: number; ih: number };

export const DepthStill: React.FC<{ src: string; depth?: string; p: number; cam: Cam; w: number; h: number; focus?: [number, number]; style?: React.CSSProperties }> = ({ src, depth, p, cam, w, h, focus = [50, 50], style }) => {
  const ref = React.useRef<HTMLCanvasElement>(null);
  const st = React.useRef<GLState | null>(null);
  const [ready, setReady] = React.useState(false);
  const [loadHandle] = React.useState(() => delayRender(`depth ${src}`));
  const W = Math.round(w), H = Math.round(h);
  const dsrc = depth ?? src.replace(/\.(png|jpe?g|webp)$/i, '.depth.png');

  React.useEffect(() => {
    const load = (u: string) => new Promise<HTMLImageElement>((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = staticFile(u); });
    Promise.all([load(src), load(dsrc)]).then(([im, dm]) => {
      const cv = ref.current, gl = cv?.getContext('webgl', { preserveDrawingBuffer: true });
      if (!cv || !gl) { continueRender(loadHandle); return; }
      const sh = (t: number, s: string) => { const o = gl.createShader(t)!; gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(o)); return o; };
      const pr = gl.createProgram()!;
      gl.attachShader(pr, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(pr); gl.useProgram(pr);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      [im, dm].forEach((img, unit) => {
        gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      });
      gl.uniform1i(gl.getUniformLocation(pr, 'uTex'), 0); gl.uniform1i(gl.getUniformLocation(pr, 'uDepth'), 1);
      st.current = { gl, pr, iw: im.width, ih: im.height };
      setReady(true);
      continueRender(loadHandle);
    }).catch(() => continueRender(loadHandle));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, dsrc]);

  // one draw per frame; the frame is held until it is drawn
  React.useLayoutEffect(() => {
    const s = st.current;
    if (!ready || !s) return;
    const handle = delayRender('depth frame');
    const { gl, pr, iw, ih } = s, U = (n: string) => gl.getUniformLocation(pr, n), q = ease(Math.min(1, Math.max(0, p)));
    const cover = Math.max(W / iw, H / ih);                       // picture px per canvas px
    const sx = W / (iw * cover), sy = H / (ih * cover);           // fraction of the picture the canvas shows
    const fx = focus[0] / 100, fy = 1 - focus[1] / 100;
    const cx = Math.min(1 - sx / 2, Math.max(sx / 2, fx)), cy = Math.min(1 - sy / 2, Math.max(sy / 2, fy));
    gl.viewport(0, 0, W, H);
    gl.uniform2f(U('uScale'), sx, sy); gl.uniform2f(U('uFocus'), cx, cy);
    gl.uniform2f(U('uShift'), lerp(cam.x, q, 0) * sx, -lerp(cam.y, q, 0) * sy);
    gl.uniform1f(U('uZoom'), lerp(cam.zoom, q, 1.04)); gl.uniform1f(U('uDolly'), lerp(cam.dolly, q, 0)); gl.uniform1f(U('uFocal'), cam.focal ?? 0.35);
    gl.uniform1f(U('uBlur'), cam.blur ?? 0); gl.uniform1f(U('uFD'), lerp(cam.fd, Math.min(1, Math.max(0, p)), 0.5)); gl.uniform2f(U('uPx'), 1 / iw, 1 / ih);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); gl.finish();
    continueRender(handle);
  }, [ready, p, W, H, JSON.stringify(cam), focus[0], focus[1]]);

  return <canvas ref={ref} width={W} height={H} style={{ width: w, height: h, display: 'block', ...style }} />;
};
