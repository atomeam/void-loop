// brain-remembers: Verse Brain's working memory and attention survive a full page reload, through the shared field (asked 2026-10-29
// through the coordinator: "today a reload starts it cold"). The brain holds a part in lib/shared-field.js (skills/field.js); persist()
// keeps it on the device, and after a reload recall() gives it back to a new, cold brain. Nothing is made up: a record of the wrong shape,
// a brain that already has ideas, and a forgotten record all leave the brain as it is. Run: node --test tools/brain-remembers.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as B from '../void-live-deploy/lib/brain.js';
import * as Field from '../void-live-deploy/lib/shared-field.js';
import { linkBrain } from '../void-live-deploy/lib/brain-field.js';

/** a brain that has been told things and has run a while, as a visitor leaves it */
function warmBrain(seed = 7) {
  const b = B.createBrain(seed);
  B.ask(b, 'lighthouse harbor fog');
  for (let t = 0; t < 120; t++) B.stepBrain(b, { x: 0.2 + 0.001 * t, y: 0.7, over: true });
  B.ask(b, 'harbor bells');
  for (let t = 0; t < 80; t++) B.stepBrain(b, { x: 0.8, y: 0.2, over: true });
  return b;
}
/** what the card shows of a brain: its ideas (the orbs), its spotlight and its goals */
const seen = (b) => ({ ideas: B.embodiment(b).filter((e) => e.organ === 'concepts').map((e) => e.label).sort(), focus: b.focus.region, x: +b.focus.x.toFixed(6), y: +b.focus.y.toFixed(6),
  goals: b.mind.goals.map((g) => g.word).sort(), thinking: b.board.thinking, nodes: b.ws.nodes.n, ticks: b.ticks });
/** a device store that outlives a "reload" (Field.reset) */
function device() { let rec = null; return { get: async () => (rec ? structuredClone(rec) : null), put: async (m) => { rec = structuredClone(m); return true; }, del: async () => { rec = null; return true; }, get rec() { return rec; } }; }
const part = (get) => ({ save: () => B.workingOf(get()), load: (w) => (B.isCold(get()) ? B.loadWorking(get(), w).length > 0 : false) });

test('a new brain takes a kept working memory back: the same ideas, spotlight, goals and workspace', () => {
  const a = warmBrain(), w = structuredClone(B.workingOf(a));
  const b = B.createBrain(99); assert.ok(B.isCold(b));
  assert.deepEqual(B.loadWorking(b, w), ['workspace', 'ideas', 'attention', 'goals']);
  assert.deepEqual(seen(b), seen(a));
  assert.deepEqual(Array.from(b.ws.layers.act), Array.from(a.ws.layers.act), 'the tissue is the same');
  assert.deepEqual(Array.from(b.ws.layers.focus), Array.from(a.ws.layers.focus), 'the spotlight layer is the same');
  assert.deepEqual(B.relatedOf(b, 'harbor'), B.relatedOf(a, 'harbor'), 'the links between ideas are the same');
  for (let t = 0; t < 30; t++) B.stepBrain(b, { x: 0.5, y: 0.5 }); // it runs on from there
  assert.ok(b.ticks === a.ticks + 30 && b.concepts.words.length === a.concepts.words.length);
});

test('a reload through the shared field: persist, a fresh page, recall, and the card\'s brain is the one from before', async () => {
  const dev = device();
  Field.reset(); Field.useStore(dev);
  const a = warmBrain(), L = linkBrain(Field); L.publish(a);
  const release = Field.hold('verse-brain', part(() => a));
  assert.equal(await Field.persist(), true);
  const slotsBefore = Field.slots().filter((s) => s.owner === 'verse-brain').map((s) => s.slot);
  assert.ok(slotsBefore.length >= 4, 'its ideas were in the field');
  for (const r of dev.rec.slots['verse-brain']) assert.ok(r.every(Number.isFinite), 'the field keeps numbers only');
  release();

  // the page reloads: the field is empty, the card makes a cold brain and holds its part, then the kept record is read
  Field.reset(); Field.useStore(dev);
  const box = { b: B.createBrain(1234) }; assert.ok(B.isCold(box.b));
  Field.hold('verse-brain', part(() => box.b));
  assert.deepEqual(await Field.recall(), ['verse-brain']);
  assert.deepEqual(seen(box.b), seen(a));
  assert.deepEqual(Field.slots().filter((s) => s.owner === 'verse-brain').map((s) => s.slot), slotsBefore, 'its ideas are back in the field where they were');
  assert.equal(await Field.recall(), await Field.recall(), 'one read of the device a page');
});

test('nothing is made up: a warm brain keeps its own ideas, a wrong record changes nothing, Forget leaves the next page cold', async () => {
  const dev = device();
  Field.reset(); Field.useStore(dev);
  const a = warmBrain(); Field.hold('verse-brain', part(() => a)); await Field.persist();

  Field.reset(); Field.useStore(dev);
  const mine = B.createBrain(5); B.ask(mine, 'violin'); const before = seen(mine);
  Field.hold('verse-brain', part(() => mine));
  assert.deepEqual(await Field.recall(), [], 'a brain with ideas of its own is not written over');
  assert.deepEqual(seen(mine), before);

  const cold = B.createBrain(6);
  for (const bad of [null, {}, { v: 9 }, { ...B.workingOf(a), ws: { ...B.workingOf(a).ws, layers: {} } }, { ...B.workingOf(a), concepts: { words: ['x'], node: [9999] } }]) {
    assert.deepEqual(B.loadWorking(cold, bad), []); assert.ok(B.isCold(cold));
  }
  assert.deepEqual(Field.revive({ v: 1, parts: { 'verse-brain': { v: 1 } } }), []);

  assert.equal(await Field.forgetKept(), true);
  Field.reset(); Field.useStore(dev);
  const after = B.createBrain(8); Field.hold('verse-brain', part(() => after));
  assert.deepEqual(await Field.recall(), []); assert.ok(B.isCold(after), 'after Forget a reload starts cold');
  Field.reset(); Field.useStore();
});

test('a card that opens later on the same page gets the part back too, and a skill with no part keeps nothing', async () => {
  const dev = device();
  Field.reset(); Field.useStore(dev);
  assert.equal(await Field.persist(), false, 'no skill holds a part: nothing kept');
  const a = warmBrain(); const rel = Field.hold('verse-brain', part(() => a)); await Field.persist(); rel();
  const later = B.createBrain(3); Field.hold('verse-brain', part(() => later)); // the card opened again on this page
  assert.deepEqual(seen(later).ideas, seen(a).ideas);
  Field.reset(); Field.useStore();
});
