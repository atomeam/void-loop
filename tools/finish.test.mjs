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
