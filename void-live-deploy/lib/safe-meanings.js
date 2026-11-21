// Safe, clean meanings: slang leads to a plain page, flagged entries stay off the list, notes are a first sentence, no citation marks.
// Shares lib/content-safety.js. Does not pick photos. Tests: tools/safe-meanings.test.mjs
import { isSafe, isShockHost } from './content-safety.js';

export { flagsOf, isSafe, isShockHost, noPhotoAsk, SHOCK_HOSTS, UNSAFE_CATEGORY } from './content-safety.js';

const fold = (s) => String(s || '').toLowerCase().replace(/[?.!,'’]+$/g, '').replace(/\s+/g, ' ').trim();
const BREAST = { title: 'Breast', also: ['Boobs! The Musical'] };
const DICK = { titles: ['Moby-Dick', 'Dick Van Dyke', 'Philip K. Dick', 'Dick Grayson', 'Dick Cheney', 'Dick (nickname)'] };
const POOP = { titles: ['Pile of Poo', 'Feces', 'Poop deck', 'YouTube Poop', 'Kopi luwak', 'Pooper-scooper'] };
const LEADS = { boobs: BREAST, boob: BREAST, boobie: BREAST, boobies: BREAST, titties: BREAST, tittie: BREAST, titty: BREAST, tits: BREAST, dick: DICK, dicks: DICK, poop: POOP, poops: POOP, poo: POOP };

export function leadOf(ask) {
  const t = fold(ask);
  if (LEADS[t]) return LEADS[t];
  for (const [k, v] of Object.entries(LEADS)) if (new RegExp('(?:^|\\s)' + k + '(?:\\s|$)').test(t)) return v;
  return null;
}

export function allowedTitles(ask) {
  const L = leadOf(ask);
  return L ? [L.title, ...(L.also || []), ...(L.titles || [])].filter(Boolean) : [];
}

/** true when a hit stole a cheeky ask (an episode named after the slang). Pure. */
export function isHijack(ask, hit) {
  const L = leadOf(ask), title = (hit && (hit.title || hit)) || '';
  if (!L || !title || /disambiguation/i.test(title)) return false;
  if (new Set(allowedTitles(ask).map(fold)).has(fold(title))) return false;
  return L.title ? true : !isSafe({ title, text: (hit && (hit.note || hit.extract || hit.text)) || '' });
}

export function plainTitle(ask, hit) {
  const L = leadOf(ask);
  if (L && L.title && (!hit || !hit.title || isHijack(ask, hit))) return L.title;
  return (hit && hit.title) || (L && L.title) || '';
}

/** drop [1], S2CID, PMID, "Archived from the original…". Pure. */
export function stripCites(s) {
  return String(s == null ? '' : s)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\[\s*(?:\d+|citation needed|note \d+|nb \d+)\s*\]/gi, '')
    .replace(/\b(?:S2CID|PMID|PMC|DOI)\s*[:.]?\s*\S+/gi, '')
    .replace(/\bISBN\s*[0-9X-]{8,}\b/gi, '')
    .replace(/\bArchived from the original\b[^.]*/gi, '')
    .replace(/\((?:archived|retrieved|accessed)[^)]*\)/gi, '')
    .replace(/\s+/g, ' ').trim();
}

/** first complete sentence, never a mid-sentence slice with an ellipsis. Pure. */
export function firstSentence(s) {
  const t = stripCites(s).replace(/[…]|\.{3,}/g, ' ').replace(/\s+/g, ' ').trim();
  const m = t && t.match(/^(.+?[.!?])(?:\s|$)/);
  return m ? m[1].trim() : t;
}

function mergeByTitle(rows) {
  const map = new Map();
  for (const r of rows || []) {
    const title = String((r && r.title) || '').trim(); if (!title || /disambiguation/i.test(title)) continue;
    const prev = map.get(fold(title)) || { title };
    map.set(fold(title), { title: prev.title.length >= title.length ? prev.title : title, note: prev.note || r.note || '', text: prev.text || r.text || r.extract || r.note || '', extract: prev.extract || r.extract || '', url: prev.url || r.url || '', categories: prev.categories || r.categories });
  }
  return [...map.values()];
}

/** safe meanings, curated leads first, at most 8. Pure. */
export function arrange(ask, entries) {
  const L = leadOf(ask);
  const clean = mergeByTitle(entries).filter((e) => isSafe(e) && !isShockHost(e.url)).map((e) => ({ title: e.title, note: firstSentence(e.extract || e.text || e.note || '') }));
  const by = new Map(clean.map((e) => [fold(e.title), e])), out = [], seen = new Set();
  const take = (title) => {
    const k = fold(title); if (seen.has(k)) return;
    const e = by.get(k) || (L && allowedTitles(ask).some((t) => fold(t) === k) ? { title, note: '' } : null);
    if (e) { seen.add(k); out.push(e); }
  };
  if (L && L.title) take(L.title);
  for (const t of (L && (L.also || L.titles)) || []) take(t);
  if (!L) for (const e of clean) take(e.title);
  return out.slice(0, 8);
}

/** Wikipedia extracts and categories (no photos). */
export async function enrich(titles, getJson) {
  const q = (titles || []).map((t) => String(t || '').trim()).filter(Boolean).slice(0, 12).join('|');
  if (!q || !getJson) return [];
  const j = await getJson('https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&prop=extracts|categories&exintro=1&explaintext=1&exsentences=1&cllimit=16&redirects=1&titles=' + encodeURIComponent(q));
  return Object.values((j && j.query && j.query.pages) || {}).filter((p) => p && p.title && p.pageid >= 0).map((p) => ({ title: p.title, extract: p.extract || '', categories: p.categories || [] }));
}

/** search hits plus optional enrich → a safe meanings list. */
export async function meaningsFor(ask, { search = [], fetch: get } = {}) {
  const want = [...allowedTitles(ask), ...(search || []).map((s) => s.title)].filter(Boolean);
  let extra = [];
  if (get && want.length) {
    const getJson = (url) => Promise.resolve(get(url)).then((r) => (r && typeof r.json === 'function' ? r.json() : r));
    try { extra = await enrich(want, getJson); } catch (_) { extra = []; }
  }
  return arrange(ask, [...(search || []), ...extra]);
}
