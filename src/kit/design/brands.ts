import '@fontsource/lalezar/arabic-400.css';
import '@fontsource/lalezar/latin-400.css';
import '@fontsource/cairo/400.css';
import '@fontsource/cairo/700.css';
import '@fontsource/alexandria/300.css';
import '@fontsource/ibm-plex-sans-arabic/400.css';
import '@fontsource/zain/400.css';
import '@fontsource/zain/700.css';
import '@fontsource/zain/800.css';
import '@fontsource/italiana/400.css';
import '@fontsource/tajawal/500.css';
import '@fontsource/tajawal/700.css';
import '@fontsource/tajawal/800.css';
import '@fontsource/josefin-sans/400.css';
import '@fontsource/josefin-sans/600.css';
import '@fontsource/ibm-plex-sans-arabic/600.css';
import '@fontsource/ibm-plex-sans-arabic/700.css';
import '@fontsource/poppins/400.css';
import '@fontsource/poppins/500.css';
import '@fontsource/alexandria/400.css';
import '@fontsource/alexandria/600.css';
import '@fontsource/alexandria/900.css';
import '@fontsource/anton/400.css';
import type { Face, Palette } from './worlds';
import type { Grade } from '../fx';
import { toward } from './look';

/** A client brand: its own colours, faces, logos and contact line. A brand never invents
 *  a colour: every palette below is taken from the brand's own files (logo, brand pack, product design tokens). */
export type Brand = {
  name: string;
  palettes: Record<string, Palette>;     // the first is the default
  display?: Face & { lead?: number };   // headline face (else the field's)
  text?: Face & { bold: number };       // reading face (else the field's)
  latin?: Face & { upper?: boolean; track?: number };
  logo: { light: string; dark: string; h?: number; on?: Record<string, string> };   // logo for light and dark grounds (on: per palette); h in units
  contact?: string;                       // the contact line of the frame (hotline, site)
  footBar?: boolean;                     // the contact row sits on a strip of the palette's bar colour (pictures that fill the frame to its foot)
  footer?: string[];                      // a full contact strip (site, handle, phone, mail, licence) for offer posts
  footerArt?: { row: string; rowW: number; pay?: string; payW?: number };
  payments?: ('tamara' | 'tabby' | 'applepay' | 'googlepay' | 'visa' | 'mastercard' | 'mada')[];   // acceptance marks, drawn as vectors   // the brand's own strip artwork (white, keyed), widths in px at 1080
  pattern?: { src: string; size: number; opacity: number };   // the brand's background pattern, tiled
  priceInk?: string;                      // the colour prices are printed in
  digits?: 'western' | 'arabic';
  look?: Grade | 'palette';              // the brand's photo grade (kit/fx GRADE); 'palette': toned toward its own palette
  motif?: { kind: 'flower' | 'aegean' | 'waves'; ink: string; fill?: string; center?: string; tiles?: string[]; src?: string };   // the brand's own graphic device
  film?: FilmLook;                        // the brand on video (type and colour of the motion graphics over footage): fixed across the brand's films
};
/** How a brand's words look in its films. Same brand, same look, every film; the idea of each film is new. */
export type FilmLook = {
  display: string; text: string; latin: string;   // font families as CSS
  dWeight: number; tWeight: number; lWeight: number;
  accent: string; accent2: string; ink: string;    // accent block, second accent, ink on the accent
  latinUpper?: boolean; latinTrack?: number;
};

const f = (family: string, weight: number) => ({ family, weight });

export const BRANDS = {
  // A fictional brand, here only to show the shape. Add your own brands next to it: take every colour from the brand's
  // own files (logo, brand pack), never invent one.
  demo: {
    name: 'Demo Studio',
    palettes: {
      paper: { ground: '#f6f1e8', ground2: '#ebe3d4', ink: '#1d1a16', dim: '#6d655a', accent: '#c2410c', paper: '#1d1a16', bar: '#1d1a16', barInk: '#f6f1e8' },
      night: { ground: '#14110e', ground2: '#241f19', ink: '#f6f1e8', dim: '#b3a998', accent: '#f97316', paper: '#f6f1e8', bar: '#f97316', barInk: '#14110e' },
    },
    display: { ...f('Alexandria', 700), lead: 1.18 },
    text: { ...f('Alexandria', 400), bold: 600 },
    latin: { ...f('Anton', 400), upper: true, track: 0.12 },
    logo: { light: 'brands/demo/logo.png', dark: 'brands/demo/logo-ondark.png', h: 6 },
    contact: 'example.com',
    digits: 'western',
    film: { display: 'Alexandria, sans-serif', text: 'Alexandria, sans-serif', latin: 'Anton, sans-serif', dWeight: 700, tWeight: 400, lWeight: 400, accent: '#f97316', accent2: '#1d1a16', ink: '#ffffff' },
  },
} satisfies Record<string, Brand>;
export type BrandName = keyof typeof BRANDS;
