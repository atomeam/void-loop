// Everyday US prices ("how much is a gallon of milk") come from the BLS monthly average prices through the markets skill
// (exam prices, lists run 12). Run: node --test tools/markets-groceries.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import markets, { groceryAsk, whichPriceAsk, PRICE_KINDS } from '../void-live-deploy/skills/markets.js';

test('groceries: everyday price asks name a BLS series, other asks stay elsewhere', () => {
  assert.equal(groceryAsk('how much is a gallon of milk')?.grocery[1], 'APU0000709112');
  assert.equal(groceryAsk('price of a dozen eggs')?.grocery[1], 'APU0000708111');
  assert.equal(groceryAsk('how much does gas cost')?.grocery[1], 'APU000074714');
  for (const q of ['how much is bitcoin', 'how much is a gallon in liters', 'cost of living', 'how much milk should i drink']) assert.equal(groceryAsk(q), null, q);
  assert.ok(markets.match('how much is a gallon of milk', 'how much is a gallon of milk'));
});
test('groceries: the card shows the latest US average and the year-ago change', async () => {
  const j = { Results: { series: [{ data: [{ year: '2026', period: 'M09', periodName: 'September', value: '4.106' }, { year: '2025', period: 'M09', periodName: 'September', value: '4.000' }] }] } };
  const el = { innerHTML: '' }, seen = [];
  const r = await markets.run('how much is a gallon of milk', { fetch: async (u) => { seen.push(u); return { ok: true, json: async () => j }; }, showPage: (f) => { f(el); return el; }, esc: String });
  assert.equal(r, 'markets');
  assert.match(seen[0], /APU0000709112$/);
  assert.match(el.innerHTML, /\$4\.11/);
  assert.match(el.innerHTML, /up 2\.6% from a year before/);
});
test('which price: a bare price ask gets a which-one card with a tap per kind (lists run 13)', async () => {
  for (const q of ['price', 'Price?', 'how much', 'the price']) assert.ok(whichPriceAsk(q), q);
  for (const q of ['bitcoin price', 'price of milk', 'price is right', 'how much is bitcoin']) assert.equal(whichPriceAsk(q), null, q);
  assert.ok(markets.match('price', 'price'));
  const el = { innerHTML: '' };
  assert.equal(await markets.run('price', { showPage: (f) => { f(el); return el; }, esc: String }), 'markets');
  assert.match(el.innerHTML, /which one do you mean/i);
  for (const [, ask] of PRICE_KINDS) assert.ok(el.innerHTML.includes('data-ask="' + ask + '"'), ask);
});
