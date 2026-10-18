// Summon by intent (frontier #10): an outcome with a deadline becomes a build order of asks Verse already answers.
import test from 'node:test';
import assert from 'node:assert/strict';
import skill, { intentOf, deadlineOf, stepsFor, planOf, openPlanOf, planWords } from '../void-live-deploy/skills/intent.js';
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

test('the plan is asks Verse already answers, a draft only when someone is named', () => {
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

test('a goal said as a noun ("the product page launch on Friday") plans the same way, the verb in front', () => {
  assert.deepEqual(intentOf('the product page launch on Friday'), { goal: 'launch the product page', when: 'friday', who: null });
  assert.deepEqual(intentOf("Our newsletter launch is next Tuesday, let Sam know"), { goal: 'launch our newsletter', when: 'next tuesday', who: 'sam' });
  assert.equal(intentOf('my essay is due October 20').goal, 'hand in my essay');
  assert.equal(intentOf('my history report is due by the 20th').when, 'the 20th');
  assert.equal(intentOf('the pitch to investors is on Thursday').goal, 'give the pitch to investors');
  assert.equal(intentOf('my biology exam in 2 weeks').goal, 'be ready for my biology exam');
  assert.equal(intentOf("our team's offsite is next week").goal, "our team's offsite");
  const p = planOf('the product page launch on Friday', FRI);
  assert.deepEqual(p.asks.map((a) => a.piece), ['countdown', 'checklist', 'calendar']);
  assert.match(p.asks[1].ask, /^make a list with outline it \(fri 9\), .*, launch the product page \(fri 16\)$/); // a launch's own steps
  assert.match(planOf('my essay is due October 20', FRI).asks[1].ask, /^make a list with outline \(fri 9\), first draft/);
});

test('a noun with a date is a goal only when it names an outcome: the weather, a birthday or a question stay with their skills', () => {
  for (const q of ['the weather on Friday', 'my birthday on Friday', 'the moon on Friday', 'my dentist appointment on Friday', 'is my essay due Friday',
    'when is the product launch on Friday', 'the launch', 'my essay', 'what is the exam on friday about', 'the exam was on Friday']) {
    assert.equal(planOf(q, FRI), null, q);
  }
});

// frontier #10, next: an outcome with no day, asked for as a plan ("make a plan to ship the product page", "plan my move"), gets
// the same steps as an undated checklist and a hint to add a day; "I need to finish my essay" (no plan asked, no day) stays alone
test('a plan asked for without a day: the steps as an undated checklist, and how to add a day', () => {
  const p = planOf('make a plan to ship the product page', FRI);
  assert.equal(p.deadline, null); assert.equal(p.goal, 'ship the product page');
  assert.deepEqual(p.asks.map((a) => a.piece), ['checklist']);
  assert.equal(p.asks[0].ask, 'make a list with outline it, build the first version, review it, fix what the review found, ship the product page');
  assert.equal(planOf('plan my move', FRI).goal, 'move');
  assert.equal(planOf('plan our wedding', FRI).goal, 'our wedding');
  assert.equal(planOf('give me a plan for my biology exam', FRI).goal, 'be ready for my biology exam');
  assert.equal(planOf('help me plan the product launch', FRI).goal, 'launch the product');
  const told = planOf('make a plan to finish my essay and tell Maya', FRI);
  assert.deepEqual(told.asks.map((a) => a.piece), ['checklist', 'draft']); assert.match(told.asks[1].ask, /draft to Maya \(not sent\)/);
  assert.equal(planOf('make a plan to ship the product page by Friday', FRI).asks.length, 3, 'with a day it is the dated plan');
  for (const q of ['I need to finish my essay', 'I need to ship', 'plan', 'make a plan', 'plan my day', 'plan a route to the airport', 'make a plan to lose weight', 'what is a business plan', 'meal plan for the week'])
    assert.equal(planOf(q, FRI), null, q);
});

test('no step says "and": the list ask splits on it, so a step would come out as two items', () => {
  for (const goal of ['ship it', 'write the report', 'give the talk', 'be ready for the exam', 'move', 'plan the party', 'do the thing'])
    for (const s of stepsFor(goal, new Date(2026, 9, 20), FRI)) if (s.text !== goal) assert.ok(!/\band\b/.test(s.text), goal + ': ' + s.text);
});

// the ways people ask for a plan (probed 2026-10-14, 14 of 20 went to an article): each reads as the plan it means
test('plan asks said other ways: "i need a plan to", "create a study plan for", "X, make me a plan", "plan a party" plan the same way', () => {
  const open = (a) => (openPlanOf(a) || {}).goal;
  assert.equal(open('i need a plan to learn japanese'), 'learn japanese');
  assert.equal(open("what's a good plan to learn italian"), 'learn italian');
  assert.equal(open('come up with a plan to learn photography'), 'learn photography');
  assert.equal(open('give me a step by step plan to learn chess'), 'learn chess');
  assert.equal(open('i want to learn piano, make me a plan'), 'learn piano');
  assert.equal(open('plan for learning to code'), 'learn to code');
  assert.equal(open('a plan to learn to draw'), 'learn to draw');
  assert.equal(open('make a practice plan for guitar'), 'practise guitar');
  assert.equal(open('make a plan for learning the violin'), 'learn the violin');
  assert.equal(planOf('create a study plan for my chemistry exam').goal, 'be ready for my chemistry exam');
  assert.equal(planOf('help me plan a road trip').goal, 'my road trip');
  assert.equal(planWords('plan a birthday party'), 'plan my birthday party');
  // still left alone: no plan asked for, a day's plan, and fitness (health stays off the engine)
  for (const a of ['i plan to go to bed', 'plan my day', 'what is the plan for today', 'write me a plan to start running', 'i need a plan to lose weight', 'what is a plan'])
    assert.ok(!openPlanOf(a) && !planOf(a), a);
});

// Plan history (asked by Verse): the last few distinct plans this browser made, listed and restored, so a wipe is never total.
import { historyAskOf, withPlanKept, restoredThings, PLANS_MAX } from '../void-live-deploy/skills/intent.js';
test('plan history: the asks, the kept list (one per goal, newest first, five at most) and a restore with fresh ids', () => {
  assert.deepEqual(historyAskOf('plan history'), { kind: 'list' }); assert.deepEqual(historyAskOf('show me my plans'), { kind: 'list' }); assert.deepEqual(historyAskOf('my past plans'), { kind: 'list' });
  assert.deepEqual(historyAskOf('restore the last plan'), { kind: 'restore', n: 1 }); assert.deepEqual(historyAskOf('restore plan 2'), { kind: 'restore', n: 2 });
  assert.deepEqual(historyAskOf('bring back my plan to learn spanish'), { kind: 'restore', goal: 'learn spanish' });
  for (const a of ['plan my move', 'history of rome', 'restore factory settings', 'my plans for the weekend are', 'restore']) assert.equal(historyAskOf(a), null, a);
  assert.ok(skill.match('plan history', 'plan history') && skill.examples.includes('plan history'));
  const e = (goal, at) => ({ goal, at, pieces: ['list'], things: [{ id: 'list_1', kind: 'list', x: 24, y: 56 }] });
  let L = []; for (const g of ['a', 'b', 'c', 'd', 'e', 'f']) L = withPlanKept(L, e(g, g));
  assert.deepEqual(L.map((p) => p.goal), ['f', 'e', 'd', 'c', 'b']); assert.equal(L.length, PLANS_MAX);
  L = withPlanKept(L, e('d', 'again')); assert.deepEqual(L.map((p) => p.goal), ['d', 'f', 'e', 'c', 'b']); assert.equal(L[0].at, 'again');
  const r = restoredThings({ goal: 'x', things: [{ id: 'list_1', kind: 'list', x: 24, y: 56, group: 'old' }, { id: 'timer_1', kind: 'timer', x: 300, y: 56, group: 'old' }] });
  assert.equal(r.length, 2); assert.notEqual(r[0].id, 'list_1'); assert.equal(r[0].group, r[1].group); assert.notEqual(r[0].group, 'old'); assert.equal(r[0].x, 24); assert.equal(r[1].kind, 'timer');
  assert.deepEqual(restoredThings(null), []);
});
