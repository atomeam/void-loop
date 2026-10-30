// The least proven skill family, one rule for every place that names it (owner's review of the self card, 2026-10-30: the bars marked
// "Words and the world (weakest)" at 38/42 while the model's readout said "the Games family remains the least proven family with 34
// proven skills"). The bars (lib/skill-confidence.js familyBars), the facts the model reads (lib/voice.js familyFacts) and the check of
// what the model wrote all rank the same way: the lowest proven share, then the lower share of proven and checked, then the larger family.
// Pure: no fetch, no DOM.

const rowsOf = (fam) => ((fam && fam.families) || []).filter((f) => f && Array.isArray(f.skills) && f.skills.some((s) => s && s.name)).map((f) => {
  const sk = f.skills.filter((s) => s && s.name), proven = sk.filter((s) => s.tier === 'proven').length, checked = sk.filter((s) => s.tier === 'checked').length;
  return { id: String(f.id || f.name || ''), name: String(f.name || f.id || ''), proven, checked, total: sk.length, share: proven / sk.length };
});
/** the order of weakness: a before b when a is less proven. */
export const byWeakness = (a, b) => a.share - b.share || (a.proven + a.checked) / a.total - (b.proven + b.checked) / b.total || b.total - a.total;
/** { id, name, proven, checked, total, share } of the least proven family of skills/families.json, null with none. */
export function weakestFamily(fam) { return rowsOf(fam).sort(byWeakness)[0] || null; }
/** the family as the bars show it: "Words and the world (38 of 42 proven)". */
export const familyCount = (w) => w.name + ' (' + w.proven + ' of ' + w.total + ' proven)';
/** the sentence the card shows when the model named the wrong family. */
export const weakestSentence = (w) => w.name + ' is my least proven family: ' + w.proven + ' of ' + w.total + ' skills proven, the lowest proven share.';

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const CALLS_WEAK = /\b(least|weakest|lowest|fewest|worst)\b/i;
/** A sentence of text that calls a family the least proven (it says "family" and least, weakest, lowest, fewest or worst) and names
 *  another family but not the least proven one: { said (the row it named), is (the least proven row), sentence }; null when every such
 *  sentence names the right family, or none calls one weakest. */
export function wrongWeakest(text, fam) {
  const rows = rowsOf(fam), is = rows.slice().sort(byWeakness)[0];
  if (!is || !text) return null;
  const names = (s) => rows.filter((r) => new RegExp('\\b' + esc(r.name) + '\\b', 'i').test(s));
  for (const s of String(text).split(/(?<=[.!?])\s+/)) {
    if (!/\bfamil(y|ies)\b/i.test(s) || !CALLS_WEAK.test(s)) continue;
    const n = names(s);
    if (n.length && !n.some((r) => r.id === is.id)) return { said: n[0], is, sentence: s.trim() };
  }
  return null;
}
/** the note under a readout that named the wrong family: what the bars show instead. */
export const weakestNote = (w) => 'The bars disagree: ' + familyCount(w.is) + ' is the least proven family, not ' + familyCount(w.said) + '.';
