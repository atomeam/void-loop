// node tools/live.test.mjs: the background runner that keeps a card current (void-live-deploy/skills/live.js, asked by
// Void 2026-10-09). The scheduling is pure, so these run in Node: when a refresh is due, what holds it (hidden tab,
// offline, paused, mid-refresh), when it stops (card gone), how failures back off, and what the line under the card says.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plan, nextDelay, caption, everyText, keepLive, MIN_EVERY, MAX_BACKOFF } from '../void-live-deploy/skills/live.js';

const MIN = 60e3;
const base = { every: 15 * MIN, lastAt: 1000e3, failures: 0, paused: false, busy: false };
const world = { now: 1000e3, present: true, visible: true, online: true };

test('live/not-due-waits-the-rest-of-the-interval', () => {
  const p = plan(base, { ...world, now: base.lastAt + 5 * MIN });
  assert.equal(p.do, 'wait');
  assert.equal(p.ms, 10 * MIN);
});

test('live/due-refreshes', () => {
  assert.equal(plan(base, { ...world, now: base.lastAt + 15 * MIN }).do, 'refresh');
  assert.equal(plan(base, { ...world, now: base.lastAt + 16 * MIN }).do, 'refresh');
});

test('live/hidden-tab-offline-paused-or-busy-holds', () => {
  const due = { ...world, now: base.lastAt + 20 * MIN };
  assert.equal(plan(base, { ...due, visible: false }).do, 'hold');
  assert.equal(plan(base, { ...due, online: false }).do, 'hold');
  assert.equal(plan({ ...base, paused: true }, due).do, 'hold');
  assert.equal(plan({ ...base, busy: true }, due).do, 'hold');
  // the moment the world changes back, the overdue card refreshes at once
  assert.equal(plan(base, due).do, 'refresh');
});

test('live/card-gone-stops-whatever-else-is-true', () => {
  assert.equal(plan(base, { ...world, present: false }).do, 'stop');
  assert.equal(plan({ ...base, paused: true }, { ...world, present: false, visible: false }).do, 'stop');
});

test('live/failures-back-off-doubling-to-eight-times', () => {
  assert.equal(nextDelay(15 * MIN, 0), 15 * MIN);
  assert.equal(nextDelay(15 * MIN, 1), 30 * MIN);
  assert.equal(nextDelay(15 * MIN, 2), 60 * MIN);
  assert.equal(nextDelay(15 * MIN, 3), 120 * MIN);
  assert.equal(nextDelay(15 * MIN, 9), MAX_BACKOFF * 15 * MIN);
  // never under the floor, so a skill cannot hammer a service
  assert.equal(nextDelay(1000, 0), MIN_EVERY);
  const p = plan({ ...base, failures: 1 }, { ...world, now: base.lastAt + 20 * MIN });
  assert.equal(p.do, 'wait'); assert.equal(p.ms, 10 * MIN);
});

test('live/every-text-reads-like-a-person-wrote-it', () => {
  assert.equal(everyText(45e3), 'every 45 s');
  assert.equal(everyText(15 * MIN), 'every 15 min');
  assert.equal(everyText(60 * MIN), 'every 1 hour');
  assert.equal(everyText(90 * MIN), 'every 1.5 hours');
});

test('live/caption-says-when-and-how-often-and-what-is-wrong', () => {
  const clock = (t) => 'T' + Math.round(t / MIN);
  assert.equal(caption(base, world, clock), 'updated T17 · refreshes every 15 min');
  assert.equal(caption({ ...base, paused: true }, world, clock), 'updates paused · last T17');
  assert.equal(caption(base, { ...world, online: false }, clock), 'offline · last T17 · updates when back');
  assert.equal(caption({ ...base, failures: 2, failedAt: 1200e3 }, world, clock), 'couldn\'t update at T20 · showing T17 · trying again');
});

test('live/keep-live-needs-a-refresh-function', () => {
  assert.throws(() => keepLive({ _pageStill: () => true }, {}, { every: MIN }), TypeError);
});
