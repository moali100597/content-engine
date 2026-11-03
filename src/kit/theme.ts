import { personal } from './brand';

export const W = 1920;
export const H = 1080;
// Shortcuts to the personal brand, for stages written for it. Kit components read the active brand from context instead (brand.tsx).
export const { ink, paper, grey, line, font } = personal;
export type Tone = { outer: string; panel: string; accent: string };
export const tones = {
  blue: { outer: '#D5E1FA', panel: '#E9EFFC', accent: '#2457E6' },
  ice: { outer: '#CBE7EC', panel: '#E4F3F5', accent: '#0B8499' },
  red: { outer: '#F5D3CD', panel: '#FBE8E4', accent: '#D8362A' },
  amber: { outer: '#F2E1BC', panel: '#FAF0DA', accent: '#B56A00' },
  green: { outer: '#D2E7D5', panel: '#E7F2E9', accent: '#1F8A4C' },
} satisfies Record<string, Tone>;
