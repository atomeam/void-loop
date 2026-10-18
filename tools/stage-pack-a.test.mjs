// Stage pack A (owner, 2026-10-18): minimap, ask clipboard, decision matrix, habit ring, recipe stack. Pure logic only;
// the browser section "stage pack a" in test_void.mjs plays them on the stage.
// Run: node --test tools/stage-pack-a.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { minimapIntent, minimapDots } from '../void-live-deploy/skills/minimap.js';
import { clipboardIntent, clipboardAsks } from '../void-live-deploy/skills/ask-clipboard.js';
import { recentAsks, rememberAsk } from '../void-live-deploy/skills/recent.js';
import { parseDecision, totals, bestOf } from '../void-live-deploy/skills/decision-matrix.js';
import { marksSavedHabit, parseHabits, markOf, toggleDay, streakOf, weekCount, findHabit } from '../void-live-deploy/skills/habit-ring.js';
import { parseStep, parseRecipe, stepAt, elapsedOf, clock, unlockAudio, chime } from '../void-live-deploy/skills/recipe-stack.js';
import { escHtml, localDay } from '../void-live-deploy/lib/stage-pack.js';

test('minimap: asks it takes and the look-alikes it leaves', () => {
  for (const a of ['show the minimap', 'Show the mini map', 'minimap', 'open the minimap please']) assert.equal(minimapIntent(a), 'show', a);
  for (const a of ['hide the minimap', 'close the mini-map', 'turn off the minimap']) assert.equal(minimapIntent(a), 'hide', a);
  for (const a of ['what is a minimap', 'show me a map of paris', 'add milk to my list', 'minimap of the world explained']) assert.equal(minimapIntent(a), null, a);
});

test('minimap: dots scale into the box and leave the map out', () => {
  const things = { a: { id: 'a', kind: 'sticky', x: 0, y: 0 }, b: { id: 'b', kind: 'timer', x: 800, y: 600 }, m: { id: 'm', kind: 'minimap', x: 0, y: 0 }, z: { id: 'z', kind: 'x' } };
  const dots = minimapDots(things, { w: 800, h: 600 }, { w: 100, h: 60 });
  assert.deepEqual(dots.map((d) => d.id), ['a', 'b']);
  assert.ok(dots[1].x > dots[0].x && dots[1].y > dots[0].y);
  for (const d of dots) assert.ok(d.x >= 0 && d.x <= 94 && d.y >= 0 && d.y <= 54);
  assert.deepEqual(minimapDots({}, { w: 800, h: 600 }, { w: 100, h: 60 }), []);
});

test('ask clipboard: show, re-run by number, and plain recent asks left alone', () => {
  for (const a of ['show my recent asks as a card', 'ask clipboard', 'open the ask clipboard', 'recent asks card']) assert.equal(clipboardIntent(a), 'show', a);
  assert.deepEqual(clipboardIntent('re-run the third recent ask'), { act: 'rerun', n: 3 });
  assert.deepEqual(clipboardIntent('rerun my 2nd recent ask'), { act: 'rerun', n: 2 });
  assert.deepEqual(clipboardIntent('redo the last ask'), { act: 'rerun', n: 1 });
  assert.equal(clipboardIntent('re-run the thirteenth recent ask'), null);
  for (const a of ['recent asks', 'what did I ask', 'show my recent asks', 'what is a clipboard', 'copy to clipboard']) assert.equal(clipboardIntent(a), null, a);
  // the list leaves its own commands out, so "the third recent ask" counts real asks
  assert.deepEqual(clipboardAsks(['re-run the third recent ask', 'pizza', 'ask clipboard', 'sleep']), ['pizza', 'sleep']);
});

test('recent asks store keeps 12 and still shows 5 by default', () => {
  const bag = (() => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); } }; })();
  for (let i = 1; i <= 15; i++) rememberAsk('ask ' + i, bag);
  assert.equal(recentAsks(bag).length, 5);
  assert.equal(recentAsks(bag, 12).length, 12);
  assert.equal(recentAsks(bag, 12)[0], 'ask 15');
});

test('decision matrix: parsing, weighted totals, best', () => {
  assert.deepEqual(parseDecision('decision matrix for whether to move to Berlin'), { title: 'whether to move to Berlin', options: ['Do it', "Don't"] });
  assert.deepEqual(parseDecision('make a decision matrix for pasta vs pizza vs soup').options, ['pasta', 'pizza', 'soup']);
  assert.equal(parseDecision('make a decision matrix').title, 'My decision');
  for (const a of ['what is a decision matrix', 'how do I make a decision', 'add milk to my list']) assert.equal(parseDecision(a), null, a);
  const th = { options: ['A', 'B'], criteria: [{ weight: 3 }, { weight: 2 }], scores: { '0|0': 5, '0|1': 1, '1|0': 2, '1|1': 5 } };
  assert.deepEqual(totals(th), [17, 16]);
  assert.equal(bestOf(totals(th)), 0);
  assert.equal(bestOf([0, 0]), -1);
  assert.equal(bestOf([4, 4]), -1);
  assert.deepEqual(totals({ options: ['A'], criteria: [{ weight: 'x' }], scores: { '0|0': 99 } }), [0]); // junk and out-of-range never throw
});

test('habit ring: names, marks, streaks', () => {
  assert.deepEqual(parseHabits('habit ring for write, walk, sleep'), ['write', 'walk', 'sleep']);
  assert.deepEqual(parseHabits('habit rings for read and stretch'), ['read', 'stretch']);
  assert.equal(parseHabits('habit ring for a,b,c,d,e,f,g,h,i').length, 7);
  assert.deepEqual(parseHabits('habit ring for walk, Walk'), ['walk']);
  for (const a of ['how do I build a habit', 'mark walk done today', 'habit ring']) assert.equal(parseHabits(a), null, a);
  assert.deepEqual(markOf('mark walk done today'), { name: 'walk', off: false });
  assert.deepEqual(markOf('unmark walk done today'), { name: 'walk', off: true });
  assert.equal(markOf('mark the exam done').name, 'exam');
  assert.equal(markOf('add milk to my list'), null);
  let days = toggleDay([], '2026-10-18');
  assert.deepEqual(days, ['2026-10-18']);
  assert.deepEqual(toggleDay(days, '2026-10-18'), []);
  assert.deepEqual(toggleDay(days, '2026-10-18', true), ['2026-10-18']);
  const run = ['2026-10-16', '2026-10-17', '2026-10-18'];
  assert.equal(streakOf(run, '2026-10-18'), 3);
  assert.equal(streakOf(['2026-10-16', '2026-10-17'], '2026-10-18'), 2); // today still open
  assert.equal(streakOf(['2026-10-15', '2026-10-17'], '2026-10-18'), 1);
  assert.equal(streakOf(['2026-09-30', '2026-10-01'], '2026-10-01'), 2); // across a month edge
  assert.equal(weekCount(['2026-10-11', '2026-10-12', '2026-10-18'], '2026-10-18'), 2); // the 12th is 6 days back (in), the 11th is 7 (out)
  assert.equal(findHabit({ habits: [{ name: 'Walk' }, { name: 'Write' }] }, 'wal').name, 'Walk');
  assert.equal(findHabit({ habits: [{ name: 'Walk' }] }, 'run'), null);
});

test('habit ring: "mark X done" is the ring\'s only when that habit is on the saved stage', () => {
  const store = (state) => ({ getItem: () => JSON.stringify(state) });
  const ring = { r1: { kind: 'habits', habits: [{ name: 'Walk', days: [] }] } };
  assert.equal(marksSavedHabit('mark walk done today', store(ring)), true);
  assert.equal(marksSavedHabit('mark swim done today', store(ring)), false);
  assert.equal(marksSavedHabit('mark walk done today', store({})), false);
  assert.equal(marksSavedHabit('mark walk done today', { getItem: () => 'not json' }), false);
  assert.equal(marksSavedHabit('add milk to my list', store(ring)), false);
});

test('recipe stack: parsing, steps advance by time, chime only with a gesture', () => {
  assert.deepEqual(parseStep('boil 10 min'), { label: 'Boil', ms: 600000 });
  assert.deepEqual(parseStep('rest 2'), { label: 'Rest', ms: 120000 });
  assert.equal(parseStep('1 hour bake').ms, 3600000);
  assert.equal(parseStep('stir'), null);
  const r = parseRecipe('cook pasta: boil 10 min then rest 2');
  assert.equal(r.title, 'Pasta');
  assert.deepEqual(r.steps.map((s) => s.ms), [600000, 120000]);
  assert.equal(parseRecipe('cook pasta'), null);
  assert.equal(parseRecipe('how do I cook rice: 10 min'), null);
  assert.equal(parseRecipe('cook pasta: stir well'), null);
  assert.equal(parseRecipe('make rice: simmer 15, rest 5, fluff 1').steps.length, 3);
  assert.deepEqual(stepAt(r.steps, 0), { idx: 0, remaining: 600000, done: false });
  assert.deepEqual(stepAt(r.steps, 600000), { idx: 1, remaining: 120000, done: false });
  assert.deepEqual(stepAt(r.steps, 700000), { idx: 1, remaining: 20000, done: false });
  assert.equal(stepAt(r.steps, 720000).done, true);
  assert.equal(elapsedOf({ elapsed: 5000, running: true, startedAt: 1000 }, 4000), 8000);
  assert.equal(elapsedOf({ elapsed: 5000, running: false, startedAt: 1000 }, 4000), 5000);
  assert.equal(clock(125000), '2:05');
  // no gesture, no sound: chime() with no context does nothing; after unlockAudio with a fake context it plays two notes
  assert.equal(chime(null), false);
  const made = []; class FakeAC { constructor() { this.currentTime = 0; this.state = 'running'; this.destination = {}; made.push(this); } resume() { return Promise.resolve(); }
    createOscillator() { return { frequency: {}, connect() {}, start() { made.push('osc'); }, stop() {} }; }
    createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; } }
  assert.ok(unlockAudio(FakeAC));
  assert.equal(chime(), true);
  assert.equal(made.filter((x) => x === 'osc').length, 2);
});

test('shared helpers: escaping and local day', () => {
  assert.equal(escHtml('<b onclick="x">&\'</b>'), '&lt;b onclick=&quot;x&quot;&gt;&amp;&#39;&lt;/b&gt;');
  assert.equal(escHtml(null), '');
  assert.equal(localDay(new Date(2026, 9, 8)), '2026-10-08');
});
