import test from 'node:test';
import assert from 'node:assert/strict';
import { luminance, coloursOf, contrastOf, corpus, score, regressions, raised, weakest, METRICS, KEYS, RARITIES, SLACK } from './art-score.mjs';
import { artSvg, KINDS } from '../void-live-deploy/lib/card-art.js';

test('luminance and contrast follow WCAG: black on white is 21:1, a colour against itself is 1:1', () => {
  assert.ok(Math.abs(luminance(0, 0, 0)) < 1e-9); assert.ok(Math.abs(luminance(0, 0, 100) - 1) < 1e-6);
  const svg = '<svg><rect fill="hsl(0 0% 0%)"/><rect fill="#ffffff"/></svg>';
  assert.ok(Math.abs(contrastOf(svg) - 21) < 0.01, String(contrastOf(svg)));
  assert.equal(contrastOf('<svg><rect fill="#abcdef"/></svg>'), 1, 'one colour has no contrast');
  assert.equal(contrastOf('<svg/>'), 1);
  const c = coloursOf('<g fill="hsl(400 50% 40%)"/><g fill="#f00"/>'); assert.deepEqual(c.hues, [40]); assert.equal(c.lums.length, 2);
});

test('the corpus is every kind x six keys x three rarities, drawn the same way every time', () => {
  const a = corpus(), b = corpus();
  assert.equal(a.length, KINDS.length * KEYS.length * RARITIES.length);
  assert.deepEqual(a.map((c) => c.svg), b.map((c) => c.svg), 'deterministic');
  assert.ok(a.every((c) => c.svg.startsWith('<svg')));
});

test('the score is six properties between 0 and 100, a composite, and a contrast per kind', () => {
  const s = score(corpus());
  assert.deepEqual(Object.keys(s.metrics), METRICS);
  for (const m of METRICS) assert.ok(s.metrics[m] >= 0 && s.metrics[m] <= 100, m + ' ' + s.metrics[m]);
  assert.ok(Number.isInteger(s.composite) && s.composite >= 0 && s.composite <= 100);
  assert.deepEqual(Object.keys(s.perKind).sort(), [...KINDS].sort());
});

test('it can tell good art from bad: one flat colour for every card scores near zero where it should', () => {
  const flat = score(corpus(() => '<svg><rect fill="#808080"/></svg>'), { draw: () => '<svg><rect fill="#808080"/></svg>', motifNames: ['moon', 'key'] });
  assert.equal(flat.metrics.contrast, 0);
  assert.ok(flat.metrics.unique < 1, 'every card the same picture: ' + flat.metrics.unique);
  assert.equal(flat.metrics.motif, 0, 'the subject word changes nothing');
  assert.equal(flat.metrics.ladder, 0, 'a mythic card draws no more than a common one');
  const real = score(corpus());
  assert.ok(real.composite > flat.composite + 30, real.composite + ' vs ' + flat.composite);
});

test('the real art: every card is its own picture, a higher rarity draws more, and the subject words change it', () => {
  const s = score(corpus());
  assert.equal(s.metrics.unique, 100);
  assert.equal(s.metrics.ladder, 100);
  assert.ok(s.metrics.motif >= 50, 'motif ' + s.metrics.motif);
});

test('the floor never falls: a drop in the composite or a property by more than the slack is a regression; a rise raises it', () => {
  const floor = { composite: 80, metrics: { contrast: 70, hues: 90, unique: 100, weight: 80, motif: 90, ladder: 100 } };
  const same = { composite: 80, metrics: { ...floor.metrics }, perKind: {} };
  assert.deepEqual(regressions(same, floor), []);
  assert.match(regressions({ ...same, composite: 79 }, floor)[0], /composite 79 is below the floor 80/);
  assert.deepEqual(regressions({ ...same, metrics: { ...floor.metrics, contrast: 70 - SLACK } }, floor), [], 'within the slack');
  assert.match(regressions({ ...same, metrics: { ...floor.metrics, contrast: 70 - SLACK - 0.1 } }, floor).join(), /contrast .* dropped more than/);
  assert.deepEqual(regressions(same, null), []);
  const up = raised({ composite: 83, metrics: { ...floor.metrics, contrast: 75, weight: 60 } }, floor);
  assert.equal(up.composite, 83); assert.equal(up.metrics.contrast, 75); assert.equal(up.metrics.weight, 80, 'a property that fell keeps its old floor');
  assert.equal(raised({ composite: 70, metrics: { ...floor.metrics } }, floor).composite, 80, 'the floor never lowers');
  assert.equal(raised(same, null).composite, 80);
});

test('weakest names the lowest property and the lowest kinds', () => {
  const w = weakest({ metrics: { contrast: 40, hues: 90 }, perKind: { Song: 10, Film: 50, Book: 30, Idea: 90 } }, 2);
  assert.match(w[0], /contrast is the weakest property \(40\)/); assert.deepEqual(w.slice(1), ['contrast of Song cards is 10', 'contrast of Book cards is 30']);
});

test('the art function itself is pure for the corpus: the same card twice is the same string', () => {
  const c = { key: 'alpha Film', name: 'alpha', kind: 'Film', rarity: 'rare' };
  assert.equal(artSvg(c), artSvg({ ...c }));
});
