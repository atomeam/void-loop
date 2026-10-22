// Verse's skill library with scored retrieval (docs/LOOP-GAPS.md: Voyager's skill library + Generative Agents' memory stream).
// Before a builder (or grow-self) starts on a want, it asks: which past builds look most like this, and what did they do?
// Every growth-ledger entry (void-live-deploy/void.growth.json) is a memory. Each is scored the Generative Agents way:
//   score = recency + importance + relevance, each scaled 0..1
//   recency     0.995 ^ hours since the entry (the paper's decay factor)
//   importance  from the entry itself, no model: a build with a live "try" ask beats a note; reverts and incidents count as
//               lessons and score high, because a past failure is the most useful thing to read before repeating it
//   relevance   word overlap (Jaccard over content words) between the query and the entry's what/asked/show/try
// Pure, no network, no model, no writes.
//   node tools/loop-library.mjs "<want or ask>" [--k 5] [--json]
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const STOP = new Set('a an the and or of to in on for with by is it its as at be this that from into my your me you i can so do does not no'.split(' '));
export const words = (t) => new Set(String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter((w) => w.length > 1 && !STOP.has(w)));
export function relevance(q, e) {
  const a = words(q), b = words([e.what, e.asked, e.show, e.try].join(' '));
  if (!a.size || !b.size) return 0;
  let n = 0; for (const w of a) if (b.has(w)) n++;
  return n / (a.size + b.size - n);
}
export function importance(e) {
  const k = String(e.kind || '');
  if (/revert|incident|fail/.test(k) || /\brevert(ed)?\b/i.test(e.what || '')) return 1;
  let s = 0.3;
  if (k === 'build') s += 0.3;
  if (e.try) s += 0.2;
  if (e.asked) s += 0.2;
  return Math.min(1, s);
}
export function recency(e, now = Date.now()) {
  const t = Date.parse(e.at || ''); if (!Number.isFinite(t)) return 0;
  return Math.pow(0.995, Math.max(0, (now - t) / 3600e3));
}
/** top k memories for a query; entries with no word in common are never returned (relevance gates, the others rank) */
export function retrieve(entries, q, { k = 5, now = Date.now() } = {}) {
  return (Array.isArray(entries) ? entries : [])
    .map((e) => { const rel = relevance(q, e); return { e, rel, score: rel > 0 ? rel + importance(e) + recency(e, now) : 0 }; })
    .filter((x) => x.rel > 0).sort((a, b) => b.score - a.score).slice(0, k);
}
export const ledger = () => { const g = JSON.parse(readFileSync(resolve(root, 'void-live-deploy/void.growth.json'), 'utf8')); return Array.isArray(g) ? g : Object.values(g); };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2), ki = a.indexOf('--k'), k = ki >= 0 ? +a[ki + 1] || 5 : 5;
  const q = a.filter((x, i) => !x.startsWith('--') && i !== ki + 1).join(' ');
  if (!q) { console.error('usage: node tools/loop-library.mjs "<want>" [--k 5] [--json]'); process.exit(2); }
  const hits = retrieve(ledger(), q, { k });
  if (a.includes('--json')) console.log(JSON.stringify(hits.map((h) => ({ score: +h.score.toFixed(3), ...h.e })), null, 2));
  else if (!hits.length) console.log(`no past build shares a word with "${q}"`);
  else for (const h of hits) console.log(`${h.score.toFixed(2)}  ${String(h.e.at).slice(0, 10)}  ${h.e.kind}: ${h.e.what}${h.e.try ? `\n      try: ${h.e.try}` : ''}`);
}
