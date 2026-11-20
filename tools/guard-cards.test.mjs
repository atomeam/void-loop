import test from 'node:test';
import assert from 'node:assert/strict';
import { POOL, PER_RUN, pickAsks, subjectOk, bodyWords, copyOk, judge, tally, RECUR } from './guards/cards.mjs';

test('recipes, several cities and other asks are in the pool, and a day of runs covers all of it', () => {
  assert.ok(POOL.filter((p) => /recipe/.test(p.ask)).length >= 5);
  assert.ok(POOL.filter((p) => /^weather in /.test(p.ask)).length >= 4);
  assert.ok(POOL.some((p) => !/recipe|weather/.test(p.ask)));
  const seen = new Set(); for (let k = 0; k < 4; k++) pickAsks(POOL, k * 6 * 3600e3).forEach((p) => seen.add(p.ask));
  assert.equal(seen.size, POOL.length);
  assert.equal(pickAsks(POOL, 5).length, PER_RUN);
});
test('the picture names what the card is about', () => {
  assert.equal(subjectOk(['paris'], 'Paris France rain night'), true);
  assert.equal(subjectOk(['pancake'], '', 'scene1 pancakes'), true);
  assert.equal(subjectOk(['lakeland'], 'a cube on a plate'), false);
  assert.equal(subjectOk(['x'], ''), false);
});
const CARD = 'Examine\nGuacamole\nSKILL — BODY AND MIND\n4 servings\nIngredients\n3 ripe avocados\n1 lime, juiced\nSteps\nHalve the avocados, scoop the flesh into a bowl and mash it with the lime juice.\ncopy card\nshare';
test('a copied card must carry the card: the words, not a cut piece', () => {
  assert.ok(bodyWords(CARD).includes('avocados') && !bodyWords(CARD).includes('examine') && !bodyWords(CARD).includes('share'));
  assert.deepEqual(copyOk(CARD, 'Guacamole\n4 servings\nIngredients\n3 ripe avocados\n1 lime, juiced\nSteps\nHalve the avocados, scoop the flesh into a bowl and mash it with the lime juice.').ok, true);
  const cut = copyOk(CARD, 'Guacamole\nIngredients\n3 ripe avocados\nSteps\nHalve the…');
  assert.equal(cut.ok, false); assert.equal(cut.cut, true);
  assert.equal(copyOk(CARD, 'Guacamole\n4 servings').ok, false);
  assert.equal(copyOk('', '').ok, true);
});
test('each failure is named in plain words', () => {
  const good = { card: true, expectArt: true, img: { w: 1024, complete: true }, onSubject: true, weak: false, copy: { ok: true, share: 1 } };
  assert.deepEqual(judge(good), []);
  assert.deepEqual(judge({ ...good, img: null }), ['placeholder, no art']);
  assert.deepEqual(judge({ ...good, img: null, paintWhy: 'cap' }), ['no art (cap)']);
  assert.match(judge({ ...good, weak: true })[0], /vision check dropped/);
  assert.deepEqual(judge({ ...good, onSubject: false }), ['art is not on the subject']);
  assert.deepEqual(judge({ ...good, copy: { ok: false, share: 0.4, cut: true } }), ['copied card cut off']);
  assert.match(judge({ ...good, copy: { ok: false, share: 0.4 } })[0], /missing text \(40% of it\)/);
  assert.deepEqual(judge({ card: false }), ['no card came back']);
  assert.deepEqual(judge({ card: true, expectArt: false, copy: null }), []);
});
test('a cause that keeps coming back goes to the coder once; one that stops is forgotten', () => {
  let mem, healed = [];
  for (let i = 0; i < RECUR + 2; i++) { const t = tally(mem, ['art is not on the subject']); mem = t.memory; healed.push(t.heal.length); }
  assert.deepEqual(healed, [0, 0, 1, 0, 0]);
  const gone = tally(mem, []);
  assert.deepEqual(gone.memory, { counts: {}, healed: {} });
});

test('only the card text counts: the badges, stats, memory note and reply box below the buttons are not expected in a copy', async () => {
  const { copyOk } = await import('./guards/cards.mjs');
  const visible = 'Examine\nGuacamole\nSKILL — BODY AND MIND\nthree avocados mashed roughly\nOpen the full Recipes page →\nCOPY CARD\nSAVE CARD\nI keep what you ask about on this device\nPROVEN\nMYTHIC · 209/603\nReply to what I said';
  assert.equal(copyOk(visible, 'Guacamole Skill Body and mind three avocados mashed roughly').ok, true);
  assert.equal(copyOk(visible, 'Guacamole').ok, false);
});
