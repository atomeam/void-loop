// node --test tools/walker.test.mjs: the walker's pacing (lib/walker.js step), its shadow, the true lines its bubble may say, the record it keeps,
// and the asks that start and stop it (skills/walker.js). The owner's note (2026-10-25): a cartoon that walks a solid floor at bottom 24 px, turns at
// the edges, bobs as it steps, casts a shadow, and stands still under reduced motion.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { step, startState, shadowOf, factLines, pickLine, recordOf, parseRecord, tossOf, fly, dropX, SPRITE, FLOOR, SPEED, BOB, TURN_PAUSE, STORE_KEY, TOSS_SPEED, GRAVITY, LIFT } from '../void-live-deploy/lib/walker.js';
import walker, { walkOf } from '../void-live-deploy/skills/walker.js';

const walk = (s, ms, w, dt = 16) => { for (let t = 0; t < ms; t += dt) s = step(s, dt, w); return s; };

test('the floor and the figure: 96 px tall, standing 24 px above the stage bottom, starting in the middle facing right', () => {
  assert.equal(SPRITE, 96); assert.equal(FLOOR, 24); assert.equal(SPEED, 60); assert.equal(BOB, 3);
  const s = startState(600);
  assert.equal(s.x, (600 - SPRITE) / 2); assert.equal(s.dir, 1); assert.equal(s.bob, 0); assert.equal(s.still, false);
  assert.equal(startState(10).x, 0, 'a stage narrower than the figure: it stands at the left edge');
  assert.equal(STORE_KEY, 'a2m.void.walker.v1');
});

test('it paces at walking speed from the elapsed time, and a long frame counts as one short step, never a leap', () => {
  const s0 = startState(1000);
  const s1 = step(s0, 1000, 1000); // one second in one frame: capped at DT_MAX
  assert.ok(s1.x - s0.x <= 60 * 0.1 + 0.001, 'a 1 s frame moves at most 100 ms worth');
  const s2 = walk(s0, 1000, 1000); // a second of 16 ms frames
  assert.ok(Math.abs(s2.x - s0.x - 60) < 2.5, 'about 60 px in a second: ' + (s2.x - s0.x));
  assert.notEqual(s2, s0, 'a new state each frame'); assert.equal(s0.x, (1000 - SPRITE) / 2, 'the old one is never mutated');
});

test('it bobs 3 px as it steps, at most BOB, and the shadow shrinks and fades as it lifts', () => {
  let s = startState(2000), max = 0, seen = new Set();
  for (let i = 0; i < 60; i++) { s = step(s, 16, 2000); max = Math.max(max, s.bob); seen.add(s.bob); }
  assert.ok(max > 2.5 && max <= BOB, 'the step lifts it up to 3 px: ' + max);
  assert.ok(seen.size > 5, 'the bob changes frame to frame');
  assert.deepEqual(shadowOf(0), { scale: 1, opacity: 0.55 });
  assert.ok(shadowOf(BOB).scale < 1 && shadowOf(BOB).opacity < 0.55, 'higher: smaller, fainter');
});

test('at an edge it turns (dir flips), pauses, then walks back the other way, never past the stage', () => {
  let s = { ...startState(300), x: 300 - SPRITE - 20 };
  s = walk(s, 600, 300); // 20 px to go at 60 px/s: it reaches the right edge in a third of a second
  assert.equal(s.dir, -1, 'facing left after the right edge'); assert.ok(s.x <= 300 - SPRITE, 'inside the stage');
  assert.ok(s.pauseMs > 0 && s.pauseMs <= TURN_PAUSE, 'standing a moment after the turn');
  const turned = walk({ ...startState(300), x: 300 - SPRITE - 20 }, 330, 300, 10); // just past the edge, the frame it turned
  const flipFrame = (() => { let t = { ...startState(300), x: 300 - SPRITE - 20 }; for (let i = 0; i < 100; i++) { t = step(t, 10, 300); if (t.turned) return t; } return null; })();
  assert.ok(flipFrame && flipFrame.dir === -1 && flipFrame.bob === 0, 'the turn frame says so (turned) and the figure lands flat'); assert.ok(turned.x <= 300 - SPRITE);
  s = walk(s, TURN_PAUSE + 2000, 300);
  assert.ok(s.x < 300 - SPRITE - 20, 'walked back left after the pause: ' + s.x);
  let left = { ...startState(300), x: 5, dir: -1 }; left = walk(left, 400, 300);
  assert.equal(left.dir, 1, 'the left edge turns it right'); assert.ok(left.x >= 0);
  let far = startState(400); for (let i = 0; i < 3000; i++) { far = step(far, 16, 400, () => 0.5); assert.ok(far.x >= 0 && far.x <= 400 - SPRITE, 'never off the stage'); }
});

test('it stops for a moment now and then (rnd picks how long and how soon)', () => {
  let s = startState(5000), paused = 0;
  for (let i = 0; i < 1500; i++) { s = step(s, 16, 5000, () => 0); if (s.pauseMs > 0 && !s.turned) paused++; } // 24 s: a pause every 4 s at rnd 0
  assert.ok(paused > 20, 'frames spent paused: ' + paused);
});

test('reduced motion: it stands where it is, bob 0, however long the frames run', () => {
  let s = startState(800, { still: true }); const x0 = s.x;
  s = walk(s, 5000, 800);
  assert.equal(s.x, x0); assert.equal(s.bob, 0); assert.equal(s.dir, 1);
  const w = step({ ...startState(800), still: false }, 16, 800); assert.ok(w.x > x0, 'not still: it walks');
});

test('the bubble says only what the page counted: lines for the numbers it has, none for a number it does not', () => {
  assert.deepEqual(factLines({}), []);
  const l = factLines({ skills: 284, surpassed: 7, learned: 'the unit converter does every kind.', motto: 'You name it, Verse learns it.', about: 'Verse does whatever anyone asks.' });
  assert.equal(l.length, 5);
  assert.match(l[0], /^I have 284 skills right now/); assert.match(l[1], /surpassed 7 sites so far/); assert.match(l[2], /^The last thing I learned: the unit converter does every kind\.$/);
  assert.match(l[3], /^“You name it, Verse learns it\.”$/); assert.equal(l[4], 'Verse does whatever anyone asks.');
  assert.deepEqual(factLines({ skills: -1, surpassed: 1.5 }), [], 'not a count: no line');
  assert.match(factLines({ surpassed: 0 })[0], /haven't surpassed a site yet/);
  assert.match(factLines({ skills: 1 })[0], /1 skill right now/);
  assert.equal(pickLine([]), "Give me a moment: I'm still counting.");
  assert.equal(pickLine(['a', 'b', 'c'], () => 0), 'a'); assert.equal(pickLine(['a', 'b', 'c'], () => 0.99), 'c');
  assert.equal(pickLine(['a', 'b'], () => 0, 'a'), 'b', 'not the line it just said');
  assert.equal(pickLine(['a'], () => 0, 'a'), 'a', 'one line: said again');
});

test('the record kept in this browser: a small data-URL picture (or none), the emoji, the subject and the ask; nothing else, and only ours parses', () => {
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const r = recordOf({ src: png, emoji: '🐱', subject: 'cat', ask: 'let it walk', extra: 'no' });
  assert.deepEqual(r, { v: 1, src: png, emoji: '🐱', subject: 'cat', ask: 'let it walk' });
  assert.equal(recordOf({ src: 'https://evil.example/x.png', subject: 'cat' }).src, '', 'only a data URL of a picture');
  assert.equal(recordOf({ src: 'data:text/html;base64,PHNjcmlwdD4=', subject: 'cat' }).src, '', 'never anything but an image');
  assert.equal(recordOf({ subject: '<b>cat</b>' }).subject, 'bcatb');
  assert.deepEqual(parseRecord(JSON.stringify(r)), r);
  assert.equal(parseRecord('{"v":2,"src":"x"}'), null); assert.equal(parseRecord('not json'), null); assert.equal(parseRecord(''), null); assert.equal(parseRecord('{"v":1}'), null);
});

test('the asks: let it walk, make him walk around, walk around, take a walk start it; stop walking, sit him down stop it; walking directions and "walk me through it" are not it', () => {
  for (const a of ['let it walk', 'Make him walk around', 'walk around', 'take a walk', 'let the cartoon walk', 'have it stroll', 'start walking', 'please let it walk!']) assert.equal(walkOf(a), 'walk', a);
  for (const a of ['stop walking', 'stop the walker', 'sit him down', 'enough walking', 'put it away', 'remove the walker', 'clear the walking cartoon', 'get rid of the cartoon walking around', 'hide the walker']) assert.equal(walkOf(a), 'stop', a);
  for (const a of ['remove the cartoon', 'clear the cartoon card', 'remove it']) assert.equal(walkOf(a), null, a + ': the cartoon card or the selected thing, not the walker');
  for (const a of ['walk me through it', 'how far did i walk today', 'walking directions to the station', 'walk', 'walk the dog', 'walking dead', 'a walk in the park', 'make it bigger']) assert.equal(walkOf(a), null, a);
  for (const e of walker.examples) assert.ok(walker.match(e.toLowerCase(), e), e);
  for (const n of walker.nearMisses) assert.ok(!walker.match(n.toLowerCase(), n), n);
  assert.ok(walker.suite().ok);
});

test('thrown like any thing on the stage (owner, 2026-10-30: "the cartoon walking around wont clear and cant be thrown"): the stage\'s flick speed, gravity and friction; a slow drop lands on the floor inside the stage', () => {
  assert.equal(TOSS_SPEED, 0.9, 'the same flick as index.html TOSS_SPEED'); assert.equal(GRAVITY, 0.0016); assert.equal(LIFT, 5);
  const box = { x: 200, y: 300, w: SPRITE, h: SPRITE, stageW: 400, stageH: 700 };
  assert.equal(tossOf({ ...box, vx: 0.2, vy: -0.1 }).thrown, false, 'a slow drop sets it down');
  assert.equal(tossOf({ ...box, vx: 1.5, vy: 0 }).thrown, true, 'a flick throws it');
  assert.equal(tossOf({ ...box, vx: 0, vy: -0.9 }).thrown, true, 'a flick straight up throws it too');
  assert.equal(tossOf({ ...box, x: -SPRITE - 1, vx: 0 }).thrown, true, 'let go off the left edge: thrown');
  assert.equal(tossOf({ ...box, x: 401, vx: 0 }).thrown, true, 'off the right edge: thrown');
  assert.equal(tossOf({ ...box, y: -SPRITE - 1, vx: 0 }).thrown, true, 'off the top: thrown');
  let f = { x: 0, y: 0, vx: 1.2, vy: -0.4, spin: 0 }, t = 0;
  for (; t < 5000 && f.y < 800 && f.x < 1000; t += 16) f = fly(f, 16, 0.995);
  assert.ok(t < 5000, 'a throw leaves the stage within seconds');
  assert.ok(f.vx < 1.2 && f.vy > 0 && f.spin > 0, 'friction slows it, gravity pulls it down, it spins the way it flies');
  const a = fly({ x: 0, y: 0, vx: 1, vy: 0, spin: 0 }, 1000, 0.995); assert.ok(a.x <= 32, 'a long frame counts as 32 ms at most: ' + a.x);
  assert.equal(fly({ x: 0, y: 0, vx: 1, vy: 0, spin: 0 }, 16, 0.9).vx, 0.9, 'the friction slider\'s setting');
  assert.equal(dropX(150.4, 400), 150); assert.equal(dropX(-30, 400), 0, 'never off the left'); assert.equal(dropX(390, 400), 400 - SPRITE, 'never off the right');
});
