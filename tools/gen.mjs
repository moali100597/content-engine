// Images, video and voice-over with Google models on Vertex AI. No API keys: it uses the gcloud login on this computer
// (run setup-google.cmd once) and bills the Google Cloud project, so it draws on that project's credit.
//
//   node tools/gen.mjs image "<prompt>" [--pro] [--ref a.png --ref b.png] [--ratio 16:9] [--size 2K] [--out gen/name.png]
//   node tools/gen.mjs edit  "<what to change>" --ref input.png [--pro] [--out gen/name.png]
//   node tools/gen.mjs video "<prompt>"                                              text to video
//   node tools/gen.mjs video "<how it moves>" --frame shot.png                       animate this exact picture
//   node tools/gen.mjs video "<how it moves>" --frame start.png --last end.png       from an opening frame to a closing frame
//   node tools/gen.mjs video "<scene with <IMAGE_REF_0>>" --ref product.png          put a product or person (one or more --ref) inside a new scene
//   node tools/gen.mjs edit  "<what to change>" --ref input.mp4                      video to video (input 10 s or shorter)
//   node tools/gen.mjs voice vo/<script>.txt [--voice Puck] [--style "<how to say it>"] [--out vo/name.wav]
//   node tools/gen.mjs music "<prompt>" [--clip] [--out music/name.mp3]                 Lyria 3 Pro, up to 184 s (--clip: Lyria 3 Clip, 30 s)
//   node tools/gen.mjs batch <jobs.json>                                             many jobs in one go; run it again to continue after a failure
//
//   video options   --ratio 16:9|9:16   --res 360p|720p|1080p|4k
//   any job         --n 3      three takes (name-1, name-2, name-3)
//                   --seed 7   images only: same prompt and seed gives the same picture again
//                   --for <video name>   noted in the log, so every asset can be traced to its video
//
// A character who speaks (the take carries the line, lip-synced): give "line" instead of "input" and the prompt is written from the
// template that held over the g80 takes (2026-10-09): locked-off camera, the line said once, a silent action until the end of the
// 10 s take (a short line otherwise gets repeated to fill it), the dialect locked by naming what it must not be:
//   {"kind": "video", "frame": "gen/x/s1.png", "line": "إحنا جيل التمانينات", "dialect": "eg", "action": "She folds her hands",
//    "after": "she smiles and nods slowly", "look": "the same stylized 3D animated look", "who": "She", "out": "gen/x/s1.mp4"}
// Write the line the way it is said (اتحملنا, not تحملنا); never add a Latin transliteration: it pulled a Gulf accent and
// one triggered a safety refusal.
// A batch file is a JSON list of jobs, or {"for": "<video>", "jobs": [...]}. A job has the same fields as the command line:
//   {"kind": "image", "input": "<prompt>", "out": "gen/ad/shot1.png", "ratio": "9:16", "pro": true, "ref": ["assets/product.png"]}
// Jobs whose output file already exists are skipped (add "force": true to redo one).
//
// Models (ids read from the Vertex Model Garden of this project on 2026-10-07):
//   image          gemini-3.1-flash-image          Nano Banana 2
//   image --pro    gemini-3-pro-image              Nano Banana Pro
//   video          gemini-omni-1.1-flash-preview   Omni Flash 1.1   (Interactions API)
//   voice          gemini-3.1-flash-tts-preview    through the Cloud Text-to-Speech API, Egyptian Arabic
//   music          lyria-3-pro-preview             Lyria 3 Pro (Interactions API, global only; generateContent answers 400 for Lyria on Vertex)
//   music --clip   lyria-3-clip-preview            Lyria 3 Clip, 30 s
//
// Every result is saved with a .json beside it, and every attempt, good or bad, is one line in gen/log.jsonl.
// When something fails the tool says which kind of failure it is:
//   login     the Google login on this computer is missing or expired        -> run setup-google.cmd
//   blocked   Google's safety filter refused the prompt or the result        -> reword; not billed for a refused prompt
//   rejected  the request itself is wrong (a setting, a file type, a size)    -> details in the .error.json; not billed
//   quota     too many requests or the project ran out of quota              -> retried 3 times, then stops
//   server    Google had an error or timed out                               -> retried 3 times, then stops
//   empty     the call worked but no picture / clip came back                -> the model's own words are shown
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rel = (p) => path.relative(root, p).replace(/\\/g, '/');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const env = fs.existsSync(path.join(root, '.env')) ? fs.readFileSync(path.join(root, '.env'), 'utf8') : '';
const project = process.env.GOOGLE_CLOUD_PROJECT || (env.match(/^GOOGLE_CLOUD_PROJECT=(.+)$/m) || [])[1]?.trim();

class GenError extends Error { constructor(code, message, detail) { super(message); this.code = code; this.detail = detail; } }

let token;
const login = () => {
  try { token = execSync('gcloud auth application-default print-access-token', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
  catch { throw new GenError('login', 'No Google login on this computer. Run setup-google.cmd once, then try again.'); }
};

/** POST with the things that go wrong on the way: expired login (refreshed once), quota and server errors (3 tries, growing waits). */
const post = async (url, body, note) => {
  const waits = [5, 20, 45];
  for (let attempt = 0, relogged = false; ; attempt++) {
    const t0 = Date.now();
    const tick = setInterval(() => process.stdout.write(`\r  ${note} ${Math.round((Date.now() - t0) / 1000)} s `), 1000);
    let res, json, netError;
    try {
      res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'x-goog-user-project': project, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      json = await res.json().catch(() => ({}));
    } catch (e) { netError = e; }
    clearInterval(tick); process.stdout.write('\r' + ' '.repeat(note.length + 16) + '\r');
    if (res?.ok) return json;
    const status = res?.status ?? 0;
    const message = json?.error?.message || netError?.message || `HTTP ${status}`;
    if (status === 401 && !relogged) { relogged = true; login(); attempt--; continue; }
    if (status === 401 || status === 403) throw new GenError('login', `Google refused the login or the project (${status}): ${message}`, json);
    if (status === 400 || status === 404 || status === 413) throw new GenError(/safety|blocked|prohibited|policy/i.test(message) ? 'blocked' : 'rejected', message, json);
    const kind = status === 429 ? 'quota' : 'server';
    if (attempt >= waits.length) throw new GenError(kind, `${message} (gave up after ${attempt + 1} tries)`, json);
    const wait = Number(res?.headers.get('retry-after')) || waits[attempt];
    console.log(`  ${kind === 'quota' ? 'Google is rate-limiting' : netError ? 'no connection' : 'Google error ' + status}, trying again in ${wait} s`);
    await sleep(wait * 1000);
  }
};

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.mp4': 'video/mp4' };
const media = (file) => {
  const full = path.resolve(root, file);
  if (!fs.existsSync(full)) throw new GenError('rejected', `File not found: ${file}`);
  const mime = MIME[path.extname(file).toLowerCase()];
  if (!mime) throw new GenError('rejected', `Unsupported file type: ${file} (use png, jpg, webp or mp4)`);
  return { mime, data: fs.readFileSync(full).toString('base64') };
};
const isVideo = (job) => job.kind === 'video' || (job.kind === 'edit' && (job.ref || []).some((f) => /\.mp4$/i.test(f)));

const DIALECT = {
  eg: 'a native Cairo Egyptian accent, like an Egyptian TV drama actor (Egyptian colloquial Arabic only: not Gulf, not Khaleeji, not Levantine, not Modern Standard Arabic)',
  sa: 'a native Saudi accent (Saudi colloquial Arabic only: not Egyptian, not Levantine, not Modern Standard Arabic)',
};
/** The prompt of a speaking take, from its fields (see the top of this file). */
const speakingPrompt = (job) => {
  if (/[A-Za-z]/.test(job.line)) throw new GenError('rejected', `The line has Latin letters: write it in Arabic only, as it is said (${job.line})`);
  const who = job.who || 'The person', dialect = DIALECT[job.dialect || 'eg'];
  if (!dialect) throw new GenError('rejected', `Unknown dialect "${job.dialect}" (eg or sa)`);
  return [`Animate this image into one continuous, realistic, smooth shot${job.look ? ` in ${job.look}` : ''}.`,
    'Keep the face, clothes, the setting and the lighting exactly as in the image.',
    `Camera: ${job.camera || 'static, locked off'}. No cuts.`,
    job.action ? `Action: ${job.action.replace(/\.?$/, '.')}` : '',
    `${who} looks at the camera and says in ${dialect}, once, with natural lip-sync and a ${job.tone || 'warm, sincere'} voice: "${job.line}"`,
    `${who} says this line only one time. Nothing more is said after it: ${job.after || 'a gentle smile, holding still'}, completely silent until the end of the shot.`,
    'Natural ambient sound only, no music, no subtitles, no text.'].filter(Boolean).join(' ');
};

/** One request to the right model. Returns { bytes, meta }. */
const generate = async (job) => {
  const refs = job.ref || [];
  if (job.kind === 'voice') {
    // The voice model drifts in a long request: measured on a 173 s take, it stayed clear for about 75 s, then lost its highs steadily (20 dB down by the end).
    // So the script is sent in parts of about 50 s (1100 bytes), split on blank lines, and the audio is joined with a short breath between parts.
    // (Cloud Text-to-Speech also refuses more than 4000 bytes in one request.)
    const model = job.model || 'gemini-3.1-flash-tts-preview', voice = job.voice || 'Puck';
    // a job's style may add the film's English words by name
    const style = job.style || "Egyptian Arabic, Cairo dialect. A young man telling a true, gripping story to a friend, energetic and engaged, quick and clear, with short pauses before the punchlines and at every '...'. Full, confident speaking voice at a normal conversational volume, never whispering. The English words are said the way a young Egyptian who works in tech says them: clear and natural, then straight back into Egyptian Arabic without changing voice or pace. Read numbers as people say them. Natural everyday pronunciation, never formal Modern Standard Arabic.";
    const full = path.resolve(root, job.input);
    if (!fs.existsSync(full)) throw new GenError('rejected', `File not found: ${job.input}`);
    const chunks = [];
    for (const p of fs.readFileSync(full, 'utf8').trim().split(/\n\s*\n/)) {
      const last = chunks[chunks.length - 1];
      if (last && Buffer.byteLength(last + '\n\n' + p) < (Number(job.part) || 1100)) chunks[chunks.length - 1] = last + '\n\n' + p; else chunks.push(p);
    }
    if (!chunks[0]) throw new GenError('rejected', `The script is empty: ${job.input}`);
    const pcm = [];
    for (const [i, text] of chunks.entries()) {
      const r = await post('https://texttospeech.googleapis.com/v1/text:synthesize', { input: { text, prompt: style }, voice: { languageCode: job.lang || 'ar-EG', name: voice, model_name: model }, audioConfig: { audioEncoding: 'LINEAR16', sampleRateHertz: 44100 } }, `voice ${i + 1}/${chunks.length}`);
      if (!r.audioContent) throw new GenError('empty', 'No audio came back', r);
      const wav = Buffer.from(r.audioContent, 'base64');
      if (i) pcm.push(Buffer.alloc(Math.round(44100 * 0.28) * 2));   // a breath between parts
      pcm.push(wav.subarray(wav.indexOf('data') + 8));
    }
    const data = Buffer.concat(pcm), head = Buffer.alloc(44);
    head.write('RIFF', 0); head.writeUInt32LE(36 + data.length, 4); head.write('WAVEfmt ', 8); head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(1, 22);
    head.writeUInt32LE(44100, 24); head.writeUInt32LE(88200, 28); head.writeUInt16LE(2, 32); head.writeUInt16LE(16, 34); head.write('data', 36); head.writeUInt32LE(data.length, 40);
    return { bytes: Buffer.concat([head, data]), meta: { model, voice, style, requests: chunks.length, seconds: +(data.length / 88200).toFixed(1) } };
  }
  if (job.kind === 'music') {
    // Instrumental is asked for in the prompt (no parameter for it). Length and sections are steered in the prompt too ("[0:00 - 0:12] Intro: ...").
    const model = job.model || (job.clip ? 'lyria-3-clip-preview' : 'lyria-3-pro-preview');
    const r = await post(`https://aiplatform.googleapis.com/v1beta1/projects/${project}/locations/global/interactions`, { model, input: job.input }, 'music');
    // Vertex answers with a flat "outputs" list (text, text, audio/mpeg), measured 2026-10-10; the Gemini API docs show "steps"
    const content = [...(r.outputs || []), ...(r.steps || []).filter((x) => x.type === 'model_output').flatMap((x) => x.content || [])];
    const audio = content.filter((c) => c.type === 'audio').pop() || r.output_audio;
    const said = content.filter((c) => c.type === 'text').map((c) => c.text).join(' ').trim();
    if (!audio?.data) {
      const why = said || r.error?.message || (r.status && r.status !== 'completed' ? `status: ${r.status}` : '');
      throw new GenError(/safety|blocked|prohibited|policy|cannot (generate|create)/i.test(why) ? 'blocked' : 'empty', `No music came back${why ? ': ' + why : ''}`, r);
    }
    return { bytes: Buffer.from(audio.data, 'base64'), meta: { model, mime: audio.mime_type || null, structure: said || null, usage: r.usage ?? null } };
  }
  if (isVideo(job)) {
    // Omni Flash only answers on the Interactions API (Google's own error message, 2026-10-07), not on generateContent.
    // Three different jobs, kept apart on purpose:
    //   frame            animate this exact picture (it is the opening frame)
    //   frame + last     move from an opening frame to a closing frame
    //   ref              a product or a person to place inside a new scene described by the prompt
    const model = job.model || 'gemini-omni-1.1-flash-preview';
    const part = (f) => { const m = media(f); return { type: m.mime.startsWith('video') ? 'video' : 'image', mime_type: m.mime, data: m.data }; };
    const frames = [job.frame, job.last].filter(Boolean);
    const text = job.frame && job.last ? `The first image is the opening frame and the second image is the closing frame. ${job.input}` : job.input;
    const task = job.task || (job.kind === 'edit' ? 'edit' : refs.length ? 'reference_to_video' : frames.length ? 'image_to_video' : 'text_to_video');
    // an edit keeps the shape of its input video: Google rejects an aspect ratio there (its own error, 2026-10-07)
    const keeps = task === 'edit' || task === 'extend';
    const response_format = { type: 'video', ...(keeps ? {} : { aspect_ratio: job.ratio || '16:9' }), ...(keeps && !job.res ? {} : { resolution: job.res || '720p' }), delivery: 'inline' };
    const r = await post(`https://aiplatform.googleapis.com/v1beta1/projects/${project}/locations/global/interactions`,
      { model, input: [...frames.map(part), ...refs.map(part), { type: 'text', text }], response_format, generation_config: { video_config: { task } } }, 'video');
    const content = (r.steps || []).filter((x) => x.type === 'model_output').flatMap((x) => x.content || []);
    const clip = content.filter((c) => c.type === 'video').pop() || r.output_video;
    if (!clip?.data) {
      const said = content.filter((c) => c.type === 'text').map((c) => c.text).join(' ').trim();
      const why = said || r.error?.message || (r.status && r.status !== 'completed' ? `status: ${r.status}` : '');
      throw new GenError(/safety|blocked|prohibited|policy|cannot (generate|create)/i.test(why) ? 'blocked' : 'empty', `No video came back${why ? ': ' + why : ''}`, r);
    }
    return { bytes: Buffer.from(clip.data, 'base64'), meta: { model, task, frames, response_format, usage: r.usage ?? null } };
  }
  const model = job.model || (job.pro ? 'gemini-3-pro-image' : 'gemini-3.1-flash-image');
  const generationConfig = { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio: job.ratio || '16:9', imageSize: job.size || '2K' }, ...(job.seed !== undefined ? { seed: Number(job.seed) } : {}) };
  const parts = [...refs.map((f) => { const m = media(f); return { inlineData: { mimeType: m.mime, data: m.data } }; }), { text: job.input }];
  const body = await post(`https://aiplatform.googleapis.com/v1/projects/${project}/locations/global/publishers/google/models/${model}:generateContent`, { contents: [{ role: 'user', parts }], generationConfig }, 'image');
  const cand = body.candidates?.[0];
  const found = (cand?.content?.parts || []).map((p) => p.inlineData).filter((d) => d?.mimeType?.startsWith('image/')).pop();
  if (!found) {
    const block = body.promptFeedback?.blockReason || (cand?.finishReason && cand.finishReason !== 'STOP' ? cand.finishReason : '');
    const said = (cand?.content?.parts || []).map((p) => p.text).filter(Boolean).join(' ').trim();
    throw new GenError(block ? 'blocked' : 'empty', `No image came back${block ? ' (' + block + ')' : ''}${said ? ': ' + said : ''}`, body);
  }
  return { bytes: Buffer.from(found.data, 'base64'), meta: { model, generationConfig, usage: body.usageMetadata ?? null } };
};

const stamp = () => new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'gen';
const log = (line) => { fs.mkdirSync(path.join(root, 'gen'), { recursive: true }); fs.appendFileSync(path.join(root, 'gen', 'log.jsonl'), JSON.stringify({ time: new Date().toISOString(), ...line }) + '\n'); };

/** Run one job (with its takes). Returns the list of results; never throws for a generation failure. */
const run = async (job, { skipExisting = false } = {}) => {
  if (job.line && !job.input) job = { ...job, input: speakingPrompt(job) };
  const ext = job.kind === 'voice' ? 'wav' : job.kind === 'music' ? 'mp3' : isVideo(job) ? 'mp4' : 'png';
  const base = path.resolve(root, job.out || (job.kind === 'voice' ? job.input.replace(/\.txt$/, '') + `.${job.voice || 'Puck'}.wav` : `gen/${stamp()}-${slug(job.input)}.${ext}`));
  const n = Math.max(1, Number(job.n) || 1), results = [];
  for (let i = 1; i <= n; i++) {
    const out = n === 1 ? base : base.replace(/(\.\w+)$/, `-${i}$1`);
    const common = { kind: job.kind, for: job.for, input: job.input, out: rel(out) };
    if (skipExisting && !job.force && fs.existsSync(out)) { console.log(`skip  ${rel(out)} (already there)`); results.push({ ok: true, skipped: true, out }); continue; }
    const t0 = Date.now();
    try {
      const { bytes, meta } = await generate({ ...job, seed: job.seed !== undefined && n > 1 ? Number(job.seed) + i - 1 : job.seed });
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, bytes);
      if (fs.existsSync(out + '.error.json')) fs.unlinkSync(out + '.error.json');
      const seconds = Math.round((Date.now() - t0) / 1000);
      fs.writeFileSync(out + '.json', JSON.stringify({ kind: job.kind, for: job.for, input: job.input, refs: job.ref || [], ...meta, seconds_waited: seconds }, null, 2));
      log({ ...common, ok: true, model: meta.model, usage: meta.usage ?? null, seconds });
      console.log(`ok    ${rel(out)} (${(bytes.length / 1e6).toFixed(2)} MB, ${seconds} s)`);
      results.push({ ok: true, out });
    } catch (e) {
      if (!(e instanceof GenError)) throw e;
      if (e.detail) { fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out + '.error.json', JSON.stringify(e.detail, null, 2)); }
      log({ ...common, ok: false, failure: e.code, message: e.message });
      console.error(`FAIL  ${rel(out)}  [${e.code}] ${e.message}${e.detail ? `\n      details: ${rel(out)}.error.json` : ''}`);
      results.push({ ok: false, out, code: e.code });
      if (e.code === 'login') break;   // nothing else will work either
    }
  }
  return results;
};

const main = async () => {
  const [kind, first, ...rest] = process.argv.slice(2);
  if (!['image', 'edit', 'video', 'voice', 'music', 'batch'].includes(kind) || !first) throw new GenError('rejected', 'Usage: node tools/gen.mjs image|edit|video|voice|music|batch ...  (see the top of this file)');
  if (!project) throw new GenError('login', 'Missing GOOGLE_CLOUD_PROJECT in .env (run setup-google.cmd)');
  login();
  let results = [];
  if (kind === 'batch') {
    const file = path.resolve(root, first);
    if (!fs.existsSync(file)) throw new GenError('rejected', `File not found: ${first}`);
    const spec = JSON.parse(fs.readFileSync(file, 'utf8'));
    const jobs = Array.isArray(spec) ? spec : spec.jobs;
    const bad = jobs.findIndex((j) => !['image', 'edit', 'video', 'voice', 'music'].includes(j.kind) || (!j.input && !j.line) || !j.out);
    if (bad >= 0) throw new GenError('rejected', `Job ${bad + 1} in ${first} needs "kind", "input" and "out"`);
    for (const [i, j] of jobs.entries()) {
      console.log(`[${i + 1}/${jobs.length}] ${j.kind}  ${j.out}`);
      const r = await run({ for: spec.for, ...j }, { skipExisting: true });
      results.push(...r);
      if (r.some((x) => x.code === 'login')) break;
    }
    const made = results.filter((r) => r.ok && !r.skipped).length, skipped = results.filter((r) => r.skipped).length, failed = results.filter((r) => !r.ok).length;
    console.log(`\nbatch: ${made} made, ${skipped} already there, ${failed} failed${failed ? '. Fix the failed ones and run the same command again; finished jobs are not repeated.' : ''}`);
  } else {
    const job = { kind, input: first, ref: [] };
    for (let i = 0; i < rest.length; i++) {
      const k = rest[i].replace(/^--/, '');
      if (k === 'pro' || k === 'force' || k === 'clip') job[k] = true;
      else if (k === 'ref') job.ref.push(rest[++i]);
      else job[k] = rest[++i];
    }
    results = await run(job);
  }
  return results.some((r) => !r.ok) ? 1 : 0;
};

let code = 1;
try { code = await main(); }
catch (e) { if (!(e instanceof GenError)) throw e; console.error(`[${e.code}] ${e.message}`); }
await sleep(200);   // let connections close first; exiting at once crashes Node on Windows
process.exit(code);
