import React from 'react';
import { Pop } from '../../kit/anim';
import { Window } from '../../kit/ui';

/** The live UI on the stage side of a scene. Authored in 16:9 pixels; times are story seconds. */
export const Opening: React.FC<{ t: number; accent: string }> = ({ t }) => (
  <Pop t={t} at={0.3} style={{ position: 'absolute', left: 130, top: 200 }}>
    <Window title="hello-film" style={{ width: 780, height: 460 }}><div /></Window>
  </Pop>
);
