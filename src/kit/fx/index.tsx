import { ThreeCanvas, useOffthreadVideoTexture } from '@remotion/three';
import React from 'react';
import { continueRender, delayRender, useCurrentFrame, useVideoConfig } from 'remotion';
import * as THREE from 'three';
import { COMMON, DISPLACE, GLOW, GRADE, RAYS, TRANSITION, VERTEX } from './shaders';

// GPU effects for videos and stills (shaders in ./shaders.ts, ported from ArtCraft, Apache-2.0, see ./NOTICE.md).
// A source (an image under public/ or a video clip) is drawn through one or more effect passes onto a full-frame quad.
//   <Fx src={staticFile('a.jpg')} grade={LOOKS.teal} rays={{ center: [0.3, 0.2] }} />
//   <Fx video={staticFile('clip.mp4')} grade={LOOKS.film} glitch={{ amount: 0.02 }} />
//   <FxTransition a={...} b={...} kind="glass" progress={p} />
// Render with --gl=angle on a desktop GPU, --gl=swangle in the cloud (same as the 3D studio).

export type Grade = Partial<{
  temp: number; tint: number; expo: number; contrast: number; hi: number; sh: number; wh: number; bl: number; sat: number; vib: number; faded: number;
  look: 0 | 2 | 3 | 4 | 5 | 6 | 7; lookAmt: number;
  shTint: [number, number, number]; midTint: [number, number, number]; hiTint: [number, number, number];
  curve: [number, number, number];
  vig: number; vigStart: number; vigFeather: number;
  grain: number; grainSize: number;
  duo: number; duoA: string; duoB: string;
  focus: [number, number]; zoom: number;
}>;

/** Named looks: starting points, each a full grade. */
export const LOOKS: Record<string, Grade> = {
  clean: { contrast: 0.04, grain: 0.035 },
  // soft film print: lifted blacks, warm highlights, cool shadows, a touch less saturation, visible grain
  film: { look: 6, lookAmt: 0.6, faded: 0.35, contrast: 0.1, sat: 0.9, shTint: [-0.03, 0.0, 0.05], hiTint: [0.06, 0.025, -0.05], vig: 0.25, vigStart: 0.5, vigFeather: 0.7, grain: 0.06, grainSize: 1.3 },
  // orange and teal: skin and warm objects pushed warm, shadows and backgrounds pushed toward cyan-blue
  teal: { look: 5, lookAmt: 0.9, contrast: 0.12, sat: 0.92, shTint: [-0.07, 0.02, 0.08], midTint: [0.0, 0.0, 0.0], hiTint: [0.07, 0.03, -0.06], vig: 0.25, vigStart: 0.5, vigFeather: 0.7, grain: 0.045 },
  warm: { look: 2, lookAmt: 0.7, temp: 0.1, contrast: 0.06, vib: 0.15, hiTint: [0.03, 0.015, -0.02], vig: 0.2, vigStart: 0.55, vigFeather: 0.7, grain: 0.04 },
  night: { look: 3, lookAmt: 0.7, expo: 0.95, contrast: 0.14, sat: 0.85, shTint: [-0.03, 0.0, 0.05], vig: 0.35, vigStart: 0.45, vigFeather: 0.7, grain: 0.06, grainSize: 1.3 },
  bleach: { look: 4, lookAmt: 0.55, contrast: 0.1, sat: 0.75, bl: 0.18, sh: 0.15, vig: 0.25, vigStart: 0.5, vigFeather: 0.7, grain: 0.07, grainSize: 1.4 },
  mono: { look: 7, lookAmt: 1, contrast: 0.18, curve: [-0.12, 0, 0.1], vig: 0.3, vigStart: 0.5, vigFeather: 0.7, grain: 0.08, grainSize: 1.4 },
};

const hex3 = (c?: string) => { const n = parseInt((c ?? '#000000').slice(1), 16); return new THREE.Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255); };

const gradeUniforms = (g: Grade, tex: THREE.Texture | null) => {
  const img = tex?.image as { width?: number; height?: number; videoWidth?: number; videoHeight?: number } | undefined;
  const tw = img?.videoWidth ?? img?.width ?? 1, th = img?.videoHeight ?? img?.height ?? 1;
  return {
    uTex: { value: tex }, uTexSize: { value: new THREE.Vector2(tw, th) }, uFocus: { value: new THREE.Vector2(...(g.focus ?? [0.5, 0.5])) }, uZoom: { value: g.zoom ?? 1 },
    uTemp: { value: g.temp ?? 0 }, uTint: { value: g.tint ?? 0 }, uExpo: { value: g.expo ?? 1 }, uContrast: { value: g.contrast ?? 0 },
    uHi: { value: g.hi ?? 0 }, uSh: { value: g.sh ?? 0 }, uWh: { value: g.wh ?? 0 }, uBl: { value: g.bl ?? 0 }, uSat: { value: g.sat ?? 1 }, uVib: { value: g.vib ?? 0 }, uFaded: { value: g.faded ?? 0 },
    uLook: { value: g.look ?? 0 }, uLookAmt: { value: g.lookAmt ?? 0 },
    uShTint: { value: new THREE.Vector3(...(g.shTint ?? [0, 0, 0])) }, uMidTint: { value: new THREE.Vector3(...(g.midTint ?? [0, 0, 0])) }, uHiTint: { value: new THREE.Vector3(...(g.hiTint ?? [0, 0, 0])) },
    uCurve: { value: new THREE.Vector3(...(g.curve ?? [0, 0, 0])) },
    uVig: { value: g.vig ?? 0 }, uVigStart: { value: g.vigStart ?? 0.5 }, uVigFeather: { value: g.vigFeather ?? 0.6 },
    uGrain: { value: g.grain ?? 0 }, uGrainSize: { value: g.grainSize ?? 1.2 },
    uDuo: { value: g.duo ?? 0 }, uDuoA: { value: hex3(g.duoA) }, uDuoB: { value: hex3(g.duoB ?? '#ffffff') },
  };
};

/** A full-frame quad drawn with a fragment shader; `target` renders it into a texture for the next pass instead of the screen. */
const Pass: React.FC<{ frag: string; uniforms: Record<string, { value: unknown }>; target?: THREE.WebGLRenderTarget }> = ({ frag, uniforms, target }) => {
  const mat = React.useMemo(() => new THREE.ShaderMaterial({ vertexShader: VERTEX, fragmentShader: COMMON + frag, uniforms: {}, depthTest: false, depthWrite: false }), [frag]);
  mat.uniforms = uniforms as THREE.ShaderMaterial['uniforms'];
  if (target) return <PassToTarget mat={mat} target={target} />;
  return <mesh frustumCulled={false}><planeGeometry args={[2, 2]} /><primitive object={mat} attach="material" /></mesh>;
};
const PassToTarget: React.FC<{ mat: THREE.ShaderMaterial; target: THREE.WebGLRenderTarget }> = ({ mat, target }) => {
  const scene = React.useMemo(() => { const s = new THREE.Scene(); s.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat)); return s; }, [mat]);
  const cam = React.useMemo(() => new THREE.Camera(), []);
  // render once per React render (Remotion renders once per frame)
  const r = React.useRef<THREE.WebGLRenderer | null>(null);
  return <RendererHook onRenderer={(gl) => { r.current = gl; gl.setRenderTarget(target); gl.render(scene, cam); gl.setRenderTarget(null); }} />;
};
import { useThree } from '@react-three/fiber';
const RendererHook: React.FC<{ onRenderer: (gl: THREE.WebGLRenderer) => void }> = ({ onRenderer }) => { const { gl } = useThree(); onRenderer(gl); return null; };

/** Loads an image texture and holds the frame until it is ready. */
const useImageTexture = (src?: string) => {
  const [tex, setTex] = React.useState<THREE.Texture | null>(null);
  const [h] = React.useState(() => (src ? delayRender(`fx image ${src}`) : null));
  React.useEffect(() => {
    if (!src) return;
    new THREE.TextureLoader().load(src, (t) => {
      t.colorSpace = THREE.NoColorSpace; t.minFilter = THREE.LinearFilter; setTex(t);
      // release the frame only after the canvas has drawn with the texture (several canvases on one still raced to black)
      if (h !== null) requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => continueRender(h))));
    }, undefined, () => { if (h !== null) continueRender(h); });
  }, [src, h]);
  return tex;
};

export type FxProps = {
  src?: string; video?: string; width?: number; height?: number;
  grade?: Grade;
  rays?: { center?: [number, number]; length?: number; gain?: number; radius?: number; color?: string; fromSource?: boolean };
  glow?: { threshold?: number; radius?: number; intensity?: number; tint?: string };
  glitch?: { amount?: number; scale?: number; speed?: number; split?: number; wave?: number; bands?: number };
  style?: React.CSSProperties;
};

const Chain: React.FC<FxProps & { tex: THREE.Texture | null; W: number; H: number; t: number }> = ({ tex, W, H, t, grade, rays, glow, glitch }) => {
  // the shaders work on the stored sRGB values directly (as the source effects do), so no colour-space conversion anywhere
  const passes: { frag: string; u: Record<string, { value: unknown }> }[] = [];
  const base = { uSize: { value: new THREE.Vector2(W, H) }, uTime: { value: t } };
  passes.push({ frag: GRADE, u: { ...base, ...gradeUniforms(grade ?? LOOKS.clean, tex) } });
  if (glow) passes.push({ frag: GLOW, u: { ...base, uThreshold: { value: glow.threshold ?? 0.7 }, uRadius: { value: glow.radius ?? 18 }, uIntensity: { value: glow.intensity ?? 0.8 }, uTint: { value: hex3(glow.tint ?? '#ffffff') } } });
  if (rays) passes.push({ frag: RAYS, u: { ...base, uCenter: { value: new THREE.Vector2(rays.center?.[0] ?? 0.5, 1 - (rays.center?.[1] ?? 0.2)) }, uLength: { value: rays.length ?? 0.6 }, uGain: { value: rays.gain ?? 1.2 }, uRadius: { value: rays.radius ?? 0.25 }, uColor: { value: hex3(rays.color ?? '#ffe6b0') }, uColorFromSource: { value: rays.fromSource ? 1 : 0 } } });
  if (glitch) passes.push({ frag: DISPLACE, u: { ...base, uAmount: { value: glitch.amount ?? 0.01 }, uScale: { value: glitch.scale ?? 3 }, uSpeed: { value: glitch.speed ?? 1 }, uSplit: { value: glitch.split ?? 4 }, uWave: { value: glitch.wave ?? 0 }, uBands: { value: glitch.bands ?? 0 } } });
  const targets = React.useMemo(() => passes.slice(0, -1).map(() => new THREE.WebGLRenderTarget(W, H)), [passes.length, W, H]);
  // each pass after the first reads the previous pass's target
  passes.forEach((p, i) => { if (i > 0) p.u.uTex = { value: targets[i - 1].texture }; });
  return <>{passes.map((p, i) => <Pass key={i} frag={p.frag} uniforms={p.u} target={i < passes.length - 1 ? targets[i] : undefined} />)}</>;
};

const VideoTex: React.FC<{ src: string; children: (t: THREE.Texture | null) => React.ReactNode }> = ({ src, children }) => {
  const t = useOffthreadVideoTexture({ src });
  if (t) t.colorSpace = THREE.NoColorSpace;   // shaders work on stored sRGB values
  return <>{children(t)}</>;
};

/** One graded source with optional rays, glow and glitch, filling its box. */
export const Fx: React.FC<FxProps> = (p) => {
  const { width: VW, height: VH, fps } = useVideoConfig();
  const W = p.width ?? VW, H = p.height ?? VH, t = useCurrentFrame() / fps;
  const img = useImageTexture(p.video ? undefined : p.src);
  return (
    <ThreeCanvas width={W} height={H} orthographic camera={{ position: [0, 0, 1] }} gl={{ preserveDrawingBuffer: true, antialias: false }} style={{ position: 'absolute', inset: 0, ...p.style }}>
      {p.video ? <VideoTex src={p.video}>{(tex) => <Chain {...p} tex={tex} W={W} H={H} t={t} />}</VideoTex> : <Chain {...p} tex={img} W={W} H={H} t={t} />}
    </ThreeCanvas>
  );
};

export type TransitionKind = 'wipe' | 'clock' | 'iris' | 'luma' | 'blocks' | 'glass';
/** A transition between two pictures (images or video frames already graded), progress 0..1. */
export const FxTransition: React.FC<{ a: string; b: string; kind: TransitionKind; progress: number; angle?: number; feather?: number; center?: [number, number]; blocks?: number; width?: number; height?: number; style?: React.CSSProperties }> = (p) => {
  const { width: VW, height: VH, fps } = useVideoConfig();
  const W = p.width ?? VW, H = p.height ?? VH, t = useCurrentFrame() / fps;
  const A = useImageTexture(p.a), B = useImageTexture(p.b);
  const u = { uSize: { value: new THREE.Vector2(W, H) }, uTime: { value: t }, uA: { value: A }, uB: { value: B }, uProgress: { value: p.progress }, uFeather: { value: p.feather ?? 0.12 }, uAngle: { value: p.angle ?? 0 }, uKind: { value: ['wipe', 'clock', 'iris', 'luma', 'blocks', 'glass'].indexOf(p.kind) }, uCenter: { value: new THREE.Vector2(...(p.center ?? [0.5, 0.5])) }, uBlocks: { value: p.blocks ?? 14 } };
  return (
    <ThreeCanvas width={W} height={H} orthographic camera={{ position: [0, 0, 1] }} gl={{ preserveDrawingBuffer: true }} style={{ position: 'absolute', inset: 0, ...p.style }}>
      <Pass frag={TRANSITION} uniforms={u} />
    </ThreeCanvas>
  );
};
