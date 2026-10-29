// fuel (skills/fuel.js): which trip asks it reads, and the cost, fuel needed and cost per mile or km it draws for exact inputs (mpg and L/100km, $/gal and per liter, € and £).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fuel from '../void-live-deploy/skills/fuel.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const card = async (ask) => { let html = null; const r = await fuel.run(ask, { esc, showPage: (fn) => { const el = { innerHTML: '' }; fn(el); html = el.innerHTML; return el; } }); return { r, html }; };
const big = (h) => (h.match(/font-size:48px[^>]*>([^<]+)</) || [])[1];
const li = (h, label) => (h.match(new RegExp('<b>' + label + '</b> ([^<]+)<')) || [])[1];

test('examples taken, near misses refused, and a few more asks', () => {
  for (const e of fuel.examples) assert.ok(fuel.match(e.toLowerCase(), e), e);
  for (const n of fuel.nearMisses) assert.ok(!fuel.match(n.toLowerCase(), n), n);
  for (const a of ['diesel for 100 km at 50 mpg $4 a gallon', 'petrol for 300 miles at 25 mpg €1.90 per liter']) assert.ok(fuel.match(a.toLowerCase(), a), a);
  for (const a of ['gas cost for 320 miles at 28 mpg', 'gas cost at 28 mpg $3.59 a gallon', 'fuel for 320 miles $3.59 a gallon', 'how far is 320 miles', 'gas cost for 320 miles at 500 mpg $3.59 a gallon']) assert.ok(!fuel.match(a.toLowerCase(), a), a);
});

test('miles, mpg and $ a gallon: 320 mi at 28 mpg, $3.59/gal is $41.03, 11.43 gal, $0.13 a mile', async () => {
  const { r, html } = await card('gas cost for 320 miles at 28 mpg $3.59 a gallon');
  assert.equal(r, 'fuel'); assert.equal(big(html), '$41.03');
  assert.equal(li(html, 'Fuel needed'), '11.43 gal (43.26 L)'); assert.equal(li(html, 'Per mile'), '$0.13');
  assert.ok(html.includes('320 miles · 28 mpg · $3.59 / gal'), html);
  assert.equal(big((await card('how much fuel for a 500 mile trip at 30 mpg gas is $3.40')).html), '$56.67');
  assert.equal(big((await card('trip fuel 280 miles 32 mpg $3.25/gal')).html), '$28.44');
  assert.equal(big((await card('gasoline for 180 miles at 35 mpg $3.10 per gallon')).html), '$15.94');
});

test('km and L/100km at a price per liter: 400 km at 7 L/100km, 1.85 a liter is 28 L and $51.80', async () => {
  const { html } = await card('fuel for 400 km at 7 L/100km 1.85 per liter');
  assert.equal(big(html), '$51.80'); assert.equal(li(html, 'Fuel needed'), '28 L (7.4 gal)'); assert.equal(li(html, 'Per km'), '$0.13');
  assert.ok(html.includes('400 km · 7 L/100km · $1.85 / L'), html);
});

test('mixed units and other currencies: km at mpg, € and £', async () => {
  const km = await card('diesel for 100 km at 50 mpg $4 a gallon'); // 62.14 mi / 50 = 1.24 gal
  assert.equal(big(km.html), '$4.97'); assert.equal(li(km.html, 'Fuel needed'), '1.24 gal (4.7 L)');
  const eu = await card('petrol for 300 miles at 25 mpg €1.90 per liter'); // 12 gal = 45.42 L × 1.90
  assert.equal(big(eu.html), '€86.31'); assert.equal(li(eu.html, 'Fuel needed'), '45.42 L (12 gal)'); assert.equal(li(eu.html, 'Per mile'), '€0.29');
  const uk = await card('fuel for 200 miles at 40 mpg £1.45 per litre'); // 5 gal = 18.93 L × 1.45
  assert.equal(big(uk.html), '£27.44'); assert.equal(li(uk.html, 'Fuel needed'), '18.93 L (5 gal)');
  // not asserted: "£6.50 a gallon" is priced per liter too (the GBP branch tests /l/ against the whole ask), a bug reported, not fixed here
});

test('an ask it does not read draws nothing', async () => {
  const { r, html } = await card('gas stations near me'); assert.equal(r, 'none'); assert.equal(html, null);
});

test('the unit next to the price decides per gallon or per litre, not an l anywhere in the ask', async () => {
  const gal = await card('fuel for 200 miles at 40 mpg £6.50 a gallon'); // 5 gal × £6.50; "fuel" has an l, the price is still a gallon's
  assert.equal(big(gal.html), '£32.50'); assert.equal(li(gal.html, 'Fuel needed'), '5 gal (18.93 L)'); assert.ok(gal.html.includes('£6.50 / gal'), gal.html);
  assert.equal(big((await card('petrol for 200 miles at 40 mpg £6.50/gal')).html), '£32.50');
  assert.equal(big((await card('fuel for 200 miles at 40 mpg £1.45 a litre')).html), '£27.44'); // the litre still read as a litre
  assert.equal(big((await card('fuel for 200 miles at 40 mpg £1.45')).html), '£27.44'); // a bare £ price is a UK pump price, per litre
  assert.equal(big((await card('fuel for 400 km at 7 L/100km $5 per gallon')).html), '$36.98'); // 28 L = 7.397 gal × $5
});
