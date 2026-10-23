// coin (skills/coin.js): what a coin ask wants, and flips that are fair (or weighted as asked) over many throws.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import coin, { coinOf, flip } from '../void-live-deploy/skills/coin.js';

test('the asks: one coin, several, weighted, a style, a reason', () => {
  assert.deepEqual(coinOf('flip a coin'), { n: 1, p: 0.5, style: 'gold', for: '' });
  assert.deepEqual(coinOf('heads or tails?'), { n: 1, p: 0.5, style: 'gold', for: '' });
  assert.equal(coinOf('flip 5 coins').n, 5); assert.equal(coinOf('flip two coins').n, 2);
  assert.equal(coinOf('flip a coin 70% heads').p, 0.7); assert.equal(coinOf('flip a weighted coin 60% heads').p, 0.6);
  assert.equal(coinOf('flip a euro').style, 'euro'); assert.equal(coinOf('flip a bitcoin').style, 'bitcoin');
  assert.equal(coinOf('toss a coin for who pays').for, 'who pays');
  for (const e of coin.examples) assert.ok(coin.match(e.toLowerCase(), e), e);
  for (const n of coin.nearMisses) assert.ok(!coin.match(n.toLowerCase(), n), n);
});
test('fair and weighted over 100,000 flips', () => {
  let h = 0; for (let i = 0; i < 1e5; i++) h += flip(0.5); assert.ok(Math.abs(h / 1e5 - 0.5) < 0.01, 'fair: ' + h);
  h = 0; for (let i = 0; i < 1e5; i++) h += flip(0.7); assert.ok(Math.abs(h / 1e5 - 0.7) < 0.01, 'weighted: ' + h);
  assert.equal(flip(0.5, () => 0.49), true); assert.equal(flip(0.5, () => 0.5), false);
});
