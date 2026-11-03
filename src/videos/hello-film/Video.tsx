import React from 'react';
import { AgentKey } from '../../kit/agent';
import { Film, FilmSpec } from '../../kit/film';
import { portrait } from '../../kit/layout';
import { Scene } from '../../kit/scene';
import { tones } from '../../kit/theme';
import * as St from './stages';
import data from './cues.json';

// Every time below is in story seconds: the clock of the voice-over in public/hello-film/.
const scenes: Scene[] = [
  { a: 0, accent: tones.blue.accent, tr: 'none', Stage: St.Opening, copy: [
    { at: 0.3, lines: [{ k: 'lead', text: 'كل فيلم بيبدأ' }, { k: 'big', text: 'بفكرة', at: 0.8 }, { k: 'accent', text: 'واحدة.', at: 1.2 }] },
  ] },
];
const impacts: number[] = [];                                   // moments that shake the frame
const agent: AgentKey[] = [{ t: 0, x: 1015, y: 880, s: 150, look: [-0.8, -0.3] }];
const highlights: string[] = [];                                // one tinted keyword per caption, first match wins

export const film: FilmSpec = { duration: data.duration, speed: 1,   // add  audio: 'hello-film/mix.wav'  once tools/audio.py has built it
  scenes, impacts, agent, cues: data.cues, highlights };
export const Video: React.FC = () => <Film film={film} />;
export const Video916: React.FC = () => <Film film={film} layout={portrait} />;
