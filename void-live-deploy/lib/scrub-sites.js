// The sites Versus is measured against are named only in the owner-only Tower (/versus/). Anything else the site serves that
// carries free text (the growth ledger, the asks, what Verse learned, its facts about itself, the public asks API) passes through
// here, and a studied site's name or link becomes "another site". Pure. The host list comes from the tower's floors and its sites.
import { FLOORS, hostOf } from './tower.js';
import { SITES } from './versus-floor.js';

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
/** a text with every studied site's name or link replaced by "another site". Pure. */
export const scrubSites = (text) => (typeof text === 'string' && text ? text.replace(pattern(), 'another site') : text);
/** every string in a JSON value through scrubSites (keys untouched). Pure. */
export const deepScrub = (v) => (typeof v === 'string' ? scrubSites(v) : Array.isArray(v) ? v.map(deepScrub) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, deepScrub(x)])) : v);
