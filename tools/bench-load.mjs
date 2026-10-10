// Can this benchmark run be trusted? The bench waits for each answer on a timer (4 s), so a machine under load misses answers
// that Void gives fine: the same code scores lower. The bench measures how long answers take (p50 and p95 of the wait from
// Enter to the page's own log line) and compares p95 with a baseline kept in tools/bench.best.json under "latency", one per
// environment ("local" or "ci"; CI is the env var). A run with misses AND a p95 above the baseline is "inconclusive": it says so
// and exits 0, and nothing it measured is kept (no bench.last.json, no pass cache, no floor, no baseline).
// Each baseline is {p50, p95, n, cores, pages}. The baseline only tightens, and only from a conclusive run that reached the floor on a quiet machine (bench-floor.mjs).
// No baseline for the environment means conclusive: the first clean run records it.

export const LOAD_FACTOR = 1.5; // p95 may be this much over the baseline ...
export const LOAD_SLACK_MS = 100; // ... or this many ms over it, whichever allows more (a very fast baseline is noisy)

const num = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : NaN); // Number(null) is 0: a missing measure must not read as a fast one

export const envName = (env = process.env) => (env.CI ? 'ci' : 'local');

// nearest-rank percentile of a list of numbers; null for an empty list
export function percentile(list, p) {
  const v = list.filter(Number.isFinite).sort((a, b) => a - b);
  if (!v.length) return null;
  return v[Math.min(v.length - 1, Math.max(0, Math.ceil((p / 100) * v.length) - 1))];
}

export const latencyOf = (ms) => ({ n: ms.filter(Number.isFinite).length, p50: percentile(ms, 50), p95: percentile(ms, 95) });

// the slowest p95 still counted as a quiet machine, or null when there is no baseline for this environment
export function limitFor(baseline) {
  const b = num(baseline && baseline.p95);
  return Number.isFinite(b) && b > 0 ? Math.max(b * LOAD_FACTOR, b + LOAD_SLACK_MS) : null;
}

// a baseline is only comparable to a run with the same number of pages at once (more pages means slower answers, whatever the machine); the cores
// it was measured on are kept beside it for the reader. No match is the same as no baseline: the run is conclusive by default.
const comparable = (baseline, pages) => !baseline || (Number.isFinite(baseline.pages) && baseline.pages === pages);

// { inconclusive, line }: inconclusive only when there are misses AND the p95 is above the limit
export function verdict({ misses, latency, baseline, pages }) {
  const limit = comparable(baseline, pages) ? limitFor(baseline) : null, p95 = num(latency && latency.p95);
  if (!misses || limit === null || !Number.isFinite(p95) || p95 <= limit) return { inconclusive: false, line: '' };
  return { inconclusive: true, line: `inconclusive: machine under load (p95 ${Math.round(p95)}ms vs baseline ${Math.round(baseline.p95)}ms); re-run alone` };
}

// the latency block for tools/bench.best.json after this result, or null when it stays: a conclusive result that reached the
// floor, on a measured p95 that is below the baseline (or there is no baseline yet). Never loosens.
export function nextLatency(result, floor) {
  const env = result && result.env, p95 = num(result && result.latency && result.latency.p95);
  if (!env || !Number.isFinite(p95) || result.inconclusive || !(Number(result.score) >= Number(floor && floor.score))) return null;
  const cur = num(floor && floor.latency && floor.latency[env] && floor.latency[env].p95);
  const was = floor && floor.latency && floor.latency[env];
  if (Number.isFinite(cur) && (cur <= p95 || !comparable(was, result.pages))) return null; // never loosens, and never swaps a baseline for one measured with another number of pages
  return { ...(floor && floor.latency), [env]: { p50: result.latency.p50, p95, n: result.latency.n, cores: result.cores, pages: result.pages } };
}
