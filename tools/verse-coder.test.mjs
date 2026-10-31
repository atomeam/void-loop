// tools/verse-coder.mjs: Verse's own coding agent, driven by a fake model that scripts its tool calls, in a throwaway repo.
// Positive and negative controls (docs/GATE-STANDARDS.md): it fixes a seeded red check; it refuses to weaken a test, to write
// outside the repo or into .env and workflows; it stops at the turn and token caps and puts the tree back; Verse's review sends
// a risky diff back; the model stack falls through to the next free provider; no key is ever in a command or in the source.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { runCoder, parseAction, pathRefusal, diffFiles, weakening, checkScripts, providersFrom, stackModel, scriptedModel, keyless, windowOf, trailOf, WINDOW, budgetNote, BUDGET } from './verse-coder.mjs';
import { scanDiff } from './verse-loop.mjs';

const NOCTX = (() => { const e = { ...process.env }; delete e.NODE_TEST_CONTEXT; return e; })(); // a node --test inside a test reports to the outer runner unless this goes
const sh = (cwd, ...a) => { const r = spawnSync('git', a, { cwd, encoding: 'utf8' }); if (r.status) throw new Error(a.join(' ') + ': ' + r.stderr); return r.stdout.trim(); };
const ADD_TEST = "import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { add } from '../src/add.mjs';\n\ntest('add', () => {\n  assert.equal(add(2, 2), 4);\n  assert.equal(add(1, 0), 1);\n});\n";
/** a repo whose check "add" is red: src/add.mjs subtracts */
function repo() {
  const dir = mkdtempSync(join(tmpdir(), 'vc-test-')), work = join(dir, 'work');
  mkdirSync(join(work, 'src'), { recursive: true }); mkdirSync(join(work, 'tools')); mkdirSync(join(work, '.github/workflows'), { recursive: true });
  sh(work, 'init', '-q', '-b', 'main'); sh(work, 'config', 'user.email', 'coder@example.invalid'); sh(work, 'config', 'user.name', 'coder test');
  writeFileSync(join(work, 'src/add.mjs'), '// adds two numbers\nexport function add(a, b) {\n  return a - b;\n}\n');
  writeFileSync(join(work, 'tools/add.test.mjs'), ADD_TEST);
  writeFileSync(join(work, '.github/workflows/ci.yml'), 'on: push\n');
  writeFileSync(join(work, 'README.md'), '# r\n');
  sh(work, 'add', '-A'); sh(work, 'commit', '-q', '-m', 'start');
  return { dir, work };
}
const CHECKS = [{ name: 'add', cmd: 'node --test tools/add.test.mjs' }];
const FIX = '--- a/src/add.mjs\n+++ b/src/add.mjs\n@@ -1,4 +1,4 @@\n // adds two numbers\n export function add(a, b) {\n-  return a - b;\n+  return a + b;\n }\n';
const call = (tool, args = {}) => JSON.stringify({ tool, ...args });
const run = (s, replies, extra = {}) => runCoder({ root: s.work, prompt: 'Make the check add green.', checks: CHECKS, target: 'add', model: scriptedModel(replies), env: { PATH: process.env.PATH }, ...extra });

test('it fixes a seeded red check: search, read, edit, check, finish, and Verse\'s review passes the diff', async () => {
  const s = repo();
  assert.notEqual(spawnSync(process.execPath, ['--test', 'tools/add.test.mjs'], { cwd: s.work, env: NOCTX }).status, 0, 'red to start');
  const r = await run(s, [call('search', { pattern: 'a - b' }), call('read', { path: 'src/add.mjs' }), 'Here is the fix.\n' + call('edit') + '\n```diff\n' + FIX + '```', call('check', { name: 'add' }), call('finish', { summary: 'add adds' })]);
  assert.equal(r.outcome, 'done', r.why + JSON.stringify(r.log));
  assert.deepEqual(r.files, ['src/add.mjs']);
  assert.match(readFileSync(join(s.work, 'src/add.mjs'), 'utf8'), /a \+ b/);
  assert.match(r.log[0].result, /src\/add\.mjs:3/); assert.match(r.log[3].result, /^PASS add/);
  assert.equal(spawnSync(process.execPath, ['--test', 'tools/add.test.mjs'], { cwd: s.work, env: NOCTX }).status, 0, 'green after');
  assert.equal(sh(s.work, 'log', '--oneline').split('\n').length, 1, 'no commit: the loop commits');
});

test('it refuses to weaken a test: fewer assertions, a skip, a deleted test; the test stays as it was', async () => {
  const s = repo();
  const drop = '--- a/tools/add.test.mjs\n+++ b/tools/add.test.mjs\n@@ -5,4 +5,3 @@\n test(\'add\', () => {\n-  assert.equal(add(2, 2), 4);\n   assert.equal(add(1, 0), 1);\n });\n';
  const skip = '--- a/tools/add.test.mjs\n+++ b/tools/add.test.mjs\n@@ -4,3 +4,3 @@\n \n-test(\'add\', () => {\n+test.skip(\'add\', () => {\n   assert.equal(add(2, 2), 4);\n';
  const del = '--- a/tools/add.test.mjs\n+++ /dev/null\n@@ -1,8 +0,0 @@\n' + ADD_TEST.trimEnd().split('\n').map((l) => '-' + l).join('\n') + '\n';
  const r = await run(s, [call('edit', { diff: drop }), call('edit', { diff: skip }), call('edit', { diff: del }), call('finish')]);
  assert.match(r.log[0].result, /refused: this edit weakens tools\/add\.test\.mjs \(fewer assertions/);
  assert.match(r.log[1].result, /refused: .*adds a skip/);
  assert.match(r.log[2].result, /refused: tools\/add\.test\.mjs is a test or a check: never deleted/);
  assert.equal(r.outcome, 'nothing');
  assert.equal(readFileSync(join(s.work, 'tools/add.test.mjs'), 'utf8'), ADD_TEST, 'untouched');
  assert.deepEqual(weakening(ADD_TEST, ADD_TEST.replace('assert.equal(add(1, 0), 1);', 'assert.ok(true);')), ['adds an assertion that cannot fail']);
  assert.deepEqual(weakening(ADD_TEST, ADD_TEST.replace("test('add', () => {", "test('add', () => {\n  process.exit(0);")), ['adds an early clean exit']);
  assert.deepEqual(weakening(ADD_TEST, ADD_TEST.replace('add(1, 0), 1);', 'add(1, 0), 1);\n  assert.equal(add(0, 0), 0);')), [], 'a stronger test is fine');
  assert.deepEqual(weakening(ADD_TEST, null), ['deletes the test']);
  assert.ok(checkScripts([{ cmd: 'node tools/guard-source.mjs && python3 ./ci/x.py' }]).has('ci/x.py'), 'a check\'s own script is guarded like a test');
});

test('it refuses a path outside the repo, .env, workflows, secrets and its own guards; nothing is written there', async () => {
  const s = repo();
  const out = '--- /dev/null\n+++ b/../outside.txt\n@@ -0,0 +1 @@\n+escaped\n';
  const env = '--- /dev/null\n+++ b/.env\n@@ -0,0 +1 @@\n+A=1\n';
  const wf = '--- a/.github/workflows/ci.yml\n+++ b/.github/workflows/ci.yml\n@@ -1 +1 @@\n-on: push\n+on: [push, pull_request]\n';
  const r = await run(s, [call('edit', { diff: out }), call('read', { path: '/etc/passwd' }), call('read', { path: '../../etc/hostname' }), call('edit', { diff: env }), call('edit', { diff: wf }), call('list', { path: '..' }), call('finish')]);
  assert.match(r.log[0].result, /refused: \.\.\/outside\.txt is outside the repo/);
  assert.match(r.log[1].result, /refused: .*not a path inside the repo/);
  assert.match(r.log[2].result, /refused: .*outside the repo/);
  assert.match(r.log[3].result, /refused: \.env holds secrets/);
  assert.match(r.log[4].result, /refused: \.github\/workflows\/ci\.yml is a workflow/);
  assert.match(r.log[5].result, /refused/);
  assert.equal(r.outcome, 'nothing');
  assert.ok(!existsSync(join(s.dir, 'outside.txt')) && !existsSync(join(s.work, '.env')));
  assert.equal(readFileSync(join(s.work, '.github/workflows/ci.yml'), 'utf8'), 'on: push\n');
  for (const p of ['config/secrets.json', 'deploy/key.pem', '.dev.vars', '.git/config', 'node_modules/x/index.js']) assert.ok(pathRefusal(p, s.work, { write: true }), p);
  for (const p of ['tools/verse-coder.mjs', 'tools/verse-loop.checks.json', 'void-live-deploy/lib/patch-guard.js']) assert.match(pathRefusal(p, s.work, { write: true }), /own guards/);
  assert.equal(pathRefusal('.env.example', s.work, { write: true }), '');
  assert.equal(pathRefusal('src/add.mjs', s.work, { write: true }), '');
  assert.match(diffFiles('rename from a\nrename to b\n').refusal, /renames/);
});

test('it stops at the turn cap and at the token cap, and puts back what it changed', async () => {
  const s = repo();
  let r = await run(s, [call('edit', { diff: FIX }), call('list', { path: 'src' })], { limits: { turns: 4 } });
  assert.equal(r.outcome, 'turn-cap'); assert.equal(r.turns, 4); assert.match(r.why, /turn cap \(4\)/);
  assert.match(readFileSync(join(s.work, 'src/add.mjs'), 'utf8'), /a - b/, 'the edit is put back');
  assert.equal(sh(s.work, 'status', '--porcelain'), '');
  const big = async () => ({ text: call('list'), tokens: 600 });
  r = await runCoder({ root: s.work, prompt: 'x', checks: CHECKS, model: big, limits: { tokens: 1000 } });
  assert.equal(r.outcome, 'token-cap'); assert.equal(r.turns, 2);
  assert.match(r.why, /token cap \(1000\) after 2 turns: list, list$/, 'a stop at a cap says where the turns went');
});

test('each turn sends the task and the newest results whole, and older results cut short, so the token cap lasts the turns', async () => {
  const msgs = [{ role: 'system', content: 'sys' }, { role: 'user', content: 'T'.repeat(5000) }];
  for (let i = 0; i < 40; i++) msgs.push({ role: 'assistant', content: '{"tool":"read","path":"f' + i + '"}' }, { role: 'user', content: String(i).padEnd(16000, 'x') });
  const w = windowOf(msgs);
  assert.equal(w.length, 2 + WINDOW.messages); assert.deepEqual(w.slice(0, 2), msgs.slice(0, 2), 'the system and the task stay whole');
  assert.deepEqual(w.slice(-WINDOW.fresh), msgs.slice(-WINDOW.fresh), 'the newest results stay whole');
  const old = w.slice(2, -WINDOW.fresh).filter((x) => x.role === 'user');
  assert.ok(old.length && old.every((x) => x.content.length < WINDOW.keep + 120 && /characters cut from an older result; read it again/.test(x.content)));
  assert.ok(w.slice(2).filter((x) => x.role === 'assistant').every((x, i) => x.content === msgs.slice(-WINDOW.messages).filter((y) => y.role === 'assistant')[i].content), 'the model\'s own turns stay whole');
  const size = (m) => m.reduce((n, x) => n + x.content.length, 0);
  assert.ok(size(w) < size([...msgs.slice(0, 2), ...msgs.slice(-WINDOW.messages)]) / 3, 'the window is a third of the old one or less');
  assert.deepEqual(windowOf(msgs.slice(0, 6)), msgs.slice(0, 6), 'a short run is sent as it is');
  assert.equal(trailOf([{ tool: 'read', path: 'a.js', result: '1\tx' }, { tool: 'edit', path: '', result: 'the diff does not apply: error: patch failed\nmore' }, { tool: 'check', path: 'add', result: 'FAIL add\nlog' }]),
    'read a.js, edit: the diff does not apply: error: patch failed, check add: FAIL add');
  // the worst case, a full read every turn: the old window ran out of tokens near turn 12; this one lasts 20 turns or more
  const s = repo(); writeFileSync(join(s.work, 'src/big.mjs'), Array.from({ length: 400 }, (_, i) => '// line ' + i + ' ' + 'y'.repeat(30)).join('\n'));
  const r = await runCoder({ root: s.work, prompt: 'x', checks: CHECKS, model: async () => ({ text: call('read', { path: 'src/big.mjs' }) }), limits: { turns: 30, tokens: 250000 } });
  assert.ok(r.turns >= 20, 'turns before the token cap: ' + r.turns + ' (' + r.tokens + ' tokens)');
});

test('past 40% of the budget each result says how much is gone and, with no edit yet, that the next answer is an edit; at a cap a change checked green is kept', async () => {
  const L = { turns: 30, tokens: 250000 };
  assert.equal(budgetNote({ turns: 11, tokens: 90000, limits: L }), '', 'under 40% of turns and of tokens: nothing');
  assert.match(budgetNote({ turns: 12, tokens: 10000, limits: L }), /^\n\[turn 12 of 30, 4% of the token budget used, and no edit yet\. You have read enough: answer with an edit next/);
  assert.match(budgetNote({ turns: 3, tokens: 100000, limits: L }), /40% of the token budget used, and no edit yet/, 'the tokens count too');
  assert.equal(budgetNote({ turns: 12, tokens: 10000, limits: L, edited: true }), '\n[turn 12 of 30, 4% of the token budget used.]');
  assert.match(budgetNote({ turns: 25, tokens: 240000, limits: L }), /96% of the token budget used\. Nothing is changed yet, and a run with no edit ships nothing: answer with an edit now\.\]$/);
  assert.match(budgetNote({ turns: 24, tokens: 0, limits: L, edited: true }), /Run the check now, then finish/);
  assert.equal(budgetNote({ turns: 0, tokens: 0, limits: L }), ''); assert.deepEqual(BUDGET, { warn: 0.4, last: 0.8 });
  // the model sees it: a run that only reads is told from turn 4 of 10 to edit, and from turn 8 that it ships nothing without one
  const s = repo(); const seen = [];
  let r = await runCoder({ root: s.work, prompt: 'x', checks: CHECKS, limits: { turns: 10 }, model: async (m) => { seen.push(m[m.length - 1].content); return { text: call('read', { path: 'src/add.mjs' }) }; } });
  assert.equal(r.outcome, 'turn-cap');
  assert.ok(!/no edit yet/.test(seen[3]) && /turn 4 of 10, \d+% of the token budget used, and no edit yet/.test(seen[4]), seen[4]);
  assert.match(seen[8], /turn 8 of 10.*answer with an edit now/);
  // at a cap: edited, then checked green, then out of turns: the change goes through finish and is kept
  r = await run(s, [call('edit', { diff: FIX }), call('check', { name: 'add' }), call('list', { path: 'src' })], { limits: { turns: 4 } });
  assert.equal(r.outcome, 'done', r.why); assert.match(r.why, /turn cap \(4\), with the change checked green after its last edit: kept as it stood/);
  assert.deepEqual(r.files, ['src/add.mjs']); assert.match(readFileSync(join(s.work, 'src/add.mjs'), 'utf8'), /a \+ b/);
  sh(s.work, 'checkout', '--', '.');
  // a check before the last edit does not count: the change is put back
  const BREAK = FIX.replace('+  return a + b;', '+  return a + b + 1;').replace('-  return a - b;', '-  return a + b;');
  r = await run(s, [call('edit', { diff: FIX }), call('check', { name: 'add' }), call('edit', { diff: BREAK }), call('list', { path: 'src' })], { limits: { turns: 5 } });
  assert.equal(r.outcome, 'turn-cap', r.why); assert.match(readFileSync(join(s.work, 'src/add.mjs'), 'utf8'), /a - b/, 'put back');
  assert.equal(sh(s.work, 'status', '--porcelain'), '');
});

test('Verse\'s review on its own diff sends a risky change back; a created file goes away when it gives up', async () => {
  const s = repo();
  const risky = '--- /dev/null\n+++ b/src/run.mjs\n@@ -0,0 +1,2 @@\n+// runs what it is given\n+export const run = (input) => eval(input);\n';
  const r = await run(s, [call('edit', { diff: FIX }), call('edit', { diff: risky }), call('finish')], { limits: { finishTries: 2 } });
  assert.match(r.log[2].result, /review blocks this diff:\nsrc\/run\.mjs:2 risk eval/);
  assert.equal(r.outcome, 'nothing'); assert.match(r.why, /gave up/);
  assert.ok(!existsSync(join(s.work, 'src/run.mjs')), 'the new file is removed');
  assert.match(readFileSync(join(s.work, 'src/add.mjs'), 'utf8'), /a - b/);
});

test('finish waits for the target check, and a diff that does not apply comes back to the model', async () => {
  const s = repo();
  const wrong = FIX.replace('return a - b', 'return b - a');
  const readme = '--- a/README.md\n+++ b/README.md\n@@ -1 +1 @@\n-# r\n+# repo\n';
  const r = await run(s, [call('edit', { diff: wrong }), 'not json at all', call('edit', { diff: readme }), call('finish'), call('edit', { diff: FIX }), call('finish')]);
  assert.match(r.log[0].result, /does not apply/);
  assert.match(r.log[1].result, /no JSON object/);
  assert.match(r.log[3].result, /the target check add is still red/);
  assert.equal(r.outcome, 'done', r.why); assert.deepEqual(r.files.sort(), ['README.md', 'src/add.mjs']);
});

test('replace swaps exact text with no diff to line up: once, not twice, not missing; a new file; the same guards as edit', async () => {
  const s = repo();
  const r = await run(s, [
    call('edit', { diff: FIX.replace('return a - b', 'return b - a') }),
    call('replace', { path: 'src/add.mjs', old: 'return a-b;', new: 'return a + b;' }),
    call('replace', { path: 'src/add.mjs', old: 'a', new: 'x' }),
    call('replace', { path: 'tools/add.test.mjs', old: '  assert.equal(add(2, 2), 4);\n', new: '' }),
    call('replace', { path: '.github/workflows/ci.yml', old: 'on: push', new: 'on: [push]' }),
    call('replace', { path: 'src/none.mjs', old: 'x', new: 'y' }),
    call('replace', { path: 'src/add.mjs', old: 'return a - b;', new: 'return a + b;' }),
    call('replace', { path: 'src/sub.mjs', old: '', new: 'export const sub = (a, b) => a - b;\n' }),
    call('check', { name: 'add' }), call('finish', { summary: 'add adds' })]);
  assert.match(r.log[0].result, /does not apply: .*use replace/s, 'a failed diff points at replace');
  assert.match(r.log[1].result, /^no match: "old" is not in src\/add\.mjs/);
  assert.match(r.log[2].result, /is in src\/add\.mjs \d+ times/);
  assert.match(r.log[3].result, /refused: this edit weakens tools\/add\.test\.mjs \(fewer assertions/);
  assert.match(r.log[4].result, /refused: \.github\/workflows\/ci\.yml is a workflow/);
  assert.match(r.log[5].result, /no such file: src\/none\.mjs/);
  assert.equal(r.log[6].result, 'applied to src/add.mjs');
  assert.equal(r.log[7].result, 'applied to src/sub.mjs');
  assert.equal(r.outcome, 'done', r.why + JSON.stringify(r.log));
  assert.deepEqual(r.files.sort(), ['src/add.mjs', 'src/sub.mjs']);
  assert.equal(readFileSync(join(s.work, 'tools/add.test.mjs'), 'utf8'), ADD_TEST, 'the test is as it was');
  assert.equal(readFileSync(join(s.work, '.github/workflows/ci.yml'), 'utf8'), 'on: push\n');
  assert.equal(trailOf([{ tool: 'replace', path: 'a.js', result: 'no match: "old" is not in a.js as written' }]), 'replace a.js: no match: "old" is not in a.js as written');
  // a replace at a cap is put back like an edit, a new file included
  const t = repo();
  const c = await run(t, [call('replace', { path: 'src/add.mjs', old: 'a - b', new: 'a + b' }), call('replace', { path: 'src/new.mjs', old: '', new: 'x\n' }), call('list')], { limits: { turns: 3 } });
  assert.equal(c.outcome, 'turn-cap');
  assert.match(readFileSync(join(t.work, 'src/add.mjs'), 'utf8'), /a - b/); assert.ok(!existsSync(join(t.work, 'src/new.mjs')));
});

test('the reply parser: plain JSON, args nested, a fenced diff, junk', () => {
  assert.deepEqual(parseAction('{"tool":"read","path":"a"}'), { tool: 'read', path: 'a' });
  assert.equal(parseAction('Sure: {"tool":"read","args":{"path":"b {x}"}}').path, 'b {x}');
  assert.equal(parseAction('{"tool":"edit"}\n```diff\n--- a/x\n+++ b/x\n```').diff, '--- a/x\n+++ b/x\n');
  assert.match(parseAction('nope').error, /no JSON/);
  assert.match(parseAction('{"path":"a"}').error, /no "tool"/);
  assert.deepEqual(diffFiles(FIX).files, [{ path: 'src/add.mjs', from: 'src/add.mjs', to: 'src/add.mjs', created: false, deleted: false }]);
  assert.equal(diffFiles('--- x.js\n+++ x.js\n').p1, false);
});

test('the free stack: Workers AI first, then the others in order; a 429 falls through; no key, no provider', async () => {
  const env = { CLOUDFLARE_API_TOKEN: 'cf'.repeat(10), CLOUDFLARE_ACCOUNT_ID: 'acct', OPENROUTER_API_KEY: 'or'.repeat(10), GROQ_API_KEY: 'gq'.repeat(10), GEMINI_API_KEY: 'ge'.repeat(10), CEREBRAS_API_KEY: 'cb'.repeat(10) };
  const ps = providersFrom(env);
  assert.deepEqual(ps.map((p) => p.name), ['workers-ai', 'openrouter', 'groq', 'gemini', 'cerebras']);
  assert.ok(ps.every((p) => !/gpt-oss/.test(p.model)), 'no gpt-oss');
  assert.deepEqual(providersFrom({ CLOUDFLARE_API_TOKEN: 'x' }), [], 'Workers AI needs the account id too');
  assert.deepEqual(providersFrom({}), []);
  assert.deepEqual(providersFrom({ ...env, GH_MODELS_TOKEN: 'gh'.repeat(10) }).map((p) => p.name), ['workers-ai', 'openrouter', 'groq', 'gemini', 'cerebras'], 'GitHub Models is retired: its token adds no provider');
  // Verse's own model leads when the owner token is there; a 2xx that is not JSON is named by status and type, never by its body
  const own = providersFrom({ ...env, GH_MODELS_TOKEN: 'gh'.repeat(10), VOID_OWNER_TOKEN: 'o'.repeat(30), VOID_SITE: 'https://example.invalid/' });
  assert.deepEqual(own.map((p) => p.name), ['verse', 'workers-ai', 'openrouter', 'groq', 'gemini', 'cerebras']);
  assert.equal(own[0].url, 'https://example.invalid/api/coder'); assert.equal(own[0].shape, 'workers');
  const sent = [];
  const odd = stackModel(own.slice(0, 3), { fetchImpl: async (url, init) => { sent.push([url, init.headers]);
    if (url.includes('example.invalid')) return { ok: true, status: 200, json: async () => ({ result: { response: call('finish'), usage: { total_tokens: 7 } } }) };
    return { ok: false, status: 401 }; } });
  assert.deepEqual(await odd([{ role: 'user', content: 'hi' }]), { text: call('finish'), tokens: 7 }, 'the site answers in the Workers AI shape');
  assert.equal(sent.length, 1); assert.equal(sent[0][1].authorization, 'Bearer ' + 'o'.repeat(30)); assert.match(odd.last, /^verse /);
  const html = stackModel(own.slice(2, 3), { fetchImpl: async () => ({ ok: true, status: 200, headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }), json: async () => { throw new SyntaxError('Unexpected token <'); } }) });
  const said = (await html([])).error;
  assert.equal(said, 'no model answered (openrouter 200 text/html not JSON)'); assert.doesNotMatch(said, /Unexpected token/);
  // a body read as text: JSON parses, a stream of data: lines joins, anything else is named by status, type and size first
  const page = '<!doctype html><title>x</title>';
  const asText = (body, type) => async () => ({ ok: true, status: 200, headers: new Headers({ 'content-type': type }), text: async () => body });
  const htmlText = await stackModel(own.slice(2, 3), { fetchImpl: asText(page, 'text/html') })([]);
  assert.equal(htmlText.error, 'no model answered (openrouter 200 text/html ' + page.length + 'B not JSON)'); assert.doesNotMatch(htmlText.error, /doctype/);
  assert.equal((await stackModel(own.slice(2, 3), { fetchImpl: asText('OK\n', 'text/plain') })([])).error, 'no model answered (openrouter 200 text/plain 2B not JSON "OK")', 'a short body is shown, escaped');
  assert.match((await stackModel(own.slice(2, 3), { fetchImpl: asText('ghs_' + 'k'.repeat(36), 'text/plain') })([])).error, /"\[masked\]"\)$/, 'a key-like run in a short body is masked');
  assert.deepEqual(await stackModel(own.slice(2, 3), { fetchImpl: asText(JSON.stringify({ choices: [{ message: { content: call('finish') } }], usage: { total_tokens: 9 } }), 'text/plain') })([]), { text: call('finish'), tokens: 9 }, 'JSON under the wrong type still reads');
  const sse = ['data: {"choices":[{"delta":{"content":"' + 'he' + '"}}]}', '', 'data: {"choices":[{"delta":{"content":"llo"}}],"usage":{"total_tokens":5}}', '', 'data: [DONE]', ''].join('\n');
  assert.deepEqual(await stackModel(own.slice(2, 3), { fetchImpl: asText(sse, 'text/event-stream') })([]), { text: 'hello', tokens: 5 }, 'a streamed reply joins its deltas');
  const seen = [];
  const fakeFetch = async (url, init) => {
    seen.push(url);
    if (url.includes('cloudflare')) return { ok: false, status: 429 };
    return { ok: true, json: async () => ({ choices: [{ message: { content: call('finish') } }], usage: { total_tokens: 42 } }) };
  };
  const m = stackModel(ps, { fetchImpl: fakeFetch });
  const out = await m([{ role: 'user', content: 'hi' }]);
  assert.deepEqual(out, { text: call('finish'), tokens: 42 });
  assert.equal(seen.length, 2); assert.match(seen[1], /openrouter/); assert.match(m.last, /^openrouter /);
  const down = stackModel(ps.slice(0, 1), { fetchImpl: async () => ({ ok: false, status: 500 }) });
  assert.match((await down([])).error, /no model answered \(workers-ai 500\)/);
  assert.deepEqual(Object.keys(keyless({ PATH: '/bin', GROQ_API_KEY: 'k', CLOUDFLARE_API_TOKEN: 't', GH_TOKEN: 'g', HOME: '/h' })), ['PATH', 'HOME'], 'checks never see a key');
});

test('the CLI: no key means exit 4 with the keys it wants; a scripted model runs end to end', () => {
  const s = repo();
  const bare = { PATH: process.env.PATH, HOME: process.env.HOME };
  let r = spawnSync(process.execPath, [new URL('./verse-coder.mjs', import.meta.url).pathname, '--repo', s.work, '--task', 'fix add'], { env: bare, encoding: 'utf8' });
  assert.equal(r.status, 4); assert.match(r.stdout, /VOID_OWNER_TOKEN \(Verse's own model, \/api\/coder\), CLOUDFLARE_API_TOKEN \+ CLOUDFLARE_ACCOUNT_ID, OPENROUTER_API_KEY, GROQ_API_KEY, GEMINI_API_KEY, CEREBRAS_API_KEY/); assert.doesNotMatch(r.stdout, /GH_MODELS/);
  const script = join(s.dir, 'script.json'), checks = join(s.dir, 'checks.json');
  writeFileSync(script, JSON.stringify([{ tool: 'edit', diff: FIX }, { tool: 'check', name: 'add' }, { tool: 'finish', summary: 'fixed' }]));
  writeFileSync(checks, JSON.stringify(CHECKS));
  r = spawnSync(process.execPath, [new URL('./verse-coder.mjs', import.meta.url).pathname, '--repo', s.work, '--task', 'fix add', '--checks', checks, '--target', 'add'], { env: { ...bare, VERSE_CODER_SCRIPT: script }, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const last = JSON.parse(r.stdout.trim().split('\n').pop());
  assert.deepEqual([last.outcome, last.files, last.provider], ['done', ['src/add.mjs'], 'script']);
});

test('the source holds no key and never force-pushes', () => {
  const src = readFileSync(new URL('./verse-coder.mjs', import.meta.url), 'utf8');
  assert.deepEqual(scanDiff('+++ b/tools/verse-coder.mjs\n' + src.split('\n').map((l) => '+' + l).join('\n')).filter((f) => f.kind !== 'assigned secret'), []);
  assert.ok(!/'push'|git push/.test(src), 'the coder never pushes: the loop does');
  assert.ok(!/gpt-oss/.test(src.replace(/gpt-oss\/i\.test/, '')), 'no gpt-oss model');
});
