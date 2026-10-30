/**
 * proverb skill: a random English proverb from Wikiquote's "English proverbs" page, linked to the section it came from (no key)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "tell me a proverb", "random proverb", "wise saying".
 */
import { pickSection } from './quote.js';

export function isProverb(text) {
  return /^(?:please\s+)?(?:(?:tell|give)\s+(?:me\s+)?(?:a|another|one\s+more)\s+(?:proverb|saying)|(?:random|another)\s+(?:proverb|saying)|proverb(?:\s+please)?|(?:(?:tell|give)\s+(?:me\s+)?)?(?:an?\s+)?(?:wise|old|famous)\s+saying)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

// 2026-10-30: the skill showed one of 15 fixed lines with no source. Wikiquote's page lists 455 keywords on 2026-10-30 (Absent, Beauty, Cat, ...),
// each a list of proverbs with the books they are recorded in nested under them; the card shows one proverb and links its keyword.
const API = 'https://en.wikiquote.org/w/api.php?format=json&formatversion=2&origin=*&action=parse&redirects=1&page=English%20proverbs';
const PAGE = 'https://en.wikiquote.org/wiki/English_proverbs';
const ent = (x) => String(x).replace(/&nbsp;|&#160;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#(\d{1,6});/g, (_, n) => (+n <= 0x10ffff ? String.fromCodePoint(+n) : ''))
  .replace(/&#x([0-9a-f]{1,6});/gi, (_, n) => (parseInt(n, 16) <= 0x10ffff ? String.fromCodePoint(parseInt(n, 16)) : '')).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
/** the proverb as Wikiquote lists it, less the trailing notes on where it was recorded: "(16th century)", "(Strauss, 1994 p. 1184)", "(Citatboken)". A note that names a person, "(John Keats)", stays. Pure. */
export function cleanProverb(t) {
  let s = String(t || '').replace(/\s+/g, ' ').trim(), m;
  while ((m = s.match(/\s*\(([^()]*)\)\s*$/)) && (/\d/.test(m[1]) || /^\S+$/.test(m[1].trim()))) s = s.slice(0, m.index).trim();
  return s;
}
/** a section's HTML -> the proverbs in it: the text of each item in the top-level list, never the notes and sources nested under it. Pure. */
export function proverbsFrom(html) {
  const h = String(html || '').replace(/<!--[\s\S]*?-->/g, '').replace(/<(?:style|script)[\s\S]*?<\/(?:style|script)>/gi, '').replace(/<sup[\s\S]*?<\/sup>/gi, '');
  const out = []; let depth = 0, cur = null;
  for (const m of h.matchAll(/<(\/?)(ul|li)\b[^>]*>|[^<]+|<[^>]*>/gi)) {
    if (m[2]) {
      const tag = m[2].toLowerCase(), close = !!m[1];
      if (tag === 'ul') { if (!close && depth === 1 && cur !== null) { out.push(cur); cur = null; } depth += close ? -1 : 1; continue; }
      if (depth === 1) { if (!close) cur = ''; else if (cur !== null) { out.push(cur); cur = null; } }
      continue;
    }
    if (depth === 1 && cur !== null && m[0][0] !== '<') cur += m[0];
  }
  return out.map((t) => cleanProverb(ent(t))).filter((t) => t.length >= 8 && t.length <= 300);
}
let sections = null; // the page's keyword list, read once a page load
async function json(u) { const r = await fetch(u); if (!r.ok) throw new Error('wikiquote ' + r.status); return r.json(); }
/** one proverb with its keyword, or null when Wikiquote did not answer. At most 1 list read and 3 section reads. */
export async function fetchProverb(rand = Math.random) {
  try {
    if (!sections) { const p = (await json(API + '&prop=sections')).parse; sections = p && Array.isArray(p.sections) ? p.sections : null; }
    for (let i = 0; i < 3 && sections; i++) { // a section can hold no proverb in the usual shape; try another
      const sec = pickSection(sections, rand); if (!sec) return null;
      const j = await json(API + '&prop=text&disablelimitreport=1&section=' + encodeURIComponent(sec.index)); // void-review: ok (at most 3 tries, stops at the first proverb)
      const list = proverbsFrom(j && j.parse && j.parse.text);
      if (list.length) { const word = ent(String(sec.line || '').replace(/<[^>]*>/g, '')).trim(); return { proverb: list[Math.floor(rand() * list.length)], word, page: PAGE + (sec.anchor ? '#' + encodeURIComponent(sec.anchor) : '') }; }
    }
  } catch (_) { sections = null; }
  return null;
}

async function run(text, api) {
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>A proverb</h2><div class="sub">…</div>'; });
  const got = await fetchProverb();
  if (api._pageStill && !api._pageStill(el)) return got ? 'proverb' : 'none';
  if (!got) { el.innerHTML = '<h2>A proverb</h2><div class="sub">Wikiquote didn\'t answer just now, so there is no proverb to show. Try again in a moment.</div>'; return 'none'; }
  el.innerHTML = `<h2>A proverb</h2><p style="font-size:22px;line-height:1.45;font-weight:300;font-style:italic">${esc(got.proverb)}</p>`
    + `<div class="src">Source: <a href="${esc(got.page)}" target="_blank" rel="noopener">Wikiquote, English proverbs${got.word ? ': ' + esc(got.word) : ''}</a></div><div class="sub">say “another proverb” for one more</div>`;
  return 'proverb';
}

export default {
  name: 'proverb',
  examples: ['tell me a proverb', 'random proverb', 'wise saying', 'another proverb', 'an old saying', 'tell me an old saying'],
  nearMisses: ['what is a proverb', 'proverbs from the bible', 'quote'],
  match(lower, text) { return isProverb(text); },
  run,
  suite() {
    const ok = isProverb('tell me a proverb') && isProverb('random proverb') && !isProverb('what is a proverb')
      && proverbsFrom('<ul><li>A cat may look at a king.<ul><li>Hazlitt (1869)</li></ul></li></ul>').join() === 'A cat may look at a king.';
    return { ok, got: ok ? 'match and the list reader work' : 'match or the list reader broke' };
  }
};
