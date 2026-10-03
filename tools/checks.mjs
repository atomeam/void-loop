// The fast checks an hourly run makes before it opens a PR, in one go: fringe ledger, every-skill collisions,
// calendar parser, the cross-sense board draft, and the full everyday benchmark (against tools/bench.best.json).
// The full browser suite (tools/test_void.mjs) still runs in CI.
//   node tools/checks.mjs      prints one line per check, exit 1 if any fails
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const run = (args) => { const r = spawnSync(process.execPath, args, { cwd: resolve(here, '..'), encoding: 'utf8', timeout: 900000 });
  return { ok: r.status === 0, out: ((r.stdout || '') + (r.stderr || '')).trim().split('\n').filter((l) => !/ExperimentalWarning|trace-warnings/.test(l)) }; };
const results = [];
for (const [name, file] of [['fringe', 'fringe.mjs'], ['skills', 'skills-check.mjs'], ['calendar', 'test_calendar.mjs'], ['glyphs', 'test_glyphs.mjs']]) {
  const r = run([resolve(here, file)]); results.push([name, r.ok, r.out[r.out.length - 1] || '']);
}
{ const r = run([resolve(here, 'bench.mjs'), '--score']); let b = null; try { b = JSON.parse(r.out[r.out.length - 1]); } catch (_) {}
  const best = JSON.parse(readFileSync(resolve(here, 'bench.best.json'), 'utf8'));
  const ok = !!b && b.score >= best.score && b.total >= best.total;
  results.push(['bench', ok, b ? `${b.score}/${b.total} (floor ${best.score})${b.wrong.length ? ' wrong: ' + b.wrong.join(' | ') : ''}` : r.out.slice(-2).join(' ')]); }
for (const [n, ok, line] of results) console.log((ok ? 'ok   ' : 'FAIL ') + n.padEnd(9) + line);
process.exit(results.every((r) => r[1]) ? 0 : 1);
