// node --test tools/verse-agent.test.mjs: Verse's coding agent (tools/verse-agent.mjs). The paths it may change, what it reads from a model,
// its test names, the environment its children get, the reverted-commit reader, and the whole loop against a scripted brain in a scratch repo.
import test from 'node:test'; import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs'; import { join } from 'node:path'; import os from 'node:os'; import { spawnSync } from 'node:child_process';
import { allowPath, scopeProblems, parseAction, neuronsOf, tierFor, trimOutput, testCommand, childEnv, incidentsFrom, runAgent, summaryOf, makeTools } from './verse-agent.mjs';
import { AGENT_MODELS, AGENT_NEURONS } from '../void-live-deploy/lib/models.js';

test('the agent may change skills, lib, tools, docs and static pages', () => {
  for (const p of ['void-live-deploy/skills/tower.js', 'void-live-deploy/lib/tower.js', 'tools/tower.test.mjs', 'docs/brains.md', 'void-live-deploy/password/index.html', 'void-live-deploy/skills/display.js', 'void-live-deploy/lib/restore.js'])
    assert.equal(allowPath(p), '', p);
});
test('never workflows, functions, the page, money, auth, secrets, gate tools or history', () => {
  for (const p of ['.github/workflows/deploy.yml', 'void-live-deploy/functions/api/queue.js', 'void.html', 'void-live-deploy/index.html', 'void-live-deploy/lib/gumroad.js', 'void-live-deploy/lib/guard.js',
    'void-live-deploy/lib/paid-access.js', 'void-live-deploy/lib/price-lock.js', 'void-live-deploy/lib/store-db.js', 'void-live-deploy/lib/models.js', 'void-live-deploy/lib/code-review.js', 'tools/checks.mjs', 'tools/secret-scan.mjs',
    'tools/review-pr.mjs', 'tools/verse-agent.mjs', 'tools/verse-agent.test.mjs', 'void-live-deploy/void.growth.json', 'domains/void.agents.log.md', 'STANDING.md', 'package.json', 'tools/void_queue.py', '../x.js', '/etc/passwd', 'tools/../.github/x.yml', 'README.md'])
    assert.notEqual(allowPath(p), '', p);
});
test('a diff that deletes, strays, grows too big or weakens a test is refused', () => {
  assert.deepEqual(scopeProblems('M\tvoid-live-deploy/lib/tower.js', '10\t2\tvoid-live-deploy/lib/tower.js', ''), []);
  assert.match(scopeProblems('D\ttools/tower.test.mjs').join(), /deleted/);
  assert.match(scopeProblems('M\t.github/workflows/x.yml').join(), /off limits/);
  assert.match(scopeProblems('M\ttools/a.mjs', '900\t0\ttools/a.mjs').join(), /900 lines added/);
  assert.match(scopeProblems('M\ttools/a.test.mjs', '1\t1\ttools/a.test.mjs', '+++ b/tools/a.test.mjs\n-  assert.equal(x, 1);\n+  // gone').join(), /assertion/);
});
test('the first JSON action is read from a reply, fences and prose around it ignored', () => {
  assert.deepEqual(parseAction('Sure.\n```json\n{"thought":"t","tool":"read_file","args":{"path":"a {b}"}}\n```'), { tool: 'read_file', args: { path: 'a {b}' }, thought: 't' });
  assert.equal(parseAction('no json here'), null);
  assert.equal(parseAction('{"not":"an action"}'), null);
  assert.equal(parseAction('{"tool":"done"}').tool, 'done');
});
test('every agent model is priced, the strong list plans and repairs', () => {
  for (const m of new Set([...AGENT_MODELS.fast, ...AGENT_MODELS.strong])) assert.ok(AGENT_NEURONS[m], m);
  assert.equal(neuronsOf(AGENT_MODELS.fast[0], 1e6, 0), AGENT_NEURONS[AGENT_MODELS.fast[0]][0]);
  assert.equal(neuronsOf('qwen2.5-coder:7b', 5000, 500), 0);
  assert.equal(tierFor({ step: 1 }), 'strong'); assert.equal(tierFor({ step: 4 }), 'fast'); assert.equal(tierFor({ step: 4, lastFailed: true }), 'strong'); assert.equal(tierFor({ step: 4, badReplies: 2 }), 'strong');
});
test('test names map to fixed commands; anything else is refused', () => {
  assert.deepEqual(testCommand('unit:tower', () => true).cmd.slice(1), ['--test', 'tools/tower.test.mjs']);
  assert.match(testCommand('unit:nope', () => false).why, /does not exist/);
  assert.deepEqual(testCommand('browser:tower card').cmd.slice(1), ['tools/test_void.mjs', '--only', 'tower card']);
  assert.ok(testCommand('checks').cmd.includes('--changed'));
  for (const bad of ['rm -rf /', 'browser:$(curl x)', 'unit:../../x', 'npm test', 'browser:a;b']) assert.ok(testCommand(bad).why, bad);
});
test('children never see a token, a key or CI', () => {
  const e = childEnv({ PATH: '/bin', NODE_TEST_CONTEXT: 'child', CLOUDFLARE_API_TOKEN: 'x', VOID_OWNER_TOKEN: 'x', GH_TOKEN: 'x', ANTHROPIC_API_KEY: 'x', ACTIONS_RUNTIME_TOKEN: 'x', CI: 'true', GITHUB_ACTIONS: 'true', HOME: '/h' }, { VOID_SKIP_BENCH: '1' });
  assert.deepEqual(Object.keys(e).sort(), ['HOME', 'PATH', 'VOID_SKIP_BENCH']);
});
test('a long output keeps its failing lines and its tail', () => {
  const s = Array.from({ length: 2000 }, (_, i) => (i === 50 ? 'not ok 3 - the tower keeps its floors' : 'line ' + i)).join('\n'), t = trimOutput(s, 1000);
  assert.ok(t.length <= 1100); assert.match(t, /not ok 3/); assert.match(t, /line 1999/);
});
test('reverted agent commits are read from the log by their run trailer', () => {
  const log = 'aaaa1111aaaa1111\tVerse agent: tap targets\tbody\n\nVerse-Agent-Run: 123\n\0' + 'bbbb2222bbbb2222\tRevert "Verse agent: tap targets"\tThis reverts commit aaaa1111aaaa1111.\nVerse-auto-revert: browser suite red\n\0' + 'cccc\tRevert x\tThis reverts commit dddd.\n\0';
  assert.deepEqual(incidentsFrom(log), [{ reverted: 'aaaa1111aaaa', by: 'bbbb2222bbbb', run: '123', subject: 'Verse agent: tap targets', why: 'browser suite red' }]);
});

// the whole loop, in a scratch git repo, against a scripted brain: read, patch, test, done; then the gate (stubbed here: it runs the real checks)
function scratch() {
  const d = mkdtempSync(join(os.tmpdir(), 'verse-agent-')); const g = (...a) => spawnSync('git', a, { cwd: d, encoding: 'utf8' });
  mkdirSync(join(d, 'tools'), { recursive: true });
  writeFileSync(join(d, 'tools', 'sum.mjs'), 'export const sum = (a, b) => a - b;\n');
  writeFileSync(join(d, 'tools', 'sum.test.mjs'), "import test from 'node:test'; import assert from 'node:assert/strict'; import { sum } from './sum.mjs';\ntest('adds', () => assert.equal(sum(2, 3), 5));\n");
  g('init', '-q'); g('add', '-A'); g('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'start'); return d;
}
test('the loop reads, patches, tests, repairs after a failure and finishes', async () => {
  const d = scratch(), said = [];
  const script = [
    '{"thought":"look","tool":"read_file","args":{"path":"tools/sum.mjs"}}',
    '{"thought":"fix","tool":"patch_file","args":{"path":"tools/sum.mjs","search":"a - b","replace":"a * b"}}',
    '{"thought":"test","tool":"run_tests","args":{"name":"unit:sum"}}',
    '{"thought":"repair","tool":"patch_file","args":{"path":"tools/sum.mjs","search":"a * b","replace":"a + b"}}',
    '{"thought":"test","tool":"run_tests","args":{"name":"unit:sum"}}',
    '{"thought":"ok","tool":"done","args":{"summary":"sum adds","tests":["unit:sum"]}}'];
  const call = async (model, messages) => { said.push({ model, last: messages[messages.length - 1].content }); return { content: script[said.length - 1], inTok: 1000, outTok: 100, ms: 1 }; };
  let gated = null;
  const r = await runAgent({ task: 'make sum add', dir: d, call, gateFn: (o) => { gated = o; return { passed: true, failed: '', steps: [{ step: 'scope', ok: true }] }; }, log: () => {}, brains: { fast: ['@cf/zai-org/glm-4.7-flash'], strong: ['@cf/openai/gpt-oss-120b'] } });
  assert.equal(readFileSync(join(d, 'tools', 'sum.mjs'), 'utf8'), 'export const sum = (a, b) => a + b;\n');
  assert.equal(r.end.kind, 'done'); assert.equal(r.passed, true); assert.deepEqual(gated.tests, ['unit:sum']);
  assert.equal(said[0].model, '@cf/openai/gpt-oss-120b', 'the plan takes the strong brain'); assert.equal(said[1].model, '@cf/zai-org/glm-4.7-flash');
  assert.equal(said[3].model, '@cf/openai/gpt-oss-120b', 'the repair after a failed test takes the strong brain: ' + said.map((s) => s.model + " " + s.last.slice(0, 40)).join(" / "));
  assert.match(said[3].last, /^FAIL unit:sum[\s\S]*Your last edit/, 'the repair sees the failure and the edited code');
  assert.ok(r.neurons > 0); assert.match(summaryOf(r), /passed the gate/);
});
test('done without passing tests, refused paths and the step cap', async () => {
  const d = scratch();
  const script = ['{"tool":"done","args":{}}', '{"tool":"patch_file","args":{"path":".github/workflows/x.yml","search":"a","replace":"b"}}', 'not json', '{"tool":"read_file","args":{"path":"tools/sum.mjs"}}'];
  const seen = []; let i = 0;
  const r = await runAgent({ task: 't', dir: d, maxSteps: 4, call: async (m, msgs) => { seen.push(msgs[msgs.length - 1].content); return { content: script[i++], inTok: 10, outTok: 10, ms: 1 }; }, gateFn: () => assert.fail('no gate'), log: () => {} });
  assert.match(seen[1], /not changed anything yet/); assert.match(seen[2], /refused/); assert.match(seen[3], /not one JSON object/);
  assert.equal(r.end.kind, 'cap'); assert.equal(r.passed, false);
});
test('a model that errors is skipped for the next; none answering ends the run', async () => {
  const d = scratch(), tried = [];
  const r = await runAgent({ task: 't', dir: d, call: async (m) => { tried.push(m); const e = new Error('HTTP 403'); e.status = 403; throw e; }, log: () => {}, brains: { fast: ['a'], strong: ['b'] } });
  assert.deepEqual(tried, ['b', 'a']); assert.equal(r.end.kind, 'no-brain');
});
test('the tools stay inside the repository', () => {
  const d = scratch(), t = makeTools({ edits: [], created: new Set(), tests: [], lastEdit: null }, d);
  assert.match(t.read_file({ path: '../../etc/passwd' }), /no such file|not in/);
  assert.match(t.create_file({ path: 'tools/new.mjs', content: 'x' }), /created/);
  assert.match(t.create_file({ path: 'tools/new.mjs', content: 'x' }), /exists/);
  assert.match(t.patch_file({ path: 'tools/sum.mjs', search: 'zzz', replace: 'y' }), /not found/);
  assert.match(t.search({ pattern: 'sum', path: 'tools' }), /sum\.mjs/);
});

// the conductor's contract: a claimed job read by id, and the queue always told what came of it
import { jobKind, triesOf, taskFromJob, outcomeOf, budgetOf, KIND_HINTS } from './verse-agent.mjs';
test('a job becomes a task: its ask first, the kind\'s hint, the draft and a heal job\'s log', () => {
  assert.equal(jobKind('heal:deploy'), 'heal'); assert.equal(jobKind('versus:skinnytaste.com'), 'versus'); assert.equal(jobKind('flake'), 'flake');
  assert.equal(triesOf('tries 2 · out of budget'), 2); assert.equal(triesOf('claimed by conductor'), 0);
  const t = taskFromJob({ id: 'q-1', ask: 'the bench runner fails on Sundays', target: 'heal:bench', note: 'claimed by conductor 2026-10-26; failing run https://github.com/atomeam/void-loop/actions/runs/123', draft: 'look at tools/bench.mjs' }, { log: 'Error: boom' });
  assert.equal(t.split('\n')[0], 'the bench runner fails on Sundays');
  assert.match(t, /Queue job q-1 \(heal:bench\)\. Note: failing run https/); assert.ok(t.includes(KIND_HINTS.heal)); assert.match(t, /draft plan[\s\S]*bench\.mjs/); assert.match(t, /failing log[\s\S]*Error: boom/);
  assert.ok(!/claimed by conductor/.test(t));
});
test('the queue is told done, failed or queued with its tries', () => {
  const R = (end, extra = {}) => ({ task: 'Make the copy button bigger. More words.', end, passed: false, failed: '', gate: [], ...extra });
  assert.deepEqual(outcomeOf({ result: R({ kind: 'done' }, { passed: true }), landed: true, sha: 'abcdef1234567890', runUrl: 'U' }), { state: 'done', note: 'verse-agent U: abcdef1234 Make the copy button bigger.' });
  assert.equal(outcomeOf({ result: R({ kind: 'done' }, { failed: 'checks', gate: [{ step: 'scope', ok: true }, { step: 'checks', ok: false, detail: '2 failed' }] }), runUrl: 'U' }).note, 'verse-agent U: the gate refused it at checks: 2 failed');
  assert.equal(outcomeOf({ result: R({ kind: 'gave-up', why: 'needs sw.js' }) }).state, 'failed');
  assert.equal(outcomeOf({ result: R({ kind: 'cap', why: 'repair cap: the tests still fail after 5 repairs' }) }).state, 'failed');
  assert.deepEqual(outcomeOf({ result: R({ kind: 'cap', why: 'neuron cap (2500 of 2500)' }), tries: 1, runUrl: 'U' }), { state: 'queued', note: 'tries 2 · out of budget: neuron cap (2500 of 2500) U' });
  assert.equal(outcomeOf({ result: null, agentResult: 'failure', tries: 0 }).note.startsWith('tries 1 · could not start: the agent job failure'), true);
  assert.equal(outcomeOf({ budget: '300 neurons left' }).state, 'queued');
  assert.equal(outcomeOf({ result: R({ kind: 'done' }, { passed: true }) }).state, 'queued', 'passed but not landed is retried');
  for (const o of [outcomeOf({ result: R({ kind: 'gave-up', why: 'x'.repeat(900) }) })]) assert.ok(o.note.length <= 300);
});
test('the budget leaves the site its reserve of the free allocation', () => {
  assert.equal(budgetOf({ accountUsed: 2000 }).left, 4000); assert.equal(budgetOf({ accountUsed: 9000 }).left, 0);
  assert.equal(budgetOf({ accountUsed: null, ownUsed: 1000, ownCap: 3000 }).left, 2000); assert.match(budgetOf({}).source, /unread/);
});
