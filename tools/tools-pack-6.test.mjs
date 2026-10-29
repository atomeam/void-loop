// Tools pack 6 (owner's list 121 to 150, 2026-10-18): writing aids, health and habits, template lists. Pure logic only; the browser
// section "tools pack 6" in test_void.mjs plays them on the stage.
// Run: node --test tools/tools-pack-6.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as W from '../void-live-deploy/lib/writing-aids.js';
import * as H from '../void-live-deploy/lib/health-habits.js';
import * as T from '../void-live-deploy/lib/template-list.js';
import writingAids from '../void-live-deploy/skills/writing-aids.js';
import healthHabits from '../void-live-deploy/skills/health-habits.js';
import templateList from '../void-live-deploy/skills/template-list.js';

// ---- writing aids ----
test('writing aids: asks it takes and the look-alikes it leaves', () => {
  const take = { 'shorten this: in order to go': 'shorten', 'Bulletize this paragraph: a. b.': 'bullets', 'numbered steps from: first x then y': 'steps', 'sentence case: HELLO': 'sentence',
    'remove filler words: um so yes': 'filler', 'count unique words: a b a': 'unique', 'reading level of: some words go here ok': 'level', 'outline from headings: # A ## B': 'outline',
    'reverse outline: One. Two.': 'reverse', 'suggest synonyms for the words in: big and good': 'synonyms', 'turn this into bullet points: a. b.': 'bullets', 'make this shorter: very long words here': 'shorten' };
  for (const [a, mode] of Object.entries(take)) assert.equal(W.parseWritingAsk(a)?.mode, mode, a);
  assert.deepEqual(W.parseWritingAsk('writing aids'), { mode: 'shorten', text: '' });
  for (const a of ['shorten my commute', 'how do I shorten a url', 'how many unique words are in english', 'what is a reading level', 'bullet journal ideas', 'title case: hello', 'synonym for happy', 'add milk to my list', 'shorten']) assert.equal(W.parseWritingAsk(a), null, a);
  // a pasted paragraph arrives with " ⏎ " for each line break
  assert.equal(W.parseWritingAsk('outline from headings: # A ⏎ ## B').text, '# A\n## B');
});

test('writing aids: shorten swaps wordy phrases and drops filler', () => {
  const r = W.shorten('In order to finish, I basically just need to check it due to the fact that it matters.');
  assert.equal(r.text, 'To finish, I need to check it because it matters.');
  assert.ok(r.after < r.before);
  assert.equal(W.shorten('Short and clear.').text, 'Short and clear.');
});

test('writing aids: filler words come out of the list and nothing else', () => {
  const r = W.removeFiller('Well, um, it was actually very good, you know.');
  assert.equal(r.text, 'It was good.');
  assert.deepEqual(r.removed, ['well', 'um', 'actually', 'very', 'you know']);
  assert.equal(W.removeFiller('I like the justice of it.').text, 'I like the justice of it.'); // "just" inside a word stays
  assert.equal(W.removeFiller('Nothing here.').removed.length, 0);
});

test('writing aids: bullets and numbered steps', () => {
  assert.equal(W.bulletize('We met on Monday. The plan changed. Budget is approved.'), '- We met on Monday\n- The plan changed\n- Budget is approved');
  assert.equal(W.bulletize('Buy milk; call mum; fix the bike'), '- Buy milk\n- Call mum\n- Fix the bike');
  assert.equal(W.bulletize('Pack: socks, shoes, a hat and a coat'), '- Socks\n- Shoes\n- A hat and a coat');
  assert.equal(W.numberSteps('First open the box, then remove the foam, and finally plug it in.'), '1. Open the box\n2. Remove the foam\n3. Plug it in');
  assert.equal(W.numberSteps('Mix the flour. Add water. Knead for ten minutes.'), '1. Mix the flour\n2. Add water\n3. Knead for ten minutes');
});

test('writing aids: sentence case and title case', () => {
  assert.equal(W.sentenceCase('HELLO THERE FRIEND. HOW ARE YOU'), 'Hello there friend. How are you');
  assert.equal(W.sentenceCase('The Quick Brown Fox. i like NASA and the iPhone'), 'The quick brown fox. I like NASA and the iPhone');
  assert.equal(W.titleCase('the lord of the rings'), 'The Lord of the Rings');
});

test('writing aids: unique words and reading level', () => {
  const u = W.uniqueWords('The cat and the dog and the bird');
  assert.deepEqual([u.total, u.unique, u.share], [8, 5, 63]);
  assert.deepEqual(u.top, [['the', 3], ['and', 2]]);
  assert.deepEqual(W.uniqueWords(''), { total: 0, unique: 0, share: 0, top: [] });
  const easy = W.readingLevel('The cat sat on the mat. It was a sunny day. The dog ran.');
  const hard = W.readingLevel('Notwithstanding considerable organizational complexity, institutional stakeholders systematically operationalized comprehensive interdepartmental methodologies.');
  assert.ok(easy.ease > 80 && hard.ease < 20 && hard.grade > easy.grade, JSON.stringify({ easy, hard }));
  assert.equal(W.readingLevel('too short'), null);
});

test('writing aids: outlines both ways', () => {
  assert.equal(W.outlineFromHeadings('# Intro\n## Why\n## How\n### Detail\n# End'), '1 Intro\n  1.1 Why\n  1.2 How\n    1.2.1 Detail\n2 End');
  assert.equal(W.outlineFromHeadings('1. Plan\n1.1 Scope\n2. Ship'), '1 Plan\n  1.1 Scope\n2 Ship');
  assert.equal(W.outlineFromHeadings('# A ## B'), '1 A\n  1.1 B'); // inline headings split
  assert.equal(W.outlineFromHeadings('just a sentence'), '');
  assert.equal(W.reverseOutline('First idea is here. More detail follows it.\n\nSecond paragraph begins now. Other.'), '1. First idea is here\n2. Second paragraph begins now');
  assert.match(W.reverseOutline('One two three four five six seven eight nine ten eleven twelve thirteen fourteen. Next.'), /twelve…/);
});

test('writing aids: synonyms come from the local list, each word once', () => {
  assert.deepEqual(W.synonymsIn('A very good idea, a very big idea').map((x) => x.word), ['very', 'good', 'idea', 'big']);
  assert.deepEqual(W.synonymsIn('zzz qqq'), []);
});

test('writing aids: transform handles empty text, every mode and the size cap', () => {
  assert.match(W.transform('shorten', '   ').note, /Type or paste/);
  for (const m of W.MODES) assert.equal(typeof W.transform(m, 'The cat sat on the mat. It was a very good day. # Head').out, 'string', m);
  assert.ok(W.transform('shorten', 'a '.repeat(10000)).out.length <= W.MAX_TEXT);
});

// ---- health and habits ----
test('health: asks it takes and the look-alikes it leaves', () => {
  const take = { 'water tracker': 'water', 'water cups tracker 10 cups': 'water', 'track my water': 'water', 'stretch timer': 'stretch', 'stretch timer 20 seconds': 'stretch', 'mood tracker': 'mood', 'log my mood': 'mood',
    'sleep hours log': 'sleep', 'step note': 'steps', 'meds checklist: vitamin D, iron': 'meds', 'meds checkbox for the day': 'meds', 'weekly habit grid for read, run, stretch': 'habitgrid',
    'habit streak tracker': 'habitgrid', 'fasting timer 16:8': 'fasting', 'fasting window timer': 'fasting', 'posture nudge every 30 minutes': 'posture', 'posture break nudge': 'posture' };
  for (const [a, type] of Object.entries(take)) assert.equal(H.parseHealthAsk(a)?.type, type, a);
  for (const a of ['water the plants', 'what is the water cycle', 'sleep calculator', 'how much sleep do I need', 'what is a mood board', 'habit ring for write, walk, sleep', 'how to start fasting', 'stretch goals for my team', 'set a timer for 5 minutes', 'my steps today were tiring'])
    assert.equal(H.parseHealthAsk(a), null, a);
});

test('health: ask details', () => {
  assert.equal(H.parseHealthAsk('water cups tracker 10 cups').goal, 10);
  assert.equal(H.parseHealthAsk('water tracker').goal, 8);
  assert.equal(H.parseHealthAsk('stretch timer 20 seconds').secs, 20);
  assert.equal(H.parseHealthAsk('fasting timer 18:6').hours, 18);
  assert.equal(H.parseHealthAsk('fasting window 14 hours').hours, 14);
  assert.equal(H.parseHealthAsk('fasting timer').hours, 16);
  assert.equal(H.parseHealthAsk('posture nudge every 45 minutes').everySec, 2700);
  assert.equal(H.parseHealthAsk('posture nudge every 5 seconds').everySec, 5);
  assert.equal(H.parseHealthAsk('posture nudge').on, false); // opt-in: it starts off
  assert.deepEqual(H.parseHealthAsk('weekly habit grid for read, run and stretch').habits.map((h) => h.name), ['read', 'run', 'stretch']);
  assert.deepEqual(H.parseHealthAsk('meds checklist: vitamin D, iron').items.map((m) => m.text), ['vitamin D', 'iron']);
});

test('health: cups fill up to the tapped one and the top one empties', () => {
  assert.equal(H.tapCup(0, 2, 8), 3);
  assert.equal(H.tapCup(3, 2, 8), 2); // the top filled cup again
  assert.equal(H.tapCup(3, 0, 8), 1);
  assert.equal(H.tapCup(undefined, 7, 8), 8);
  assert.equal(H.tapCup(99, 3, 8), 4); // junk is clamped, never throws
});

test('health: days, streaks and averages', () => {
  assert.deepEqual(H.lastDays('2026-03-02', 3), ['2026-02-28', '2026-03-01', '2026-03-02']);
  assert.equal(H.weekdayOf('2026-10-18'), 'Su');
  assert.equal(H.streakOf(['2026-10-16', '2026-10-17', '2026-10-18'], '2026-10-18'), 3);
  assert.equal(H.streakOf(['2026-10-16', '2026-10-17'], '2026-10-18'), 2); // today still open
  assert.equal(H.streakOf(['2026-10-15'], '2026-10-18'), 0);
  assert.deepEqual(H.toggleDay(['2026-10-17'], '2026-10-18'), ['2026-10-17', '2026-10-18']);
  assert.deepEqual(H.toggleDay(['2026-10-17'], '2026-10-17'), []);
  assert.equal(H.weekAverage({ '2026-10-18': 7, '2026-10-17': 8, '2026-10-01': 1 }, '2026-10-18'), 7.5);
  assert.equal(H.weekAverage({}, '2026-10-18'), null);
  assert.equal(H.clampNum('30', 0, 24), 24);
  assert.equal(H.clampNum('abc', 0, 24), null);
  assert.equal(H.clampNum('', 0, 24), null);
  const big = {}; for (let i = 0; i < 300; i++) big['2025-' + String(Math.floor(i / 28) + 1).padStart(2, '0') + '-' + String(i % 28 + 1).padStart(2, '0')] = i;
  assert.equal(Object.keys(H.prune(big)).length, H.KEEP_DAYS);
});

test('health: fasting window, stretch routine and nudge arithmetic', () => {
  const s = H.fastState(1000, 1000 + 8 * 3600000, 16);
  assert.deepEqual([s.pct, s.done, H.clock(s.remaining)], [50, false, '8:00:00']);
  assert.equal(H.fastState(1000, 1000 + 17 * 3600000, 16).done, true);
  assert.equal(H.fastState(0, 5, 16), null);
  assert.equal(H.clock(65000), '1:05');
  const plan = H.stretchPlan(30);
  assert.equal(plan.length, H.STRETCHES.length);
  assert.deepEqual(H.stretchAt(plan, 0), { index: 0, left: 30, done: false });
  assert.deepEqual(H.stretchAt(plan, 31), { index: 1, left: 29, done: false });
  assert.equal(H.stretchAt(plan, 30 * plan.length).done, true);
  assert.equal(H.stretchPlan(1)[0].secs, 5); // clamped
  assert.equal(H.nudgeDue(0, 99), false);
  assert.equal(H.nudgeDue(100, 99), false);
  assert.equal(H.nudgeDue(100, 100), true);
});

// ---- template lists ----
test('template lists: asks it takes and the look-alikes it leaves', () => {
  const take = { 'packing list for a beach trip': 'packing', 'packing list template': 'packing', 'travel checklist for Tokyo': 'travel', 'meal idea slots': 'meals', 'chore wheel': 'chores',
    'chore wheel for dishes, trash and laundry with Sam and Alex': 'chores', 'bill due list': 'bills', 'bills due list: rent 2026-11-01': 'bills', 'warranty expiry note: laptop 2027-03-01': 'warranty',
    'plant watering: fern every 7 days': 'plants', 'package tracking note: headphones arriving friday': 'package', 'guest list for the party: Sam, Alex, Jo': 'guests', 'make a guest list': 'guests' };
  for (const [a, tpl] of Object.entries(take)) assert.equal(T.parseTemplateAsk(a, '2026-10-18')?.tpl, tpl === 'meals' ? 'meal' : tpl, a);
  for (const a of ['track my package', 'what is a warranty', 'how often should I water a cactus', 'add milk to my list', 'who should I invite to my wedding', 'packing tips for flying', 'pay my bills', 'packing list with socks, shoes'])
    assert.equal(T.parseTemplateAsk(a, '2026-10-18'), null, a);
});

test('template lists: seeds and templates', () => {
  const beach = T.parseTemplateAsk('packing list for a beach trip', '2026-10-18');
  assert.equal(beach.title, 'beach trip');
  assert.ok(beach.items.some((i) => i.text === 'Sunscreen') && beach.items.length > T.PACKING_BASE.length);
  assert.equal(T.packingItems('city break').length, T.PACKING_BASE.length);
  const chores = T.parseTemplateAsk('chore wheel for dishes, trash and laundry with Sam and Alex', '2026-10-18');
  assert.deepEqual([chores.items.map((i) => i.text), chores.people, chores.offset], [['dishes', 'trash', 'laundry'], ['Sam', 'Alex'], 0]);
  assert.deepEqual(T.parseTemplateAsk('chore wheel', '2026-10-18').people, ['Me', 'You']);
  const bills = T.parseTemplateAsk('bills due list: rent 2026-11-01, internet nov 15, phone the 25th', '2026-10-18');
  assert.deepEqual(bills.items.map((i) => [i.text, i.date]), [['rent', '2026-11-01'], ['internet', '2026-11-15'], ['phone', '2026-10-25']]);
  const plants = T.parseTemplateAsk('plant watering: fern every 7 days, cactus every 3 weeks, basil daily', '2026-10-18');
  assert.deepEqual(plants.items.map((i) => [i.text, i.every]), [['fern', 7], ['cactus', 21], ['basil', 1]]);
  const guests = T.parseTemplateAsk('guest list for the party: Sam, Alex and Jo', '2026-10-18');
  assert.deepEqual([guests.title, guests.items.map((i) => i.text)], ['party', ['Sam', 'Alex', 'Jo']]);
  assert.equal(T.parseTemplateAsk('bill due list', '2026-10-18').items.length, 0);
});

test('template lists: dates', () => {
  const today = '2026-10-18'; // a Sunday
  assert.equal(T.findDate('rent 2026-11-01', today).day, '2026-11-01');
  assert.equal(T.findDate('mar 4 2028', today).day, '2028-03-04');
  assert.equal(T.findDate('4th of march', today).day, '2027-03-04'); // the next one
  assert.equal(T.findDate('arriving friday', today).day, '2026-10-23');
  assert.equal(T.findDate('arriving sunday', today).day, '2026-10-25'); // a week from today, not today
  assert.equal(T.findDate('tomorrow', today).day, '2026-10-19');
  assert.equal(T.findDate('the 5th', today).day, '2026-11-05');
  assert.equal(T.findDate('the 25th', today).day, '2026-10-25');
  assert.equal(T.findDate('feb 30', today), null);
  assert.equal(T.findDate('no date here', today), null);
  assert.equal(T.daysUntil('2026-10-21', today), 3);
  assert.equal(T.addDays('2026-02-27', 3), '2026-03-02');
  assert.deepEqual([T.dueLabel(0), T.dueLabel(1), T.dueLabel(5), T.dueLabel(-1), T.dueLabel(-3), T.dueLabel(-3, 'expired'), T.dueLabel(-1, 'expired')], ['today', 'tomorrow', 'in 5 days', '1 day overdue', '3 days overdue', 'expired 3 days ago', 'expired yesterday']);
  const sorted = T.sortDated([{ text: 'b', date: '2026-12-01' }, { text: 'none' }, { text: 'a', date: '2026-11-01' }, { text: 'paid', date: '2026-10-01', done: true }]);
  assert.deepEqual(sorted.map((i) => i.text), ['a', 'b', 'none', 'paid']);
});

test('template lists: plants, the chore wheel and the guest list', () => {
  const today = '2026-10-18';
  assert.deepEqual(T.plantDue({ every: 7, last: '' }, today), { next: today, days: 0 }); // never watered: due now
  assert.deepEqual(T.plantDue({ every: 7, last: '2026-10-15' }, today), { next: '2026-10-22', days: 4 });
  assert.equal(T.plantDue({ every: 7, last: '2026-10-01' }, today).days, -10);
  assert.equal(T.plantDue({ every: 'x', last: today }, today).next, '2026-10-25'); // junk falls back to a week
  assert.deepEqual([T.everyDays('every 3 weeks'), T.everyDays('weekly'), T.everyDays('every other day'), T.everyDays('whenever')], [21, 7, 2, 0]);
  const people = ['Sam', 'Alex', 'Jo'];
  assert.deepEqual([0, 1, 2, 3].map((i) => T.assignee(people, 0, i)), ['Sam', 'Alex', 'Jo', 'Sam']);
  assert.deepEqual([0, 1, 2].map((i) => T.assignee(people, 1, i)), ['Alex', 'Jo', 'Sam']);
  assert.equal(T.assignee([], 3, 0), '');
  assert.deepEqual(['', 'yes', 'maybe', 'no', ''].map((s, i, a) => T.rsvpNext(s)), ['yes', 'maybe', 'no', '', 'yes']);
  assert.deepEqual(T.rsvpCounts([{ rsvp: 'yes', plus: 2 }, { rsvp: 'yes' }, { rsvp: 'maybe' }, { rsvp: 'no' }, {}, { rsvp: 'bogus' }]), { yes: 2, maybe: 1, no: 1, waiting: 2, heads: 4 });
  assert.equal(T.mealIdea('Dinner', 0), T.MEAL_IDEAS.Dinner[0]);
  assert.equal(T.mealIdea('Dinner', 0.99999), T.MEAL_IDEAS.Dinner[7]);
  assert.notEqual(T.mealIdea('Lunch', 0, T.MEAL_IDEAS.Lunch[0]), T.MEAL_IDEAS.Lunch[0]);
});

// ---- the shared stage helpers (lib/stage-pack.js, the same file stage pack A ships) ----
import { escHtml, localDay, tidy } from '../void-live-deploy/lib/stage-pack.js';
test('stage helpers: escape, local day, tidy', () => {
  assert.equal(escHtml('<b a="1">&\'</b>'), '&lt;b a=&quot;1&quot;&gt;&amp;&#39;&lt;/b&gt;');
  assert.equal(localDay(new Date(2026, 0, 5)), '2026-01-05');
  assert.equal(tidy('  Hello   World!! '), 'Hello World');
});

// ---- the three skills as the router sees them ----
test('the three skills take their own examples and none of the near misses', () => {
  for (const s of [writingAids, healthHabits, templateList]) {
    for (const e of s.examples) assert.ok(s.match(e.toLowerCase(), e), s.name + ' takes: ' + e);
    for (const n of s.nearMisses) assert.ok(!s.match(n.toLowerCase(), n), s.name + ' leaves: ' + n);
  }
  // and no skill's examples are taken by a sibling in this pack
  for (const [a, b] of [[writingAids, healthHabits], [writingAids, templateList], [healthHabits, templateList]]) {
    for (const e of a.examples) assert.ok(!b.match(e.toLowerCase(), e), b.name + ' must not take ' + e);
    for (const e of b.examples) assert.ok(!a.match(e.toLowerCase(), e), a.name + ' must not take ' + e);
  }
});
