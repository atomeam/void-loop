// Summon by intent (frontier #10): an outcome with a deadline becomes a build order of asks Void already answers.
import test from 'node:test';
import assert from 'node:assert/strict';
import skill, { intentOf, deadlineOf, stepsFor, planOf } from '../void-live-deploy/skills/intent.js';
import countdown from '../void-live-deploy/skills/countdown.js';

const FRI = new Date(2026, 9, 9); // Friday, October 9 2026
const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

test('reads the goal, the day and who to tell', () => {
  assert.deepEqual(intentOf('I need to ship the product page by Friday'), { goal: 'ship the product page', when: 'friday', who: null });
  assert.deepEqual(intentOf("I've got to study for the exam by the 20th, and let Maya know"), { goal: 'study for the exam', when: 'the 20th', who: 'maya' });
  assert.equal(intentOf('we need to move house in 2 weeks').when, 'in 2 weeks');
  assert.equal(intentOf('I need to prepare a talk by next week and tell everyone').who, null); // not a person
});

test('leaves other skills and plain wants alone', () => {
  for (const q of ['I need to wake up at 6 am, what time should I go to bed?', 'days until friday', 'I need to ship', 'I need to finish my essay',
    'how do I ship a product by friday', 'i need a timer for 5 minutes', 'call Sam next Tuesday at 4', 'remind me at 5 to call home',
    'i have an 85 and my final is worth 20% what do i need to get a 90', 'I need to set a reminder for tomorrow']) {
    assert.equal(planOf(q, FRI), null, q);
    assert.equal(skill.match(q.toLowerCase(), q), false, q);
  }
});

test('deadlines land on or after today', () => {
  assert.equal(iso(deadlineOf('friday', FRI)), '2026-10-16'); // said on a Friday: next week's, as the calendar reads it
  assert.equal(iso(deadlineOf('monday', FRI)), '2026-10-12');
  assert.equal(iso(deadlineOf('tomorrow', FRI)), '2026-10-10');
  assert.equal(iso(deadlineOf('today', FRI)), '2026-10-09');
  assert.equal(iso(deadlineOf('in 2 weeks', FRI)), '2026-10-23');
  assert.equal(iso(deadlineOf('in three days', FRI)), '2026-10-12');
  assert.equal(iso(deadlineOf('the end of the month', FRI)), '2026-10-31');
  assert.equal(iso(deadlineOf('end of the week', FRI)), '2026-10-09');
  assert.equal(iso(deadlineOf('october 20', FRI)), '2026-10-20');
  assert.equal(iso(deadlineOf('20th of october', FRI)), '2026-10-20');
  assert.equal(iso(deadlineOf('march 3', FRI)), '2027-03-03'); // already past this year
  assert.equal(iso(deadlineOf('the 5th', FRI)), '2026-11-05');
  assert.equal(deadlineOf('february 31', FRI), null);
});

test('steps are worked back from the day, the goal last on it', () => {
  const s = stepsFor('ship the product page', new Date(2026, 9, 16), FRI);
  assert.equal(s.length, 5);
  assert.equal(s[s.length - 1].text, 'ship the product page');
  assert.equal(iso(s[s.length - 1].date), '2026-10-16');
  assert.equal(iso(s[0].date), '2026-10-09');
  for (let i = 1; i < s.length; i++) assert.ok(s[i].date >= s[i - 1].date, 'in order');
  const tight = stepsFor('fix the bug', FRI, FRI); // due today: everything today
  assert.ok(tight.every((x) => iso(x.date) === '2026-10-09'));
});

test('the plan is asks Void already answers, a draft only when someone is named', () => {
  const p = planOf('I need to prepare a talk by next week and tell Sam', FRI);
  assert.deepEqual(p.asks.map((a) => a.piece), ['countdown', 'checklist', 'calendar', 'draft']);
  assert.equal(p.asks[0].ask, 'days until prepare a talk on october 16');
  assert.ok(countdown.countdownOf(p.asks[0].ask), 'the countdown skill takes its ask');
  assert.match(p.asks[1].ask, /^make a list with outline the story \(fri 9\), .*, prepare a talk \(fri 16\)$/);
  assert.equal(p.asks[2].ask, 'add prepare a talk to my calendar on october 16');
  assert.match(p.asks[3].ask, /^add a sticky that says draft to Sam \(not sent\): heads up, I'm aiming to prepare a talk by Fri Oct 16$/);
  assert.equal(planOf('I need to ship the product page by Friday', FRI).asks.length, 3);
});

test('a goal the countdown cannot label still gets a countdown it takes', () => {
  const p = planOf('I need to ship v2.0 of the app-store listing for the big launch event downtown by Friday', FRI);
  assert.ok(countdown.countdownOf(p.asks[0].ask), p.asks[0].ask);
  assert.ok(!/,/.test(p.asks[1].ask.replace(/ \([a-z]{3} \d+\), /g, '|')), 'no stray commas split a step');
});
