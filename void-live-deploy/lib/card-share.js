// A V01D card is easy to copy, save and paste back (owner, 2026-10-16: "each card should be easily copyable and saved and pasted").
// Copy gives readable text that ends in one code line; save downloads the same text as a file; pasting that text (or only the code line)
// into V01D reopens the card. The code carries what the card shows (title, kind, body, source links) and nothing about who made it.
// Numbers never ride in it: a reopened card earns its stats again from evidence, so a pasted code cannot claim any. Pure except bar().
import { cardSvg, toPng, photoData } from './card-image.js';
export const MARK = 'V01D-CARD:';
const CODE_RE = /V01D-CARD:([A-Za-z0-9_-]{8,12000})/;
const clip = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ').trim().slice(0, n);
const httpsOnly = (u) => (/^https:\/\/[^\s"'<>]+$/i.test(String(u || '')) ? String(u).slice(0, 300) : '');

const b64 = (s) => { const bytes = new TextEncoder().encode(s); let bin = ''; for (const b of bytes) bin += String.fromCharCode(b); return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64 = (c) => { const bin = atob(String(c).replace(/-/g, '+').replace(/_/g, '/')); const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i); return new TextDecoder().decode(bytes); };

/** the facts a card carries, cleaned and capped: { v, t, k, b, src: [{ t, u }] }. Pure. */
export function dataOf({ title, kind, body, sources, n } = {}) {
  const gen = Math.floor(+n); // version history: how many times this card has been copied on from a pasted one (2 = the copy of a pasted card); only 2..99 ride along
  return { v: 1, ...(gen >= 2 && gen <= 99 ? { n: gen } : {}), t: clip(title, 120), k: clip(kind, 80), b: clip(body, 2400), src: (sources || []).slice(0, 8).map((s) => ({ t: clip(s.title || s.t, 100), u: httpsOnly(s.url || s.u) })).filter((s) => s.t || s.u) };
}
/** the code line for a card. Pure. */
// short on purpose (owner, 2026-10-17: "are the letters necessary to copy along with the card?"): the readable text above it already holds the
// whole card, so the code carries only enough to reopen it by itself (title, kind, the start of the body, two sources); a paste of the whole copied
// text gets the full body back from the readable part
export const codeOf = (d) => { const x = dataOf({ title: d.t, kind: d.k, body: d.b, sources: d.src, n: d.n }); return MARK + b64(JSON.stringify({ ...x, b: x.b.slice(0, 200), src: x.src.slice(0, 2) })); };
/** the text a person copies or saves: readable, then the code. Pure. */
export function shareText(d) {
  const x = dataOf({ title: d.t, kind: d.k, body: d.b, sources: d.src, n: d.n });
  return [x.t, x.k, '', x.b, x.src.length ? '\nSources:\n' + x.src.map((s, i) => '[' + (i + 1) + '] ' + s.t + (s.u ? ' ' + s.u : '')).join('\n') : '', '\nV01D card from a-to-mind.com' + (x.n ? ' \u00b7 v' + x.n : ''), codeOf(x)].filter((l, i) => i !== 2 || l !== undefined).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
/** the card inside a pasted text, or null: any text holding a code line, or a bare code. Pure. */
export function parse(text) {
  const m = CODE_RE.exec(String(text || '')); if (!m) return null;
  try {
    const j = JSON.parse(unb64(m[1])); if (!j || j.v !== 1 || !clip(j.t, 120)) return null;
    // the readable part (title, kind, blank line, the body, then "V01D card from a-to-mind.com") restores the whole body and every source
    const pre = String(text).slice(0, m.index).split(/\n?V01D card from a-to-mind\.com/)[0], lines = pre.split('\n'), at = lines.findIndex((l, i) => i >= 2 && l === '' && lines[0].trim() === clip(j.t, 120));
    let body = j.b, src = j.src;
    if (at >= 0) { const rest = lines.slice(at + 1).join('\n'), cut = rest.search(/\n?Sources:\n/); const full = (cut >= 0 ? rest.slice(0, cut) : rest).trim(); if (full.length > String(j.b || '').length && full.startsWith(String(j.b || '').slice(0, 40))) body = full;
      if (cut >= 0) { const found = [...rest.slice(cut).matchAll(/^\[\d+\] (.*?)(?: (https:\/\/\S+))?$/gm)].map((x) => ({ t: x[1], u: x[2] || '' })); if (found.length > (src || []).length) src = found; } }
    return dataOf({ title: j.t, kind: j.k, body, sources: src, n: j.n });
  } catch (_) { return null; }
}
/** a file name for a saved card. Pure. */
export const fileName = (d, ext = 'txt') => (String(d.t || 'card').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'card') + '.v01d-card.' + ext;

const BLOCK = /^(P|DIV|LI|UL|OL|H[1-6]|TR|TABLE|SECTION|ARTICLE|HEADER|FOOTER|BLOCKQUOTE|PRE|FIGURE|FIGCAPTION|DL|DT|DD|DETAILS|SUMMARY|NAV|FORM|FIELDSET)$/;
/** a node's words as a reader sees them: a line per block (paragraph, list item, row), a space between side-by-side pieces (facts in a
 * flex row, tags, a label and its number). A detached copy of the card has no layout, so innerText there is textContent and glued
 * "a new one dailyEvery day" and "JavaScript0 stars0 forks" (owner's pasted cards, 2026-10-17). Works on any DOM-like node. */
export function textOf(n) {
  if (!n) return '';
  if (n.nodeType === 3) return n.nodeValue || '';
  if (n.nodeType !== 1) return '';
  const tag = String(n.tagName || '').toUpperCase();
  if (tag === 'BR') return '\n';
  if (tag === 'STYLE' || tag === 'SCRIPT') return '';
  let out = '';
  for (const k of n.childNodes || []) { const t = textOf(k); if (k.nodeType === 1 && out && t && !/\s$/.test(out) && !/^\s/.test(t)) out += ' '; out += t; }
  return BLOCK.test(tag) ? '\n' + out + '\n' : out;
}
/** textOf tidied: spaces collapsed inside a line, no empty lines but one between blocks that were apart. Pure. */
export const tidy = (s) => String(s || '').split('\n').map((l) => l.replace(/[ \t\u00a0]+/g, ' ').trim()).filter(Boolean).join('\n');
/** what a card on the page holds, from its elements (the frame's own chrome and buttons left out). */
export function readCard(el) {
  const c = el.cloneNode(true);
  c.querySelectorAll('button, .src, .vc-art, .vc-type, .vc-adds, .vc-foot, .vc-arrows, .vc-share, style, .vtell, .sub.page-sent').forEach((x) => x.remove());
  const h2 = c.querySelector('h2'), title = h2 ? h2.textContent : '';
  if (h2) h2.remove();
  const body = Array.from(c.children).map((x) => tidy(textOf(x))).filter(Boolean).join('\n\n');
  const kind = (el.querySelector(':scope > .vc-type') || {}).textContent || '';
  const sources = [...el.querySelectorAll('.src a')].map((a) => ({ title: a.textContent.replace(/^\[\d+\]\s*/, ''), url: a.href }));
  const was = Math.floor(+(el.dataset && el.dataset.cardVersion)); // a card brought back from a paste is at version `was`; copying it again makes the next
  return dataOf({ title, kind: kind.replace(/\s+/g, ' ').trim(), body, sources, n: was >= 1 ? was + 1 : undefined });
}
/** what the card's picture is drawn from: the frame's own numbers (el._vcard, set by keep) and the card's text. */
export function imageData(el, d) {
  const c = el._vcard || {}, text = d.b || '';
  return { art: el._vcForge || '', nouns: c.nouns, title: d.t, text, typeLine: d.k, kind: d.k, cost: c.cost, rarity: c.rarity, hue: c.hue, chapter: c.chapter, key: c.key || d.t, name: c.name, adds: c.adds, power: c.power, toughness: c.toughness, income: c.income, number: c.number, tested: c.tested, season: c.season, glyph: c.isSkill };
}
const download = (blob, name) => { const u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 1000); };
/** the buttons on a card: copy card (text and picture), save card (the picture), save text. Idempotent. */
export function bar(el) {
  if (!el || el.querySelector(':scope > .vc-share') || el.classList.contains('skyc')) return;
  const w = document.createElement('div'); w.className = 'vc-share';
  const mk = (label, run) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.addEventListener('pointerdown', (e) => e.stopPropagation()); b.addEventListener('click', async (e) => { e.stopPropagation(); const done = await run(); b.textContent = done; setTimeout(() => { b.textContent = label; }, 1600); }); w.appendChild(b); };
  const png = async (d) => { const ph = el.querySelector('img.vc-art-photo'), photo = ph ? await photoData(ph.getAttribute('src')) : ''; return toPng(cardSvg({ ...imageData(el, d), photo }, { bleed: false }), 1); };
  mk('copy card', async () => {
    const d = readCard(el), text = shareText(d);
    try { if (typeof ClipboardItem !== 'undefined' && navigator.clipboard && navigator.clipboard.write) { await navigator.clipboard.write([new ClipboardItem({ 'text/plain': new Blob([text], { type: 'text/plain' }), 'image/png': png(d) })]); return 'copied'; } } catch (_) { /* the picture could not ride along: text only */ }
    try { await navigator.clipboard.writeText(text); return 'copied text'; } catch (_) { return 'select and copy'; }
  });
  mk('save card', async () => { const d = readCard(el); try { download(await png(d), fileName({ t: d.t }, 'png')); return 'saved'; } catch (_) { try { download(new Blob([shareText(d)], { type: 'text/plain' }), fileName({ t: d.t })); return 'saved text'; } catch (_2) { return 'could not save'; } } });
  mk('save text', async () => { try { const d = readCard(el); download(new Blob([shareText(d)], { type: 'text/plain' }), fileName({ t: d.t })); return 'saved'; } catch (_) { return 'could not save'; } });
  const foot = el.querySelector(':scope > .vc-foot'); if (foot) el.insertBefore(w, foot); else el.appendChild(w);
}
export const SHARE_CSS = '.vcard .vc-share{display:flex;gap:8px;margin:8px 12px 0}.vcard .vc-share button{font:inherit;font-size:11px;letter-spacing:.1em;text-transform:uppercase;padding:4px 10px;border-radius:6px;border:1px solid var(--edge);background:rgba(255,255,255,.04);color:hsl(var(--h) 40% 78%);cursor:pointer}.vcard .vc-share button:hover,.vcard .vc-share button:focus-visible{background:rgba(255,255,255,.12);outline:none}@media (max-width:520px){.vcard .vc-share{margin:6px 6px 0}}';
