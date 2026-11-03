import type { World } from './worlds';
import type { Pic, StickerSpec } from './devices';
import type { Fx, LockLine } from './lettering';
import type { WorldName } from './worlds';
import type { BrandName } from './brands';
import type { FieldName } from './fields';

export const FORMATS = {
  post: { W: 1080, H: 1350 },      // feed 4:5 (the profile grid shows a centred 3:4 crop: 34 px off each side)
  tall: { W: 1080, H: 1440 },      // feed 3:4, the grid's own shape: nothing cropped
  square: { W: 1080, H: 1080 },
  story: { W: 1080, H: 1920 },     // story, reel cover (grid crop: centre 1080 x 1350)
  thumb: { W: 1920, H: 1080 },     // video thumbnail (also read at 320 px wide)
  wide: { W: 1920, H: 1080 },      // slide, banner
  cover: { W: 1640, H: 1044 },     // a Facebook page cover as the phone shows it (about 1.57:1); a computer shows only the middle band, and the profile picture covers the middle of the foot
} as const;
export type Format = keyof typeof FORMATS;

/** Margins and the zones platform UI covers (docs/design-system.md 4.1). */
export const zones = (f: Format) => {
  const { W, H } = FORMATS[f];
  const m = f === 'thumb' || f === 'wide' ? 80 : f === 'post' ? 76 : 70;   // post: 34 px grid crop + 42 px air
  // story/reel: Meta's story placement keeps ~14% top, ~35% bottom clear for UI; organic reels need less at the bottom
  return { W, H, m, u: Math.min(W, H) / 100, top: f === 'story' ? 270 : m, bottom: f === 'story' ? 470 : m, side: m };
};

/** The type scale (docs/design-system.md 3.3): every size is a step of 1.333 from body, in units of u (1% of the short
 *  side). Three steps per piece at most: display (fitted lettering), one reading size, one meta size. */
export const T = { micro: 3.0, body: 3.4, lead: 4.27, h3: 5.69, h2: 7.58, h1: 10.1 } as const;

export type Archetype =
  | 'split'      // A: subject on one half, headline on the other, label strip
  | 'wall'       // B: the words are the picture
  | 'object'     // C: one object that is the idea, headline above
  | 'sheet'      // D: documentary sheet: title, bar, stat pairs, graded photo
  | 'sandwich'   // E: giant word behind, subject in front
  | 'quote'      // F: quote card
  | 'steps'      // G: carousel step with a line running across slides
  | 'highlight'  // H: headline on highlight bars over a picture
  | 'corners'    // I: central picture or word, four corner words
  | 'collage'    // J: cards and stickers at angles
  | 'showcase'   // K: the place photographed big, a short promise, a thin row of facts, logo and contact (developers, hotels)
  | 'offer'      // L: picture, name, then rows of what and how much (unit details, room prices)
  | 'chat'       // M: the product answering in its own interface (a conversation with the assistant)
  | 'deal'       // N: a weekly offer card : series title, name ribbon, arched photos, price card, amenities
  | 'partner'    // P: the operator or partner named: their logo on a card over the photo (BRAND x PARTNER)
  | 'equation'   // Q: icons joined by + and =, or set side by side with a yes and a no (contract amount, share = ?)
  | 'arch'       // R: a photo in a Greek arch window under a lettered title
  | 'plan'       // S: a unit's floor plan as the object, the area lettered big, room sizes in a table
  | 'wave'       // T: the place under a wave-cut edge, the brand's wave ground above it 
  | 'device'     // U: the place in a rounded screen, smart-home chips floating at its edges 
  | 'compare'    // V: two sides split on a slant (render vs site, chalet vs share, yes vs no): photo or big icon each, a tag, a verdict
  | 'hanger'     // W: a hotel door hanger as the hero object over the room, the services written on it
  | 'receipt'    // X: a paper slip as the hero object: lines that add up to a total, the brand's stamp on it
  | 'quiz';      // O: a question card for a recurring quiz : hashtag, quote panel, question marks

export type Card = Pic & { x: number; y: number; w: number; h: number; rot?: number; caption?: string };

/** One still. Positions given as fractions of the frame; sizes are decided by the archetype and the world. */
export type DesignSpec = {
  format: Format;
  world?: WorldName;          // the art direction; with a field, the field's world is the base
  field?: FieldName;          // the kind of business: allowed compositions, word limits, devices (fields.ts)
  brand?: BrandName;          // the client: colours, faces, logo, contact (brands.ts)
  palette?: string;           // a palette of the world (default: its first); 'auto': the brand palette that suits the photo; 'photo': made from the photo
  look?: import('./look').LookSpec;
  art?: string;               // a drawn layer made for this piece (kit/design/art.ts registry), over the archetype and under the frame
  textBox?: [number, number, number?, number?]; // showcase with textAt top: where the words sit, [top, height, left?, width?] as fractions of the frame
  bare?: boolean;             // no frame at all (a page cover: the platform puts the logo and the name beside it)
  textAt?: 'top';            // showcase: words over the photo's empty upper third (photos generated for it)
  faces?: { display?: World['display']; text?: World['text']; latin?: World['latin'] };   // this piece's faces over the brand's (type tests, one-off pieces)   // the photo look for this piece over the brand's ('none': photos untouched)
  archetype: Archetype;
  idea: string;               // the idea made visible, in one sentence (docs/design-system.md 1.1), kept for the record
  head: string;               // markup: \n lines, *accent*, _hand_, {Latin}, ^micro^
  lettering?: { lines: LockLine[]; fx?: Fx; lead?: number; gap?: number; maxSize?: number };   // the headline built as a lettered block (replaces head)
  kicker?: string;            // small line or pill above the headline
  sub?: string;               // second line: label strip, bar or line under the headline
  body?: string;              // reading text
  points?: { title: string; text?: string }[];
  stats?: { value: string; label: string }[];
  big?: string;               // a giant word or numeral (ghost, sandwich, corners)
  name?: string; role?: string;
  pic?: Pic;                  // the subject (cut-out) or the main photo
  bg?: Pic;                   // a full-bleed background photo
  cards?: Card[];             // collage photos
  stickers?: StickerSpec[];
  pattern?: string;           // a repeated word behind everything
  cta?: string;
  facts?: { label: string; value: string }[];              // a thin row of facts (where, sizes, delivery)
  rows?: { label: string; value: string; note?: string }[]; // offer rows: what, how much, a small note under the price
  chat?: { from: 'me' | 'bot'; text: string }[];          // a conversation shown in the product's own bubbles
  series?: string;            // the recurring title of a series (عرض الخميس), lettered
  photos?: Pic[];             // arched photo windows (1 to 3)
  price?: { from?: string; value: string; note?: string; currency?: 'SAR' | 'EGP' };
  deal?: { big: string; before?: string; after?: string };   // a discount box: big number, text on each side
  amenities?: { icon: string; label: string }[];           // icon row (names in kit/design/icons.tsx)
  partner?: { src: string; name?: string; tag?: string };   // a partner logo (black on light), its name line, a tagline
  compare?: { side: { src?: string; focus?: [number, number]; icon?: string; tag?: string; label?: string; mark?: 'yes' | 'no'; ground?: string }[] };
  receipt?: { lines: { icon?: string; label: string; op?: string }[]; total: string; stamp?: string };
  equation?: { items: { icon: string; label: string; mark?: 'yes' | 'no'; total?: boolean }[]; ops?: string[] };
  slide?: { i: number; n: number; line?: number[] };   // carousel position; line = node height on every slide (fractions)
  side?: 'left' | 'right';    // the side the picture takes (split)
  align?: 'start' | 'center';
  mark?: string;                     // a Latin wordmark as the hero (luxury corners), the sub sits under it
  at?: 'top' | 'center' | 'bottom';  // where the words sit when the archetype allows it (corners, object, highlight)
  censor?: [number, number, number, number];           // brush bar over [x, y, w, h] (fractions)
  frame?: { tl?: string; tr?: string; bl?: string; br?: string; logo?: string };
};
