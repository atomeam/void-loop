// The approval-gate phrases (tools/no-approval-gate.mjs): a conflict left for a person, a passing fix kept off
// the merge, and GitHub auto-merge turned off are caught. The phrases are built from parts so this file is not a hit.
// Run: node --test tools/no-approval-gate.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gateHits } from './no-approval-gate.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const job = 'a person' + "'s job";
const never = 'never auto' + 'merge';
const call = 'disablePullRequest' + 'AutoMerge';
const logged = 'GitHub auto-merge dis' + 'armed until the suite passes on current main';
const verb = 'dis' + 'arms GitHub auto-merge';

test('a conflict left for a person is caught', () => {
  const hits = gateHits([{ path: 'AGENTS.md', text: 'A conflict with main is still ' + job + ': merge main in.' }]);
  assert.equal(hits.length, 1);
  assert.match(hits[0], /handled automatically/);
  assert.equal(gateHits([{ path: 'AGENTS.md', text: 'Nothing waits for a person. A conflict with main is handled automatically.' }]).length, 0);
});

test('a passing fix kept off the merge is caught', () => {
  const hits = gateHits([{ path: 'docs/playbooks/probe-and-fix.md', text: '(' + never + ': a builder reviews it like anyone else)' }]);
  assert.equal(hits.length, 1);
  assert.match(hits[0], /automerges like everything else/);
  assert.equal(gateHits([{ path: 'domains/void.agents.log.md', text: never }]).length, 0, 'an old log line is a record');
});

test('turning GitHub auto-merge off is caught', () => {
  for (const text of [call, logged, verb, 'could not dis' + 'arm auto-merge']) {
    const hits = gateHits([{ path: 'tools/automerge.mjs', text }]);
    assert.equal(hits.length, 1, text);
    assert.match(hits[0], /keeps GitHub auto-merge on/);
  }
  assert.equal(gateHits([{ path: 'tools/merge-gate.mjs', text: call }]).length, 0, 'naming the old call in another tool is not the bot turning it off');
  assert.equal(gateHits([{ path: 'docs/playbooks/clean-merge.md', text: 'A ready pull request keeps GitHub auto-merge on, and the bot still squash-merges.' }]).length, 0);
});

test('the repo has none of these waits', () => {
  const r = spawnSync(process.execPath, ['tools/no-approval-gate.mjs'], { cwd: root, encoding: 'utf8' });
  assert.equal(r.status, 0, (r.stdout || '') + (r.stderr || ''));
  assert.match(r.stdout, /no human approval gate/);
});
