import React from 'react';

/** The official Saudi Riyal sign (SAMA, 2025), drawn from its published SVG paths. Sized by height, inked by `color`. */
export const RiyalSign: React.FC<{ h: number; color: string; style?: React.CSSProperties }> = ({ h, color, style }) => (
  <svg viewBox="0 0 1124.14 1256.39" height={h} width={(h * 1124.14) / 1256.39} style={{ display: 'block', flex: 'none', ...style }} aria-label="SAR">
    <g fill={color}>
      <path d="M699.62,1113.02h0c-20.06,44.48-33.32,92.75-38.4,143.37l424.51-90.24c20.06-44.47,33.31-92.75,38.4-143.37l-424.51,90.24Z" />
      <path d="M1085.73,895.8c20.06-44.47,33.32-92.75,38.4-143.37l-330.68,70.33v-135.2l292.27-62.11c20.06-44.47,33.32-92.75,38.4-143.37l-330.68,70.27V66.13c-50.67,28.45-95.67,66.32-132.25,110.99v403.35l-132.25,28.11V0c-50.67,28.44-95.67,66.32-132.25,110.99v525.69l-295.91,62.88c-20.06,44.47-33.33,92.75-38.42,143.37l334.33-71.05v170.26l-358.3,76.14c-20.06,44.47-33.32,92.75-38.4,143.37l375.04-79.7c30.53-6.35,56.77-24.4,73.83-49.24l68.78-101.97v-.02c7.14-10.55,11.3-23.27,11.3-36.97v-149.98l132.25-28.11v270.4l424.53-90.28Z" />
    </g>
  </svg>
);

/** The currency mark for a price: the Riyal sign for SAR, the word for EGP. */
export const Currency: React.FC<{ code?: 'SAR' | 'EGP'; h: number; color: string; font: string; weight: number }> = ({ code = 'SAR', h, color, font, weight }) =>
  code === 'SAR'
    ? <RiyalSign h={h} color={color} />
    : <span style={{ fontFamily: `"${font}"`, fontWeight: weight, fontSize: h * 0.9, color, lineHeight: 1 }}>ج.م</span>;
