// tools/verse-loop.mjs: the pure parts, and whole laps in a throwaway repo with a fake brain, fake checks and a fake gh.
// Positive and negative controls (docs/GATE-STANDARDS.md): a lap that should ship ships, and each way a lap must stop does stop.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { parseArgs, topItem, scanDiff, pickTask, verdict, takeLock, agentCommand, buildPrompt, lap } from './verse-loop.mjs';

const quiet = () => {};
const sh = (cwd, ...a) => { const r = spawnSync('git', a, { cwd, encoding: 'utf8' }); if (r.status) throw new Error(a.join(' ') + ': ' + r.stderr); return r.stdout.trim(); };

/** A repo with a bare origin, docs, a checks file whose checks read flag files, a fake brain and a fake gh. */
function sandbox({ red = [] } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'vl-test-'));
  const origin = join(dir, 'origin.git'), work = join(dir, 'work');
  sh(dir, 'init', '-q', '--bare', '-b', 'main', origin);
  sh(dir, 'clone', '-q', origin, work);
  sh(work, 'config', 'user.email', 'loop@example.invalid'); sh(work, 'config', 'user.name', 'loop test');
  mkdirSync(join(work, 'docs')); mkdirSync(join(work, 'tools'));
  writeFileSync(join(work, 'docs/NEXT.md'), '# NEXT\n\n1. **Done thing** status: done\n2. **Calculator sitemap** easiest small site\n3. **Later**\n');
  writeFileSync(join(work, 'docs/TAGTEAM.md'), '# TAGTEAM\n');
  writeFileSync(join(work, 'docs/GATE-STANDARDS.md'), '# Gate\nblocked is INCOMPLETE\n');
  writeFileSync(join(work, '.gitignore'), 'red-*\n');
  for (const r of red) writeFileSync(join(work, 'red-' + r), '');
  // each check is red while its flag file exists, or while broke.txt exists (a change that breaks it)
  const check = (n) => ({ name: n, cmd: `test ! -e red-${n} && test ! -e broke-${n}.txt` });
  writeFileSync(join(work, 'tools/verse-loop.checks.json'), JSON.stringify([check('alpha'), check('beta')]));
  sh(work, 'add', '-A'); sh(work, 'commit', '-q', '-m', 'start'); sh(work, 'push', '-q', 'origin', 'main');
  const gh = join(dir, 'gh.sh');
  writeFileSync(gh, `#!/bin/sh\necho "$@" > "${join(dir, 'gh-args.txt')}"\necho https://github.com/example/repo/pull/7\n`, { mode: 0o755 });
  return { dir, origin, work, gh };
}
const NO_KEYS = { CLOUDFLARE_API_TOKEN: '', OPENROUTER_API_KEY: '', GROQ_API_KEY: '', GEMINI_API_KEY: '', CEREBRAS_API_KEY: '', VERSE_CODER_SCRIPT: '' };
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
  const r = await lap(parseArgs(['--once', '--dry-run', '--agent', 'cmd']), { cwd: s.work, env: env(s, 'grep -q "item 2" "$VERSE_LOOP_PROMPT_FILE" && echo built > built.txt'), log: quiet });
  assert.equal(r.outcome, 'would-ship', r.why);
  assert.deepEqual(r.task, { kind: 'next', n: 2, text: '**Calculator sitemap** easiest small site' });
  assert.match(r.branch, /^loop\/\d{8}-\d{6}$/);
  assert.match(r.tagteamLine, /verse-loop \(cmd\): NEXT 2/);
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
  assert.equal(r.outcome, 'idle'); assert.match(r.why, /coder needs one model key in the environment: CLOUDFLARE_API_TOKEN/);
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
  assert.ok(!existsSync(join(s.work, '.git', 'verse-loop.lock')), 'lock released');
  assert.equal(sh(s.work, 'status', '--porcelain'), '', 'clean for the next lap');
});

test('the script never force-pushes and holds no key', () => {
  const src = readFileSync(new URL('./verse-loop.mjs', import.meta.url), 'utf8');
  assert.ok(!/--force|push', '-f'|\+refs/.test(src.replace(/never --force|never forced/g, '')), 'no force push');
  assert.deepEqual(scanDiff('+++ b/tools/verse-loop.mjs\n' + src.split('\n').map((l) => '+' + l).join('\n')).filter((f) => f.kind !== 'assigned secret'), []);
});

/** The free brain, faked: a tools/propose-fix.mjs in the sandbox that writes a result and a patch to --out, or exits 3. */
function fakeVerse(s, { exit = 0, file = 'void-live-deploy/skills/calc.js', confidence = 0.9 } = {}) {
  mkdirSync(join(s.work, 'void-live-deploy/skills'), { recursive: true });
  writeFileSync(join(s.work, 'void-live-deploy/skills/calc.js'), 'export const match = /calc/;\n');
  writeFileSync(join(s.work, 'tools/propose-fix.mjs'), `import { writeFileSync, mkdirSync } from 'node:fs';
const out = process.argv[process.argv.indexOf('--out') + 1];
if (${exit}) process.exit(${exit});
mkdirSync(out, { recursive: true });
writeFileSync(out + '/propose-fix.json', JSON.stringify({ passed: true, skill: 'calc', ask: 'add two and two', title: 'Verse fixes calc', confidence: ${confidence} }));
writeFileSync(out + '/propose-fix.patch', 'diff --git a/${file} b/${file}\\n--- a/${file}\\n+++ b/${file}\\n@@ -1 +1 @@\\n-export const match = /calc/;\\n+export const match = /calc|add/;\\n');
`);
  if (file !== 'void-live-deploy/skills/calc.js') { mkdirSync(join(s.work, file, '..'), { recursive: true }); writeFileSync(join(s.work, file), 'export const match = /calc/;\n'); }
  sh(s.work, 'add', '-A'); sh(s.work, 'commit', '-q', '-m', 'brain'); sh(s.work, 'push', '-q', 'origin', 'main');
}
const verseEnv = (s) => ({ ...env(s, ''), ...NO_KEYS, VOID_OWNER_TOKEN: 'test-token-not-real' });

test('the free brain: its passing patch ships labelled by its confidence; exit 3 moves on to NEXT; a patch outside the skill is refused', async () => {
  let s = sandbox(); fakeVerse(s);
  let r = await lap(parseArgs([]), { cwd: s.work, env: verseEnv(s), log: quiet });
  assert.equal(r.outcome, 'shipped', r.why); assert.equal(r.label, 'automerge'); assert.equal(r.title, 'Verse fixes calc');
  assert.match(sh(s.work, 'show', r.branch + ':void-live-deploy/skills/calc.js'), /calc\|add/);

  s = sandbox(); fakeVerse(s, { confidence: 0.5 });
  r = await lap(parseArgs([]), { cwd: s.work, env: verseEnv(s), log: quiet });
  assert.equal(r.outcome, 'shipped'); assert.equal(r.label, 'waits for owner');

  s = sandbox(); fakeVerse(s, { exit: 3 });
  r = await lap(parseArgs([]), { cwd: s.work, env: verseEnv(s), log: quiet });
  assert.equal(r.outcome, 'idle', 'no probe job, and no model key for NEXT'); assert.match(r.why, /coder needs one model key/);
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
  assert.deepEqual(r.task, { kind: 'next', n: 2, text: '**Calculator sitemap** easiest small site' });
  assert.equal(readFileSync(join(s.work, 'calc-sitemap.txt'), 'utf8'), 'calculator sitemap\n');
});
