import React from 'react';
import { AbsoluteFill } from 'remotion';
import { useBrand } from './brand';
import { font, grey, ink, Tone } from './theme';

export const Hud: React.FC<{ n: string; name: string; day: string; color?: string }> = ({ n, name, day, color = grey }) => (
  <div style={{ position: 'absolute', top: 22, left: 44, right: 44, display: 'flex', justifyContent: 'space-between', fontFamily: font.mono, fontSize: 19, letterSpacing: 0.5, color, direction: 'ltr' }}>
    <span>{day}</span>
    <span>// {n} — {name}</span>
  </div>
);

export const Caption: React.FC<{ parts: (string | [string])[]; accent: string; color?: string }> = ({ parts, accent, color = ink }) => (
  <div style={{ position: 'absolute', left: 0, right: 0, bottom: 44, textAlign: 'center', direction: 'rtl', fontFamily: font.sans, fontWeight: 600, fontSize: 46, lineHeight: 1.3, color }}>
    {parts.map((p, i) => (typeof p === 'string' ? <span key={i}>{p}</span> : <span key={i} style={{ color: accent }}>{p[0]}</span>))}
  </div>
);

// Chapter frame: pastel margin, tinted copy panel (right, Arabic reads first), white stage (left).
export const Chapter: React.FC<{ tone: Tone; copy: React.ReactNode; stage: React.ReactNode; hud: React.ReactNode; caption: React.ReactNode }> = ({ tone, copy, stage, hud, caption }) => (
  <AbsoluteFill style={{ background: tone.outer }}>
    <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(21,19,15,.10) 1.2px, transparent 1.3px)', backgroundSize: '26px 26px' }} />
    {hud}
    <div style={{ position: 'absolute', top: 64, left: 36, right: 36, bottom: 150, borderRadius: 44, overflow: 'hidden', display: 'flex', direction: 'ltr', boxShadow: '0 30px 80px rgba(21,19,15,.10)' }}>
      <div style={{ flex: '0 0 59%', background: '#fff', position: 'relative' }}>{stage}</div>
      <div style={{ flex: 1, background: tone.panel, position: 'relative', direction: 'rtl' }}>{copy}</div>
    </div>
    {caption}
  </AbsoluteFill>
);

export const Eyebrow: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color }) => {
  const B = useBrand();
  return <div style={{ fontFamily: B.font.mono, fontSize: 22, color: color ?? B.grey, direction: 'ltr', textAlign: 'right', letterSpacing: 0.5 }}>{children}</div>;
};

export const Window: React.FC<{ title: string; right?: React.ReactNode; children: React.ReactNode; style?: React.CSSProperties; dark?: boolean }> = ({ title, right, children, style, dark }) => {
  const B = useBrand();
  const c = dark ? { line: B.dark.line, card: B.dark.card, chrome: B.dark.chrome, text: '#9C968A' } : { line: B.line, card: B.card, chrome: B.chrome, text: B.grey };
  return (
    <div style={{ borderRadius: 22, border: `1.5px solid ${c.line}`, background: c.card, overflow: 'hidden', display: 'flex', flexDirection: 'column', direction: 'ltr', ...style }}>
      <div style={{ height: 54, display: 'flex', alignItems: 'center', gap: 9, padding: '0 20px', borderBottom: `1.5px solid ${c.line}`, fontFamily: B.font.mono, fontSize: 21, color: c.text }}>
        {[0, 1, 2].map((i) => <span key={i} style={{ width: 11, height: 11, borderRadius: 6, background: c.chrome }} />)}
        <span style={{ marginLeft: 12 }}>{title}</span>
        <span style={{ marginLeft: 'auto' }}>{right}</span>
      </div>
      <div style={{ flex: 1, position: 'relative' }}>{children}</div>
    </div>
  );
};

export const Chip: React.FC<{ children: React.ReactNode; color: string; solid?: boolean; style?: React.CSSProperties }> = ({ children, color, solid, style }) => {
  const B = useBrand();
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: B.font.mono, fontWeight: 700, fontSize: 19, letterSpacing: 1, padding: '6px 14px', borderRadius: 99, border: `2px solid ${color}`, color: solid ? '#fff' : color, background: solid ? color : 'transparent', ...style }}>{children}</span>;
};

export const Lock: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M7 10V7.5a5 5 0 0 1 10 0V10" stroke={color} strokeWidth="2.4" strokeLinecap="round" /><rect x="4.5" y="10" width="15" height="11" rx="3" fill={color} /></svg>
);
