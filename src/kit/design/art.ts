import type React from 'react';
import type { Ctx } from './archetypes';

/** Drawn layers made for one piece (a map, clock hands, a label on a wall): the idea needs a drawing no archetype has.
 *  A design file registers its layers by name and a spec asks for one with `art`. Drawn over the archetype, under the frame.
 *  Text inside a layer carries data-qa="over" so the QA pass checks it like any other text. */
export const ART: Record<string, (c: Ctx) => React.ReactNode> = {};
export const registerArt = (name: string, draw: (c: Ctx) => React.ReactNode) => { ART[name] = draw; };
