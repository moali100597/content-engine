import type { Archetype } from './spec';
import type { WorldName } from './worlds';

/** A field (docs/design-system.md 5b): what kind of business the piece is for. The field decides the compositions a piece
 *  may use, how many words each level may carry, and which devices are allowed. The brand then decides colour, faces and
 *  logo. Nothing here is a template: a field offers several compositions, and a feed is expected to move between them. */
export type Field = {
  name: string;
  world: WorldName;                // the structural base: frame furniture, grain, texture
  compositions: Archetype[];       // allowed, in order of how often the field uses them
  words: { headLines: number; headChars: number; sub: number; body: number; points: number; facts: number; rows: number };
  devices: { bars: boolean; stickers: boolean; tape: boolean; texture: boolean; grain: number; shadow: 'none' | 'soft' };
  frame: 'rails' | 'badge' | 'corners' | 'none';
  logo: 'center' | 'corner';       // where the brand's logo sits (developers centre it, products keep it small in a corner)
  notes: string;                   // the field's voice, for whoever writes the words
};

export const FIELDS = {
  // Developers : architecture photographed big and
  // quiet; one short promise in the developer's face; facts in a thin row (where, what sizes, when); logo and hotline always.
  realestate: {
    name: 'realestate',
    world: 'editorial',
    compositions: ['showcase', 'split', 'offer', 'sheet', 'corners', 'partner', 'equation', 'arch', 'plan', 'wave', 'device', 'compare', 'hanger', 'receipt'],
    words: { headLines: 3, headChars: 34, sub: 90, body: 160, points: 3, facts: 3, rows: 6 },
    devices: { bars: false, stickers: false, tape: false, texture: false, grain: 0.03, shadow: 'none' },
    frame: 'badge', logo: 'center',
    notes: 'Calm and certain. A promise, a place, a delivery date. Facts only from the developer files; returns are said as "عائد متوقع حسب دراسات السوق".',
  },
  // Umrah and hotel booking:
  // offer-led. A weekly series card (عرض الخميس) with the hotel's name, capsule photos, one big price including tax and an
  // icon row; quiz cards on the holy places; a team member in the videos; the full contact strip on every post.
  hospitality: {
    name: 'hospitality',
    world: 'editorial',
    compositions: ['deal', 'quiz', 'showcase', 'offer', 'steps', 'split', 'collage'],
    words: { headLines: 3, headChars: 24, sub: 90, body: 140, points: 4, facts: 4, rows: 3 },
    devices: { bars: true, stickers: false, tape: false, texture: false, grain: 0.02, shadow: 'soft' },
    frame: 'badge', logo: 'center',
    notes: 'Saudi light colloquial for offers and captions, plain Arabic for quiz and religious posts. The price is the hook and always says "شامل الضريبة"; facts only from the live offer. Warm and quick, never a joke about a holy place.',
  },
  // Software and fintech for small businesses (Taiseer, Tanfeeth, InstaPay, Zyda, Format accounting): one product truth
  // shown, not described: the screen, the chat, the number. A mascot may carry the warmth; the UI carries the proof.
  saas: {
    name: 'saas',
    world: 'tech',
    compositions: ['chat', 'object', 'showcase', 'split', 'steps'],
    words: { headLines: 3, headChars: 22, sub: 80, body: 140, points: 4, facts: 3, rows: 3 },
    devices: { bars: true, stickers: false, tape: false, texture: false, grain: 0.02, shadow: 'soft' },
    frame: 'badge', logo: 'corner',
    notes: 'Egyptian colloquial, clear and a little warm. Show the product doing the thing (a chat, a screen, a number). No invented figures.',
  },
  // Neighbourhood fast food (pizza, feteer, crepe, soury, burgers)
  // the dish shot inside a one-colour set and filling the frame, one idea
  // per post in two short lines at most, the logo badge in a corner and a thin contact row at the foot of every post.
  fastfood: {
    name: 'fastfood',
    world: 'editorial',
    compositions: ['showcase', 'object', 'chat', 'wall', 'offer', 'highlight', 'collage', 'split'],
    words: { headLines: 2, headChars: 22, sub: 60, body: 120, points: 3, facts: 3, rows: 6 },
    devices: { bars: false, stickers: true, tape: false, texture: false, grain: 0.015, shadow: 'soft' },
    frame: 'badge', logo: 'corner',
    notes: 'Egyptian colloquial, short, said the way the street says it: a joke or a tease, never a description of the dish. One idea per post; the food carries it. Item names stay as the menu writes them. No delivery fee is ever mentioned.',
  },
  // Kids play areas: the parent decides and pays, so every post speaks to the parent;
  // proof is the real place with real children, never a generated venue; one idea per post, prices and hours exact.
  kids: {
    name: 'kids',
    world: 'editorial',
    compositions: ['showcase', 'object', 'collage', 'offer', 'wall'],
    words: { headLines: 2, headChars: 24, sub: 70, body: 120, points: 4, facts: 3, rows: 6 },
    devices: { bars: false, stickers: true, tape: true, texture: false, grain: 0.015, shadow: 'soft' },
    frame: 'badge', logo: 'corner',
    notes: 'Egyptian colloquial to the mother. No absolute safety claims (say what is true: supervisors, café). Offers with exact days and hours.',
  },
} satisfies Record<string, Field>;
export type FieldName = keyof typeof FIELDS;
