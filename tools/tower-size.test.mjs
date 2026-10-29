// Versus by weight: what a page weighs, which sites get measured, and that the lightest measured site stands first. Run: node --test tools/tower-size.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { measure, weightOf, weightBand, bytesLabel, controlsOf } from '../void-live-deploy/lib/tower-weight.js';
import { tower, easeLine } from '../void-live-deploy/lib/tower.js';
import { planSizes, usable, isTool } from './tower-size.mjs';

test('a page is weighed by its bytes, scripts, elements and routes', () => {
  const html = '<html><head><script src="/a.js"></script><link rel="stylesheet" href="/s.css"></head><body><a href="/one">1</a><a href="/two">2</a><a href="https://x.com/o">o</a><p>hi</p></body></html>';
  const m = measure({ html, assets: [{ url: '/a.js', bytes: 1000 }, { url: '/s.css', bytes: 500 }], host: 'a.com' });
  assert.equal(m.scripts, 1); assert.equal(m.styles, 1); assert.equal(m.routes, 2); assert.equal(m.bytes, Buffer.byteLength(html) + 1500); assert.ok(m.nodes >= 8);
  assert.equal(measure({ html, sitemapUrls: 400 }).routes, 400, 'a sitemap count wins over links');
  assert.equal(weightOf({ bytes: 800, scripts: 0, nodes: 10, routes: 0 }), 900); assert.equal(weightOf({}), null);
  assert.deepEqual([900, 20000, 90000, 900000, null].map(weightBand), [0, 1, 2, 3, null]);
  assert.deepEqual([512, 1400, 25000, 2.4e6].map(bytesLabel), ['512 B', '1.4 KB', '25 KB', '2.4 MB']);
});

test('the lightest weighed site is the target; a heavy popular-looking one waits; an unweighed one comes after the weighed', () => {
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
  const file = { sites: { 'a.com': { at: '2026-10-20', bytes: 1, controls: 3 }, 'b.com': { at: '2026-08-01', bytes: 1, controls: 3 } } };
  assert.deepEqual(planSizes({ sites, file, now }).map((s) => s.host), ['c.com', 'b.com']);
  assert.equal(planSizes({ sites, file, now, max: 1 }).length, 1);
  // a fresh row weighed before the controls count existed is read again, after the unmeasured and before the stale; a refused row waits its 30 days
  const old = { sites: { ...file.sites, 'd.com': { at: '2026-10-28', bytes: 1 }, 'e.com': { at: '2026-10-28', refused: true } } };
  assert.deepEqual(planSizes({ sites: [...sites, { host: 'd.com' }, { host: 'e.com' }], file: old, now }).map((s) => s.host), ['c.com', 'd.com', 'b.com']);
});

test('the controls of a home page are its links, inputs, buttons and selects, counted as domains/targets/sycophanthex.json counts them (33 links and 1 input make 34)', () => {
  const page = '<html><head><script>document.write("<a href=x>no</a>")</script><style>a{}</style></head><body><!-- <a href="/old">no</a> -->'
    + '<form><input name="q" type="text"><input type="hidden" name="t"></form>' + Array.from({ length: 33 }, (_, i) => '<a href="/p' + i + '">p</a>').join('') + '<a name="top">anchor, no href</a></body></html>';
  assert.deepEqual(controlsOf(page), { links: 33, inputs: 1, buttons: 0, selects: 0, total: 34 });
  assert.deepEqual(controlsOf('<textarea></textarea><button>a</button><input type="submit"><div role="button">b</div><select><option>1</option></select>'), { links: 0, inputs: 1, buttons: 3, selects: 1, total: 5 });
  assert.equal(measure({ html: page }).controls, 34);
});

test('the queue is smallest first: the fewest controls, then the fewer bytes; a counted site before one only weighed, and that before an unweighed one', () => {
  const rank = { ranks: {}, order: {}, list: {} };
  // isitchristmas.com is the lightest by weight but has more controls: it stands behind both counted sites with fewer controls
  const size = { sites: {
    'isitchristmas.com': { bytes: 700, controls: 9, scripts: 0, nodes: 20, routes: 0 },
    'calculator.net': { bytes: 2.4e6, controls: 2, scripts: 40, nodes: 9000, routes: 600 },
    'random.org': { bytes: 90000, controls: 2, scripts: 3, nodes: 300, routes: 10 },
    'justflipacoin.com': { bytes: 500, scripts: 0, nodes: 10, routes: 0 } } };
  const t = tower([], {}, null, null, rank, size), at = (id) => t.floors.findIndex((f) => f.id === id);
  const ids = ['random number', 'calculator', 'is it', 'coin flip'];
  for (const id of ids) assert.ok(t.floors.some((f) => f.id === id), id + ' is a floor');
  assert.ok(at('random number') < at('calculator'), 'the same controls: the fewer bytes first');
  assert.ok(at('calculator') < at('is it'), 'fewer controls first, however heavy');
  assert.ok(at('is it') < at('coin flip'), 'a counted site before one only weighed');
  assert.match(easeLine(t.floors[at('is it')]), /has 9 controls on its home page and weighs 700 B/);
});

test('an offline notice, an error page or a page with nothing to use is not weighed (counterscope.ae was 728 bytes of "is offline")', () => {
  const pad = '<p>' + 'a tool that does a job. '.repeat(16) + '</p>';
  assert.equal(usable('<html><body><h1>Counterscope is offline.</h1>' + pad + '<script></script></body></html>'), false, 'an offline notice');
  assert.equal(usable('<html><body>' + pad + '</body></html>'), false, 'text and nothing to use');
  assert.equal(usable('<html><body>' + pad + '<form><input></form></body></html>'), true, 'a working tool');
});
test('an empty reply or a bot wall is not weighed, so it can never stand as the lightest site', () => {
  assert.equal(usable(''), false); assert.equal(usable('<html></html>'), false); assert.equal(usable('<html><body><p>' + 'a real tool page. '.repeat(15) + '</p><button>go</button></body></html>'), true);
});

test('a community, archive or news page is not a tool even with a search box; a page that does something with an input is (sycophanthex.com is a fanfiction archive)', () => {
  const arch = '<html><body><h1>Archive</h1><p>Welcome to our fanfiction community. Read the forum, see the staff, enter the contest. Copyright 2006 all rights reserved. Terms of service.</p><form><input name="q"><button>Search</button></form></body></html>';
  assert.equal(isTool(arch), false);
  const tool = '<html><body><h1>Hex to decimal</h1><p>Type a number.</p><input id="n" type="text"><button id="go">Convert</button><pre id="out"></pre></body></html>';
  assert.equal(isTool(tool), true);
  assert.equal(isTool('<html><body><p>Just words about hex.</p></body></html>'), false, 'nothing to use');
});
