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
test('a zombie is a seeded adult body: the same seed rebuilds it exactly, another seed differs, and the head is adult-sized', async () => {
  const { ZOMBIE, boundsOf } = await import('../void-live-deploy/skills/sdfmesh.js');
  const R = 28, a = ZOMBIE(R, 101), b = ZOMBIE(R, 101), c = ZOMBIE(R, 2024);
  assert.deepEqual(JSON.stringify(a), JSON.stringify(b));
  assert.notEqual(JSON.stringify(a.rig), JSON.stringify(c.rig));
  for (const seed of [1, 5, 101, 2024, 31337, 900001]) {
    const z = ZOMBIE(R, seed), box = boundsOf(z, 0), tall = box.max[1] - box.min[1];
    assert.ok((z.rig.headR * 2) / tall < 0.2, 'head ' + (z.rig.headR * 2 / tall).toFixed(2) + ' of the height: adult, not a big baby head');
    assert.ok(z.some((s) => s.cut), 'wounds and sockets are carved');
  }
});
test('two zombies leave each other alone and both go for the brain, even when the other zombie is nearer', () => {
  const z1 = { id: 'z1', x: 0, y: 0, script: fallbackScript('person', 'zombie') }, z2 = { id: 'z2', x: 40, y: 0, script: fallbackScript('person', 'zombie') };
  const brain = { id: 'b', x: 600, y: 0, script: fallbackScript('object', 'brain') }, man = { id: 'm', x: 30, y: 0, script: fallbackScript('person', 'a man') };
  assert.equal(pickNearbyReaction(z1, [z2, brain]).other.id, 'b');
  assert.equal(pickNearbyReaction(z1, [z2]), null);
  assert.equal(pickNearbyReaction(z1, [man, brain]).react, 'eat');
  assert.equal(pickNearbyReaction(z1, [man]).react, 'chase');
});
test('a brain is folded from its seed: the same seed folds the same, another seed folds differently, grooves are darker', async () => {
  const { brainMesh } = await import('../void-live-deploy/skills/sdfmesh.js');
  const a = brainMesh(28, 3, 40), b = brainMesh(28, 3, 40), c = brainMesh(28, 4, 40);
  assert.equal(a, b); // cached: the same seed is the same mesh
  assert.notEqual(a.positions.length, 0);
  assert.notDeepEqual(Array.from(a.positions.slice(0, 60)), Array.from(c.positions.slice(0, 60)));
  assert.ok(Math.min(...a.colors) < 0.8 && Math.max(...a.colors) > 0.95, 'sulci darker than gyri');
});
test('cats, dogs, mice, rabbits and monkeys are real animals from a seed: species builds differ, a seed repeats, coats vary', async () => {
  const { CREATURE, CREATURE_KINDS, boundsOf } = await import('../void-live-deploy/skills/sdfmesh.js');
  const size = (k, s) => { const b = boundsOf(CREATURE(28, s, k), 0); return [b.max[0] - b.min[0], b.max[1] - b.min[1]]; };
  assert.deepEqual(CREATURE_KINDS, ['cat', 'dog', 'mouse', 'rabbit', 'monkey']);
  assert.equal(JSON.stringify(CREATURE(28, 5, 'cat')), JSON.stringify(CREATURE(28, 5, 'cat')));
  assert.ok(size('mouse', 1)[1] < size('cat', 1)[1] && size('cat', 1)[1] < size('dog', 1)[1] + 1, 'a mouse stands lower than a cat');
  const coats = new Set(); for (let s = 0; s < 40; s++) coats.add(CREATURE(28, s, 'cat').rig.coat + CREATURE(28, s, 'cat').rig.pattern);
  assert.ok(coats.size >= 4, 'cats come in several coats');
  assert.equal(CREATURE(28, 1, 'unicorn'), null);
  for (const k of CREATURE_KINDS) assert.equal(CREATURE(28, 3, k).rig.legs.length, 4);
});
test('bones, cheese, carrots and bananas are real foods from a seed, each coloured like the real thing', async () => {
  const { foodMesh, foodField, FOOD_KINDS } = await import('../void-live-deploy/skills/sdfmesh.js');
  assert.deepEqual(FOOD_KINDS, ['bone', 'cheese', 'carrot', 'banana']);
  for (const k of FOOD_KINDS) {
    const a = foodMesh(28, 2, k, 32), c = foodMesh(28, 3, k, 32);
    assert.ok(a.positions.length > 300, k + ' has a surface');
    assert.notDeepEqual(Array.from(a.positions.slice(0, 30)), Array.from(c.positions.slice(0, 30)), k + ' varies by seed');
  }
  const mean = (k) => { const m = foodMesh(28, 2, k, 32), s = [0, 0, 0]; for (let i = 0; i < m.colors.length; i += 3) for (let j = 0; j < 3; j++) s[j] += m.colors[i + j]; return s.map((v) => v / (m.colors.length / 3)); };
  const carrot = mean('carrot'), banana = mean('banana');
  assert.ok(carrot[0] > carrot[2] * 2, 'a carrot is orange'); assert.ok(banana[0] > banana[2] * 1.5 && banana[1] > banana[2] * 1.4, 'a banana is yellow');
  assert.equal(foodField(28, 1, 'pizza'), null);
});
test('fish, sharks, bees and flowers are real from a seed: a tail that sweeps, wings that beat, petals that vary', async () => {
  const { lifeMesh, lifeParts, LIFE_KINDS } = await import('../void-live-deploy/skills/sdfmesh.js');
  assert.deepEqual(LIFE_KINDS, ['fish', 'shark', 'bee', 'flower']);
  assert.ok(lifeMesh(28, 1, 'fish', 32).tail && lifeMesh(28, 1, 'shark', 32).tail, 'swimmers have a tail part');
  assert.ok(lifeMesh(28, 1, 'bee', 32).wingL && lifeMesh(28, 1, 'bee', 32).wingR, 'a bee has two wings');
  const petals = new Set(); for (let s = 0; s < 30; s++) petals.add(lifeParts(28, s, 'flower').parts.body.length);
  assert.ok(petals.size >= 3, 'flowers vary in petal count');
  assert.equal(JSON.stringify(lifeParts(28, 4, 'shark').parts), JSON.stringify(lifeParts(28, 4, 'shark').parts));
  assert.equal(lifeParts(28, 1, 'dragon'), null);
});
test('a person from a card is the same seeded adult body, alive and whole; zombies are unchanged', async () => {
  const { ZOMBIE } = await import('../void-live-deploy/skills/sdfmesh.js');
  const p = ZOMBIE(28, 7, true), z = ZOMBIE(28, 7);
  assert.equal(p.rig.living, true); assert.equal(z.rig.living, false);
  assert.equal(p.rig.wounds.length, 0, 'no wounds on the living'); assert.ok(z.rig.wounds.length > 0);
  assert.ok(p.rig.hair != null && z.rig.hair == null, 'people have hair');
  assert.equal(p.rig.hang, 2, 'both arms at the sides'); assert.equal(p.rig.drag, 0, 'no dragged leg');
  assert.ok(p.rig.hunch < z.rig.hunch, 'upright');
  assert.equal(JSON.stringify(ZOMBIE(28, 7)), JSON.stringify(z), 'a zombie seed still rebuilds the same zombie');
  const skins = new Set(); for (let s = 0; s < 60; s++) skins.add(ZOMBIE(28, s, true).rig.skin); assert.ok(skins.size >= 5, 'a range of real skin tones');
});

test('a figure in the 3D layer is thrown by a flick or by letting go off the screen; a slow drop sets it down', async () => {
  const { tossVerdict, TOSS_SPEED } = await import('../void-live-deploy/skills/figures3d.js');
  assert.equal(tossVerdict({ x: 400, y: 300, vx: 1.2, vy: 0 }, 1280, 800).thrown, true);
  assert.equal(tossVerdict({ x: 400, y: 300, vx: 0.2, vy: 0.1 }, 1280, 800).thrown, false);
  assert.equal(tossVerdict({ x: -10, y: 300, vx: 0, vy: 0 }, 1280, 800).thrown, true);
  assert.equal(TOSS_SPEED, 0.9);
});
