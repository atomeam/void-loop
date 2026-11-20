// The catch-up clock's decisions (tools/catchup-core.mjs). Run: node --test tools/catchup.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { cronsOf, parseCron, lastSlot, newestSlot, catchupDue, lateDuplicates, CATCHUP, PER_TICK } from './catchup-core.mjs';

const M = 60000, H = 60 * M, T = (s) => Date.parse(s);
test('crons are read from a workflow file and parsed', () => {
  assert.deepEqual(cronsOf("  schedule: [{ cron: '1 2 * * *' }]"), ['1 2 * * *']);
  assert.deepEqual(cronsOf("on:\n  schedule:\n    - cron: '17 9 * * *'\n    - cron: \"*/15 * * * *\" # note\n"), ['17 9 * * *', '*/15 * * * *']);
  assert.equal(parseCron('bad'), null); assert.equal(parseCron('61 * * * *'), null);
  assert.ok(parseCron('31 1-23/2 * * *').hour.has(23)); assert.ok(!parseCron('31 1-23/2 * * *').hour.has(2));
});
test('the newest slot of a cron', () => {
  const now = T('2026-11-20T20:36:00Z');
  assert.equal(lastSlot('*/15 * * * *', now), T('2026-11-20T20:30:00Z'));
  assert.equal(lastSlot('17 9 * * *', now), T('2026-11-20T09:17:00Z'));
  assert.equal(lastSlot('17 9 * * *', T('2026-11-20T09:16:00Z')), T('2026-11-19T09:17:00Z'));
  assert.equal(lastSlot('41 4 * * 1', now), T('2026-11-16T04:41:00Z')); // Monday
  assert.equal(lastSlot('41 3 * * 0', now), T('2026-11-15T03:41:00Z')); // Sunday
  assert.equal(lastSlot('17 5 3 * *', now), T('2026-11-03T05:17:00Z'));
  assert.equal(lastSlot('31 1-23/2 * * *', now), T('2026-11-20T19:31:00Z'));
  assert.equal(newestSlot(['7 1 * * *', '57 11 * * *'], now), T('2026-11-20T11:57:00Z'));
});
test('a loop is started once its slot has passed the grace with no run since, never while one runs', () => {
  const crons = ['17 9 * * *'], now = T('2026-11-20T09:50:00Z');
  assert.equal(catchupDue({ crons, runs: [{ created_at: '2026-11-19T18:00:00Z' }], now, grace: 30 }), true);
  assert.equal(catchupDue({ crons, runs: [{ created_at: '2026-11-19T18:00:00Z' }], now: T('2026-11-20T09:40:00Z'), grace: 30 }), false, 'inside the grace');
  assert.equal(catchupDue({ crons, runs: [{ created_at: '2026-11-20T09:20:00Z' }], now, grace: 30 }), false, 'already ran');
  assert.equal(catchupDue({ crons, runs: [], now, grace: 30, busy: true }), false, 'one is going');
  assert.equal(catchupDue({ crons: [], runs: [], now }), false, 'no cron');
  // tower-gate: a deploy's run measures one floor, so it does not cover the sweep
  assert.equal(catchupDue({ crons, runs: [{ event: 'workflow_run', created_at: '2026-11-20T09:30:00Z' }], now, grace: 30, counts: ['schedule', 'workflow_dispatch'] }), true);
});
test("GitHub's late scheduled run is cancelled when the clock already ran that slot", () => {
  const crons = ['17 9 * * *'];
  const runs = [
    { id: 3, event: 'schedule', status: 'in_progress', created_at: '2026-11-20T17:40:00Z' },
    { id: 2, event: 'workflow_dispatch', status: 'completed', conclusion: 'success', created_at: '2026-11-20T09:50:00Z' },
    { id: 1, event: 'schedule', status: 'completed', conclusion: 'success', created_at: '2026-11-19T18:00:00Z' },
  ];
  assert.deepEqual(lateDuplicates({ crons, runs }), [3]);
  assert.deepEqual(lateDuplicates({ crons, runs: runs.map((r) => r.id === 2 ? { ...r, conclusion: 'failure' } : r) }), [], 'the clock run failed: the late one is kept');
  assert.deepEqual(lateDuplicates({ crons, runs: [runs[0], runs[2]] }), [], 'nothing covered it');
});
test('every loop on the clock exists, has a cron and can be started by hand', () => {
  assert.ok(PER_TICK >= 1);
  for (const c of CATCHUP) {
    const p = '.github/workflows/' + c.wf; assert.ok(existsSync(p), c.wf + ' exists');
    const y = readFileSync(p, 'utf8');
    assert.ok(cronsOf(y).length, c.wf + ' has a cron'); assert.match(y, /workflow_dispatch/, c.wf + ' can be started');
    for (const c2 of cronsOf(y)) assert.ok(parseCron(c2), c.wf + ': ' + c2 + ' parses');
  }
});
