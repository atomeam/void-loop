import test from 'node:test';
import assert from 'node:assert/strict';
import { behaviorOf, patternOf, noveltyOf, scoreRuns, jobOf, plan, PREFIX } from './fringe-novelty.mjs';

const patterns = { timer: patternOf({ name: 'timer', examples: ['set a timer for ten minutes', 'countdown timer'] }), weather: patternOf({ name: 'weather', examples: ['weather in Oslo', 'will it rain tomorrow'] }) };
test('a behavior a skill already says scores low, one nothing says scores high (asked by Verse)', () => {
  assert.ok(noveltyOf('set a countdown timer for ten minutes', patterns).score <= 0.2);
  const n = noveltyOf('answer the middle arrow while neighbours disagree, timed per sitting', patterns);
  assert.ok(n.score >= 0.8 && n.skill === 'timer' || n.score >= 0.8, JSON.stringify(n));
  assert.equal(noveltyOf('too short', patterns), null);
});
test('a run says what it does by behavior, hypothesis, lab, then a source claim', () => {
  assert.equal(behaviorOf({ behavior: 'b b b', hypothesis: 'h' }), 'b b b');
  assert.equal(behaviorOf({ lab: { label: 'L', sub: 'S' } }), 'L. S');
  assert.equal(behaviorOf({ sources: [{ claim: 'c' }] }), 'c');
  assert.equal(behaviorOf(null), '');
});
const runs = [
  { run: 1, family: 'attention', at: '2026-10-15', behavior: 'five arrows, answer the middle one; neighbours disagree', near: ['skill:timer'] },
  { run: 2, family: 'miss-board', at: '2026-10-01', behavior: 'quiet gesture glyph drawn under the cursor trail' },
  { run: 3, family: 'attention', at: '2026-10-15', behavior: 'set a countdown timer for ten minutes' },
];
test('only a fresh, novel, unqueued run becomes the one open proposal', () => {
  const sc = scoreRuns(runs, patterns), opts = { today: '2026-10-16' };
  const p = plan(sc, { items: [] }, 0.8, opts);
  assert.deepEqual(p.queue.map((j) => j.target), [PREFIX + 'attention-1'], 'run 2 is old, run 3 is not novel');
  assert.ok(p.queue[0].ask.includes('[input: skill:timer]') && p.queue[0].ask.length <= 200);
  assert.equal(plan(sc, { items: [{ target: PREFIX + 'attention-1', state: 'done' }] }, 0.8, opts).queue.length, 0, 'never queued twice');
  assert.equal(plan(sc, { items: [{ target: PREFIX + 'other-9', state: 'queued' }] }, 0.8, opts).queue.length, 0, 'one open at a time');
  assert.deepEqual(plan(sc, { items: [] }, 0.8, { ...opts, all: true }).fresh.map((j) => j.target).sort(), [PREFIX + 'attention-1', PREFIX + 'miss-board-2']);
  assert.ok(jobOf(sc[0]).target.length <= 40);
});
