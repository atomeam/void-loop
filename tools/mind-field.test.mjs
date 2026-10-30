// Mind Field (skills/mind-field.js, owner 2026-10-21: "always combine anything that can be without taking away"): the seven field minds
// are one family; every old ask lands on the same mode as before, the new words reach each mode, and the Draw mode's law
// (lib/field-doodle.js) is seeded, bounded, predicts the stroke and keeps no trace in what it seals. Run: node --test tools/mind-field.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import fam from '../void-live-deploy/skills/mind-field.js';
import vector from '../void-live-deploy/skills/vector-field-mind.js';
import living from '../void-live-deploy/skills/living-cards-mind.js';
import attention from '../void-live-deploy/skills/attention-field-mind.js';
import nca from '../void-live-deploy/skills/nca-mind.js';
import resonance from '../void-live-deploy/skills/resonance-mind.js';
import swarm from '../void-live-deploy/skills/swarm-mind.js';
import doodle from '../void-live-deploy/skills/doodle-mind.js';
import modeSkill from '../void-live-deploy/skills/mind-field-mode.js';
import INDEX from '../void-live-deploy/lib/similar-index.js';
import similar from '../void-live-deploy/skills/similar.js';
import * as D from '../void-live-deploy/lib/field-doodle.js';
import { MODES, modeAsk, listAsk, saveAsk } from '../void-live-deploy/lib/mind-field-modes.js';

const OLD = [vector, living, attention, nca, resonance, swarm]; // their old routing order: 1400, 1450, then the 1460s by name
const before = (a) => (OLD.find((s) => s.match(a.toLowerCase(), a)) || {}).name || null;
test('every example of the six old skills lands on the same member as before the combine', () => {
  const asks = OLD.flatMap((s) => s.examples); assert.ok(asks.length >= 30);
  for (const a of asks) { assert.ok(before(a), 'still answered: ' + a); assert.equal(fam.part(a.toLowerCase(), a), before(a), a); }
});
test('old near misses still miss, and the new words do not take "swarm" or "never mind"', () => {
  for (const a of fam.nearMisses) assert.equal(fam.match(a.toLowerCase(), a), false, a);
  for (const a of ['swarm', 'never mind', 'mind', 'what is a magnetic field', 'mind over matter']) assert.equal(fam.match(a.toLowerCase(), a), false, a);
});
test('the plain words open Mind Field and each mode', () => {
  const want = { 'mind field': 'doodle-mind', 'living field': 'doodle-mind', 'draw with a mind': 'doodle-mind', 'show me the mind field': 'doodle-mind', 'show me a mind': 'mind-field-mode',
    'flow field': 'vector-field-mind', 'listen field': 'mind-field-mode', 'swarm field': 'mind-field-mode', 'mind field swarm': 'mind-field-mode', 'mind field modes': 'mind-field-mode', 'save this mind': 'mind-field-mode' };
  for (const [a, p] of Object.entries(want)) assert.equal(fam.part(a.toLowerCase(), a), p, a);
  assert.equal(modeAsk('listen field').id, 'resonance-mind'); assert.equal(modeAsk('swarm field').id, 'swarm-mind'); assert.equal(modeAsk('mind field grow').id, 'nca-mind');
  assert.ok(listAsk('mind field modes')); assert.ok(saveAsk('save this mind'));
  for (const [a, p] of Object.entries({ 'echo field': 'echo-field', 'acoustic lattice': 'echo-field', 'mind field echo': 'mind-field-mode', 'mind field doodle mind': 'mind-field-mode', 'doodle mind': 'doodle-mind' })) assert.equal(fam.part(a.toLowerCase(), a), p, a);
  assert.equal(modeAsk('mind field echo').id, 'echo-field'); assert.equal(modeAsk('mind field doodle mind').id, 'doodle-mind'); assert.ok(MODES.find((m) => m.id === 'attention-field-mind').link.href.endsWith('attention-7.html'));
  for (const m of MODES) { assert.ok(fam.match(m.ask.toLowerCase(), m.ask), m.ask); assert.equal(modeAsk('mind field ' + m.name.toLowerCase()).id, m.id); }
});
test('the family takes one place in the index, keeps every old name as a part, and every part has a stage kind', () => {
  assert.deepEqual(fam.parts, ['mind-field-mode', 'doodle-mind', 'echo-field', 'resonant-membrane', 'vector-field-mind', 'living-cards-mind', 'attention-field-mind', 'nca-mind', 'resonance-mind', 'swarm-mind', 'agent-fluid-memory-orbs']);
  const index = JSON.parse(readFileSync(new URL('../void-live-deploy/skills/index.json', import.meta.url), 'utf8'));
  assert.ok(index.includes('mind-field')); for (const n of fam.parts) assert.ok(!index.includes(n), n);
  assert.ok(existsSync(new URL('../void-live-deploy/skills/order/1400-mind-field', import.meta.url)));
  for (const m of MODES) assert.ok(fam.stageKinds[m.id], m.id);
});
test('"what\'s similar" lists the modes of any combined skill', () => {
  for (const a of ["what's similar to swarm mind", 'modes of mind field', 'skills like nca mind']) assert.ok(similar.match(a.toLowerCase(), a), a);
  assert.equal(INDEX.families['mind-field'].length, 11); assert.ok(doodle.examples.includes('mind field')); assert.ok(modeSkill.examples.includes('listen field'));
  for (const a of similar.nearMisses) assert.equal(similar.match(a.toLowerCase(), a), false, a);
});
test('the Draw law: seeded, bounded, predicts the stroke, seals numbers only, fast', () => {
  const run = (seed) => { const s = D.create(seed); for (let i = 0; i < 300; i++) { const a = i / 30; D.step(s, 1 / 60, { x: 0.5 + 0.3 * Math.cos(a), y: 0.5 + 0.3 * Math.sin(a), over: true, down: i < 150, audio: i > 200 ? 0.5 : 0 }); } return s; };
  const a = run(3), b = run(3); assert.deepEqual(D.params(a), D.params(b));
  for (const v of a.a) assert.ok(v >= 0 && v <= 1);
  const m = D.metrics(a); for (const k of ['entropy', 'activity', 'consensus', 'cx', 'cy']) assert.ok(m[k] >= 0 && m[k] <= 1, k);
  assert.equal(a.oracles.length, D.ORACLES); assert.ok(a.trace.length <= D.TRACE); assert.ok(a.latent[2] > 0, 'a circle curves');
  const p = JSON.stringify(D.params(a)); assert.ok(!/trace/.test(p), 'no trace in a seal');
  const s = D.create(1), t0 = performance.now(); for (let i = 0; i < 600; i++) D.step(s, 1 / 60, { x: 0.5, y: 0.5, over: true, down: true }); assert.ok((performance.now() - t0) / 600 < 4, 'a step is a small part of a 16 ms frame');
  const h = D.create(1); h.orbs[0].held = true; h.orbs[0].x = 0.9; h.orbs[0].y = 0.1; for (let i = 0; i < 30; i++) D.step(h, 1 / 60, {}); assert.equal(h.orbs[0].x, 0.9); assert.ok(h.a[Math.floor(0.1 * D.GH) * D.GW + Math.floor(0.9 * D.GW)] > 0, 'a held orb feeds the field where it sits');
});

test('Resonant Membrane: its words open it, its mode is listed, pitch follows energy, and the probes reach Attention', async () => {
  const M = await import('../void-live-deploy/skills/resonant-membrane.js');
  for (const a of ['resonant membrane', 'pluck the membrane', 'membrane mind']) assert.equal(fam.part(a, a), 'resonant-membrane', a);
  for (const a of M.default.nearMisses) assert.equal(M.default.match(a, a), false, a);
  assert.equal(modeAsk('mind field membrane').id, 'resonant-membrane'); assert.equal(modeAsk('mind field probes').id, 'attention-field-mind');
  assert.ok(M.pitchOf(1) > M.pitchOf(0)); const a = new Float32Array(D.GW * D.GH); a[0] = 0.9; assert.ok(Math.abs(M.energyAt(a, 0, 0) - 0.9) < 1e-6); assert.equal(M.energyAt(a, 0.9, 0.9), 0);
});
