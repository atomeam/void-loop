// The fast checks an hourly run makes before it opens a PR, in one go: fringe ledger, every-skill collisions,
// calendar parser, the cross-sense board draft, the board reader's redaction, and the full everyday benchmark (against tools/bench.best.json).
// The full browser suite (tools/test_void.mjs) still runs in CI.
//   node tools/checks.mjs      prints one line per check, exit 1 if any fails
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const run = (args) => { const r = spawnSync(process.execPath, args, { cwd: resolve(here, '..'), encoding: 'utf8', timeout: 1800000 }); // 30 min: the full bench takes about 20 on a slow shared machine
  return { ok: r.status === 0, out: ((r.stdout || '') + (r.stderr || '')).trim().split('\n').filter((l) => !/ExperimentalWarning|trace-warnings/.test(l)) }; };
const results = [];
for (const [name, file] of [['fringe', 'fringe.mjs'], ['skills', 'skills-check.mjs'], ['calendar', 'test_calendar.mjs'], ['glyphs', 'test_glyphs.mjs'], ['review', 'review.test.mjs'], ['figures', 'figures.test.mjs'], ['motorbody', 'motorbody.test.mjs'], ['incident', 'incident.test.mjs'], ['releasenotes', 'releasenotes.test.mjs'], ['intent', 'intent.test.mjs'], ['revert-target', 'revert-target.test.mjs'], ['status', 'status.test.mjs'], ['growth', 'growth.test.mjs'], ['review-learn', 'review-learn.test.mjs'], ['take', 'take.test.mjs'], ['sorry', 'sorry.test.mjs'], ['voice', 'voice.test.mjs'], ['pr-ready', 'pr-ready.test.mjs'], ['review-api', 'review-api.test.mjs'], ['go', 'go.test.mjs'], ['monopoly', 'monopoly.test.mjs'], ['battleship', 'battleship.test.mjs'], ['poker', 'poker.test.mjs'], ['fireworks', 'fireworks.test.mjs'], ['connect4', 'connect4.test.mjs'], ['explainers', 'explainers.test.mjs'], ['learn', 'learn.test.mjs'], ['learn-draft', 'learn-draft.test.mjs'], ['automations', 'automations.test.mjs'], ['actions', 'actions.test.mjs'], ['live', 'live.test.mjs'], ['drafts', 'draft-check.mjs'], ['extension', 'test_extension.mjs']]) {
  const r = run([resolve(here, file)]); results.push([name, r.ok, r.out[r.out.length - 1] || '']);
}
// Every script parses, and no text file was re-encoded through a Windows code page (a merge did both to main once:
// a dash turned into three box-drawing letters, lines doubled, a const declared twice, and CI died before running a single test).
{ const files = spawnSync('git', ['ls-files', '*.js', '*.mjs', '*.html', '*.md', '*.json', '*.py', '*.yml'], { cwd: resolve(here, '..'), encoding: 'utf8' }).stdout.split('\n').filter(Boolean);
  const GARBLED = /\u0393[\u00c7\u00c4]|\u252c[\u2556\u2591\u00aa]|\u251c[\u00ba\u00e9]|\u256c\u00f4/; // the cp437 readings of UTF-8 dashes, dots, quotes
  const garbled = files.filter((f) => GARBLED.test(readFileSync(resolve(here, '..', f), 'utf8')));
  const broken = files.filter((f) => /\.m?js$/.test(f) && !run(['--check', resolve(here, '..', f)]).ok);
  results.push(['files', !garbled.length && !broken.length, garbled.length || broken.length
    ? [garbled.length && 'garbled text in ' + garbled.join(', '), broken.length && 'does not parse: ' + broken.join(', ')].filter(Boolean).join('; ')
    : files.length + ' files: clean text, every script parses']); }
// nothing installed is ever tracked: a node_modules symlink from a worktree once got committed, and copying that commit
// back replaced the real folder with a link to itself
{ const bad = spawnSync('git', ['ls-files', '--', 'node_modules', 'node_modules/*'], { cwd: resolve(here, '..'), encoding: 'utf8' }).stdout.split('\n').filter(Boolean);
  results.push(['tracked', !bad.length, bad.length ? 'git tracks ' + bad.slice(0, 3).join(', ') + ': git rm --cached it (a worktree runs its own npm ci, never a link)' : 'no installed files tracked']); }
// the bench and the deploy serve void-live-deploy/index.html: an edit to void.html that was not copied there is tested stale, silently
{ const read = (f) => readFileSync(resolve(here, '..', f), 'utf8').replace(/\r\n/g, '\n'), src = read('void.html');
  const stale = ['void-live-deploy/index.html', 'void-live-deploy/void.html'].filter((f) => read(f) !== src);
  results.push(['copies', !stale.length, stale.length ? stale.join(' and ') + ' differ from void.html: cp void.html void-live-deploy/index.html && cp void.html void-live-deploy/void.html' : 'void.html and both deploy copies match']); }
{ const r = run([resolve(here, 'bench.mjs'), '--score']); let b = null; try { b = JSON.parse(r.out[r.out.length - 1]); } catch (_) {}
  const best = JSON.parse(readFileSync(resolve(here, 'bench.best.json'), 'utf8'));
  const ok = !!b && b.score >= best.score && b.total >= best.total;
  results.push(['bench', ok, b ? `${b.score}/${b.total} (floor ${best.score})${b.cached ? ' (nothing it reads changed since the passing run at ' + b.cached + '; not replayed: --fresh forces it)' : ''}${b.wrong.length ? ' wrong: ' + b.wrong.join(' | ') : ''}` : r.out.slice(-2).join(' ')]); }
{ // the board reader must drop anything key-like before it prints (tools/misses.mjs)
  const { redact } = await import('./misses.mjs');
  const cases = [['unlock abcdEFGH12345678zz', null], ['my key is Zx9kQ2mP7vR4tY8wL3nB', null], ['mail sam@example.com', 'mail [email]'],
    ['call 555-123-4567', 'call [number]'], ['weather in kyoto', 'weather in kyoto'], ['define antidisestablishmentarianism', 'define antidisestablishmentarianism']];
  const bad = cases.filter(([a, want]) => redact(a) !== want);
  results.push(['misses', !bad.length, bad.length ? 'redact wrong for: ' + bad.map((c) => c[0]).join(' | ') : cases.length + ' redaction cases ok']); }
{ // test traffic (probe, ping, test) never becomes a miss or a want, and real questions about probes still do (lib/noise.js, tools/will.py)
  const { isNoise } = await import('../void-live-deploy/lib/noise.js');
  const py = (await import('node:fs')).readFileSync(new URL('./will.py', import.meta.url), 'utf8').includes('NOISE.match(');
  const cases = [['probe', true], ['ping', true], ['research probe', true], ['test', true], ['how do space probes work', false], ['probe the moon', false], ['weather in paris', false]];
  const bad = cases.filter(([a, want]) => isNoise(a) !== want);
  results.push(['noise', !bad.length && py, !py ? 'tools/will.py no longer uses the noise list' : bad.length ? 'noise wrong for: ' + bad.map((c) => c[0]).join(' | ') : cases.length + ' noise cases ok (miss board and will)']); }
for (const [n, ok, line] of results) console.log((ok ? 'ok   ' : 'FAIL ') + n.padEnd(9) + line);
process.exit(results.every((r) => r[1]) ? 0 : 1);
