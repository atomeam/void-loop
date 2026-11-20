// What people want, read from the signals Verse already keeps (no data is made up here):
//   1. the ask bar's misses: what people typed that Verse could not answer, with how many times (owner-only GET /api/misses, tools/misses.mjs);
//   2. docs/GAPS.md: asks someone typed and saw fail, still "open" (the same list the gap builder works through).
// The most-wanted item is the next thing the creation lane makes; if a page already does the job it is added to that page (the super-page rule).
// Pure helpers: no network, no files.
import { dupeOf } from './quality.js';

export const MIN_COUNT = 3;   // a miss is shown in public only when at least this many people typed it
export const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

/** misses rows ({ ask, count, last }) into one item per ask, most typed first. `redact` is tools/misses.mjs redact (null drops a secret-looking ask). */
export function fromMisses(rows, redact = (a) => a) {
  const by = new Map();
  for (const r of Array.isArray(rows) ? rows : []) {
    const ask = redact(r && r.ask); if (ask == null) continue;
    const k = norm(ask); if (!k) continue;
    const e = by.get(k) || { ask: k, count: 0, last: '', source: 'ask bar misses' };
    e.count += Math.max(1, +r.count || 1); if (String(r.last || '') > e.last) e.last = String(r.last);
    by.set(k, e);
  }
  return [...by.values()];
}

/** the open rows of docs/GAPS.md ("| n | ask | seen | done when | state |"): each counts as one person. */
export function fromGaps(md) {
  const out = [];
  for (const line of String(md || '').split('\n')) {
    const c = line.split('|').map((s) => s.trim());
    if (c.length < 7 || !/^\d+$/.test(c[1])) continue;
    if (/^open\b/i.test(c[5])) out.push({ ask: norm(c[2]), count: 1, last: '', source: 'gaps list', done: c[4] });
  }
  return out;
}

/** most wanted first: by how many people, then the newest */
export const rank = (items) => [...items].sort((a, b) => b.count - a.count || (b.last > a.last ? 1 : b.last < a.last ? -1 : 0));

/** the next thing to make. `pages` is [{ path, title, about }]. Returns { ask, count, source, extend } (extend: the page that already does the job) or null. */
export function mostWanted(items, pages = []) {
  const top = rank(items).find((i) => i.ask);
  if (!top) return null;
  const page = dupeOf(top.ask, pages);
  return { ask: top.ask, count: top.count, source: top.source, extend: page ? page.path : null };
}

/** the form that is safe on the public board: the words only when enough people typed them, else just the count */
export function publicForm(pick) {
  if (!pick) return null;
  const safe = pick.count >= MIN_COUNT && /^[a-z0-9 ]{3,60}$/.test(pick.ask);
  return { want: safe ? pick.ask : 'an ask typed ' + pick.count + (pick.count === 1 ? ' time' : ' times'), count: pick.count, source: pick.source, extend: pick.extend };
}
