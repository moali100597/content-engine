import React, { useMemo } from 'react';

// The agent: a lit sphere with eyes, drawn as 1-bit ordered dither so it can act in any frame.
export type Mood = 'calm' | 'panic' | 'guilty' | 'busy';
const B = [0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22, 3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21];

export const Orb: React.FC<{ size: number; mood?: Mood; look?: [number, number]; color?: string; bg?: string; cells?: number; blink?: number; invert?: boolean; style?: React.CSSProperties }> = ({ size, mood = 'calm', look = [0, 0], color = '#15130F', bg = '#FFFFFF', cells = 72, blink = 0, invert = false, style }) => {
  const d = useMemo(() => {
    const n = cells;
    let p = '';
    const [lx, ly] = look;
    const eye = mood === 'panic' ? { rx: 0.17, ry: 0.21, pr: 0.055 } : mood === 'guilty' ? { rx: 0.14, ry: 0.17, pr: 0.09 } : { rx: 0.125, ry: 0.21, pr: 0.1 };
    const ry = eye.ry * (1 - 0.92 * blink);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = ((i + 0.5) / n) * 2 - 1, y = ((j + 0.5) / n) * 2 - 1;
      const r2 = x * x + y * y;
      if (r2 > 1) continue;
      let on: boolean;
      const ex = Math.abs(x - lx * 0.12) - 0.3, ey = y + 0.08 - ly * 0.1;
      const ev = (ex * ex) / (eye.rx * eye.rx) + (ey * ey) / (ry * ry);
      const inEye = ev < 1;
      const lidCut = mood === 'guilty' && ey < -ry * 0.25;
      if (inEye && !lidCut) {
        const px = ex - lx * 0.045, py = ey - ly * 0.06 - (mood === 'guilty' ? 0.04 : 0);
        on = px * px + py * py < eye.pr * eye.pr && blink < 0.6;
      } else if (ev < 1.5 || r2 > 0.9) on = true;
      else {
        const z = Math.sqrt(1 - r2);
        const diff = Math.max(0, -0.48 * x - 0.58 * y + 0.66 * z);
        const spec = Math.pow(Math.max(0, -0.3 * x - 0.36 * y + 0.88 * z), 24) * 0.5;
        const mouth = mood === 'panic' ? (x * x) / 0.012 + ((y - 0.5) * (y - 0.5)) / 0.009 < 1 : mood === 'guilty' ? Math.abs(y - 0.5 + x * x * 1.6) < 0.035 && Math.abs(x) < 0.18 : Math.abs(y - 0.46 - x * x * 1.2) < 0.032 && Math.abs(x) < 0.15;
        const lum = mouth ? 0 : Math.min(1, 0.14 + diff * 0.8 + spec);
        on = lum < (B[(j % 8) * 8 + (i % 8)] + 0.5) / 64;
      }
      if (on !== invert) p += `M${i} ${j}h1v1h-1z`;
    }
    return p;
  }, [cells, mood, look[0], look[1], blink, invert]);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${cells} ${cells}`} shapeRendering="crispEdges" style={style}>
      <circle cx={cells / 2} cy={cells / 2} r={cells / 2 - 0.2} fill={bg} />
      <path d={d} fill={color} />
    </svg>
  );
};

export const OrbBadge: React.FC<{ size: number; ring: string; mood?: Mood; look?: [number, number]; style?: React.CSSProperties }> = ({ size, ring, mood, look, style }) => (
  <div style={{ width: size, height: size, borderRadius: '50%', border: `7px solid ${ring}`, background: '#fff', display: 'grid', placeItems: 'center', boxShadow: '0 18px 40px rgba(21,19,15,.10)', ...style }}>
    <Orb size={size - 44} mood={mood} look={look} />
  </div>
);
