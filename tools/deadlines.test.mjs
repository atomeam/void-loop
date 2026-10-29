// The deadline chain's date math (skills/deadlines.js): month ends, a daylight-saving change, leap days, the order of the
// chain, each deadline's state, and the asks it takes. Run: node --test tools/deadlines.test.mjs
// The time zone is fixed so the daylight-saving case is the same on every machine (America/New_York leaves summer time at
// 2:00 on 2026-11-01). Node reads TZ when a date is made, so setting it here, before any date, is enough.
process.env.TZ = 'America/New_York';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import skill, { addStep, addMonths, chainOf, stateOf, spanText, deadlinesOf, stepsOf } from '../void-live-deploy/skills/deadlines.js';

const at = (y, mo, d, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi);
const ymd = (d) => [d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes()].join('-');
const HOUR = 3600000;

test('deadlines: a month from a month end lands on the shorter month\'s last day', () => {
  assert.equal(ymd(addMonths(at(2026, 1, 31, 9), 1)), '2026-2-28-9-0');
  assert.equal(ymd(addMonths(at(2026, 3, 31, 9), 1)), '2026-4-30-9-0');
  assert.equal(ymd(addMonths(at(2026, 8, 31), 1)), '2026-9-30-0-0');
  assert.equal(ymd(addMonths(at(2026, 12, 31, 23, 59), 2)), '2027-2-28-23-59', 'across a year end');
  assert.equal(ymd(addMonths(at(2026, 1, 15), 1)), '2026-2-15-0-0', 'a mid-month day stays put');
  assert.equal(ymd(addStep(at(2026, 10, 15, 14), { n: 1, unit: 'mo' })), '2026-11-15-14-0');
});

test('deadlines: leap days', () => {
  assert.equal(ymd(addMonths(at(2028, 1, 31), 1)), '2028-2-29-0-0', '2028 is a leap year');
  assert.equal(ymd(addStep(at(2028, 2, 29, 12), { n: 1, unit: 'y' })), '2029-2-28-12-0', 'a year from a leap day');
  assert.equal(ymd(addStep(at(2028, 2, 28, 12), { n: 1, unit: 'd' })), '2028-2-29-12-0');
  assert.equal(ymd(addStep(at(2026, 2, 28, 12), { n: 1, unit: 'd' })), '2026-3-1-12-0');
  assert.equal(ymd(addStep(at(2027, 2, 14), { n: 2, unit: 'w' })), '2027-2-28-0-0');
});

test('deadlines: across the daylight-saving change, hours are exact and days keep the clock time', () => {
  const start = at(2026, 10, 31, 9); // EDT; the clocks go back at 2:00 on 2026-11-01
  const h24 = addStep(start, { n: 24, unit: 'h' }), d1 = addStep(start, { n: 1, unit: 'd' });
  assert.equal(h24 - start, 24 * HOUR, '24 hours is 24 hours');
  assert.equal(ymd(h24), '2026-11-1-8-0', 'which reads 8:00 on the wall clock');
  assert.equal(ymd(d1), '2026-11-1-9-0', 'a day keeps 9:00');
  assert.equal(d1 - start, 25 * HOUR, 'that day is 25 hours long');
  const spring = at(2027, 3, 13, 9); // the clocks go forward on 2027-03-14
  assert.equal(addStep(spring, { n: 1, unit: 'd' }) - spring, 23 * HOUR);
  assert.equal(addStep(spring, { n: 72, unit: 'h' }) - spring, 72 * HOUR);
});

test('deadlines: the chain is in time order, a step said twice shows once', () => {
  const start = at(2026, 10, 15, 14);
  const chain = chainOf(start, stepsOf('1 month, 24 hours, 14 days, 72 hours, 1 day'));
  assert.deepEqual(chain.map((c) => c.label), ['24 hours', '72 hours', '14 days', '1 month'], '1 day and 24 hours are the same moment here');
  for (let i = 1; i < chain.length; i++) assert.ok(chain[i].due > chain[i - 1].due);
  assert.deepEqual(stepsOf('24h, 3d, 2 wks, a month, 1 yr').map((s) => s.n + s.unit), ['24h', '3d', '2w', '1mo', '1y']);
  assert.deepEqual(stepsOf('monday 9am 2026-10-15 14:00 1st'), [], 'times and dates are not steps');
});

test('deadlines: pending, due soon (a tenth of the window or 2 hours), passed, met', () => {
  const start = at(2026, 10, 15, 0), due24 = new Date(start.getTime() + 24 * HOUR), due14 = addStep(start, { n: 14, unit: 'd' });
  assert.equal(stateOf(at(2026, 10, 15, 12), start, due24, false), 'pending');
  assert.equal(stateOf(new Date(due24 - 2.3 * HOUR), start, due24, false), 'soon', 'under 2.4 h of a 24 h window');
  assert.equal(stateOf(new Date(due14 - 30 * HOUR), start, due14, false), 'soon', 'under a tenth of 14 days');
  assert.equal(stateOf(new Date(due14 - 40 * HOUR), start, due14, false), 'pending');
  const short = new Date(start.getTime() + 5 * HOUR);
  assert.equal(stateOf(new Date(short - 1.5 * HOUR), start, short, false), 'soon', 'under 2 hours always counts');
  assert.equal(stateOf(due24, start, due24, false), 'passed');
  assert.equal(stateOf(new Date(due24.getTime() + HOUR), start, due24, true), 'met');
  assert.equal(spanText(2 * 24 * HOUR + 3 * HOUR + 5 * 60000), 'in 2 days 3 h');
  assert.equal(spanText(-(5 * HOUR + 10 * 60000)), '5 h 10 min ago');
  assert.equal(spanText(20000), 'now');
});

test('deadlines: the asks it takes, and the ones it leaves', () => {
  const now = at(2026, 10, 15, 10, 30); // a Thursday
  const a = deadlinesOf('deadline chain from today: 24 hours, 72 hours, 14 days', now);
  assert.equal(ymd(a.start), '2026-10-15-10-30'); assert.equal(a.steps.length, 3); assert.equal(a.defaulted, false);
  const b = deadlinesOf('when are my deadlines if it started monday 9am: 1 day, 3 days, 2 weeks, 1 month', now);
  assert.equal(ymd(b.start), '2026-10-12-9-0', 'the Monday just gone');
  assert.equal(ymd(chainOf(b.start, b.steps).at(-1).due), '2026-11-12-9-0');
  const c = deadlinesOf('reporting deadlines from 2026-10-15 14:00', now);
  assert.equal(ymd(c.start), '2026-10-15-14-0'); assert.equal(c.defaulted, true);
  assert.deepEqual(c.steps.map((s) => s.label), ['24 hours', '72 hours', '14 days', '1 month']);
  assert.equal(ymd(deadlinesOf('deadlines from yesterday 3pm: 24h', now).start), '2026-10-14-15-0');
  assert.equal(ymd(deadlinesOf('my deadlines starting oct 1: 30 days', now).start), '2026-10-1-0-0');
  assert.equal(deadlinesOf('deadlines from feb 30: 1 day', now), null, 'a day that does not exist');
  for (const n of skill.nearMisses.concat(['the deadline from my boss is friday', 'what are deadlines'])) assert.equal(deadlinesOf(n, now), null, n);
  for (const e of skill.examples) assert.ok(skill.match(e.toLowerCase(), e), e);
});
