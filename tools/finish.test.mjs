import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs, logLine, prBody, steps, siteFiles } from './finish.mjs';

test('parseArgs takes the kind, what changed and the flags, and refuses what it cannot use', () => {
  const a = parseArgs(['build', 'the tide card', '--by', 'grok', '--from', '5', '--dry']);
  assert.equal(a.kind, 'build'); assert.equal(a.what, 'the tide card'); assert.equal(a.by, 'grok'); assert.equal(a.from, 5); assert.deepEqual(a.tests, []); assert.equal(a.dry, true);
  assert.equal(a.log, 'the tide card', 'the log line defaults to what changed'); assert.equal(a.title, 'the tide card');
  assert.match(parseArgs(['made', 'x']).error, /kind/);
  assert.match(parseArgs(['fix']).error, /what changed/);
  assert.match(parseArgs(['fix', 'two\nlines']).error, /one line/);
  assert.equal(parseArgs(['fix', 'x', '--from', 'nope']).from, 0);
  assert.deepEqual(parseArgs(['fix', 'x', '--test', 'shop this list', '--test', '3d monopoly']).tests, ['shop this list', '3d monopoly']);
  assert.equal(parseArgs(['fix', 'x', '--body', 'Co-Authored-By: a']).body, 'Co-Authored-By: a');
  const st = parseArgs(['grow', 'x', '--show', 'sticky notes look like real paper', '--try', 'sticky note buy milk']);
  assert.deepEqual([st.show, st.try], ['sticky notes look like real paper', 'sticky note buy milk']);
  assert.deepEqual(steps(st)[1][1][1].slice(-4), ['--show', 'sticky notes look like real paper', '--try', 'sticky note buy milk'], 'they go on the ledger line');
  assert.ok(!steps(parseArgs(['grow', 'x']))[1][1][1].includes('--show'), 'and only when given');
});

test('--job: a queue job id goes on the PR body as its last line; a bad id is refused; the steps stay the same', () => {
  const a = parseArgs(['build', 'the tide card', '--job', 'mgw1x2y3']);
  assert.equal(a.job, 'mgw1x2y3');
  assert.ok(prBody(a).endsWith('\nJob: mgw1x2y3'), 'the last line is the Job: line');
  assert.ok(!prBody(parseArgs(['build', 'x'])).includes('Job:'), 'and only with --job');
  for (const bad of ['', 'abc', 'ABCD1234', '../x', 'a'.repeat(17)]) assert.match(parseArgs(['build', 'x', '--job', bad]).error || '', /--job/, bad);
  assert.deepEqual(steps(a).map((s) => s[0]), steps(parseArgs(['build', 'x'])).map((s) => s[0]), 'no step is added for it: the move happens inside the pull request step');
});

test('the log line has the log\'s own shape', () => {
  assert.equal(logLine({ by: 'claude', kind: 'fix', log: 'the timer  no longer\nstops' }, new Date('2026-10-11T02:00:00.123Z')), '2026-10-11T02:00:00Z | claude | fix | the timer no longer stops');
});

test('the PR body carries the B.I.T.E. headings', () => {
  const b = prBody({ kind: 'build', what: 'the tide card' });
  for (const h of ['## Brief (B.I.T.E.)', '**Will not build:**', '## Implement', '## Test', '## Evolve']) assert.ok(b.includes(h), h);
  assert.ok(prBody({ kind: 'build', what: 'x', brief: 'mine' }).startsWith('## Brief (B.I.T.E.)\nmine'));
});

test('the steps are AGENTS.md\'s, in order', () => {
  assert.deepEqual(steps(parseArgs(['build', 'x'])).map((s) => s[0]),
    ['first shot: the browser check', 'ledger line', 'agent-log line', 'map covers everything', 'commit', 'bring main in', 'fast checks', 'push', 'pull request']);
});

test('first shot: the page, skills and the server need a browser check; records, docs and tools do not', () => {
  assert.deepEqual(siteFiles(['void.html', 'void-live-deploy/skills/counter.js', 'void-live-deploy/functions/api/will.js', 'void-live-deploy/lib/learn.js',
    'void-live-deploy/void.growth.json', 'void-live-deploy/skills/index.json', 'docs/RULES.md', 'tools/finish.mjs', 'domains/void.agents.log.md']),
  ['void.html', 'void-live-deploy/skills/counter.js', 'void-live-deploy/functions/api/will.js', 'void-live-deploy/lib/learn.js']);
  assert.match(prBody({ kind: 'grow', what: 'x', tests: ['shop this list'] }), /in a real browser before the push: `node tools\/test_void\.mjs --only "shop this list"` passes/);
});

test('--dry runs nothing', () => {
  const r = spawnSync(process.execPath, [fileURLToPath(new URL('./finish.mjs', import.meta.url)), 'build', 'x', '--dry'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /\[8\/8\] pull request/);
});

test('the --try ask has to be answered by a skill: nothing logged, a page error or the generic answer stop the finish', async () => {
  const { tryProblem } = await import('./finish.mjs');
  assert.equal(tryProblem('> open the book\n  by: skill:guide\n  shows: The Verse Book'), '');
  assert.match(tryProblem('> open the book\n  by: (nothing logged)\n  shows:'), /nothing answered/);
  assert.match(tryProblem('> x\n  by: (no note)\n  shows:'), /nothing answered/);
  assert.match(tryProblem('> cat\n  by: article\n  shows: Cat'), /generic answer \(article\)/);
  assert.match(tryProblem('> zz\n  by: miss\n  shows:'), /generic answer/);
  assert.match(tryProblem('> x\n  by: skill:timer\n  shows: 5:00\n  ERROR: boom'), /threw an error/);
  assert.match(tryProblem(''), /nothing answered/);
});
