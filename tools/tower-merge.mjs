// The tower gate's full sweep, split across machines (.github/workflows/tower-gate.yml): speed is ms to the load event, so two floors timed on
// one runner would share its CPU and network; each slice of the floors is measured on its own runner and written to its own slice file, and one
// final job folds every slice into void-live-deploy/tower.evidence.json. Both halves are pure, so tools/tower-merge.test.mjs can prove that every
// floor lands in exactly one slice and that a merge never puts an older row over a newer one.
//   node tools/tower-gate.mjs --shard 2/6            measures slice 2 of 6, writes void-live-deploy/tower.evidence.2.json (never committed)
//   node tools/tower-gate.mjs --merge slices/*.json  folds the slice files into tower.evidence.json

/** slice `i` of `n` (1-based) of the ids, in their order: every id in exactly one slice, the sizes differing by at most one. Pure. */
export function shard(ids, i, n) {
  i = Number(i); n = Number(n);
  if (!Number.isInteger(n) || n < 1 || !Number.isInteger(i) || i < 1 || i > n) throw new Error('shard: want i/N with 1 <= i <= N, got ' + i + '/' + n);
  return ids.filter((_, k) => k % n === i - 1);
}
/** "i/N" from the command line, or null */
export const parseShard = (s) => { const m = String(s || '').match(/^(\d+)\/(\d+)$/); return m ? { i: +m[1], n: +m[2] } : null; };

/** when a row was written, as a number; a row with no `at` is older than any row with one. Pure. */
const stamp = (r) => { const t = r && r.at ? Date.parse(r.at) : NaN; return Number.isFinite(t) ? t : -Infinity; };
/** whether the old gate wrote this row by itself ("called beaten by verse"): such rows are dropped on every run (tools/tower-gate.mjs) */
export const selfCalled = (r) => !!(r && r.called && /^called beaten by verse\b/.test(String(r.evidence || '')));

/** the evidence with every slice folded in: a slice row replaces the base row for the same floor and aspect only when it is at least as new
 *  (a fight run that committed while the sweep ran keeps its newer verdict), a floor the base lacks is added whole, rows no slice measured stay,
 *  and rows the old gate called by itself are dropped everywhere. The inputs are not changed. Pure. */
export function merge(base, slices) {
  const out = { ...base, floors: Object.fromEntries(Object.entries((base && base.floors) || {}).map(([id, rows]) => [id, { ...(rows || {}) }])) };
  const taken = []; // what replaced what, for the log
  for (const s of slices || []) {
    for (const [id, rows] of Object.entries((s && s.floors) || {})) {
      const have = (out.floors[id] = out.floors[id] || {});
      for (const [a, r] of Object.entries(rows || {})) {
        if (!r) continue;
        if (stamp(r) >= stamp(have[a])) { have[a] = r; taken.push(id + ' / ' + a); }
      }
    }
  }
  for (const rows of Object.values(out.floors)) for (const [a, r] of Object.entries(rows)) if (selfCalled(r)) delete rows[a];
  return { data: out, taken };
}
