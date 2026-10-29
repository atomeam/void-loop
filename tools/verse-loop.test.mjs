// tools/verse-loop.mjs: the pure parts, and whole laps in a throwaway repo with a fake brain, fake checks and a fake gh.
// Positive and negative controls (docs/GATE-STANDARDS.md): a lap that should ship ships, and each way a lap must stop does stop.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { parseArgs, topItem, scanDiff, pickTask, verdict, takeLock, agentCommand, buildPrompt, lap, groomNext, assimilationGaps, ease, pauseState, recordOutcome, settlePrs, failedLoopPr, loadState, PAUSE_TITLE, GROOM_TITLE, LOOP_CODE } from './verse-loop.mjs';

const quiet = () => {};
const sh = (cwd, ...a) => { const r = spawnSync('git', a, { cwd, encoding: 'utf8' }); if (r.status) throw new Error(a.join(' ') + ': ' + r.stderr); return r.stdout.trim(); };

/** A repo with a bare origin, docs, a checks file whose checks read flag files, a fake brain and a fake gh. */
const HAND_NEXT = '# NEXT\n\n1. **Done thing** status: done\n2. **Calculator sitemap** easiest small site\n3. **Later**\n';
function sandbox({ red = [], groomed = true, gh: fixtures = {} } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'vl-test-'));
  const origin = join(dir, 'origin.git'), work = join(dir, 'work');
  sh(dir, 'init', '-q', '--bare', '-b', 'main', origin);
  sh(dir, 'clone', '-q', origin, work);
  sh(work, 'config', 'user.email', 'loop@example.invalid'); sh(work, 'config', 'user.name', 'loop test');
  mkdirSync(join(work, 'docs')); mkdirSync(join(work, 'tools'));
  writeFileSync(join(work, 'docs/NEXT.md'), groomed ? groomNext(HAND_NEXT) : HAND_NEXT);
  writeFileSync(join(work, 'docs/TAGTEAM.md'), '# TAGTEAM\n');
  writeFileSync(join(work, 'docs/GATE-STANDARDS.md'), '# Gate\nblocked is INCOMPLETE\n');
  writeFileSync(join(work, '.gitignore'), 'red-*\n');
  for (const r of red) writeFileSync(join(work, 'red-' + r), '');
  // each check is red while its flag file exists, or while broke.txt exists (a change that breaks it)
  const check = (n) => ({ name: n, cmd: `test ! -e red-${n} && test ! -e broke-${n}.txt` });
  writeFileSync(join(work, 'tools/verse-loop.checks.json'), JSON.stringify([check('alpha'), check('beta')]));
  sh(work, 'add', '-A'); sh(work, 'commit', '-q', '-m', 'start'); sh(work, 'push', '-q', 'origin', 'main');
  // a fake gh: every call is logged to gh-calls.jsonl; answers come from gh.json by the first two words ("pr list", "issue list" ...)
  const gh = join(dir, 'gh.cjs');
  writeFileSync(join(dir, 'gh.json'), JSON.stringify(fixtures));
  writeFileSync(gh, `#!${process.execPath}
const fs = require('fs'), d = ${JSON.stringify(dir)}, a = process.argv.slice(2), k = a.slice(0, 2).join(' ');
fs.appendFileSync(d + '/gh-calls.jsonl', JSON.stringify(a) + '\\n');
const fx = JSON.parse(fs.readFileSync(d + '/gh.json', 'utf8'));
if (k === 'pr create') { fs.writeFileSync(d + '/gh-args.txt', a.join(' ') + '\\n'); console.log('https://github.com/example/repo/pull/7'); }
else if (k in fx) console.log(typeof fx[k] === 'string' ? fx[k] : JSON.stringify(fx[k]));
else if (k === 'issue create') console.log('https://github.com/example/repo/issues/8');
else if (k === 'pr view') console.log('{"state":"OPEN"}');
else if (k !== 'workflow run' && k !== 'issue close' && k !== 'run view') console.log('[]');
`, { mode: 0o755 });
  return { dir, origin, work, gh };
}
const ghCalls = (s) => (existsSync(join(s.dir, 'gh-calls.jsonl')) ? readFileSync(join(s.dir, 'gh-calls.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : []);
const setGh = (s, fixtures) => writeFileSync(join(s.dir, 'gh.json'), JSON.stringify(fixtures));
const NO_KEYS = { CLOUDFLARE_API_TOKEN: '', OPENROUTER_API_KEY: '', GROQ_API_KEY: '', GEMINI_API_KEY: '', CEREBRAS_API_KEY: '', VERSE_CODER_SCRIPT: '', VOID_OWNER_TOKEN: '' }; // the automerge job carries the real owner token: no test reads it
const env = (s, agentCmd) => ({ ...process.env, VERSE_LOOP_GH: s.gh, VERSE_LOOP_AGENT_CMD: agentCmd, GIT_TERMINAL_PROMPT: '0' });

test('flags', () => {
  assert.deepEqual([parseArgs([]).agent, parseArgs([]).once, parseArgs([]).every], ['verse', false, 0]);
  const o = parseArgs(['--every', '30', '--dry-run', '--agent', 'aider']);
  assert.deepEqual([o.every, o.dryRun, o.agent], [30, true, 'aider']);
  assert.equal(parseArgs(['--every', '5', '--once']).every, 0, '--once wins');
  assert.throws(() => parseArgs(['--agent', 'gpt']), /must be one of/);
  assert.throws(() => parseArgs(['--every', '0']), /minutes/);
  assert.throws(() => parseArgs(['--force']), /unknown flag/);
});

test('the top open NEXT item skips done ones', () => {
  assert.deepEqual(topItem('x\n1. **A** status: done\n2. **B** next\n'), { n: 2, text: '**B** next' });
  assert.equal(topItem('1. a status: assimilated\n'), null);
  assert.equal(topItem('no list'), null);
});

test('the key scan reads added lines only, and catches each shape', () => {
  const add = (s) => 'diff --git a/x b/x\n+++ b/x.js\n+' + s + '\n';
  const keys = ['AKIA' + 'Q'.repeat(16), 'ghp_' + 'a'.repeat(36), 'sk-ant-' + 'b'.repeat(30), 'sk-' + 'c'.repeat(40), 'AIza' + 'd'.repeat(35),
    'xoxb-' + '1'.repeat(12), 'gsk_' + 'e'.repeat(48), '-----BEGIN RSA ' + 'PRIVATE KEY-----', 'MY_API_KEY = "' + 'f'.repeat(20) + '"'];
  for (const k of keys) assert.equal(scanDiff(add(k)).length, 1, k.slice(0, 8));
  assert.equal(scanDiff('+++ b/x.js\n-' + keys[0] + '\n').length, 0, 'a removed key is not a finding');
  assert.equal(scanDiff(add('process.env.GROQ_API_KEY')).length, 0, 'reading a key from the env is fine');
  assert.equal(scanDiff('+++ b/.env\n+A=1\n')[0].kind, 'env file');
  assert.equal(scanDiff('+++ b/.env.example\n+A=\n').length, 0);
});

test('the task: red first, then the brain\'s own lane', () => {
  const red = [{ name: 'a', ok: true }, { name: 'b', ok: false, cmd: 'x' }, { name: 'c', ok: false }];
  assert.equal(pickTask({ before: red, agent: 'aider' }).check, 'b', 'the first red check');
  assert.deepEqual(pickTask({ before: red, agent: 'verse' }), { kind: 'fix', check: 'b', cmd: 'x', output: '' }, 'Verse\'s coder fixes checks');
  const green = [{ name: 'a', ok: true }];
  assert.equal(pickTask({ before: green, agent: 'verse' }).kind, 'probe');
  assert.equal(pickTask({ before: green, agent: 'verse', next: '1. **X**', probe: false }).text, '**X**', 'no site to probe: NEXT');
  assert.equal(pickTask({ before: green, agent: 'verse', next: '1. **X**', task: 'do Y' }).text, 'do Y', '--task wins over a probe');
  assert.equal(pickTask({ before: green, agent: 'cmd', next: '1. **X**' }).text, '**X**');
  assert.equal(pickTask({ before: green, agent: 'cmd', next: '1. X', task: 'do Y' }).text, 'do Y');
  assert.equal(pickTask({ before: green, agent: 'cmd', next: '' }).kind, 'idle');
});

test('the verdict: no new red, the target fixed, strict wants all green', () => {
  const g = (n, ok) => ({ name: n, ok });
  assert.equal(verdict([g('a', true), g('b', false)], [g('a', false), g('b', false)], { kind: 'next' }).ok, false);
  assert.equal(verdict([g('a', true), g('b', false)], [g('a', true), g('b', false)], { kind: 'next' }).ok, true, 'old red stays: no new red');
  assert.equal(verdict([g('a', false)], [g('a', false)], { kind: 'fix', check: 'a' }).ok, false, 'target still red');
  assert.equal(verdict([g('a', false), g('b', false)], [g('a', true), g('b', false)], { kind: 'fix', check: 'a' }).ok, true);
  assert.equal(verdict([g('a', false), g('b', false)], [g('a', true), g('b', false)], { kind: 'fix', check: 'a' }, true).ok, false, 'strict');
});

test('the lock: one holder; a dead holder is stale', () => {
  const d = mkdtempSync(join(tmpdir(), 'vl-lock-')), p = join(d, 'l');
  assert.equal(takeLock(p), true);
  assert.equal(takeLock(p), false, 'held by this live process');
  writeFileSync(p, JSON.stringify({ pid: 2 ** 22 + 7, at: Date.now() }));
  assert.equal(takeLock(p), true, 'a lock whose process is gone is replaced');
  writeFileSync(p, JSON.stringify({ pid: process.pid, at: Date.now() - 4 * 3600e3 }));
  assert.equal(takeLock(p), true, 'a lock older than 3 hours is replaced');
  rmSync(d, { recursive: true });
});

test('brains: Verse\'s is propose-fix for a probe and verse-coder for the rest; keys never appear in the command', () => {
  const d = mkdtempSync(join(tmpdir(), 'vl-p-')), pf = join(d, 'p.md'); writeFileSync(pf, 'do it');
  const v = agentCommand('verse', pf, { env: {}, outDir: '/o', dryRun: true });
  assert.deepEqual(v.args, ['tools/propose-fix.mjs', '--out', '/o', '--dry']);
  const c = agentCommand('verse', pf, { env: { GROQ_API_KEY: 'g'.repeat(30) }, kind: 'fix', target: 'alpha', checksFile: '/c.json', repo: '/r' });
  assert.match(c.args[0], /tools\/verse-coder\.mjs$/);
  assert.deepEqual(c.args.slice(1), ['--repo', '/r', '--prompt-file', pf, '--checks', '/c.json', '--target', 'alpha']);
  assert.ok(!JSON.stringify(c).includes('g'.repeat(30)));
  assert.deepEqual(agentCommand('verse', pf, { env: {}, kind: 'next', repo: '/r' }).args.slice(1), ['--repo', '/r', '--prompt-file', pf]);
  const e = { VERSE_LOOP_MODEL: 'openrouter/x', OPENROUTER_API_KEY: 'k'.repeat(30) };
  for (const a of ['opencode', 'aider']) assert.ok(!JSON.stringify(agentCommand(a, pf, { env: e })).includes('k'.repeat(30)), a);
  assert.ok(agentCommand('aider', pf, { env: e }).args.includes('--no-auto-commits'));
  assert.throws(() => agentCommand('cmd', pf, { env: {} }), /VERSE_LOOP_AGENT_CMD/);
  const pr = buildPrompt({ task: { kind: 'fix', check: 'alpha', cmd: 'x', output: 'boom' }, tagteam: 'T', gates: 'G' });
  assert.match(pr, /never by weakening the test/); assert.match(pr, /assimilated/); assert.match(pr, /boom/);
});

test('dry run, green: the fake brain takes NEXT item 2 and the lap would ship, with nothing committed or pushed', async () => {
  const s = sandbox();
  const head = sh(s.work, 'rev-parse', 'HEAD');
  const r = await lap(parseArgs(['--once', '--dry-run', '--agent', 'cmd']), { cwd: s.work, env: env(s, 'grep -q "NEXT 2" "$VERSE_LOOP_PROMPT_FILE" && echo built > built.txt'), log: quiet });
  assert.equal(r.outcome, 'would-ship', r.why);
  assert.deepEqual(r.task, { kind: 'next', n: 1, text: '[NEXT 2] **Calculator sitemap** easiest small site' }, 'the top of Verse\'s groomed queue');
  assert.match(r.branch, /^loop\/\d{8}-\d{6}$/);
  assert.match(r.tagteamLine, /verse-loop \(cmd\): NEXT 1, \[NEXT 2\] Calculator/);
  assert.equal(sh(s.work, 'rev-parse', 'HEAD'), head, 'no commit');
  assert.equal(readFileSync(join(s.work, 'docs/TAGTEAM.md'), 'utf8'), '# TAGTEAM\n', 'no TAGTEAM line in a dry run');
  assert.equal(sh(s.origin, 'branch', '--list', 'loop/*'), '', 'nothing pushed');
  assert.ok(!existsSync(join(s.dir, 'gh-args.txt')), 'no PR');
});

test('dry run, red: the task is the first red check, and a fix that greens it would ship', async () => {
  const s = sandbox({ red: ['beta'] });
  const r = await lap(parseArgs(['--dry-run', '--agent', 'cmd']), { cwd: s.work, env: env(s, 'grep -q "Check: beta" "$VERSE_LOOP_PROMPT_FILE" && rm red-beta && echo fixed > fix.txt'), log: quiet });
  assert.equal(r.outcome, 'would-ship', r.why);
  assert.deepEqual(r.task, { kind: 'fix', check: 'beta' });
  assert.deepEqual(r.after, [{ name: 'alpha', ok: true }, { name: 'beta', ok: true }]);
});

test('negative controls: a change that breaks a green check, a no-op, a key, a dirty tree, a held lock, Verse with no model key', async () => {
  let s = sandbox();
  let r = await lap(parseArgs(['--dry-run', '--agent', 'cmd']), { cwd: s.work, env: env(s, 'echo x > broke-alpha.txt'), log: quiet });
  assert.equal(r.outcome, 'rejected'); assert.match(r.why, /new red: alpha/);

  s = sandbox({ red: ['beta'] });
  r = await lap(parseArgs(['--dry-run', '--agent', 'cmd']), { cwd: s.work, env: env(s, 'echo half > half.txt'), log: quiet });
  assert.equal(r.outcome, 'rejected'); assert.match(r.why, /target still red: beta/);

  s = sandbox();
  r = await lap(parseArgs(['--dry-run', '--agent', 'cmd']), { cwd: s.work, env: env(s, 'true'), log: quiet });
  assert.equal(r.outcome, 'no-change');

  s = sandbox();
  const key = 'AKIA' + 'Z'.repeat(16);
  r = await lap(parseArgs(['--agent', 'cmd']), { cwd: s.work, env: env(s, `echo "const k = '${key}';" > leak.js`), log: quiet });
  assert.equal(r.outcome, 'refused'); assert.equal(r.secrets[0].file, 'leak.js');
  assert.equal(sh(s.origin, 'branch', '--list', 'loop/*'), '', 'a key is never pushed');

  r = await lap(parseArgs(['--agent', 'cmd']), { cwd: s.work, env: env(s, 'echo y > y.txt'), log: quiet });
  assert.equal(r.outcome, 'skipped', 'the tree still holds the refused change'); assert.match(r.why, /local changes/);

  s = sandbox();
  writeFileSync(join(s.work, '.git', 'verse-loop.lock'), JSON.stringify({ pid: process.pid, at: Date.now() }));
  r = await lap(parseArgs(['--agent', 'cmd']), { cwd: s.work, env: env(s, 'echo y > y.txt'), log: quiet });
  assert.equal(r.outcome, 'skipped'); assert.match(r.why, /another lap/);

  s = sandbox({ red: ['alpha'] });
  r = await lap(parseArgs(['--dry-run']), { cwd: s.work, env: { ...env(s, ''), ...NO_KEYS }, log: quiet });
  assert.equal(r.outcome, 'idle'); assert.match(r.why, /coder needs one model key in the environment: VOID_OWNER_TOKEN \(Verse's own model, \/api\/coder\), CLOUDFLARE_API_TOKEN/);
  assert.deepEqual(r.task, { kind: 'fix', check: 'alpha' }, 'red: Verse takes the check');
});

test('a real lap: branch loop/<time>, one TAGTEAM line, a plain push, a PR with the automerge label, and the lock let go', async () => {
  const s = sandbox();
  const r = await lap(parseArgs(['--once', '--agent', 'cmd']), { cwd: s.work, env: env(s, 'echo built > built.txt'), log: quiet });
  assert.equal(r.outcome, 'shipped', r.why);
  assert.equal(r.pr, 'https://github.com/example/repo/pull/7');
  assert.equal(sh(s.origin, 'branch', '--list', r.branch).replace(/^[*\s]+/, ''), r.branch, 'pushed');
  const files = sh(s.work, 'show', '--name-only', '--format=', r.branch).split('\n').sort();
  assert.deepEqual(files, ['built.txt', 'docs/TAGTEAM.md']);
  const tag = sh(s.work, 'show', r.branch + ':docs/TAGTEAM.md');
  assert.equal(tag.split('\n').filter((l) => l.includes('verse-loop (cmd)')).length, 1);
  const args = readFileSync(join(s.dir, 'gh-args.txt'), 'utf8');
  assert.match(args, /pr create --base main --head loop\/\S+ .*--label automerge\n$/s);
  assert.ok(ghCalls(s).some((c) => c.join(' ') === 'workflow run verify.yml --ref ' + r.branch), 'verify.yml started on the branch');
  assert.equal(r.verify, 'started');
  assert.ok(!existsSync(join(s.work, '.git', 'verse-loop.lock')), 'lock released');
  assert.equal(sh(s.work, 'status', '--porcelain'), '', 'clean for the next lap');
});

test('the script never force-pushes and holds no key', () => {
  const src = readFileSync(new URL('./verse-loop.mjs', import.meta.url), 'utf8');
  assert.ok(!/--force|push', '-f'|\+refs/.test(src.replace(/never --force|never forced/g, '')), 'no force push');
  assert.ok(!/waits for owner/.test(src), 'no human in the loop: nothing is labelled to wait for a person');
  assert.deepEqual(scanDiff('+++ b/tools/verse-loop.mjs\n' + src.split('\n').map((l) => '+' + l).join('\n')).filter((f) => f.kind !== 'assigned secret'), []);
});

/** The free brain, faked: a tools/propose-fix.mjs in the sandbox that writes a result and a patch to --out, or exits 3. */
function fakeVerse(s, { exit = 0, file = 'void-live-deploy/skills/calc.js', confidence = 0.9, confidences = null } = {}) {
  mkdirSync(join(s.work, 'void-live-deploy/skills'), { recursive: true });
  writeFileSync(join(s.work, 'void-live-deploy/skills/calc.js'), 'export const match = /calc/;\n');
  writeFileSync(join(s.work, 'tools/propose-fix.mjs'), `import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
const out = process.argv[process.argv.indexOf('--out') + 1];
if (${exit}) process.exit(${exit});
mkdirSync(out, { recursive: true });
const seq = ${JSON.stringify(confidences)}, tf = ${JSON.stringify(join(s.dir, 'tries.txt'))};
let n = 0; try { n = Number(readFileSync(tf, 'utf8')); } catch {}
writeFileSync(tf, String(n + 1));
const confidence = seq ? seq[Math.min(n, seq.length - 1)] : ${confidence};
writeFileSync(out + '/propose-fix.json', JSON.stringify({ passed: true, skill: 'calc', ask: 'add two and two', title: 'Verse fixes calc', confidence }));
writeFileSync(out + '/propose-fix.patch', 'diff --git a/${file} b/${file}\\n--- a/${file}\\n+++ b/${file}\\n@@ -1 +1 @@\\n-export const match = /calc/;\\n+export const match = /calc|add/;\\n');
`);
  if (file !== 'void-live-deploy/skills/calc.js') { mkdirSync(join(s.work, file, '..'), { recursive: true }); writeFileSync(join(s.work, file), 'export const match = /calc/;\n'); }
  sh(s.work, 'add', '-A'); sh(s.work, 'commit', '-q', '-m', 'brain'); sh(s.work, 'push', '-q', 'origin', 'main');
}
// VOID_SITE on a closed local port: the owner token also gives the coder Verse's own model (/api/coder), and no test reaches the live site
const verseEnv = (s) => ({ ...env(s, ''), ...NO_KEYS, VOID_OWNER_TOKEN: 'test-token-not-real', VOID_SITE: 'http://127.0.0.1:9' });

test('the free brain: a confident patch ships with automerge; under the bar it is retried, then dropped and logged, never waiting for a person; exit 3 moves on to NEXT; a patch outside the skill is refused', async () => {
  let s = sandbox(); fakeVerse(s);
  let r = await lap(parseArgs([]), { cwd: s.work, env: verseEnv(s), log: quiet });
  assert.equal(r.outcome, 'shipped', r.why); assert.equal(r.label, 'automerge'); assert.equal(r.title, 'Verse fixes calc');
  assert.match(sh(s.work, 'show', r.branch + ':void-live-deploy/skills/calc.js'), /calc\|add/);

  s = sandbox(); fakeVerse(s, { confidence: 0.5 });
  r = await lap(parseArgs([]), { cwd: s.work, env: verseEnv(s), log: quiet });
  assert.equal(r.outcome, 'dropped', r.why); assert.match(r.why, /after 3 tries \(0\.5, 0\.5, 0\.5\); dropped and logged/);
  assert.equal(readFileSync(join(s.dir, 'tries.txt'), 'utf8'), '3', 'the first try and 2 more');
  assert.ok(!existsSync(join(s.dir, 'gh-args.txt')), 'no PR, and nothing labelled for a person');
  assert.equal(sh(s.work, 'status', '--porcelain'), '', 'nothing applied');
  const dropped = readFileSync(join(s.work, '.git', 'verse-loop.dropped.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.deepEqual([dropped.length, dropped[0].skill, dropped[0].confidences], [1, 'calc', [0.5, 0.5, 0.5]]);
  assert.equal(loadState(join(s.work, '.git', 'verse-loop.state.json')).fails, 1, 'a dropped patch counts against the streak');

  s = sandbox(); fakeVerse(s, { confidences: [0.4, 0.85] });
  r = await lap(parseArgs([]), { cwd: s.work, env: verseEnv(s), log: quiet });
  assert.equal(r.outcome, 'shipped', r.why); assert.equal(r.label, 'automerge', 'the second try cleared the bar');
  assert.ok(r.steps.some((x) => /under 0\.8: trying again \(2 of 3\)/.test(x)));

  s = sandbox(); fakeVerse(s, { exit: 3 });
  r = await lap(parseArgs([]), { cwd: s.work, env: verseEnv(s), log: quiet });
  assert.equal(r.outcome, 'idle', 'no probe job; NEXT goes to the coder on Verse\'s own model, out of reach here, so nothing ships');
  assert.match(r.why, /Verse's coder: no model answered \(verse /);
  assert.equal(r.task.kind, 'next', 'exit 3 moves the lap on to docs/NEXT.md');

  s = sandbox(); fakeVerse(s, { file: 'tools/other.js' });
  r = await lap(parseArgs([]), { cwd: s.work, env: verseEnv(s), log: quiet });
  assert.equal(r.outcome, 'refused'); assert.match(r.why, /tools\/other\.js/);

  s = sandbox(); fakeVerse(s);
  r = await lap(parseArgs(['--dry-run']), { cwd: s.work, env: { ...verseEnv(s), VOID_OWNER_TOKEN: '' }, log: quiet });
  assert.equal(r.outcome, 'idle'); assert.equal(r.task.kind, 'next', 'no VOID_OWNER_TOKEN: no probe, straight to NEXT');
});

/** Verse's coder, scripted: the real tools/verse-coder.mjs runs in the sandbox with a fake model (VERSE_CODER_SCRIPT) */
function scripted(s, replies) {
  const f = join(s.dir, 'script.json'); writeFileSync(f, JSON.stringify(replies));
  return { ...env(s, ''), ...NO_KEYS, VOID_OWNER_TOKEN: '', VERSE_CODER_SCRIPT: f };
}
function redGamma(s) {
  writeFileSync(join(s.work, 'status.txt'), 'broken\n');
  const checks = JSON.parse(readFileSync(join(s.work, 'tools/verse-loop.checks.json'), 'utf8'));
  writeFileSync(join(s.work, 'tools/verse-loop.checks.json'), JSON.stringify([...checks, { name: 'gamma', cmd: 'grep -q fixed status.txt' }]));
  sh(s.work, 'add', '-A'); sh(s.work, 'commit', '-q', '-m', 'gamma'); sh(s.work, 'push', '-q', 'origin', 'main');
}
const FIX_GAMMA = '--- a/status.txt\n+++ b/status.txt\n@@ -1 +1 @@\n-broken\n+fixed\n';

test('Verse\'s coder: a red check is fixed and ships with automerge; a refused or capped run changes nothing', async () => {
  let s = sandbox(); redGamma(s);
  let r = await lap(parseArgs([]), { cwd: s.work, env: scripted(s, [{ tool: 'read', path: 'status.txt' }, { tool: 'edit', diff: FIX_GAMMA }, { tool: 'check', name: 'gamma' }, { tool: 'finish', summary: 'fixed' }]), log: quiet });
  assert.equal(r.outcome, 'shipped', r.why);
  assert.deepEqual(r.task, { kind: 'fix', check: 'gamma' }); assert.equal(r.label, 'automerge'); assert.equal(r.title, 'Verse loop: fix gamma');
  assert.equal(sh(s.work, 'show', r.branch + ':status.txt'), 'fixed');
  assert.match(sh(s.work, 'show', r.branch + ':docs/TAGTEAM.md'), /verse-loop \(verse\): fix gamma/);

  s = sandbox(); redGamma(s);
  r = await lap(parseArgs(['--dry-run']), { cwd: s.work, env: scripted(s, [{ tool: 'edit', diff: '--- a/tools/verse-loop.checks.json\n+++ b/tools/verse-loop.checks.json\n@@ -1 +1 @@\n-x\n+[]\n' }, { tool: 'finish' }]), log: quiet });
  assert.equal(r.outcome, 'no-change'); assert.match(r.why, /Verse's coder: finished with no change/);
  assert.equal(sh(s.work, 'status', '--porcelain'), '', 'the checks file is one of its guards, untouched');

  s = sandbox(); redGamma(s);
  r = await lap(parseArgs(['--dry-run']), { cwd: s.work, env: { ...scripted(s, [{ tool: 'edit', diff: FIX_GAMMA }, { tool: 'list' }]), VERSE_LOOP_AGENT_TIMEOUT_MIN: '2' }, log: quiet });
  assert.equal(r.outcome, 'no-change'); assert.match(r.why, /turn cap/);
  assert.equal(readFileSync(join(s.work, 'status.txt'), 'utf8'), 'broken\n', 'put back');
});

test('Verse\'s coder on green takes the top of docs/NEXT.md (no probe without VOID_OWNER_TOKEN)', async () => {
  const s = sandbox();
  const add = '--- /dev/null\n+++ b/calc-sitemap.txt\n@@ -0,0 +1 @@\n+calculator sitemap\n';
  const r = await lap(parseArgs(['--dry-run']), { cwd: s.work, env: scripted(s, [{ tool: 'edit', diff: add }, { tool: 'finish', summary: 'step one' }]), log: quiet });
  assert.equal(r.outcome, 'would-ship', r.why);
  assert.deepEqual(r.task, { kind: 'next', n: 1, text: '[NEXT 2] **Calculator sitemap** easiest small site' });
  assert.equal(readFileSync(join(s.work, 'calc-sitemap.txt'), 'utf8'), 'calculator sitemap\n');
});

// ---- no human in the loop: grooming, back-off that resumes by itself, self-heal ----
const PARITY = '# Parity\n\n## site A → /a/ (2026-10-28)\n\n**Still missing from A:** the weather tools.\n\n## site B → /b/\n\n**Gaps.** None on the home page.\n';

test('grooming: open items, assimilation gaps and red checks ranked easiest first, the hand list kept, the same input the same text', () => {
  assert.deepEqual(assimilationGaps(PARITY), [{ title: 'site A → /a/ (2026-10-28)', text: 'the weather tools.' }], '"None" is not a gap');
  const hand = '# NEXT\n\nIntro.\n\n1. **Big thing** ' + 'words '.repeat(120) + '\n2. **Blocked** blocked on a partner\n3. **Game Box** open PR #12 · next: rebase, green, merge\n4. **Gone** status: done\n5. **Small**\n';
  const g = groomNext(hand, { gaps: PARITY, red: ['beta'] });
  const q = g.slice(g.indexOf('<!-- verse-groom:'), g.indexOf('<!-- /verse-groom -->')).split('\n').filter((l) => /^\d+\. /.test(l)).map((l) => l.replace(/\] .*/, ']'));
  assert.deepEqual(q, ['1. [red check]', '2. [NEXT 3]', '3. [assimilation gap]', '4. [NEXT 5]', '5. [NEXT 1]', '6. [NEXT 2]']);
  assert.ok(g.includes(hand.slice(hand.indexOf('1. **Big'))), 'the hand-written items stay as they were');
  assert.ok(g.indexOf('<!-- /verse-groom -->') < g.indexOf('1. **Big'), 'the queue sits before the hand list');
  assert.equal(groomNext(g, { gaps: PARITY, red: ['beta'] }), g, 'grooming twice changes nothing');
  assert.equal(topItem(g).text.startsWith('[red check] Make the red check `beta` green'), true, 'the loop takes the top of the queue');
  const green = groomNext(g, { gaps: PARITY });
  assert.match(topItem(green).text, /^\[NEXT 3\] \*\*Game Box\*\*/, 'on green the easiest item leads');
  assert.equal(groomNext(green, { gaps: PARITY }), green);
  assert.equal(ease({ src: 'next', text: 'far future: video' }), 9);
  assert.match(groomNext('# empty\n'), /<!-- verse-groom:.*\n\*\*Verse's queue/s, 'no items: an empty queue');
});

test('the back-off: three failures pause for 6 hours, a merged PR resets the streak, a closed one counts, and the pause ends by itself', () => {
  let st = { fails: 0, prs: [] };
  for (const o of ['rejected', 'idle', 'no-change']) st = recordOutcome(st, o, { why: o });
  assert.equal(st.fails, 2, 'idle is neutral');
  st = recordOutcome(st, 'shipped', { pr: 'u1' });
  assert.deepEqual([st.fails, st.prs], [2, ['u1']], 'a shipped PR waits to be merged');
  assert.equal(settlePrs(st, () => 'MERGED').fails, 0, 'merged resets');
  assert.equal(settlePrs(st, () => 'CLOSED').fails, 3, 'closed without merging counts');
  assert.deepEqual(settlePrs(st, () => 'OPEN').prs, ['u1']);
  const t0 = Date.parse('2026-10-28T10:00:00Z');
  assert.deepEqual(pauseState({ state: {}, now: t0 }), { paused: false, resume: false });
  assert.equal(pauseState({ state: { pausedAt: t0 }, now: t0 + 5.9 * 3600e3 }).paused, true);
  assert.equal(pauseState({ state: { pausedAt: t0 }, now: t0 + 6 * 3600e3 }).resume, true, 'resumes by itself at 6 hours');
  assert.equal(pauseState({ state: {}, issue: { createdAt: '2026-10-28T10:00:00Z' }, now: t0 + 3600e3 }).paused, true, 'a fresh runner reads the open issue');
  assert.equal(pauseState({ state: {}, issue: { createdAt: '2026-10-28T10:00:00Z' }, now: t0 + 7 * 3600e3 }).resume, true, 'and an open issue does not hold it past 6 hours');
  // the loop's own code changed after the streak's first failure: the failures were on code that no longer runs, so resume now
  const streak = { pausedAt: t0, last: [{ at: t0 - 3600e3 }, { at: t0 - 1800e3 }, { at: t0 }] };
  assert.deepEqual(pauseState({ state: streak, now: t0 + 600e3, changedAt: t0 - 2400e3 }), { paused: false, resume: true, until: t0 + 6 * 3600e3, early: true }, 'a fix between the failures counts');
  assert.equal(pauseState({ state: streak, now: t0 + 600e3, changedAt: t0 - 7200e3 }).paused, true, 'a change before the first failure does not');
  assert.equal(pauseState({ state: streak, now: t0 + 600e3 }).paused, true, 'no change: the 6 hours hold');
  assert.equal(pauseState({ state: {}, issue: { createdAt: '2026-10-28T10:00:00Z' }, now: t0 + 3600e3, changedAt: t0 + 60e3 }).resume, true, 'a fresh runner measures from the issue');
  assert.ok(LOOP_CODE.includes('tools/verse-coder.mjs') && LOOP_CODE.includes('tools/verse-loop.mjs'));
});

test('a lap: a commit to the loop\'s own code after the failures began ends the pause early and says why on the issue', async () => {
  const s = sandbox({ gh: { 'issue list': [{ number: 9, title: PAUSE_TITLE, createdAt: new Date().toISOString() }] } });
  const statePath = join(s.work, '.git', 'verse-loop.state.json');
  const t0 = Date.now();
  // the failures are in the future of every commit so far: the pause holds
  writeFileSync(statePath, JSON.stringify({ fails: 3, prs: [], pausedAt: t0, last: [{ outcome: 'error', why: 'token cap', at: t0 + 60e3 }] }));
  writeFileSync(join(s.work, 'tools/verse-coder.mjs'), '// v1\n'); sh(s.work, 'add', '-A'); sh(s.work, 'commit', '-q', '-m', 'coder v1'); sh(s.work, 'push', '-q', 'origin', 'main');
  let r = await lap(parseArgs(['--agent', 'cmd']), { cwd: s.work, env: env(s, 'echo ran > ran.txt'), log: quiet, now: t0 + 120e3 });
  assert.equal(r.outcome, 'paused'); assert.ok(!existsSync(join(s.work, 'ran.txt')));
  // the fix lands after the first failure: resume now, not in 6 hours
  writeFileSync(statePath, JSON.stringify({ fails: 3, prs: [], pausedAt: t0, last: [{ outcome: 'error', why: 'token cap', at: t0 - 120e3 }] }));
  writeFileSync(join(s.work, 'tools/verse-coder.mjs'), '// v2: the fix\n'); sh(s.work, 'add', '-A'); sh(s.work, 'commit', '-q', '-m', 'coder fix'); sh(s.work, 'push', '-q', 'origin', 'main');
  r = await lap(parseArgs(['--agent', 'cmd']), { cwd: s.work, env: env(s, 'echo built > built.txt'), log: quiet, now: t0 + 180e3 });
  assert.equal(r.outcome, 'shipped', r.why);
  assert.ok(r.steps.some((x) => /changed after the failures began; resuming early/.test(x)), r.steps.join(' | '));
  const close = ghCalls(s).find((c) => c.slice(0, 3).join(' ') === 'issue close 9');
  assert.ok(close, 'the loop closes its own issue'); assert.match(close[4], /Resumed early: the loop's own code changed on main after these failures began/);
  const st = loadState(statePath);
  assert.deepEqual([st.pausedAt, st.last.length], [null, 0]);
});

test('a lap: the third failure in a row pauses and opens the issue; laps skip while paused; after 6 hours it resumes and closes the issue itself', async () => {
  const s = sandbox();
  const statePath = join(s.work, '.git', 'verse-loop.state.json');
  writeFileSync(statePath, JSON.stringify({ fails: 2, prs: [], last: [{ outcome: 'rejected', why: 'x' }, { outcome: 'no-change', why: 'y' }] }));
  const t0 = Date.now();
  let r = await lap(parseArgs(['--agent', 'cmd']), { cwd: s.work, env: env(s, 'true'), log: quiet, now: t0 });
  assert.equal(r.outcome, 'no-change'); assert.ok(r.paused, 'paused on the third failure');
  const create = ghCalls(s).find((c) => c[0] === 'issue' && c[1] === 'create');
  assert.deepEqual(create.slice(0, 4), ['issue', 'create', '--title', PAUSE_TITLE]);
  assert.match(create[5], /resumes by itself and closes this issue; nobody needs to do anything/);
  assert.equal(loadState(statePath).pausedAt, t0, 'the pause flag');

  setGh(s, { 'issue list': [{ number: 8, title: PAUSE_TITLE, createdAt: new Date(t0).toISOString() }] });
  r = await lap(parseArgs(['--agent', 'cmd']), { cwd: s.work, env: env(s, 'echo ran > ran.txt'), log: quiet, now: t0 + 3600e3 });
  assert.equal(r.outcome, 'paused'); assert.ok(!existsSync(join(s.work, 'ran.txt')), 'no brain while paused');

  r = await lap(parseArgs(['--agent', 'cmd']), { cwd: s.work, env: env(s, 'echo built > built.txt'), log: quiet, now: t0 + 6 * 3600e3 + 1 });
  assert.equal(r.outcome, 'shipped', r.why);
  assert.ok(ghCalls(s).some((c) => c.slice(0, 3).join(' ') === 'issue close 8'), 'the loop closes its own issue');
  const st = loadState(statePath);
  assert.deepEqual([st.fails, st.pausedAt, st.prs], [0, null, ['https://github.com/example/repo/pull/7']]);

  // a fresh runner with no state: the open issue alone holds laps for 6 hours, not longer
  const f = sandbox({ gh: { 'issue list': [{ number: 9, title: PAUSE_TITLE, createdAt: new Date(t0 - 3600e3).toISOString() }] } });
  r = await lap(parseArgs(['--agent', 'cmd']), { cwd: f.work, env: env(f, 'true'), log: quiet, now: t0 });
  assert.equal(r.outcome, 'paused');
  r = await lap(parseArgs(['--dry-run', '--agent', 'cmd']), { cwd: f.work, env: env(f, 'echo b > b.txt'), log: quiet, now: t0 + 6 * 3600e3 });
  assert.equal(r.outcome, 'would-ship', 'resumed'); assert.ok(!ghCalls(f).some((c) => c[1] === 'close'), 'a dry run closes nothing');

  // a PR an earlier lap opened was closed without merging: the third failure
  const c = sandbox({ gh: { 'pr view': { state: 'CLOSED' } } });
  writeFileSync(join(c.work, '.git', 'verse-loop.state.json'), JSON.stringify({ fails: 2, prs: ['https://github.com/example/repo/pull/5'] }));
  r = await lap(parseArgs(['--agent', 'cmd']), { cwd: c.work, env: env(c, 'echo b > b.txt'), log: quiet, now: t0 });
  assert.equal(r.outcome, 'paused'); assert.match(r.why, /closed without merging/);
  assert.ok(!existsSync(join(c.work, 'b.txt')));
});

test('self-heal: an open loop/* PR with a failed check is fixed and pushed on its own branch, verify.yml is started, and nothing else happens that lap', async () => {
  const s = sandbox();
  sh(s.work, 'checkout', '-q', '-b', 'loop/20261028-100000');
  writeFileSync(join(s.work, 'status.txt'), 'broken\n');
  sh(s.work, 'add', '-A'); sh(s.work, 'commit', '-q', '-m', 'a loop PR'); sh(s.work, 'push', '-q', 'origin', 'loop/20261028-100000');
  const tip = sh(s.work, 'rev-parse', 'HEAD');
  sh(s.work, 'checkout', '-q', 'main');
  const pr = { number: 11, url: 'https://github.com/example/repo/pull/11', title: 'Verse loop: NEXT 1', headRefName: 'loop/20261028-100000', statusCheckRollup: [{ name: 'suite', conclusion: 'FAILURE' }, { name: 'lint', conclusion: 'SUCCESS' }] };
  setGh(s, { 'pr list': [{ number: 3, headRefName: 'feature/x', statusCheckRollup: [{ name: 'a', conclusion: 'FAILURE' }] }, pr], 'run list': [{ databaseId: 77, workflowName: 'Verse verify' }], 'run view': 'suite: status.txt says broken' });
  const brainCmd = 'grep -q "loop/20261028-100000" "$VERSE_LOOP_PROMPT_FILE" && grep -q "status.txt says broken" "$VERSE_LOOP_PROMPT_FILE" && echo fixed > status.txt';
  const r = await lap(parseArgs(['--agent', 'cmd']), { cwd: s.work, env: env(s, brainCmd), log: quiet });
  assert.equal(r.outcome, 'healed', r.why);
  assert.deepEqual(r.task, { kind: 'heal', branch: 'loop/20261028-100000', pr: pr.url, failed: 'suite' });
  assert.equal(sh(s.origin, 'show', 'loop/20261028-100000:status.txt'), 'fixed');
  assert.equal(sh(s.origin, 'rev-parse', 'loop/20261028-100000~1'), tip, 'a fast-forward on the same branch');
  assert.deepEqual(sh(s.origin, 'branch', '--list', 'loop/*').split('\n').map((b) => b.replace(/^[*\s]+/, '')), ['loop/20261028-100000'], 'no new branch');
  assert.ok(!existsSync(join(s.dir, 'gh-args.txt')), 'no new PR that lap');
  const calls = ghCalls(s).map((c) => c.join(' '));
  assert.ok(calls.includes('run view 77 --log-failed'), 'the failure log was read');
  assert.ok(calls.includes('workflow run verify.yml --ref loop/20261028-100000'));
  assert.equal(loadState(join(s.work, '.git', 'verse-loop.state.json')).heals['loop/20261028-100000'], 1);
  assert.equal(sh(s.work, 'status', '--porcelain'), '', 'clean for the next lap');
  // a branch that used up its heal tries is left to the back-off; the lap goes on as usual
  assert.equal(failedLoopPr([pr], { 'loop/20261028-100000': 3 }), null);
  assert.equal(failedLoopPr([{ ...pr, statusCheckRollup: [{ context: 'ci', state: 'ERROR' }] }]).failed[0], 'ci');
});

test('a groom lap: when Verse\'s queue changed it ships docs/NEXT.md alone, no brain; with a groom PR open the lap takes the groomed top instead', async () => {
  const s = sandbox({ groomed: false });
  writeFileSync(join(s.work, 'docs/PARITY.md'), PARITY);
  sh(s.work, 'add', '-A'); sh(s.work, 'commit', '-q', '-m', 'gaps'); sh(s.work, 'push', '-q', 'origin', 'main');
  let r = await lap(parseArgs(['--agent', 'cmd']), { cwd: s.work, env: env(s, 'echo ran > ran.txt'), log: quiet });
  assert.equal(r.outcome, 'shipped', r.why); assert.equal(r.title, GROOM_TITLE); assert.deepEqual(r.task, { kind: 'groom' });
  assert.ok(!existsSync(join(s.work, 'ran.txt')), 'grooming is the whole lap');
  assert.deepEqual(sh(s.work, 'show', '--name-only', '--format=', r.branch).split('\n').sort(), ['docs/NEXT.md', 'docs/TAGTEAM.md']);
  const groomed = sh(s.work, 'show', r.branch + ':docs/NEXT.md');
  assert.match(groomed, /1\. \[assimilation gap\] site A/); assert.match(groomed, /2\. \[NEXT 2\] \*\*Calculator sitemap\*\*/);

  const t = sandbox({ groomed: false, gh: { 'pr list': [{ number: 4, title: GROOM_TITLE, headRefName: 'loop/x', statusCheckRollup: [] }] } });
  writeFileSync(join(t.work, 'docs/PARITY.md'), PARITY);
  sh(t.work, 'add', '-A'); sh(t.work, 'commit', '-q', '-m', 'gaps'); sh(t.work, 'push', '-q', 'origin', 'main');
  r = await lap(parseArgs(['--dry-run', '--agent', 'cmd']), { cwd: t.work, env: env(t, 'echo b > b.txt'), log: quiet });
  assert.equal(r.outcome, 'would-ship'); assert.match(r.task.text, /^\[assimilation gap\] site A/, 'the groomed top, from memory');
  assert.equal(readFileSync(join(t.work, 'docs/NEXT.md'), 'utf8'), HAND_NEXT, 'no second groom while one is open');
});
