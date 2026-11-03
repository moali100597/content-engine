# Motion book

What the films move like, and which part of `src/kit` does it. Version 1, written from the first 16:9 explainer. It grows only with things an approved video used.

## References

Four reference videos were studied. Three have AI-looking colours and elements to avoid; the fourth is the model in every respect. Frames are kept for study only, never reused:

- `refs/ref4-keyframes/` 26 named key frames of the model reference, `refs/ref4-sheet.jpg` contact sheet
- `refs/ref1-sheet.jpg`, `refs/ref2-sheet.jpg`, `refs/ref3-sheet.jpg` contact sheets of the other three

## Frame

- Paper background `#F4F1EA`, ink `#15130F`. One accent per chapter (red, blue, green, amber, ice); one dark scene (`#0D0C0A`, hot accent) for the turn of the story.
- 16:9: headline block on the right (RTL), live UI stage on the left, full caption at the bottom with one tinted keyword.
- Type: Alexandria for everything, Aref Ruqaa for the one accent word, Instrument Serif Italic for Latin accents, JetBrains Mono for numbers and UI.
- No labels in the export: no scene numbers, notes or HUD.

## Vocabulary

| Move | What it is for | Where |
| --- | --- | --- |
| Word-by-word masked rise | every headline line arrives with the voice, one word per beat | `Words` in `anim.tsx` |
| Accent word overshoot | the single word that carries the sentence | `Copy`, line kind `accent` |
| Hand-drawn underline | second emphasis on the accent word, drawn after it lands | `Copy`, `underline: true` |
| Strike-through | a claim that turns out false | `Copy`, `strike: <time>` |
| Count-up / count-down | a number the voice says | `Copy` line kind `num`, `Count` |
| Typewriter | text someone types in a UI | `Type` |
| Cursor and click ripple | an action inside the UI, always before the result | `Cursor` |
| Spring pop | cards, chips and badges entering | `Pop` |
| Stamp slam with rings | a verdict (FAKE, x11) | `Stamp`, plus an entry in `impacts` |
| Camera shake and agent hop | follows every impact | `makeShake` in `scene.tsx` |
| Whip-pan with directional blur and anticipation | change of beat inside the same chapter | scene `tr: 'whip'` |
| Iris circle | change of chapter or of mood, opens from a meaningful point | scene `tr: 'iris'`, `at: [x, y]` |
| Slow push-in | every scene scales 1.10 to 1.13 while it plays | `SceneView` |
| Persistent character | the agent stays on screen as one character: badge in the corner, moves next to what it touches, grows when it is the subject | `Agent` keyframes |
| Moods | calm, busy, guilty, panic; eyes look at what the scene is about | `Orb` |

## Timing rules

- The voice leads. A word appears on the frame it is spoken, never before.
- Interaction first, result second: cursor moves, clicks, then the UI changes.
- One idea on screen at a time; the previous headline state drops out as the next begins.
- A transition starts about 0.12 s before the scene time so the new scene lands on the word.
- Impacts are rare (9 in 114 s). Each one has a sound and a shake.

## Sound

- Every visible event has a sound; nothing sounds without something moving.
- Layers: voice, effects (about 10 dB under the voice), music bed ducked under the voice and lowered in the dark scene.
- Transition sounds are aligned by their loudest point (`"al": "peak"`), not by their start.
- Sound is judged by ear on a short section before a full render.

# Version 2: the 9:16 film in a 3D studio (video 2, "الفيديو ده مكتوب بكود", 190 s)

Made in `src/videos/code-video/`. Approved look: a night studio in real 3D (glossy floor with a light grid, two light tubes, haze, dust) and one character, the ball, who lives through the whole film and reacts to what is said; flat 2D design on top. Final cut: `out/published/code-video-9x16.mp4` (v2), made after a full review of v1 that found the faults listed below.

## The set and the character (`stage3d.tsx`)

- `Studio`: three.js through `@remotion/three`, ACES tone mapping, a key light that follows the camera, two coloured point lights, fog. Everything is a pure function of the frame, so frames render out of order.
- The floor, grid and lights travel with the camera in whole grid cells, so the ball can travel down one long floor from place to place (each place is a "station" on the x axis).
- Light tubes: after the opening they are `staged`: two thin tubes kept at the edges of the picture whatever the lens does.
- The ball: eyes that look at what the scene is about, blinks, moods (calm, happy, worried, dizzy), squash on landing, lean into travel, `turn` to face its direction. Gear: rocket (strapped on, flame behind), shell (a turtle: dome on the back, four feet, tail). Ghost copies for onion-skin frames.
- Props: flip pad (pages turn on the left edge and vanish edge-on), frame wall (one tile per picture, fills from the floor, collapses), tape measure (numbers on the floor, drawn smaller by the depth ratio so the ball stands over its real number), camera on a tripod with a flash.

## Composition of a 9:16 frame (1080 x 1920)

| Zone | y (px) | What goes there |
| --- | --- | --- |
| Headline | 240 to 470 | one lead line and one loud line, word by word with the voice |
| Panels | 270 to 1020 | cards, editor, chat, previews; full width (940 px) |
| Character | 1040 to 1430 | the ball, mid shot (camera preset `q`), about 340 px across |
| Caption | 1450 to 1540 | one line, never two: a cue longer than 40 letters is cut in two at the space nearest its middle |

Type on a phone: code at least 44 px, body at least 46 px, headlines 74 to 120 px. When a scene is about the character, it is a close or mid shot with the panels moved out (camera presets `stage`, `close`).

## Faults found in the first full render, and the rule each one became

| Fault | Rule |
| --- | --- |
| Light tubes became a goalpost frame around every wide shot; posts stuck out of the ball's head | Background pieces stay thin and at the edges; nothing stands behind the character's head |
| The camera followed the ball, so speed 40, 2 and -10 all looked the same | When motion is the point, the camera stands still and the subject crosses the frame; the floor carries a measure |
| The turtle read as a green helmet | A prop must read as what it is from this camera: side view, shell on the back, feet |
| The flip pad page turned into a "roof" over the headline | No geometry crosses the headline zone; a page turns on its side and vanishes edge-on |
| Character tiny at the bottom, small cards at the top, dead space between, text too small for a phone | Use the zones above; mid shot for the character; panels full width |
| The chat panel sat empty for 6 s | A panel enters with its first content, never before |
| Labels sat on the character's chin and head | Labels live in the panel they describe (highlight the token in place) |
| Effects covered the spoken line at 49 to 52 s | No effect over a key spoken phrase; move it into the gap before or after |

Stills cannot show these: the review that counts is a full render cut into contact sheets every 10 frames, all of it.

## Sound of version 2

- Every effect comes from `sfx-lib` through `sfx-cues.json` (171 cues for 190 s); synthesised stand-ins are not used.
- Music: one Lyria 3 Pro bed stretched to the film, ducked under the voice, lifted (`dips` entry with a gain above 1) after the voice ends for the outro.
- The mix measured -15.2 LUFS integrated, -1.0 dBFS peak. Judged by ear: voice clear, effects slightly low in places, mix good.
