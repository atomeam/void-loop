// tools/pr-tidy.mjs: held runs on open pull requests are approved, forks never; a pull request blocked for 2 days with a quiet head closes.
// node --test tools/pr-tidy.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { approvable, expireDecision, expireNote, tidy, MARK } from './pr-tidy.mjs';

const repo = 'atomeam/void-loop', H = 36e5, now = Date.parse('2026-11-20T20:00:00Z');
const pr = (n, sha, extra = {}) => ({ number: n, state: 'open', draft: false, created_at: new Date(now - 72 * H).toISOString(), head: { sha, repo: { full_name: repo } }, ...extra });

test('approvable: only held runs on an open head from this repository', () => {
  const prs = [pr(1, 'a'), pr(2, 'b', { head: { sha: 'b', repo: { full_name: 'someone/fork' } } })];
  const runs = [
    { id: 10, conclusion: 'action_required', head_sha: 'a', head_repository: { full_name: repo } },
    { id: 11, conclusion: 'action_required', head_sha: 'b', head_repository: { full_name: 'someone/fork' } },
    { id: 12, conclusion: 'action_required', head_sha: 'old', head_repository: { full_name: repo } },
    { id: 13, conclusion: 'success', head_sha: 'a', head_repository: { full_name: repo } },
  ];
  assert.deepEqual(approvable(runs, prs, repo), [10]);
});

test('expireDecision: old, quiet and red closes; young, moving, green or draft stays', () => {
  const red = [{ id: 1, name: 'merge-gate', status: 'completed', conclusion: 'failure' }];
  const quiet = now - 30 * H;
  assert.deepEqual(expireDecision(pr(1, 'a'), { checks: red, lastCommitAt: quiet, now }), { close: true, why: 'merge-gate failure' });
  assert.equal(expireDecision(pr(1, 'a', { created_at: new Date(now - 10 * H).toISOString() }), { checks: red, lastCommitAt: quiet, now }).close, false);
  assert.equal(expireDecision(pr(1, 'a'), { checks: red, lastCommitAt: now - 2 * H, now }).close, false, 'a fix pushed today keeps it');
  assert.equal(expireDecision(pr(1, 'a', { draft: true }), { checks: red, lastCommitAt: quiet, now }).close, false);
  assert.equal(expireDecision(pr(1, 'a'), { checks: [{ id: 1, name: 'merge-gate', status: 'completed', conclusion: 'failure' }, { id: 2, name: 'merge-gate', status: 'completed', conclusion: 'success' }], lastCommitAt: quiet, now }).close, false, 'the newest run of a check decides');
  assert.deepEqual(expireDecision(pr(1, 'a', { mergeable_state: 'dirty' }), { checks: [], lastCommitAt: quiet, now }), { close: true, why: 'a conflict with main' });
  assert.ok(expireNote('x', 3).startsWith(MARK) && /reopen it/.test(expireNote('x', 3)));
});

test('tidy: approves, closes the expired one with a comment, and never throws', () => {
  const calls = [];
  const prs = [pr(5, 'a'), pr(6, 'b', { created_at: new Date(now - 1 * H).toISOString() })];
  const gh = (path) => {
    if (path.includes('/actions/runs?')) return { workflow_runs: path.endsWith('head_sha=b') ? [{ id: 77, conclusion: 'action_required', head_sha: 'b', head_repository: { full_name: repo } }] : [] };
    if (path.endsWith('/pulls/5')) return { ...prs[0], mergeable_state: 'clean' };
    if (path.endsWith('/commits/a')) return { commit: { committer: { date: new Date(now - 40 * H).toISOString() } } };
    if (path.includes('/check-runs')) return { check_runs: [{ id: 3, name: 'void-review', status: 'completed', conclusion: 'failure' }] };
    throw new Error('unexpected ' + path);
  };
  const out = tidy({ gh, run: (a) => { calls.push(a.join(' ')); return '{}'; }, repo, prs, now, log: () => {} });
  assert.deepEqual(out, { approved: 1, closed: [5] });
  assert.ok(calls.some((c) => c.includes('actions/runs/77/approve')));
  assert.ok(calls.some((c) => c.includes('issues/5/comments')) && calls.some((c) => c.includes('pulls/5 -f state=closed')));
  assert.doesNotThrow(() => tidy({ gh: () => { throw new Error('down'); }, run: () => '', repo, prs, now, log: () => {} }));
});
