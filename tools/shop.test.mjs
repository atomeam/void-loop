// tests for the shopping pages (lib/shop-core.js, lib/shop-sites.js, lib/shop-de.js, the table's pages): carriers named from tracking numbers by format and check digit,
// barcodes and their check digits, the cart's totals with tax and shipping by store, CSV and link round trips, unit prices, return windows, store links, the asks that reach
// the pages, the German words and the floor's pages. secret-scan: ok (no keys here; the numbers are carriers' and GS1's published samples or made with the check digits)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as C from '../void-live-deploy/lib/shop-core.js';
import { DE } from '../void-live-deploy/lib/shop-de.js';
import { SHOP_SITES, shopAskOf } from '../void-live-deploy/lib/shop-sites.js';
import { FLOORS, LANES, LANE_PAGES } from '../void-live-deploy/lib/tower.js';
import { probeFor } from './tower-probes.mjs';

const best = (n) => (C.detectCarrier(n)[0] || {});
test('carriers named from valid tracking numbers, by their check digits', () => {
  for (const [n, id] of [['1Z999AA10123456784', 'ups'], ['1z 999 aa1 0123456784', 'ups'], ['RA123456785US', 'usps'], ['RR123456785GB', 'royalmail'], ['CP123456785CN', 'chinapost'], ['986578788855', 'fedex'], ['3318810025', 'dhl'], ['9400111899223197428497', 'usps'], ['9400 1118 9922 3197 4284 97', 'usps']]) {
    const b = best(n); assert.equal(b.id, id, n); assert.equal(b.sure, 'check digit', n); assert.ok(/^https:\/\//.test(b.url) && b.url.includes(C.cleanNumber(n)), n);
  }
});
test('carriers named by format where no check digit is published', () => {
  assert.equal(best('TBA123456789012').id, 'amazon'); assert.equal(best('TBA123456789012').sure, 'format');
  assert.equal(best('C11031500001879').id, 'ontrac'); assert.equal(best('01234567890123').id, 'dpd');
  const c16 = C.detectCarrier('1234567890123456').map((x) => x.id); assert.ok(c16.includes('canadapost') && c16.includes('evri'));
});
test('a wrong check digit is caught and ranked last; numbers that fit nothing name nothing', () => {
  for (const n of ['1Z999AA10123456785', 'RR123456784GB', 'RA123456786US', '9400111899223197428490']) assert.equal(best(n).sure, 'bad check digit', n);
  assert.equal(best('986578788856').sure, 'format'); assert.equal(best('3318810026').sure, 'format'); // a fedex or dhl shape whose check digit fails is only a format guess
  for (const n of ['', 'hello', '1234', '1Z12', 'ABC']) assert.deepEqual(C.detectCarrier(n), [], n);
  assert.ok(C.detectCarrier('3318810025').every((x) => !/[<>"]/.test(x.url)));
});
test('check digit functions against published samples', () => {
  assert.ok(C.upsOk('1Z999AA10123456784')); assert.ok(!C.upsOk('1Z999AA10123456780'));
  assert.ok(C.s10Ok('RA123456785US')); assert.ok(!C.s10Ok('RA123456780US'));
  assert.ok(C.fedex12Ok('986578788855')); assert.ok(C.dhl10Ok('3318810025'));
  assert.equal(C.gs1Digit('400638133393'), 1); assert.equal(C.gs1Digit('03600029145'), 2); assert.equal(C.gs1Digit('7351353'), 7);
  assert.ok(C.isbn10Ok('0306406152')); assert.ok(!C.isbn10Ok('0306406153')); assert.ok(C.isbn10Ok('080442957X'));
});
test('barcodes read: EAN-13, UPC-A, EAN-8, ISBN-10 and -13, with the right check digit named', () => {
  assert.deepEqual(C.readBarcode('4006381333931'), { code: '4006381333931', kind: 'EAN-13', valid: true, want: 1 });
  assert.deepEqual(C.readBarcode('4006381333932'), { code: '4006381333932', kind: 'EAN-13', valid: false, want: 1 });
  assert.equal(C.readBarcode('036000291452').kind, 'UPC-A'); assert.deepEqual(C.lookupCodes(C.readBarcode('036000291452')), ['036000291452', '0036000291452']);
  assert.equal(C.readBarcode('73513537').kind, 'EAN-8'); assert.equal(C.readBarcode('9780306406157').kind, 'ISBN-13');
  const i = C.readBarcode('0-306-40615-2'); assert.equal(i.kind, 'ISBN-10'); assert.equal(i.code, '9780306406157'); assert.ok(i.valid);
  assert.equal(C.readBarcode('oat milk'), null); assert.equal(C.readBarcode('12345'), null);
});
test('product rows from the open databases are cleaned, and only their own image hosts are kept', () => {
  const db = C.PRODUCT_DBS[0];
  const p = C.productOf({ code: '3017624010701', product_name: ' Nutella ', brands: 'Ferrero,Nutella', quantity: '400 g', categories: 'Spreads, Sweet spreads', image_front_small_url: 'https://images.openfoodfacts.org/images/products/301/762/401/0701/front_en.200.jpg', nutriscore_grade: 'e' }, db);
  assert.deepEqual([p.name, p.brand, p.qty, p.category, p.grade, p.db], ['Nutella', 'Ferrero', '400 g', 'Sweet spreads', 'e', 'off']); assert.ok(p.image.startsWith('https://images.openfoodfacts.org/'));
  assert.equal(C.productOf({ code: '1', product_name: 'x', image_small_url: 'https://evil.example/x.jpg' }, db).image, '');
  assert.equal(C.productOf({ code: '1', product_name: 'x', image_small_url: 'javascript:alert(1)' }, db).image, '');
  assert.ok(C.productUrl(db, '3017624010701').startsWith('https://world.openfoodfacts.org/api/v2/product/3017624010701.json?fields='));
  assert.ok(C.searchUrl(db, 'oat milk & <b>').includes('search_terms=oat%20milk%20%26%20%3Cb%3E'));
});
test('cart totals: whole cents, tax per store rounded, shipping free over a threshold, ticked items left out when asked', () => {
  const items = [{ name: 'Milk', qty: 2, price: '1.19', store: 'Aldi' }, { name: 'Bread', qty: 1, store: 'Aldi' }, { name: 'TV', qty: 1, price: '399', store: 'Amazon' }, { name: 'Socks', qty: 3, price: 0.1, store: '', done: true }];
  const t = C.cartTotals(items, { taxPct: 8, ship: { Amazon: { cost: 599, freeOver: 3500 }, Aldi: { cost: 300 } } });
  const by = Object.fromEntries(t.stores.map((s) => [s.store, s]));
  assert.equal(by.Aldi.subtotal, 238); assert.equal(by.Aldi.tax, 19); assert.equal(by.Aldi.shipping, 300); assert.equal(by.Aldi.total, 557);
  assert.equal(by.Amazon.subtotal, 39900); assert.equal(by.Amazon.tax, 3192); assert.equal(by.Amazon.shipping, 0); assert.ok(by.Amazon.free);
  assert.equal(by[''].subtotal, 30); assert.equal(t.count, 7); assert.equal(t.unpriced, 1); assert.equal(t.total, 557 + 43092 + 32);
  assert.equal(t.stores[t.stores.length - 1].store, '', 'the items with no store come last');
  const open = C.cartTotals(items, { onlyOpen: true }); assert.equal(open.count, 4);
  const near = C.cartTotals([{ name: 'A', price: '30', store: 'S' }], { ship: { S: { cost: 499, freeOver: 3500 } } }); assert.equal(near.stores[0].toFree, 500); assert.equal(near.total, 3499);
  assert.equal(C.cartTotals([], {}).total, 0); assert.equal(C.cartTotals([{ name: 'x', price: 1, qty: 5000 }]).count, 999);
});
test('prices read in the common ways', () => {
  for (const [v, c] of [['3,99', 399], ['$1,299.00', 129900], ['1.299,00', 129900], ['€3.99', 399], ['12', 1200], ['0.5', 50], [2.5, 250], ['', null], ['abc', null], [-1, null]]) assert.equal(C.cents(v), c, String(v));
});
test('the list goes to CSV and back, with formulas kept as text and totals left out on the way in', () => {
  const items = [{ name: '=HYPERLINK("x")', qty: 2, price: 150, store: 'Aldi', note: 'a, "b"' }, { name: 'Eggs', qty: 1, price: null, done: true }];
  const csv = C.listCsv(items); assert.ok(csv.startsWith('name,qty,price,line_total,store'));
  assert.ok(csv.includes('"\'=HYPERLINK(""x"")"')); assert.ok(/grand total/.test(csv));
  const back = C.listFromCsv(csv); assert.equal(back.length, 2); assert.equal(back[0].name, '=HYPERLINK("x")'); assert.equal(back[0].price, 150); assert.equal(back[0].note, 'a, "b"'); assert.ok(back[1].done);
  assert.deepEqual(C.listFromCsv('name\nApples\n\nPears\n').map((x) => x.name), ['Apples', 'Pears']);
});
test('a list and a wish list travel in a link and come back the same', () => {
  const items = [{ name: 'Café crème ☕', qty: 3, price: 250, store: 'Lidl', done: true, url: 'https://example.com/a?b=1' }, { name: 'Bad', url: 'javascript:alert(1)' }];
  const got = C.listFromToken(C.listToToken(items, 'Wochenende'));
  assert.equal(got.title, 'Wochenende'); assert.equal(got.items[0].name, 'Café crème ☕'); assert.equal(got.items[0].qty, 3); assert.equal(got.items[0].price, 250); assert.ok(got.items[0].done); assert.equal(got.items[0].url, 'https://example.com/a?b=1'); assert.equal(got.items[1].url, '');
  assert.equal(C.listFromToken('not-a-token'), null); assert.equal(C.listFromToken(''), null);
});
test('unit prices: the cheapest per 100 g first, packs of several, different kinds of unit flagged', () => {
  const r = C.unitPrices([{ label: 'small', price: '3.99', size: '500 g' }, { label: 'big', price: '6.49', size: '1 kg' }, { label: 'six', price: '2', size: '6 x 50 g' }]);
  assert.deepEqual(r.map((x) => x.label), ['big', 'six', 'small']); assert.ok(r[0].best && !r[1].best); assert.equal(r[0].per, 64.9); assert.equal(r[2].more, 23);
  assert.equal(C.sizeOf('1.5 l').amount, 1500); assert.equal(C.sizeOf('12 rolls').base, 'item'); assert.equal(Math.round(C.sizeOf('16 oz').amount), 454);
  const mixed = C.unitPrices([{ price: 1, size: '1 l' }, { price: 1, size: '1 kg' }]); assert.ok(mixed.every((x) => x.mixed && !x.best));
  assert.equal(C.perLabel('item'), 'each'); assert.equal(C.perLabel('ml'), 'per 100 ml');
});
test('return windows count down to the last day', () => {
  assert.deepEqual(C.returnWindow('2026-10-01', 30, '2026-10-26'), { due: '2026-10-31', left: 5, state: 'soon' });
  assert.equal(C.returnWindow('2026-10-01', 30, '2026-10-31').state, 'today'); assert.equal(C.returnWindow('2026-10-01', 30, '2026-11-01').state, 'closed'); assert.equal(C.returnWindow('2026-10-20', 30, '2026-10-21').state, 'open');
  assert.equal(C.returnWindow('soon', 30, '2026-10-01'), null);
  const ev = C.reminderEvents([{ id: 'a', title: 'x', date: '2026-11-02' }, { title: 'no date' }]); assert.equal(ev.length, 1); assert.ok(ev[0].allDay);
  const st = C.priceStats([{ price: 500, at: '2026-10-01' }, { price: 420, at: '2026-10-03', store: 'Amazon' }, { price: 450, at: '2026-10-05' }], 460);
  assert.deepEqual([st.lowest, st.latest, st.change, st.targetMet], [420, 450, -50, true]);
});
test('store searches: each https, the words encoded, nothing else in the address', () => {
  const l = C.storeLinks('lego & "bricks"'); assert.ok(l.length >= 10);
  for (const x of l) { assert.ok(x.url.startsWith('https://'), x.url); assert.ok(x.url.includes('lego%20%26%20%22bricks%22'), x.url); assert.ok(['confirmed', 'partly', 'unconfirmed'].includes(x.check)); assert.ok(!/tag=|affiliate|ref=/.test(x.url), x.url); }
  assert.ok(C.storeLinks('x', 'de').every((x) => ['de', 'world'].includes(x.region))); assert.deepEqual(C.storeLinks(''), []);
  for (const c of Object.values(C.CARRIERS)) { assert.ok(c.url('AB1').startsWith('https://')); assert.ok(['confirmed', 'partly', 'unconfirmed'].includes(c.check)); }
});
test('the asks that reach the shopping pages, and the look-alikes that do not', () => {
  for (const [a, to] of [['track 1Z999AA10123456784', '/shop/track/?track=1Z999AA10123456784'], ['where is my package RR123456785GB', '/shop/track/?track=RR123456785GB'], ['barcode 3017624010701', '/shop/barcode/?code=3017624010701'], ['isbn 0306406152', '/shop/barcode/?code=0306406152'],
    ['compare prices of oat milk', '/shop/product/?q=oat%20milk'], ['where to buy lego', '/shop/product/?q=lego'], ['shopping', '/shop/'], ['wish list', '/shop/wishlist/'], ['grocery list', '/shop/list/'], ['package tracker', '/shop/track/'], ['unit price calculator', '/shop/#unit'], ['return deadline', '/shop/#returns'], ['barcode scanner', '/shop/barcode/']]) assert.equal(shopAskOf(a), to, a);
  for (const a of ['flights to lisbon', 'track my run', 'a store', 'price of bitcoin', 'what is a barcode', 'merge pdf', 'buy me a coffee']) assert.equal(shopAskOf(a), '', a);
});
test('every word the shopping screen shows has its German', () => {
  const ui = fs.readFileSync(new URL('../void-live-deploy/lib/shop-ui.js', import.meta.url), 'utf8'), words = new Set();
  for (const m of ui.matchAll(/\bt\('((?:[^'\\]|\\.)*)'\)/g)) words.add(m[1]);
  for (const m of ui.matchAll(/\bt\(([^()]*\?[^()]*)\)/g)) for (const q of m[1].matchAll(/'((?:[^'\\]|\\.)*)'/g)) words.add(q[1]);
  for (const m of ui.matchAll(/panel\('[a-z]+', '((?:[^'\\]|\\.)*)'(?:, '((?:[^'\\]|\\.)*)')?\)/g)) { words.add(m[1]); if (m[2]) words.add(m[2]); }
  const skip = (w) => /^[.[]|^(?:lang|a|section|li|div|p|q|code|track|partly|confirmed|check digit|bad check digit)$|^li\[/.test(w);
  const missing = [...words].map((w) => w.replace(/\\u2019/g, '’')).filter((w) => !skip(w) && !DE[w]); assert.deepEqual(missing, []);
  for (const r of SHOP_SITES) assert.ok(r.de && r.de.h1 && r.de.intro, r.path);
});
test('the shopping floor and its lane: each site names its own page, which exists, with its app, its share picture and a probe', () => {
  const site = new URL('../void-live-deploy', import.meta.url).pathname, shop = FLOORS.filter((f) => f.id === 'shopping' || f.lane === 'shopping');
  assert.equal(shop.length, 1 + (LANES.shopping || []).length); assert.equal(shop[shop.length - 1].id, 'shopping', 'Amazon is the lane\'s last fight');
  for (const f of shop) {
    assert.ok(f.page && f.page.startsWith('/shop/'), f.id); assert.ok(fs.existsSync(site + f.page + 'index.html'), f.page); assert.ok(fs.existsSync(site + f.page + 'app.js'), f.page);
    assert.ok(fs.existsSync(site + '/og/' + f.page.replace(/^\/|\/$/g, '').replace(/\//g, '-') + '.png'), 'share picture of ' + f.page);
    const p = probeFor(f.id); assert.equal(p.verse, f.page, f.id); assert.ok(p.truth.length >= 4 && p.facts.length >= 9, f.id); assert.ok(p.ask.verse.startsWith(f.page), f.id);
    for (const a of f.extra) assert.ok(p.askParts[a], f.id + ' asks about ' + a);
    const row = SHOP_SITES.find((r) => r.path === f.page); assert.ok(row && row.lane === f.id, f.id);
  }
  for (const [id, p] of Object.entries(LANE_PAGES)) if (id.startsWith('shopping: ')) assert.ok(SHOP_SITES.some((r) => r.path === p), id);
  const hub = fs.readFileSync(site + '/shop/index.html', 'utf8'); assert.ok(/og:image" content="https:\/\/a-to-mind.com\/og\/shop.png"/.test(hub)); assert.ok(/does not stock or ship goods/.test(hub));
});
