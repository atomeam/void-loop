import test from 'node:test';
import assert from 'node:assert/strict';
import { figuresOf, lookFor, natureSummon } from '../void-live-deploy/skills/figures.js';
import { natureOf, fallbackScript, pickNearbyReaction } from '../void-live-deploy/skills/scripts.js';

test('things with a nature are summoned by name; other asks are left alone', () => {
  assert.deepEqual(figuresOf('summon a zombie'), { act: 'summon', kind: 'zombie', title: 'zombie' });
  assert.equal(figuresOf('add a brain').kind, 'brain');
  assert.equal(figuresOf('bring a cat').kind, 'cat');
  assert.equal(figuresOf('summon a sprite').act, 'summon');
  assert.equal(figuresOf('summon a sprite').kind, undefined);
  for (const t of ['what is a zombie', 'zombie movies', 'add milk to my list', 'summon a dog picture', 'add 5 and 3']) assert.equal(natureSummon(t), null, t);
});
test('every summon is its own individual, and the same seed always gives the same look', () => {
  const a = lookFor('zombie', 1), b = lookFor('zombie', 2);
  assert.deepEqual(lookFor('zombie', 1), a);
  assert.notDeepEqual(a, b);
  const seen = new Set(); for (let s = 0; s < 200; s++) seen.add(JSON.stringify(lookFor('zombie', s * 2654435761)));
  assert.equal(seen.size, 200);
  for (const k of ['size', 'wide', 'tall', 'pace']) assert.ok(a[k] > 0.7 && a[k] < 1.4, k);
  assert.match(a.color, /^#[0-9a-f]{6}$/);
});
test('"clone it" and "clone the zombie" ask for an exact copy', () => {
  assert.deepEqual(figuresOf('clone it'), { act: 'clone', what: null });
  assert.deepEqual(figuresOf('clone the zombie'), { act: 'clone', what: 'zombie' });
  assert.deepEqual(figuresOf('make a copy of the cat'), { act: 'clone', what: 'cat' });
});
test('a zombie hunts a brain by its nature, and a cat a mouse', () => {
  assert.ok(natureOf('zombie').tags.includes('zombie'));
  const z = fallbackScript('person', 'zombie');
  assert.ok(Object.values(z.reactsTo || {}).includes('eat') || JSON.stringify(z).includes('eat'), JSON.stringify(z));
  assert.ok(JSON.stringify(fallbackScript('animal', 'cat')).match(/chase|eat/));
  assert.equal(typeof pickNearbyReaction, 'function');
});
