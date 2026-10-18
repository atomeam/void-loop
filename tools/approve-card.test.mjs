// The approve card (skills/approve-card.js; asked by Void: "Become tasks that keep running after you leave with an approve card on the
// stage"): the ask it accepts, the status it reads off D1's rule and runs, and the catch-up count. node --test tools/approve-card.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { approveOf, statusOf, catchUp, STATUSES } from '../void-live-deploy/skills/approve-card.js';
import { parseGatedAsk } from '../void-live-deploy/lib/approval-core.js';

test('approveOf: "approve later: keep <automation> running every 2 hours" is the card; its ask is the confirm line\'s own ask, and a stop or anything else is not', () => {
  const a = approveOf('approve later: keep morning-digest running every 2 hours');
  assert.deepEqual(a, { ask: 'keep morning-digest running every 2 hours', tool: 'automation.keep', args: { id: 'morning-digest', every: 120, on: true }, rule: 'morning-digest', what: 'Keep “morning-digest” running by itself every 2 hours, even when you are not here?' });
  assert.deepEqual(parseGatedAsk(a.ask), { toolName: a.tool, args: a.args }, 'the card\'s ask is exactly what the confirm line gates');
  assert.equal(approveOf('Approve later:  keep the nightly-check automation running every day.').args.every, 1440, 'case, spaces and a full stop do not matter');
  for (const x of ['approve my leave request', 'keep morning-digest running every 2 hours', 'approve this proposal', 'approve later', 'approve later: stop keeping morning-digest', 'approve later: keep calm', 'what does approve mean'])
    assert.equal(approveOf(x), null, x);
  assert.equal(parseGatedAsk('approve later: keep morning-digest running every 2 hours'), null, 'the card ask itself never reaches the gate');
});

const th = (over = {}) => ({ kind: 'approve', rule: 'digest', status: 'pending', approvedAt: '2026-10-18T01:00:00.000Z', times: 0, ...over });
const on = { id: 'digest', enabled: true, when: { on: 'schedule', every: 120 } };
const run = (at, ok = true) => ({ rule: 'digest', at, ok, log: [{ action: 'note', ok, said: ok ? 'hi' : 'boom' }] });
const NOW = Date.parse('2026-10-18T09:00:00.000Z');

test('statusOf: the table', () => {
  assert.deepEqual(STATUSES, ['pending', 'approved', 'running', 'done', 'failed', 'aborted']);
  assert.equal(statusOf(th(), null, [], NOW), 'failed', 'no rule');
  assert.equal(statusOf(th({ approvedAt: null }), on, [run('2026-10-18T03:00:00.000Z')], NOW), 'pending', 'no yes through this card yet, whatever the rule does');
  assert.equal(statusOf(th(), { ...on, enabled: false }, [], NOW), 'pending', 'switched off');
  assert.equal(statusOf(th(), { ...on, when: { on: 'manual' } }, [], NOW), 'pending', 'not on the clock');
  assert.equal(statusOf(th(), on, [], NOW), 'approved', 'on the clock, no run yet');
  assert.equal(statusOf(th(), on, [run('2026-10-18T00:30:00.000Z')], NOW), 'approved', 'a run before the yes does not count');
  assert.equal(statusOf(th(), on, [run('2026-10-18T03:00:00.000Z')], NOW), 'running');
  assert.equal(statusOf(th(), on, [run('2026-10-18T03:00:00.000Z', false), run('2026-10-18T01:30:00.000Z')], NOW), 'failed', 'the last run failed');
  assert.equal(statusOf(th(), on, [run('2026-10-18T01:30:00.000Z', false), run('2026-10-18T03:00:00.000Z')], NOW), 'running', 'newest decides, whatever order they came in');
  assert.equal(statusOf(th({ times: 2 }), on, [run('2026-10-18T03:00:00.000Z'), run('2026-10-18T05:00:00.000Z')], NOW), 'done', 'times reached');
  assert.equal(statusOf(th({ times: 3 }), on, [run('2026-10-18T03:00:00.000Z'), run('2026-10-18T05:00:00.000Z')], NOW), 'running', 'times not reached yet');
  for (const s of ['aborted', 'done']) {
    assert.equal(statusOf(th({ status: s }), on, [run('2026-10-18T03:00:00.000Z')], NOW), s, s + ' is sticky even with a run');
    assert.equal(statusOf(th({ status: s }), null, [], NOW), s, s + ' is sticky even without the rule');
  }
  assert.equal(statusOf(th(), on, [run('2026-10-18T10:00:00.000Z')], NOW), 'approved', 'a run after now (a skewed clock) is not counted yet');
});

test('catchUp: how many runs since the card was last seen, and the newest', () => {
  const runs = [run('2026-10-18T03:00:00.000Z'), run('2026-10-18T07:00:00.000Z'), run('2026-10-18T05:00:00.000Z')];
  assert.deepEqual(catchUp(runs, '2026-10-18T04:00:00.000Z'), { n: 2, last: runs[1] });
  assert.deepEqual(catchUp(runs, '2026-10-18T08:00:00.000Z'), { n: 0, last: runs[1] });
  assert.deepEqual(catchUp(runs, null), { n: 3, last: runs[1] }, 'never seen: every run is news');
  assert.deepEqual(catchUp([], '2026-10-18T04:00:00.000Z'), { n: 0, last: null });
  assert.deepEqual(catchUp(undefined, undefined), { n: 0, last: null });
});
