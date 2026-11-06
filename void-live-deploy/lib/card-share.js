// A Verse card is easy to copy, save and paste back (owner, 2026-10-16: "each card should be easily copyable and saved and pasted").
// Copy gives readable text that ends in one code line; save downloads the same text as a file; pasting that text (or only the code line)
// into Verse reopens the card. The code carries what the card shows (title, kind, body, source links) and nothing about who made it.
// Numbers never ride in it: a reopened card earns its stats again from evidence, so a pasted code cannot claim any. Pure except bar().
import { cardSvg, plainSvg, toPng, photoData } from './card-image.js';
// a card's sources are the links in its .src boxes, never the product line (.src.vtail, void.html keepTail): the Gumroad page in that line
// is not where the answer came from, so it never makes the card read "from a source" or earn "fetched, sourced and dated" (owner, 2026-10-29)
export const SOURCE_BOX = '.src:not(.vtail)', SOURCE_LINKS = '.src:not(.vtail) a';
export const MARK = 'VERSE-CARD:'; // renamed from V01D-CARD: on 2026-10-18 with the brand; the parser below still reads every card shared before
const CODE_RE = /(?:VERSE|Verse|V01D)-CARD:([A-Za-z0-9_-]{8,12000})/;
const clip = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ').trim().slice(0, n);
const httpsOnly = (u) => (/^https:\/\/[^\s"'<>]+$/i.test(String(u || '')) ? String(u).slice(0, 300) : '');

const b64 = (s) => { const bytes = new TextEncoder().encode(s); let bin = ''; for (const b of bytes) bin += String.fromCharCode(b); return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64 = (c) => { const bin = atob(String(c).replace(/-/g, '+').replace(/_/g, '/')); const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i); return new TextDecoder().decode(bytes); };

// the whole answer, not its first 2400 characters (owner, 2026-10-17: "copy card should show the rest of the info"; the self card stopped mid-word at "rath"):
// the saved picture grows longer to hold it (lib/card-image.js fitLong) and the code line still carries only its start
export const BODY_MAX = 4e6; // no cut-off (owner, 2026-10-22: "first 8000 of 724820 characters kept" is forbidden); only the code line is short
export const TITLE_MAX = 600; // the whole ask shows as the title (owner, 2026-10-18: "make it show the whole ask"); it was 120
// a title past TITLE_MAX ends at its last whole sentence, or else at a whole word, never mid-word (owner, 2026-10-30: a pasted note's card title
// stopped at "The Versus jo")
export const cutWhole = (t, n) => {
  const s = String(t || ''); if (s.length <= n) return s;
  const cut = s.slice(0, n + 1), ends = [...cut.matchAll(/[.!?\u3002\uff01\uff1f]["'\u201d\u2019)\]]*(?=\s|$)/g)].map((m) => m.index + m[0].length).filter((i) => i <= n);
  const end = ends.length ? ends[ends.length - 1] : -1;
  return end > n * 0.4 ? s.slice(0, end).trim() : cutAtWord(s, n);
};
/** the facts a card carries, cleaned and capped: { v, t, k, b, src: [{ t, u }] }. Pure. */
export function dataOf({ title, kind, body, sources, n } = {}) {
  const gen = Math.floor(+n); // version history: how many times this card has been copied on from a pasted one (2 = the copy of a pasted card); only 2..99 ride along
  return { v: 1, ...(gen >= 2 && gen <= 99 ? { n: gen } : {}), t: cutWhole(clip(title, 4 * TITLE_MAX), TITLE_MAX), k: clip(kind, 80), b: clip(body, BODY_MAX), src: (sources || []).slice(0, 8).map((s) => ({ t: clip(s.title || s.t, 100), u: httpsOnly(s.url || s.u) })).filter((s) => s.u) }; // a source with no https link cannot be checked, so it is not carried (owner, 2026-10-26)
}
/** the code line for a card. Pure. */
// short on purpose (owner, 2026-10-17: "are the letters necessary to copy along with the card?"): the readable text above it already holds the
// whole card, so the code carries only enough to reopen it by itself (title, kind, the start of the body, two sources); a paste of the whole copied
// text gets the full body back from the readable part
// the code line's body ends at a word, never mid-word ("founded by entrepreneur Har"), and only a source with a real https link rides in it
export const cutAtWord = (t, n) => { const s = String(t || ''); if (s.length <= n) return s; const cut = s.slice(0, n), sp = cut.search(/\s\S*$/); return (sp > n * 0.5 ? cut.slice(0, sp) : cut).trim(); };
export const codeOf = (d) => { const x = dataOf({ title: d.t, kind: d.k, body: d.b, sources: d.src, n: d.n }); return MARK + b64(JSON.stringify({ ...x, b: cutAtWord(x.b, 200), src: x.src.slice(0, 2) })); };
/** the text a person copies or saves: readable, then the code. Pure. */
export function shareText(d) {
  const x = dataOf({ title: d.t, kind: d.k, body: d.b, sources: d.src, n: d.n });
  return [x.t, x.k, '', x.b, x.src.length ? '\nSources:\n' + x.src.map((s, i) => '[' + (i + 1) + '] ' + s.t + (s.u ? ' ' + s.u : '')).join('\n') : '', '\nVerse card from a-to-mind.com' + (x.n ? ' \u00b7 v' + x.n : ''), codeOf(x)].filter((l, i) => i !== 2 || l !== undefined).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
/** a link that reopens the card on the site: the short code rides in the #fragment, so it never reaches a server log. Pure. */
export const linkOf = (d, origin = 'https://a-to-mind.com') => origin.replace(/\/+$/, '') + '/#vc=' + codeOf(d).slice(MARK.length);
/** the card a #vc= link carries, or null. Pure. */
export const fromHash = (hash) => { const m = /(?:^#|&)vc=([A-Za-z0-9_-]{8,12000})/.exec(String(hash || '')); return m ? parse(MARK + m[1]) : null; };
/** the card inside a pasted text, or null: any text holding a code line, or a bare code. Pure. */
export function parse(text) {
  const m = CODE_RE.exec(String(text || '')); if (!m) return null;
  try {
    const j = JSON.parse(unb64(m[1])); if (!j || j.v !== 1 || !clip(j.t, 120)) return null;
    // the readable part (title, kind, blank line, the body, then "Verse card from a-to-mind.com") restores the whole body and every source
    const pre = String(text).slice(0, m.index).split(/\n?(?:Verse|V01D) card from a-to-mind\.com/)[0], lines = pre.split('\n'), at = lines.findIndex((l, i) => i >= 2 && l === '' && lines[0].trim() === clip(j.t, 120));
    let body = j.b, src = j.src;
    if (at >= 0) { const rest = lines.slice(at + 1).join('\n'), cut = rest.search(/\n?Sources:\n/); const full = (cut >= 0 ? rest.slice(0, cut) : rest).trim(); if (full.length > String(j.b || '').length && full.startsWith(String(j.b || '').slice(0, 40))) body = full;
      if (cut >= 0) { const found = [...rest.slice(cut).matchAll(/^\[\d+\] (.*?)(?: (https:\/\/\S+))?$/gm)].map((x) => ({ t: x[1], u: x[2] || '' })); if (found.length > (src || []).length) src = found; } }
    return dataOf({ title: j.t, kind: j.k, body, sources: src, n: j.n });
  } catch (_) { return null; }
}
/** a file name for a saved card. Pure. */
export const fileName = (d, ext = 'txt') => (String(d.t || 'card').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'card') + '.verse-card.' + ext;

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
  if (tag === 'LI' && n.getAttribute && n.getAttribute('data-bullet')) out = '- ' + out.replace(/^\s+/, ''); // a list that asks for bullets (the self card) is saved as "- " lines
  return BLOCK.test(tag) ? '\n' + out + '\n' : out;
}
/** textOf tidied: spaces collapsed inside a line, no empty lines but one between blocks that were apart. Pure. */
export const tidy = (s) => String(s || '').split('\n').map((l) => l.replace(/[ \t\u00a0]+/g, ' ').trim()).filter(Boolean).join('\n');
/** a card's title and its whole body text, before any cap (the frame's own chrome and buttons left out). */
function bodyOf(el) {
  const c = el.cloneNode(true);
  // [data-share-skip]: a part the card shows but the saved text leaves out / [data-nosave] (the self card's folded items keep their one line, not their dates and details)
  c.querySelectorAll('button, .src, .vc-art, .vc-type, .vc-adds, .vc-foot, .vc-arrows, .vc-share, style, .vtell, .sub.page-sent, [data-share-skip], [data-nosave]').forEach((x) => x.remove());
  c.querySelectorAll('[data-share-short]').forEach((x) => { x.textContent = x.getAttribute('data-share-short'); }); // ... and a long line it shows saves as its short form
  const h2 = c.querySelector('h2'), title = h2 ? h2.textContent : '';
  if (h2) h2.remove();
  return { title, body: Array.from(c.children).map((x) => tidy(textOf(x))).filter(Boolean).join('\n\n') };
}
/** what a card on the page holds, from its elements (the frame's own chrome and buttons left out). */
export function readCard(el) {
  const { title, body } = bodyOf(el);
  const kind = (el.querySelector(':scope > .vc-type') || {}).textContent || '';
  const sources = [...el.querySelectorAll(SOURCE_LINKS)].map((a) => ({ title: a.textContent.replace(/^\[\d+\]\s*/, ''), url: a.href }));
  const was = Math.floor(+(el.dataset && el.dataset.cardVersion)); // a card brought back from a paste is at version `was`; copying it again makes the next
  return dataOf({ title, kind: kind.replace(/\s+/g, ' ').trim(), body, sources, n: was >= 1 ? was + 1 : undefined });
}
/** what the card's picture is drawn from: the frame's own numbers (el._vcard, set by keep) and the card's text. */
export function imageData(el, d) {
  const c = el._vcard || {}, text = d.b || '';
  return { art: el._vcForge || ((el.querySelector(':scope > .vc-art > .vc-seal') || {}).src || ''), nouns: c.nouns, title: d.t, text, typeLine: d.k, kind: d.k, cost: c.cost, rarity: c.rarity, hue: c.hue, chapter: c.chapter, key: c.key || d.t, name: c.name, adds: c.adds, power: c.power, toughness: c.toughness, income: c.income, number: c.number, tested: c.tested, season: c.season, glyph: c.isSkill, painting: !!el._vcForge, poster: !!el.dataset.poster, sub: (el.querySelector(':scope > .sub:not([hidden])') || {}).textContent || '',
    // the self card draws its own shape (lib/card-image.js selfLayout): its words, the family bars, each block's heading and first lines; other cards: none
    self: el.classList && el.classList.contains('vc-self') ? selfImage(el) : undefined };
}
/** Verse's words without the model's fact tags ("[S2]", "[S1, S3]", "[What I said about myself most recently]"): the sources are listed on the card. Pure. */
export const readableVoice = (s) => String(s || '').replace(/\s*\[(?:S\d+(?:\s*,\s*S\d+)*|[A-Z][^\[\]]{2,60})\]/g, '').replace(/\s+([.,;:])/g, '$1').replace(/\s+/g, ' ').trim();
/** the self card's picture data from the card on the page: { voice, bars: [{ name, share, label, weak }], sections: [{ title, lines (at most 3) }] }.
 *  The interactive blocks (Correct me, Talk to me) are left out; a list gives its newest items, a block of paragraphs its sub-heading and words. */
export function selfImage(el) {
  const t = (n) => (n ? n.textContent.replace(/\s+/g, ' ').trim() : '');
  const bars = [...el.querySelectorAll('[data-fam-bar]')].map((b) => ({ name: b.dataset.name || '', share: +b.dataset.share || 0, label: b.dataset.label || '', weak: !!b.dataset.weak }));
  const sections = [...el.querySelectorAll('details.vs-sec')].filter((d) => !d.classList.contains('vs-fam') && !/^(?:correct|talk)$/.test(d.dataset.sec || '')).map((d) => {
    let lines = [...d.querySelectorAll('li[data-bullet]')].map((li) => t(li.querySelector(':scope > details > summary')) || t(li));
    // the skill-by-skill ledger: each family's heading with its newest line (the whole list is in the saved text)
    if (!lines.length && d.querySelector('.vs-fam')) lines = [...d.querySelectorAll('details.vs-fam')].map((f) => { const li = f.querySelector('li'); return t(f.querySelector(':scope > summary')) + (li ? ': ' + t(li) : ''); });
    if (!lines.length) { let head = ''; lines = []; for (const n of d.querySelectorAll('.vs-h4, .vs-p, .vs-note, .vs-lead')) { if (n.classList.contains('vs-h4')) { head = t(n); continue; } lines.push((head ? head + ': ' : '') + t(n)); head = ''; } }
    return { title: t(d.querySelector(':scope > summary')), lines: lines.map(readableVoice).filter(Boolean) };
  }).filter((s) => s.lines.length);
  return { voice: readableVoice(t(el.querySelector('.vs-voice > p'))), bars, sections };
}
const download = (blob, name) => { const u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 1000); };
/** the picture a saved card draws in its art box: the Art Forge's painting first (owner, 2026-10-17: "still no art": the copied card
 * kept the ink plate because only a subject photo was looked for), else the subject photo, else '' (the plate). A painting kept as a
 * data URL is drawn as it is; a link goes through photoData. */
export async function artPicture(el) {
  const forged = el && el.querySelector('.vc-art img.vc-forge-img'), photo = el && el.querySelector('img.vc-art-photo');
  if (forged) { const src = forged.getAttribute('src') || ''; if (/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(src)) return src; const got = await photoData(forged.src || src); if (got) return got; }
  return photo ? photoData(photo.getAttribute('src'), (el.dataset || {}).poster ? { w: 293, h: 440 } : undefined) : ''; // a film's poster is drawn at its own portrait shape
}
/** the full-content badge (asked by Verse: "a 'full-content' badge on cards that exceed 2400 characters to signal to the user that the complete
 *  data is preserved"): '' for a short card, 'whole text kept' up to BODY_MAX, and past it only what is true. Pure. */
export function fullNote(n) {
  const len = Math.max(0, Math.floor(+n) || 0);
  return len <= 2400 ? '' : 'whole text kept';
}
/** puts, updates or removes the badge in a card's share bar from the card's text now (an answer can grow after its bar is built). */
function fullMark(el, w) {
  let raw = 0; try { raw = clip(bodyOf(el).body, 1e9).length; } catch (_) { return; }
  const note = fullNote(raw); let chip = w.querySelector('.vc-full');
  if (!note) { if (chip) chip.remove(); return; }
  if (!chip) { chip = document.createElement('span'); chip.className = 'vc-full'; w.appendChild(chip); }
  if (chip.textContent !== note) chip.textContent = note; // only when it changed: rewriting the same text is a DOM change, and the page re-frames on every change (it looped forever on the Game Box)
  chip.title = raw + ' characters: copy card, save card, copy text and save text ' + (raw > BODY_MAX ? 'keep all of them' : 'keep all of them'); chip.dataset.chars = String(raw);
}
/** the self card's public link, every block open. Pure. */
export const selfLink = (origin) => String(origin || 'https://a-to-mind.com') + '/?q=' + encodeURIComponent('what do you think of yourself') + '&open=all';
/** opens every block and folded item of a card (the shared link's view). */
export function openAll(el) { el.querySelectorAll('details').forEach((d) => { d.open = true; }); el.querySelectorAll('li[data-more][hidden], li[hidden]').forEach((li) => { li.hidden = false; }); el.querySelectorAll('[data-v-more]').forEach((b) => b.setAttribute('aria-expanded', 'true')); }
/** the buttons on a card: copy card (text and picture), save card (the picture), save text. Idempotent. */
export function bar(el) {
  const had = el && el.querySelector && el.querySelector(':scope > .vc-share'); if (had) fullMark(el, had);
  if (!el || had || el.classList.contains('skyc')) return;
  const w = document.createElement('div'); w.className = 'vc-share';
  // two labelled groups (owner, 2026-10-18, UI polish): Card (copy card, save card) and Text (copy text, save text); the label is CSS (data-label), so the buttons stay first-child
  const grp = (name) => { const g = document.createElement('div'); g.className = 'vc-grp'; g.dataset.label = name; g.setAttribute('role', 'group'); g.setAttribute('aria-label', name); w.appendChild(g); return g; };
  const gCard = grp('Card'), gText = grp('Text');
  const mk = (g, label, run) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.addEventListener('pointerdown', (e) => e.stopPropagation()); b.addEventListener('click', async (e) => { e.stopPropagation(); const done = await run(); b.textContent = done; setTimeout(() => { b.textContent = label; }, 1600); }); g.appendChild(b); };
  const png = async (d) => {
    if (el.dataset && el.dataset.cardPlain !== undefined) return toPng(plainSvg({ title: d.t, text: d.b, qr: el._qr || null }), 1); // a utility card saves its plain picture (lib/card-image.js)
    const photo = (await artPicture(el)) || ''; return toPng(cardSvg({ ...imageData(el, d), photo }, { bleed: false }), 1);
  };
  mk(gCard, 'copy card', async () => {
    const d = readCard(el), text = shareText(d);
    try { if (typeof ClipboardItem !== 'undefined' && navigator.clipboard && navigator.clipboard.write) { await navigator.clipboard.write([new ClipboardItem({ 'text/plain': new Blob([text], { type: 'text/plain' }), 'image/png': png(d) })]); return 'copied'; } } catch (_) { /* the picture could not ride along: text only */ }
    try { await navigator.clipboard.writeText(text); return 'copied text'; } catch (_) { return 'select and copy'; }
  });
  mk(gCard, 'save card', async () => { const d = readCard(el); try { download(await png(d), fileName({ t: d.t }, 'png')); return 'saved'; } catch (_) { try { download(new Blob([shareText(d)], { type: 'text/plain' }), fileName({ t: d.t })); return 'saved text'; } catch (_2) { return 'could not save'; } } });
  // share (asked 2026-10-22: every card has copy, save text, save picture and share): the system share sheet with the card's text and a link
  // that reopens it; with no share sheet the link is copied. The link carries what the card shows, never who made it.
  mk(gCard, 'share', async () => {
    const d = readCard(el), url = linkOf(d, typeof location !== 'undefined' && /^https:/.test(location.origin) ? location.origin : undefined);
    try { if (navigator.share) { await navigator.share({ title: d.t.slice(0, 120), text: d.t + (d.b ? '\n\n' + d.b : ''), url }); return 'shared'; } } catch (e) { if (e && e.name === 'AbortError') return 'share'; }
    try { await navigator.clipboard.writeText(url); return 'link copied'; } catch (_) { return 'select and copy'; }
  });
  mk(gText, 'copy text', async () => { // what the answer's own "copy" pill did: the heading and the answer's words, no sources, no frame
    try { const d = readCard(el); await navigator.clipboard.writeText(d.t + (d.b ? '\n\n' + d.b : '')); return 'copied'; } catch (_) { return 'select and copy'; }
  });
  mk(gText, 'save text', async () => { try { const d = readCard(el); download(new Blob([shareText(d)], { type: 'text/plain' }), fileName({ t: d.t })); return 'saved'; } catch (_) { return 'could not save'; } });
  if (el.classList.contains('vc-self')) {
    // one link to the whole card (owner, 2026-10-22: "hard to get the whole card to us"): the public self card, every block open
    mk(gText, 'full card link', async () => { const u = selfLink(location.origin); try { await navigator.clipboard.writeText(u); } catch (_) {} try { window.open(u, '_blank', 'noopener'); } catch (_) {} return 'link copied'; });
    // a hand selection skips the inside of closed blocks (empty "- " bullets, 2026-10-22): copying inside the card copies the whole card's text instead
    el.addEventListener('copy', (e) => { try { const sel = getSelection(); if (!sel || sel.isCollapsed || !el.contains(sel.anchorNode)) return; const d = readCard(el); e.clipboardData.setData('text/plain', d.t + (d.b ? '\n\n' + d.b : '')); e.preventDefault(); } catch (_) {} });
    if (/(?:^|[?&])open=all(?:&|$)/.test(location.search)) for (const ms of [0, 1500, 4000, 9000]) setTimeout(() => openAll(el), ms); // the card fills in as its parts load
  }
  const foot = el.querySelector(':scope > .vc-foot'); if (foot) el.insertBefore(w, foot); else el.appendChild(w);
  fullMark(el, w);
  binder(el, gCard);
}
// the one card record (lib/card-deck.js): every card shown is noted on this device so it can be played (Verse Rally), and "save" pins it in the
// binder ("my cards"). Loaded only when a card is shown; a card still loading is not noted (recordOf drops it).
const recOf = (el) => { const d = readCard(el), c = el._vcard || {}; return { kind: el.dataset.deckKind || (el.dataset.skill ? 'skill' : 'answer'), game: el.dataset.deckGame || '', t: d.t, k: d.k, b: d.b, src: d.src.length, rarity: el.dataset.rarity && el.dataset.rarity !== 'answer' ? el.dataset.rarity : (c.rarity && c.rarity.name) || '' }; };
function binder(el, g) {
  if (typeof document === 'undefined' || el.dataset.noDeck !== undefined) return;
  const b = document.createElement('button'); b.type = 'button'; b.className = 'vc-save'; b.textContent = '☆ save'; b.setAttribute('aria-pressed', 'false');
  b.addEventListener('pointerdown', (e) => e.stopPropagation()); g.appendChild(b);
  const deck = import('./card-deck.js');
  const sync = () => deck.then((D) => { const on = D.isSaved(recOf(el)); b.textContent = on ? '★ saved' : '☆ save'; b.setAttribute('aria-pressed', String(on)); }).catch(() => {});
  b.addEventListener('click', (e) => { e.stopPropagation(); deck.then((D) => { D.setSaved(recOf(el), !D.isSaved(recOf(el))); sync(); }).catch(() => {}); });
  setTimeout(() => { if (el.isConnected) deck.then((D) => { D.note(recOf(el)); sync(); }).catch(() => {}); }, 2500);
}
export const SHARE_CSS = '.vcard .vc-share .vc-full{align-self:center;margin-left:auto;font-size:10.5px;letter-spacing:.08em;padding:2px 8px;border-radius:9px;border:1px solid var(--edge);color:hsl(var(--h) 45% 80%);opacity:.85;white-space:nowrap}.vcard .vc-share{display:flex;flex-wrap:wrap;align-items:center;gap:8px 18px;margin:8px 12px 0}.vcard .vc-share .vc-grp{display:flex;flex-wrap:wrap;align-items:center;gap:6px}.vcard .vc-share .vc-grp::before{content:attr(data-label);font-size:10px;letter-spacing:.16em;text-transform:uppercase;margin-right:2px;color:hsl(var(--h) 30% 76%)}.vcard .vc-share button{font:inherit;font-size:11px;letter-spacing:.1em;text-transform:uppercase;padding:4px 10px;border-radius:6px;border:1px solid var(--edge);background:rgba(255,255,255,.04);color:hsl(var(--h) 40% 78%);cursor:pointer}.vcard .vc-share button:hover,.vcard .vc-share button:focus-visible{background:rgba(255,255,255,.12);outline:none}@media (max-width:520px){.vcard .vc-share{margin:6px 6px 0}}';
