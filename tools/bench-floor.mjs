// The benchmark floor (tools/bench.best.json) rises by itself. After a clean benchmark on main, .github/workflows/bench.yml runs
// this on the score it just measured: when the score minus MARGIN is above the floor, the floor becomes that; otherwise nothing is
// written. It never lowers the floor, in score or in total. A result marked inconclusive (the machine was under load) changes
// nothing; a conclusive one at or above the floor also tightens the latency baseline for its environment (nextLatency). The margin leaves room for the few asks whose answer depends on the day.
//   node tools/bench-floor.mjs bench-score.json            print what would happen
//   node tools/bench-floor.mjs bench-score.json --write    and write tools/bench.best.json when it would rise
//   --baseline-only    with --write, record the latency baseline and leave the floor where it is
//   --floor path.json  read and write a different floor file (the tests)
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nextLatency } from './bench-load.mjs';

export const MARGIN = 5;

// the floor the result earns, or null when the floor stays (the result is not above it, or something is not a number)
export function nextFloor(result, floor, margin = MARGIN) {
  if (result && result.inconclusive) return null; // a run the machine's load disturbed says nothing about Void (tools/bench-load.mjs)
  const score = Number(result && result.score), total = Number(result && result.total);
  const fScore = Number(floor && floor.score), fTotal = Number(floor && floor.total);
  if (![score, total, fScore, fTotal].every(Number.isFinite) || score > total) return null;
  const earned = score - margin;
  if (earned <= fScore) return null;
  return { score: earned, total: Math.max(fTotal, total) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), at = args.indexOf('--floor');
  const floorFile = at >= 0 ? resolve(args[at + 1]) : resolve(dirname(fileURLToPath(import.meta.url)), 'bench.best.json');
  const resultFile = args.find((a, i) => !a.startsWith('--') && (at < 0 || i !== at + 1));
  if (!resultFile) { console.error('usage: node tools/bench-floor.mjs bench-score.json [--write] [--floor path.json]'); process.exit(2); }
  const result = JSON.parse(readFileSync(resolve(resultFile), 'utf8')), floor = JSON.parse(readFileSync(floorFile, 'utf8'));
  if (result.inconclusive) { console.log(`inconclusive result (${result.note || 'machine under load'}): the floor and the latency baseline stay`); process.exit(0); }
  const next = args.includes('--baseline-only') ? null : nextFloor(result, floor), latency = nextLatency(result, floor);
  if (latency) console.log(`latency baseline (${result.env}) ${floor.latency && floor.latency[result.env] ? 'tightens from p95 ' + floor.latency[result.env].p95 + 'ms ' : 'is recorded '}at p95 ${result.latency.p95}ms (p50 ${result.latency.p50}ms)`);
  if (!next) console.log(`${args.includes('--baseline-only') ? 'floor left alone (--baseline-only), it is' : 'floor stays'} at ${floor.score}/${floor.total} (this run: ${result.score}/${result.total}, margin ${MARGIN})`);
  else console.log(`floor rises from ${floor.score}/${floor.total} to ${next.score}/${next.total} (this run: ${result.score}/${result.total}, margin ${MARGIN})`);
  if ((next || latency) && args.includes('--write')) writeFileSync(floorFile, JSON.stringify({ ...floor, ...(next || {}), ...(latency ? { latency } : {}), ...(next ? { date: new Date().toISOString().slice(0, 10) } : {}) }) + '\n');
}
