// The generated cards, compared with the base branch (void-review.yml, lists run 20). A skill that reached main without its family,
// book page or map line turned main's families, book, rule-registry and map checks red twice (delivery-board #2707, status-digest #2713),
// because nothing on the pull request ran the cards' own checks. This runs them on the pull request: the committed cards
// (tools/refresh.mjs --check, the steps that follow from the skills) and the map (tools/map-coverage.test.mjs). A card that is
// already stale on the base is not this pull request's to fix; one only the pull request makes stale blocks it, with the fix named.
//   node tools/cards-delta.mjs --base origin/main
import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
/** the committed cards that follow from the skills (the volatile ones are the deploy's) */
export const STEPS = ['index', 'first', 'deps', 'families', 'guide', 'what'];
/** how each one is put right, in plain words */
export const FIX = {
  families: 'name the new skill in a family in tools/families.mjs (or make it a member of a family skill), then run node tools/refresh.mjs',
  map: 'add a line for the new file to docs/MAP.md (node --test tools/map-coverage.test.mjs names it)',
};
const fixOf = (n) => FIX[n] || 'run node tools/refresh.mjs and commit what it writes';

/** the steps a refresh --check output says are stale: its FAIL lines. Pure. */
export function staleSteps(text) {
  return [...String(text || '').matchAll(/^FAIL\s+(\S+)/gm)].map((m) => m[1]);
}
/** what this head makes stale that the base does not: names, in order, once. Pure. */
export function added(head, base) {
  const have = new Set(base || []), out = [];
  for (const n of head || []) if (!have.has(n) && !out.includes(n)) out.push(n);
  return out;
}

function stale(cwd) {
  const r = spawnSync(process.execPath, [resolve(cwd, 'tools/refresh.mjs'), '--check', '--only', STEPS.join(',')], { cwd, encoding: 'utf8', timeout: 240000, maxBuffer: 40e6 });
  const out = staleSteps((r.stdout || '') + '\n' + (r.stderr || ''));
  if (r.status !== 0 && !out.length) out.push('refresh'); // it stopped without saying which: still not this head's pass
  const m = spawnSync(process.execPath, ['--test', resolve(cwd, 'tools/map-coverage.test.mjs')], { cwd, encoding: 'utf8', timeout: 60000, maxBuffer: 20e6 });
  if (m.status !== 0) out.push('map');
  return out;
}

function main() {
  const i = process.argv.indexOf('--base'), baseRef = i >= 0 ? process.argv[i + 1] : 'origin/main';
  if (!baseRef) { console.error('usage: node tools/cards-delta.mjs --base origin/main'); process.exit(2); }
  const head = stale(root);
  if (!head.length) { console.log('cards: every generated card and the map are current on this head'); process.exit(0); }
  const dir = mkdtempSync(resolve(tmpdir(), 'cards-base-'));
  const add = spawnSync('git', ['worktree', 'add', '--detach', '-q', dir, baseRef], { cwd: root, encoding: 'utf8' });
  if (add.status !== 0) { console.error('could not check out ' + baseRef + ': ' + (add.stderr || '').slice(0, 300)); process.exit(1); }
  try {
    const base = stale(dir), mine = added(head, base);
    if (!mine.length) { console.log('cards: stale here (' + head.join(', ') + ') but already stale on ' + baseRef + ', so not this pull request\'s'); process.exit(0); }
    for (const n of mine) console.error('stale: ' + n + ' -> ' + fixOf(n));
    console.error('cards: ' + mine.length + ' generated card(s) this pull request leaves stale');
    process.exit(1);
  } finally { spawnSync('git', ['worktree', 'remove', '--force', dir], { cwd: root }); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
