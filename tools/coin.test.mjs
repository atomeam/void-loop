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

// a stand-in for the page's elements: any property is another stand-in, any call returns one; dataset and what is set are kept
const fake = () => new Proxy(function () {}, {
  get(t, k) { if (k === 'dataset') return (t.ds = t.ds || {}); if (k === Symbol.iterator) return function* () {}; if (k === 'then' || k === Symbol.toPrimitive) return undefined; if (k === 'length') return 0; return k in t ? t[k] : (t[k] = fake()); },
  set(t, k, v) { t[k] = v; return true; },
  apply() { return fake(); },
});
test('the Flip page card asks for the coin open on it, and the stage card opens the page on the same coin', async () => {
  const { cardAsk } = await import('../void-live-deploy/lib/flip-card.js');
  const { pageOfFlip } = await import('../void-live-deploy/skills/coin.js');
  const { pageOfCard } = await import('../void-live-deploy/lib/card-frame.js');
  for (const ask of ['flip 3 coins', 'flip a coin 70% heads', 'flip a euro', 'flip a Morgan dollar', 'toss a coin for who pays']) {
    assert.equal(cardAsk('?q=' + encodeURIComponent(ask)), ask, ask);
    const page = pageOfFlip(ask); assert.deepEqual(pageOfCard('coin', page), [page, 'Coin flip'], ask);
    assert.equal(new URLSearchParams(page.slice(page.indexOf('?'))).get('q'), ask, 'the card opens the same coin');
  }
  for (const s of ['', '?q=', '?q=what+is+a+coin', '?q=bitcoin+price', '?x=flip+a+coin', '?q=' + 'flip a coin '.repeat(9), null]) assert.equal(cardAsk(s), '', String(s));
  assert.equal(pageOfFlip("flip a coin (it's mine)"), '/flip/', 'a query the card frame would not take opens the page itself');
  const el = fake(); let shown = null, r;
  const had = 'document' in globalThis; globalThis.document = fake(); // the card draws its coins with document.createElement
  try { r = coin.run('flip 3 coins', { esc: (s) => String(s), showPage: (build) => { build(el); shown = el; return el; }, stage: { ask() {} } }); } finally { if (!had) delete globalThis.document; }
  assert.equal(r, 'coin'); assert.equal(shown.dataset.page, '/flip/?q=flip%203%20coins');
  assert.equal(coin.run('what is a coin', { esc: String, showPage: () => { throw new Error('drew'); } }), 'none');
});
