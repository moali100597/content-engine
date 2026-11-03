import React from 'react';
import { Composition } from 'remotion';
import './kit/fonts';
import { filmFrames } from './kit/film';
import { portrait } from './kit/layout';
import { H, W } from './kit/theme';
import * as HelloFilm from './videos/hello-film/Video';
import * as HelloReel from './videos/hello-reel/Video';

// One <Composition> per video. `node tools/new-video.mjs <name>` scaffolds a new one and prints its lines for this file.
export const Root: React.FC = () => (
  <>
    {/* format 1: an explainer driven by a voice-over (kit/film.tsx), 16:9 and 9:16 from the same spec */}
    <Composition id="HelloFilm" component={HelloFilm.Video} width={W} height={H} fps={30} durationInFrames={filmFrames(HelloFilm.film)} />
    <Composition id="HelloFilm916" component={HelloFilm.Video916} width={portrait.W} height={portrait.H} fps={30} durationInFrames={filmFrames(HelloFilm.film)} />
    {/* format 2: a cut of shots (kit/reel.tsx) */}
    <Composition id="HelloReel916" component={HelloReel.Film} width={HelloReel.W} height={HelloReel.H} fps={HelloReel.FPS} durationInFrames={HelloReel.frames} />
  </>
);
