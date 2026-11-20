import test from 'node:test';
import assert from 'node:assert/strict';
import { branchPlan, branchOf, freshLaneBranch } from './house-branch.mjs';

test('a lane branch is deleted only when it exists and has no open pull request', () => {
  assert.equal(branchPlan({ exists: false, open: 0 }).act, 'none');
  assert.equal(branchPlan({ exists: true, open: 0 }).act, 'delete');
  assert.equal(branchPlan({ exists: true, open: 1 }).act, 'keep');
  assert.equal(branchPlan({ exists: true, open: null }).act, 'keep', 'no answer from GitHub: leave it');
  assert.equal(branchOf('next-tool'), 'house/next-tool');
  assert.equal(branchOf('../x'), 'house/x');
});

const mk = (status, open, calls) => ({
  env: { GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'o/r' },
  fetchImpl: async () => (open == null ? { ok: false } : { ok: true, json: async () => new Array(open).fill({}) }),
  run: (a) => { calls.push(a.join(' ')); return { status: a[0] === 'ls-remote' ? status : 0 }; },
  log: () => {},
});

test('freshLaneBranch deletes a stale branch, keeps one with an open pull request, and does nothing off Actions', async () => {
  let calls = [];
  assert.equal((await freshLaneBranch('links', mk(0, 0, calls))).act, 'delete');
  assert.ok(calls.includes('push origin --delete house/links'));
  calls = [];
  assert.equal((await freshLaneBranch('handoff', mk(0, 1, calls))).act, 'keep');
  assert.ok(!calls.some((c) => c.includes('--delete')));
  calls = [];
  assert.equal((await freshLaneBranch('links', mk(2, 0, calls))).act, 'none', 'no branch on origin');
  calls = [];
  assert.equal((await freshLaneBranch('links', mk(0, null, calls))).act, 'keep');
  assert.ok(!calls.some((c) => c.includes('--delete')));
  const off = mk(0, 0, calls); off.env = {};
  assert.equal((await freshLaneBranch('links', off)).act, 'none', 'never on a person\'s machine');
  const bad = mk(0, 0, []); bad.run = (a) => ({ status: a[0] === 'ls-remote' ? 0 : 1 });
  assert.equal((await freshLaneBranch('links', bad)).act, 'keep', 'a failed delete leaves the branch');
});
