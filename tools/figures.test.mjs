import test from 'node:test';
import assert from 'node:assert/strict';
import { figuresOf, lookFor, natureSummon } from '../void-live-deploy/skills/figures.js';
import { natureOf, fallbackScript, pickNearbyReaction, climateAt, CONDITIONS, precipFor } from '../void-live-deploy/skills/scripts.js';

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
const run = (kind, env, secs, st = CONDITIONS[kind].start()) => { const log = []; for (let t = 0; t < secs; t += 0.1) { st = CONDITIONS[kind].step(st, env, 0.1); log.push(st); } return { st, log }; };
test('a cloud rains only when the conditions are right', () => {
  const mild = climateAt({ x: 0, y: 0 }, []);
  const a = run('cloud', mild, 60);
  assert.ok(a.log.some((s) => s.falling === 'rain'), 'a cloud in mild humid air fills up and rains');
  assert.ok(a.log.findIndex((s) => s.falling) > 100, 'not at once: it has to gather water first');
  const overSea = climateAt({ x: 0, y: 0 }, [{ id: 's', kind: 'water', x: 0, y: 60 }]);
  assert.ok(run('cloud', overSea, 60).log.findIndex((s) => s.falling) < a.log.findIndex((s) => s.falling), 'over a sea it rains sooner');
  const dry = climateAt({ x: 0, y: 0 }, [{ id: 'u', kind: 'sun', x: 30, y: 0 }]);
  assert.ok(!run('cloud', dry, 120).log.some((s) => s.falling), 'beside a hot sun the air is too dry: no rain');
  const cold = climateAt({ x: 0, y: 0 }, [{ id: 'i', kind: 'ice', x: 10, y: 0 }]);
  assert.ok(cold.temp <= 0 && run('cloud', cold, 60).log.some((s) => s.falling === 'snow'), 'freezing air: it snows');
  assert.equal(precipFor(2), 'sleet');
  const stops = run('cloud', mild, 120).log; const i = stops.findIndex((s) => s.falling);
  assert.ok(stops.slice(i).some((s) => !s.falling), 'it rains itself lighter and stops');
});
test('ice melts above freezing, faster by a fire, and a flower under rain grows', () => {
  const room = run('ice', climateAt({ x: 0, y: 0 }, []), 10).st.melt, fire = run('ice', climateAt({ x: 0, y: 0 }, [{ id: 'f', kind: 'fire', x: 40, y: 0 }]), 10).st.melt;
  assert.ok(room > 0 && fire > room * 2, JSON.stringify({ room, fire }));
  assert.equal(run('ice', climateAt({ x: 0, y: 0 }, [{ id: 'f', kind: 'fire', x: 20, y: 0 }]), 120).st.gone, true);
  const under = climateAt({ x: 0, y: 0 }, [{ id: 'c', kind: 'cloud', x: 10, y: -150, state: { falling: 'rain' } }]);
  assert.equal(under.rainedOn, true);
  assert.ok(run('flower', under, 5).st.grow > 0.5);
  assert.equal(run('flower', climateAt({ x: 0, y: 0 }, []), 5).st.grow, 0);
});
