// The timer's parsing (skills/timer.js, moved out of void.html in cleanup step 6): lengths, alarms, and the plain asks
// the skill takes before the page. Run: node --test tools/timer.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDuration, alarmMs, isDurationRequest, wantsCreate, plainTimer, durationLabel, unitlessAmount, hourglassOn } from '../void-live-deploy/skills/timer.js';
import timer from '../void-live-deploy/skills/timer.js';

test('timer: lengths in words and numbers, together, and a bare number of minutes', () => {
  assert.equal(parseDuration('set a timer for 5 minutes'), 300000);
  assert.equal(parseDuration('1 hour 30 minutes'), 5400000);
  assert.equal(parseDuration('half an hour'), 1800000);
  assert.equal(parseDuration('ten seconds'), 10000);
  assert.equal(parseDuration('timer 12'), 720000);
  assert.equal(parseDuration('make a timer'), 0);
});

test('timer: an alarm rings at the next such time, and a length alone is a timer ask', () => {
  const now = new Date(2026, 9, 12, 6, 0, 0);
  assert.equal(alarmMs('set an alarm for 7am', now), 3600000);
  assert.equal(alarmMs('wake me up at 6:30', now), 1800000);
  assert.equal(alarmMs('set an alarm for 25am', now), 0);
  assert.ok(isDurationRequest('5 minutes') && isDurationRequest('start 1 hour 30 min') && !isDurationRequest('5 minutes ago i ate'));
  assert.ok(wantsCreate('remind me to stretch in 20 minutes') && !wantsCreate('pause the timer') && !wantsCreate('remove the timer'));
});

test('timer: the skill takes only plain timer asks before the page (alarms, reminders and pausing go on as before)', () => {
  for (const a of ['timer', 'set a timer for 5 minutes', 'a 2 second timer', 'start a 10 minute countdown', 'give me a timer']) assert.ok(plainTimer(a), a);
  for (const a of ['set an alarm for 7am', 'remind me to stretch in 20 minutes', 'pause the timer', 'connect the timer to the note', 'how many days until christmas']) assert.ok(!plainTimer(a), a);
});

test('timer: other languages\' timer asks are the English ask (exam: "temporizador de 3 minutos")', async () => {
  const { timerEnglish } = await import('../void-live-deploy/skills/timer.js');
  assert.equal(wantsCreate('temporizador de 3 minutos'), true);
  assert.equal(parseDuration('temporizador de 3 minutos'), 180000);
  assert.equal(parseDuration('pon un temporizador de 5 minutos'), 300000);
  assert.equal(parseDuration('minuteur de 10 minutes'), 600000);
  assert.equal(timerEnglish('set the timer due in 3 minutes'), 'set the timer due in 3 minutes');
  assert.equal(wantsCreate('dessine un cercle rouge'), false);
});

test('timer: the set length stays in the card text after the countdown ticks (exam tokens)', () => {
  assert.equal(durationLabel(90000), 'Countdown set for 1:30 · 90 seconds');
  assert.equal(durationLabel(45000), 'Countdown set for 0:45 · 45 seconds');
  assert.equal(durationLabel(2000), 'Countdown set for 0:02 · 2 seconds');
  assert.equal(durationLabel(180000), 'Countdown set for 3:00 · 180 seconds');
  assert.equal(durationLabel(300000), 'Countdown set for 5:00 · 300 seconds');
  assert.ok(('1:27\nrunning\n' + durationLabel(90000)).length > 40);
});

test('timer: "timer for 5" asks minutes or seconds instead of starting five minutes', () => {
  assert.equal(unitlessAmount('timer for 5'), '5');
  assert.equal(unitlessAmount('set a timer for five'), 'five');
  assert.equal(unitlessAmount('set a timer for 90 seconds'), '');
  assert.equal(unitlessAmount('a 2 second timer'), '');
  assert.equal(wantsCreate('timer for 5'), false);
  assert.equal(plainTimer('timer for 5'), false);
  assert.equal(timer.match('timer for 5', 'timer for 5'), true);
  assert.equal(timer.match('set a timer for 90 seconds', 'set a timer for 90 seconds'), true);
});

test('timer: the hourglass stays off a phone so the 45-second card does not stick out', () => {
  assert.equal(hourglassOn({ clientWidth: 390 }), false);
  assert.equal(hourglassOn({ clientWidth: 800 }), true);
  assert.equal(hourglassOn(null), true);
});

test('timer: "add one minute" grows the timer and the answer names its new length (exam: 90 s + 1 min = 2:30)', async () => {
  const { addMs, askAction } = await import('../void-live-deploy/skills/timer.js');
  assert.equal(addMs('add one minute'), 60000);
  assert.equal(addMs('add 30 seconds to the timer'), 30000);
  assert.equal(addMs('extend it by 5 minutes'), 300000);
  assert.equal(addMs('add milk to the list'), 0);
  assert.equal(addMs('add a note'), 0);
  const things = { t1: { id: 't1', kind: 'timer', duration: 90000, remaining: 90000, running: true, startedAt: Date.now() } };
  let said = '';
  let picked = 's1'; // the sticky is the picked card, as on the stage after "sticky note buy milk" (watchdog #2324)
  things.s1 = { id: 's1', kind: 'sticky', text: 'buy milk' };
  const api = { things: () => things, selected: () => picked, select(id) { picked = id; }, save() {}, render() {}, say(s) { said = s; } };
  assert.equal(askAction('add one minute', 'add one minute', api), 'timer-add');
  assert.equal(things.t1.duration, 150000);
  assert.equal(picked, 't1', 'the timer the ask changed is the picked thing now');
  assert.match(said, /2:30/); assert.match(said, /150/);
  assert.match(durationLabel(things.t1.duration), /2:30/); assert.match(durationLabel(things.t1.duration), /150/);
  const none = { things: () => ({}), selected: () => null, save() {}, render() {}, say() {} };
  assert.equal(askAction('add one minute', 'add one minute', none), '');
});

test('timer: lengths said with halves and two parts (asked by Verse: "set a timer for 90 seconds" and increments)', async () => {
  const { plainHalves } = await import('../void-live-deploy/skills/timer.js');
  for (const [a, ms] of [['set a timer for 90 seconds', 90000], ['timer 90 sec', 90000], ['1 minute 30 seconds', 90000], ['1 minute and 30 seconds', 90000],
    ['a timer for 2 and a half minutes', 150000], ['two and a half minutes', 150000], ['set a timer for a minute and a half', 90000],
    ['set a timer for an hour and a half', 5400000], ['half a minute timer', 30000], ['set a timer for 1½ minutes', 90000], ['half an hour', 1800000]]) {
    assert.equal(parseDuration(a), ms, a);
    assert.equal(wantsCreate(a), true, a);
  }
  assert.ok(isDurationRequest('1 minute and 30 seconds') && isDurationRequest('two and a half minutes'));
  assert.equal(plainHalves('make a list'), 'make a list');
  assert.equal(durationLabel(parseDuration('a timer for 2 and a half minutes')), 'Countdown set for 2:30 · 150 seconds');
});

test('timer: "add 30 seconds" and "add a minute" grow the timer there, and never reset it to that length', async () => {
  const { addMs, askAction, ask } = await import('../void-live-deploy/skills/timer.js');
  for (const [a, ms] of [['add 30 seconds', 30000], ['add a minute', 60000], ['add 30 seconds to the timer', 30000], ['add a minute and a half', 90000],
    ['30 more seconds', 30000], ['give it 2 more minutes', 120000], ['add another 30 seconds', 30000]]) {
    assert.equal(addMs(a), ms, a);
    assert.equal(wantsCreate(a), false, a + ' is not a new timer');
  }
  assert.equal(addMs('add a 30 second timer'), 0, 'a new timer, not an increment');
  assert.equal(wantsCreate('add a 30 second timer'), true);
  const things = { t1: { id: 't1', kind: 'timer', duration: 90000, remaining: 90000, running: false, startedAt: 0 } };
  let picked = 't1', said = '';
  const api = { stage: { clientWidth: 800, clientHeight: 600 }, things: () => things, selected: () => picked, select(id) { picked = id; }, save() {}, render() {}, say(s) { said = s; } };
  assert.equal(ask('add 30 seconds to the timer', 'add 30 seconds to the timer', api), '', 'the create hook leaves it alone');
  assert.equal(askAction('add 30 seconds to the timer', 'add 30 seconds to the timer', api), 'timer-add');
  assert.equal(things.t1.duration, 120000);
  assert.equal(askAction('add a minute', 'add a minute', api), 'timer-add');
  assert.equal(things.t1.duration, 180000);
  assert.match(said, /3:00/);
  const empty = { things: () => ({}), selected: () => null, select() {}, save() {}, render() {}, say(s) { said = s; } };
  assert.equal(askAction('add 30 seconds to the timer', 'add 30 seconds to the timer', empty), 'no timer');
  assert.match(said, /set a timer for 30 seconds/);
});
