import { T } from './spec';
import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { Censor, Ghost, LinePath, Light, PaperTag, Pattern, Picture, Pill, Progress, Stat, Sticker, Torn } from './devices';
import type { DesignSpec } from './spec';
import { Lockup } from './lettering';
import { Enter, Seq, Settle, settle, useMotion } from './motion';
import { Lines, Meta, Text, type LinesProps } from './type';
import { contrast, digits, inkOn, type Palette, type World } from './worlds';
import type { Brand } from './brands';
import type { Field } from './fields';
import { Currency } from './currency';
import { Icon } from './icons';

// The archetypes of docs/design-system.md, section 5. Each one decides where the eye lands first, second, third.

export type Ctx = { s: DesignSpec; w: World; p: Palette; field?: Field; brand?: Brand; W: number; H: number; u: number; m: number; top: number; bottom: number; gid: string; tall: boolean; wide: boolean; col?: boolean };
/** Wide frames (16:9): the art takes the left half, the words a column on the right, where Arabic reading starts. The column
 *  is the same composition drawn on a half-width canvas, without its art (col). */
const Column: React.FC<{ c: Ctx; f: (c: Ctx) => React.ReactNode; share?: number }> = ({ c, f, share = 0.5 }) => {
  const Wc = c.W * share;
  return <div style={{ position: 'absolute', left: c.W - Wc, top: 0, width: Wc, height: c.H }}>{f({ ...c, W: Wc, m: c.m * 0.8, wide: false, tall: c.H > Wc * 1.1, col: true })}</div>;
};
const A = (r: { x: number; y: number; w?: number; h?: number }, children: React.ReactNode, style?: React.CSSProperties) => (
  <div style={{ position: 'absolute', left: r.x, top: r.y, width: r.w, height: r.h, ...style }}><Enter y={r.y} style={r.h ? { height: '100%' } : undefined}>{children}</Enter></div>
);
/** The headline: a lettered block when the spec gives one, otherwise the fitted lines. */
const Head: React.FC<{ c: Ctx } & Omit<LinesProps, 'text' | 'world' | 'pal'>> = ({ c, ...p }) => {
  if (c.s.lettering) return <Lockup lines={c.s.lettering.lines} fx={c.s.lettering.fx} lead={c.s.lettering.lead} gap={c.s.lettering.gap} maxSize={c.s.lettering.maxSize} world={c.w} pal={c.p} width={p.box.w} maxH={p.box.h} align={p.align} />;
  if (p.bars || p.face || c.s.head.includes('^')) return <Lines text={c.s.head} world={c.w} pal={c.p} {...p} />;
  // plain headline: its lines as written, stacked by their ink with one even gap, scaled to the box
  const lines = c.s.head.split('\n').map((t) => ({ text: t, fit: false, size: p.size / 100 }));
  return <Lockup lines={lines} world={c.w} pal={c.p} width={p.box.w} maxH={p.box.h} align={p.align} gap={0.16} />;
};
const shade = (u: number) => `0 ${u * 0.4}px ${u * 1.6}px rgba(0,0,0,.45)`;
const Kicker: React.FC<{ c: Ctx; text?: string }> = ({ c, text }) => !text ? null : (c.w.frame === 'rails' || c.w.name === 'luxury') && !(c.s.pic && !c.s.pic.cut && c.s.archetype === 'highlight')
  ? <Meta text={digits(text, c.w)} world={c.w} color={c.p.accent} size={c.u * T.body} />
  : <Pill text={digits(text, c.w)} world={c.w} pal={c.p} u={c.u} filled={c.w.name === 'newsroom' || c.w.name === 'pop' || c.s.archetype === 'highlight'} />;

/** A full-bleed photo with the world's grade, and a darkening toward where the words sit. */
const Backdrop: React.FC<{ c: Ctx; toward: 'top' | 'bottom' | 'left' | 'right' | 'none'; strength?: number }> = ({ c, toward, strength = 0.92 }) => {
  const m = useMotion();
  if (!c.s.bg) return <Light pal={c.p} at={[50, 55]} size={65} vignette={0.35} />;
  const g = c.p.ground, a = Math.round(strength * 255).toString(16).padStart(2, '0');
  const dir = { top: '180deg', bottom: '0deg', left: '90deg', right: '270deg', none: '' }[toward];
  return (
    <>
      <Picture pic={c.s.bg} r={{ x: 0, y: 0, w: c.W, h: c.H }} gid={c.gid} style={settle(m)} />
      {m.on && c.s.bg.layer && <Picture pic={{ ...c.s.bg, src: c.s.bg.layer, grade: undefined }} r={{ x: 0, y: 0, w: c.W, h: c.H }} gid={c.gid} style={settle(m, 1)} />}
      {toward !== 'none' && <AbsoluteFill style={{ background: `linear-gradient(${dir}, ${g}${a} 0%, ${g}${a} 22%, ${g}00 62%)` }} />}
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(0,0,0,.4) 100%)' }} />
    </>
  );
};

// A: subject on one half, headline on the other (El Haddad covers, Al Arabiya thumbnails)
const split = (c: Ctx) => {
  const { s, W, H, u, m, top, bottom } = c;
  const side = s.side ?? 'left';
  const picBox = c.tall ? { x: 0, y: H * 0.34, w: W, h: H * 0.66 - (s.format === 'story' ? 0 : 0) } : { x: side === 'left' ? -W * 0.02 : W * 0.46, y: H * 0.04, w: W * 0.56, h: H * 0.96 };
  const col = c.tall ? { x: m, y: top + u * 2, w: W - 2 * m, h: H * 0.3 } : { x: side === 'left' ? W * 0.5 : m, y: m, w: W * 0.5 - m * 1.2, h: H - 2 * m };
  return (
    <>
      <Backdrop c={c} toward={c.tall ? 'top' : side === 'left' ? 'right' : 'left'} />
      {!s.bg && <Light pal={c.p} at={c.tall ? [50, 70] : [side === 'left' ? 28 : 72, 55]} size={55} vignette={0.3} />}
      {s.pic && <Picture pic={s.pic} r={picBox} gid={c.gid} shadow={s.pic.cut ? 'drop' : 'none'} />}
      {A(col, (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: c.tall ? 'flex-start' : 'center', alignItems: 'flex-start', gap: u * 2.4, direction: 'rtl' }}><Seq>
          <Kicker c={c} text={s.kicker} />
          <Head c={c} size={u * (c.tall ? 13 : 16)} box={{ w: col.w, h: col.h * (c.tall ? 0.72 : 0.62) }} shadow={s.bg || s.pic ? shade(u) : undefined} />
          {s.sub && <PaperTag text={s.sub} world={c.w} pal={c.p} u={u} size={c.tall ? 3.6 : 4.2} rot={-2} />}
        </Seq></div>
      ))}
    </>
  );
  void bottom;
};

// B: the words are the picture (MNJM poster, Egyptian campaign lettering)
const wall = (c: Ctx) => {
  const { s, W, H, u, m, top, bottom } = c;
  const box = { x: m, y: top + u * 7, w: W - 2 * m, h: H - top - bottom - u * (s.sub ? 22 : 14) };
  return (
    <>
      {s.pattern && <Pattern text={s.pattern} world={c.w} color={c.p.dim} size={u * T.h3} W={W} H={H} opacity={0.18} />}
      {s.bg && <Backdrop c={c} toward="none" />}
      {A({ x: box.x, y: box.y, w: box.w, h: box.h }, (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', gap: u * 2, direction: 'rtl' }}><Seq>
          <Kicker c={c} text={s.kicker} />
          <Head c={c} size={u * 34} min={u * 8} box={{ w: box.w, h: box.h * 0.9 }} align={s.align === 'center' ? 'center' : 'start'} />
        </Seq></div>
      ))}
      {s.sub && A({ x: W - m - W * 0.62, y: H - bottom - u * 14, w: W * 0.62 }, <Text text={s.sub} world={c.w} pal={c.p} size={u * T.body} min={u * 3} box={{ w: W * 0.62, h: u * 12 }} color={c.p.ink} onPhoto={!!s.bg} />)}
    </>
  );
};

// C: one object that is the idea, headline above it (Taiseer, Coffee Break, Tanfeeth)
const object = (c: Ctx) => {
  const { s, W, H, u, m, top, bottom } = c;
  const headH = c.tall ? H * (s.format === 'story' ? 0.2 : s.lettering ? 0.32 : 0.26) : H * 0.3;
  const low = s.at === 'bottom';   // words under the object (Tanfeeth, MIHAD) instead of over it
  const picH = H - top - headH - bottom - u * (s.sub ? 16 : 8);
  const picBox = { x: W * 0.1, y: low ? top + u * 2 : top + headH + u * 3, w: W * 0.8, h: picH };
  const headY = low ? picBox.y + picH + u : top + u * 2;
  const center = s.align === 'center';
  return (
    <>
      {s.pattern && <Pattern text={s.pattern} world={c.w} color={c.p.ground2 ?? c.p.dim} size={u * T.h2} W={W} H={H} opacity={0.35} />}
      {s.bg ? <Backdrop c={c} toward={low ? 'bottom' : 'top'} strength={0.75} /> : <Light pal={c.p} at={[50, ((picBox.y + picBox.h * 0.55) / H) * 100]} size={45} vignette={0.25} />}
      {A({ x: m, y: headY, w: W - 2 * m, h: headH }, (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: center ? 'center' : 'flex-start', gap: u * 1.8, direction: 'rtl' }}><Seq>
          <Kicker c={c} text={s.kicker} />
          <Head c={c} size={u * T.h1} box={{ w: W - 2 * m, h: headH - u * 6 }} align={center ? 'center' : 'start'} />
        </Seq></div>
      ))}
      {s.pic && <Picture pic={s.pic} r={picBox} gid={c.gid} shadow="floor" />}
      {s.bg && s.sub && <AbsoluteFill style={{ background: `linear-gradient(0deg, ${c.p.ground}f2 0%, ${c.p.ground}cc 14%, ${c.p.ground}00 34%)` }} />}
      {s.sub && A({ x: m, y: H - bottom - u * 16, w: W - 2 * m, h: u * 13 }, <div style={{ height: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: center ? 'center' : 'flex-start' }}><Text text={s.sub} world={c.w} pal={c.p} size={u * T.lead} min={u * 3} box={{ w: W - 2 * m, h: u * 12 }} color={c.p.ink} onPhoto={!!s.bg} align={center ? 'center' : 'start'} lead={1.4} /></div>)}
    </>
  );
};

// D: documentary sheet (Al Jazeera Documentary infographics): title, bar, then a reading column of question blocks
// on the reading side over the darkened photo, and a row of stat pairs at the foot. Dense but ordered.
const sheet = (c: Ctx) => {
  const { s, W, H, u, m, top, bottom } = c;
  const cw = W - 2 * m, col = cw * 0.56;
  const statsH = s.stats?.length ? u * 15 : 0;
  const statsY = H - bottom - u * 4 - statsH;
  return (
    <>
      <Backdrop c={c} toward="top" strength={0.95} />
      {s.bg && <AbsoluteFill style={{ background: `linear-gradient(270deg, ${c.p.ground}f0 0%, ${c.p.ground}c8 42%, ${c.p.ground}00 70%)` }} />}
      {s.bg && <AbsoluteFill style={{ background: `linear-gradient(0deg, ${c.p.ground}f2 0%, ${c.p.ground}00 ${((statsH + bottom + u * 14) / H) * 100}%)` }} />}
      {s.big && <Ghost text={digits(s.big, c.w)} world={c.w} color={c.p.ink} size={u * 44} at={{ x: -u * 2, y: top + u * 2 }} opacity={0.09} />}
      {s.censor && <Censor r={{ x: s.censor[0] * W, y: s.censor[1] * H, w: s.censor[2] * W, h: s.censor[3] * H }} color="#c8161d" />}
      {A({ x: m, y: top + u * 6, w: cw, h: H - top - bottom - u * 12 }, (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: u * 2.2, direction: 'rtl' }} className="noshrink"><Seq>
          <Kicker c={c} text={s.kicker} />
          <Head c={c} size={u * T.h1} box={{ w: cw, h: H * (s.points?.length ? 0.22 : s.lettering ? 0.3 : 0.24) }} shadow={s.bg ? shade(u) : undefined} />
          {s.sub && <Lines text={s.sub} world={c.w} pal={c.p} face={{ family: c.w.text.family, weight: c.w.text.bold }} size={u * T.lead} box={{ w: cw, h: u * 12 }} bars={{ fill: c.p.ink, ink: c.p.ground }} />}
          {(s.points ?? []).map((pt, k) => (
            <div key={k} style={{ width: col, display: 'flex', flexDirection: 'column', gap: u * 0.6, marginTop: k ? 0 : u * 1.2 }}>
              <div data-qa="over" style={{ fontFamily: `"${c.w.text.family}"`, fontWeight: c.w.text.bold, fontSize: u * T.lead, lineHeight: 1.25, color: c.p.ink, direction: 'rtl', textShadow: s.bg ? shade(u) : undefined, display: 'flex', alignItems: 'center', gap: u * 1.4 }}><span style={{ width: u * 0.9, height: u * 3.6, background: c.p.accent, flex: 'none' }} />{pt.title}</div>
              {pt.text && <Text text={pt.text} world={c.w} pal={c.p} size={u * T.body} min={u * 2.9} lead={1.55} box={{ w: col, h: u * 15 }} color={c.p.ink} onPhoto={!!s.bg} />}
            </div>
          ))}
          {!!s.stats?.length && (
            <div style={{ marginTop: 'auto', width: cw, display: 'flex', gap: u * 5, direction: 'rtl' }}>
              {s.stats.map((st, k) => <Stat key={k} value={digits(st.value, c.w)} label={st.label} world={c.w} pal={s.bg ? { ...c.p, dim: c.p.ink } : c.p} u={u} w={(cw - u * 5 * (s.stats!.length - 1)) / s.stats!.length} />)}
            </div>
          )}
        </Seq></div>
      ))}
    </>
  );
};

// E: giant word behind, subject in front (Al Arabiya section covers, Mo Karawia)
const sandwich = (c: Ctx) => {
  const { s, W, H, u, m, top, bottom } = c;
  const bigBox = { w: W - m, h: c.tall ? H * 0.3 : H * 0.42 };
  const latinBig = !!s.big && !/[؀-ۿ]/.test(s.big);
  return (
    <>
      <Light pal={c.p} at={[50, 60]} size={55} vignette={0.35} />
      {s.big && A({ x: m / 2, y: c.tall ? top + H * 0.08 : H * 0.12, w: bigBox.w }, (
        <Lines text={s.big} world={c.w} pal={c.p} face={latinBig ? (c.w.latin.family === 'Instrument Serif' || c.w.latin.family === 'Fraunces' ? { family: 'Anton', weight: 400 } : c.w.latin) : c.w.display} latin={latinBig} upper={latinBig} size={u * 60} min={u * 10} box={bigBox} align="center" color={c.p.ink} lead={0.9} />
      ))}
      {s.pic && <Picture pic={{ ...s.pic, cut: true }} r={c.tall ? { x: W * 0.06, y: H * 0.2, w: W * 0.88, h: H * 0.8 } : { x: W * 0.25, y: H * 0.08, w: W * 0.5, h: H * 0.92 }} gid={c.gid} shadow="drop" />}
      {A({ x: m, y: H - bottom - (c.tall ? H * 0.2 : H * 0.3), w: c.tall ? W - 2 * m : W * 0.34, h: c.tall ? H * 0.2 : H * 0.3 }, (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'flex-start', gap: u * 1.6, direction: 'rtl' }}>
          <Kicker c={c} text={s.kicker} />
          <Head c={c} size={u * T.h2} box={{ w: c.tall ? W - 2 * m : W * 0.34, h: (c.tall ? H * 0.2 : H * 0.3) * 0.8 }} bars={{}} />
        </div>
      ), c.tall ? undefined : { right: m, left: undefined })}
    </>
  );
};

// F: quote card (Thmanyah, Al Arabiya)
const quote = (c: Ctx) => {
  const { s, W, H, u, m, top, bottom } = c;
  const withPic = !!s.pic;
  const cw = withPic && !c.tall ? W * 0.55 : W - 2 * m;
  return (
    <>
      <Backdrop c={c} toward="none" />
      {s.pic && <Picture pic={{ ...s.pic, cut: true, anchor: '0% 100%' }} r={c.tall ? { x: -W * 0.08, y: H * 0.5, w: W * 0.62, h: H * 0.5 - bottom * 0.2 } : { x: 0, y: H * 0.1, w: W * 0.42, h: H * 0.9 }} gid={c.gid} />}
      {A({ x: W - m - cw, y: top + u * 4, w: cw, h: (withPic && c.tall ? H * 0.5 : H - top - bottom) - u * 6 }, (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: withPic && c.tall ? 'flex-start' : 'center', alignItems: 'flex-start', gap: u * 3, direction: 'rtl' }}>
          <div style={{ fontFamily: '"Fraunces"', fontWeight: 700, fontSize: u * 24, lineHeight: 0.5, height: u * 9, color: c.p.accent }}>”</div>
          <Head c={c} face={{ family: c.w.text.family, weight: c.w.text.bold }} lead={1.45} size={u * T.h2} box={{ w: cw, h: H * 0.42 }} />
          {s.name && <div style={{ display: 'flex', flexDirection: 'column', gap: u * 0.8, alignItems: 'flex-start' }}>
            <Lines text={s.name} world={c.w} pal={c.p} face={{ family: c.w.text.family, weight: c.w.text.bold }} size={u * T.body} box={{ w: cw, h: u * 7 }} bars={{ fill: c.p.accent, ink: inkOn(c.p.accent, c.p) }} />
            {s.role && <Text text={s.role} world={c.w} pal={c.p} size={u * 2.9} min={u * 2.6} box={{ w: cw, h: u * 7 }} />}
          </div>}
        </div>
      ))}
    </>
  );
};

// G: a carousel step; one line runs across all slides (Taiseer, Dale steps)
const steps = (c: Ctx) => {
  const { s, W, H, u, m, top, bottom } = c;
  const sl = s.slide ?? { i: 1, n: 1 };
  const nodeY = sl.line?.[sl.i - 1] ?? 0.5;
  const textTop = nodeY > 0.5;
  const zone = textTop ? { y: top + u * 9, h: nodeY * H - top - u * 18 } : { y: nodeY * H + u * 10, h: H - bottom - nodeY * H - u * 16 };
  return (
    <>
      <Light pal={c.p} at={[50, nodeY * 100]} size={50} vignette={0.3} />
      {s.big && <Ghost text={digits(s.big, c.w)} world={c.w} color={c.p.accent} size={u * 46} at={{ x: W * 0.04, y: textTop ? H - bottom - u * 44 : top + u * 4 }} mode={c.w.name === 'tech' ? 'glow' : 'outline'} opacity={0.12} />}
      {sl.line && <LinePath i={sl.i} ys={sl.line} x={0.5} W={W} H={H} color={c.p.accent} u={u} world={c.w} pal={c.p} nodeText={digits(s.big ?? String(sl.i), c.w)} />}
      {s.pic && <Picture pic={s.pic} r={{ x: W * 0.52, y: nodeY * H - H * 0.17, w: W * 0.4, h: H * 0.32 }} gid={c.gid} shadow="floor" />}
      {A({ x: m, y: zone.y, w: W - 2 * m, h: zone.h }, (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: textTop ? 'flex-start' : 'flex-start', alignItems: 'flex-start', gap: u * 2.2, direction: 'rtl' }}><Seq>
          <Kicker c={c} text={s.kicker} />
          <Head c={c} size={u * T.h1} box={{ w: W - 2 * m, h: zone.h * 0.5 }} />
          {s.body && <Text text={s.body} world={c.w} pal={c.p} size={u * T.lead} min={u * 3} box={{ w: (W - 2 * m) * 0.86, h: zone.h * 0.4 }} />}
          {s.points && <div style={{ display: 'flex', flexDirection: 'column', gap: u * 2.4 }}>{s.points.map((pt, k) => (
            <div key={k} style={{ display: 'flex', gap: u * 2.4, alignItems: 'baseline' }}>
              <span style={{ fontFamily: `"${c.w.display.family}"`, fontWeight: c.w.display.weight, fontSize: u * T.h3, color: c.p.accent, width: u * 6 }}>{digits(String(k + 1).padStart(2, '0'), c.w)}</span>
              <div><div data-qa="over" style={{ fontFamily: `"${c.w.text.family}"`, fontWeight: c.w.text.bold, fontSize: u * T.lead, color: c.p.ink, lineHeight: 1.3 }}>{pt.title}</div>{pt.text && <div style={{ fontFamily: `"${c.w.text.family}"`, fontWeight: c.w.text.weight, fontSize: u * T.body, color: c.p.dim, lineHeight: 1.5 }}>{pt.text}</div>}</div>
            </div>))}</div>}
        </Seq></div>
      ))}
    </>
  );
};

// H: headline on highlight bars over a picture (Thmanyah cards)
const highlight = (c: Ctx) => {
  const { s, W, H, u, m, bottom } = c;
  const bw = W * (c.wide ? 0.5 : 0.8);
  const hi = s.at === 'top';   // the note in the sky instead of on the ground, when the picture's quiet area is up
  return (
    <>
      <Backdrop c={c} toward={hi ? 'top' : 'bottom'} strength={0.55} />
      {s.pic && <Settle><Picture pic={s.pic} r={{ x: 0, y: 0, w: W, h: H }} gid={c.gid} /></Settle>}
      {A({ x: W - m - bw, y: hi ? c.top + u * 4 : H - bottom - H * 0.42, w: bw, h: H * 0.42 - u * 4 }, (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: hi ? 'flex-start' : 'flex-end', alignItems: 'flex-start', gap: u * 2, direction: 'rtl' }}><Seq>
          <Kicker c={c} text={s.kicker} />
          <Head c={c} size={u * T.h2} box={{ w: bw, h: H * 0.3 }} bars={{}} />
          {s.sub && <Lines text={s.sub} world={c.w} pal={c.p} face={{ family: c.w.text.family, weight: c.w.text.bold }} size={u * T.body} box={{ w: bw, h: u * 6 }} bars={{ fill: c.p.accent, ink: inkOn(c.p.accent, c.p) }} />}
        </Seq></div>
      ))}
    </>
  );
};

// I: a central picture or word, four corner words (afterbite key visual, Chahi title cards)
const corners = (c: Ctx) => {
  const { s, W, H, u, m, top, bottom } = c;
  const photo = !!s.bg || (!!s.pic && !s.pic.cut);
  const at = s.at ?? 'center';
  const hh = photo ? H * 0.26 : H * 0.32;
  const hy = at === 'top' ? top + u * 9 : at === 'bottom' ? H - bottom - u * 9 - hh : H / 2 - hh / 2;
  return (
    <>
      <Backdrop c={c} toward="none" />
      {photo && <AbsoluteFill style={{ background: `linear-gradient(180deg, ${c.p.ground}99 0%, ${c.p.ground}00 16%, ${c.p.ground}00 84%, ${c.p.ground}99 100%)` }} />}
      {s.pic && <Picture pic={s.pic} r={s.pic.cut ? { x: W * 0.12, y: top + u * 10, w: W * 0.76, h: H - top - bottom - u * 22 } : { x: m, y: top + u * 9, w: W - 2 * m, h: H - top - bottom - u * 20 }} gid={c.gid} shadow="drop" />}
      {s.head && A({ x: m, y: hy, w: W - 2 * m, h: hh }, (
        <div style={{ height: '100%', display: 'flex', alignItems: at === 'bottom' ? 'flex-end' : at === 'top' ? 'flex-start' : 'center', justifyContent: 'center' }}>
          <Head c={c} size={u * (photo ? 11 : 16)} box={{ w: W - 2 * m, h: hh }} align="center" bars={photo && c.w.name !== 'luxury' ? {} : undefined} />
        </div>
      ))}
      {s.mark && A({ x: m, y: top + u * 8, w: W - 2 * m }, (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u * 2.2 }}>
          <div data-qa="over" style={{ fontFamily: `"${c.w.latin.family}"`, fontWeight: c.w.latin.weight, fontSize: u * T.h2, lineHeight: 1, color: c.p.ink, letterSpacing: `${(c.w.latin.track ?? 0) * 0.55}em`, marginRight: `-${(c.w.latin.track ?? 0) * 0.55}em`, textTransform: c.w.latin.upper ? 'uppercase' : undefined, whiteSpace: 'nowrap', textShadow: photo ? `0 2px ${u}px rgba(0,0,0,.35)` : undefined }}>{s.mark}</div>
          <div style={{ width: u * 6, height: Math.max(2, u * 0.18), background: c.p.accent }} />
          {s.sub && <div data-qa="over" style={{ fontFamily: `"${c.w.text.family}"`, fontWeight: c.w.text.weight, fontSize: u * T.lead, lineHeight: 1.4, color: c.p.accent, direction: 'rtl' }}>{s.sub}</div>}
        </div>
      ))}
      {s.sub && !s.mark && A({ x: m, y: photo ? top + u * 6 : H - bottom - u * 12, w: W - 2 * m }, <Text text={s.sub} world={c.w} pal={c.p} size={u * T.body} min={u * 2.8} box={{ w: W - 2 * m, h: u * 9 }} align="center" color={c.p.ink} onPhoto={photo} />)}
    </>
  );
};

// J: collage of cards and stickers at angles (MNJM, Chahi, Thmanyah board)
const collage = (c: Ctx) => {
  const { s, W, H, u, m, top } = c;
  return (
    <>
      {s.pattern && <Pattern text={s.pattern} world={c.w} color={c.p.dim} size={u * T.h3} W={W} H={H} opacity={0.15} />}
      <Backdrop c={c} toward="none" />
      {(s.cards ?? []).map((cd, k) => (
        <div key={k} style={{ position: 'absolute', left: cd.x * W, top: cd.y * H, width: cd.w * W, height: cd.h * H, transform: `rotate(${cd.rot ?? (k % 2 ? 4 : -5)}deg)`, background: '#f4f1ea',   /* print paper, whatever the palette */ padding: u * 1.2, paddingBottom: cd.caption ? u * 6 : u * 1.2, boxShadow: `0 ${u}px ${u * 2.5}px rgba(0,0,0,.35)` }}>
          <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}><Picture pic={cd} r={{ x: 0, y: 0, w: cd.w * W - u * 2.4, h: cd.h * H - u * (cd.caption ? 7.2 : 2.4) }} gid={c.gid} /></div>
          {cd.caption && <div style={{ position: 'absolute', bottom: u * 1.4, right: u * 2, fontFamily: `"${c.w.hand?.family ?? c.w.text.family}"`, fontWeight: c.w.hand?.weight ?? 700, fontSize: u * T.body, color: c.p.ground, direction: 'rtl' }}>{cd.caption}</div>}
          {(c.field?.devices.tape ?? true) && <Img src={staticFile(`textures/cut/tape-masking-${(k % 2) + 1}.png`)} style={{ position: 'absolute', top: -u * 2.2, left: k % 2 ? '52%' : '30%', width: u * 13, transform: `rotate(${k % 2 ? 6 : -5}deg)`, opacity: 0.92 }} />}
        </div>
      ))}
      {A({ x: m, y: top + u * 4, w: W - 2 * m }, (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: u * 1.6, direction: 'rtl' }}><Seq>
          <Kicker c={c} text={s.kicker} />
          <Head c={c} size={u * T.h1} box={{ w: W - 2 * m, h: H * 0.3 }} bars={{}} />
        </Seq></div>
      ))}
    </>
  );
};

// a ground is light when the palette sets dark ink on it (olive grounds carry white ink, so they count as dark)
const lightGround = (p: Palette) => contrast(p.ink, '#ffffff') > contrast(p.ink, '#000000');
const hair = (p: Palette, u: number) => ({ height: Math.max(1, u * 0.12), background: p.dim, opacity: 0.45 });

/** A thin row of facts: a label over a value, divided by hairlines (developer brochures, Villa Blanc cards). */
const Facts: React.FC<{ c: Ctx; w: number; ink?: string }> = ({ c, w, ink }) => {
  const { s, u, p } = c;
  const n = s.facts?.length ?? 0;
  if (!n) return null;
  return (
    <div style={{ width: w, display: 'flex', flexDirection: 'column', gap: u * 2.2 }}>
      <div style={{ width: w, ...hair(p, u) }} />
      <div style={{ display: 'flex', direction: 'rtl', width: w }}>
        {s.facts!.map((f, k) => (
          <div key={k} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: u * 0.7, paddingInline: u * 1.6, borderInlineStart: k ? `${Math.max(1, u * 0.12)}px solid ${p.dim}66` : undefined }}>
            <div data-qa="over" style={{ fontFamily: `"${c.w.text.family}"`, fontWeight: c.w.text.weight, fontSize: u * T.micro, lineHeight: 1.3, color: ink ? ink : p.dim, opacity: ink ? 0.8 : 1 }}>{f.label}</div>
            <div data-qa="over" style={{ fontFamily: `"${c.w.text.family}"`, fontWeight: c.w.text.bold, fontSize: u * T.lead, lineHeight: 1.25, color: ink ?? p.ink }}>{digits(f.value, c.w)}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

// K: the place photographed big, a short promise, a thin row of facts (developers, hotels). On a light brand ground the
// photo takes the top and the words sit on the ground under it; on a dark ground the words sit on the photo's darkened foot.
const showcase = (c: Ctx): React.ReactNode => {
  const { s, W, H, u, m, top, bottom, p } = c;
  // words at the top: the photo was made with an empty upper third for them (generated heroes); the photo fills the frame
  if (s.textAt === 'top' && (s.bg || s.art)) {   // with a drawn layer and no photo the words keep the same place on the plain ground
    const tb = s.textBox, bx = tb && tb.length > 2 ? W * tb[2]! : m, cw = tb && tb.length > 3 ? W * tb[3]! : W - 2 * m, bh = tb ? H * tb[1] : H * (c.tall ? 0.26 : 0.3), by = tb ? H * tb[0] : top + u * 10;
    const onDark = !lightGround(p);
    return (
      <>
        {s.bg && <Settle><Picture pic={s.bg} r={{ x: 0, y: 0, w: W, h: H }} gid={c.gid} /></Settle>}
        <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: by + bh + u * 8, display: s.bg && !s.bare ? undefined : 'none', background: `linear-gradient(180deg, ${p.ground}${onDark ? 'cc' : '99'} 0%, ${p.ground}00 100%)` }} />
        {A({ x: bx, y: by, w: cw, h: bh }, (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: u * 1.8 }}><Seq>
            {s.kicker && <Pill text={digits(s.kicker, c.w)} world={c.w} pal={p} u={u} filled size={T.body} />}
            <Head c={c} size={u * T.h1} box={{ w: cw, h: s.textBox ? bh : bh * 0.78 }} align="center" />
            {s.sub && <Text text={s.sub} world={c.w} pal={p} size={u * T.body} box={{ w: cw * 0.8, h: u * 9 }} color={p.ink} align="center" />}
          </Seq></div>
        ))}
      </>
    );
  }
  if (c.wide && !c.col && s.bg && lightGround(p)) return (
    <><Settle><Picture pic={s.bg} r={{ x: 0, y: 0, w: W * 0.5, h: H }} gid={c.gid} /></Settle><Column c={c} f={showcase} /></>
  );
  const panel = lightGround(p) || !s.bg || !!c.col;
  const footH = u * 11;                                  // the frame's bottom row (contact, CTA)
  const blockH = c.col ? H * 0.6 : panel ? H * (c.tall ? 0.36 : 0.4) : H * 0.42;
  const blockBottom = c.col ? H / 2 + blockH / 2 : H - bottom - footH;
  const photoH = panel ? blockBottom - blockH - u * 4 : H;
  const cw = W - 2 * m;
  return (
    <>
      {s.bg && !c.col && (panel
        ? <Settle><Picture pic={s.bg} r={{ x: 0, y: 0, w: W, h: photoH }} gid={c.gid} /></Settle>
        : <Backdrop c={c} toward="bottom" strength={0.94} />)}
      {s.bg && panel && !c.col && <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: top + u * 14, background: `linear-gradient(180deg, ${p.ground}e6 0%, ${p.ground}00 100%)` }} />}
      {!s.bg && <Light pal={p} at={[50, 30]} size={60} vignette={0.2} />}
      {c.brand?.motif?.kind === 'aegean' && panel && !c.col && <>
        <Mosaic tiles={c.brand.motif.tiles!} cell={u * 6.2} cols={6} rows={2} seed={5} style={{ left: 0, top: photoH - u * 6.2 }} />
        <Asterisk size={u * 18} color={p.accent2 ?? p.accent} stroke={1.6} style={{ right: m * 0.6, top: photoH - u * 11 }} />
      </>}
      {A({ x: m, y: blockBottom - blockH, w: cw, h: blockH }, (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'flex-start', gap: u * 2.2, direction: 'rtl' }}><Seq>
          {s.kicker && <Meta text={digits(s.kicker, c.w)} world={c.w} color={panel ? p.accent : p.ink} size={u * T.body} style={{ marginBottom: u * 1.6 }} />}
          <Head c={c} size={u * T.h1} box={{ w: cw * 0.92, h: blockH * 0.46 }} />
          {s.sub && <Text text={s.sub} world={c.w} pal={p} size={u * T.body} min={u * 2.8} box={{ w: cw * 0.86, h: u * 10 }} color={panel ? p.dim : p.ink} onPhoto={!panel} lead={1.6} />}
          <Facts c={c} w={cw} />
        </Seq></div>
      ))}
    </>
  );
};

// L: an offer card : picture, name, then rows of what and how much.
const offer = (c: Ctx) => {
  const { s, W, H, u, m, top, bottom, p } = c;
  const cw = W - 2 * m;
  const logoRoom = u * 10;
  const picH = H * (c.tall ? 0.34 : 0.4);
  const picY = top + logoRoom;
  const rows = s.rows ?? [];
  const rowH = u * 9.5;
  const textY = picY + picH + u * 4;
  const pic = s.bg ?? s.pic;
  return (
    <>
      <Light pal={p} at={[50, 20]} size={70} vignette={0.15} />
      {pic && <Picture pic={pic} r={{ x: m, y: picY, w: cw, h: picH }} gid={c.gid} radius={u * 2.4} shadow="none" style={{ boxShadow: c.field?.devices.shadow === 'soft' ? `0 ${u}px ${u * 3}px rgba(0,0,0,.18)` : undefined }} />}
      {s.kicker && A({ x: m + u * 2, y: picY + u * 2 }, <Pill text={digits(s.kicker, c.w)} world={c.w} pal={p} u={u} filled size={T.micro} />, { right: m + u * 2, left: undefined })}
      {A({ x: m, y: textY, w: cw, h: H - bottom - u * 11 - textY }, (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: u * 1.4, direction: 'rtl' }}><Seq>
          <Head c={c} size={u * T.h2} box={{ w: cw, h: u * 11 }} />
          {s.sub && <Text text={s.sub} world={c.w} pal={p} size={u * T.body} min={u * 2.8} box={{ w: cw, h: u * 6 }} color={p.dim} />}
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: u * 1.2 }}>
            {rows.map((r, k) => (
              <div key={k} style={{ height: rowH, display: 'flex', alignItems: 'center', justifyContent: 'space-between', direction: 'rtl', borderTop: `${Math.max(1, u * 0.12)}px solid ${p.dim}55`, borderBottom: k === rows.length - 1 ? `${Math.max(1, u * 0.12)}px solid ${p.dim}55` : undefined }}>
                <div data-qa="over" style={{ fontFamily: `"${c.w.text.family}"`, fontWeight: c.w.text.bold, fontSize: u * T.lead, color: p.ink, lineHeight: 1.3 }}>{r.label}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: u * 1.2, direction: 'rtl' }}>
                  <div data-qa="over" style={{ fontFamily: `"${c.w.display.family}"`, fontWeight: c.w.display.weight, fontSize: u * T.h3, color: p.accent === p.ground ? p.ink : p.ink, lineHeight: 1 }}>{digits(r.value, c.w)}</div>
                  {r.note && <div data-qa="over" style={{ fontFamily: `"${c.w.text.family}"`, fontWeight: c.w.text.weight, fontSize: u * T.micro, color: p.dim, lineHeight: 1.25, whiteSpace: 'pre-line', textAlign: 'right' }}>{r.note}</div>}
                </div>
              </div>
            ))}
          </div>
        </Seq></div>
      ))}
    </>
  );
};

// M: the product answering in its own interface (a payment app's screens, a chat demo). The conversation is the proof.
const chat = (c: Ctx) => {
  const { s, W, H, u, m, top, bottom, p } = c;
  const cw = W - 2 * m;
  const headY = top + u * 9;
  const headH = H * (c.tall ? 0.17 : 0.2);
  const panelY = headY + headH + u * 3;
  const footH = u * 11;
  const mascotH = s.pic ? H * 0.26 : 0;
  const panelH = H - bottom - footH - panelY - (s.pic ? mascotH * 0.45 : 0);
  const bubble = (from: 'me' | 'bot'): React.CSSProperties => ({
    maxWidth: cw * 0.78, padding: `${u * 1.6}px ${u * 2.2}px ${u * 1.9}px`, borderRadius: u * 2.6,
    background: from === 'me' ? p.accent : p.ground, color: from === 'me' ? inkOn(p.accent, p) : p.ink,
    alignSelf: from === 'me' ? 'flex-end' : 'flex-start',                  // RTL: the reader's own messages sit on the left
    borderEndEndRadius: from === 'bot' ? u * 0.6 : u * 2.6, borderEndStartRadius: from === 'me' ? u * 0.6 : u * 2.6,
  });
  const body = (t: string, from: 'me' | 'bot') => t.split('\n').map((ln, i) => {
    if (ln.includes('|')) {
      const [a, b] = ln.split('|');
      return <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: u * 3, fontSize: u * T.body, lineHeight: 1.7, borderTop: `${Math.max(1, u * 0.1)}px dashed ${from === 'me' ? '#ffffff55' : p.dim + '66'}` }}><span>{a.trim()}</span><span style={{ fontFamily: `"${c.w.latin.family}"`, fontWeight: 500, direction: 'ltr' }}>{b.trim()}</span></div>;
    }
    return <div key={i} style={{ fontSize: u * T.lead, lineHeight: 1.5 }}>{ln}</div>;
  });
  return (
    <>
      <Light pal={p} at={[50, 40]} size={70} vignette={0.15} />
      {A({ x: m, y: headY, w: cw, h: headH }, (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', gap: u * 1.4, direction: 'rtl' }}><Seq>
          {s.kicker && <Meta text={digits(s.kicker, c.w)} world={c.w} color={p.accent} size={u * T.body} />}
          <Head c={c} size={u * T.h1} box={{ w: cw, h: headH * 0.8 }} bars={c.field?.devices.bars && s.head.includes('*') ? undefined : undefined} />
        </Seq></div>
      ))}
      {A({ x: m, y: panelY, w: cw, h: panelH }, (
        <div data-qa-group="chat" style={{ height: '100%', borderRadius: u * 3.4, background: p.paper ?? p.ground2, boxShadow: `0 ${u * 1.2}px ${u * 4}px rgba(0,0,0,.12)`, border: `${Math.max(1, u * 0.12)}px solid ${p.dim}33`, display: 'flex', flexDirection: 'column', overflow: 'hidden', direction: 'rtl' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: u * 1.6, padding: `${u * 1.8}px ${u * 2.4}px`, borderBottom: `${Math.max(1, u * 0.12)}px solid ${p.dim}33` }}>
            {s.pic && <div style={{ width: u * 7, height: u * 7, borderRadius: '50%', overflow: 'hidden', background: p.accent2 ?? p.accent, flex: 'none' }}><Img src={staticFile(s.pic.src)} style={{ width: '100%', height: '160%', objectFit: 'cover', objectPosition: '50% 8%' }} /></div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: u * 0.3 }}>
              <div data-qa="over" style={{ fontFamily: `"${c.w.text.family}"`, fontWeight: c.w.text.bold, fontSize: u * T.lead, color: p.ink, lineHeight: 1.2 }}>{s.name ?? ''}</div>
              {s.role && <div data-qa="over" style={{ fontFamily: `"${c.w.text.family}"`, fontWeight: c.w.text.weight, fontSize: u * T.micro, color: p.accent, lineHeight: 1.2 }}>{s.role}</div>}
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: u * 2, padding: `${u * 2.4}px ${u * 2.4}px` }}><Seq>
            {(s.chat ?? []).map((b, k) => <div key={k} data-qa="over" style={{ ...bubble(b.from), fontFamily: `"${c.w.text.family}"`, fontWeight: c.w.text.weight }}>{body(b.text, b.from)}</div>)}
          </Seq></div>
        </div>
      ))}
      {s.pic && <Picture pic={{ ...s.pic, cut: true, anchor: '0% 100%' }} r={{ x: m * 0.4, y: H - bottom - footH - mascotH, w: W * 0.34, h: mascotH }} gid={c.gid} shadow="none" />}
      {s.sub && A({ x: W - m - cw * 0.6, y: H - bottom - footH - u * 11, w: cw * 0.6, h: u * 10 }, <div style={{ height: '100%', display: 'flex', alignItems: 'flex-end' }}><Text text={s.sub} world={c.w} pal={p} size={u * T.body} min={u * 2.8} box={{ w: cw * 0.6, h: u * 10 }} color={p.dim} /></div>)}
    </>
  );
};

/** The brand's own background pattern, tiled faintly over the ground. */
const BrandPattern: React.FC<{ c: Ctx }> = ({ c }) => {
  const pt = c.brand?.pattern;
  if (!pt) return null;
  return <AbsoluteFill style={{ backgroundImage: `url(${staticFile(pt.src)})`, backgroundSize: `${c.u * pt.size}px ${c.u * pt.size}px`, opacity: pt.opacity, mixBlendMode: lightGround(c.p) ? 'multiply' : 'screen' }} />;
};
const gold = (p: Palette) => `linear-gradient(180deg, #fffbe2 0%, ${p.accent2 ?? '#e6dfa0'} 38%, #c9a640 70%, #8f6a1c 100%)`;

/** A lettered series title (عرض الخميس): gold face, a dark extrusion, a slight tilt and three burst strokes. */
const SeriesTitle: React.FC<{ c: Ctx; text: string; h: number; w: number }> = ({ c, text, h, w }) => {
  const lines = text.split('\n');
  const big = h / (lines.length > 1 ? 1.75 : 1.1);
  const deep = '#1f1e0e';
  return (
    <div data-qa="over" style={{ position: 'relative', width: w, height: h, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', transform: 'rotate(-5deg)' }}>
      {lines.map((ln, i) => {
        const size = i === lines.length - 1 ? big : big * 0.62;
        return (
          <div key={i} style={{ fontFamily: `"${c.w.display.family}"`, fontWeight: 800, fontSize: size, lineHeight: 0.98, whiteSpace: 'nowrap', direction: 'rtl', color: 'transparent', backgroundImage: gold(c.p), WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextStroke: `${size * 0.025}px ${deep}`, filter: `drop-shadow(0 ${size * 0.06}px 0 ${deep}) drop-shadow(0 ${size * 0.02}px ${size * 0.05}px rgba(0,0,0,.45))`, marginInlineEnd: i === 0 && lines.length > 1 ? w * 0.18 : 0 }}>{ln}</div>
        );
      })}
      {lines.length > 1 && [-35, 0, 35].map((a, k) => (
        <div key={k} style={{ position: 'absolute', left: w * 0.2 + Math.sin((a * Math.PI) / 180) * h * 0.05, top: h * 0.08 - Math.cos((a * Math.PI) / 180) * h * 0.02 + k * 0, width: h * 0.035, height: h * 0.12, borderRadius: h, background: deep, transform: `rotate(${a - 40}deg)`, transformOrigin: '50% 100%' }} />
      ))}
    </div>
  );
};

/** Capsule photo windows (1 to 3), the middle one taller, each in a white rim. */
const Capsules: React.FC<{ c: Ctx; pics: NonNullable<DesignSpec['photos']>; r: { x: number; y: number; w: number; h: number } }> = ({ c, pics, r }) => {
  const n = Math.min(3, pics.length);
  const gap = -r.w * 0.012;
  const sideW = n === 1 ? r.w * 0.42 : (r.w - gap * (n - 1)) / (n + 0.25);
  const midW = n === 3 ? sideW * 1.25 : sideW;
  const rim = Math.max(3, c.u * 0.55);
  const order = n === 3 ? [0, 1, 2] : pics.slice(0, n).map((_, i) => i);
  return (
    <div style={{ position: 'absolute', left: r.x, top: r.y, width: r.w, height: r.h, display: 'flex', justifyContent: 'center', alignItems: 'center', gap, direction: 'rtl' }}>
      {order.map((i) => {
        const mid = n === 3 && i === 1;
        const w = mid ? midW : sideW, h = mid ? r.h : r.h * 0.84;
        return (
          <div key={i} style={{ position: 'relative', width: w, height: h, borderRadius: w, overflow: 'hidden', border: `${rim}px solid #ffffff`, boxShadow: `0 ${c.u}px ${c.u * 2.6}px rgba(0,0,0,.28)`, zIndex: mid ? 2 : 1, flex: 'none', boxSizing: 'border-box', background: c.p.ground2 }}>
            <Picture pic={pics[i]} r={{ x: 0, y: 0, w: w - rim * 2, h: h - rim * 2 }} gid={c.gid} />
          </div>
        );
      })}
    </div>
  );
};

/** The price card: a label, the number with its currency sign, and the tax note. */
const PriceCard: React.FC<{ c: Ctx; w: number; h: number }> = ({ c, w, h }) => {
  const { s, u, p } = c;
  const pr = s.price!;
  const ink = c.brand?.priceInk ?? p.accent;
  const small = (t: string, color: string) => <div data-qa="over" style={{ fontFamily: `"${c.w.text.family}"`, fontWeight: c.w.text.bold, fontSize: u * T.micro, lineHeight: 1.3, color, whiteSpace: 'pre', textAlign: 'center' }}>{t}</div>;
  return (
    <div style={{ width: w, height: h, borderRadius: u * 1.6, background: '#ffffff', boxShadow: `0 ${u * 0.8}px ${u * 2.4}px rgba(0,0,0,.22)`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: u * 2.2, direction: 'rtl', paddingInline: u * 2.4 }}>
      {pr.from && small(pr.from, '#2b2b2b')}
      <div style={{ display: 'flex', alignItems: 'center', gap: u * 0.9, direction: 'rtl' }}>
        <div data-qa="over" style={{ fontFamily: `"${c.w.display.family}"`, fontWeight: 800, fontSize: h * 0.78, lineHeight: 1, color: ink, letterSpacing: '-0.02em', direction: 'ltr' }}>{digits(pr.value, c.w)}</div>
        <Currency code={pr.currency} h={h * 0.42} color={ink} font={c.w.text.family} weight={c.w.text.bold} />
      </div>
      {pr.note && small(pr.note, '#2b2b2b')}
    </div>
  );
};

/** A row of amenities: line icons over two-line labels. */
const Amenities: React.FC<{ c: Ctx; w: number; ink: string }> = ({ c, w, ink }) => {
  const { s, u } = c;
  const items = s.amenities ?? [];
  if (!items.length) return null;
  return (
    <div style={{ width: w, display: 'flex', justifyContent: 'center', gap: u * 2.6, direction: 'rtl' }}>
      {items.map((a, k) => (
        <div key={k} style={{ minWidth: u * 11, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u * 0.9 }}>
          <Icon name={a.icon} size={u * 6.2} color={ink} stroke={1.5} />
          <div data-qa="over" style={{ fontFamily: `"${c.w.text.family}"`, fontWeight: c.w.text.bold, fontSize: u * T.micro, lineHeight: 1.25, color: ink, textAlign: 'center', whiteSpace: 'pre' }}>{a.label}</div>
        </div>
      ))}
    </div>
  );
};

/** Payment acceptance marks in one row (public/brands/pay, sources in SOURCES.md). BNPL wordmarks sit in their pills. */
const PayMarks: React.FC<{ names: NonNullable<Brand['payments']>; h: number }> = ({ names, h }) => {
  const img = (f: string, hh: number) => <Img src={staticFile(`brands/pay/${f}`)} style={{ height: hh, width: 'auto', display: 'block' }} />;
  const pill = (bg: string, child: React.ReactNode) => <div style={{ height: h, paddingInline: h * 0.32, borderRadius: h * 0.28, background: bg, display: 'flex', alignItems: 'center', flex: 'none' }}>{child}</div>;
  const mark: Record<string, React.ReactNode> = {
    tamara: pill('linear-gradient(90deg, #f9c8a8 0%, #f2b9d8 45%, #c7c2f7 75%, #a8e4f0 100%)', img('tamara-black.svg', h * 0.44)),
    tabby: pill('#3effc0', <div style={{ color: '#000000', height: h * 0.5, display: 'flex' }}>{img('tabby-wordmark.svg', h * 0.5)}</div>),
    applepay: img('applepay-white.svg', h * 0.78),
    googlepay: img('googlepay-white.svg', h * 0.78),
    visa: img('visa.svg', h * 0.58),
    mastercard: img('mastercard.svg', h * 0.86),
    mada: img('mada.svg', h * 0.6),
  };
  return <div style={{ display: 'flex', alignItems: 'center', gap: h * 0.4, direction: 'ltr' }}>{names.map((n) => <React.Fragment key={n}>{mark[n]}</React.Fragment>)}</div>;
};

/** The brand's contact strip along the foot of an offer post. */
export const BrandFooter: React.FC<{ c: Ctx }> = ({ c }) => {
  const art = c.brand?.footerArt;
  if (art) {
    const k = c.W / 1080;
    const lift = c.H / c.W > 1.6 ? c.bottom * 0.75 : c.bottom * 0.15;
    return (
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: lift, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: c.u * 1.2 }}>
        <Img src={staticFile(art.row)} style={{ width: art.rowW * k, height: 'auto', display: 'block' }} />
        {c.brand?.payments?.length ? <PayMarks names={c.brand.payments} h={c.u * 2.6} /> : art.pay && <Img src={staticFile(art.pay)} style={{ width: (art.payW ?? 300) * k, height: 'auto', display: 'block' }} />}
      </div>
    );
  }
  const items = c.brand?.footer;
  if (!items?.length) return null;
  const { u, m, W, bottom, p } = c;
  const ink = lightGround(p) ? p.ink : '#ffffff';
  return (
    <div style={{ position: 'absolute', left: m * 0.6, right: m * 0.6, bottom: bottom * 0.5, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u * 1 }}>
      <div style={{ width: W - m * 1.2, ...hair(p, u), background: ink, opacity: 0.35 }} />
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: u * 2.4, rowGap: u * 0.4, direction: 'rtl' }}>
        {items.map((t, k) => <div key={k} data-qa="over" style={{ fontFamily: `"${/[؀-ۿ]/.test(t) ? c.w.text.family : c.w.latin.family}"`, fontWeight: 500, fontSize: u * T.micro * 0.8, lineHeight: 1.3, color: ink, direction: /[؀-ۿ]/.test(t) ? 'rtl' : 'ltr', whiteSpace: 'nowrap' }}>{digits(t, c.w)}</div>)}
      </div>
    </div>
  );
};

// N: the weekly offer card : series title, hotel name, capsule photos, discount, price, amenities.
const deal = (c: Ctx): React.ReactNode => {
  const { s, W, H, u, m, top, bottom, p } = c;
  const B = H - top - bottom;
  const y = (f: number) => top + B * (f + (c.col ? 0.1 : 0));
  const cw = W - 2 * m;
  const ink = lightGround(p) ? p.ink : '#ffffff';
  const hasSeries = !!s.series;
  const headTop = hasSeries ? 0.205 : 0.055;
  const headH = (s.kicker ? 0.045 : 0) + 0.06 + (s.sub ? 0.05 : 0);
  const ph0 = headTop + headH + 0.025;
  const ph1 = c.col ? ph0 : s.deal ? 0.56 : 0.6;
  const priceH = B * 0.075;
  if (c.wide && !c.col) return (
    <>
      <Light pal={p} at={[50, 12]} size={45} vignette={0.3} />
      <BrandPattern c={c} />
      {s.photos?.length ? <Capsules c={c} pics={s.photos} r={{ x: m, y: top + u * 6, w: W * 0.46, h: H - top - bottom - u * 12 }} /> : null}
      <Column c={c} f={deal} />
    </>
  );
  return (
    <>
      {!c.col && <Light pal={p} at={[50, 12]} size={45} vignette={0.3} />}
      {!c.col && <BrandPattern c={c} />}
      {hasSeries && A({ x: m, y: y(0.04), w: cw, h: B * 0.14 }, <div style={{ display: 'flex', justifyContent: 'center' }}><SeriesTitle c={c} text={s.series!} h={B * 0.135} w={cw * 0.62} /></div>)}
      {A({ x: m, y: y(headTop), w: cw, h: B * headH }, (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: u * 0.8 }}>
          {s.kicker && <Meta text={s.kicker} world={c.w} color={p.accent2 ?? p.accent} size={u * T.body} />}
          <Head c={c} size={u * T.h2} box={{ w: cw * 0.9, h: B * 0.058 }} align="center" />
          {s.sub && <div data-qa="over" style={{ fontFamily: `"${c.w.text.family}"`, fontWeight: c.w.text.bold, fontSize: u * T.micro, color: ink, border: `${Math.max(2, u * 0.18)}px solid ${ink}`, borderRadius: u * 3, padding: `${u * 0.2}px ${u * 1.8}px ${u * 0.4}px`, lineHeight: 1.3, direction: 'rtl', whiteSpace: 'nowrap' }}>{s.sub}</div>}
        </div>
      ))}
      {s.photos?.length && !c.col ? <Capsules c={c} pics={s.photos} r={{ x: W / 2 - cw * 0.39, y: y(ph0), w: cw * 0.78, h: B * (ph1 - ph0) }} /> : null}
      {s.deal && A({ x: W / 2 - cw * 0.34, y: y(ph1 + 0.02), w: cw * 0.68, h: B * 0.085 }, (
        <div style={{ height: '100%', border: `${Math.max(2, u * 0.2)}px solid ${ink}`, borderRadius: u * 0.8, display: 'flex', alignItems: 'center', justifyContent: 'space-around', direction: 'rtl', paddingBottom: priceH * 0.25 }}>
          {s.deal.before && <div data-qa="over" style={{ fontFamily: `"${c.w.text.family}"`, fontWeight: c.w.text.bold, fontSize: u * T.body, color: ink, lineHeight: 1.2, whiteSpace: 'pre-line', textAlign: 'center' }}>{s.deal.before}</div>}
          <div data-qa="over" style={{ fontFamily: `"${c.w.display.family}"`, fontWeight: 800, fontSize: B * 0.068, lineHeight: 1, color: 'transparent', backgroundImage: gold(p), WebkitBackgroundClip: 'text', backgroundClip: 'text', direction: 'ltr' }}>{digits(s.deal.big, c.w)}</div>
          {s.deal.after && <div data-qa="over" style={{ fontFamily: `"${c.w.text.family}"`, fontWeight: c.w.text.bold, fontSize: u * T.body, color: ink, lineHeight: 1.2, whiteSpace: 'pre-line', textAlign: 'center' }}>{s.deal.after}</div>}
        </div>
      ))}
      {s.price && A({ x: W / 2 - cw * 0.36, y: y(s.deal ? ph1 + 0.115 : ph1 + 0.03), w: cw * 0.72, h: priceH }, <PriceCard c={c} w={cw * 0.72} h={priceH} />)}
      {A({ x: m, y: y(c.col ? ph1 + (s.deal ? 0.25 : 0.16) : 0.77), w: cw, h: B * 0.1 }, <Amenities c={c} w={cw} ink={ink} />)}
    </>
  );
};

// O: a recurring quiz card : gold question marks, a hashtag, the question in a framed panel.
const quiz = (c: Ctx) => {
  const { s, W, H, u, m, top, bottom, p } = c;
  const B = H - top - bottom;
  const y = (f: number) => top + B * f;
  const ink = lightGround(p) ? p.ink : '#ffffff';
  const px = m * 0.85, pw = W - 2 * px, py = y(0.36), phh = B * 0.4;
  const panel = p.bar ?? p.ground2;
  const qm = (size: number, rot: number, style: React.CSSProperties) => (
    <div style={{ position: 'absolute', fontFamily: `"${c.w.display.family}"`, fontWeight: 800, fontSize: size, lineHeight: 1, color: 'transparent', backgroundImage: gold(p), WebkitBackgroundClip: 'text', backgroundClip: 'text', transform: `rotate(${rot}deg) scaleX(-1)`, filter: `drop-shadow(${size * 0.03}px ${size * 0.05}px 0 #5c4512) drop-shadow(0 ${size * 0.06}px ${size * 0.08}px rgba(0,0,0,.35))`, ...style }}>?</div>
  );
  const quoteMark = (ch: string, style: React.CSSProperties) => <div style={{ position: 'absolute', fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: u * 20, lineHeight: 1, color: p.accent2 ?? '#e6dfa0', ...style }}>{ch}</div>;
  return (
    <>
      <Light pal={p} at={[50, 45]} size={80} vignette={0.25} />
      <BrandPattern c={c} />
      {qm(u * 19, -14, { left: m * 0.5, top: top * 0.3 })}
      {qm(u * 9, 10, { right: m * 1.1, top: y(0.13) })}
      {s.kicker && A({ x: m, y: y(0.19), w: W - 2 * m, h: u * 6 }, <div style={{ display: 'flex', justifyContent: 'center' }}><Meta text={s.kicker} world={c.w} color={ink} size={u * T.lead} /></div>)}
      <div style={{ position: 'absolute', left: px + u * 1.4, top: py + u * 1.4, width: pw, height: phh, borderRadius: u * 2.2, border: `${Math.max(3, u * 0.45)}px solid ${p.accent2 ?? '#e6dfa0'}` }} />
      {A({ x: px, y: py, w: pw, h: phh }, (
        <div style={{ height: '100%', borderRadius: u * 2.2, background: panel, boxShadow: `0 ${u}px ${u * 3}px rgba(0,0,0,.25)`, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: `${u * 4}px ${u * 4}px` }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u * 1.6 }}>
            <Text text={s.head} world={c.w} pal={p} size={u * T.h3} min={u * T.lead} box={{ w: pw - u * 8, h: phh - u * 15 }} color="#ffffff" bold align="center" lead={1.75} />
            {s.sub && <Text text={s.sub} world={c.w} pal={p} size={u * T.lead} min={u * T.body} box={{ w: pw - u * 8, h: u * 6 }} color="#ffffff" align="center" lead={1.4} />}
          </div>
        </div>
      ))}
      {quoteMark('“', { left: px - u * 1, top: py - u * 9.5 })}
      {quoteMark('”', { right: px - u * 3, top: py + phh - u * 6.5 })}
    </>
  );
};

/** A rose motif: five round petals and a ring, outlined . */
let flowerN = 0;
const Flower: React.FC<{ size: number; ink: string; fill?: string; center?: string; stroke?: number; style?: React.CSSProperties }> = ({ size, ink, fill, center, stroke = 4.6, style }) => {
  const id = React.useMemo(() => `fl${flowerN++}`, []);
  const d = 24.5, r = 22.5, ir = 10.5;
  const cs = Array.from({ length: 5 }, (_, k) => [50 + d * Math.sin((2 * Math.PI * k) / 5), 50 - d * Math.cos((2 * Math.PI * k) / 5)]);
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} style={{ position: 'absolute', overflow: 'visible', ...style }}>
      <defs>
        <mask id={`${id}o`}>{cs.map(([x, y], k) => <circle key={k} cx={x} cy={y} r={r} fill="#fff" />)}</mask>
        <mask id={`${id}i`}><rect x="-10" y="-10" width="120" height="120" fill="#fff" />{cs.map(([x, y], k) => <circle key={k} cx={x} cy={y} r={r - stroke} fill="#000" />)}<circle cx="50" cy="50" r={d} fill="#000" /></mask>
      </defs>
      {fill && <rect x="-10" y="-10" width="120" height="120" fill={fill} mask={`url(#${id}o)`} />}
      <g mask={`url(#${id}o)`}><rect x="-10" y="-10" width="120" height="120" fill={ink} mask={`url(#${id}i)`} /></g>
      <circle cx="50" cy="50" r={ir} fill={center ?? 'none'} stroke={ink} strokeWidth={stroke} />
    </svg>
  );
};
/** The brand device placed large and cropped by the frame, the way the guideline's pages carry it. */
const Motif: React.FC<{ c: Ctx; at: 'bl' | 'tr' | 'br' | 'tl'; size: number; ink?: string; fill?: string | null }> = ({ c, at, size, ink, fill }) => {
  const mo = c.brand?.motif;
  if (!mo) return null;
  const off = -size * 0.38;
  const pos: React.CSSProperties = { bl: { left: off, bottom: off }, br: { right: off, bottom: off }, tl: { left: off, top: off }, tr: { right: off, top: off } }[at];
  return <Flower size={size} ink={ink ?? mo.ink} fill={fill === null ? undefined : fill ?? mo.fill} center={fill === null ? undefined : mo.center} stroke={3.4} style={pos} />;
};

// P: the partner named (BRAND x PARTNER): the photo on top, the partner's logo on a white card across its edge, the line under.
const partner = (c: Ctx) => {
  const { s, W, H, u, m, top, bottom, p } = c;
  const cw = W - 2 * m;
  // with a cut-out person: the lettering on top, the brand's rose behind them, the partner's logo on a card at their chest
  if (s.pic?.cut) {
    const headY = top + u * 10, headH = H * (c.tall ? 0.2 : 0.24);
    const figY = headY + headH - u * 2, figH = H - figY;
    const rose = W * (c.wide ? 0.5 : 0.98);
    const cardW = W * (c.wide ? 0.26 : 0.44), cardH = cardW * 0.62;
    const pr = s.partner;
    return (
      <>
        <AbsoluteFill style={{ background: p.ground }} />
        <Light pal={p} at={[50, 62]} size={70} vignette={0.2} />
        <Settle><Flower size={rose} ink={c.brand?.motif?.ink ?? '#000'} fill={p.accent2} center={p.ground} stroke={2.4} style={{ left: W * 0.35 - rose / 2, top: figY + u * 3 }} /></Settle>
        <Picture pic={{ ...s.pic, anchor: s.pic.anchor ?? '50% 0%' }} r={{ x: -W * 0.1, y: figY + u * 2, w: W * 0.9, h: figH * 1.32 }} gid={c.gid} shadow="none" />
        {A({ x: m, y: headY, w: cw, h: headH }, <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}><Head c={c} size={u * T.h1} box={{ w: cw, h: headH }} align="center" /></div>)}
        {pr && A({ x: W - m - cardW, y: H - bottom - u * 8 - cardH, w: cardW, h: cardH }, (
          <div style={{ height: '100%', background: '#ffffff', borderRadius: u * 1.6, border: `${u * 0.5}px solid #000000`, boxShadow: `${u * 0.9}px ${u * 0.9}px 0 #000000`, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: u }}>
            <Img src={staticFile(pr.src)} style={{ height: cardH * 0.58, width: 'auto' }} />
            {pr.tag && <div style={{ fontFamily: '"Poppins"', fontWeight: 500, fontSize: cardW * 0.034, letterSpacing: '0.1em', color: '#111111', whiteSpace: 'nowrap' }}>{pr.tag}</div>}
          </div>
        ))}
      </>
    );
  }
  const photoH = H * (c.tall ? 0.56 : 0.6);
  const cardW = W * (c.wide ? 0.34 : 0.56), cardH = cardW * 0.62;
  const cardY = photoH - cardH * 0.55;
  const textY = cardY + cardH + u * 4;
  const pr = s.partner;
  return (
    <>
      <AbsoluteFill style={{ background: p.ground }} />
      {s.bg && <Picture pic={s.bg} r={{ x: 0, y: 0, w: W, h: photoH }} gid={c.gid} style={{ filter: `blur(${u * 0.12}px) saturate(1.05)` }} />}
      {s.bg && <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: photoH, background: `linear-gradient(180deg, rgba(0,0,0,.45) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 70%, rgba(0,0,0,.25) 100%)` }} />}
      {pr && A({ x: W / 2 - cardW / 2, y: cardY, w: cardW, h: cardH }, (
        <div style={{ height: '100%', background: '#ffffff', borderRadius: u * 1.2, boxShadow: `0 ${u * 1.2}px ${u * 4}px rgba(0,0,0,.25)`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: u * 1.2 }}>
          <Img src={staticFile(pr.src)} style={{ height: cardH * 0.6, width: 'auto' }} />
          {pr.tag && <div style={{ fontFamily: '"Poppins"', fontWeight: 500, fontSize: u * T.micro, letterSpacing: '0.12em', color: '#111111', whiteSpace: 'nowrap' }}>{pr.tag}</div>}
        </div>
      ))}
      {A({ x: m, y: textY, w: cw, h: H - bottom - u * 11 - textY }, (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: u * 2.4 }}><Seq>
          <Head c={c} size={u * T.h2} box={{ w: cw * 0.9, h: u * 10 }} align="center" />
          {pr?.name && <div data-qa="over" style={{ fontFamily: `"${c.w.latin.family}"`, fontWeight: c.w.latin.weight, fontSize: u * T.h2, lineHeight: 1.05, color: p.ink, whiteSpace: 'nowrap', direction: 'ltr' }}>{pr.name}</div>}
          {s.sub && <Text text={s.sub} world={c.w} pal={p} size={u * T.body} box={{ w: cw * 0.8, h: u * 8 }} color={p.ink} align="center" />}
        </Seq></div>
      ))}
    </>
  );
};

// Q: an equation in icons (contract amount = share down payment + maintenance deposit) or two answers side by side.
const equation = (c: Ctx) => {
  const { s, W, H, u, m, top, bottom, p } = c;
  const cw = W - 2 * m;
  const eq = s.equation ?? { items: [] };
  const n = eq.items.length;
  const dia = u * (n <= 2 ? 26 : 19);
  const ink = p.ink;
  const headY = top + u * 12, headH = H * (c.tall ? 0.2 : 0.22);
  const rowH = dia + u * 14;
  const rowY = Math.max(headY + headH + u * 6, (headY + headH + H - bottom - u * 12) / 2 - rowH / 2);
  const op = (t: string, k: number) => <div key={`o${k}`} data-qa="over" style={{ fontFamily: `"${c.w.display.family}"`, fontWeight: c.w.display.weight, fontSize: u * 13, lineHeight: 1, color: p.ink, alignSelf: 'flex-start', marginTop: dia * 0.5 - u * 7.5, flex: 'none' }}>{t}</div>;
  const badge = (mk: 'yes' | 'no') => (
    <div style={{ position: 'absolute', right: -dia * 0.04, top: -dia * 0.04, width: dia * 0.36, height: dia * 0.36, borderRadius: '50%', background: mk === 'yes' ? '#1e9e4a' : '#d92b2b', border: `${u * 0.5}px solid #ffffff`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 ${u * 0.3}px ${u}px rgba(0,0,0,.25)` }}>
      <Icon name={mk === 'yes' ? 'check' : 'x'} size={dia * 0.22} color="#ffffff" stroke={3} />
    </div>
  );
  const item = (it: (typeof eq.items)[number], k: number) => it.total ? (
    <div key={`i${k}`} style={{ minWidth: dia * 1.1, minHeight: dia, borderRadius: u * 2.2, background: p.bar ?? '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: u * 2.4, flex: 'none', boxSizing: 'border-box', boxShadow: s.bg ? undefined : `${u * 0.9}px ${u * 0.9}px 0 ${p.accent}` }}>
      <div data-qa="over" style={{ fontFamily: `"${c.w.display.family}"`, fontWeight: 800, fontSize: u * T.h3, lineHeight: 1.35, color: p.barInk ?? '#fff', textAlign: 'center', whiteSpace: 'pre' }}>{it.label}</div>
    </div>
  ) : (
    <div key={`i${k}`} style={{ minWidth: dia * 1.1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u * 2.2, flex: 'none' }}>
      <div style={{ position: 'relative', width: dia, height: dia, borderRadius: '50%', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', border: s.bg ? undefined : `${u * 0.55}px solid #000000`, boxShadow: s.bg ? `0 ${u}px ${u * 3}px rgba(0,0,0,.3)` : `${u * 0.9}px ${u * 0.9}px 0 #000000` }}>
        <Icon name={it.icon} size={dia * 0.5} color="#000000" stroke={1.5} />
        {it.mark && badge(it.mark)}
      </div>
      <div data-qa="over" style={{ fontFamily: `"${c.w.text.family}"`, fontWeight: c.w.text.bold, fontSize: u * T.lead, lineHeight: 1.4, color: ink, textAlign: 'center', whiteSpace: 'pre', textShadow: s.bg ? '0 1px 6px rgba(0,0,0,.5)' : undefined }}>{it.label}</div>
    </div>
  );
  const row: React.ReactNode[] = [];
  eq.items.forEach((it, k) => { if (k) { const o = eq.ops?.[k - 1]; if (o) row.push(op(o, k)); } row.push(item(it, k)); });
  return (
    <>
      <AbsoluteFill style={{ background: p.ground }} />
      {s.bg
        ? <><Picture pic={s.bg} r={{ x: -u * 3, y: -u * 3, w: W + u * 6, h: H + u * 6 }} gid={c.gid} style={{ filter: `blur(${u * 0.5}px)` }} /><AbsoluteFill style={{ background: `linear-gradient(180deg, ${p.ground}b3 0%, ${p.ground}59 45%, ${p.ground}8c 100%)` }} /></>
        : <><Motif c={c} at="br" size={W * 0.55} fill={null} ink={p.accent2 ?? p.accent} /><Motif c={c} at="tl" size={W * 0.3} fill={null} ink={p.accent2 ?? p.accent} /></>}
      {A({ x: m, y: headY, w: cw, h: headH }, (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: u * 1.2 }}><Seq>
          {s.kicker && <Meta text={s.kicker} world={c.w} color={p.accent} size={u * T.body} />}
          <Head c={c} size={u * T.h1} box={{ w: cw * 0.94, h: headH * 0.92 }} align="center" />
        </Seq></div>
      ))}
      {A({ x: m, y: rowY, w: cw }, <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', gap: n <= 2 ? u * 9 : u * 2.2, direction: 'rtl' }}>{row}</div>)}
      {s.sub && A({ x: m, y: H - bottom - u * 24, w: cw, h: u * 10 }, <Text text={s.sub} world={c.w} pal={p} size={u * T.body} box={{ w: cw * 0.8, h: u * 10 }} color={ink} align="center" />)}
    </>
  );
};

/** Aegean mosaic: a block of square tiles in the brand blues, some split on the diagonal. Deterministic. */
const Mosaic: React.FC<{ tiles: string[]; cell: number; cols: number; rows: number; seed: number; style: React.CSSProperties }> = ({ tiles, cell, cols, rows, seed, style }) => {
  let r = seed * 9301 + 49297;
  const rnd = () => { r = (r * 9301 + 49297) % 233280; return r / 233280; };
  const cells = Array.from({ length: cols * rows }, () => {
    const a = tiles[Math.floor(rnd() * tiles.length)], b = tiles[Math.floor(rnd() * tiles.length)], t = rnd(), ang = [45, 135, 225, 315][Math.floor(rnd() * 4)];
    return t < 0.38 && a !== b ? `linear-gradient(${ang}deg, ${a} 50%, ${b} 50%)` : a;
  });
  return <div style={{ position: 'absolute', display: 'grid', gridTemplateColumns: `repeat(${cols}, ${cell}px)`, ...style }}>{cells.map((bg, i) => <div key={i} style={{ width: cell, height: cell, background: bg }} />)}</div>;
};
/** The brochure's hand-drawn asterisk: eight long thin petals from one centre. */
const Asterisk: React.FC<{ size: number; color: string; stroke?: number; rot?: number; style: React.CSSProperties }> = ({ size, color, stroke = 1.5, rot = 12, style }) => {
  const petals = Array.from({ length: 8 }, (_, k) => {
    const a = (k * Math.PI) / 4 + (rot * Math.PI) / 180, L = 46 + (k % 3) * 2;
    const p = (rr: number, da: number) => `${(50 + rr * Math.cos(a + da)).toFixed(2)} ${(50 + rr * Math.sin(a + da)).toFixed(2)}`;
    return `M50 50 C ${p(9, 0.55)}, ${p(L - 2, 0.09)}, ${p(L, 0)} C ${p(L - 2, -0.09)}, ${p(9, -0.55)}, 50 50 Z`;
  });
  return <svg viewBox="0 0 100 100" width={size} height={size} style={{ position: 'absolute', overflow: 'visible', ...style }}><path d={petals.join(' ')} fill="none" stroke={color} strokeWidth={stroke} strokeLinejoin="round" /></svg>;
};
/** A loose hand-drawn swoosh (the brochure's corner loops). */
const Swoosh: React.FC<{ w: number; color: string; stroke?: number; flip?: boolean; style: React.CSSProperties }> = ({ w, color, stroke = 2.2, flip, style }) => (
  <svg viewBox="0 0 200 120" width={w} height={w * 0.6} style={{ position: 'absolute', overflow: 'visible', transform: flip ? 'scaleX(-1)' : undefined, ...style }}>
    <path d="M4 116 C 30 40, 90 10, 196 6" fill="none" stroke={color} strokeWidth={stroke * 2} strokeLinecap="round" />
  </svg>
);

// R: a lettered title, then the place seen through a Greek arch, facts on a band across its foot.
const arch = (c: Ctx): React.ReactNode => {
  const { s, W, H, u, m, top, bottom, p } = c;
  const cw = W - 2 * m;
  const tiles = c.brand?.motif?.tiles ?? [p.accent, p.accent2 ?? p.accent];
  const headY = top + u * 14, headH = H * (c.tall ? 0.2 : 0.22);
  // wide: the arch stands in the left half at full height, the words go to the column on the right
  const aw = c.wide ? W * 0.38 : W * 0.74, ay = c.wide ? top + u * 2 : headY + headH + u * 3, ah = H - bottom - (c.wide ? u * 2 : u * 9) - ay;
  const ax = c.wide ? W * 0.25 - aw / 2 : W / 2 - aw / 2, rim = u * 1.4;
  const n = s.facts?.length ?? 0;
  if (c.col) return A({ x: m, y: top + u * 12, w: cw, h: H - top - bottom - u * 24 }, <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Head c={c} size={u * T.h1} box={{ w: cw, h: (H - top - bottom) * 0.6 }} align="center" /></div>);
  return (
    <>
      <AbsoluteFill style={{ background: p.ground }} />
      <Mosaic tiles={tiles} cell={u * 6.2} cols={4} rows={3} seed={3} style={{ left: 0, top: 0 }} />
      <Mosaic tiles={tiles} cell={u * 6.2} cols={5} rows={2} seed={11} style={{ right: 0, bottom: 0 }} />
      <Swoosh w={u * 26} color={p.ink} style={{ right: -u * 2, top: top + u * 4 }} flip />
      {c.wide ? <Column c={c} f={arch} /> : A({ x: m, y: headY, w: cw, h: headH }, <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Head c={c} size={u * T.h1} box={{ w: cw, h: headH }} align="center" /></div>)}
      <div style={{ position: 'absolute', left: ax + u * 2.2, top: ay + u * 2.2, width: aw, height: ah, borderRadius: `${aw / 2}px ${aw / 2}px 0 0`, border: `${Math.max(2, u * 0.25)}px solid ${p.ink}` }} />
      <div style={{ position: 'absolute', left: ax, top: ay, width: aw, height: ah, borderRadius: `${aw / 2}px ${aw / 2}px 0 0`, background: tiles[0], padding: rim, boxSizing: 'border-box' }}>
        <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: `${aw / 2 - rim}px ${aw / 2 - rim}px 0 0`, overflow: 'hidden' }}>
          {s.bg && <Settle><Picture pic={s.bg} r={{ x: 0, y: 0, w: aw - rim * 2, h: ah - rim * 2 }} gid={c.gid} /></Settle>}
        </div>
      </div>
      {n > 0 && A({ x: ax, y: ay + ah - u * 11, w: aw, h: u * 11 }, (
        <div style={{ height: '100%', background: p.paper ?? '#fff', display: 'flex', alignItems: 'center', direction: 'rtl', borderTop: `${rim}px solid ${tiles[0]}` }}>
          {s.facts!.map((f, k) => (
            <div key={k} style={{ flex: 1, textAlign: 'center', borderInlineStart: k ? `${Math.max(1, u * 0.15)}px solid ${p.ink}33` : undefined }}>
              <div data-qa="over" style={{ fontFamily: `"${c.w.display.family}"`, fontWeight: c.w.display.weight, fontSize: u * T.body * 1.2, lineHeight: 1.1, color: p.accent, whiteSpace: 'nowrap' }}>{digits(f.value, c.w)}</div>
              <div data-qa="over" style={{ fontFamily: `"${c.w.text.family}"`, fontWeight: c.w.text.bold, fontSize: u * T.micro, lineHeight: 1.3, color: p.ink, whiteSpace: 'nowrap' }}>{f.label}</div>
            </div>
          ))}
        </div>
      ))}
      <Asterisk size={u * 20} color={p.accent2 ?? tiles[2]} stroke={1.6} style={{ left: ax - u * 11, top: ay + u * 4 }} />
      <Asterisk size={u * 12} color={p.ink} stroke={1.3} rot={30} style={{ left: ax + aw + u * 1, top: ay + ah * 0.45 }} />
    </>
  );
};

// S: a unit page: the area lettered big, the floor plan as the object on a tile-blue backing, rooms in a table.
const plan = (c: Ctx): React.ReactNode => {
  const { s, W, H, u, m, top, bottom, p } = c;
  const cw = W - 2 * m;
  const tiles = c.brand?.motif?.tiles ?? [p.accent, p.accent2 ?? p.accent];
  const headY = top + u * 13, headH = H * 0.2;
  const tableH = Math.ceil((s.rows?.length ?? 0) / 2) * u * 6.6;
  const planY = headY + headH + u * 4, planH = Math.max(H * 0.22, Math.min(c.tall ? H * 0.27 : H * 0.3, H - bottom - u * 12 - tableH - u * 7 - planY));
  const rows = s.rows ?? [];
  const tableY = c.col ? headY + headH + u * 6 : planY + planH + u * 7;
  const half = Math.ceil(rows.length / 2);
  const cell = (r: (typeof rows)[number], k: number) => (
    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: u * 2, padding: `${u * 1.1}px 0`, borderBottom: `${Math.max(1, u * 0.15)}px solid ${p.ink}26`, direction: 'rtl' }}>
      <div data-qa="over" style={{ fontFamily: `"${c.w.text.family}"`, fontWeight: c.w.text.bold, fontSize: u * T.body, color: p.ink, lineHeight: 1.2 }}>{r.label}</div>
      <div data-qa="over" style={{ fontFamily: `"${c.w.text.family}"`, fontWeight: c.w.text.bold, fontSize: u * T.body, color: p.accent, lineHeight: 1.2, direction: 'ltr' }}>{r.value}</div>
    </div>
  );
  if (c.wide && !c.col) {
    const px = m, pw = W * 0.5 - m * 1.5, ph = pw / ((s.pic as { ratio?: number } | undefined)?.ratio ?? 2.6) + u * 2.8, py = H / 2 - ph / 2;
    return (
      <>
        <AbsoluteFill style={{ background: p.ground }} />
        <Mosaic tiles={tiles} cell={u * 6.2} cols={5} rows={2} seed={7} style={{ right: 0, top: 0 }} />
        <Swoosh w={u * 24} color={p.ink} style={{ left: -u * 3, top: top + u * 2 }} />
        <div style={{ position: 'absolute', left: 0, top: py + u * 3, width: px + pw + u * 3, height: ph, background: tiles[2] }} />
        {s.pic && A({ x: px, y: py, w: pw, h: ph }, <div style={{ height: '100%', background: '#ffffff', padding: u * 1.4, boxSizing: 'border-box', boxShadow: `0 ${u}px ${u * 3}px rgba(0,0,0,.12)` }}><Img src={staticFile(s.pic.src)} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /></div>)}
        <Column c={c} f={plan} />
      </>
    );
  }
  return (
    <>
      {!c.col && <AbsoluteFill style={{ background: p.ground }} />}
      {!c.col && <Mosaic tiles={tiles} cell={u * 6.2} cols={5} rows={2} seed={7} style={{ right: 0, top: 0 }} />}
      {!c.col && <Swoosh w={u * 24} color={p.ink} style={{ left: -u * 3, top: top + u * 2 }} />}
      {A({ x: m, y: headY, w: cw, h: headH }, <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}><Head c={c} size={u * T.h1} box={{ w: cw * 0.8, h: headH }} /></div>)}
      {!c.col && <div style={{ position: 'absolute', left: 0, top: planY + u * 3, width: W - m * 0.5, height: planH, background: tiles[2] }} />}
      {s.pic && !c.col && A({ x: m, y: planY, w: cw, h: planH }, (
        <div style={{ height: '100%', background: '#ffffff', padding: u * 1.4, boxSizing: 'border-box', boxShadow: `0 ${u}px ${u * 3}px rgba(0,0,0,.12)` }}>
          <Img src={staticFile(s.pic.src)} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
      ))}
      {rows.length > 0 && A({ x: m, y: tableY, w: cw }, (
        <div style={{ display: 'flex', gap: u * 6, direction: 'rtl' }}>
          <div style={{ flex: 1 }}>{rows.slice(0, half).map(cell)}</div>
          <div style={{ flex: 1 }}>{rows.slice(half).map((r, k) => cell(r, k + half))}</div>
        </div>
      ))}
      {!c.col && <Asterisk size={u * 16} color={p.ink} stroke={1.3} style={{ left: W - m - u * 15, top: headY + u * 1 }} />}
    </>
  );
};

/** The brand's wave ground ): its own pattern image under everything, cover. */
const WaveGround: React.FC<{ c: Ctx }> = ({ c }) => {
  const src = c.brand?.motif?.kind === 'waves' ? c.brand.motif.src : undefined;
  return <><AbsoluteFill style={{ background: c.p.ground }} />{src && <Settle><Img src={staticFile(src)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} /></Settle>}</>;
};
const wavePath = (W: number, y: number, amp: number, H: number, phase = 0) => {
  const n = 3, seg = W / n;
  let d = `M0 ${y + Math.sin(phase) * amp}`;
  for (let i = 0; i < n; i++) d += ` C ${seg * i + seg * 0.35} ${y - amp}, ${seg * i + seg * 0.65} ${y + amp}, ${seg * (i + 1)} ${y + (i % 2 ? -1 : 1) * amp * 0.2}`;
  return `${d} L ${W} ${H} L 0 ${H} Z`;
};

// T: the lettering on the brand's waves, the place below a wave-cut edge, facts as white chips on the photo.
const wave = (c: Ctx) => {
  const { s, W, H, u, m, top, bottom, p } = c;
  const cw = W - 2 * m;
  const headY = top + u * 17, headH = H * (c.tall ? 0.21 : 0.24);
  const edge = headY + headH + u * 6, amp = u * 4.5;
  const n = s.facts?.length ?? 0;
  return (
    <>
      <WaveGround c={c} />
      {A({ x: m, y: headY, w: cw, h: headH }, <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Head c={c} size={u * T.h1} box={{ w: cw, h: headH }} align="center" /></div>)}
      <svg width={W} height={H} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
        <path d={wavePath(W, edge - u * 2.4, amp, H, 0.4)} fill="none" stroke="#ffffff" strokeWidth={u * 0.35} opacity={0.9} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, clipPath: `path('${wavePath(W, edge, amp, H)}')` }}>
        {s.bg && <Settle><Picture pic={s.bg} r={{ x: 0, y: edge - amp, w: W, h: H - edge + amp }} gid={c.gid} /></Settle>}
        <AbsoluteFill style={{ background: 'linear-gradient(0deg, rgba(0,0,0,.45) 0%, rgba(0,0,0,0) 32%)' }} />
      </div>
      {n > 0 && A({ x: m, y: H - bottom - u * 26, w: cw }, (
        <div style={{ display: 'flex', justifyContent: 'center', gap: u * 1.6, direction: 'rtl', flexWrap: 'wrap' }}>
          {s.facts!.map((f, k) => (
            <div key={k} style={{ background: '#ffffff', borderRadius: u * 5, padding: `${u * 1.2}px ${u * 2.6}px`, display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: `0 ${u * 0.6}px ${u * 2}px rgba(0,0,0,.25)` }}>
              <div data-qa="over" style={{ fontFamily: `"${c.w.display.family}"`, fontWeight: c.w.display.weight, fontSize: u * T.lead, lineHeight: 1.1, color: p.ground, whiteSpace: 'nowrap' }}>{digits(f.value, c.w)}</div>
              <div data-qa="over" style={{ fontFamily: `"${c.w.text.family}"`, fontWeight: c.w.text.bold, fontSize: u * T.micro, lineHeight: 1.25, color: '#2a0a17', whiteSpace: 'nowrap' }}>{f.label}</div>
            </div>
          ))}
        </div>
      ))}
    </>
  );
};

// U: smart home: the place in a rounded screen, the app's answers as chips floating over its edges.
const device = (c: Ctx) => {
  const { s, W, H, u, m, top, bottom, p } = c;
  const cw = W - 2 * m;
  const headY = top + u * 17, headH = H * (c.tall ? 0.19 : 0.22);
  const sw = W * (c.wide ? 0.4 : 0.76), sy = headY + headH + u * 4, sh = H - bottom - u * 10 - sy, sx = W / 2 - sw / 2;
  const chips = s.amenities ?? [];
  const spots = [{ x: sx - u * 7, y: sy + sh * 0.12 }, { x: sx + sw - u * 30, y: sy + sh * 0.42 }, { x: sx - u * 4, y: sy + sh * 0.74 }];
  return (
    <>
      <WaveGround c={c} />
      {A({ x: m, y: headY, w: cw, h: headH }, <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Head c={c} size={u * T.h1} box={{ w: cw, h: headH }} align="center" /></div>)}
      <div style={{ position: 'absolute', left: sx, top: sy, width: sw, height: sh, borderRadius: u * 5, border: `${u * 1.1}px solid #ffffff`, overflow: 'hidden', boxShadow: `0 ${u * 2}px ${u * 6}px rgba(60,0,20,.45)`, boxSizing: 'border-box' }}>
        {s.bg && <Settle><Picture pic={s.bg} r={{ x: 0, y: 0, w: sw - u * 2.2, h: sh - u * 2.2 }} gid={c.gid} /></Settle>}
      </div>
      {chips.slice(0, 3).map((ch, k) => A({ x: spots[k].x, y: spots[k].y }, (
        <div style={{ display: 'flex', alignItems: 'center', gap: u * 1.4, background: 'rgba(255,255,255,.96)', borderRadius: u * 3, padding: `${u * 1.2}px ${u * 2.2}px ${u * 1.2}px ${u * 1.2}px`, boxShadow: `0 ${u}px ${u * 3}px rgba(0,0,0,.25)`, direction: 'rtl' }}>
          <div style={{ width: u * 7, height: u * 7, borderRadius: '50%', background: p.ground, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Icon name={ch.icon} size={u * 4} color="#ffffff" stroke={1.8} /></div>
          <div data-qa="over" style={{ fontFamily: `"${c.w.text.family}"`, fontWeight: c.w.text.bold, fontSize: u * T.body, lineHeight: 1.25, color: '#2a0a17', whiteSpace: 'pre' }}>{ch.label}</div>
        </div>
      )))}
    </>
  );
};


/** A verdict badge: a green tick or a red cross in a white ring. */
const Mark: React.FC<{ kind: 'yes' | 'no'; size: number; u: number }> = ({ kind, size, u }) => (
  <div style={{ width: size, height: size, borderRadius: '50%', background: kind === 'yes' ? '#1e9e4a' : '#d92b2b', border: `${u * 0.6}px solid #ffffff`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 ${u * 0.4}px ${u * 1.4}px rgba(0,0,0,.3)`, boxSizing: 'border-box' }}>
    <Icon name={kind === 'yes' ? 'check' : 'x'} size={size * 0.58} color="#ffffff" stroke={3} />
  </div>
);

// V: two sides on a slant. The first side sits on the right (where Arabic reading starts).
const compare = (c: Ctx) => {
  const { s, W, H, u, m, top, bottom, p } = c;
  const cw = W - 2 * m;
  const sides = s.compare?.side ?? [];
  const headY = top + u * 11, headH = H * (c.tall ? 0.17 : 0.2);
  const y0 = headY + headH + u * 3, y1 = H - bottom - u * 9, d = u * 7, gap = u * 1.2, mid = W / 2;
  // the side's content (icon, label) is sized to the panel it sits in, so square and wide frames do not overflow
  const ph = y1 - y0, ic = Math.min(u * 28, ph * 0.4), lab = Math.min(u * T.h3, ph * 0.085);
  // story: the panels run on under the reply bar (pictures may), the words stay above it
  const yb = H > W * 1.6 ? H : y1;
  const polys = [
    `polygon(${mid + d + gap}px ${y0}px, ${W}px ${y0}px, ${W}px ${yb}px, ${mid - d + gap}px ${yb}px)`,
    `polygon(0px ${y0}px, ${mid + d - gap}px ${y0}px, ${mid - d - gap}px ${yb}px, 0px ${yb}px)`,
  ];
  const cx = [mid + (W - mid) / 2 + d * 0.15, mid / 2 - d * 0.15];
  return (
    <>
      <AbsoluteFill style={{ background: p.ground }} />
      {A({ x: m, y: headY, w: cw, h: headH }, <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Head c={c} size={u * T.h1} box={{ w: cw, h: headH }} align="center" /></div>)}
      {sides.slice(0, 2).map((sd, k) => (
        <div key={k} style={{ position: 'absolute', inset: 0, clipPath: polys[k], background: sd.ground ?? (k ? p.ground2 : p.accent2) }}>
          {sd.src && <Picture pic={{ src: sd.src, focus: sd.focus }} r={{ x: k ? 0 : mid - d, y: y0, w: k ? mid + d : W - mid + d, h: yb - y0 }} gid={c.gid} />}
          {sd.src && <div style={{ position: 'absolute', left: 0, right: 0, top: y1 - (y1 - y0) * 0.45, height: (y1 - y0) * 0.45, background: 'linear-gradient(0deg, rgba(0,0,0,.65), rgba(0,0,0,0))' }} />}
        </div>
      ))}
      {sides.slice(0, 2).map((sd, k) => {
        const sideW = (W / 2) * 0.72;
        return (
          <React.Fragment key={`t${k}`}>
            {sd.tag && A({ x: cx[k] - sideW / 2, y: y0 + u * 3, w: sideW }, <div style={{ display: 'flex', justifyContent: 'center' }}><Pill text={sd.tag} world={c.w} pal={{ ...p, accent: '#ffffff' }} u={u} filled size={T.body} /></div>)}
            {sd.icon && A({ x: cx[k] - ic / 2, y: y0 + ph * 0.12, w: ic, h: ic }, (
              <div style={{ position: 'relative', width: ic, height: ic, borderRadius: '50%', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `${u}px ${u}px 0 rgba(0,0,0,.85)` }}>
                <Icon name={sd.icon} size={ic * 0.5} color="#000000" stroke={1.5} />
                {sd.mark && <div style={{ position: 'absolute', right: -ic * 0.05, top: -ic * 0.05 }}><Mark kind={sd.mark} size={ic * 0.36} u={u} /></div>}
              </div>
            ))}
            {sd.label && A({ x: cx[k] - sideW / 2, y: y1 - lab * 2.6 - u * 3, w: sideW, h: lab * 2.6 }, (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: u }}>
                {sd.mark && !sd.icon && <Mark kind={sd.mark} size={u * 8} u={u} />}
                <div data-qa="over" style={{ fontFamily: `"${c.w.display.family}"`, fontWeight: c.w.display.weight, fontSize: lab, lineHeight: 1.2, color: sd.src ? '#ffffff' : inkOn(sd.ground ?? p.ground, p), textAlign: 'center', whiteSpace: 'pre', textShadow: sd.src ? '0 2px 10px rgba(0,0,0,.5)' : undefined, direction: 'rtl' }}>{sd.label}</div>
              </div>
            ))}
          </React.Fragment>
        );
      })}
    </>
  );
};

// W: the door hanger. The room is the ground (graded, softened); the hanger hangs in front, the services written on it.
const hanger = (c: Ctx) => {
  const { s, W, H, u: u0, top, bottom, p } = c;
  const hy = top + u0 * 17, hh = H - bottom - u0 * 2 - hy;
  const u = u0 * Math.min(1, hh / (u0 * 104));   // the hanger's content needs about 104 units of height
  const hw = Math.min(W * 0.7, hh * 0.68), hx = W / 2 - hw / 2;
  const hole = hw * 0.24, items = s.amenities ?? [];
  const ink = '#ffffff';
  return (
    <>
      {s.bg && <Picture pic={s.bg} r={{ x: -u * 2, y: -u * 2, w: W + u * 4, h: H + u * 4 }} gid={c.gid} style={{ filter: `blur(${u * 0.5}px) contrast(1.08) saturate(1.1)` }} />}
      <AbsoluteFill style={{ background: `linear-gradient(180deg, rgba(0,0,0,.28) 0%, rgba(0,0,0,0) 28%, ${p.ground}55 100%)` }} />   {/* a lighter grade: the room stays readable, not washed out */}
      <div style={{ position: 'absolute', left: hx + u * 1.6, top: hy + u * 2.4, width: hw, height: hh, borderRadius: u * 3.4, background: 'rgba(0,0,0,.35)', filter: `blur(${u * 1.6}px)` }} />
      <Enter y={hy}><div style={{ position: 'absolute', left: hx, top: hy, width: hw, height: hh, borderRadius: u * 3.4, overflow: 'hidden', transform: 'rotate(-2.5deg)', transformOrigin: '50% 0%',
        WebkitMaskImage: `radial-gradient(circle at 50% ${hole * 0.75}px, transparent ${hole / 2}px, #000 ${hole / 2 + 1}px)`, maskImage: `radial-gradient(circle at 50% ${hole * 0.75}px, transparent ${hole / 2}px, #000 ${hole / 2 + 1}px)` }}>
        <WaveGround c={{ ...c, W: hw, H: hh }} />
        <div style={{ position: 'absolute', left: 0, right: 0, top: hole * 0.75 + hole / 2 + u * 2, display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: hw * 0.5, height: Math.max(2, u * 0.25), background: '#ffffff', opacity: 0.6 }} />
        </div>
        <div style={{ position: 'absolute', left: u * 5, right: u * 5, top: hole * 1.5 + u * 3, bottom: u * 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: u * 1.8 }}>
          <Head c={c} size={u * T.h1} box={{ w: hw - u * 10, h: hh * 0.22 }} align="center" />
          {s.sub && <div data-qa="over" style={{ fontFamily: `"${c.w.text.family}"`, fontWeight: c.w.text.bold, fontSize: u * T.body, color: p.ground, background: '#ffffff', borderRadius: u * 4, padding: `${u * 0.8}px ${u * 2.4}px`, lineHeight: 1.3, whiteSpace: 'nowrap', direction: 'rtl' }}>{s.sub}</div>}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: u * 1.1, marginTop: u * 0.8 }}>
            {items.map((a, k) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: u * 2, direction: 'rtl', paddingBottom: u * 1.4, borderBottom: k < items.length - 1 ? `${Math.max(1, u * 0.15)}px solid rgba(255,255,255,.35)` : undefined }}>
                <div style={{ width: u * 6.4, height: u * 6.4, borderRadius: '50%', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Icon name={a.icon} size={u * 3.6} color={p.ground} stroke={1.8} /></div>
                <div data-qa="over" style={{ fontFamily: `"${c.w.text.family}"`, fontWeight: c.w.text.bold, fontSize: u * T.body, lineHeight: 1.25, color: ink, whiteSpace: 'pre' }}>{a.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div></Enter>
    </>
  );
};

// X: the slip. A paper card tilted on the brand ground; each line an icon and a label, an operator in the margin, a total bar,
// and the brand's stamp pressed over the corner.
const receipt = (c: Ctx) => {
  const { s, W, H, u: u0, m, top, bottom, p } = c;
  const cw = W - 2 * m, r = s.receipt;
  const headY = top + u0 * 11, headH = H * (c.tall ? 0.18 : 0.21);
  const py = headY + headH + u0 * 4, ph = H - bottom - u0 * 8 - py;
  const u = u0 * Math.min(1, ph / (u0 * 66));      // the slip's content needs about 66 units of height
  const pw = Math.min(W * 0.78, ph * 1.25), px = W / 2 - pw / 2;
  const zig = Array.from({ length: 25 }, (_, i) => `${(i / 24) * 100}% ${i % 2 ? 100 : 100 - (u * 1.6 / ph) * 100}%`).reverse().join(', ');
  const lines = r?.lines ?? [];
  return (
    <>
      <AbsoluteFill style={{ background: p.ground }} />
      <Motif c={c} at="br" size={W * 0.5} fill={null} ink={p.accent2 ?? p.accent} />
      <Motif c={c} at="tl" size={W * 0.3} fill={null} ink={p.accent2 ?? p.accent} />
      {A({ x: m, y: headY, w: cw, h: headH }, <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Head c={c} size={u * T.h1} box={{ w: cw, h: headH }} align="center" /></div>)}
      <div style={{ position: 'absolute', left: px + u * 1.4, top: py + u * 1.8, width: pw, height: ph, background: 'rgba(0,0,0,.28)', filter: `blur(${u * 1.2}px)`, transform: 'rotate(-2deg)' }} />
      <Enter y={py}><div style={{ position: 'absolute', left: px, top: py, width: pw, height: ph, background: '#fffdf8', transform: 'rotate(-2deg)', clipPath: `polygon(0% 0%, 100% 0%, ${zig})`, padding: `${u * 5}px ${u * 5}px ${u * 7}px`, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', direction: 'rtl' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: u * 2, borderBottom: `${Math.max(2, u * 0.25)}px solid #111` }}>
          <div data-qa="over" style={{ fontFamily: `"${c.w.text.family}"`, fontWeight: c.w.text.bold, fontSize: u * T.body, color: '#111' }}>عقد حصة فندقية</div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: u * 1 }}>
          {lines.map((l, k) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: u * 2.4, padding: `${u * 2.2}px 0`, borderBottom: `${Math.max(1, u * 0.2)}px dashed #11111155` }}>
              <div style={{ width: u * 9, height: u * 9, borderRadius: '50%', border: `${u * 0.45}px solid #111`, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Icon name={l.icon ?? 'check'} size={u * 4.8} color="#111" stroke={1.7} /></div>
              <div data-qa="over" style={{ fontFamily: `"${c.w.display.family}"`, fontWeight: c.w.display.weight, fontSize: u * T.h3, lineHeight: 1.2, color: '#111' }}>{l.label}</div><div style={{ flex: 1 }} />
              {l.op && <div data-qa="over" style={{ fontFamily: `"${c.w.display.family}"`, fontWeight: 800, fontSize: u * T.h2, lineHeight: 1, color: '#111' }}>{l.op}</div>}
            </div>
          ))}
        </div>
        {r && <div style={{ background: '#111', borderRadius: u * 1.4, padding: `${u * 2.6}px ${u * 3}px`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div data-qa="over" style={{ fontFamily: `"${c.w.display.family}"`, fontWeight: c.w.display.weight, fontSize: u * T.h3, color: '#fff', lineHeight: 1.2 }}>{r.total}</div>
          <div data-qa="over" style={{ fontFamily: `"${c.w.display.family}"`, fontWeight: 800, fontSize: u * T.h2, color: p.ground, lineHeight: 1 }}>=</div>
        </div>}
      </div></Enter>
      {r?.stamp && <div style={{ position: 'absolute', left: px - u * 9, top: py + u * 1, width: u * 26, height: u * 26, borderRadius: '50%', border: `${u * 0.7}px solid ${p.accent2 ?? '#ffbd59'}`, transform: 'rotate(-14deg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: u * 0.4, background: '#111111' }}>
        <div style={{ position: 'relative', width: u * 11, height: u * 11 }}><Flower size={u * 11} ink="#ffffff" stroke={4} style={{ left: 0, top: 0 }} /></div>
        <div data-qa="over" style={{ fontFamily: `"${c.w.display.family}"`, fontWeight: c.w.display.weight, fontSize: u * T.body, color: '#ffffff', lineHeight: 1.1, textAlign: 'center' }}>{r.stamp}</div>
      </div>}
    </>
  );
};

export const ARCHETYPES: Record<DesignSpec['archetype'], (c: Ctx) => React.ReactNode> = { compare, hanger, receipt, arch, plan, wave, device, split, wall, object, sheet, sandwich, quote, steps, highlight, corners, collage, showcase, offer, chat, deal, quiz, partner, equation };

/** The fixed furniture of a series (docs/design-system.md 4.2), drawn last. */
export const Frame: React.FC<{ c: Ctx }> = ({ c }) => {
  const { s, w, p, W, H, u, m, top, bottom } = c;
  const f = s.frame ?? {};
  const sz = u * T.micro;
  const brandLogo = c.brand ? (c.brand.logo.on?.[s.palette ?? ''] ?? (lightGround(p) ? c.brand.logo.light : c.brand.logo.dark)) : undefined;
  const logoSrc = f.logo ?? brandLogo;
  const logo = logoSrc ? <Img src={staticFile(logoSrc)} style={{ height: u * (c.brand?.logo.h ?? 4.4), objectFit: 'contain' }} /> : null;
  const sl = s.slide;
  if (w.frame === 'corners') {
    const big = { fontFamily: `"${w.latin.family}"`, fontWeight: w.latin.weight, fontSize: u * (s.mark ? T.micro : T.lead), color: s.mark && contrast(p.dim, p.ground) >= 4.5 && !s.bg ? p.dim : p.ink, textShadow: s.bg ? `0 1px ${u * 0.8}px rgba(0,0,0,.45)` : undefined, textTransform: w.latin.upper ? 'uppercase' : undefined, letterSpacing: w.latin.track ? `${w.latin.track}em` : undefined, lineHeight: 1, whiteSpace: 'nowrap' } as React.CSSProperties;
    const ar = (t?: string) => t && /[؀-ۿ]/.test(t) ? { fontFamily: `"${w.display.family}"`, fontWeight: w.display.weight, letterSpacing: 0 } : {};
    return (
      <>
        {f.tl && <div data-qa="over" style={{ ...big, ...ar(f.tl), position: 'absolute', left: m, top: top * 0.62 }}>{f.tl}</div>}
        {f.tr && <div data-qa="over" style={{ ...big, ...ar(f.tr), position: 'absolute', right: m, top: top * 0.62 }}>{f.tr}</div>}
        {f.bl && <div data-qa="over" style={{ ...big, ...ar(f.bl), position: 'absolute', left: m, bottom: bottom * 0.62 }}>{f.bl}</div>}
        {f.br && <div data-qa="over" style={{ ...big, ...ar(f.br), position: 'absolute', right: m, bottom: bottom * 0.62 }}>{f.br}</div>}
        {logo && <div style={{ position: 'absolute', left: 0, right: 0, bottom: bottom * 0.55, display: 'flex', justifyContent: 'center' }}>{logo}</div>}
      </>
    );
  }
  if (w.frame === 'none') return null;
  const row = (y: 'top' | 'bottom', l?: React.ReactNode, r?: React.ReactNode, mid?: React.ReactNode) => (
    <div style={{ position: 'absolute', left: m, right: m, [y]: y === 'top' ? top * 0.55 : bottom * 0.55, display: 'flex', justifyContent: 'space-between', alignItems: 'center', direction: 'ltr', gap: u * 3 }}>
      <div>{l}</div>{mid && <div style={{ flex: 1, maxWidth: W * 0.3 }}>{mid}</div>}<div>{r}</div>
    </div>
  );
  const onPhoto = !!s.bg || (!!s.pic && !s.pic.cut && s.archetype === 'highlight');
  const metaInk = onPhoto || contrast(p.dim, p.ground) < 6 ? p.ink : p.dim;   // margin for the vignette at the corners
  const meta = (t?: string) => t ? <Meta text={digits(t, w)} world={w} color={metaInk} size={sz} style={onPhoto ? { textShadow: `0 1px ${u * 0.6}px rgba(0,0,0,.6)` } : undefined} /> : null;
  if (w.frame === 'rails') {
    return (
      <>
        {onPhoto && <AbsoluteFill style={{ background: `linear-gradient(180deg, ${p.ground}8c 0%, ${p.ground}00 ${(top * 1.5 / H) * 100}%, ${p.ground}00 ${100 - (bottom * 1.5 / H) * 100}%, ${p.ground}8c 100%)` }} />}
        {row('top', meta(f.tl), logo ?? meta(f.tr), sl && sl.n > 1 && s.archetype !== 'split' ? <Progress i={sl.i} n={sl.n} pal={p} u={u} w={W * 0.3} /> : undefined)}
        {row('bottom', meta(f.bl), meta(f.br ?? (sl && sl.n > 1 ? `${String(sl.i).padStart(2, '0')} / ${String(sl.n).padStart(2, '0')}` : undefined)))}
      </>
    );
  }
  // badge: logo at the reading corner, a contact or handle at the opposite bottom corner
  return (
    <>
      {logo && (c.field?.logo === 'center'
        ? <div style={{ position: 'absolute', left: c.wide && ['deal', 'arch', 'plan', 'showcase'].includes(s.archetype) && (s.archetype !== 'showcase' || lightGround(p)) ? W * 0.5 : 0, right: 0, top: top * 0.62, display: 'flex', justifyContent: 'center' }}>{logo}</div>
        : <div style={{ position: 'absolute', right: m, top: top * 0.7 }}>{logo}</div>)}
      {(f.tl || f.tr) && <div style={{ position: 'absolute', left: m, top: top * 0.75 }}>{meta(f.tl ?? f.tr)}</div>}
      {c.brand?.footer && (s.archetype === 'deal' || s.archetype === 'quiz')
        ? <BrandFooter c={c} />
        : c.brand?.footBar
          ? <>
              <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: bottom * 0.55 * 2 + sz * 1.2, background: p.bar ?? p.ink }} />
              {row('bottom', <Meta text={digits(f.bl ?? c.brand.contact ?? '', w)} world={w} color={p.barInk ?? p.ground} size={sz} />, f.br ? <Meta text={digits(f.br, w)} world={w} color={p.barInk ?? p.ground} size={sz} /> : null)}
            </>
          : row('bottom', meta(f.bl ?? c.brand?.contact), s.cta ? <Pill text={s.cta} world={w} pal={p} u={u} filled size={T.body} /> : meta(f.br))}
    </>
  );
};

export { Sticker, Torn };
