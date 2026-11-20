// Long-term memory by meaning (docs/brain.md, item 7). A signed-in member's own notes and projects (void_memory, kept only when they asked
// Verse to remember them, scoped to them) were found by shared words alone, so "what is my dog called" missed "Rex is my puppy". Now the
// member's most recent records are also ranked by meaning with the bge-m3 embedding model on Workers AI: the ask and each line are embedded
// for this answer only, nothing is stored, and a line is used only when it is close to the ask. Visitors are untouched: their on-device
// memory graph (lib/memory-graph.js) is never sent. A slow or failed embedding call falls back to the word matches, never to an error.
import { embed } from './router.js';

export const RECENT = 40; // the member's most recent records ranked by meaning
export const MIN = 0.5; // bge-m3 cosine below this does not bear on the ask
export const BUDGET_MS = 400;

const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };

/** lines ranked by meaning: the ask's vector against each line's, at least `min`, best first, at most `keep`. Pure. */
export function rankByMeaning(qv, vecs, lines, keep = 5, min = MIN) {
  return lines.map((line, i) => ({ line, p: vecs[i] ? dot(qv, vecs[i]) : -1 })).filter((x) => x.p >= min).sort((a, b) => b.p - a.p).slice(0, keep);
}

/** word matches first, then lines close in meaning, no repeats, at most `keep`. Pure. */
export function mergeRecall(words, meant, keep = 5) {
  const out = [...words];
  for (const m of meant) if (out.length < keep && !out.includes(m.line)) out.push(m.line);
  return out.slice(0, keep);
}

/** the member's most recent records as lines (`lineOf` shapes one), scoped to them. One D1 read. */
export async function recentLines(env, scope, lineOf, n = RECENT) {
  const { results } = await env.DB.prepare('SELECT kind, name, summary, links FROM void_memory WHERE owner_id = ? ORDER BY updated DESC LIMIT ?').bind(scope, n).all();
  return results.map((r) => lineOf({ ...r, links: JSON.parse(r.links || '[]') })).filter(Boolean);
}

/** lines that bear on the ask by meaning, or [] when the model is slow, absent or fails. */
export async function byMeaning(env, ask, lines, keep = 5, budget = BUDGET_MS) {
  if (!env.AI || !lines.length) return [];
  let t;
  try {
    const vecs = await Promise.race([embed(env, [String(ask).slice(0, 500), ...lines]), new Promise((_, no) => { t = setTimeout(() => no(new Error('slow')), budget); })]);
    return rankByMeaning(vecs[0], vecs.slice(1), lines, keep);
  } catch (_) { return []; } finally { clearTimeout(t); }
}
