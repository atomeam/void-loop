// shared-field: Verse's one shared field (void-live-deploy/lib/shared-field.js, served as void-live-deploy/skills/field.js) and Verse
// Brain on it (void-live-deploy/lib/brain-field.js). The memory orbs write slots, the brain feels them in its memory layer and says so,
// the brain publishes its ideas as numbers only, and no writer takes another's slot.
// Run: node --test tools/shared-field.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as Field from '../void-live-deploy/lib/shared-field.js';
import * as Served from '../void-live-deploy/skills/field.js';
import { feltFrom, linkBrain, fieldSays, SKILL } from '../void-live-deploy/lib/brain-field.js';
import * as B from '../void-live-deploy/lib/brain.js';
import { layoutOf } from '../void-live-deploy/lib/orb-field.js';

const L = Field.layout;
const orb = (slot, x, y, act, who = 'agent-fluid-memory-orbs') => { const c = Field.provenanceOf(who); Field.writeRegion(L.pos + 3 * slot, 3, [x, y, 0], who); Field.writeRegion(L.act + slot, 1, [act], who); Field.writeRegion(L.prov + slot, 1, [c], who); return c; };

test('the field keeps the specified API and layout, and skills/field.js is the same buffer', () => {
  Field.reset();
  for (const k of ['init', 'readRegion', 'writeRegion', 'step', 'sealSlice', 'provenanceOf']) assert.equal(typeof Served[k], 'function', k);
  assert.deepEqual(Field.init(), { N: Field.N, D: Field.D, layout: L, backend: 'cpu' });
  assert.deepEqual(L, layoutOf(Field.N, Field.D), 'the layout lib/orb-field.js expects');
  assert.equal(Field.writeRegion(10, 3, [1, 2, 'x'], 'a'), 3); assert.deepEqual(Array.from(Served.readRegion(10, 3)), [1, 2, 0], 'one buffer; a non-number is 0');
  const copy = Field.readRegion(10, 3); copy[0] = 99; assert.equal(Field.readRegion(10, 1)[0], 1, 'a read is a copy');
  assert.equal(Field.writeRegion(L.total - 1, 5, [7, 7, 7, 7, 7], 'a'), 1, 'writes stop at the end'); assert.equal(Field.readRegion(-5, 2).length, 2);
  assert.equal(Field.provenanceOf('verse-brain'), Field.provenanceOf('verse-brain')); assert.notEqual(Field.provenanceOf('verse-brain'), 0);
});

test('step moves an owned slot with its velocity and fades it; free slots stay still; seals are stable and kept', () => {
  Field.reset(); orb(0, 0.5, 0.5, 1); Field.writeRegion(L.vel, 3, [2, 0, 0], 'agent-fluid-memory-orbs'); Field.writeRegion(L.pos + 3, 2, [0.3, 0.3], 'x');
  for (let i = 0; i < 60; i++) Field.step(1 / 60);
  const p = Field.readRegion(L.pos, 6); assert.ok(p[0] > 0.5, 'moved along x'); assert.equal(p[3], Field.readRegion(L.pos + 3, 1)[0], 'no owner, no motion');
  assert.ok(Field.readRegion(L.act, 1)[0] < 1, 'activation fades');
  const id1 = Field.sealSlice(L.emb, L.D), id2 = Field.sealSlice(L.emb, L.D); assert.equal(id1, id2); assert.equal(Field.sealed(id1).length, L.D);
  assert.equal(Field.census().seals, 1);
});

test('Verse Brain feels other skills\' slots in its memory layer, says so, and never feels its own', () => {
  Field.reset(); orb(3, 0.2, 0.25, 0.9); orb(4, 0.8, 0.75, 0.5);
  const link = linkBrain(Field), f = feltFrom(Field, link.code);
  assert.equal(f.length, 2); assert.deepEqual(f.map((s) => s.act > 0.6), [true, false], 'strongest first');
  const b = B.createBrain(5), quiet = B.createBrain(5);
  const mem = (x) => { let t = 0; for (const v of x.ws.layers.memory) t += v; return t; };
  for (let i = 0; i < 30; i++) { B.stepBrain(b, { field: f }); B.stepBrain(quiet, {}); }
  assert.ok(mem(b) > mem(quiet), 'the orbs are laid into its memory layer');
  assert.match(B.selfSays(b).join(' '), /Feels 2 memories from other cards in the shared field/);
  B.tell(b, 'knights dragons castles'); for (let i = 0; i < 10; i++) B.stepBrain(b, { field: f });
  assert.ok(link.publish(b) > 0, 'its ideas are published'); assert.ok(Field.census().held[SKILL] > 0);
  assert.equal(feltFrom(Field, link.code).length, 2, 'its own slots are not felt back');
  assert.equal(Field.readRegion(L.prov + 3, 1)[0], Field.provenanceOf('agent-fluid-memory-orbs'), 'an orb\'s slot is never taken');
  link.close(); assert.equal(Field.census().held[SKILL], undefined, 'closing frees the brain\'s slots');
});

test('the brain writes numbers only: no slot holds its words', () => {
  Field.reset(); const link = linkBrain(Field), b = B.createBrain(7); B.tell(b, 'secret words'); for (let i = 0; i < 10; i++) B.stepBrain(b, {});
  link.publish(b); const all = Field.readRegion(0, L.total); assert.ok(all.every((v) => Number.isFinite(v)));
  assert.ok(!JSON.stringify(Field.census()).includes('secret'), 'the census names writers, never words');
});

test('the card says in words what the brain feels in the field and whose it is, never its own slots as felt', () => {
  Field.reset(); orb(1, 0.3, 0.3, 0.8); orb(2, 0.6, 0.6, 0.7); const link = linkBrain(Field), b = B.createBrain(9);
  B.tell(b, 'orbs'); for (let i = 0; i < 10; i++) B.stepBrain(b, {}); link.publish(b);
  const line = fieldSays(Field.census(), feltFrom(Field, link.code).length, link.held);
  assert.match(line, /^Shared field: feels 2 memories from other cards: Memory orbs \(2\)\./);
  assert.match(line, new RegExp('It holds ' + link.held + ' of its own idea')); assert.ok(!line.includes('verse brain'), 'its own slots are not listed as felt');
  assert.match(fieldSays({ held: {} }, 0, 0), /nothing from other cards yet/); assert.match(fieldSays({ held: { x: 1 } }, 1, 0), /feels 1 memory from other cards: x \(1\)\.$/);
});

test('every Mind Field mode joins the brain: its card\'s own numbers in one slot, felt and named, freed when it leaves', async () => {
  const { linkMode } = await import('../void-live-deploy/lib/mode-field.js');
  Field.reset(); orb(0, 0.1, 0.1, 0.9); const swarm = linkMode(Field, 'swarm-mind'), flow = linkMode(Field, 'vector-field-mind');
  assert.ok(swarm.write({ entropy: 0.4, activity: 0.6, consensus: 0.3, cx: 0.7, cy: 0.2 }, { over: true }));
  assert.ok(flow.write({ entropy: 0.2, activity: 0, consensus: 0.9, cx: 0.5, cy: 0.5 }, {}));
  assert.notEqual(swarm.slot, flow.slot); assert.notEqual(swarm.slot, 0, 'an orb\'s slot is never taken');
  assert.equal(Field.readRegion(L.prov, 1)[0], Field.provenanceOf('agent-fluid-memory-orbs'));
  const p = Field.readRegion(L.pos + 3 * swarm.slot, 2); assert.ok(Math.abs(p[0] - 0.7) < 1e-6 && Math.abs(p[1] - 0.2) < 1e-6, 'it sits where the card\'s field attends');
  const e = Field.readRegion(L.emb + L.D * swarm.slot, 6); assert.ok(Math.abs(e[1] - 0.6) < 1e-6 && e[5] === 1, 'its embedding is the card\'s own numbers');
  const link = linkBrain(Field), felt = feltFrom(Field, link.code);
  assert.equal(felt.length, 2, 'the orb and the active swarm are felt; a still flow field (activity 0) is not');
  const b = B.createBrain(11), quiet = B.createBrain(11), mem = (x) => { let t = 0; for (const v of x.ws.layers.memory) t += v; return t; };
  for (let i = 0; i < 20; i++) { B.stepBrain(b, { field: felt }); B.stepBrain(quiet, {}); }
  assert.ok(mem(b) > mem(quiet), 'the modes are laid into its memory layer');
  assert.match(fieldSays(Field.census(), felt.length, 0), /feels 2 memories from other cards: .*Memory orbs \(1\)/); assert.match(fieldSays(Field.census(), felt.length, 0), /Swarm \(1\)/);
  const again = linkMode(Field, 'swarm-mind'); again.write({ activity: 0.5, cx: 0.1, cy: 0.1 }); assert.equal(again.slot, swarm.slot, 'a reopened card takes its own slot back');
  swarm.close(); flow.close(); assert.equal(Field.census().held['swarm-mind'], undefined); assert.equal(Field.readRegion(L.prov + flow.slot, 1)[0], 0, 'closing frees it');
  assert.ok(!JSON.stringify(Field.census()).match(/over|pointer/), 'numbers only');
});
