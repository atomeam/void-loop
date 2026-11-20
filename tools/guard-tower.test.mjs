import test from 'node:test';
import assert from 'node:assert/strict';
import { verdict, lastSettleMs, daysBetween, run, RUN_LATE_MS } from './guards/tower.mjs';

const old = { id: 'a.com', progressAt: '2026-11-10', n: 5 };
test('the rule moved it and the file did not: the climb moves', () => {
  const v = verdict({ old, file: { id: 'b.com', progressAt: '2026-11-20' }, today: '2026-11-20' });
  assert.deepEqual(v, { kind: 'moved', idle: 10, from: 'a.com', to: 'b.com' });
});
test('idle past the limit and kept anyway is stuck; a healthy climb is fine; a missing settling run is late', () => {
  assert.equal(verdict({ old, file: old, today: '2026-11-20' }).kind, 'stuck');
  assert.equal(verdict({ old: { ...old, progressAt: '2026-11-19' }, file: { ...old, progressAt: '2026-11-19' }, today: '2026-11-20' }).kind, 'fine');
  assert.equal(verdict({ old: { ...old, progressAt: '2026-11-19' }, file: { ...old, progressAt: '2026-11-19' }, today: '2026-11-20', lastRunAt: 1, now: RUN_LATE_MS + 5 }).kind, 'late');
  assert.equal(verdict({ old: { ...old, progressAt: '2026-11-19' }, file: { ...old, progressAt: '2026-11-19', n: 6 }, today: '2026-11-20' }).write, true);
  assert.equal(daysBetween('2026-11-10', '2026-11-20'), 10);
});
test('the newest successful run of the settling workflow is read from the runs list', () => {
  assert.equal(lastSettleMs(JSON.stringify({ workflow_runs: [{ conclusion: 'success', updated_at: '2026-11-19T04:30:00Z' }, { conclusion: 'success', updated_at: '2026-11-18T04:30:00Z' }] })), Date.parse('2026-11-19T04:30:00Z'));
  assert.equal(lastSettleMs('not json'), 0);
});
test('on the real Tower files the guard says what it found and, when the Tower is healthy, writes nothing', async () => {
  const saved = [], jobs = [];
  const r = await run({ root: new URL('../', import.meta.url).pathname, now: Date.now(), hit: async () => ({ status: 403, text: '' }), save: (f) => saved.push(f), queueJob: async (a, t) => { jobs.push(t); return { queued: true, why: '' }; } });
  assert.equal(r.ok, true);
  assert.match(r.last, /The Tower (is on|has sat on|had made no progress)/);
});
