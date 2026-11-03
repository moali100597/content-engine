import React from 'react';
import { Easing } from 'remotion';
import { lerp, ramp } from './anim';
import { onStage, useLayout } from './layout';
import { Mood, Orb } from './Orb';
import { useBrand } from './brand';

/** Agent keyframe: from `t` the orb eases to centre (x, y) at size `s`; mood, look and opacity `o` carry over until changed. */
export type AgentKey = { t: number; x: number; y: number; s: number; mood?: Mood; look?: [number, number]; o?: number };

/** The agent is one continuous character on top of every scene. */
export const Agent: React.FC<{ t: number; keys: AgentKey[]; accent: string; dark: boolean; shake: (t: number) => number }> = ({ t, keys: authored, accent, dark, shake }) => {
  const L = useLayout();
  const B = useBrand();
  // keyframes are authored in 16:9; a layout with a `home` moves the resting badge there and maps the rest with the stage
  const keys = React.useMemo(() => (!L.home ? authored : authored.map((q) => {
    if (q.x > 960 && q.y > 700) return { ...q, x: L.home!.x, y: L.home!.y, s: L.home!.s };
    const [x, y, k] = onStage(L, q.x, q.y); return { ...q, x, y, s: q.s * k };
  })), [L, authored]);
  let i = 0;
  while (i < keys.length - 1 && keys[i + 1].t <= t) i++;
  const cur = keys[i], prev = keys[Math.max(0, i - 1)];
  const k = ramp(t, cur.t, cur.t + 0.55, Easing.inOut(Easing.cubic));
  const g = (f: (q: AgentKey) => number) => lerp(f(prev), f(cur), k);
  let mood: Mood = 'calm';
  let look: [number, number] = [0, 0], pl: [number, number] = [0, 0], o = 1, po = 1;
  keys.slice(0, i + 1).forEach((q, j) => { if (q.mood) mood = q.mood; if (q.look) { if (j < i) pl = q.look; look = q.look; } if (q.o !== undefined) { if (j < i) po = q.o; o = q.o; } });
  if (!cur.look) pl = look;
  const size = g((q) => q.s), op = lerp(po, o, ramp(t, cur.t, cur.t + 0.25));
  if (op <= 0.01) return null;
  const ph = t % 3.7, blink = ph < 0.14 ? Math.sin((ph / 0.14) * Math.PI) : 0;
  const hop = shake(t);
  const bob = Math.sin(t * 1.9) * 4 - Math.abs(Math.sin((t % 10) * 26)) * hop * 34 + ((mood as Mood) === 'panic' ? Math.sin(t * 47) * 2.5 : 0);
  const ring = size < 200 ? 7 : 0;
  return (
    <div data-qa="agent" style={{ position: 'absolute', left: g((q) => q.x) - size / 2, top: g((q) => q.y) - size / 2 + bob, width: size, height: size, opacity: op, borderRadius: '50%', boxSizing: 'border-box', border: ring ? `${ring}px solid ${accent}` : undefined, background: ring ? B.card : undefined, display: 'grid', placeItems: 'center', boxShadow: ring ? '0 18px 40px rgba(21,19,15,.12)' : undefined, transform: `scale(${(0.6 + 0.4 * Math.min(1, op * 1.2)) * (1 + hop * 0.08)})` }}>
      <Orb size={ring ? size - 40 : size} mood={mood} blink={blink} invert={dark} color={dark ? B.dark.soft : B.ink} bg={dark ? B.dark.bg : B.card} look={[Math.round(lerp(pl[0], look[0], k) * 20) / 20, Math.round(lerp(pl[1], look[1], k) * 20) / 20]} />
    </div>
  );
};
