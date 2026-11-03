import '@fontsource/alexandria/arabic-400.css';
import '@fontsource/alexandria/arabic-500.css';
import '@fontsource/alexandria/arabic-600.css';
import '@fontsource/alexandria/arabic-700.css';
import '@fontsource/alexandria/arabic-800.css';
import '@fontsource/alexandria/latin-500.css';
import '@fontsource/alexandria/latin-700.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-700.css';
import '@fontsource/readex-pro/arabic-700.css';
import '@fontsource/aref-ruqaa/arabic-400.css';
import '@fontsource/aref-ruqaa/arabic-700.css';
import '@fontsource/amiri/arabic-400-italic.css';
import '@fontsource/amiri/arabic-700-italic.css';
import '@fontsource/amiri/arabic-700.css';
import '@fontsource/noto-naskh-arabic/arabic-700.css';
import '@fontsource/reem-kufi/arabic-700.css';
import '@fontsource/rakkas/arabic-400.css';
import '@fontsource/lalezar/arabic-400.css';
import '@fontsource/gulzar/arabic-400.css';
import '@fontsource/instrument-serif/latin-400-italic.css';
import '@fontsource/instrument-serif/latin-400.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-500.css';
import '@fontsource/jetbrains-mono/latin-700.css';

import React from 'react';
import { continueRender, delayRender } from 'remotion';
import type { Brand } from './brand';

/** Hold the frame until the brand's fonts are really loaded. Without this a frame can be laid out with a fallback font,
 *  and anything that measures text (the headline auto-fit, the layout check) gets a wrong size for that frame. */
export const useFonts = (brand: Brand) => {
  const [ready, setReady] = React.useState(false);
  const [handle] = React.useState(() => delayRender('fonts'));
  React.useEffect(() => {
    const sample = 'حداشر مرة NOIR 1,206';
    const loads = Object.values(brand.font).flatMap((family) => [400, 500, 600, 700, 800].flatMap((w) => [`${w} 40px ${family}`, `italic ${w} 40px ${family}`])).map((f) => document.fonts.load(f, sample).catch(() => []));
    Promise.race([Promise.all(loads), new Promise((r) => setTimeout(r, 8000))]).then(() => { setReady(true); continueRender(handle); });
  }, [brand, handle]);
  return ready;
};


/** Hold the frame until these exact faces are loaded: for a video that sets its own headline faces (a Lockup, a world). */
export const useFaces = (faces: { family: string; weight: number; italic?: boolean }[]) => {
  const [ready, setReady] = React.useState(false);
  // a slow tab (three render tabs sharing one graphics card) must wait for its fonts, never draw with a fallback: text drawn
  // into a 3D texture is cached for the whole tab, so one early frame decided every later one (video 4, 2026-10-16)
  const [handle] = React.useState(() => delayRender('faces', { timeoutInMilliseconds: 120000 }));
  const key = faces.map((f) => `${f.italic ? 'italic ' : ''}${f.weight} ${f.family}`).join('|');
  React.useEffect(() => {
    const spec = (f: { family: string; weight: number; italic?: boolean }) => `${f.italic ? 'italic ' : ''}${f.weight} 40px "${f.family}"`;
    const sample = 'الذكاء Aa 123';
    const all = () => Promise.all(faces.map((f) => document.fonts.load(spec(f), sample).catch(() => [])));
    (async () => {
      for (let k = 0; k < 40; k++) {                    // up to ~100 s; each pass waits for every face again
        await all(); await document.fonts.ready;
        if (faces.every((f) => document.fonts.check(spec(f), sample))) break;
        await new Promise((r) => setTimeout(r, 2500));
      }
      setReady(true); continueRender(handle);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, handle]);
  return ready;
};
