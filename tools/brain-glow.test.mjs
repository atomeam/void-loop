// brain-glow: what Verse Brain was just told survives a reload (lib/brain-glow.js, lib/brain-host.js). Before, the kept knowledge came back
// with every idea dark, so the words told a moment before dropped out of the brightest ideas the memory orbs card shows. Checks:
//   - glowOf keeps the lit ideas brightest first, never a key-like word; loadGlow puts them back as bright as they were
//   - after a reload, the words just told are among the 8 brightest ideas again (they were not with the knowledge alone)
//   - the glow dims with the time away: half as bright after HALF_MS, dark after a few hours; a wrong record changes nothing
//   - the host keeps the glow when the page hides and a new host gives it back; Forget stops it; the card's restore keeps it
// Run: node --test tools/brain-glow.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as B from '../void-live-deploy/lib/brain.js';
import * as G from '../void-live-deploy/lib/brain-glow.js';
import { ideasOf } from '../void-live-deploy/lib/orb-memories.js';
import { startHost } from '../void-live-deploy/lib/brain-host.js';

const actOf = (b, w) => { const k = b.concepts.words.indexOf(w); return k < 0 ? -1 : b.ws.nodes.act[b.concepts.node[k]]; };
const run = (b, n) => { for (let i = 0; i < n; i++) B.stepBrain(b, { over: false }); return b; };
/** a visitor who told the brain a lot over a while, then two words just now */
function visited(seed) {
  const b = B.createBrain(seed);
  for (const t of ['make a sprite sheet', 'clean it up', '64px icons', 'pixel art cat', 'a blue clock', 'stars at night', 'paper boats', 'the old map']) { B.tell(b, t); run(b, 40); }
  B.tell(b, 'lighthouse harbor'); run(b, 10);
  return b;
}

test('glowOf: the lit ideas, brightest first, as bright as the brain holds them; never a key-like word', () => {
  const b = visited(5), g = G.glowOf(b, 1234);
  assert.equal(g.v, G.VERSION); assert.equal(g.at, 1234);
  assert.ok(g.ideas.length > 0 && g.ideas.length <= G.MAX_GLOW);
  for (let i = 1; i < g.ideas.length; i++) assert.ok(g.ideas[i - 1].act >= g.ideas[i].act);
  for (const { word, act } of g.ideas) assert.ok(Math.abs(act - actOf(b, word)) < 0.001, word);
  assert.ok(g.ideas.slice(0, 3).some((i) => i.word === 'lighthouse'), 'the word just told is among the brightest');
  const k = B.createBrain(2); B.tell(k, 'unlock a1b2c3d4e5f6g7h8'); assert.ok(!G.glowOf(k).ideas.some((i) => /\d/.test(i.word) && i.word.length >= 16), 'an owner key is never kept');
  assert.deepEqual(G.glowOf(B.createBrain(3)).ideas, [], 'a brain told nothing has no glow');
  assert.deepEqual(G.glowOf(null).ideas, []);
});

test('after a reload the words just told are among the 8 brightest ideas again; with the knowledge alone they were not', () => {
  const a = visited(9), kept = structuredClone(B.knowledgeOf(a)), glow = structuredClone(G.glowOf(a, 1000));
  const before = ideasOf(a).map((m) => m.word); assert.ok(before.includes('lighthouse') && before.includes('harbor'));
  const old = B.createBrain(9); B.loadKnowledge(old, kept);
  const dark = ideasOf(old).map((m) => m.word); assert.ok(!dark.includes('lighthouse'), 'before the fix: gone after a reload (' + dark.join(', ') + ')');
  const now = B.createBrain(9); B.loadKnowledge(now, kept); const lit = G.loadGlow(now, glow, 1000 + 2000);
  assert.ok(lit.includes('lighthouse') && lit.includes('harbor'));
  const back = ideasOf(now).map((m) => m.word);
  assert.ok(back.includes('lighthouse') && back.includes('harbor'), 'after the fix: still there (' + back.join(', ') + ')');
  assert.equal(back[0], before[0], 'the brightest idea is the same one');
  assert.ok(Math.abs(actOf(now, 'lighthouse') - actOf(a, 'lighthouse')) < 0.01, 'as bright as it was, two seconds later');
});

test('the glow dims with the time away, and a wrong record changes nothing', () => {
  const a = B.createBrain(4); B.tell(a, 'comet'); const g = G.glowOf(a, 0), was = g.ideas[0].act;
  const half = B.createBrain(4); G.loadGlow(half, g, G.HALF_MS); assert.ok(Math.abs(actOf(half, 'comet') - was / 2) < 0.001, 'half as bright after HALF_MS');
  const week = B.createBrain(4); assert.deepEqual(G.loadGlow(week, g, 3 * 60 * 60 * 1000), []); assert.equal(actOf(week, 'comet'), -1, 'a visit hours later starts dark');
  const held = B.createBrain(4); B.tell(held, 'comet'); G.loadGlow(held, { ...g, ideas: [{ word: 'comet', act: 0.1 }] }, 0); assert.equal(actOf(held, 'comet'), 1, 'never dims an idea it holds brighter');
  for (const bad of [null, {}, { v: 2, ideas: [] }, { v: 1, ideas: 'no' }, { v: 1, at: 0, ideas: [{ word: 'Not a word!', act: 1 }, { word: 'x', act: 1 }, { word: 'fine', act: 'no' }] }]) {
    const b = B.createBrain(6); assert.deepEqual(G.loadGlow(b, bad, 0), []); assert.equal(b.concepts.words.length, 0);
  }
  assert.notEqual(G.glowKey(g), G.glowKey(G.glowOf(run(a, 120), 0)), 'the key changes as the glow dims');
});

const store = () => { const box = { k: null, g: null, glows: 0 }; return { box, loadKept: async () => box.k, keep: async (k) => { box.k = structuredClone(k); return true; }, loadGlow: async () => box.g, keepGlow: async (g) => { box.g = structuredClone(g); box.glows++; return true; } }; };
const page = () => { const doc = new EventTarget(); doc.visibilityState = 'visible'; return { doc, win: new EventTarget() }; };
const settle = () => new Promise((r) => setTimeout(r, 0));

test('the host keeps the glow when the page hides, and the next page\'s host gives it back; Forget stops it', async () => {
  let clock = 50000; const st = store(), p1 = page();
  const a = startHost({ ...p1, store: st, ticking: false, bridge: false, seed: 7, now: () => clock }); await a.ready;
  assert.equal(await a.saveGlow(), false, 'nothing told, nothing kept');
  p1.doc.dispatchEvent(new CustomEvent('void:ask', { detail: { text: 'lighthouse harbor' } })); await settle();
  p1.doc.visibilityState = 'hidden'; p1.doc.dispatchEvent(new Event('visibilitychange')); await settle(); await settle();
  assert.equal(st.box.glows, 1); assert.ok(st.box.g.ideas.some((i) => i.word === 'lighthouse')); a.stop();
  clock += 3000;
  const b = startHost({ ...page(), store: st, ticking: false, bridge: false, seed: 7, now: () => clock }); await b.ready;
  assert.ok(b.lit.includes('lighthouse') && b.lit.includes('harbor'), 'the reloaded page lights them again');
  assert.ok(ideasOf(b.brain).map((m) => m.word).includes('lighthouse'));
  assert.equal(b.onlyHere(), true, 'the card may still give back what it was thinking');
  const stale = B.createBrain(7); B.tell(stale, 'paper boats'); B.loadWorking(b.brain, structuredClone(B.workingOf(stale))); b.warm(b.brain);
  assert.ok(ideasOf(b.brain).map((m) => m.word).includes('lighthouse'), 'the card\'s restore keeps the glow too');
  b.forgot(); const n = st.box.glows; assert.equal(await b.save(true), false); assert.equal(st.box.glows, n, 'after Forget nothing is kept');
  b.stop();
});
