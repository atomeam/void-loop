// Rent or buy (lib/rentbuy.js and skills/rentbuy.js): the month-by-month sum on cases worked by hand, the parse of the visitor's
// numbers, the card against the rent-vs-buy calculator of /calculators/, and the asks it must leave alone.
import test from 'node:test';
import assert from 'node:assert/strict';
import { rentVsBuy } from '../void-live-deploy/lib/rentbuy.js';
import skill, { rentBuyNumbers, isRentBuy } from '../void-live-deploy/skills/rentbuy.js';
import { run } from '../void-live-deploy/lib/calculators.js';

const flat = { downPct: 100, ratePct: 0, rentGrowthPct: 0, homeGrowthPct: 0, ownPct: 0, buyPct: 0, sellPct: 0, investPct: 0 };

test('a home paid in cash, with no costs and no growth: the buyer saves the rent and is ahead after the first year', () => {
  const o = rentVsBuy({ ...flat, price: 300000, rent: 1000, years: 3 });
  assert.equal(o.breakEven, 1);
  assert.deepEqual(o.years.map((y) => [y.year, Math.round(y.buy), Math.round(y.rent)]), [[1, 312000, 300000], [2, 324000, 300000], [3, 336000, 300000]]);
});

test('selling costs the buyer must earn back: 6% of 300,000 is 18,000, so the 1,000 a month saved catches up in year 2', () => {
  const o = rentVsBuy({ ...flat, price: 300000, rent: 1000, sellPct: 6, years: 3 });
  assert.deepEqual(o.years.map((y) => Math.round(y.buy - y.rent)), [-6000, 6000, 18000]);
  assert.equal(o.breakEven, 2);
});

test('a 0% loan: the buyer pays price ÷ months and owes the rest, so wealth is the equity paid in', () => {
  const o = rentVsBuy({ ...flat, downPct: 0, price: 120000, termYears: 10, rent: 1000, years: 2 });
  assert.equal(Math.round(o.pay), 1000);
  assert.deepEqual(o.years.map((y) => Math.round(y.buy)), [12000, 24000]);
  assert.deepEqual(o.years.map((y) => Math.round(y.rent)), [0, 0]);
});

test('a rent far below the cost of owning keeps renting ahead', () => {
  const o = rentVsBuy({ price: 900000, rent: 1200, years: 30 });
  assert.equal(o.breakEven, null);
  assert.equal(o.aheadAtEnd, 'rent');
});

test('the calculator of /calculators/ gives the same break-even and wealth as the card', () => {
  const o = rentVsBuy({ price: 350000, rent: 1800, years: 12 });
  const r = run('rent-vs-buy', { price: '350000', rent: '1800', stay: '12' });
  const v = Object.fromEntries(r.outputs.map((x) => [x.k, x.value]));
  assert.equal(v.be, o.breakEven ? o.breakEven + ' years' : 'not within 12 years');
  assert.ok(Math.abs(v.buyw - o.years[11].buy) < 0.01 && Math.abs(v.rentw - o.years[11].rent) < 0.01);
});

test('the numbers an ask gives are read; the rest stay examples', () => {
  assert.deepEqual(rentBuyNumbers('should i rent or buy a $350k house if my rent is $1800'), { price: 350000, rent: 1800 });
  assert.deepEqual(rentBuyNumbers('is it cheaper to rent or buy a 500k condo, rent is 2500 a month, staying 10 years'), { price: 500000, rent: 2500, years: 10 });
  assert.deepEqual(rentBuyNumbers('buying vs renting a home at 6%'), { ratePct: 6 });
  assert.deepEqual(rentBuyNumbers('should i rent or buy'), {});
});

test('it takes rent-or-buy asks about a home and leaves the others', () => {
  for (const a of skill.examples) assert.ok(isRentBuy(a.toLowerCase()), a);
  for (const a of skill.nearMisses) assert.ok(!isRentBuy(a.toLowerCase()), a);
  for (const a of ['should i rent or buy a tux', 'rent vs buy textbooks', 'buy or rent a camera']) assert.ok(!isRentBuy(a), a);
});

test('the card shows the break-even, the numbers used, the examples marked, and links to the calculator', () => {
  const el = { dataset: {}, innerHTML: '' };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  assert.equal(skill.run('should i rent or buy a $350k house if my rent is $1800', { esc, showPage: (b) => b(el) }), 'rentbuy');
  assert.match(el.innerHTML, /Buying gets ahead after \d+ years|Renting stays ahead for all 30 years/);
  assert.match(el.innerHTML, /\$350,000 home or \$1,800 a month/);
  assert.match(el.innerHTML, /\(example\)/);
  assert.ok(el.dataset.page.startsWith('/calculators/?calc=rent-vs-buy&price=350000&'));
  assert.doesNotMatch(el.innerHTML, /\b(?:superior|better long-term|you should|we recommend)\b/i);
});
