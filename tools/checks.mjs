// The fast checks an hourly run makes before it opens a PR, in one go: fringe ledger, every-skill collisions,
// calendar parser, the cross-sense board draft, the board reader's redaction, and the full everyday benchmark (against tools/bench.best.json).
// The full browser suite (tools/test_void.mjs) still runs in CI.
//   node tools/checks.mjs      prints one line per check, exit 1 if any fails
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { conflictMarkers } from '../void-live-deploy/lib/code-review.js';

const here = dirname(fileURLToPath(import.meta.url));
const run = (args) => { const r = spawnSync(process.execPath, args, { cwd: resolve(here, '..'), encoding: 'utf8', timeout: 1800000 }); // 30 min: the full bench takes about 20 on a slow shared machine
  return { ok: r.status === 0, out: ((r.stdout || '') + (r.stderr || '')).trim().split('\n').filter((l) => !/ExperimentalWarning|trace-warnings/.test(l)) }; };
const results = [];
// The tests, one per line: add yours on its own line (a single long line made every two PRs that added a test conflict).
for (const [name, file] of [
  ['fringe', 'fringe.mjs'],
  ['skills', 'skills-check.mjs'],
  ['calendar', 'test_calendar.mjs'],
  ['glyphs', 'test_glyphs.mjs'],
  ['review', 'review.test.mjs'],
  ['figures', 'figures.test.mjs'],
  ['motorbody', 'motorbody.test.mjs'],
  ['incident', 'incident.test.mjs'],
  ['releasenotes', 'releasenotes.test.mjs'],
  ['intent', 'intent.test.mjs'],
  ['revert-target', 'revert-target.test.mjs'],
  ['status', 'status.test.mjs'],
  ['growth', 'growth.test.mjs'],
  ['growth-tree', 'growth-tree.test.mjs'],
  ['review-learn', 'review-learn.test.mjs'],
  ['bench-floor', 'bench-floor.test.mjs'],
  ['bench-load', 'bench-load.test.mjs'],
  ['merge-main', 'merge-main.test.mjs'],
  ['prepush', 'prepush.test.mjs'],
  ['take', 'take.test.mjs'],
  ['sorry', 'sorry.test.mjs'],
  ['voice', 'voice.test.mjs'],
  ['pr-ready', 'pr-ready.test.mjs'],
  ['review-api', 'review-api.test.mjs'], ['review-pr', 'review-pr.test.mjs'],
  ['go', 'go.test.mjs'],
  ['monopoly', 'monopoly.test.mjs'],
  ['battleship', 'battleship.test.mjs'],
  ['poker', 'poker.test.mjs'],
  ['fireworks', 'fireworks.test.mjs'],
  ['connect4', 'connect4.test.mjs'],
  ['explainers', 'explainers.test.mjs'],
  ['learning', 'learning.test.mjs'],
  ['goal', 'goal.test.mjs'],
  ['forge', 'forge.test.mjs'],
  ['sky-math', 'sky-math.test.mjs'],
  ['misses-snapshot', 'misses-snapshot.test.mjs'],
  ['night-sky', 'night-sky.test.mjs'],
  ['sky-card', 'sky-card.test.mjs'],
  ['learn', 'learn.test.mjs'],
  ['learn-draft', 'learn-draft.test.mjs'],
  ['learn-e2e', 'learn.e2e.test.mjs'],
  ['model-bench', 'model-bench.test.mjs'],
  ['model-switch', 'model-switch.test.mjs'],
  ['bench-route', 'bench-route.test.mjs'],
  ['poster', 'poster.test.mjs'],
  ['next-skill', 'next-skill.test.mjs'],
  ['share', 'share.test.mjs'],
  ['advance', 'advance.test.mjs'],
  ['gaps', 'gaps.test.mjs'],
  ['sky', 'sky.test.mjs'],
  ['aurora', 'aurora.test.mjs'],
  ['drone', 'drone.test.mjs'],
  ['automations', 'automations.test.mjs'],
  ['actions', 'actions.test.mjs'],
  ['ringer', 'ringer.test.mjs'],
  ['queue', 'queue.test.mjs'],
  ['actions-card', 'actions-card.test.mjs'],
  ['services', 'services.test.mjs'], ['sale-jobs', 'sale-jobs.test.mjs'], ['reply-to-job', 'reply-to-job.test.mjs'], ['email-worker', 'email-worker.test.mjs'], ['rehearsal-route', 'rehearsal-route.test.mjs'], ['email-send', 'email-send.test.mjs'],
  ['proposal', 'proposal.test.mjs'], ['job-draft', 'job-draft.test.mjs'],
  ['memory-card', 'memory-card.test.mjs'],
  ['told-me', 'told-me.test.mjs'],
  ['memory', 'memory.test.mjs'],
  ['live', 'live.test.mjs'],
  ['draft', 'draft.test.mjs'],
  ['drafts', 'draft-check.mjs'],
  ['extension', 'test_extension.mjs'],
  ['placement', 'placement.test.mjs'],
  ['skills-index', 'skills-index.test.mjs'],
  ['heavy', 'heavy.test.mjs'],
]) {
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
// no conflict marker anywhere in the tree (#291 merged one into the growth ledger): these checks run on the merged head, so a
// merge of main made after they ran is not covered; run them again after merging main, before the push
{ const root = resolve(here, '..'), marked = [];
  for (const f of spawnSync('git', ['ls-files'], { cwd: root, encoding: 'utf8', maxBuffer: 64 << 20 }).stdout.split('\n').filter(Boolean)) {
    let t = ''; try { t = readFileSync(resolve(root, f), 'utf8'); } catch (_) { continue; }
    if (t.length < 5e6 && !t.includes('\0')) for (const c of conflictMarkers(t)) marked.push(f + ':' + c.line);
  }
  results.push(['markers', !marked.length, marked.length ? 'conflict markers at ' + marked.slice(0, 5).join(', ') + ': settle the merge (node tools/merge-main.mjs) and remove them' : 'no conflict markers in the tree']); }
// the bench and the deploy serve void-live-deploy/index.html: an edit to void.html that was not copied there is tested stale, silently
{ const read = (f) => readFileSync(resolve(here, '..', f), 'utf8').replace(/\r\n/g, '\n'), src = read('void.html');
  const stale = ['void-live-deploy/index.html', 'void-live-deploy/void.html'].filter((f) => read(f) !== src);
  results.push(['copies', !stale.length, stale.length ? stale.join(' and ') + ' differ from void.html: cp void.html void-live-deploy/index.html && cp void.html void-live-deploy/void.html' : 'void.html and both deploy copies match']); }
// skills/index.json is generated from skills/order/ (tools/skills-index.mjs): a skill added without its order file, or an order file
// without the index rewritten, is caught here, not on the page
{ const r = run([resolve(here, 'skills-index.mjs'), '--check']); results.push(['index', r.ok, r.out[r.out.length - 1] || '']); }
// VOID_SKIP_BENCH (the same switch tools/test_void.mjs honours): the benchmark is not a merge gate (owner, 2026-10-09, the suite split in
// domains/void.frontier.md); CI runs it as its own job (.github/workflows/bench.yml) and reports the number on the PR, and a drop below
// the floor is a fix PR, never a wait. Without the variable this row replays it as before.
if (process.env.VOID_SKIP_BENCH) results.push(['bench', true, 'skipped: CI runs it (bench.yml)']);
else { const r = run([resolve(here, 'bench.mjs'), '--score']); let b = null; try { b = JSON.parse(r.out.filter((l) => l.startsWith('{')).pop()); } catch (_) {} // stderr is merged in: the JSON is the last line that starts with {
  const best = JSON.parse(readFileSync(resolve(here, 'bench.best.json'), 'utf8'));
  const ok = !!b && b.score >= best.score && b.total >= best.total; // score counts a miss that passed alone as a pass and lists only the ones that reproduce alone (tools/bench-load.mjs): below the floor is a real failure, load or not
  results.push(['bench', ok, b ? `${b.inconclusive ? b.note + ' - ' : ''}${b.score}/${b.total} (floor ${best.score})${b.cached ? ' (nothing it reads changed since the passing run at ' + b.cached + '; not replayed: --fresh forces it)' : ''}${b.wrong.length ? ' wrong: ' + b.wrong.join(' | ') : ''}` : r.out.slice(-2).join(' ')]); }
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
if (process.env.VOID_SKIP_BENCH && !results.some(([n, , l]) => n === 'bench' && /^skipped/.test(l))) results.push(['self', false, 'VOID_SKIP_BENCH is set but the bench row did not say skipped']);
for (const [n, ok, line] of results) console.log((ok ? (/^inconclusive/.test(line) ? 'inconclusive ' : 'ok   ') : 'FAIL ') + n.padEnd(9) + line);
process.exit(results.every((r) => r[1]) ? 0 : 1);
