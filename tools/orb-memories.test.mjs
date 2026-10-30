// orb-memories: the memory orbs card shows what Verse remembers (lib/orb-memories.js). A real brain's told words come back with the
// brain's own places and brightness, a brain on another tab is heard by its posted words, the other cards' shared-field slots show and
// the card's own never does, and the memories pull the fluid so its orbs are born on them.
// Run: node --test tools/orb-memories.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../void-live-deploy/lib/orb-memories.js';
import * as B from '../void-live-deploy/lib/brain.js';
import * as Field from '../void-live-deploy/lib/shared-field.js';
import * as F from '../void-live-deploy/lib/field-fluid-orbs.js';
import { connectField } from '../void-live-deploy/lib/orb-field.js';

test('a brain told words: each word is a memory where the brain holds it, as bright as it is there', () => {
  const b = B.createBrain(7); B.tell(b, 'lighthouse harbor'); B.tell(b, 'comet');
  const ideas = M.ideasOf(b), N = b.ws.nodes, C = b.concepts;
  assert.deepEqual(ideas.map((m) => m.word).sort(), ['comet', 'harbor', 'lighthouse']);
  for (const m of ideas) {
    const n = C.node[C.words.indexOf(m.word)];
    assert.equal(m.x, N.x[n]); assert.equal(m.y, N.y[n]); assert.equal(m.act, N.act[n]); assert.equal(m.kind, 'idea'); assert.equal(m.from, 'Verse Brain');
  }
  assert.deepEqual(M.ideasOf(B.createBrain(7)), [], 'a brain told nothing remembers nothing here');
  assert.deepEqual(M.ideasOf(null), []);
});

test('the brightest ideas first, at most MAX_IDEAS, each word once', () => {
  const b = B.createBrain(3); B.tell(b, 'alpha beta gamma delta'); B.tell(b, 'epsilon zeta eta theta'); B.tell(b, 'iota kappa');
  const C = b.concepts, N = b.ws.nodes; C.node.forEach((n, k) => { N.act[n] = k / 20; }); N.act[C.node[C.words.indexOf('alpha')]] = 1;
  const ideas = M.ideasOf(b);
  assert.equal(ideas.length, M.MAX_IDEAS); assert.equal(ideas[0].word, 'alpha');
  for (let i = 1; i < ideas.length; i++) assert.ok(ideas[i - 1].act >= ideas[i].act);
  assert.equal(new Set(ideas.map((m) => m.word)).size, ideas.length);
});

test('a brain on another tab: its posted words, newest first, what it wants brightest, each at a place of its own word', () => {
  const heard = M.heardOf({ type: 'state', words: ['moon', 'tide', 'Moon', 'river'], wants: ['tide'] });
  assert.deepEqual(heard.map((m) => m.word), ['river', 'Moon', 'tide']);
  assert.equal(heard.find((m) => m.word === 'tide').act, 1); assert.ok(heard.find((m) => m.word === 'river').act < 1);
  assert.deepEqual(M.placeOf('river'), M.placeOf('River'), 'the same word, the same place');
  for (const m of heard) { assert.ok(m.x >= 0.1 && m.x <= 0.9); assert.ok(m.y >= 0.12 && m.y <= 0.88); }
  assert.deepEqual(M.heardOf(null), []); assert.deepEqual(M.heardOf({ words: 'no' }), []);
});

test('the shared field: other cards show by name, the card\'s own slots never do', async () => {
  Field.reset(); Field.init(); const L = Field.layout;
  const echo = Field.provenanceOf('echo-field');
  Field.writeRegion(L.pos + 3 * 5, 3, [0.2, 0.4, 0], 'echo-field'); Field.writeRegion(L.act + 5, 1, [0.8], 'echo-field'); Field.writeRegion(L.prov + 5, 1, [echo], 'echo-field');
  const ad = await connectField({ load: async () => Field }), s = F.create(2), o = F.loadOrb(s, F.sealOrbSync(F.create(5), { x: 10, y: 10, mass: 3 }).snap);
  o.mass = 3; await ad.sync(s); // one live orb of the card's own
  const slots = ad.slots(); assert.ok(slots.some((x) => x.owner === 'echo-field')); assert.ok(slots.some((x) => x.code === ad.code), 'the card wrote its own orbs');
  const field = M.fieldOf(slots, { own: ad.code });
  assert.deepEqual(field.map((m) => m.from), ['Echo Field']); assert.equal(field[0].x, slots.find((x) => x.owner === 'echo-field').x);
  assert.equal(M.fieldOf(slots, { own: ad.code, skip: ['echo-field'] }).length, 0);
  Field.reset();
});

test('memoriesOf: the page\'s brain in words first, its numbers-only slots not shown twice; with no brain, the other tab\'s words', () => {
  const b = B.createBrain(9); B.tell(b, 'orbit');
  const slots = [{ slot: 1, x: 0.5, y: 0.5, act: 0.9, code: 11, owner: 'verse-brain' }, { slot: 2, x: 0.3, y: 0.3, act: 0.4, code: 12, owner: 'doodle-mind' }, { slot: 3, x: 0.1, y: 0.1, act: 1, code: 99, owner: 'agent-fluid-memory-orbs' }];
  const here = M.memoriesOf({ brain: b, slots, own: 99 });
  assert.deepEqual(here.map((m) => m.word || m.from), ['orbit', 'Doodle Mind']);
  const there = M.memoriesOf({ heard: { words: ['harbor'] }, slots, own: 99 });
  assert.deepEqual(there.map((m) => m.word || m.from), ['harbor', 'Verse Brain', 'Doodle Mind']);
  assert.deepEqual(M.memoriesOf({}), []);
  assert.deepEqual(M.wordsOf(here), ['orbit']);
});

test('the card says what it holds, in words', () => {
  assert.match(M.memorySays([]), /No memories yet/);
  const t = M.memorySays([{ kind: 'idea', word: 'comet', from: 'Verse Brain', act: 1 }, { kind: 'field', word: '', from: 'Echo Field', act: 1 }]);
  assert.match(t, /Verse remembers comet\./); assert.match(t, /From the shared field: Echo Field \(1\)\./);
});

test('the memories pull the fluid: its orbs are born on them far more often than by chance', () => {
  const mems = [{ x: 0.25, y: 0.3, act: 1 }, { x: 0.7, y: 0.65, act: 0.6 }], P = M.pullsOf(mems, F.GW, F.GH);
  assert.ok(P[0].dye > P[1].dye, 'a brighter memory pulls more');
  const born = (pull) => {
    let near = 0, all = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const s = F.create(seed), seen = new Set();
      for (let t = 0; t < 900; t++) {
        F.step(s, 1 / 60, {}); if (pull) for (const p of P) F.splat(s, p.x, p.y, 0, 0, p.dye, 2);
        for (const o of s.orbs) if (!seen.has(o.id)) { seen.add(o.id); all++; if (P.some((p) => Math.hypot(o.x - p.x, o.y - p.y) < 5)) near++; }
      }
    }
    return near / Math.max(1, all);
  };
  const without = born(false), withPull = born(true);
  assert.ok(withPull > 0.3, 'about half the orbs are born on a memory (' + withPull.toFixed(2) + ')');
  assert.ok(withPull > 3 * without, 'pulled ' + withPull.toFixed(2) + ' against ' + without.toFixed(2) + ' by chance');
});
