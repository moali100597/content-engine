import React from 'react';
import { useThree } from '@react-three/fiber';
import { ThreeCanvas } from '@remotion/three';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

// Format 3, the studio: a night studio in real 3D (glossy floor, light grid, light tubes, haze) and one character, the ball.
// First used by video 2. Everything is a pure function of the props, so any frame renders alone
// (Remotion renders frames out of order). Render with --gl=angle on a GPU, --gl=swangle in the cloud.

export type BallPose = {
  x: number; y?: number; z?: number;      // centre, world units (y is height above the floor contact, 0 = resting)
  squash?: number;                        // 1 = round, 0.8 = flattened on landing, 1.15 = stretched
  lean?: number;                          // radians, leans into its direction of travel
  look?: [number, number];                // where the eyes look, -1..1 each way
  blink?: number;                         // 0 open .. 1 closed
  mood?: 'calm' | 'happy' | 'worried' | 'dizzy';
  size?: number;                          // 1 = normal; smaller when it stands on the tape as a marker
  turn?: number;                          // radians, turns its face left or right toward what it is watching
  gear?: 'rocket' | 'shell';              // what a new speed number turns it into
  fire?: number;                          // 0..1 flame flicker for the rocket
  visible?: boolean;
};
export const R = 0.36;
export const COL = { ball: '#FF5A3C', ball2: '#FF8A5C', floor: '#0A0F22', tubeA: '#5B8CFF', tubeB: '#FF4D8D', grid: '#6F86FF' };

/** Studio lighting baked into an environment map, so shiny things have something real to reflect. Built once. */
const Env: React.FC = () => {
  const { gl, scene } = useThree();
  React.useMemo(() => {
    const pm = new THREE.PMREMGenerator(gl);
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.22;
    pm.dispose();
  }, [gl, scene]);
  return null;
};

export const canvasTex = (w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) => {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d')!);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
};

/** Floor grid as light: thin glowing lines that fade with distance, drawn once into a texture. */
const useGrid = () => React.useMemo(() => canvasTex(2048, 2048, (c) => {
  c.clearRect(0, 0, 2048, 2048);
  const cells = 32, s = 2048 / cells;
  for (let i = 0; i <= cells; i++) {
    const major = i % 4 === 0;
    c.strokeStyle = major ? 'rgba(140,165,255,0.95)' : 'rgba(110,135,255,0.38)';
    c.lineWidth = major ? 2 : 1;
    c.beginPath(); c.moveTo(i * s, 0); c.lineTo(i * s, 2048); c.stroke();
    c.beginPath(); c.moveTo(0, i * s); c.lineTo(2048, i * s); c.stroke();
  }
  const g = c.createRadialGradient(1024, 1024, 120, 1024, 1024, 1024);       // lines die out away from the centre
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.55, 'rgba(0,0,0,0.45)'); g.addColorStop(1, 'rgba(0,0,0,1)');
  c.globalCompositeOperation = 'destination-out'; c.fillStyle = g; c.fillRect(0, 0, 2048, 2048);
}), []);

/** A soft round glow, used for light pools, tube halos and floating dust. */
export const useGlow = () => React.useMemo(() => canvasTex(256, 256, (c) => {
  const g = c.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, 256, 256);
}), []);

const Tube: React.FC<{ pos: [number, number, number]; rot: [number, number, number]; len: number; color: string; glow: THREE.Texture; power: number }> = ({ pos, rot, len, color, glow, power }) => (
  <group position={pos} rotation={rot}>
    <mesh><cylinderGeometry args={[0.035, 0.035, len, 16]} /><meshBasicMaterial color={color} toneMapped={false} /></mesh>
    <mesh><cylinderGeometry args={[0.02, 0.02, len, 16]} /><meshBasicMaterial color="#ffffff" toneMapped={false} /></mesh>
    <sprite scale={[1.5, len * 1.25, 1]}><spriteMaterial map={glow} color={color} transparent opacity={0.5 * power} depthWrite={false} blending={THREE.AdditiveBlending} /></sprite>
  </group>
);

/** The key light follows the camera and always aims at the stage centre. */
const SpotOn: React.FC<{ x: number; on: number }> = ({ x, on }) => {
  const target = React.useMemo(() => new THREE.Object3D(), []);
  target.position.set(x, 0.3, 0); target.updateMatrixWorld();
  return (
    <>
      <primitive object={target} />
      <spotLight position={[x + 1.6, 5.2, 3.2]} target={target} angle={0.5} penumbra={0.9} intensity={60 * on} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} color="#FFF3E0" />
    </>
  );
};

const Eye: React.FC<{ side: 1 | -1; look: [number, number]; blink: number; mood: string }> = ({ side, look, blink, mood }) => {
  const open = Math.max(0.06, 1 - blink) * (mood === 'happy' ? 0.82 : mood === 'worried' ? 1.12 : 1);
  return (
    <group position={[side * 0.125, 0.07, R * 0.9]} rotation={[0, side * 0.33, 0]}>
      <mesh scale={[1, open, 0.45]}><sphereGeometry args={[0.092, 32, 32]} /><meshStandardMaterial color="#FFFFFF" roughness={0.25} /></mesh>
      <mesh position={[look[0] * 0.03, look[1] * 0.028 * open, 0.036]} scale={[1, Math.min(1, open * 1.1), 0.4]}><sphereGeometry args={[mood === 'worried' ? 0.036 : 0.047, 24, 24]} /><meshStandardMaterial color="#131A30" roughness={0.2} /></mesh>
      <mesh position={[look[0] * 0.03 + 0.016, look[1] * 0.028 * open + 0.018, 0.056]} scale={[1, open, 0.4]}><sphereGeometry args={[0.013, 12, 12]} /><meshBasicMaterial color="#FFFFFF" /></mesh>
      {mood === 'worried' && <mesh position={[0, 0.125, 0.02]} rotation={[0, 0, side * -0.38]}><boxGeometry args={[0.12, 0.022, 0.02]} /><meshStandardMaterial color="#B5361F" /></mesh>}
    </group>
  );
};

/** The character. One body, two eyes, a small mouth; `reflect` draws the faint copy seen in the floor.
 *  The face turns left or right (`turn`); the rocket stays along the line of travel. A shell makes it a turtle: dome on its back, four feet, a tail. */
const Ball: React.FC<{ p: BallPose; reflect?: boolean; ghost?: number }> = ({ p, reflect: mirror, ghost }) => {
  const reflect = mirror || ghost !== undefined;        // both are a bare translucent body, no face and no gear
  const k = p.size ?? 1, sq = (p.squash ?? 1) * k, wide = k / Math.sqrt(p.squash ?? 1), y = (p.y ?? 0) + R * sq;
  const mood = p.mood ?? 'calm';
  return (
    <group position={[p.x, mirror ? -y : y, p.z ?? 0]} scale={[wide, mirror ? -sq : sq, wide]} rotation={[0, 0, -(p.lean ?? 0)]}>
      <mesh castShadow={!mirror}>
        <sphereGeometry args={[R, 96, 96]} />
        <meshPhysicalMaterial color={COL.ball} roughness={0.36} clearcoat={0.55} clearcoatRoughness={0.25} transparent={!!reflect} opacity={ghost ?? (reflect ? 0.22 : 1)} depthWrite={!reflect} />
      </mesh>
      {!reflect && p.gear === 'rocket' && (
        <group position={[-R * 1.05, 0.02, -0.02]} rotation={[0, 0, Math.PI / 2]}>
          <mesh><cylinderGeometry args={[0.11, 0.15, 0.3, 24]} /><meshStandardMaterial color="#DDE3F5" roughness={0.3} metalness={0.7} /></mesh>
          <mesh position={[0, 0.2, 0]}><cylinderGeometry args={[0.15, 0.12, 0.1, 24]} /><meshStandardMaterial color="#5B8CFF" roughness={0.4} /></mesh>
          <mesh position={[0, 0.4 + (p.fire ?? 0) * 0.05, 0]} scale={[1, 1 + (p.fire ?? 0) * 0.4, 1]}><coneGeometry args={[0.07, 0.3, 20]} /><meshBasicMaterial color="#FFD23F" toneMapped={false} /></mesh>
          <mesh position={[0, 0.47 + (p.fire ?? 0) * 0.08, 0]} scale={[1, 1 + (p.fire ?? 0) * 0.5, 1]}><coneGeometry args={[0.11, 0.46, 20]} /><meshBasicMaterial color="#FF6A2B" transparent opacity={0.6} toneMapped={false} /></mesh>
          <pointLight position={[0, 0.5, 0]} intensity={6} color="#FF8A3C" />
        </group>
      )}
      {!reflect && (
        <group rotation={[0, p.turn ?? 0, 0]}>
          {p.gear === 'shell' && (
            <>
              <mesh scale={[1.06, 1.04, 1.08]} castShadow><sphereGeometry args={[R * 1.1, 48, 32, Math.PI, Math.PI]} /><meshStandardMaterial color="#2FA36B" roughness={0.5} side={THREE.DoubleSide} /></mesh>
              <mesh scale={[1.06, 1.04, 1]}><torusGeometry args={[R * 1.1, 0.04, 12, 56]} /><meshStandardMaterial color="#8CF0C2" roughness={0.45} /></mesh>
              {[[0, 0.02, -0.4], [0.2, 0.2, -0.3], [-0.2, 0.2, -0.3], [0.2, -0.17, -0.31], [-0.2, -0.17, -0.31], [0, 0.33, -0.2]].map((q, n) => <mesh key={n} position={q as [number, number, number]} scale={[1, 1, 0.5]}><sphereGeometry args={[0.1, 16, 12]} /><meshStandardMaterial color="#1E7A4C" roughness={0.6} /></mesh>)}
              {[[0.2, 0.14], [-0.2, 0.14], [0.2, -0.2], [-0.2, -0.2]].map(([fx, fz], n) => <mesh key={n} position={[fx, -R * 0.93, fz]} scale={[1, 0.7, 1.25]}><sphereGeometry args={[0.085, 16, 12]} /><meshStandardMaterial color="#1E7A4C" roughness={0.6} /></mesh>)}
              <mesh position={[0, -0.16, -R * 1.22]} rotation={[-Math.PI / 2.4, 0, 0]}><coneGeometry args={[0.05, 0.16, 12]} /><meshStandardMaterial color="#1E7A4C" roughness={0.6} /></mesh>
            </>
          )}
          <Eye side={1} look={p.look ?? [0, 0]} blink={p.blink ?? 0} mood={mood} />
          <Eye side={-1} look={p.look ?? [0, 0]} blink={p.blink ?? 0} mood={mood} />
          <mesh position={[0, -0.085, R * 0.97]} rotation={[0, 0, Math.PI]} scale={[1, mood === 'happy' ? 1 : mood === 'worried' ? -0.6 : 0.45, 1]}>
            <torusGeometry args={[0.055, 0.011, 12, 32, Math.PI]} /><meshStandardMaterial color="#7A1D0E" roughness={0.4} />
          </mesh>
        </group>
      )}
    </group>
  );
};

export const Studio: React.FC<{ width: number; height: number; t: number; ball: BallPose; cam?: { z?: number; y?: number; lookY?: number; x?: number }; floor?: boolean; dim?: number; hue?: [string, string]; ghosts?: BallPose[]; ghost?: number; staged?: boolean; far?: number; children?: React.ReactNode }> = ({ width, height, t, ball, cam = {}, floor = true, dim = 0, hue, ghosts, ghost = 0.34, staged = false, far = 0, children }) => (
  <ThreeCanvas width={width} height={height} shadows camera={{ position: [cam.x ?? 0, cam.y ?? 1.75, cam.z ?? 6.4], fov: 30 }} onCreated={({ camera, gl }) => { camera.lookAt(cam.x ?? 0, cam.lookY ?? 0.28, 0); gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 0.95; }} style={{ position: 'absolute', inset: 0 }}>
    <Set t={t} ball={ball} cam={cam} floor={floor} dim={dim} hue={hue ?? [COL.tubeA, COL.tubeB]} ghosts={ghosts} ghost={ghost} staged={staged} far={far}>{children}</Set>
  </ThreeCanvas>
);

const CELL = 26 / 32;
const Set: React.FC<{ t: number; ball: BallPose; cam: { z?: number; y?: number; lookY?: number; x?: number }; floor: boolean; dim: number; hue: [string, string]; ghosts?: BallPose[]; ghost: number; staged: boolean; far: number; children?: React.ReactNode }> = ({ t, ball, cam, floor, dim, hue, ghosts, ghost, staged, far, children }) => {
  const cx = cam.x ?? 0, gx = Math.round(cx / CELL) * CELL;      // the lit patch of floor travels with the camera, one grid cell at a time, so the ball can run for ever
  const grid = useGrid(), glow = useGlow();
  const { camera } = useThree();
  camera.position.set(cam.x ?? 0, cam.y ?? 1.75, cam.z ?? 6.4); camera.lookAt(cam.x ?? 0, cam.lookY ?? 0.28, 0); camera.updateProjectionMatrix();   // the camera is a function of the frame too
  const pulse = 0.85 + 0.15 * Math.sin(t * 1.7), on = 1 - dim;
  return (
    <>
      <Env />
      <fog attach="fog" args={['#0A0F22', 7.5 + far * 6, 17 + far * 12]} />
      <ambientLight intensity={0.25 * on} />
      <SpotOn x={cx} on={on} />
      <spotLight visible={false} position={[1.6, 5.2, 3.2]} angle={0.5} penumbra={0.9} intensity={60 * on} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} color="#FFF3E0" />
      <pointLight position={[cx - 2.6, 1.3, 1.2]} intensity={11 * on * pulse} color={hue[0]} />
      <pointLight position={[cx + 2.6, 1.0, -0.6]} intensity={9 * on * pulse} color={hue[1]} />
      {floor && (
        <>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[gx, 0, 0]} receiveShadow>
            <planeGeometry args={[60, 60]} />
            <meshStandardMaterial color={COL.floor} roughness={0.5} metalness={0.2} transparent opacity={0.9} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[gx, 0.003, 0]}>
            <planeGeometry args={[26, 26]} />
            <meshBasicMaterial map={grid} transparent opacity={0.34 * on} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
          <sprite position={[ball.x, 0.02, 0.2]} scale={[5.2, 2.2, 1]}><spriteMaterial map={glow} color="#3D56C8" transparent opacity={0.3 * on} depthWrite={false} blending={THREE.AdditiveBlending} /></sprite>
        </>
      )}
      {/* the back of the studio travels with the camera: two light tubes and their haze */}
      <group position={[cx, 0, 0]}>
      {staged ? (() => {       // after the opening the two tubes are kept at the edges of the picture whatever the lens does: thin accents, never a frame around the subject
        const d = (cam.z ?? 6.4) + 2.8, k = d / 9.2, x = 0.1507 * d * 0.97, lift = ((cam.lookY ?? 0.28) - 0.28) * 0.9;
        return (
          <>
            <Tube pos={[-x, 1.7 * k + lift, -2.8]} rot={[0, 0, 0.14]} len={3.6 * k} color={hue[0]} glow={glow} power={on * pulse} />
            <Tube pos={[x, 1.5 * k + lift, -2.8]} rot={[0, 0, -0.2]} len={3.2 * k} color={hue[1]} glow={glow} power={on * pulse} />
          </>
        );
      })() : (
        <>
          <Tube pos={[-1.25, 1.7, -2.6]} rot={[0, 0, 0.14]} len={3.6} color={hue[0]} glow={glow} power={on * pulse} />
          <Tube pos={[1.35, 1.5, -3.0]} rot={[0, 0, -0.2]} len={3.2} color={hue[1]} glow={glow} power={on * pulse} />
          <Tube pos={[0.1, 3.3, -3.6]} rot={[0, 0, Math.PI / 2 + 0.04]} len={3.4} color={hue[0]} glow={glow} power={on * 0.7} />
        </>
      )}
      {/* dust in the light, drifting slowly */}
      {Array.from({ length: 26 }, (_, i) => {
        const a = Math.sin(i * 12.9898) * 43758.5453, b = Math.sin(i * 78.233) * 12543.123, r1 = a - Math.floor(a), r2 = b - Math.floor(b);
        const x = (r1 - 0.5) * 7 + Math.sin(t * 0.13 + i) * 0.25, y = 0.4 + r2 * 3.4 + Math.sin(t * 0.21 + i * 2.1) * 0.15, z = -4.5 + ((i * 0.37) % 1) * 3.6;   // always behind the ball
        return <sprite key={i} position={[x, y, z]} scale={[0.03 + r2 * 0.05, 0.03 + r2 * 0.05, 1]}><spriteMaterial map={glow} color={i % 3 ? '#9FB4FF' : '#FFB3C7'} transparent opacity={(0.25 + r1 * 0.4) * on} depthWrite={false} blending={THREE.AdditiveBlending} /></sprite>;
      })}
      </group>
      {children}
      {ghosts?.map((g, i) => <Ball key={i} p={g} ghost={ghost} />)}
      {ball.visible !== false && (
        <>
          <Ball p={ball} />
          {floor && <Ball p={ball} reflect />}
        </>
      )}
    </>
  );
};

// ---------- props ----------
/** A flip pad standing in the air: pages turn on the left edge, each one a frame of the little running man. */
const pages = new Map<number, THREE.Texture>();
export const FlipPad: React.FC<{ pos: [number, number, number]; page: number; turn: number; scale?: number; tilt?: number; player?: number; spin?: number }> = ({ pos, page, turn, scale = 1, tilt = -0.18, player = 0, spin = 0 }) => {
  const draw = (n: number) => pages.get(n) ?? pages.set(n, canvasTex(512, 384, (c) => {
    c.fillStyle = '#FBF6E9'; c.fillRect(0, 0, 512, 384);
    c.strokeStyle = 'rgba(80,110,200,.28)'; c.lineWidth = 2;
    for (let y = 60; y < 384; y += 36) { c.beginPath(); c.moveTo(0, y); c.lineTo(512, y); c.stroke(); }
    c.strokeStyle = 'rgba(220,70,70,.4)'; c.beginPath(); c.moveTo(60, 0); c.lineTo(60, 384); c.stroke();
    // the little man: a cycle of 8 poses, sliding to the right a little on each page
    const ph = ((n % 8) + 0.5) / 8 * Math.PI * 2, x = 256, y = 196 + Math.abs(Math.sin(ph)) * -10;
    c.strokeStyle = '#1B2238'; c.lineWidth = 9; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.arc(x, y - 78, 22, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.moveTo(x, y - 56); c.lineTo(x - 4, y + 10); c.stroke();
    const sw = Math.sin(ph) * 34, sw2 = Math.sin(ph + Math.PI) * 34;
    c.beginPath(); c.moveTo(x - 4, y + 10); c.lineTo(x - 4 + sw, y + 52); c.lineTo(x - 14 + sw * 1.4, y + 92); c.stroke();
    c.beginPath(); c.moveTo(x - 4, y + 10); c.lineTo(x - 4 + sw2, y + 52); c.lineTo(x - 14 + sw2 * 1.4, y + 92); c.stroke();
    c.beginPath(); c.moveTo(x - 2, y - 40); c.lineTo(x + sw2 * 0.9, y - 14); c.lineTo(x + 14 + sw2 * 1.2, y - 30); c.stroke();
    c.beginPath(); c.moveTo(x - 2, y - 40); c.lineTo(x + sw * 0.9, y - 14); c.lineTo(x + 14 + sw * 1.2, y - 30); c.stroke();
    c.strokeStyle = 'rgba(27,34,56,.55)'; c.lineWidth = 6; for (let g = -80 - ((n * 30) % 110); g < 600; g += 110) { c.beginPath(); c.moveTo(g, y + 118 - (y - 196)); c.lineTo(g + 50, y + 118 - (y - 196)); c.stroke(); }
    c.fillStyle = '#8A93B5'; c.font = '600 26px "JetBrains Mono", monospace'; c.fillText(String(n + 1).padStart(2, '0'), 440, 360);
  })).get(n)!;
  const now = React.useMemo(() => draw(page), [page]), next = React.useMemo(() => draw(page + 1), [page]);
  const w = 1.5, h = 1.125, a = Math.min(1, Math.max(0, turn)) * Math.PI * 0.5;   // the page swings on its left edge toward the lens; edge-on it is gone
  return (
    <group position={pos} rotation={[tilt, spin, 0]} scale={scale}>
      {player > 0.01 && (
        <group position={[0, -0.09, -0.09]} scale={[1, 1, 1]}>
          <mesh><boxGeometry args={[w + 0.22 * player, h + 0.5 * player, 0.07]} /><meshStandardMaterial color="#0C1228" roughness={0.35} metalness={0.4} /></mesh>
          <mesh position={[0, -h / 2 - 0.06, 0.04]}><planeGeometry args={[w * 0.92, 0.03]} /><meshBasicMaterial color="#3A4470" transparent opacity={player} /></mesh>
          <mesh position={[-w * 0.46 + w * 0.46 * ((page % 60) / 60), -h / 2 - 0.06, 0.042]}><planeGeometry args={[w * 0.92 * ((page % 60) / 60), 0.03]} /><meshBasicMaterial color="#FF4D6D" toneMapped={false} transparent opacity={player} /></mesh>
          <mesh position={[-w * 0.46 + w * 0.92 * ((page % 60) / 60), -h / 2 - 0.06, 0.045]}><circleGeometry args={[0.035, 20]} /><meshBasicMaterial color="#FF4D6D" toneMapped={false} transparent opacity={player} /></mesh>
        </group>
      )}
      <mesh position={[0, 0, -0.035]} castShadow><boxGeometry args={[w + 0.06, h + 0.06, 0.06]} /><meshStandardMaterial color="#2A3358" roughness={0.6} /></mesh>
      <mesh position={[0, 0, -0.002]}><planeGeometry args={[w, h]} /><meshStandardMaterial map={next} roughness={0.9} /></mesh>
      <group position={[-w / 2, 0, 0.004]} rotation={[0, -a, 0]}>
        <mesh position={[w / 2, 0, 0]}><planeGeometry args={[w, h]} /><meshStandardMaterial map={now} roughness={0.9} side={THREE.DoubleSide} /></mesh>
      </group>
      {Array.from({ length: 9 }, (_, i) => <mesh key={i} position={[-w / 2 + 0.12 + i * (w - 0.24) / 8, h / 2 + 0.02, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.045, 0.011, 8, 20]} /><meshStandardMaterial color="#C9D2F5" metalness={0.8} roughness={0.3} /></mesh>)}
    </group>
  );
};

/** The camera that photographs every frame. `flash` 0..1. */
export const Snapper: React.FC<{ pos: [number, number, number]; flash: number; bob: number; rot?: number; scale?: number }> = ({ pos, flash, bob, rot = -0.5, scale = 1 }) => {
  const glow = useGlow();
  return (
    <group position={[pos[0], pos[1] + bob * 0.03, pos[2]]} rotation={[0, rot, 0]} scale={scale}>
      {[0, 2.1, 4.2].map((a) => <mesh key={a} position={[Math.sin(a) * 0.14, -0.21 - pos[1] / 2 / scale, Math.cos(a) * 0.14]} rotation={[Math.cos(a) * 0.3, 0, -Math.sin(a) * 0.3]}><cylinderGeometry args={[0.014, 0.014, pos[1] / scale, 8]} /><meshStandardMaterial color="#8A93B5" metalness={0.7} roughness={0.35} /></mesh>)}
      <mesh castShadow><boxGeometry args={[0.62, 0.42, 0.3]} /><meshStandardMaterial color="#5A70C8" roughness={0.4} metalness={0.3} /></mesh>
      <mesh position={[0.16, 0.25, 0]}><boxGeometry args={[0.2, 0.09, 0.2]} /><meshStandardMaterial color="#5466B0" roughness={0.5} /></mesh>
      <mesh position={[-0.2, 0.235, 0]}><cylinderGeometry args={[0.05, 0.05, 0.05, 16]} /><meshStandardMaterial color="#FF4D6D" /></mesh>
      <mesh position={[-0.05, 0, 0.2]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.16, 0.18, 0.2, 32]} /><meshStandardMaterial color="#0C1228" roughness={0.3} metalness={0.6} /></mesh>
      <mesh position={[-0.05, 0, 0.305]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.11, 0.11, 0.01, 32]} /><meshStandardMaterial color="#5B8CFF" roughness={0.1} metalness={0.9} /></mesh>
      <sprite position={[0.2, 0.2, 0.3]} scale={[flash * 3, flash * 3, 1]}><spriteMaterial map={glow} color="#FFFFFF" transparent opacity={flash} depthWrite={false} blending={THREE.AdditiveBlending} /></sprite>
      {flash > 0.02 && <pointLight position={[0.2, 0.2, 0.5]} intensity={flash * 22} color="#FFFFFF" />}
    </group>
  );
};

const hash = (i: number, k = 12.9898) => { const v = Math.sin(i * k) * 43758.5453; return v - Math.floor(v); };
/** A wall of frames, one tile for every picture. `shown` tiles are up (it fills from the floor); `fall` is seconds since it came down. */
export const FrameWall: React.FC<{ pos: [number, number, number]; cols: number; rows: number; dx: number; dy: number; shown: number; fall?: number; power?: number }> = ({ pos, cols, rows, dx, dy, shown, fall = 0, power = 1 }) => {
  const mesh = React.useMemo(() => {
    const tex = canvasTex(64, 96, (c) => {
      c.fillStyle = '#AEB9E6'; c.beginPath(); c.roundRect(2, 2, 60, 92, 9); c.fill();
      c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(32, 58, 11, 0, Math.PI * 2); c.fill();
      c.fillRect(10, 74, 44, 3);
    });
    const m = new THREE.InstancedMesh(new THREE.PlaneGeometry(dx * 0.86, dy * 0.88), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, fog: false }), cols * rows);
    m.frustumCulled = false;
    return m;
  }, [cols, rows, dx, dy]);
  const o = React.useMemo(() => new THREE.Object3D(), []), col = React.useMemo(() => new THREE.Color(), []);
  for (let i = 0; i < cols * rows; i++) {                    // every tile is a function of the props, like everything else here
    const r = Math.floor(i / cols), c = i % cols, h = hash(i), h2 = hash(i, 78.233), born = shown - i;
    let s = born <= 0 ? 0 : Math.min(1, 0.4 + born / cols), x = (c - (cols - 1) / 2) * dx, y = r * dy, z = 0, rz = 0;
    if (fall > 0) {
      const d = fall - h * 0.35 - (r / rows) * 0.45;
      if (d > 0) { y -= 7 * d * d; x += (h2 - 0.5) * d * 1.6; z += (h - 0.5) * d * 2.4; rz = (h2 - 0.5) * d * 9; }
      if (y < -0.5) s = 0;
    }
    o.position.set(x, y, z); o.rotation.set(0, 0, rz); o.scale.setScalar(s || 1e-6); o.updateMatrix(); mesh.setMatrixAt(i, o.matrix);
    const hot = born > 0 && born < cols * 2.5 ? 1 - born / (cols * 2.5) : 0;
    col.setHSL(0.6 + h2 * 0.26, 0.55, Math.min(0.92, (0.12 + h * 0.15) * power + hot * 0.6)); mesh.setColorAt(i, col);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return <primitive object={mesh} position={pos} />;
};

/** A tape measure lying in front of the ball: where the rule puts it, in numbers. `pos` is where its zero stands. */
export const Ruler: React.FC<{ pos: [number, number, number]; unit: number; min: number; max: number; mark: number; show: number }> = ({ pos, unit, min, max, mark, show }) => {
  const PAD = 70, CW = 2048, CH = 210, span = max - min, len = span * unit, wide = len * CW / (CW - PAD * 2), high = wide * CH / CW;
  const tex = React.useMemo(() => canvasTex(CW, CH, (c) => {
    c.fillStyle = 'rgba(16,22,48,.96)'; c.beginPath(); c.roundRect(0, 0, CW, CH, 36); c.fill();
    c.strokeStyle = 'rgba(140,165,255,.6)'; c.lineWidth = 4; c.beginPath(); c.roundRect(3, 3, CW - 6, CH - 6, 36); c.stroke();
    c.textAlign = 'center'; c.font = '700 66px "JetBrains Mono", monospace';
    for (let v = min; v <= max; v += 10) {
      const x = PAD + ((v - min) / span) * (CW - PAD * 2), big = v % 100 === 0, mid = v % 50 === 0;
      c.fillStyle = v === 0 ? '#3DDC97' : big ? '#FFD23F' : 'rgba(170,185,240,.8)'; c.fillRect(x - (big ? 5 : 2), 0, big ? 10 : 4, big ? 76 : mid ? 52 : 32);
      if (big) { c.fillStyle = v === 0 ? '#3DDC97' : '#F4F6FF'; c.fillText(String(v), x, 160); }
    }
  }), [min, max]);
  if (show <= 0.01) return null;
  return (
    <group position={pos} rotation={[-0.5, 0, 0]} scale={[1, show, 1]}>
      <mesh position={[(min + span / 2) * unit, high / 2, 0]}><planeGeometry args={[wide, high]} /><meshBasicMaterial map={tex} transparent toneMapped={false} /></mesh>
      <mesh position={[mark * unit, high + 0.06, 0.01]} rotation={[0, 0, Math.PI]}><coneGeometry args={[0.05, 0.11, 3]} /><meshBasicMaterial color="#FF4D6D" toneMapped={false} /></mesh>
    </group>
  );
};
