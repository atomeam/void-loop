// The sites Versus is measured against are named only in the owner-only Tower (/versus/). Anything else the site serves that
// carries free text (the growth ledger, the asks, what Verse learned, its facts about itself, the public asks API) passes through
// here, and a studied site's name or link becomes "another site". Pure. The host list comes from the tower's floors and its sites.
import { FLOORS, hostOf } from './tower.js';
import { SITES } from './versus-floor.js';
import { SEEDS } from './universe-seeds.js';
import { protectedNames, scrubNames } from './universe.js';

// services the site itself cites and links (its own repo, search, video, models, dictionaries, the weather service): kept as they are
const KEEP = /(?:^|\.)(?:github|google|youtube|amazon|huggingface|wiktionary|wikipedia|weather|apple|cloudflare|a-to-mind)\.(?:com|org|gov|co)$/;
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
let cached = null;
/** every host the tower studies, lower case, no www. Pure. */
export function studiedHosts() {
  if (cached) return cached;
  const out = new Set();
  const add = (v) => { const h = String(v || '').trim().toLowerCase().replace(/^www\./, ''); if (/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(h) && !KEEP.test(h)) out.add(h); };
  for (const f of FLOORS) { add(hostOf(f.url)); add(hostOf(f.site)); }
  for (const s of SITES) { add(s.rival); try { add(new URL(s.url).hostname); } catch (_) { /* no url */ } }
  cached = [...out].sort((a, b) => b.length - a.length);
  return cached;
}
let re = null;
const pattern = () => re || (re = new RegExp('(?<![\\w.@-])(?:https?:\\/\\/)?(?:www\\.)?(?:' + studiedHosts().map(esc).join('|') + ')(?![\\w-])(?:\\/[^\\s"\'<>)\\]]*)?', 'gi'));
// where "another site" would read badly, the site is named by what it is: the phrase first, the plain replacement after
const NATURAL = [
  [/the way isitchristmas\.com does it/gi, 'the way the best one-question sites do it'],
  [/\bthesportsdb\.com\b/gi, 'a public sports database'],
  [/\bespn\.com\b/gi, 'a sports news site'],
];
// what the Tower beyond websites measures against (lib/universe.js): the seeds' names always, and the generated targets' names once the deploy
// step hands them over (tools/public-sites.mjs reads tower.universe.json); each becomes "another one"
let extraNames = [];
export const setUniverseNames = (names) => { extraNames = (names || []).slice(); };
/** every protected target name: the seeds' and any handed over. Pure. */
export const universeNames = () => [...new Set(protectedNames(SEEDS).concat(extraNames))].sort((a, b) => b.length - a.length);
/** a text with every studied site's name or link replaced (by what it is where a rule above knows, else "another site"), and every target's benchmark name by "another one". Pure. */
export const scrubSites = (text) => {
  if (typeof text !== 'string' || !text) return text;
  let t = text;
  for (const [re, to] of NATURAL) t = t.replace(re, to);
  return scrubNames(t.replace(pattern(), 'another site'), universeNames());
};
/** every string in a JSON value through scrubSites (keys untouched). Pure. */
export const deepScrub = (v) => (typeof v === 'string' ? scrubSites(v) : Array.isArray(v) ? v.map(deepScrub) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, deepScrub(x)])) : v);
/** the studied sites a text names, as bare hosts (no www, no path), each once. Pure. */
export function studiedIn(text) {
  if (typeof text !== 'string' || !text) return [];
  const found = new Set();
  for (const m of text.match(pattern()) || []) { const h = m.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[/?#].*$/, ''); if (h) found.add(h); }
  return [...found];
}
/** a script with the studied sites taken out of its comments only (a whole-line comment, or the tail after ' // '). A site named in code, a link or a feed
 *  the page really uses, is left: rewriting it would break the feature. Pure. */
export function scrubCode(src) {
  return String(src).split('\n').map((l) => {
    if (/^\s*(\/\/|\/\*|\*)/.test(l)) return scrubSites(l);
    const i = l.lastIndexOf(' // ');
    return i >= 0 && !/['"`]/.test(l.slice(i + 4)) ? l.slice(0, i) + scrubSites(l.slice(i)) : l;
  }).join('\n');
}
