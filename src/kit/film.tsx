import React from 'react';
import { AbsoluteFill, Audio, staticFile } from 'remotion';
import { Agent, AgentKey } from './agent';
import { useT } from './anim';
import { Captions, Cue } from './captions';
import { useFonts } from './fonts';
import { landscape, Layout, LayoutProvider } from './layout';
import { QA, qaOn } from './qa';
import { makeShake, Scene, SceneView } from './scene';
import { Brand, BrandProvider, personal } from './brand';

/** Everything a voice-over film is made of. All times are story seconds (the original voice-over clock). */
export type FilmSpec = {
  duration: number;        // story seconds
  speed?: number;          // voice-over playback speed; the picture follows it
  audio?: string;          // file under public/ (leave it out to preview a film before its soundtrack exists)
  scenes: Scene[];
  impacts: number[];       // moments that shake the frame and make the agent hop
  agent: AgentKey[];
  cues: Cue[];
  highlights: string[];
  brand?: Brand;           // identity; the personal brand when omitted
};

export const filmFrames = (f: FilmSpec, fps = 30) => Math.round((f.duration / (f.speed ?? 1)) * fps);

export const Film: React.FC<{ film: FilmSpec; layout?: Layout }> = ({ film, layout = landscape }) => {
  const t = useT(film.speed ?? 1);
  const shake = React.useMemo(() => makeShake(film.impacts), [film.impacts]);
  let ci = 0;
  film.scenes.forEach((s, i) => { if (t >= s.a) ci = i; });
  const cur = film.scenes[ci];
  const dark = !!cur.dark && t >= cur.a + 0.1;
  const brand = film.brand ?? personal;
  const fonts = useFonts(brand);
  if (!fonts) return null;
  return (
    <BrandProvider value={brand}>
    <LayoutProvider value={layout}>
    <AbsoluteFill style={{ background: cur.dark && t >= cur.a + 0.3 ? brand.dark.bg : brand.paper, overflow: 'hidden' }}>
      {film.audio && <Audio src={staticFile(film.audio)} />}
      <AbsoluteFill style={{ transform: `translate(${Math.sin(t * 95) * shake(t) * 9}px, ${Math.cos(t * 83) * shake(t) * 7}px)` }}>
        {film.scenes.map((s, i) => <SceneView key={i} s={s} next={film.scenes[i + 1]} t={t} i={i} end={film.duration} />)}
      </AbsoluteFill>
      <Agent t={t} keys={film.agent} accent={cur.accent} dark={dark} shake={shake} />
      {qaOn() && <QA t={t} quiet={film.scenes.some((s) => Math.abs(t - s.a) < 0.45) || shake(t) > 0.02} />}
      <Captions t={t} cues={film.cues} highlights={film.highlights} accent={cur.accent} dark={dark} />
    </AbsoluteFill>
    </LayoutProvider>
    </BrandProvider>
  );
};
