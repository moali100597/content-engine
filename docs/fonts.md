# Fonts and element sources

Every font here is cleared for commercial work (posts, ads, video, client work). Nothing is downloaded from "free font" mirror sites: those copies of paid fonts are pirated.

## Installed

| Source | Licence | How it is loaded | Families |
| --- | --- | --- | --- |
| Google Fonts via Fontsource (npm `@fontsource/*`) | SIL OFL 1.1 | CSS imports (`src/kit/design/worlds.ts` and the kit) | Arabic: Cairo, Alexandria, Alyamama, Tajawal, Almarai, Changa, Kufam, Mada, Zain, Beiruti, El Messiri, Noto Kufi Arabic, Noto Sans Arabic, Rubik, Readex Pro, IBM Plex Sans Arabic, Baloo Bhaijaan 2, Lemonada, Marhey, Playpen Sans Arabic, Lalezar, Jomhuria, Badeen Display, Blaka (and Hollow, Ink), Reem Kufi (and Fun, Ink), Qahiri, Ruwudu, Handjet, Aref Ruqaa (and Ink), Rakkas, Gulzar, Amiri, Markazi Text, Scheherazade New, Noto Naskh Arabic, Noto Nastaliq Urdu, Mirza, Katibeh, Vibes, Harmattan. Latin: Inter, Geist, Geist Mono, Space Grotesk, Instrument Sans, Instrument Serif, Archivo, Archivo Black, Unbounded, Syne, Bricolage Grotesque, Anton, Bebas Neue, League Gothic, Oswald, Big Shoulders Display, Fraunces, Playfair Display, DM Serif Display, JetBrains Mono |
| Fontshare (Indian Type Foundry) | ITF Free Font License 2.0: personal and commercial use in any medium; do not pass the files to third parties or publish them | self-hosted woff2 in `public/fonts/fontshare/`, registered by `src/kit/design/fontshare.ts` (list in `fontshare.json`); the original zips with their licences are in `assets/fonts/fontshare/` on your computer | Satoshi, General Sans, Switzer, Cabinet Grotesk, Clash Display, Clash Grotesk, Chillax, Supreme, Author, Array, Panchang, Tanker, Zodiak, Gambetta, Sentient, Boska, Erode, Bespoke Serif |

The repository is private; keep it that way while Fontshare files are inside it.

## Not installed yet

| Font | Why | What it needs |
| --- | --- | --- |
| Thmanyah (ثمانية) | free, commercial use allowed; no modification, no redistribution | the download link is sent by e-mail from Thmanyah's font page: request it and drop the OTF files into `assets/fonts/thmanyah/` |
| Dubai Font | free for everyone | dubaifont.com did not answer from the session; download by hand |
| 29LT Bukra | paid: EUR 50 per style, EUR 600 the full family (29lt.com) | a licence; closest free alternatives: Alexandria, Cairo |

## Element sources

| What | Source | Cost | Note |
| --- | --- | --- | --- |
| Icons (SVG) | Phosphor (`@phosphor-icons/core`, 1,512 icons x 6 weights) and Tabler (`@tabler/icons`, 6,238), MIT | free | for stickers, step pills, UI chips |
| Textures, torn paper, tape, stickers, overlays, mockups, 3D objects | a licensed stock library | per item | ask before downloading, keep a list of what was bought |
| Pictures made for a piece | Google image models through `tools/gen.mjs` | Google Cloud credit | the default for anything that carries an idea |
| Effects (transitions, glow, grain, light rays, LUTs, photo grading) | ArtCraft repositories, Apache-2.0 | free | reference code to port; see `docs/storytold.md` |
