// The whole card as a picture (lib/card-image.js). Run: node --test tools/card-image.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { cardSvg, wrap, CARD_W, CARD_H, BLEED } from '../void-live-deploy/lib/card-image.js';

const d = { title: 'Casablanca', text: 'A 1942 film. '.repeat(40), typeLine: 'Film · Song — 1942', kind: 'Film', cost: 3, rarity: 'Rare', hue: 190, key: 'Casablanca', adds: 'It adds a fact.', power: 7, toughness: 12, income: 3, number: '012/221' };
const dims = (s) => { const m = /viewBox="0 0 (\d+) (\d+)"/.exec(s); return [+m[1], +m[2]]; };
test('a card is 63 x 88 mm: 744 x 1039 at 300 dpi, and bleed adds 35 px (3 mm) on every side', () => {
  const [w, h] = dims(cardSvg(d)); assert.equal([w, h].join('x'), '744x1039'); assert.ok(Math.abs(w / h - 63 / 88) < 0.001);
  const [bw, bh] = dims(cardSvg(d, { bleed: true })); assert.equal(bw, w + 2 * BLEED); assert.equal(bh, h + 2 * BLEED); assert.equal(BLEED, 35); assert.equal(CARD_W, 744); assert.equal(CARD_H, 1039);
});
test('it is a standalone, inert picture holding the frame, art, type line, text, stats and number', () => {
  const s = cardSvg(d);
  assert.ok(!/<script|<foreignObject|<image|javascript:|href="(?!#)/i.test(s)); assert.ok(!/https?:\/\/(?!www\.w3\.org)/.test(s));
  for (const w of ['Casablanca', 'FILM', '012/221', 'Adds to V01D', 'vc-art-svg|<svg x="40"']) assert.match(s, new RegExp(w));
  assert.ok(s.length < 40000, String(s.length));
});
test('every text field is escaped', () => {
  const evil = '<script>alert(1)</script>"&\'';
  const s = cardSvg({ ...d, title: evil, text: evil, typeLine: evil, adds: evil, number: evil, tested: evil });
  assert.ok(!/<script>/.test(s)); assert.match(s, /&lt;script&gt;/);
});
test('long text is wrapped and cut with an ellipsis', () => {
  const l = wrap(d.text, 50, 5); assert.equal(l.length, 5); assert.ok(l.every((x) => x.length <= 50)); assert.ok(l[4].endsWith('…'));
  assert.deepEqual(wrap('', 50, 5), []);
});
