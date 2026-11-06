// docs/GAPS.md batch 3 (2026-11-06): an alarm is its own card that says the time it rings at.
//   node --test tools/gaps-batch3.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import timer, { ask, alarmMs, alarmClock, alarmLine } from '../void-live-deploy/skills/timer.js';

// a stage with nothing on it: the parts of stageApi that ask() uses
const stage = () => {
  const things = {}, said = []; let sel = null;
  return { said, things, api: { stage: { clientWidth: 800, clientHeight: 600 }, things: () => things, select: (id) => { sel = id; }, selected: () => sel, save() {}, render() {}, say: (s) => said.push(s) } };
};

test('alarm at 7am: the clock time it rings at, read as the visitor reads a clock', () => {
  const now = new Date(2026, 10, 6, 6, 0, 0);
  assert.equal(alarmClock(alarmMs('alarm at 7am', now), now), '7:00 AM');
  assert.equal(alarmClock(alarmMs('set an alarm for 6:30 pm', now), now), '6:30 PM');
  assert.equal(alarmClock(alarmMs('wake me up at 12am', now), now), '12:00 AM');
  assert.equal(alarmLine({ alarmFor: '7:00 AM', running: true }), 'Alarm for 7:00 AM · rings in this page while it is open');
  assert.equal(alarmLine({ alarmFor: '7:00 AM', running: false, remaining: 5000 }), 'Alarm for 7:00 AM · paused');
  assert.equal(alarmLine({ running: true }), '');
});

test('alarm at 7am: a running alarm card of its own, and the page says when it rings', () => {
  for (const a of ['alarm at 7am', 'set an alarm for 7am', 'wake me up at 7am']) {
    const s = stage();
    assert.equal(ask(a, a, s.api), 'alarm-set', a);
    const [t] = Object.values(s.things);
    assert.ok(t.running && t.alarmFor && /^\d{1,2}:\d\d (AM|PM)$/.test(t.alarmFor), a + ': ' + JSON.stringify(t));
    assert.ok(t.duration > 0 && t.duration <= 24 * 3600000, a);
    assert.match(s.said[0], /^Alarm set for \d{1,2}:\d\d (AM|PM)\. It rings in this page while the page stays open\.$/);
  }
  assert.ok(!timer.match('alarm at 7am'), 'the page asks the timer at its own place, after the skills');
});

test('an alarm never takes over a timer that is already on the stage, and a timer set on an alarm is a timer again', () => {
  const s = stage();
  ask('set a timer for 5 minutes', 'set a timer for 5 minutes', s.api);
  ask('alarm at 7am', 'alarm at 7am', s.api);
  const ts = Object.values(s.things);
  assert.equal(ts.length, 2);
  assert.equal(ts[0].duration, 300000, 'the 5 minute timer is as it was');
  assert.ok(!ts[0].alarmFor && ts[1].alarmFor);
  ask('2 minutes', '2 minutes', s.api); // the alarm is the picked one
  assert.ok(!ts[1].alarmFor && !ts[1].label && ts[1].duration === 120000);
});
