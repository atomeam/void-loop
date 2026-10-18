// lib/anchor-density.js: the ghost anchor's heart fills with how much is on your stage to go back to (asked by Void, 2026-10-18: "Integrate the
// 'density-indicator' logic into the ghost anchor so it visually shows how much 'navigation depth' or history is available"). Drawn in void.html;
// the browser check is "empty state and input bar" (7). Run: node --test tools/anchor-density.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { anchorDensity, stageThings, ANCHOR_GOAL, HEART_TOP, HEART_BOTTOM } from '../void-live-deploy/lib/anchor-density.js';
import { density } from '../void-live-deploy/lib/list-goal.js';

const things = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => ['t' + i, { id: 't' + i, kind: i % 3 ? 'clock' : 'kept' }]));

test('anchor density: every thing on the stage (kept cards among them) against a goal of 12, the list bar\'s own density rule, the title the anchor shows', () => {
  assert.equal(ANCHOR_GOAL, 12);
  const none = anchorDensity({});
  assert.deepEqual([none.count, none.goal, none.ratio, none.state, none.label, none.title], [0, 12, 0, 'under', '0 of 12', 'support Verse · 0 of 12 things on your stage']);
  assert.deepEqual(none.fill, { y: 21, h: 0 }, 'nothing on the stage: no fill at all');
  const seven = anchorDensity(things(7));
  assert.equal(seven.count, 7); assert.equal(seven.state, 'under'); assert.equal(seven.title, 'support Verse · 7 of 12 things on your stage');
  assert.deepEqual({ ratio: seven.ratio, state: seven.state, label: seven.label }, density(7, 12), 'the same rule as a list\'s goal bar');
  assert.ok(seven.fill.y < 21 && seven.fill.y > HEART_TOP && seven.fill.h > none.fill.h, 'the fill rises from the bottom of the heart');
  assert.equal(anchorDensity(things(11)).state, 'near');
  const met = anchorDensity(things(12)), past = anchorDensity(things(30));
  assert.equal(met.state, 'met'); assert.equal(met.ratio, 1); assert.equal(met.fill.y, HEART_TOP, 'met: the whole heart');
  assert.equal(past.state, 'met'); assert.equal(past.label, '30 of 12'); assert.equal(past.fill.y, HEART_TOP, 'past the goal the heart is whole, not taller');
  assert.ok(HEART_TOP < HEART_BOTTOM && HEART_BOTTOM <= 24);
});

test('anchor density: a list counts too, null slots and junk count for nothing, and the stage store is read the way lib/state.js reads it', () => {
  assert.equal(anchorDensity([{ kind: 'clock' }, null, { kind: 'kept' }, 'x']).count, 2);
  for (const bad of [null, undefined, 7, 'things']) assert.equal(anchorDensity(bad).count, 0);
  const bag = new Map(), storage = { getItem: (k) => (bag.has(k) ? bag.get(k) : null), setItem: (k, v) => bag.set(k, v) };
  assert.deepEqual(stageThings(storage), {}, 'nothing kept yet');
  storage.setItem('a2m.void.state.v1', JSON.stringify(things(2)));
  assert.equal(anchorDensity(stageThings(storage)).label, '2 of 12');
  storage.setItem('a2m.void.state.v1', '{not json');
  assert.deepEqual(stageThings(storage), {}, 'an unreadable store is an empty stage, never a throw');
  assert.deepEqual(stageThings({ getItem: () => { throw new Error('no'); } }), {});
});
