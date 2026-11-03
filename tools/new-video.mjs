// Start a new video from the kit:  node tools/new-video.mjs <name> [--studio]     (name in lower-case with dashes, e.g. cache-story)
//   default    format 1: 16:9 explainer on <Film> (Video.tsx, stages.tsx), with a 9:16 version
//   --studio   format 3: 9:16 film in the 3D studio with the ball (Video.tsx, Cover.tsx), the 3D studio film
// Both create cues.json, sfx-cues.json, vo/<name>.txt and vo/<name>.captions.txt, then print the lines for src/Root.tsx.
// Nothing existing is overwritten.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const name = process.argv[2], studio = process.argv.includes('--studio');
if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name || '')) { console.error('Usage: node tools/new-video.mjs <name>   (lower-case letters, digits and dashes)'); process.exit(1); }
const Id = name.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join('');
const dir = path.join(root, 'src', 'videos', name);
if (fs.existsSync(dir)) { console.error(`src/videos/${name} already exists`); process.exit(1); }
fs.mkdirSync(dir, { recursive: true });
const put = (file, text) => { if (!fs.existsSync(file)) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); } };

if (studio) {
put(path.join(dir, 'Video.tsx'), `import React from 'react';
import { AbsoluteFill, Audio, staticFile, useCurrentFrame } from 'remotion';
import { BrandProvider } from '../../kit/brand';
import { blinks, hop, shotAt, Shot3 } from '../../kit/direct';
import { useFonts } from '../../kit/fonts';
import { LayoutProvider } from '../../kit/layout';
import { C, Caption, Head, nightBrand, oneLine, studio916, W916, H916 } from '../../kit/portrait';
import { QA, qaOn } from '../../kit/qa';
import { BallPose, Studio } from '../../kit/studio';
import data from './cues.json';

// Format 3 (see docs/motion-book.md, version 2). Every time is a second of the voice-over: the story clock.
// Zones of the frame: headline 240..470, panels 270..1020, character 1040..1430, caption 1450..1540.
export const W = W916, H = H916, FPS = 30;
export const seconds = Math.max(5, data.duration);
const cues = oneLine(data.cues);

// camera presets: [distance, height, lookY]; key them over time in SHOTS (two keys 0.001 s apart make a cut)
const SHOT: Record<string, Shot3> = { stage: [5.7, 1.75, 0.1], mid: [6.6, 1.8, 0.7], q: [7.4, 2.1, 1.0], close: [4.9, 1.45, 0.42] };
const SHOTS: [number, Shot3][] = [[0, SHOT.stage]];

/** Where the ball is and how it feels at time t. */
const pose = (t: number): BallPose => ({ x: 0, y: hop(t, 0.2, 0.3), look: [0, 0.2], blink: blinks(t), mood: 'calm' });

const Scene: React.FC = () => {
  const frame = useCurrentFrame(), t = frame / FPS;
  const cam = { ...shotAt(t, SHOTS), x: 0 };
  return (
    <AbsoluteFill style={{ background: \`radial-gradient(ellipse at 50% 34%, \${C.bg2} 0%, \${C.bg} 66%)\`, overflow: 'hidden' }}>
      <Studio width={W} height={H} t={t} ball={pose(t)} cam={cam} staged />
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 50% 45%, transparent 48%, rgba(3,5,14,.78) 100%)', pointerEvents: 'none' }} />
      <Head t={t} at={0.3} out={4} lead="سطر صغير" big="السطر الكبير" />
      <Caption t={t} cues={cues} />
      {qaOn() && <QA t={t} quiet={false} />}
      <Audio src={staticFile('${name}/mix.wav')} />
    </AbsoluteFill>
  );
};

export const Video916: React.FC = () => {
  const fonts = useFonts(nightBrand);
  if (!fonts) return null;
  return <BrandProvider value={nightBrand}><LayoutProvider value={studio916}><Scene /></LayoutProvider></BrandProvider>;
};
`);
put(path.join(dir, 'Cover.tsx'), `import React from 'react';
import { AbsoluteFill } from 'remotion';
import { BrandProvider } from '../../kit/brand';
import { useFonts } from '../../kit/fonts';
import { C, head, nightBrand, W916, H916 } from '../../kit/portrait';
import { Studio } from '../../kit/studio';

// The cover: everything that must be read sits inside the middle 4:5 (y 285..1635), which profile grids show.
const Art: React.FC = () => (
  <AbsoluteFill style={{ background: C.bg, overflow: 'hidden' }}>
    <Studio width={W916} height={H916} t={2} cam={{ z: 5.4, y: 1.5, lookY: 0.75, x: 0 }} ball={{ x: 0, look: [0, 0.9], mood: 'happy' }} staged />
    <div style={{ position: 'absolute', left: 0, right: 0, top: 300, textAlign: 'center', direction: 'rtl', fontFamily: head, fontWeight: 700, fontSize: 120, color: C.code }}>العنوان</div>
  </AbsoluteFill>
);
export const Cover: React.FC = () => {
  const fonts = useFonts(nightBrand);
  if (!fonts) return null;
  return <BrandProvider value={nightBrand}><Art /></BrandProvider>;
};
`);
} else {
put(path.join(dir, 'stages.tsx'), `import React from 'react';
import { Pop } from '../../kit/anim';
import { Window } from '../../kit/ui';

/** The live UI on the stage side of a scene. Authored in 16:9 pixels; times are story seconds. */
export const Opening: React.FC<{ t: number; accent: string }> = ({ t }) => (
  <Pop t={t} at={0.3} style={{ position: 'absolute', left: 130, top: 200 }}>
    <Window title="${name}" style={{ width: 780, height: 460 }}><div /></Window>
  </Pop>
);
`);
put(path.join(dir, 'Video.tsx'), `import React from 'react';
import { AgentKey } from '../../kit/agent';
import { Film, FilmSpec } from '../../kit/film';
import { portrait } from '../../kit/layout';
import { Scene } from '../../kit/scene';
import { tones } from '../../kit/theme';
import * as St from './stages';
import data from './cues.json';

// Every time below is in story seconds: the clock of the voice-over in public/${name}/.
const scenes: Scene[] = [
  { a: 0, accent: tones.blue.accent, tr: 'none', Stage: St.Opening, copy: [
    { at: 0.3, lines: [{ k: 'lead', text: 'السطر الأول' }, { k: 'big', text: 'الكلمة', at: 0.8 }, { k: 'accent', text: 'المهمة.', at: 1.2 }] },
  ] },
];
const impacts: number[] = [];                                   // moments that shake the frame
const agent: AgentKey[] = [{ t: 0, x: 1015, y: 880, s: 150, look: [-0.8, -0.3] }];
const highlights: string[] = [];                                // one tinted keyword per caption, first match wins

export const film: FilmSpec = { duration: data.duration, speed: 1, audio: '${name}/mix.wav', scenes, impacts, agent, cues: data.cues, highlights };
export const Video: React.FC = () => <Film film={film} />;
export const Video916: React.FC = () => <Film film={film} layout={portrait} />;
`);
}
put(path.join(dir, 'cues.json'), JSON.stringify({ audio: '', duration: 10, cues: [] }, null, 1) + '\n');
put(path.join(dir, 'sfx-cues.json'), `{
"duration": 10,
"speed": 1,
"voice": {"src": "vo/${name}.wav"},
"music": {"src": "music/${studio ? name + '-lyria' : 'music_bed_lyria'}.mp3", "db": -7, "dips": []},
"cues": [
]
}
`);
put(path.join(root, 'vo', `${name}.txt`), '');
put(path.join(root, 'vo', `${name}.captions.txt`), '');
const rootLines = studio ? `  import * as ${Id} from './videos/${name}/Video';
  import { Cover as ${Id}Cover } from './videos/${name}/Cover';
  <Composition id="${Id}916" component={${Id}.Video916} width={${Id}.W} height={${Id}.H} fps={30} durationInFrames={Math.round(${Id}.seconds * 30)} />
  <Composition id="${Id}Cover" component={${Id}Cover} width={${Id}.W} height={${Id}.H} fps={30} durationInFrames={1} />` : `  import * as ${Id} from './videos/${name}/Video';
  <Composition id="${Id}" component={${Id}.Video} width={W} height={H} fps={30} durationInFrames={filmFrames(${Id}.film)} />
  <Composition id="${Id}916" component={${Id}.Video916} width={portrait.W} height={portrait.H} fps={30} durationInFrames={filmFrames(${Id}.film)} />`;
console.log(`Created src/videos/${name}/ (${studio ? 'format 3, studio' : 'format 1, explainer'}) and vo/${name}.txt

Add to src/Root.tsx:
${rootLines}

Then, in order (README, "Making a video"):
  1. write the script in vo/${name}.txt and approve it
  2. node tools/gen.mjs voice vo/${name}.txt --voice Puck, listen, keep the take you like as vo/${name}.wav
  3. (optional) change the voice with any voice changer, keep the same file name
  4. python3 tools/cues.py --draft vo/${name}.txt vo/${name}.captions.txt, fix the lines, then
     python3 tools/cues.py vo/${name}.Puck.wav vo/${name}.captions.txt src/videos/${name}/cues.json
  5. build the film, then  node qa.mjs ${Id}916 check   and frames of every scene
  6. sfx-cues.json from sfx-lib, python3 tools/audio.py ${name}, then listen to the mix
  7. render.cmd ${Id}916, then review the whole render`);
