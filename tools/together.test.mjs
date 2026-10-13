// Figures that pick something to do together (frontier #4, the owner's 2026-10-11 piece): each figure advertises what it
// offers and scores the other's offers by its own needs (The Sims' advertised affordances); the pair takes the best of
// trade, spar, inspect and argue, and says why. Run: node --test tools/together.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import skill, { offersOf, needsOf, choose, togetherAsk, KINDS } from '../void-live-deploy/skills/together.js';
import { fallbackScript } from '../void-live-deploy/skills/scripts.js';

const fig = (title, body = 'person') => ({ title, script: fallbackScript(body, title) });

test('each figure advertises what it offers and needs, from what it is', () => {
  assert.deepEqual(KINDS, ['trade', 'spar', 'inspect', 'argue']);
  assert.ok(offersOf(fig('police officer').script).includes('spar'));
  assert.ok(needsOf(fig('chef').script).trade > 0.8);
  assert.ok(offersOf(fig('flower', 'object').script).includes('inspect'));
  assert.ok(!offersOf(fig('flower', 'object').script).includes('spar'), 'a flower is no fighter');
});

test('the pair picks the interaction both score best, and says who offers it and who wants it', () => {
  const c = choose(fig('police officer'), fig('thief'));
  assert.equal(c.kind, 'spar');
  assert.match(c.why, /^the police officer and the thief spar: /);
  assert.equal(choose(fig('chef'), fig('farmer')).kind, 'trade');
  assert.equal(choose(fig('cat', 'animal'), fig('flower', 'object')).kind, 'inspect');
  assert.equal(choose(fig('philosopher', 'idea'), fig('troublemaker')).kind, 'argue');
});

test('the same pair always picks the same, whichever comes first; two things with nothing to offer each other do nothing', () => {
  for (const [a, b] of [['police officer', 'thief'], ['chef', 'farmer'], ['cat', 'flower']]) {
    assert.equal(choose(fig(a), fig(b)).kind, choose(fig(b), fig(a)).kind, a + ' / ' + b);
  }
  assert.equal(choose(fig('ice', 'object'), fig('sun', 'object')), null);
});

test('the ask: "what are they doing" and its kin, nothing else', () => {
  for (const q of ['what are they doing', 'what are they doing?', 'what would they do together', 'what are the figures doing', 'what will those two do']) assert.ok(togetherAsk(q), q);
  for (const q of ['what are they doing in congress', 'what is a figure', 'what are you doing', 'what do zombies do']) assert.ok(!togetherAsk(q), q);
  for (const q of skill.examples) assert.ok(skill.match(q.toLowerCase(), q), q);
  for (const q of skill.nearMisses) assert.ok(!skill.match(q.toLowerCase(), q), q);
});

// frontier #4, next: the pair acts it out. meet() puts both figures in a 'together' mode: each walks to the other, stops a body
// apart, and does the interaction's own move (a spar trades hops and spins, a trade waves, an inspection looks the other over),
// then both go back to their own business.
import { makeBrain, stepFigure, meetBrains } from '../void-live-deploy/skills/figures3d.js';
test('the pair acts it out: they walk to each other, stop a body apart, do the move, then go their own way', () => {
  let s = 7; const rng = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const a = makeBrain({ id: 'a', x: 200, y: 300 }, rng), b = makeBrain({ id: 'b', x: 700, y: 320 }, rng);
  const world = { bounds: { l: 0, r: 1200, t: 0, b: 700 }, rects: [], cursor: null, still: false, posing: false, others: [a, b] };
  assert.equal(meetBrains(a, b, 'spar', 10), true);
  const d0 = Math.hypot(a.x - b.x, a.y - b.y);
  let spun = 0, hopped = 0;
  for (let i = 0; i < 160; i++) { stepFigure(a, 0.05, world, rng); stepFigure(b, 0.05, world, rng); if (a.spin > 0 || b.spin > 0) spun++; if (a.hop > 0.5 || b.hop > 0.5) hopped++; }
  const d1 = Math.hypot(a.x - b.x, a.y - b.y);
  assert.equal(a.mode, 'together'); assert.equal(b.mode, 'together');
  assert.ok(d1 < d0 / 4 && d1 > 40, 'met a body apart: ' + Math.round(d0) + ' -> ' + Math.round(d1));
  assert.ok(spun > 0 && hopped > 0, 'a spar is hops and spins');
  for (let i = 0; i < 200; i++) { stepFigure(a, 0.05, world, rng); stepFigure(b, 0.05, world, rng); } // the walk there no longer counts against the meeting's 10 s
  assert.notEqual(a.mode, 'together', 'the time runs out and each goes its own way'); assert.equal(a.together, null);
  assert.equal(meetBrains(a, null, 'spar'), false); assert.equal(meetBrains(a, b, 'dance'), false, 'only the four kinds');
});

// a meeting asked for while a figure is still being built (syncFigures is async; under load the second figure lands after
// together.js calls meet) waits for both to be on the stage instead of being dropped (verify on 9b11e37: met false, greet/follow)
import { settleMeets } from '../void-live-deploy/skills/figures3d.js';
test('a meeting waits for a figure still being built, then starts; an old one is let go', () => {
  const a = makeBrain({ id: 'a', x: 200, y: 300 }), b = makeBrain({ id: 'b', x: 700, y: 320 });
  const here = new Map([['a', { brain: a, leaving: 0 }]]), get = (id) => here.get(id);
  let waiting = [{ idA: 'a', idB: 'b', kind: 'spar', secs: 8, until: 5000 }];
  waiting = settleMeets(waiting, get, 1000);
  assert.equal(waiting.length, 1, 'the dog is not here yet: still waiting'); assert.equal(a.together, undefined);
  here.set('b', { brain: b, leaving: 0 });
  waiting = settleMeets(waiting, get, 2000);
  assert.equal(waiting.length, 0); assert.equal(a.together.kind, 'spar'); assert.equal(b.together.id, 'a');
  const c = makeBrain({ id: 'c' }); here.set('c', { brain: c, leaving: 0 });
  assert.equal(settleMeets([{ idA: 'c', idB: 'd', kind: 'trade', secs: 8, until: 5000 }], get, 6000).length, 0, 'past its time it is dropped');
  assert.equal(c.together, undefined);
});

// a pair far apart still meets: the meeting's time counts only once they are together, not while they walk there (verify on
// b19d39e: two figures ~930 px apart walked for the whole 8 s and parted 160 px short, so "figures together" never saw them meet)
test('a pair across the stage walks the whole way and then has its full meeting; one that can never reach gives up', () => {
  let s = 11; const rng = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const a = makeBrain({ id: 'a', x: 100, y: 300 }, rng), b = makeBrain({ id: 'b', x: 1100, y: 420 }, rng);
  const world = { bounds: { l: 0, r: 1280, t: 0, b: 720 }, rects: [], cursor: null, still: false, posing: false, others: [a, b] };
  meetBrains(a, b, 'spar', 8);
  let metAt = -1, spun = 0;
  for (let i = 0; i < 600 && a.together; i++) {
    stepFigure(a, 0.05, world, rng); stepFigure(b, 0.05, world, rng);
    if (metAt < 0 && Math.hypot(a.x - b.x, a.y - b.y) < 100) metAt = i;
    if (metAt >= 0 && (a.spin > 0 || b.spin > 0)) spun++;
  }
  assert.ok(metAt > 0, 'they met');
  assert.ok(spun > 0, 'and sparred once they met');
  const far = makeBrain({ id: 'c', x: 0, y: 300 }, rng), gone = makeBrain({ id: 'd', x: 6000, y: 300 }, rng);
  meetBrains(far, gone, 'trade', 8);
  const w2 = { ...world, bounds: { l: 0, r: 8000, t: 0, b: 720 }, others: [far, gone] };
  let steps = 0; for (; steps < 1000 && far.together; steps++) stepFigure(far, 0.05, w2, rng); // the other never moves
  assert.equal(far.together, null, 'it gives up'); assert.ok(steps * 0.05 <= 21, 'within the walk limit: ' + steps * 0.05 + ' s');
});
