// Fontshare families (Indian Type Foundry, ITF Free Font License 2.0: free for commercial use, including video and social;
// the files must not be redistributed to third parties). Self-hosted from public/fonts/fontshare, registered on load;
// the browser fetches a file only when a frame uses it. List: fontshare.json (built from the downloaded zips).
import { staticFile } from 'remotion';
import list from './fontshare.json';

if (typeof document !== 'undefined') {
  for (const f of list as { family: string; weight: number; style: string; file: string }[]) {
    document.fonts.add(new FontFace(f.family, `url(${staticFile(f.file)}) format('woff2')`, { weight: String(f.weight), style: f.style }));
  }
}
export const FONTSHARE = [...new Set((list as { family: string }[]).map((f) => f.family))];
