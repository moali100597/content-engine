import React from 'react';

/** Everything that makes a film look like one owner: colours, fonts and accent set. Kit components read it from context,
 *  so the same film spec can be dressed for another identity by passing `brand` to <Film>. */
export type Brand = {
  name: string;
  paper: string; ink: string; grey: string; line: string;      // background, text, secondary text, hairlines
  card: string; chrome: string;                                 // UI surfaces and their small details (window dots)
  dark: { bg: string; fg: string; dim: string; card: string; line: string; chrome: string; soft: string };   // the dark-scene version of the same
  font: { sans: string; accent: string; latin: string; mono: string };
  accents: Record<string, string>;                              // named chapter colours
};

/** The default identity: warm paper, ink, one calligraphic accent word. */
export const personal: Brand = {
  name: 'personal',
  paper: '#F4F1EA', ink: '#15130F', grey: '#7C776D', line: '#E3DED2',
  card: '#fff', chrome: '#DAD5C9',
  dark: { bg: '#0D0C0A', fg: '#F4F1EA', dim: '#8A857A', card: '#191712', line: '#34312A', chrome: '#3B372F', soft: '#EDE8DC' },
  font: { sans: 'Alexandria, sans-serif', accent: '"Aref Ruqaa", serif', latin: '"Instrument Serif", serif', mono: '"JetBrains Mono", monospace' },
  accents: { red: '#D8362A', blue: '#2457E6', green: '#1F8A4C', amber: '#B56A00', ice: '#0B8499', hot: '#FF5B3A' },
};

const Ctx = React.createContext<Brand>(personal);
export const BrandProvider = Ctx.Provider;
export const useBrand = () => React.useContext(Ctx);
