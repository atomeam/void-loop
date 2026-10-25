// The void seal (void-live-deploy/lib/void-seal.js): Verse's procedural card art. Same key, same plan; a different key, a different picture;
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
  // the atom galaxy is gas and stars (fills, thousands) with dust filaments (strokes, hundreds), 2026-10-25; the old flow field was all strokes
  assert.ok(calls.get('fillRect') > 3000 && calls.get('stroke') > 100, JSON.stringify([...calls]));
});

test('round 2: the card name picks a recognisable motif (a cat, a black hole, a skyline, a chart, a bowl, a warning, code, a dragon), drawn in its own hue, with its drawing present', async () => {
  const { motifPaths, MOTIF_HUE, GROUNDED } = await import('../void-live-deploy/lib/card-subject.js');
  for (const [key, m] of [['cat', 'cat'], ['black hole', 'hole'], ['tokyo', 'city'], ['stock market', 'chart'], ['recipe pancakes', 'food'], ['error report', 'warning'], ['the matrix code', 'code'], ['dragon', 'dragon'], ['the moon', 'moon']]) {
    const p = sealPlan(key, { kind: 'Answer', hue: 100, nouns: [] });
    assert.equal(p.motif, m, key); assert.ok(motifPaths(m) && motifPaths(m).length, m + ' has a drawing'); assert.equal(p.palette[0], MOTIF_HUE[m], key + ' is drawn in its own hue');
  }
  assert.equal(sealPlan('plain thing xyz', { hue: 100 }).palette[0], 100, 'no motif: the family hue leads');
  assert.ok(sealPlan('tokyo').grounded && GROUNDED.has('wave') && !sealPlan('cat').grounded);
  const moon = motifPaths('moon')[0][0]; assert.ok(/A40 40 0 1 0/.test(moon) && /A55 55 0 0 1/.test(moon), 'the moon is a crescent with area (the old path was a bracket)');
});

test('round 2: the motif is at most 64% of the window and its centre keeps it clear of the top and bottom edge', () => {
  globalThis.Path2D = class { constructor(d) { this.d = d; } };
  try {
    for (const key of ['cat', 'dragon', 'tokyo', 'black hole']) for (let i = 0; i < 12; i++) {
      const p = sealPlan(key + ' ' + i, { kind: 'Creature', hue: 20, nouns: [key] }); let sz = 0, cy = 0;
      const ctx = new Proxy({ canvas: null }, { get: (t, k) => (k in t ? t[k] : () => ({ addColorStop() {} })), set: (t, k, v) => { t[k] = v; return true; } });
      ctx.translate = (x, y) => { cy = y; }; ctx.scale = (a) => { sz = a * 100; };
      drawSeal(ctx, 520, 293, p);
      assert.ok(sz <= 293 * 0.64 + 0.01, key + ' size ' + sz); assert.ok(cy >= 293 * 0.06 - 0.01 && cy + sz <= 293 * 0.94 + 0.01, key + ' top ' + cy + ' size ' + sz);
    }
  } finally { delete globalThis.Path2D; }
});
