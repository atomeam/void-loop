// brain-skew: site-test issue #2387. A deploy serves each /lib/ file on its own, so for a minute a visitor can get the new organ list
// (lib/brain-organs.js) beside a brain made by the older lib/brain.js, without the new organ's state. "play reversi" then threw
// "Cannot read properties of undefined (reading 'queue')" on the stage (2026-11-06, seven minutes after organ 25 added strokes).
// Every organ kept in its own module must rest, want nothing and run nothing when the brain does not hold its state, and work as before
// when it does.
// Run: node --test tools/brain-skew.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as B from '../void-live-deploy/lib/brain.js';
import { ORGANS, STATE_KEY } from '../void-live-deploy/lib/brain-organs.js';

const OWN = ['synapses', 'creature', 'hearing', 'painter', 'gardener', 'grower', 'formula', 'current', 'grains', 'pool', 'trace', 'strokes', 'rules', 'reflex', 'dialogue'];

test('a brain made before an organ existed: that organ rests, wants nothing and runs nothing', () => {
  for (const id of OWN) {
    const b = B.createBrain(7); delete b[STATE_KEY[id] || id];
    const o = ORGANS.find((x) => x.id === id);
    assert.ok(o, id + ' is an organ');
    assert.equal(o.rests(b), true, id + ' rests without its state');
    assert.equal(o.want(b), 0, id + ' wants nothing without its state');
    assert.doesNotThrow(() => o.run(b, { x: 0.5, y: 0.5, over: false }), id + ' runs nothing without its state');
  }
});

test('the strokes organ with the older brain: the exact error from #2387 is gone', () => {
  const b = B.createBrain(3); delete b.strokes;
  const s = ORGANS.find((o) => o.id === 'strokes');
  assert.doesNotThrow(() => s.rests(b));
});

test('a whole brain still steps with every organ, and with one organ state missing', () => {
  const b = B.createBrain(11);
  for (let t = 0; t < 40; t++) B.stepBrain(b, { x: 0.3 + t / 100, y: 0.4, over: true });
  const old = B.createBrain(12); delete old.rules;
  assert.ok(ORGANS.find((o) => o.id === 'rules').rests(old));
});
