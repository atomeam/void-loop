// The emoji dictionary (/emojis/dictionary/; the tower lane of emojigraph.org, an emoji encyclopedia, asked by Verse 2026-11-05: "Add emojigraph.org to
// LANE_PAGES in lib/tower.js and begin target assimilation"): every emoji of the Unicode list by group and subgroup, its name, keywords, the Emoji
// version it came in, its code points and the ways to write it (HTML, CSS, JavaScript, UTF-8), the emoji like it, a keyboard that builds a message
// and a memory game. All of it works on the device from lib/emoji-dict-data.js: nothing is fetched and nothing typed is sent anywhere.
// The whole view lives in the link's hash (stateToHash / stateFromHash), so a shared link opens the same emoji, search, keyboard text or game.
// Pure. Tests: tools/emoji-dict.test.mjs.
import { GROUPS, SUBGROUPS, ROWS, SOURCE } from './emoji-dict-data.js';

export { GROUPS, SUBGROUPS, SOURCE };
/** every emoji: { i, c, n, s (subgroup index), g (group index), v (Emoji version), k (keywords) }, in the Unicode order. */
export const EMOJI = Object.freeze(ROWS.split('\n').map((line, i) => { const [c, n, s, v, k] = line.split('|'); return Object.freeze({ i, c, n, s: +s, g: SUBGROUPS[+s][2], v, k: Object.freeze(k ? k.split(' ') : []) }); }));
const BY_CHAR = new Map(EMOJI.map((e) => [e.c, e]));
const bare = (c) => String(c || '').replace(/️/g, '');
const BY_BARE = new Map(EMOJI.map((e) => [bare(e.c), e]));
/** the record of an emoji character (with or without its variation selector), or null. Pure. */
export const recordOf = (c) => BY_CHAR.get(String(c || '')) || BY_BARE.get(bare(c)) || null;

/** each group with how many emoji it holds: [{ g, key, name, count }]. Pure. */
export function groupCounts(list = EMOJI) {
  const n = new Array(GROUPS.length).fill(0); for (const e of list) n[e.g]++;
  return GROUPS.map(([key, name], g) => ({ g, key, name, count: n[g] }));
}
/** a group's subgroups with their emoji, in order: [{ s, key, name, emoji: [...] }]. Pure. */
export function subgroupsOf(g, list = EMOJI) {
  const out = SUBGROUPS.map(([key, name, gi], s) => ({ s, key, name, g: gi, emoji: [] })).filter((x) => x.g === g);
  const at = new Map(out.map((x) => [x.s, x])); for (const e of list) if (e.g === g && at.has(e.s)) at.get(e.s).emoji.push(e);
  return out.filter((x) => x.emoji.length);
}
/** a group key ("animals-nature") or name to its index, or -1. Pure. */
export const groupIndex = (key) => GROUPS.findIndex(([k, n]) => k === key || n.toLowerCase() === String(key || '').toLowerCase());

const norm = (q) => String(q || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9#*:' À-￿]+/g, ' ').replace(/\s+/g, ' ').trim();
const ALIAS = Object.freeze({ lol: 'laugh', love: 'heart', kitty: 'cat', puppy: 'dog', happy: 'smile', sad: 'cry', yes: 'check', ok: 'ok', thanks: 'pray', fire: 'fire', poo: 'poop' });
/** the emoji a search finds, best first: the character itself, then the name exactly, a name that starts with the words, every word in the
 *  name, then every word in the name or the keywords. At most `max`. Pure. */
export function search(q, list = EMOJI, max = 200) {
  const raw = String(q || '').trim(); if (!raw) return [];
  const self = recordOf(raw); if (self) return [self, ...similar(self, 12, list)].slice(0, max);
  const t = norm(raw); if (!t) return [];
  const words = t.split(' ').map((w) => [w, ALIAS[w] || w]);
  const hasWord = (text, w) => text.split(/[ :]+/).some((x) => x === w || x.startsWith(w) || (w.length > 3 && x.startsWith(w.replace(/s$/, ''))));
  const scored = [];
  for (const e of list) {
    const name = norm(e.n), keys = e.k.join(' ');
    let score = 0;
    if (name === t) score = 100;
    else if (name.startsWith(t)) score = 80;
    else if (words.every(([w, a]) => hasWord(name, w) || hasWord(name, a))) score = 60;
    else if (words.every(([w, a]) => hasWord(name, w) || hasWord(name, a) || hasWord(keys, w) || hasWord(keys, a))) score = 30;
    if (score) scored.push([score - Math.min(19, name.length / 8), e]);
  }
  return scored.sort((a, b) => b[0] - a[0] || a[1].i - b[1].i).slice(0, max).map((x) => x[1]);
}
/** up to n emoji like this one: the same subgroup first, ranked by the keywords they share, then others that share two keywords. Pure. */
export function similar(e, n = 12, list = EMOJI) {
  if (!e) return [];
  const mine = new Set(e.k.filter((w) => w.length > 2 && w !== 'face')), shared = (x) => x.k.filter((w) => mine.has(w)).length;
  const same = list.filter((x) => x !== e && x.s === e.s).map((x) => [shared(x) + 2, x]);
  const near = list.filter((x) => x !== e && x.s !== e.s).map((x) => [shared(x), x]).filter(([s]) => s >= 2);
  return [...same, ...near].sort((a, b) => b[0] - a[0] || a[1].i - b[1].i).slice(0, n).map((x) => x[1]);
}

// ---- how to write it ----
const cps = (c) => Array.from(String(c || '')).map((x) => x.codePointAt(0));
/** "U+1F431" or "U+1F3F4 U+E0067 ...". Pure. */
export const codepoints = (c) => cps(c).map((p) => 'U+' + p.toString(16).toUpperCase().padStart(4, '0')).join(' ');
/** the ways to write an emoji in code: html, css, js, url, utf8 (bytes in hex), utf16. Pure. */
export function writings(c) {
  const p = cps(c), hex = (n, w = 4) => n.toString(16).toUpperCase().padStart(w, '0');
  const utf8 = Array.from(new TextEncoder().encode(String(c))).map((b) => hex(b, 2)).join(' ');
  const utf16 = Array.from({ length: String(c).length }, (_, i) => hex(String(c).charCodeAt(i))).join(' ');
  return { html: p.map((n) => '&#x' + hex(n) + ';').join(''), css: p.map((n) => '\\' + hex(n)).join(''), js: p.map((n) => '\\u{' + hex(n) + '}').join(''), url: encodeURIComponent(String(c)), utf8, utf16 };
}
/** a short name for a link or a shortcode: "cat face" -> ":cat_face:". Pure. */
export const shortcode = (e) => (e ? ':' + norm(e.n).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') + ':' : '');

// ---- the memory game: pairs of one subgroup's emoji, dealt from a seed so a link deals the same board ----
/** a small seeded random generator (mulberry32). Pure. */
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/** a board of `pairs` pairs (2 to 18) from the given group (or all), dealt from seed: an array of emoji characters, each twice. Pure. */
export function deal(seed, pairs = 8, g = -1, list = EMOJI) {
  const r = rng(seed), pool = list.filter((e) => (g < 0 || e.g === g) && e.g !== groupIndex('flags') && Array.from(e.c).length <= 2), pick = [], n = Math.max(2, Math.min(18, pairs | 0));
  const used = new Set(); while (pick.length < n && used.size < pool.length) { const e = pool[Math.floor(r() * pool.length)]; if (!used.has(e.c)) { used.add(e.c); pick.push(e.c); } }
  const cards = [...pick, ...pick]; for (let i = cards.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [cards[i], cards[j]] = [cards[j], cards[i]]; }
  return cards;
}
/** a new game: { cards, open: [], found: [], moves: 0 }. Pure. */
export const newGame = (seed, pairs = 8, g = -1) => ({ cards: deal(seed, pairs, g), open: [], found: [], moves: 0 });
/** turn card i over: two open cards that match are found, two that do not are turned back on the next turn. Returns the new game. Pure. */
export function flip(game, i) {
  if (!game || i < 0 || i >= game.cards.length || game.found.includes(i) || (game.open.length < 2 && game.open.includes(i))) return game; // a card already up waits for its pair
  const open = game.open.length >= 2 ? [i] : [...game.open, i];
  if (open.length < 2) return { ...game, open };
  const [a, b] = open, match = game.cards[a] === game.cards[b];
  return { ...game, open: match ? [] : open, found: match ? [...game.found, a, b] : game.found, moves: game.moves + 1 };
}
/** whether every pair is found. Pure. */
export const won = (game) => !!game && game.cards.length > 0 && game.found.length === game.cards.length;

// ---- the whole view in the link's hash: #e=🐱 (one emoji), #q=cat (a search), #g=animals-nature (a group), #k=text (the keyboard), #m=seed.pairs.group (a game) ----
const KEYS = ['view', 'e', 'q', 'g', 'k', 'm'];
export const VIEWS = Object.freeze(['browse', 'keyboard', 'game']);
/** the hash for a state { view, e, q, g, k, m }; empty parts are left out. Pure. */
export function stateToHash(st = {}) {
  const p = new URLSearchParams();
  if (st.view && st.view !== 'browse' && VIEWS.includes(st.view)) p.set('view', st.view);
  if (st.e && recordOf(st.e)) p.set('e', recordOf(st.e).c);
  if (st.q) p.set('q', String(st.q).slice(0, 80));
  if (st.g && groupIndex(st.g) >= 0) p.set('g', GROUPS[groupIndex(st.g)][0]);
  if (st.k) p.set('k', Array.from(String(st.k)).slice(0, 280).join(''));
  if (st.m && /^\d{1,10}\.\d{1,2}(?:\.-?\d)?$/.test(st.m)) p.set('m', st.m);
  const s = p.toString(); return s ? '#' + s : '';
}
/** the state a hash carries ({ view, e, q, g, k, m }, each '' when absent); unknown parts and bad values are dropped. Pure. */
export function stateFromHash(hash) {
  const p = new URLSearchParams(String(hash || '').replace(/^#/, '')), st = { view: 'browse', e: '', q: '', g: '', k: '', m: '' };
  for (const key of p.keys()) if (!KEYS.includes(key)) p.delete(key);
  if (VIEWS.includes(p.get('view'))) st.view = p.get('view');
  const e = recordOf(p.get('e')); if (e) st.e = e.c;
  if (p.get('q')) st.q = String(p.get('q')).slice(0, 80);
  if (groupIndex(p.get('g')) >= 0) st.g = GROUPS[groupIndex(p.get('g'))][0];
  if (p.get('k')) st.k = Array.from(String(p.get('k'))).slice(0, 280).join('');
  if (/^\d{1,10}\.\d{1,2}(?:\.-?\d)?$/.test(p.get('m') || '')) st.m = p.get('m');
  return st;
}
/** a game spec "seed.pairs.group" to { seed, pairs, g }. Pure. */
export const gameSpec = (m) => { const [seed, pairs, g] = String(m || '').split('.').map(Number); return { seed: Number.isFinite(seed) ? seed : 1, pairs: Number.isFinite(pairs) ? Math.max(2, Math.min(18, pairs)) : 8, g: Number.isFinite(g) && g >= 0 && g < GROUPS.length ? g : -1 }; };
