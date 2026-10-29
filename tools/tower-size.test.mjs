// Versus by weight: what a page weighs, which sites get measured, and that the lightest measured site stands first. Run: node --test tools/tower-size.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { measure, weightOf, weightBand, bytesLabel } from '../void-live-deploy/lib/tower-weight.js';
import { tower, easeLine } from '../void-live-deploy/lib/tower.js';
import { planSizes } from './tower-size.mjs';

test('a page is weighed by its bytes, scripts, elements and routes', () => {
  const html = '<html><head><script src="/a.js"></script><link rel="stylesheet" href="/s.css"></head><body><a href="/one">1</a><a href="/two">2</a><a href="https://x.com/o">o</a><p>hi</p></body></html>';
  const m = measure({ html, assets: [{ url: '/a.js', bytes: 1000 }, { url: '/s.css', bytes: 500 }], host: 'a.com' });
  assert.equal(m.scripts, 1); assert.equal(m.styles, 1); assert.equal(m.routes, 2); assert.equal(m.bytes, Buffer.byteLength(html) + 1500); assert.ok(m.nodes >= 8);
  assert.equal(measure({ html, sitemapUrls: 400 }).routes, 400, 'a sitemap count wins over links');
  assert.equal(weightOf({ bytes: 800, scripts: 0, nodes: 10, routes: 0 }), 900); assert.equal(weightOf({}), null);
  assert.deepEqual([900, 20000, 90000, 900000, null].map(weightBand), [0, 1, 2, 3, null]);
  assert.deepEqual([512, 1400, 25000, 2.4e6].map(bytesLabel), ['512 B', '1.4 KB', '25 KB', '2.4 MB']);
});

test('the lightest weighed site is the target; a heavy popular-looking one waits; an unweighed one comes after the weighed (owner, 2026-10-29)', () => {
  const rank = { ranks: {}, order: {}, list: {} };
  const size = { sites: { 'calculator.net': { bytes: 2.4e6, scripts: 40, nodes: 9000, routes: 600 }, 'isitchristmas.com': { bytes: 700, scripts: 0, nodes: 20, routes: 0 } } };
  const t = tower([], {}, null, null, rank, size), cur = t.floors.find((f) => f.state === 'current');
  assert.equal(cur.id, 'is it'); assert.equal(cur.weight, 700 + 200);
  assert.ok(t.floors.findIndex((f) => f.id === 'calculator') < t.floors.findIndex((f) => f.id === 'random number'), 'a weighed site stands before an unweighed one');
  assert.match(easeLine(cur), /weighs 700 B over 0 scripts, 20 elements and 0 routes \(1 KB club\)/);
  assert.match(easeLine(t.floors.find((f) => f.id === 'random number')), /not weighed yet/);
});

test('planSizes reads the unmeasured first, keeps fresh rows, and never opens a no-rival site', () => {
  const now = Date.parse('2026-10-29'), sites = [{ host: 'a.com' }, { host: 'b.com' }, { host: 'c.com' }];
  const file = { sites: { 'a.com': { at: '2026-10-20', bytes: 1 }, 'b.com': { at: '2026-08-01', bytes: 1 } } };
  assert.deepEqual(planSizes({ sites, file, now }).map((s) => s.host), ['c.com', 'b.com']);
  assert.equal(planSizes({ sites, file, now, max: 1 }).length, 1);
});
