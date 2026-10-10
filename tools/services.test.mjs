// The pricing card (void-live-deploy/skills/services.js): what Void sells, from lib/products.js.
// Run: node --test tools/services.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import skill, { SERVICES, servicesOf, rowHtml, liveRowFor, cardHtml, CONTACT } from '../void-live-deploy/skills/services.js';
import { forSale, buyUrl, productById } from '../void-live-deploy/lib/products.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

test('the card opens on the ways people ask to buy, and not on look-alikes', () => {
  for (const ask of ['pricing', 'Pricing?', 'show me your pricing', 'what do you sell', 'What do you offer', 'hire you', 'can i hire you', 'how do i hire you', 'fix my automation', 'my zap stopped working', 'what does void cost', 'how much is void', 'price list'])
    assert.ok(servicesOf(ask), ask);
  for (const ask of ['price of gold', 'fix my code', 'hire a plumber', 'what can you do', 'price of bitcoin', 'what is pricing', 'fix my car', 'the price is right', ''])
    assert.equal(servicesOf(ask), null, ask);
  for (const e of skill.examples) assert.ok(skill.match(e.toLowerCase(), e), e);
  for (const e of skill.nearMisses) assert.ok(!skill.match(e.toLowerCase(), e), e);
});

test('the four services are rows in the product list, priced, and every one is on sale', () => {
  const want = [['one-time-fix', '$25', 'eozcma'], ['keep-it-running', '$49 a month', 'keep-it-running-membership'], ['full-stack-audit', '$325', 'full-stack-audit'], ['first-automation-setup', '$100', 'first-automation-setup']];
  assert.deepEqual(SERVICES.map((p) => p.id), want.map((w) => w[0]));
  for (const [id, price, slug] of want) {
    const p = productById(id);
    assert.ok(p, id);
    assert.equal(p.price, price, id);
    assert.ok(forSale(p), id);
    assert.equal(buyUrl(p), 'https://moonbeam846.gumroad.com/l/' + slug, id);
  }
});

test('a row shows name, price and one plain line; Buy only when on sale, the email otherwise', () => {
  const fix = rowHtml(productById('one-time-fix'), esc);
  assert.match(fix, /One-Time Fix/); assert.match(fix, /\$25/);
  assert.match(fix, /href="https:\/\/moonbeam846\.gumroad\.com\/l\/eozcma"[^>]*>Buy<\/a>$/);
  assert.ok(!fix.includes(CONTACT), 'a product on sale does not ask for email');
  for (const id of ['keep-it-running', 'full-stack-audit', 'first-automation-setup']) {
    const row = rowHtml(productById(id), esc);
    assert.match(row, /Buy<\/a>$/, id + ' is buyable from the fallback card too');
  }
  // a row with no slug (a future service before its product exists) still says so instead of linking
  const unmade = { name: 'Someday Service', price: '$1', adds: 'not yet', gumroad: { slug: '' } };
  const row = rowHtml(unmade, esc);
  assert.match(row, /not on sale yet/);
  assert.ok(row.includes('mailto:' + CONTACT));
  assert.ok(!row.includes('>Buy<') && !row.includes('/l/"') && !row.includes("/l/'"), 'never links an empty slug');
});

test('the card reads the live store: a matched row shows the catalog price and link, an unavailable one the email', () => {
  const audit = productById('full-stack-audit');
  const catalog = [
    { slug: 'full-stack-audit', price_cents: 32500, currency: 'usd', recurrence: null, url: 'https://moonbeam846.gumroad.com/l/full-stack-audit', available: true },
    { slug: 'keep-it-running-membership', price_cents: 4900, currency: 'usd', recurrence: 'monthly', url: 'https://moonbeam846.gumroad.com/l/keep-it-running-membership', available: true },
  ];
  // a row with no slug never matches the catalog; a row whose slug is in the catalog overlays
  assert.equal(liveRowFor({ ...audit, gumroad: { ...audit.gumroad, slug: '' } }, catalog), null, 'an empty slug never matches the catalog');
  const withSlug = audit;
  const live = liveRowFor(withSlug, catalog);
  assert.ok(live && live.price_cents === 32500);
  const row = rowHtml(withSlug, esc, live);
  assert.match(row, /\$325/);
  assert.ok(!rowHtml({ ...withSlug, price: '$300' }, esc, live).includes('$300'), 'the live price replaces a stale fallback');
  assert.match(row, /href="https:\/\/moonbeam846\.gumroad\.com\/l\/full-stack-audit"/);
  const off = rowHtml(withSlug, esc, { ...live, available: false });
  assert.match(off, /not on sale yet/); assert.ok(off.includes('mailto:' + CONTACT));
  // url matching: a catalog row known only by its /l/ url still matches
  assert.ok(liveRowFor(withSlug, [{ url: 'https://moonbeam846.gumroad.com/l/full-stack-audit', price_cents: 1 }]));
  // the whole card falls back cleanly with no catalog at all
  assert.match(cardHtml(esc, null), /What Void sells/);
});
