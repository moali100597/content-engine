# Design system

How stills are designed in this project: posts, carousels, stories, ads, video covers and thumbnails, for a creator's own channels and for client work.

It is built from a study of real work, seen by eye on Behance and Pinterest (22 projects). 

The system is not a template. It is a set of decisions made in a fixed order (section 1), each with a small vocabulary that real designers use (sections 2 to 8). Variety comes from the decisions; consistency comes from the frame and the rules.

---

## 1. The order of decisions

Every piece is decided in this order. The engine asks for these in the spec and refuses to guess the first two.

1. **The idea made visible.** One sentence: what does the picture show that makes the message obvious without reading? Examples from the study: money frozen in an ice cube for "your money is melting, freeze it in gold" (Taiseer); a whole paper world bursting out of a school bag for "he does not carry a bag, he carries a world" (MIHAD); the teacher as a magician dealing hamza letters as playing cards for a lesson on the hamza (El Haddad). If there is no idea, the piece is a typographic piece (archetype "type wall") and the words must carry it.
2. **The world** (art direction, section 2): one colour story, one type voice, one texture, two or three graphic devices. Chosen from the message's tone, the brand, and the series.
3. **The archetype** (composition, section 5): where the eye lands first, second, third.
4. **The words**: headline at most 3 short lines, one accent phrase, a supporting line, at most 2 info blocks on a post (a carousel slide may hold more).
5. **The frame** (section 4): the fixed furniture of the brand or series (logo corner, meta line, page dashes, contact). Never changes inside a series.
6. **Check** (section 10): the anti-pattern list and the layout check.

## 2. Worlds (art directions)

A world fixes: palette, type voice, texture, devices, image treatment. Each one is distilled from studied work. A brand gets one main world and may borrow one neighbour for variety; a series (for example a creator's explainer covers) keeps one world.

| World | From the study | Palette | Type voice | Texture and devices | Image treatment | Use for |
| --- | --- | --- | --- | --- | --- | --- |
| **documentary** | Al Jazeera Documentary infographics, Al Arabiya | one hue graded over the whole picture (sepia, acid green on grey, amber, steel blue) + that hue pushed bright as accent + off-white | modern Arabic sans for info (Readex Pro / IBM Plex Sans Arabic) + one expressive display word (Aref Ruqaa Ink, Badeen Display, or Blaka) | ghost numerals, highlight bars, stat pairs, taped photos with paper tags, censor bar, map or paper texture, film grain | monochrome duotone of the photo, accent only on 1 to 3 words | explainers, history, "why" questions, facts |
| **newsroom** | Al Arabiya thumbnails and reel covers | deep navy/black + red + white | very heavy sans (Alexandria 900 / Rubik 900), line 1 red, kashida on one word | label bars (white bar + coloured bar offset), barbed wire or torn edge, boxed logo | 2 to 3 cut-out faces in depth over a composited context scene, darkened side for text | hot takes, news, comparisons of people or companies |
| **street** | MNJM, afterbite | one loud colour (magenta or signal orange) + black + white; sticker colours only inside badges | heavy geometric Arabic (Badeen Display, Lalezar) + heavy geometric Latin (Archivo Black / Anton); a handwritten word (Marhey / Playpen Sans Arabic) inserted inside a line | the text as image (paragraph set huge), stickers with local icons, arrow tape, Latin micro phrases tucked between Arabic lines, corner words | flash photography, real people, crop tight | bold brands, youth, food, studio self-promotion, opinion posts |
| **tech-glow** | Dale Creative, Zuvori | near black with a deep tint (green, blue) + one neon accent + white | clean geometric sans (Alexandria / Geist), sentence case, last phrase in accent; two-tone body (dim + bright key words) | glowing outline numeral behind a word, glass UI objects, progress dashes, pill labels "STEP 2", soft bloom | moody photos lit by screens, 3D glass objects | AI and tech content, SaaS, agencies |
| **pop-object** | Taiseer, MIHAD, Coffee Break | two grounds that alternate (navy and yellow, peach and teal) or one hue world per post | heavy rounded Arabic (Baloo Bhaijaan 2 800, Lemonada 700, Marhey 700) or extruded 3D letters; one word kashida-stretched | one 3D or real object as a visual pun, continuous line across carousel slides, tag sticker on the headline, paper grain | a single object or a person + prop on a clean lit ground, soft shadow | consumer apps, fintech, kids, FMCG |
| **folk** | Abu 3amo | deep green, brick red, mustard, cream | brush calligraphy lettering (Aref Ruqaa Ink, Rakkas) with outline and shadow, slightly rotated | khayamiya pattern wedges and borders, local props (hamsa, mashrabiya) | food or people, warm, steam and flying ingredients | Egyptian food, heritage, Ramadan |
| **luxury** | LAYALI, Chahi Collective | one deep colour (wine, olive, tea amber) + cream + skin/gold | thin tall Arabic (Reem Kufi 400, Amiri, Aref Ruqaa 400) + letter-spaced Latin serif caps (Instrument Serif, Fraunces) | lots of empty space, small corner furniture like a film title card, bilingual tagline split to the two ends | tight crops on skin and product, hard window light, motion blur, grain | perfume, jewellery, coffee, fashion |
| **editorial** | Thmanyah, Mo Karawia, "More." | off-white + black + one primary (red-orange or blue) + a set of sub-brand tints | one Arabic family in several weights (IBM Plex Sans Arabic or Readex Pro) + a serif Latin; type ladder shown | highlight bars on headline lines, big two-digit numbers, pill tags, fixed top and bottom rails, flat geometric illustration | flat illustration (dusk blues, one sun disc, lone figure) or documentary photo | podcasts, long-form, carousels that teach, portfolios |

Rule: one world per piece. Mixing two worlds in one frame is what makes work look random.

## 3. Type

### 3.1 Voices (fonts we have, seen in a specimen)

| Voice | Fonts | Character | Do not use for |
| --- | --- | --- | --- |
| Impact display | Badeen Display, Blaka, Lalezar, Jomhuria, Alexandria 900, Rubik 900, Beiruti 900 | loud, compact, poster | body, luxury |
| Clean display | Alexandria 600 to 800, Readex Pro 700, Kufam 700, Changa 700, Mada 800 | modern, neutral, tech | heritage |
| Rounded friendly | Baloo Bhaijaan 2, Lemonada, Marhey, Playpen Sans Arabic | warm, playful, consumer | serious news |
| Calligraphic | Aref Ruqaa (Ink), Rakkas, Gulzar, Amiri bold | heritage, emotion, one word only | paragraphs, numbers |
| Geometric Kufi | Reem Kufi (Fun, Ink), Qahiri, Vibes, Ruwudu | architectural, logo-like | long lines |
| Text | IBM Plex Sans Arabic, Readex Pro 400/500, Noto Kufi Arabic, Tajawal, Zain, Almarai | readable at small sizes | headlines that must shout |
| Serif text | Markazi Text, Scheherazade New, Noto Naskh Arabic, Mirza | editorial, literary | tech |
| Latin | Instrument Serif, Fraunces, DM Serif Display (serif); Geist, Inter, Space Grotesk, Instrument Sans (grotesk); Anton, Bebas Neue, League Gothic, Archivo Black (condensed / heavy); JetBrains Mono, Geist Mono (meta) | | |

### 3.2 Pairings (tested combinations)

- Arabic display + Arabic text: Badeen Display + IBM Plex Sans Arabic; Alexandria 900 + Alexandria 400; Lalezar + Readex Pro; Baloo Bhaijaan 2 800 + Baloo Bhaijaan 2 500; Aref Ruqaa Ink (one word) + Readex Pro (the rest).
- Arabic + Latin in the same piece: match weight and optical size, not style. Heavy geometric Arabic with Archivo Black or Anton; thin Arabic with Instrument Serif caps; clean Arabic sans with Geist. Latin is set a little smaller (about 0.85) because Latin caps look bigger than Arabic at the same size.
- At most two families per piece, plus a mono for meta lines if the world uses it.

### 3.3 Scale

Unit u = 1% of the short side of the format (10.8 px on 1080 wide). Every reading size is a step of 1.333 from body (`T` in `src/kit/design/spec.ts`); nothing is sized by eye.

| Step | u | px at 1080 | Use |
| --- | --- | --- | --- |
| micro | 2.4 | 26 | frame furniture, rails, labels under stats |
| body | 3.2 | 35 | reading text, kicker labels, stickers |
| lead | 4.27 | 46 | sub, question, block titles |
| h3 | 5.69 | 61 | short statements, quote marks |
| h2 | 7.58 | 82 | wordmarks, section titles |
| h1 | 10.1 | 109 | starting size of a plain headline before it is fitted |
| display | fitted | | lettering: the lines are sized to the block, not to the scale |

A piece uses three steps at most: the display (or h1), one reading step, and micro. Nothing readable goes under 2.7u (29 px, about 11 px on a phone).

### 3.4 Arabic rules

- Never letter-space Arabic. Stretch a word with kashida (ـ) instead, on one word per piece, in a display line: "شايـــل", "فرصـــة". Kashida goes between connecting letters only (never after ا د ذ ر ز و ة ى or at the end of a word).
- Harakat are allowed on display words as ornament (فَنّ، شَايل).
- Headline lines are broken by meaning, not by width: each line is a phrase.
- Numbers: Western digits in modern worlds, Arabic-Indic digits in heritage and luxury worlds; never mixed in one piece.
- Alignment: right for reading text; centre only for one-line or symmetric pieces (quote, luxury).
- Copy is written in the audience's own dialect and register.

### 3.5 Lettering (how headlines are built)

Headlines are built as one block by `Lockup` (`src/kit/design/lettering.tsx`), never typed as a line of text:

- **Lines are sized, not wrapped.** A line is fitted to the block width (a justified block, as in the El Haddad covers and the Egyptian campaign lettering), or keeps a relative size (`fit: false`).
- **Kashida justification.** A line can reach the width by stretching one joint of its longest word (at most 2 tatweels: longer reads as a bar), then scale the rest.
- **Optical stacking.** Lines are stacked by the real ink of their letters (measured on canvas), with one even gap (default 0.1 of the smaller line's size), so a descender never touches the next line and every pair of lines looks equally spaced, whatever the font. CSS line-height is not used for headlines.
- **Word space** is closed up by 8% in heavy display faces.
- **One face per line** is allowed (a modern sans line with a calligraphic line, as in the Al Jazeera titles); markup works inside a line.
- **Effects:** extruded 3D block (MIHAD), outline (folk brush lettering), hard shadow; a tag label can sit on a line like a sticker.
- A headline without explicit lettering still goes through Lockup (its lines kept, stacked by ink, scaled to the box). Highlight bars and micro-Latin walls use their own renderer.

### 3.6 Reading text

`Text` (`src/kit/design/type.tsx`):

- Arabic leads 1.65, Latin 1.5; no letter or word spacing changes.
- Lines break "pretty" (no lone word on the last line); the measure is capped near 40 Arabic characters (24 em).
- Floors: body never under 2.8u (30 px on a 1080 frame), labels never under 2.6u, frame meta 2.3u.
- Over a photo, reading text always gets a soft shadow, and the archetype adds a darkened zone behind it.

### 3.7 Fonts per world

| World | Headline | Reading text | Latin | Meta |
| --- | --- | --- | --- | --- |
| documentary | Readex Pro 700 + Aref Ruqaa Ink 700 (one line) | IBM Plex Sans Arabic | Zodiak | JetBrains Mono |
| newsroom | Alexandria 900 | Alexandria 500 | Clash Grotesk | |
| street | Badeen Display, Alexandria 900 for extruded words | Readex Pro 500 | Clash Display | Geist Mono |
| tech | Alexandria 600 to 900 | Alexandria 400 | Satoshi | Geist Mono |
| pop | Baloo Bhaijaan 2 800 + Lemonada 700 | Baloo Bhaijaan 2 500 | Cabinet Grotesk | |
| folk | Aref Ruqaa Ink 700 | Readex Pro 500 | Gambetta | |
| luxury | Reem Kufi 400 | Markazi Text | Sentient, tracked caps | |
| editorial | IBM Plex Sans Arabic 700 | IBM Plex Sans Arabic 400 | Zodiak | JetBrains Mono |

The full library and its licences: `docs/fonts.md`.

## 4. Grid and frame

### 4.1 Formats and margins

| Format | Size | Margin | Safe zones |
| --- | --- | --- | --- |
| post 4:5 | 1080 x 1350 | 76 | the profile grid shows a centred 3:4 crop (1013 x 1350): 34 px off each side, so the margin is 34 + 42 |
| tall 3:4 | 1080 x 1440 | 70 | the grid's own shape, nothing cropped; use it when the app posts it natively |
| square | 1080 x 1080 | 70 | grid crop keeps the centre 810 x 1080: no key text in the outer 135 at the sides |
| story / reel | 1080 x 1920 | 70 | top 270 (14%) and bottom 470 hold platform UI (Meta's story ad guidance is 14% top, 35% bottom, 6% sides); check on the real preview |
| carousel slide | 1080 x 1350 | 76 | slide edges may be crossed by a continuous element |
| thumbnail | 1920 x 1080 (renders 1280 x 720 too) | 80 | bottom right 18% x 14% holds the duration badge; text must read at 320 px wide |
| wide / slide | 1920 x 1080 | 96 | |

Columns: 6 on posts and stories, 12 on wide. Elements snap to columns or to the margin; a deliberate bleed off the edge is allowed for one element (a giant word, a cut-out). A format is laid out again, never scaled from another one.

### 4.2 Frame furniture (the series identity)

Fixed for a brand or series, small (meta size), never competing with the content. Chosen per world:

- **rails**: a top line (logo or name left, section or date right) and a bottom line (handle left, page number or contact right). Editorial, documentary, tech-glow.
- **corners**: four short words or marks in the four corners (LATE / NIGHT / LOUD / FLAVORS; ESTD 2026). Street, luxury.
- **badge**: logo top corner + hotline or CTA bottom. Folk, pop-object, ads.
- **progress**: 5 short dashes at the top of carousel slides, the current one bright.

## 5. Archetypes (compositions)

Each archetype names where the eye goes 1, 2, 3. A feed rotates archetypes; a carousel picks one for the cover, one for the inner slides, one for the last.

| # | Archetype | Eye path | From | Needs |
| --- | --- | --- | --- | --- |
| A | **split world** | subject (half) -> headline (other half) -> label strip | El Haddad covers, Al Arabiya | a person or object cut out or photographed in a world; 16:9 and 4:5 |
| B | **type wall** | the words (filling 60 to 80% of the frame) -> small Latin or meta tucked in gaps -> logo | MNJM poster, Egyptian campaign lettering, Zuvori | strong copy, no picture needed |
| C | **object pun** | one object centre or lower half -> headline above -> one line under | Taiseer, Coffee Break, Tanfeeth | a cut-out or rendered object that IS the idea |
| D | **documentary sheet** | title (accent + white) -> highlight bar sub -> stat pairs and blocks -> portrait | Al Jazeera infographics | a graded photo, facts, numbers |
| E | **depth sandwich** | giant word behind -> subject in front -> small headline | Al Arabiya "YOUTUBE THUMBNAILS", Mo Karawia "2026" | a cut-out subject, one or two giant words |
| F | **quote card** | big quote marks -> quote in 3 to 5 lines -> name bar | Thmanyah, Al Arabiya | a sentence worth quoting; optional portrait at the edge |
| G | **steps line** | slide number / step pill -> title -> 2 lines; a line runs across slides | Taiseer carousel, Dale steps, Pinterest seamless | 3 to 7 points |
| H | **highlight stack** | headline on highlight bars over an illustration or photo, bottom corner | Thmanyah cards | a mood picture |
| I | **corner frame** | central picture or word -> four corner words -> logo | afterbite KV, Chahi title cards | a strong central image |
| J | **collage** | stickers and cards at angles over a photo or colour, headline on top | MNJM, Chahi, Thmanyah board | 3 to 6 small elements |

## 5b. Domain maps (where the words go, and what kind of words)

The fixed things are the scale, the grid, contrast and the safe zones. Everything below changes with the field: the reference projects show that a perfume, a kids' venue and an explainer put their words in different places, at different weights, with different devices. Each map lists several compositions so a feed never repeats one.

| Field | References | Where the words sit | What kind of type | Density | Allowed devices | Never |
| --- | --- | --- | --- | --- | --- | --- |
| Explainers, education, a creator's own series | El Haddad, Al Jazeera, Dale, Thmanyah | 16:9: the half opposite the subject, 2 to 3 lines, label strip under. 4:5 cover: title top third, subject lower two thirds. Sheet: title top, info blocks in the column beside the subject, stat pairs on the bottom row | one heavy modern Arabic family in two weights (line 1 smaller, line 2 huge), one Latin serif for ghost numbers and names | low on covers, high on sheets (2 to 4 blocks + 2 stats) | highlight bar for the sub, block titles with an accent tick, ghost number, torn paper label | calligraphy mixed into an info sheet, text over the subject's face |
| Food and folk | Abu 3amo, Coffee Break | the lettering is the hero with the dish: above it, centred or slightly rotated; one line of copy at the bottom above the CTA row | brush or Ruqaa lettering, 2 to 3 lines of different sizes; plain Arabic sans for copy | low | outline + drop shadow on the lettering (it sits on the picture like a sticker), khayamiya borders, steam, CTA pill | thin type, more than one paragraph |
| Luxury, beauty, jewellery | LAYALI, Chahi | the photo takes 90%; the wordmark is the only big word (top or centre), one short Arabic line under it or in a corner; four corner metas small | light weights only: a tracked serif wordmark, a Naskh-like text face for Arabic | very low | thin rule, corner furniture, wide tracking on Latin | bars, boxes, shadows, heavy weights, a sentence as a headline |
| Kids, entertainment, street | MNJM, MIHAD, afterbite | the type fills the poster (wall), or a short lockup over a flash photo with a tilted tag; corner words | one heavy geometric Arabic display, justified block, one line in a second colour | very loud, few words | extrude, sticker badges, tilted tag, plastic wrap, kashida on one line | three fonts in one block, small Latin breaking a line in the middle |
| Apps, fintech, services | Taiseer, Tanfeeth, Zuvori | headline top (2 lines, one coloured word), one object pun in the lower half, a light second line, footer row with CTA | heavy rounded Arabic sans + light line; Latin grotesk only for UI labels | low to medium | glass panel, price block, carousel line with numbered nodes | stock people, more than one object |
| Reflective, editorial, podcast | Thmanyah, More. | headline on highlight bars in a bottom corner over a flat illustration; quote cards with big marks and a name bar | one family, regular to bold | medium | highlight bars, quote marks, name bar | photo + glow + headline (MISUN) |
| News thumbnails | Al Arabiya | right third, 3 short lines, first line in red, logo boxed top right | heavy sans | low | cut-out faces with depth, kashida on one word, darkened third | centred text over faces |

Shadows: a shadow needs a physical reason. Stickers, paper tags, cut-out products and lettering that sits on a picture like a sticker get one; type on a flat colour or on a dark gradient gets none. Text over a busy photo is made readable by a gradient behind it, not by a heavier shadow.

## 6. Graphic devices

Reusable pieces, each a component in the engine. A world allows only some of them (table in section 2).

- **highlight bar**: each headline line on its own tight box (ink on accent or accent on ink), padding 0.12em x 0.3em, lines flush on the reading side.
- **label bars**: two stacked bars offset, white + coloured (newsroom reel covers).
- **kashida stretch**: lengthens one word to a target width.
- **ghost numeral**: a huge number or date, 40 to 70u, at 6 to 12% opacity or as an outline, behind the title.
- **stat pair**: big number + 2-line label, with a short rule.
- **step pill**: small rounded label "خطوة 2" / "STEP 2".
- **progress dashes**: carousel position.
- **sticker**: rotated badge (square, circle, oval, warning diamond) with an icon or 2 words; slight shadow, 4 to 12 degree rotation.
- **tape and paper tag**: a photo or label taped at an angle; a paper tag with a date.
- **torn edge**: paper tear between two zones.
- **censor bar**: brush stroke across eyes or a word.
- **line path**: a continuous line with nodes that runs across carousel slides.
- **pattern**: a mark or word repeated in rotated rows (wrapping paper), or khayamiya medallions.
- **glow numeral / glass pill**: tech-glow only.
- **grade**: duotone or mono-hue grade of a photo to the world's hue.
- **grain**: always on, 4 to 8%, stronger (10 to 14%) in documentary and luxury.

## 7. Image direction

- The picture carries the idea (section 1.1). A person who does nothing related to the message is not an idea.
- Sources, in order: the creator's own photos and footage; generated images (Google models through `tools/gen.mjs`) built around reference photos so the face stays the same (`assets/me/`: a few crops of the face only); cut-outs made with `tools/cutout.py`; licensed stock only for textures and props.
- For a creator's covers: one face, a different world per episode, the person acts the idea with a prop.
- **Every generation prompt is a shot description, written for the layout**, in this order:
  1. format and ratio, and where the empty zone for the words is (side, size);
  2. the idea as action: who does what with which prop;
  3. identity lock for people (from the references: face shape, hair, beard, skin, age, build; "do not make the face wider");
  4. expression and pose;
  5. wardrobe and styling in the world's palette;
  6. set and props, nothing extra;
  7. light: key direction and quality, rim, practicals, colour temperature;
  8. lens, distance, depth of field;
  9. the world's colour story and grain;
  10. "no text, no logos".
- **Keeping a face:** an approved generated studio portrait goes first in the references, then two real photos, then the scene reference last, with the prompt saying the face comes only from the first images. Editing a generated picture to change the expression loses the likeness; regenerate the scene from the portrait instead.
- Generate 2 to 3 takes and choose by eye; correct a good take with an edit (expression, a prop) instead of regenerating the scene.
- Grade every picture into the world (section 6, grade) so photo and type share one colour story.

## 8. Feed and series

- Design the grid of 9, not a single post: alternate two grounds; alternate text-led and image-led posts in a checkerboard; never two neighbours with the same archetype.
- A series keeps: world, frame furniture, title placement and weight. It changes: the picture, the hue inside the world's range, the archetype within an allowed set.
- Carousel: slide 1 = hook (archetype A, C, B or E), inner slides = G, D or H, last slide = CTA or summary in the same world. A continuous element crosses at least one slide edge.

## 9. Words

- Headline: one phrase per line, at most 3 lines; the accent is the phrase that carries the tension, coloured, not underlined by default.
- Copy follows the humanizer pass rule of the project; no generic marketing words.
- Every piece has at most one call to action.

## 10. Check before export

Anti-patterns (each one seen in weak work during the study):

1. Same layout on every post of a feed.
2. A centred person + glow + headline with no idea.
3. Letter-spaced Arabic, or a decorative font on a long line.
4. More than two families, or more than four sizes.
5. Gradients or bevels on text (gold bevel), unless the world is folk or a 3D lettering piece made on purpose.
6. Colours that do not come from the world palette; more than one accent.
7. Text over a busy part of the picture without a darkened zone or bar.
8. Frame furniture that changes between posts of a series.
9. Icons rows and emojis as decoration.
10. Key text outside the safe zones of section 4.1.

Then the automatic check, before anyone looks at it: `node qa.mjs D-<id> check`. It reports, for a still:

- text outside the safe area of its format, and text pieces that overlap each other;
- a sticker over reading text or outside the safe area (a sticker over display lettering is allowed, MNJM does it on purpose);
- text under the micro step (2.3% of the short side);
- contrast of every text run against the pixels actually behind it (`tools/contrast.py`, WCAG 2: 4.5:1, or 3:1 for text of 5% of the short side and up; outlined lettering is skipped because the outline is its own edge).

The engine also chooses inks itself: pills, stickers and bars take the palette's ink or ground if it reaches 4.5:1 on their fill, otherwise near black or white; corner metas fall back from `dim` to `ink` under 6:1 (the vignette darkens corners); metas over photos get a soft scrim. An accent word on a bar of the accent's own colour turns into an inverted chip instead of vanishing.

A clean check is the floor, not the verdict: the piece is then looked at next to its reference.

## 12. Motion (a design that moves)

Every design also exists as a 5-second clip (`M-<id>`, same format, 30 fps): the still, built up the way the eye reads it. Nothing is keyed by hand (`src/kit/design/motion.tsx`):

- a block starts when reading reaches it: 0.25 s plus its top edge as a share of 1.1 s (top of the frame first, bottom last);
- inside a column, the kicker, title, sub, blocks and stats follow one another 0.14 s apart;
- a headline line rises out of its own baseline (the line box clips, the words slide up), each line 0.13 s after the one above;
- a highlight bar wipes in from the reading side (right for Arabic), its words fade up after it;
- stickers land last, with a small overshoot;
- the full-frame picture settles from 108% to 100% over 4.5 s, so the clip keeps breathing after the words are in;
- frame furniture fades in first, at 0.1 s.

- depth: a photo can carry `layer`, its subject cut out at the picture's own size (`python3 tools/cutout.py in.jpg out.png --keep`, add `--model u2net_human_seg` for people in busy scenes); the layer settles from further out than the photo, so the subject floats forward (2.5D parallax). Only used in motion; the still is the plain photo.

One curve for everything (fast out, long settle: cubic-bezier 0.16, 1, 0.3, 1). The still (frame 0 of `D-<id>`) is untouched by any of this.

A carousel plays as one clip (`Carousel` in `carousel.tsx`, e.g. `C-tips`): the slides sit side by side as the swipe shows them, the camera holds 2.6 s on each and glides 0.7 s to the next (ease in-out), and every slide's clock starts 0.4 s before the glide toward it, so its words land as the glide ends. The line across the slides stays one line because the slides really are next to each other.

## 12b. Sound for a moving design

Nothing is keyed by hand and nothing is laid on at random: every sound sits on something that happens in the picture.

- `tools/design_sfx.py <clip> <qa txt> <world> <out>` reads the rendered clip back. For each text run in the QA log it finds the frame where the run's own letters start to arrive and the frame where they land (pixels of its colour that change during the clip, compared with the last frame; a background that moves under it does not count). Frame furniture and micro labels make no sound.
- Events are classed by size and kind: headline line, sub or block title (`mid`), reading text (one soft sound per block, not per line), sticker, number, Latin wordmark. Words of one line and lines that start together are one event.
- The sound for each class comes from the world (`PALETTE` in the tool): paper and soft swishes for documentary and editorial, swoosh plus a punch when the last headline line lands for street, a shimmer for a luxury wordmark, pops for pop. Things that land (stickers, numbers) sound on landing; things that rise sound as they start. Successive headline lines step up in pitch.
- The picture settling at the start gets a low air bed. Carousels (`tools/carousel_sfx.py`) add a whoosh at the middle of every glide and score each slide inside its own stretch of the clip.
- Music: a bed under the effects, levelled on its own to -21 LUFS, faded in 0.4 s and out 0.9 s; the mix is mastered to -14 LUFS, true peak -1 dB (Instagram and TikTok play at about that level). Sources and credit lines in `music/CREDITS.md`: our Lyria tracks need none; Kevin MacLeod tracks (CC BY 4.0) need the credit line in the caption.

## 11. Engine map

`src/kit/design/` (rebuilt from this document):

- `spec.ts`: formats, safe zones (`zones`), the type scale `T`, and the `DesignSpec` a piece is written in.
- `worlds.ts`: the worlds of section 2 as data (palette roles, fonts, texture, grain), plus `contrast` and `inkOn`.
- `type.tsx`: `rich` markup (*accent*, _hand_, {Latin}, ^micro^), fitted `Lines` with highlight bars, reading `Text`, `Meta`.
- `lettering.tsx`: `Lockup`, headlines built line by line and stacked by their ink silhouettes; extrude, outline, print.
- `devices.tsx`: the devices of section 6 (stickers, pills, stats, paper tags with real torn paper and tape, ghost numbers, line path, textures, grain).
- `archetypes.tsx`: the archetypes of section 5 and the frame furniture (rails, corners, badge); `at` moves the words in corners, object and highlight; `mark` gives luxury a wordmark hero.
- `index.tsx`: `Design` (one still from a spec), texture and grain on top, QA hook.
- Checks: `src/kit/qa.tsx` (in the page), `qa.mjs` (runner), `tools/contrast.py` (pixels).

A spec names: format, world, archetype, idea (text, for the record), words, picture(s), frame, and optional overrides. Nothing is chosen at random; when a value is not given, the world's default is used.
