// The benchmark floor (tools/bench.best.json) rises by itself. After a clean benchmark on main, .github/workflows/bench.yml runs
// this on the score it just measured: when the score minus MARGIN is above the floor, the floor becomes that; otherwise nothing is
// written. It never lowers the floor, in score or in total. The margin leaves room for the few asks whose answer depends on the day.
//   node tools/bench-floor.mjs bench-score.json            print what would happen
//   node tools/bench-floor.mjs bench-score.json --write    and write tools/bench.best.json when it would rise
//   --floor path.json  read and write a different floor file (the tests)
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MARGIN = 5;

// the floor the result earns, or null when the floor stays (the result is not above it, or something is not a number)
export function nextFloor(result, floor, margin = MARGIN) {
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
  const next = nextFloor(result, floor);
  if (!next) { console.log(`floor stays at ${floor.score}/${floor.total} (this run: ${result.score}/${result.total}, margin ${MARGIN})`); process.exit(0); }
  console.log(`floor rises from ${floor.score}/${floor.total} to ${next.score}/${next.total} (this run: ${result.score}/${result.total}, margin ${MARGIN})`);
  if (args.includes('--write')) writeFileSync(floorFile, JSON.stringify({ ...floor, ...next, date: new Date().toISOString().slice(0, 10) }) + '\n');
}
