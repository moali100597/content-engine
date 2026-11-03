import React from 'react';
import { continueRender, delayRender, getInputProps, useCurrentFrame } from 'remotion';
import { useLayout } from './layout';

/** Layout checks that run inside the page while `node qa.mjs <id> check` renders. Elements opt in with data-qa="copy" | "caption" | "agent" | "over" (text on footage).
 *  Reports: text outside the frame or outside the copy column, a caption that wraps, headline lines that collide, the agent covering text, text on footage outside the safe margins or overlapping. */
type R = { left: number; right: number; top: number; bottom: number; height: number };
type Box = { kind: string; text: string; r: R; group: Element | null; lines: number; fs: number };
const hit = (a: R, b: R, pad = 0) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > pad && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > pad;
const shown = (el: HTMLElement) => {
  for (let n: HTMLElement | null = el; n; n = n.parentElement) if (parseFloat(getComputedStyle(n).opacity) < 0.6) return false;
  const words = el.querySelectorAll<HTMLElement>('span > span');
  return words.length === 0 || Array.from(words).some((w) => w.style.opacity !== '0');
};

export const QA: React.FC<{ t: number; quiet: boolean }> = ({ t, quiet }) => {
  const frame = useCurrentFrame();
  const { W, H, qa, safe } = useLayout();
  const probe = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (quiet || !probe.current) return;
    const hold = delayRender('qa');  // measure after the browser has laid the frame out
    requestAnimationFrame(() => requestAnimationFrame(() => { measure(); continueRender(hold); }));
  });
  const measure = () => {
    if (!probe.current) return;
    const o = probe.current.getBoundingClientRect(), z = o.width / W;  // the page may be offset and scaled: measure in composition pixels
    const norm = (r: DOMRect): R => ({ left: (r.left - o.left) / z, right: (r.right - o.left) / z, top: (r.top - o.top) / z, bottom: (r.bottom - o.top) / z, height: r.height / z });
    const boxes = Array.from(document.querySelectorAll<HTMLElement>('[data-qa]')).filter(shown).map((el) => {
      // tight box: the union of the words themselves, not the full-width line
      const parts = Array.from(el.querySelectorAll<HTMLElement>(':scope > span > span')).filter((w) => Math.abs(parseFloat(w.style.transform.replace('translateY(', '')) || 0) < 3).map((w) => w.getBoundingClientRect()).filter((r) => r.width > 0);  // words still rising are behind their mask
      if (!parts.length && el.querySelector(':scope > span > span')) return null;
      // no word spans: the union of the element and everything drawn inside it (absolutely placed lines can overflow their box)
      const inner = [el, ...Array.from(el.querySelectorAll<HTMLElement>('*'))].map((x) => x.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0);
      const own = inner.length ? new DOMRect(Math.min(...inner.map((r) => r.left)), Math.min(...inner.map((r) => r.top)), Math.max(...inner.map((r) => r.right)) - Math.min(...inner.map((r) => r.left)), Math.max(...inner.map((r) => r.bottom)) - Math.min(...inner.map((r) => r.top))) : el.getBoundingClientRect();
      const u = parts.length ? new DOMRect(Math.min(...parts.map((r) => r.left)), Math.min(...parts.map((r) => r.top)), 0, 0) : own;
      if (parts.length) { u.width = Math.max(...parts.map((r) => r.right)) - u.left; u.height = Math.max(...parts.map((r) => r.bottom)) - u.top; }
      const cs = getComputedStyle(el), lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.3;
      const lines = (el.getBoundingClientRect().height / z - parseFloat(cs.paddingTop || '0') - parseFloat(cs.paddingBottom || '0')) / lh;   // rows of text, in the element's own pixels
      return { kind: el.dataset.qa!, text: (el.textContent ?? '').trim().slice(0, 28), r: norm(u), group: el.closest('[data-qa-group]'), lines, fs: Math.max(parseFloat(cs.fontSize) || 0, ...Array.from(el.querySelectorAll<HTMLElement>('*')).map((x) => parseFloat(getComputedStyle(x).fontSize) || 0)) };
    }).filter((b): b is Box => !!b);
    const say = (m: string) => console.log(`QA|${t.toFixed(2)}|${frame}|${m}`);
    const copy = boxes.filter((b) => b.kind === 'copy'), cap = boxes.filter((b) => b.kind === 'caption'), agent = boxes.filter((b) => b.kind === 'agent');
    for (const b of copy) {
      if (b.r.left < qa.left || b.r.right > qa.right) say(`copy leaves its column: "${b.text}" (${Math.round(b.r.left)}..${Math.round(b.r.right)})`);
      if (b.r.top < qa.top || b.r.bottom > qa.bottom) say(`copy too tall: "${b.text}" (${Math.round(b.r.top)}..${Math.round(b.r.bottom)})`);
    }
    copy.forEach((a, i) => copy.slice(i + 1).forEach((b) => { if (a.group === b.group && hit(a.r, b.r, Math.min(a.r.height, b.r.height) * 0.22)) say(`copy lines collide: "${a.text}" x "${b.text}"`); }));
    for (const c of cap) {
      if (c.lines > 1.5) say(`caption wraps: "${c.text}"`);   // more than one row of text
      for (const b of copy) if (hit(c.r, b.r, 6)) say(`caption under copy: "${b.text}"`);
    }
    // text over footage: inside the safe margins, and no two pieces on top of each other
    const over = boxes.filter((b) => b.kind === 'over');
    for (const b of over) if (b.r.left < safe.side - 2 || b.r.right > W - safe.side + 2 || b.r.top < safe.top - 2 || b.r.bottom > H - safe.bottom + 2) say(`text outside the safe area: "${b.text}" (x ${Math.round(b.r.left)}..${Math.round(b.r.right)}, y ${Math.round(b.r.top)}..${Math.round(b.r.bottom)})`);
    over.forEach((a, i) => over.slice(i + 1).forEach((b) => { if (hit(a.r, b.r, 8)) say(`text pieces overlap: "${a.text}" x "${b.text}"`); }));
    for (const a of agent) for (const b of [...copy, ...cap]) if (hit(a.r, b.r, 14)) say(`agent covers ${b.kind}: "${b.text}"`);
    // a sticker may be slapped over display lettering (MNJM), never over reading text or the frame
    for (const st of boxes.filter((b) => b.kind === 'sticker')) {
      if (st.r.left < safe.side - 2 || st.r.right > W - safe.side + 2 || st.r.top < safe.top - 2 || st.r.bottom > H - safe.bottom + 2) say(`sticker outside the safe area: "${st.text}"`);
      for (const b of over) if (b.fs < Math.min(W, H) * 0.06 && hit(st.r, b.r, 8)) say(`sticker covers text: "${b.text}"`);
    }
    // nothing readable under the micro step (2.3% of the short side, about 25 px on 1080)
    // read on a phone: nothing under 2.8% of the short side (30 px on a 1080 post), and nothing thin below 4.5% (49 px)
    const minPx = Math.min(W, H) * 0.028, thinPx = Math.min(W, H) * 0.045;
    document.querySelectorAll<HTMLElement>('[data-qa] *, [data-qa]').forEach((el) => {
      const own = Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? '').trim().length > 0);
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (own && fs < minPx && shown(el)) say(`text too small: "${(el.textContent ?? '').trim().slice(0, 28)}" (${Math.round(fs)} px < ${Math.round(minPx)})`);
      else if (own && fs < thinPx && parseInt(getComputedStyle(el).fontWeight) < 400 && shown(el)) say(`text too thin to read: "${(el.textContent ?? '').trim().slice(0, 28)}" (${Math.round(fs)} px at weight ${getComputedStyle(el).fontWeight})`);
      // every run of text with its colour and box, for the contrast pass on the rendered pixels (tools/contrast.py)
      if (own && shown(el)) { const r = norm(el.getBoundingClientRect()); console.log(`TXT|${Math.round(r.left)}|${Math.round(r.top)}|${Math.round(r.right - r.left)}|${Math.round(r.height)}|${getComputedStyle(el).color}|${Math.round(fs)}|${(el.textContent ?? '').trim().slice(0, 24).replace(/\|/g, '/').replace(/\s+/g, ' ')}|${parseFloat(getComputedStyle(el).webkitTextStrokeWidth || '0') > 0 ? 'outlined' : ''}|${(el.closest('[data-qa]') as HTMLElement | null)?.dataset.qa ?? ''}`); }
    });
  };
  return <div ref={probe} style={{ position: 'absolute', left: 0, top: 0, width: W, height: 0 }} />;
};
export const qaOn = () => !!(getInputProps() as { qa?: boolean }).qa;
