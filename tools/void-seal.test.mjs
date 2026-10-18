// The void seal (void-live-deploy/lib/void-seal.js): V01D's procedural card art. Same key, same plan; a different key, a different picture;
// rarity sets the light, the kind the core, the family hue the colour. Run: node --test tools/void-seal.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { sealPlan, seedOf, LIGHT, FORMS, drawSeal } from '../void-live-deploy/lib/void-seal.js';

test('same key, same plan (any case or spacing); a different key or kind, a different plan', () => {
  assert.deepEqual(sealPlan('What I think of myself', { kind: 'Idea', hue: 270, rarity: 'rare' }), sealPlan('  what i think of myself ', { kind: 'Idea', hue: 270, rarity: 'rare' }));
  assert.notEqual(sealPlan('cat', { kind: 'Creature' }).seed, sealPlan('dog', { kind: 'Creature' }).seed);
  assert.notEqual(sealPlan('cat', { kind: 'Creature' }).seed, sealPlan('cat', { kind: 'Film' }).seed);
  assert.equal(seedOf('a'), seedOf('a')); assert.notEqual(seedOf('a'), seedOf('b'));
});
test('rarity sets the light (a Mythic burns brighter than a Common), the family hue leads the palette, every form is reachable', () => {
  assert.equal(sealPlan('x', { rarity: { name: 'Mythic' } }).light, LIGHT.mythic); assert.equal(sealPlan('x', { rarity: 'proven' }).light, LIGHT.mythic);
  assert.equal(sealPlan('x', {}).light, LIGHT.common); assert.ok(LIGHT.mythic.n > LIGHT.common.n);
  assert.equal(sealPlan('x', { hue: 400 }).palette[0], 40);
  const seen = new Set(); for (let i = 0; i < 200; i++) seen.add(sealPlan('k' + i).form); assert.deepEqual([...seen].sort(), [...FORMS].sort());
  assert.ok(sealPlan('x', { rarity: 'mythic' }).bolts > sealPlan('x', { rarity: 'common' }).bolts);
});
test('drawing touches only the context it is handed and finishes on a recording fake', () => {
  const calls = new Map(), grad = { addColorStop() {} };
  const ctx = new Proxy({ canvas: null, filter: 'none' }, { get: (t, k) => (k in t ? t[k] : k.startsWith('create') ? () => grad : (...a) => { calls.set(k, (calls.get(k) || 0) + 1); }), set: (t, k, v) => { t[k] = v; return true; } });
  drawSeal(ctx, 520, 150, sealPlan('incident autopsy', { kind: 'Idea', rarity: 'rare' }));
  assert.ok(calls.get('stroke') > 500 && calls.get('fillRect') > 100, JSON.stringify([...calls]));
});
