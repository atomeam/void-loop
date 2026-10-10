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

test('the four services are rows in the product list, priced, and only the fix is on sale', () => {
  const want = [['one-time-fix', '$25', true], ['keep-it-running', '$49 a month', false], ['full-stack-audit', '$300', false], ['first-automation-setup', '$100', false]];
  assert.deepEqual(SERVICES.map((p) => p.id), want.map((w) => w[0]));
  for (const [id, price, sale] of want) {
    const p = productById(id);
    assert.ok(p, id);
    assert.equal(p.price, price, id);
    assert.equal(forSale(p), sale, id);
  }
  assert.equal(buyUrl(productById('one-time-fix')), 'https://moonbeam846.gumroad.com/l/eozcma');
});

test('a row shows name, price and one plain line; Buy only when on sale, the email otherwise', () => {
  const fix = rowHtml(productById('one-time-fix'), esc);
  assert.match(fix, /One-Time Fix/); assert.match(fix, /\$25/);
  assert.match(fix, /href="https:\/\/moonbeam846\.gumroad\.com\/l\/eozcma"[^>]*>Buy<\/a>$/);
  assert.ok(!fix.includes(CONTACT), 'a product on sale does not ask for email');
  for (const id of ['keep-it-running', 'full-stack-audit', 'first-automation-setup']) {
    const row = rowHtml(productById(id), esc);
    assert.match(row, /not on sale yet/, id);
    assert.ok(row.includes('mailto:' + CONTACT), id);
    assert.ok(!row.includes('>Buy<'), id + ' has no Buy link');
    assert.ok(!row.includes('/l/"') && !row.includes("/l/'"), id + ' never links an empty slug');
  }
});

test('the card reads the live store: a matched row shows the catalog price and link, an unavailable one the email', () => {
  const audit = productById('full-stack-audit');
  const catalog = [
    { slug: 'full-stack-audit', price_cents: 32500, currency: 'usd', recurrence: null, url: 'https://moonbeam846.gumroad.com/l/full-stack-audit', available: true },
    { slug: 'keep-it-running-membership', price_cents: 4900, currency: 'usd', recurrence: 'monthly', url: 'https://moonbeam846.gumroad.com/l/keep-it-running-membership', available: true },
  ];
  // the audit row has no slug yet (Adam pastes it), so nothing matches until then; a row whose slug is in the catalog overlays
  assert.equal(liveRowFor(audit, catalog), null, 'an empty slug never matches the catalog');
  const withSlug = { ...audit, gumroad: { ...audit.gumroad, slug: 'full-stack-audit' } };
  const live = liveRowFor(withSlug, catalog);
  assert.ok(live && live.price_cents === 32500);
  const row = rowHtml(withSlug, esc, live);
  assert.match(row, /\$325/); assert.ok(!row.includes('$300'), 'the live price replaces the fallback');
  assert.match(row, /href="https:\/\/moonbeam846\.gumroad\.com\/l\/full-stack-audit"/);
  const off = rowHtml(withSlug, esc, { ...live, available: false });
  assert.match(off, /not on sale yet/); assert.ok(off.includes('mailto:' + CONTACT));
  // url matching: a catalog row known only by its /l/ url still matches
  assert.ok(liveRowFor(withSlug, [{ url: 'https://moonbeam846.gumroad.com/l/full-stack-audit', price_cents: 1 }]));
  // the whole card falls back cleanly with no catalog at all
  assert.match(cardHtml(esc, null), /What Void sells/);
});
