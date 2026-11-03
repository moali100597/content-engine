// Visual and layout QA for one composition.
//   node qa.mjs <CompositionId> 1.2 5.5 ...   -> half-size frames at those story seconds in out/qa/
//   node qa.mjs <CompositionId> check [step]  -> layout check every `step` story seconds (default 0.5); exits 1 if anything is reported
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition, openBrowser } from '@remotion/renderer';
import fs from 'node:fs';
const exe = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const [id, ...rest] = process.argv.slice(2);
const check = rest[0] === 'check';
const inputProps = { qa: check };
const serveUrl = await bundle({ entryPoint: 'src/index.ts' });
// each bundle is ~300 MB: it goes however the run ends: done, an error, Ctrl+C or a closed window
process.on('exit', () => { try { fs.rmSync(serveUrl, { recursive: true, force: true }); } catch {} });
for (const s of ['SIGINT', 'SIGHUP', 'SIGBREAK']) process.on(s, () => process.exit(130));
const chromiumOptions = { gl: 'swangle' };   // software GL, so 3D scenes (three.js) render the same on any machine
const browser = await openBrowser('chrome', { browserExecutable: fs.existsSync(exe) ? exe : undefined, chromiumOptions });
const composition = await selectComposition({ serveUrl, id, puppeteerInstance: browser, inputProps });
const frames = check
  ? Array.from({ length: Math.max(1, Math.floor(composition.durationInFrames / (composition.fps * Number(rest[1] ?? 0.5)))) }, (_, i) => Math.round(i * composition.fps * Number(rest[1] ?? 0.5)))
  : rest.map((s) => Math.round(Number(s) * composition.fps));
fs.mkdirSync('out/qa', { recursive: true });
const found = new Map();
const texts = [];   // TXT| lines: text runs with colour and box, for tools/contrast.py
for (const frame of frames) {
  await renderStill({ composition, serveUrl, frame, inputProps, output: check ? 'out/qa/_check.jpg' : `out/qa/${(frame / composition.fps).toFixed(2).padStart(6, '0')}.jpg`, imageFormat: 'jpeg', jpegQuality: 80, puppeteerInstance: browser, chromiumOptions, scale: check ? 0.1 : 0.5, logLevel: 'error', timeoutInMilliseconds: 180000,
    onBrowserLog: (l) => { if (l.text.startsWith('TXT|')) texts.push(l.text); if (l.text.startsWith('QA|')) { const [, t, , msg] = l.text.split('|'); const key = msg.replace(/ \((x )?-?\d.*\)$/, ''); if (!found.has(key)) found.set(key, t); } } });
}
await browser.close({ silent: true });
if (check && composition.durationInFrames === 1) {
  // a still: render it at full size and check the contrast of every text run against the pixels behind it
  const png = `out/qa/${id}.png`;
  const b2 = await openBrowser('chrome', { browserExecutable: fs.existsSync(exe) ? exe : undefined, chromiumOptions });
  await renderStill({ composition, serveUrl, frame: 0, inputProps: {}, output: png, puppeteerInstance: b2, chromiumOptions, logLevel: 'error' });
  await b2.close({ silent: true });
  fs.writeFileSync(`out/qa/${id}.txt`, texts.join('\n'));
  const { execFileSync } = await import('node:child_process');
  try { execFileSync('python3', ['tools/contrast.py', png, `out/qa/${id}.txt`], { stdio: 'pipe' }); }
  catch (e) { for (const l of String(e.stdout).trim().split('\n')) if (l) found.set(l, '0.00'); }
}
if (check) {
  for (const [msg, t] of found) console.log(`${t}s  ${msg}`);
  console.log(found.size ? `QA: ${found.size} problem(s)` : `QA: clean (${frames.length} frames checked)`);
  process.exit(found.size ? 1 : 0);
}
console.log('done', frames.length);
