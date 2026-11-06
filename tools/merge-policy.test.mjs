import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { eligible, superseded, stuckDecision, isBot } from './merge-policy.mjs';

const pr = (over) => ({ number: 1, state: 'open', user: { login: 'atomeam' }, head: { ref: 'helper/x', repo: { full_name: 'atomeam/void-loop' } }, labels: [], created_at: '2026-11-03T00:00:00Z', ...over });

test('the owner and both Actions logins count as the bot', () => {
  assert.equal(isBot('atomeam'), true);
  assert.equal(isBot('github-actions[bot]'), true);
  assert.equal(isBot('app/github-actions'), true);
  assert.equal(isBot('someone'), false);
});

test('a labelled pull request qualifies, and so does a bot branch; a fork does not', () => {
  assert.equal(eligible(pr({ labels: [{ name: 'automerge' }] }), 'atomeam/void-loop'), true);
  assert.equal(eligible(pr({ user: { login: 'app/github-actions' }, head: { ref: 'lab/sync-1', repo: { full_name: 'atomeam/void-loop' } } }), 'atomeam/void-loop'), true);
  assert.equal(eligible(pr({ labels: [], head: { ref: 'feature', repo: { full_name: 'atomeam/void-loop' } } }), 'atomeam/void-loop'), false);
  assert.equal(eligible(pr({ head: { ref: 'helper/x', repo: { full_name: 'other/void-loop' } }, labels: [{ name: 'automerge' }] }), 'atomeam/void-loop'), false);
});

test('an older lab sync and an older loop lap are closed, the newest kept', () => {
  const rows = [
    pr({ number: 1, created_at: '2026-11-01T00:00:00Z', user: { login: 'app/github-actions' }, head: { ref: 'lab/sync-old' } }),
    pr({ number: 2, created_at: '2026-11-03T00:00:00Z', user: { login: 'app/github-actions' }, head: { ref: 'lab/sync-new' } }),
    pr({ number: 3, created_at: '2026-11-02T00:00:00Z', user: { login: 'github-actions[bot]' }, head: { ref: 'loop/a' } }),
    pr({ number: 4, created_at: '2026-11-03T00:00:00Z', user: { login: 'github-actions[bot]' }, head: { ref: 'loop/b' } }),
    pr({ number: 5, created_at: '2026-11-01T00:00:00Z', user: { login: 'someone' }, head: { ref: 'lab/sync-person' } }),
  ];
  const closed = superseded(rows);
  assert.deepEqual(closed.map((r) => r.number).sort(), [1, 3]);
  assert.equal(closed.find((r) => r.number === 1).keep, 2);
});

test('six hours: green merges, a conflict is rebased, a red check is named, a young one waits', () => {
  const now = Date.parse('2026-11-04T12:00:00Z');
  const old = pr({ created_at: '2026-11-04T00:00:00Z', mergeable_state: 'clean' });
  assert.equal(stuckDecision(old, [{ name: 'void-review', status: 'completed', conclusion: 'success' }], now).action, 'merge');
  assert.equal(stuckDecision({ ...old, mergeable_state: 'dirty' }, [], now).action, 'rebase');
  assert.equal(stuckDecision({ ...old, mergeable_state: 'behind' }, [], now).action, 'update');
  assert.equal(stuckDecision(old, [{ name: 'void-review', status: 'completed', conclusion: 'failure' }], now).why, 'void-review failure');
  assert.equal(stuckDecision(pr({ created_at: '2026-11-04T10:00:00Z' }), [], now).action, 'young');
});

// 2026-11-06: since the suite gate (#2309) the bot no longer arms GitHub's auto-merge (it would merge on whatever main is, without the
// suite). It disarms it, and merges one pull request itself with a squash, only after the suite passed on top of current main.
test('the automerge workflow merges with a squash after the suite gate, and keeps the hourly run', () => {
  const yml = readFileSync(new URL('../.github/workflows/automerge.yml', import.meta.url), 'utf8');
  const src = readFileSync(new URL('./automerge.mjs', import.meta.url), 'utf8');
  assert.match(yml, /pull-requests: write/);
  assert.match(yml, /17 \* \* \* \*/);
  assert.match(yml, /STUCK:/);
  assert.match(src, /disablePullRequestAutoMerge/);
  assert.match(src, /merge_method=squash/);
  assert.match(src, /choose\(rows, mainSha, running\)/);
  assert.match(src, /update-branch/);
});
