// Render a list of frames of one composition as PNGs (bundle once, one browser): quick visual checks without a full render.
//   node tools/stills.mjs HelloReel916 out/check 0.5 15 36 75 ...
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition, openBrowser } from '@remotion/renderer';
import path from 'node:path';
import fs from 'node:fs';
const [id, dir, scale, ...frames] = process.argv.slice(2);
fs.mkdirSync(dir, { recursive: true });
const serveUrl = await bundle({ entryPoint: path.resolve('src/index.ts') });
const chromiumOptions = { gl: process.env.GL ?? 'swangle' };   // GL=angle tries the graphics card
const local = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const browserExecutable = process.env.CHROME ?? (fs.existsSync(local) ? local : null);
const browser = await openBrowser('chrome', { chromiumOptions, browserExecutable });
const composition = await selectComposition({ serveUrl, id, puppeteerInstance: browser, browserExecutable });
for (const f of frames.map(Number)) {
  const t0 = Date.now();
  await renderStill({ composition, serveUrl, frame: f, output: path.join(dir, `k${String(f).padStart(4, '0')}.png`), scale: Number(scale), puppeteerInstance: browser, chromiumOptions, timeoutInMilliseconds: 300000 });
  console.log(`frame ${f} ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}
await browser.close({ silent: true });
fs.rmSync(serveUrl, { recursive: true, force: true });
