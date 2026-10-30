// Versus by weight: what a page weighs, which sites get measured, and that the lightest measured site stands first. Run: node --test tools/tower-size.test.mjs
import { test } from 'node:test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { measure, weightOf, weightBand, bytesLabel, controlsOf, trustedControls, rankableControls } from '../void-live-deploy/lib/tower-weight.js';
import { tower, easeLine } from '../void-live-deploy/lib/tower.js';
import { planSizes, usable, isTool, renderedControls, openBrowser, within, shellOf } from './tower-size.mjs';

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

test('a shell count is not a count: a home page under 2 controls (a script-built shell, a sign-in wall) never jumps the queue (linkedin.com/jobs read 1)', () => {
  assert.equal(trustedControls({ controls: 1 }), null); assert.equal(trustedControls({ controls: 0 }), null); assert.equal(trustedControls({}), null);
  assert.equal(trustedControls({ controls: 2 }), 2); assert.equal(trustedControls({ controls: '34' }), 34);
  const rank = { ranks: {}, order: {}, list: {} };
  const size = { sites: { 'linkedin.com': { bytes: 177301, controls: 1, scripts: 19, nodes: 53, routes: 0 }, 'isitchristmas.com': { bytes: 700, controls: 9, scripts: 0, nodes: 20, routes: 0 } } };
  const t = tower([], {}, null, null, rank, size), at = (id) => t.floors.findIndex((f) => f.id === id);
  assert.ok(at('is it') < at('jobs'), 'the counted site stands before the shell');
  assert.doesNotMatch(easeLine(t.floors[at('jobs')]), /control/, 'the card does not repeat the shell count');
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

test('with a browser, a row counted only from raw html is read again, after the unmeasured and before the stale; without one it is not', () => {
  const now = Date.parse('2026-10-29'), sites = ['a.com', 'b.com', 'c.com', 'd.com', 'e.com'].map((host) => ({ host }));
  const file = { sites: { 'a.com': { at: '2026-10-28', bytes: 1, controls: 3 }, 'b.com': { at: '2026-10-28', bytes: 1, controls: 9, counted: 'rendered', shell: 'none' }, 'c.com': { at: '2026-08-01', bytes: 1, controls: 4, counted: 'rendered' }, 'e.com': { at: '2026-10-28', bytes: 1, controls: 5, counted: 'unrendered' } } };
  assert.deepEqual(planSizes({ sites, file, now, rendered: true }).map((s) => s.host), ['d.com', 'a.com', 'c.com'], 'a page that would not render waits its 30 days');
  assert.deepEqual(planSizes({ sites, file, now }).map((s) => s.host), ['d.com', 'c.com']);
});

test('the rendered count is the page after its scripts ran, not its shell; a page that will not render gives null and closes its context', async () => {
  const shell = '<html><body><div id="app"></div><script src="/app.js"></script></body></html>';
  const built = '<html><body><div id="app"><nav>' + Array.from({ length: 8 }, (_, i) => '<a href="/p' + i + '">p</a>').join('') + '</nav><input name="q"><button>Go</button></div></body></html>';
  let closed = 0, routed = 0;
  const browser = (fail, at = 'https://x.com/', html = built) => ({ newContext: async () => ({ close: async () => { closed++; }, newPage: async () => ({ route: async () => { routed++; }, goto: async () => { if (fail) throw new Error('timeout'); }, url: () => at, waitForLoadState: async () => {}, content: async () => html }) }) });
  assert.equal(controlsOf(shell).total, 0);
  assert.equal(await renderedControls(browser(false), 'https://x.com/'), 10);
  assert.equal(await renderedControls(browser(true, 'about:blank'), 'https://x.com/'), null, 'it never left about:blank: not rendered');
  assert.equal(await renderedControls(browser(true), 'https://x.com/'), 10, 'the load event timed out but the page was built: its controls count');
  assert.equal(await renderedControls(browser(true, 'https://x.com/', shell), 'https://x.com/'), null, 'timed out with nothing built: not rendered');
  assert.equal(closed, 4); assert.equal(routed, 4);
  const keep = process.env.VOID_TEST_BROWSER; process.env.VOID_TEST_BROWSER = '/no/such/browser';
  try { if (!fs.existsSync('/opt/pw-browsers/chromium')) assert.equal(await openBrowser(), null, 'no browser: the raw count stands'); } finally { if (keep === undefined) delete process.env.VOID_TEST_BROWSER; else process.env.VOID_TEST_BROWSER = keep; }
});

test('the target stands first and the card says it is the target, not the easiest site left; with no target the card says easiest', async () => {
  const sk = (await import('../void-live-deploy/skills/tower.js')).default, rank = { ranks: {}, order: {}, list: {} };
  const size = { sites: { 'isitchristmas.com': { bytes: 700, controls: 3, scripts: 0, nodes: 20, routes: 0 }, 'calculator.net': { bytes: 2.4e6, controls: 400, scripts: 40, nodes: 9000, routes: 600 } } };
  const free = tower([], {}, null, null, rank, size), c0 = free.floors.find((f) => f.state === 'current');
  assert.equal(c0.id, 'is it'); assert.equal(c0.pinned, false);
  const h0 = sk.towerHtml(free, (s) => String(s)); assert.match(h0, /easiest site left: /); assert.doesNotMatch(h0, /the target until Verse surpasses it/);
  const held = tower([], {}, null, null, rank, size, 'calculator'), c1 = held.floors.find((f) => f.state === 'current');
  assert.equal(c1.id, 'calculator'); assert.equal(c1.pinned, true);
  const h1 = sk.towerHtml(held, (s) => String(s)); assert.match(h1, /now assimilating: /); assert.doesNotMatch(h1, /easiest site left: calculator/);
  assert.match(h1, /the target until Verse surpasses it/);
  assert.equal(held.floors.find((f) => f.id === 'is it').pinned, false);
});

test('a site that takes too long gives null and frees its worker; a quick one gives its row', async () => {
  assert.equal(await within(new Promise(() => {}), 20), null);
  assert.deepEqual(await within(Promise.resolve({ controls: 4 }), 1000), { controls: 4 });
});

test('a row not rendered never ranks on its raw count: it stands behind every rendered row (owner review, 2026-10-30: howsecureismypassword.net read 3 raw, 9 rendered)', () => {
  assert.equal(rankableControls({ controls: 3, counted: 'unrendered' }), null); assert.equal(rankableControls({ controls: 3, counted: 'html' }), null);
  assert.equal(rankableControls({ controls: 9, counted: 'rendered', shell: 'none' }), 9); assert.equal(rankableControls(null), null);
  const rank = { ranks: {}, order: {}, list: {} };
  const size = { sites: {
    'random.org': { bytes: 90000, controls: 3, htmlControls: 3, counted: 'unrendered', scripts: 3, nodes: 300, routes: 10 },
    'isitchristmas.com': { bytes: 700, controls: 9, htmlControls: 3, counted: 'rendered', shell: 'none', scripts: 0, nodes: 20, routes: 0 } } };
  const t = tower([], {}, null, null, rank, size), at = (id) => t.floors.findIndex((f) => f.id === id);
  assert.ok(at('is it') < at('random number'), 'the rendered 9 stands before the unrendered 3');
  assert.doesNotMatch(easeLine(t.floors[at('random number')]), /control/, 'the card does not state a count it did not render');
});

test('a bot wall or a country picker is a door, not the site: it never ranks as a small site (serverdiscounter.com read 3, wheeloutlet.com 6)', () => {
  const anubis = '<html><head><title>Making sure you&#39;re not a bot!</title></head><body><main><h1>Making sure you\'re not a bot!</h1><p>Loading...</p>'
    + '<p>Protected by <a href="https://github.com/TecharoHQ/anubis">Anubis</a> From <a href="https://techaro.lol">Techaro</a>.</p><p>Mascot design by <a href="https://bsky.app/x">CELPHASE</a>.</p></main></body></html>';
  assert.equal(controlsOf(anubis).total, 3, 'the three links serverdiscounter.com was counted at');
  assert.equal(shellOf({ html: anubis, url: 'https://serverdiscounter.com/', controls: 3 }), 'wall');
  assert.equal(shellOf({ html: '<p>x</p>', url: 'https://serverdiscounter.com/.within.website/?redir=/', controls: 3 }), 'wall', 'the Anubis address alone says wall');
  const picker = '<html><head><title>wheeloutlet.com - Select your country &amp; onlineshop</title></head><body><nav><button>DE</button><button>EN</button><button>FR</button></nav>'
    + '<h1>Welcome to wheeloutlet.com</h1><p>Please select your country to reach the right onlineshop.</p><button>Germany</button><button>Go to the onlineshop</button><a href="tel:+1">call</a></body></html>';
  assert.equal(controlsOf(picker).total, 6, 'the six controls wheeloutlet.com was counted at');
  assert.equal(shellOf({ html: picker, url: 'https://wheeloutlet.com/', controls: 6 }), 'gateway');
  const tool = '<html><head><title>VAT calculator online</title></head><body><h1>VAT calculator</h1><input type="number"><input type="radio" checked><input type="radio"><input type="number" value="22"><button>Calculate</button><a href="http://vatcalconline.com">vat calculator</a></body></html>';
  assert.equal(shellOf({ html: tool, url: 'https://ndscalc.ru/', controls: 7 }), 'none', 'a calculator is the site itself');
  const shop = '<html><head><title>Big shop</title></head><body><p>Select your country</p>' + '<a href="/p">p</a>'.repeat(40) + '</body></html>';
  assert.equal(shellOf({ html: shop, url: 'https://shop.test/', controls: 40 }), 'none', 'a whole shop with a country menu is not a splash page');
  const rank = { ranks: {}, order: {}, list: {} };
  const size = { sites: {
    'random.org': { bytes: 90000, controls: 3, counted: 'rendered', shell: 'wall', scripts: 3, nodes: 300, routes: 10 },
    'calculator.net': { bytes: 2.4e6, controls: 6, counted: 'rendered', shell: 'gateway', scripts: 40, nodes: 9000, routes: 600 },
    'isitchristmas.com': { bytes: 700, controls: 9, counted: 'rendered', shell: 'none', scripts: 0, nodes: 20, routes: 0 } } };
  const t = tower([], {}, null, null, rank, size), at = (id) => t.floors.findIndex((f) => f.id === id);
  assert.ok(at('is it') < at('random number') && at('is it') < at('calculator'), 'the real 9-control site stands before the wall and the picker');
});

test('planSizes reads again a rendered row not yet checked for a bot wall or a country picker', () => {
  const now = Date.parse('2026-10-30'), sites = [{ host: 'a.com' }, { host: 'b.com' }];
  const file = { sites: { 'a.com': { controls: 9, counted: 'rendered', shell: 'none', at: '2026-10-29' }, 'b.com': { controls: 3, counted: 'rendered', at: '2026-10-29' } } };
  assert.deepEqual(planSizes({ sites, file, now, rendered: true }).map((s) => s.host), ['b.com']);
  assert.deepEqual(planSizes({ sites, file, now, rendered: false }).map((s) => s.host), [], 'without a browser it waits for a run that renders');
});
