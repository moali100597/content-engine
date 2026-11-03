// The worlds (art directions) of docs/design-system.md, section 2, as data.
// A world fixes the colour story, the type voice, the texture and the frame; a palette is one colour variant inside it.
import '@fontsource/alexandria/400.css';
import '@fontsource/alexandria/500.css';
import '@fontsource/alexandria/600.css';
import '@fontsource/alexandria/800.css';
import '@fontsource/alexandria/900.css';
import '@fontsource/readex-pro/400.css';
import '@fontsource/readex-pro/500.css';
import '@fontsource/readex-pro/700.css';
import '@fontsource/ibm-plex-sans-arabic/400.css';
import '@fontsource/ibm-plex-sans-arabic/500.css';
import '@fontsource/ibm-plex-sans-arabic/700.css';
import '@fontsource/badeen-display/400.css';
import '@fontsource/blaka/400.css';
import '@fontsource/baloo-bhaijaan-2/500.css';
import '@fontsource/baloo-bhaijaan-2/800.css';
import '@fontsource/lemonada/700.css';
import '@fontsource/marhey/700.css';
import '@fontsource/aref-ruqaa-ink/700.css';
import '@fontsource/reem-kufi/400.css';
import '@fontsource/reem-kufi/700.css';
import '@fontsource/markazi-text/400.css';
import '@fontsource/markazi-text/600.css';
import '@fontsource/rubik/900.css';
import '@fontsource/geist/500.css';
import '@fontsource/geist/700.css';
import '@fontsource/geist-mono/500.css';
import '@fontsource/archivo-black/400.css';
import '@fontsource/anton/400.css';
import '@fontsource/fraunces/400.css';
import '@fontsource/fraunces/700.css';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/jetbrains-mono/500.css';
// lettering faces (docs/fonts.md): heavy display cuts used by Lockup lines
import '@fontsource/kufam/900.css';
import '@fontsource/noto-kufi-arabic/900.css';
import '@fontsource/alyamama/300.css';
import '@fontsource/alyamama/900.css';
import '@fontsource/cairo/900.css';
import '@fontsource/lemonada/600.css';
import '@fontsource/baloo-bhaijaan-2/700.css';
import '@fontsource/aref-ruqaa-ink/400.css';
import '@fontsource/rakkas/400.css';
import '@fontsource/lalezar/400.css';
import '@fontsource/reem-kufi-fun/700.css';
import '@fontsource/alexandria/700.css';
import '@fontsource/readex-pro/600.css';
import './fontshare';
import './fontlib';

export type Palette = {
  ground: string;     // the background
  ground2?: string;   // a second ground: the light behind the subject, or the alternate post of a feed
  ink: string;        // main text
  dim: string;        // secondary text
  accent: string;     // the one accent: 1 to 3 words, devices
  accent2?: string;   // only inside stickers and micro Latin (street), or a second series colour (editorial)
  paper?: string;     // paper tags, label strips, cards
  bar?: string;       // highlight bar fill (defaults to ink)
  barInk?: string;    // text on the highlight bar (defaults to ground)
};
export type Face = { family: string; weight: number; space?: number };   // space: word spacing in em inside lettering (faces with narrow spaces need less closing)
export type FrameKind = 'rails' | 'corners' | 'badge' | 'none';
export type World = {
  name: string;
  palettes: Record<string, Palette>;
  display: Face & { lead: number };          // headlines
  text: Face & { bold: number };             // body, labels, stats
  hand?: Face;                               // one inserted word in another voice (_word_ in the markup)
  latin: Face & { upper?: boolean; track?: number };   // Latin words ({word} in the markup)
  mono?: Face;                               // meta lines of the frame
  grain: number;                             // film grain opacity
  frame: FrameKind;
  digits: 'western' | 'arabic';
  radius: number;                            // corner radius of pills and cards, in units (1% of the short side)
  fx?: 'sticker';                            // headline lettering with an outline and a hard shadow (folk brush lettering)
  texture?: { src: string; blend: 'screen' | 'multiply' | 'overlay' | 'soft-light'; opacity: number };   // scanned surface over the frame (public/textures)
};

const f = (family: string, weight: number) => ({ family, weight });

export const WORLDS = {
  documentary: {
    name: 'documentary',
    palettes: {
      sepia: { ground: '#1b140e', ground2: '#3b2a19', ink: '#f4e8cf', dim: '#bba586', accent: '#f0b552', paper: '#e9dcc0' },
      acid: { ground: '#131517', ground2: '#2c3034', ink: '#f2f3ef', dim: '#9aa19b', accent: '#c6f03a', paper: '#e8e8e2' },
      steel: { ground: '#0d141d', ground2: '#22313f', ink: '#eef3f7', dim: '#97a6b4', accent: '#ffd23f', paper: '#e6ebef' },
      ember: { ground: '#190c07', ground2: '#4a1f0e', ink: '#fbeee2', dim: '#c9a58c', accent: '#ff8a3d', paper: '#f2e2d0' },
    },
    display: { ...f('Readex Pro', 700), lead: 1.12 },
    text: { ...f('IBM Plex Sans Arabic', 400), bold: 700 },
    hand: f('Aref Ruqaa Ink', 700),
    latin: { ...f('Zodiak', 700), upper: true, track: 0.02 },
    mono: f('JetBrains Mono', 500),
    grain: 0.08, frame: 'rails', digits: 'western', radius: 0.6, texture: { src: 'textures/overlay/dust-black.jpg', blend: 'screen', opacity: 0.35 },
  },
  newsroom: {
    name: 'newsroom',
    palettes: {
      night: { ground: '#0a0f1e', ground2: '#1d2a4d', ink: '#ffffff', dim: '#aab4c8', accent: '#e5202e', paper: '#ffffff', bar: '#ffffff', barInk: '#0a0f1e' },
    },
    display: { ...f('Alexandria', 900), lead: 1.06 },
    text: { ...f('Alexandria', 500), bold: 800 },
    latin: { ...f('Clash Grotesk', 700), upper: true },
    grain: 0.06, frame: 'badge', digits: 'western', radius: 0.3,
  },
  street: {
    name: 'street',
    palettes: {
      magenta: { ground: '#ee2a80', ink: '#0b0b0b', dim: '#2a0616', accent: '#ffffff', accent2: '#ffd23f', paper: '#f4f1ea' },
      orange: { ground: '#ff5a1f', ink: '#0d0d0d', dim: '#5a1d05', accent: '#ffffff', accent2: '#0d0d0d', paper: '#f4f1ea' },
      black: { ground: '#0d0d0d', ink: '#f4f1ea', dim: '#8a8680', accent: '#ff5a1f', accent2: '#ffd23f', paper: '#f4f1ea' },
    },
    display: { ...f('Badeen Display', 400), lead: 1.0 },
    text: { ...f('Readex Pro', 500), bold: 700 },
    hand: f('Marhey', 700),
    latin: { ...f('Clash Display', 700), upper: true },
    mono: f('Geist Mono', 500),
    grain: 0.06, frame: 'corners', digits: 'western', radius: 0.4, texture: { src: 'textures/overlay/plastic-wrap-overlay.jpg', blend: 'screen', opacity: 0.45 },
  },
  tech: {
    name: 'tech',
    palettes: {
      green: { ground: '#050908', ground2: '#0f2a1f', ink: '#f2f5f3', dim: '#7f8c86', accent: '#5ee37a', paper: '#e8f1ec' },
      blue: { ground: '#04060c', ground2: '#0f1c3c', ink: '#f2f5fb', dim: '#7f8aa3', accent: '#5aa9ff', paper: '#e9eef7' },
    },
    display: { ...f('Alexandria', 600), lead: 1.18 },
    text: { ...f('Alexandria', 400), bold: 600 },
    latin: { ...f('Satoshi', 700) },
    mono: f('Geist Mono', 500),
    grain: 0.05, frame: 'rails', digits: 'western', radius: 2.2,
  },
  pop: {
    name: 'pop',
    palettes: {
      navy: { ground: '#14244a', ground2: '#25427a', ink: '#ffffff', dim: '#bccae8', accent: '#ffc928', paper: '#ffc928', bar: '#ffc928', barInk: '#14244a' },
      yellow: { ground: '#ffc928', ground2: '#ffe07a', ink: '#14244a', dim: '#5d4b12', accent: '#14244a', paper: '#14244a', bar: '#14244a', barInk: '#ffc928' },
      peach: { ground: '#f4a77f', ground2: '#ffd3ba', ink: '#ffffff', dim: '#7a3e22', accent: '#1f7f86', paper: '#ffffff', bar: '#1f7f86', barInk: '#ffffff' },
    },
    display: { ...f('Baloo Bhaijaan 2', 800), lead: 1.12 },
    text: { ...f('Baloo Bhaijaan 2', 500), bold: 800 },
    hand: f('Lemonada', 700),
    latin: { ...f('Cabinet Grotesk', 800) },
    grain: 0.05, frame: 'badge', digits: 'western', radius: 3,
  },
  folk: {
    name: 'folk',
    palettes: {
      green: { ground: '#0f4a2c', ground2: '#1b6b42', ink: '#fff6e6', dim: '#cfe0c9', accent: '#c8281d', accent2: '#f2b632', paper: '#f6e7c4' },
      red: { ground: '#a81f19', ground2: '#cf3a2b', ink: '#fff6e6', dim: '#f2cbb8', accent: '#0f4a2c', accent2: '#f2b632', paper: '#f6e7c4' },
    },
    display: { ...f('Aref Ruqaa Ink', 700), lead: 1.2 },
    text: { ...f('Readex Pro', 500), bold: 700 },
    latin: { ...f('Gambetta', 700) },
    grain: 0.06, frame: 'badge', digits: 'arabic', radius: 1, fx: 'sticker', texture: { src: 'textures/paper/paper-warm.jpg', blend: 'multiply', opacity: 0.18 },
  },
  luxury: {
    name: 'luxury',
    palettes: {
      wine: { ground: '#360b12', ground2: '#5a1420', ink: '#f4e7d7', dim: '#c3a293', accent: '#d8b47a', paper: '#f4e7d7' },
      olive: { ground: '#1f2117', ground2: '#3a3c25', ink: '#efe6d2', dim: '#aaa58c', accent: '#c9a45c', paper: '#efe6d2' },
      cream: { ground: '#efe6d8', ground2: '#f8f2e8', ink: '#360b12', dim: '#7d6556', accent: '#8a5a2b', paper: '#360b12' },
    },
    display: { ...f('Reem Kufi', 400), lead: 1.25 },
    text: { ...f('Markazi Text', 400), bold: 600 },
    latin: { ...f('Sentient', 300), upper: true, track: 0.38 },
    grain: 0.08, frame: 'corners', digits: 'arabic', radius: 0, texture: { src: 'textures/overlay/dust-black.jpg', blend: 'screen', opacity: 0.25 },
  },
  editorial: {
    name: 'editorial',
    palettes: {
      paper: { ground: '#f3efe6', ink: '#121212', dim: '#5d5a55', accent: '#ef4b2f', accent2: '#2f5bea', paper: '#ffffff', bar: '#121212', barInk: '#f3efe6' },
      black: { ground: '#0e0e0e', ground2: '#1b1b1b', ink: '#f3efe6', dim: '#8d8a84', accent: '#ef4b2f', accent2: '#2f5bea', paper: '#f3efe6', bar: '#f3efe6', barInk: '#0e0e0e' },
    },
    display: { ...f('IBM Plex Sans Arabic', 700), lead: 1.32 },
    text: { ...f('IBM Plex Sans Arabic', 400), bold: 700 },
    latin: { ...f('Zodiak', 700) },
    mono: f('JetBrains Mono', 500),
    grain: 0.05, frame: 'rails', digits: 'western', radius: 1.6,
  },
} satisfies Record<string, World>;
export type WorldName = keyof typeof WORLDS;

/** Every family and weight a world uses, for the font gate. */
export const worldFaces = (w: World): Face[] => [w.display, w.text, { family: w.text.family, weight: w.text.bold }, w.hand, w.latin, w.mono].filter(Boolean) as Face[];

/** Western digits to Arabic-Indic, for worlds that use them. */
export const digits = (s: string, w: World) => w.digits === 'arabic' ? s.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[+d]) : s;


const hex6 = (c: string) => { const n = parseInt(c.slice(1, 7), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255); };
/** WCAG contrast of two hex colours, and the readable ink for a fill: the palette's ink or ground if one reaches 4.5:1, else near black or white. */
const rl = (c: string) => hex6(c).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
export const contrast = (a: string, b: string) => { const x = rl(a), y = rl(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
export const inkOn = (fill: string, pal: Palette) => [pal.ink, pal.ground, '#111111', '#ffffff'].find((c) => /^#/.test(c) && contrast(c, fill) >= 4.5) ?? '#111111';
