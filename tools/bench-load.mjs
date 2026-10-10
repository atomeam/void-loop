// Can this benchmark run be trusted? The bench waits for each answer on a timer (4 s), so a machine under load misses answers
// that Void gives fine: the same code scores lower. So every miss is replayed by itself, one page at a time, after the parallel
// run (assess below): a miss that passes alone was load; a miss that misses alone is real, whatever the latency says. A run with
// any load miss is "inconclusive": it says so and exits 0 unless the real misses alone take it below the floor, and nothing it
// measured is kept (no bench.last.json, no pass cache, no floor, no baseline).
// The bench also times every answer (p50 and p95 of the wait from Enter to the page's own log line). That is a diagnosis, not
// the verdict: tools/bench.best.json keeps a baseline under "latency", one per environment ("local" or "ci"; CI is the env var),
// each {p50, p95, n, cores, pages, sha, at}, so an inconclusive line can say how far over a quiet machine it was.
// The baseline only tightens, and only from a conclusive run that reached the floor on a quiet machine (bench-floor.mjs); a
// baseline with no sha (hand-recorded, not traceable to a commit) may be replaced by the next clean run.

const num = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : NaN); // Number(null) is 0: a missing measure must not read as a fast one

export const envName = (env = process.env) => (env.CI ? 'ci' : 'local');

// nearest-rank percentile of a list of numbers; null for an empty list
export function percentile(list, p) {
  const v = list.filter(Number.isFinite).sort((a, b) => a - b);
  if (!v.length) return null;
  return v[Math.min(v.length - 1, Math.max(0, Math.ceil((p / 100) * v.length) - 1))];
}

export const latencyOf = (ms) => ({ n: ms.filter(Number.isFinite).length, p50: percentile(ms, 50), p95: percentile(ms, 95) });

// a baseline is only comparable to a run with the same number of pages at once (more pages means slower answers, whatever the machine); the cores
// it was measured on are kept beside it for the reader. No match is the same as no baseline.
const comparable = (baseline, pages) => !baseline || (Number.isFinite(baseline.pages) && baseline.pages === pages);

export const REPLAY_CAP = 100; // misses replayed alone; past this a run is not a load blip, and the rest count as real (fail closed)

// Replay each missed ask by itself (replay(i) resolves true when ask i passes alone). Returns the indexes that passed alone
// (load) and those that still miss (confirmed, plus any past the cap: unreplayed).
export async function replayAlone(out, replay, cap = REPLAY_CAP) {
  const confirmed = [], load = []; let unreplayed = 0;
  for (let i = 0; i < out.length; i++) {
    if (out[i].right) continue;
    if (confirmed.length + load.length >= cap) { confirmed.push(i); unreplayed++; continue; }
    (await replay(i) ? load : confirmed).push(i);
  }
  return { confirmed, load, unreplayed };
}

// { inconclusive, line }: inconclusive when a miss passed alone (the machine was disturbed). The p95 against the baseline is only said, not judged.
export function verdict({ confirmed = 0, load = 0, latency, baseline, pages }) {
  if (!load) return { inconclusive: false, line: '' };
  const p95 = num(latency && latency.p95), b = comparable(baseline, pages) ? num(baseline && baseline.p95) : NaN;
  const said = Number.isFinite(p95) ? (Number.isFinite(b) ? `p95 ${Math.round(p95)}ms vs baseline ${Math.round(b)}ms; ` : `p95 ${Math.round(p95)}ms; `) : '';
  return { inconclusive: true, line: `inconclusive: machine under load (${said}${load} of ${load + confirmed} misses passed alone); re-run alone` };
}

// Everything the bench reports about one run, from its parallel results (out: [{ask, by, right, ms}]) and a replay function.
// score counts a miss that passed alone as a pass (it was load); wrong lists only the misses that reproduce alone.
// failed: the reproduced misses take the score below the floor (a miss that misses alone is real, whatever the latency says).
export async function assess({ out, replay, floor, latency, baseline, pages, cap }) {
  const { confirmed, load, unreplayed } = await replayAlone(out, replay, cap);
  const fmt = (i) => out[i].ask + ' -> ' + out[i].by;
  const score = out.length - confirmed.length, total = out.length;
  const v = verdict({ confirmed: confirmed.length, load: load.length, latency, baseline, pages });
  const fs = Number(floor && floor.score), ft = Number(floor && floor.total);
  const failed = Number.isFinite(fs) && Number.isFinite(ft) ? score < fs || total < ft : false;
  return { score, total, wrong: confirmed.map(fmt), loadMisses: load.map(fmt), unreplayed, inconclusive: v.inconclusive, note: v.line, failed };
}

// the latency block for tools/bench.best.json after this result, or null when it stays: a conclusive result that reached the
// floor, on a measured p95 that is below the baseline, or there is no baseline yet, or the baseline has no sha (recorded by hand,
// not by the tool: the next clean run replaces it). Never loosens a baseline that has a sha, and never swaps one for a run with
// another number of pages. The record says which commit and when: sha and at.
export function nextLatency(result, floor) {
  const env = result && result.env, p95 = num(result && result.latency && result.latency.p95);
  if (!env || !Number.isFinite(p95) || result.inconclusive || !(Number(result.score) >= Number(floor && floor.score))) return null;
  const was = floor && floor.latency && floor.latency[env], cur = num(was && was.p95);
  const legacy = !!was && !was.sha;
  if (Number.isFinite(cur) && !legacy && (cur <= p95 || !comparable(was, result.pages))) return null;
  return { ...(floor && floor.latency), [env]: { p50: result.latency.p50, p95, n: result.latency.n, cores: result.cores, pages: result.pages, sha: result.sha, at: result.at } };
}
