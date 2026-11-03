import React from 'react';
import { AbsoluteFill, continueRender, delayRender, getInputProps } from 'remotion';
import { LayoutProvider, type Layout } from '../layout';
import { QA } from '../qa';
import { ARCHETYPES, Frame, type Ctx } from './archetypes';
import { GradeDefs, Grain, LinePath, Sticker, Texture } from './devices';
import { LookContext, gradeFromPalette, paletteFromPhoto, photoColors, pickPalette } from './look';
import { FORMATS, zones, type DesignSpec } from './spec';
import { Fade, MotionRoot } from './motion';
import { WORLDS, worldFaces, type World } from './worlds';
import { BRANDS, type Brand } from './brands';
import { FIELDS, type Field } from './fields';
import { ART } from './art';

// The design engine (docs/design-system.md): one still from a spec = world + archetype + words + pictures + frame.
// Nothing is chosen at random: what the spec leaves out comes from the world.

export * from './spec';
export { WORLDS } from './worlds';
export { ART, registerArt } from './art';
export type { Ctx } from './archetypes';

/** Hold the frame until every face of the world is loaded (text is measured to fit its box). */
const useWorldFonts = (w: World, extra: { family: string; weight: number }[] = []) => {
  const [ready, setReady] = React.useState(false);
  const [h] = React.useState(() => delayRender('design fonts'));
  React.useEffect(() => {
    const loads = worldFaces(w).concat([{ family: 'Fraunces', weight: 700 }, { family: 'Anton', weight: 400 }], extra).map((f) => document.fonts.load(`${f.weight} 40px "${f.family}"`, 'الذكاء Aa 123').catch(() => []));
    Promise.race([Promise.all(loads), new Promise((r) => setTimeout(r, 10000))]).then(() => { setReady(true); continueRender(h); });
  }, [w, h]);
  return ready;
};

/** The world a piece is drawn in: the field's (or the spec's) world as the structure, the brand's colours, faces and logo
 *  over it. A brand never borrows a palette it does not own. */
export const resolveWorld = (spec: DesignSpec): { w: World; field?: Field; brand?: Brand } => {
  const field = spec.field ? (FIELDS[spec.field] as Field) : undefined;
  const brand = spec.brand ? (BRANDS[spec.brand] as Brand) : undefined;
  const base = WORLDS[spec.world ?? field?.world ?? 'editorial'] as World;
  if (!field && !brand && !spec.faces) return { w: base };
  const w: World = {
    ...base,
    ...(brand ? { palettes: brand.palettes } : {}),
    display: { ...base.display, ...(brand?.display ?? {}), ...(spec.faces?.display ?? {}) } as World['display'],
    text: spec.faces?.text ?? brand?.text ?? base.text,
    latin: spec.faces?.latin ?? brand?.latin ?? base.latin,
    mono: brand?.latin?.family === 'JetBrains Mono' ? brand.latin : base.mono,
    hand: undefined,
    digits: brand?.digits ?? 'western',
    ...(field ? { frame: field.frame, grain: field.devices.grain, texture: field.devices.texture ? base.texture : undefined, fx: undefined } : {}),
  };
  return { w, field, brand };
};

/** Field rules a piece breaks (composition not used by the field, too many words, a device the field never uses). */
export const fieldProblems = (spec: DesignSpec, field?: Field): string[] => {
  if (!field) return [];
  const out: string[] = [];
  // limits per format: a story's line is narrower, a wide frame's line longer but its column shorter
  const fmt = { post: 1, tall: 1, square: 0.9, story: 0.85, wide: 0.8, thumb: 0.6, cover: 1 }[spec.format] ?? 1;
  const W = { ...field.words, headChars: Math.round(field.words.headChars * (spec.format === 'wide' ? 1.15 : fmt)), sub: Math.round(field.words.sub * fmt), body: Math.round(field.words.body * fmt) };
  if (!field.compositions.includes(spec.archetype)) out.push(`field ${field.name} does not use the ${spec.archetype} composition (${field.compositions.join(', ')})`);
  const plain = (t: string) => t.replace(/[*_{}^]/g, '');
  // a quiz question is reading text set in a panel: it is held to the body limit, not the headline limits
  if (spec.archetype === 'quiz' && spec.head && plain(spec.head).length > W.body) out.push(`question too long (${plain(spec.head).length} > ${W.body})`);
  const lines = spec.head && spec.archetype !== 'quiz' ? spec.head.split('\n') : [];
  if (lines.length > W.headLines) out.push(`headline has ${lines.length} lines, field allows ${W.headLines}`);
  lines.forEach((l) => { if (plain(l).length > W.headChars) out.push(`headline line too long (${plain(l).length} > ${W.headChars}): "${plain(l)}"`); });
  if (spec.sub && plain(spec.sub).length > W.sub) out.push(`sub too long (${plain(spec.sub).length} > ${W.sub})`);
  if (spec.body && plain(spec.body).length > W.body) out.push(`body too long (${plain(spec.body).length} > ${W.body})`);
  if ((spec.points?.length ?? 0) > W.points) out.push(`${spec.points!.length} points, field allows ${W.points}`);
  if ((spec.facts?.length ?? 0) > W.facts) out.push(`${spec.facts!.length} facts, field allows ${W.facts}`);
  if ((spec.rows?.length ?? 0) > W.rows) out.push(`${spec.rows!.length} rows, field allows ${W.rows}`);
  if (spec.stickers?.length && !field.devices.stickers) out.push('stickers are not used in this field');
  return out;
};

/** The photo a piece is about (for colour picking): its background, else its subject, else its first window. */
const mainPhoto = (s: DesignSpec) => s.bg?.src ?? (s.pic && !s.pic.cut ? s.pic.src : undefined) ?? s.photos?.[0]?.src ?? s.pic?.src;

export const Design: React.FC<{ spec: DesignSpec; motion?: boolean }> = ({ spec: given, motion = false }) => {
  const { w: w0, field, brand } = resolveWorld(given);
  // palette 'auto' (choose among the brand's) and 'photo' (build one) read the photo's colours first
  const wantsPhoto = given.palette === 'auto' || given.palette === 'photo';
  const [sw, setSw] = React.useState<Awaited<ReturnType<typeof photoColors>> | null>(null);
  const [hold] = React.useState(() => (wantsPhoto ? delayRender('photo colours') : null));
  React.useEffect(() => {
    if (!wantsPhoto) return;
    const src = mainPhoto(given);
    (src ? photoColors(src) : Promise.resolve([])).then((x) => { setSw(x); if (hold !== null) continueRender(hold); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const w = given.palette === 'photo' && sw ? { ...w0, palettes: { ...w0.palettes, photo: paletteFromPhoto(sw) } } : w0;
  const spec: DesignSpec = given.palette === 'auto' && sw ? { ...given, palette: pickPalette(w.palettes, sw) } : given;
  const p = w.palettes[wantsPhoto && !sw ? Object.keys(w.palettes)[0] : spec.palette ?? Object.keys(w.palettes)[0]];
  if (!p) throw new Error(`${spec.brand ?? spec.world} has no palette ${spec.palette}`);
  const z = zones(spec.format);
  const ready = useWorldFonts(w, (spec.lettering?.lines ?? []).map((l) => l.face).filter(Boolean) as { family: string; weight: number }[]);
  const gid = `${spec.brand ?? spec.world ?? spec.field}-${spec.palette ?? 'a'}`;
  const c: Ctx = { s: spec, w, p, field, brand, W: z.W, H: z.H, u: z.u, m: z.m, top: z.top, bottom: z.bottom, gid, tall: z.H > z.W * 1.1, wide: z.W > z.H * 1.2 };
  const L: Layout = { name: spec.format, W: z.W, H: z.H, stage: { ox: 0, oy: 0, tx: 0, ty: 0, scale: 1 }, copy: { box: {}, scale: 1, wrap: false }, caption: { bottom: z.bottom, size: 40 }, qa: { left: 0, right: z.W, top: 0, bottom: z.H }, safe: { top: z.top * 0.45, bottom: z.bottom * 0.45, side: z.m * 0.8 } };
  if (!ready || (wantsPhoto && !sw)) return null;
  return (
    <MotionRoot on={motion} H={z.H}>
    <LayoutProvider value={L}>
      <LookContext.Provider value={spec.look === 'none' ? undefined : (() => { const b = brand?.look === 'palette' ? gradeFromPalette(p) : brand?.look; return b || spec.look ? { ...(b ?? {}), ...(spec.look ?? {}) } : undefined; })()}>
      <AbsoluteFill style={{ background: p.ground, overflow: 'hidden' }}>
        <GradeDefs pal={p} id={gid} />
        <style>{'.noshrink > * { flex-shrink: 0 }'}</style>
        {ARCHETYPES[spec.archetype](c)}
        {spec.art && ART[spec.art]?.(c)}
        {spec.slide?.line && spec.archetype !== 'steps' && <LinePath i={spec.slide.i} ys={spec.slide.line} W={z.W} H={z.H} color={p.accent} u={z.u} world={w} pal={p} node={false} />}
        {(spec.stickers ?? []).map((st, k) => <Sticker key={k} s={st} W={z.W} H={z.H} world={w} pal={p} u={z.u} />)}
        {!spec.bare && <Fade at={0.1}><Frame c={c} /></Fade>}
        {w.texture && <Texture {...w.texture} />}
        <Grain amount={w.grain} />
      </AbsoluteFill>
      </LookContext.Provider>
      {(getInputProps() as { qa?: boolean }).qa && <QA t={0} quiet={false} />}
      {(getInputProps() as { qa?: boolean }).qa && <FieldReport problems={fieldProblems(spec, field)} />}
    </LayoutProvider>
    </MotionRoot>
  );
};
export const designSize = (spec: DesignSpec) => FORMATS[spec.format];

/** Field problems go to the same QA log as layout problems. */
const FieldReport: React.FC<{ problems: string[] }> = ({ problems }) => {
  React.useEffect(() => { problems.forEach((m) => console.log(`QA|0.00|0|${m}`)); }, [problems]);
  return null;
};
