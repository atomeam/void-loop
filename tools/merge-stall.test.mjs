// The stall alarm: no merge for 2 hours while a green pull request waits opens one issue that names the stuck step.
import test from 'node:test';
import assert from 'node:assert/strict';
import { stallVerdict, lastMerge, keyOf, withKey, STALL_MS, HUNG_MS } from './merge-stall.mjs';

const NOW = Date.parse('2026-11-06T12:00:00Z');
const ago = (m) => new Date(NOW - m).toISOString();
const old = [{ number: 2301, createdAt: ago(5 * 3600e3) }, { number: 2302, createdAt: ago(4 * 3600e3) }];
const base = { now: NOW, lastMergeAt: ago(3 * 3600e3), ready: old, mainSha: 'abc1234def', suiteRun: null, mergeError: '' };

test('a recent merge, or no green pull request older than 2 hours, is not a stall', () => {
  assert.equal(stallVerdict({ ...base, lastMergeAt: ago(30 * 60e3), choice: { action: 'hold', pr: { number: 2301 } } }).stalled, false);
  assert.equal(stallVerdict({ ...base, ready: [], choice: null }).stalled, false);
  assert.equal(stallVerdict({ ...base, ready: [{ number: 2350, createdAt: ago(10 * 60e3) }], choice: { action: 'queue', pr: { number: 2350 } } }).stalled, false);
  assert.equal(stallVerdict({ ...base, choice: { action: 'merge', pr: { number: 2301 } } }).stalled, false, 'the merge happens in this sweep');
});

test('a red main or suite is named as the stuck step, with no fix the bot may make itself', () => {
  const v = stallVerdict({ ...base, choice: { action: 'hold', pr: { number: 2301 } } });
  assert.equal(v.stalled, true);
  assert.match(v.step, /failed the full suite on main abc1234/);
  assert.equal(v.cancel, null);
  assert.match(v.body, /#2301, #2302/);
  assert.match(v.body, /No pull request merged for 3 hours/);
});

test('a suite gate run past its own time limit is cancelled, so the next sweep starts it again', () => {
  const hung = { id: 77, status: 'in_progress', createdAt: ago(HUNG_MS + 5 * 60e3), url: 'https://x/runs/77' };
  const v = stallVerdict({ ...base, suiteRun: hung, choice: { action: 'wait', pr: { number: 2301 } } });
  assert.equal(v.cancel, 77);
  assert.equal(v.key, 'hung:77');
  const fresh = { ...hung, createdAt: ago(10 * 60e3) };
  const w = stallVerdict({ ...base, suiteRun: fresh, choice: { action: 'wait', pr: { number: 2301 } } });
  assert.equal(w.cancel, null, 'a run inside its limit is left alone');
  assert.match(w.step, /in progress \(10 minutes\)/);
});

test('a refused merge and a suite that never starts are named too', () => {
  const r = stallVerdict({ ...base, mergeError: 'Base branch was modified', choice: { action: 'merge', pr: { number: 2301 } } });
  assert.equal(r.stalled, true);
  assert.match(r.step, /refused the merge of #2301/);
  const q = stallVerdict({ ...base, choice: { action: 'queue', pr: { number: 2301 } } });
  assert.match(q.step, /suite-gate.yml starts/);
});

test('the newest merge time, and the step key kept in the issue body', () => {
  assert.equal(lastMerge([{ merged_at: null }, { merged_at: '2026-11-05T15:00:00Z' }, { merged_at: '2026-11-06T03:23:59Z' }]), '2026-11-06T03:23:59Z');
  assert.equal(lastMerge([]), '');
  assert.equal(keyOf(withKey('text', 'hold:abc1234')), 'hold:abc1234');
  assert.equal(keyOf('no key'), '');
  assert.equal(STALL_MS, 2 * 3600e3);
});
