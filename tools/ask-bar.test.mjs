// The home's ask bar keeps Verse's dark keys (owner, 2026-11-06: "why is the microphone highlighted and the other button", "the ambient
// sound button"). The base rules for #mic and #sound once sat in the style sheet that loads only with the first ask, so the empty home showed
// the browser's grey buttons and the sound key's icon had no size. This opens the home as the deploy serves it (split by
// tools/split-void-page.mjs) in installed Chrome, dark, at phone (390 x 844, a touch screen) and desktop (1280 x 800) width, and fails
// main when a key in the bar is unstyled, light, not round or empty, by the design loop's own check (tools/design-loop.mjs bare()), when
// the answer card comes within 12 px of the bar, or when the page scrolls sideways. It also checks bare() itself on a small page it builds.
//   ASK_BAR_SITE=https://a-to-mind.com   the same checks against the live site (the design loop's live-bar job runs it every 2 hours)
//   ASK_BAR_SHOTS=dir                    keep a screenshot of each width, with the card open, in dir
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { chromium } from 'playwright-core';
import { splitHome } from './split-void-page.mjs';
import { bare } from './design-loop.mjs';
import { acquire as acquireHeavy } from './heavy.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'void-live-deploy');
const LIVE = (process.env.ASK_BAR_SITE || '').replace(/\/+$/, '');
const SHOTS = process.env.ASK_BAR_SHOTS || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const exe = [process.env.VOID_TEST_BROWSER, process.env.CHROME_PATH, '/usr/bin/google-chrome', '/opt/pw-browsers/chromium'].find((p) => p && fs.existsSync(p));
if (!exe) { console.log('skip the ask bar: no Chrome'); process.exit(0); }
await acquireHeavy('the ask bar keeps dark keys (ask-bar.test.mjs)');

const T = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const split = LIVE ? null : splitHome(fs.readFileSync(path.join(root, 'index.html'), 'utf8'));
const server = LIVE ? null : http.createServer((q, r) => {
  const p = decodeURIComponent(new URL(q.url, 'http://x').pathname);
  if (p === '/' || p === '/index.html') { r.writeHead(200, { 'content-type': 'text/html' }); return r.end(split.html); }
  const name = p.slice(1);
  if (split.files && Object.prototype.hasOwnProperty.call(split.files, name)) { r.writeHead(200, { 'content-type': T[path.extname(name)] || 'text/plain' }); return r.end(split.files[name]); }
  const f = path.join(root, p.endsWith('/') ? p + 'index.html' : p);
  if (!f.startsWith(root)) { r.writeHead(403); return r.end(); }
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); r.end(d); });
});
if (server) { server.listen(0); await new Promise((r) => server.once('listening', r)); }
const base = LIVE || 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
test.after(async () => { await browser.close(); if (server) server.close(); });

// a phone is a touch screen with its own viewport; the desktop is a plain window
const VIEW = { 390: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, 1280: { viewport: { width: 1280, height: 800 } } };
// locally the home's own scripts only, nothing outside the test server; live the site as a visitor gets it
const local = (p) => (LIVE ? null : p.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort()));
// how dark a colour is: its relative luminance (WCAG), 0 black to 1 white, and its alpha
const lum = (c) => { const m = String(c).match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return { a: p.length > 3 ? p[3] : 1, l: 0.2126 * f(p[0]) + 0.7152 * f(p[1]) + 0.0722 * f(p[2]) }; };

// the keys and the page as they stand: each key's box, look and icon, and how wide the page is against the window
const look = () => ({ keys: ['go', 'mic', 'sound'].map((id) => { const e = document.getElementById(id); if (!e) return { id, missing: true };
  const c = getComputedStyle(e), r = e.getBoundingClientRect(), svg = e.querySelector('svg'), s = svg && svg.getBoundingClientRect();
  return { id, shown: r.width > 0 && r.height > 0 && c.display !== 'none', w: r.width, h: r.height, bg: c.backgroundColor, radius: c.borderRadius, svg: s ? [s.width, s.height] : null }; }),
  scroll: document.documentElement.scrollWidth, inner: window.innerWidth });
// the keys are Verse's dark round 44 px keys with an icon that shows, and the page does not scroll sideways
function keysHold(g, at) {
  for (const k of g.keys) {
    assert.ok(!k.missing, `${at}: #${k.id} is in the bar`);
    if (!k.shown) continue; // the sound key is hidden until there is sound to play
    const c = lum(k.bg);
    assert.notEqual(k.bg, 'rgb(107, 107, 107)', `${at}: #${k.id} is not the browser's grey key: ${JSON.stringify(k)}`);
    assert.notEqual(k.bg, 'rgb(239, 239, 239)', `${at}: #${k.id} is not the browser's light key: ${JSON.stringify(k)}`);
    assert.ok(c && !(c.a >= 0.5 && c.l > 0.1), `${at}: #${k.id} is a dark key (luminance at most 0.1 where it is opaque): ${JSON.stringify(k)}`);
    assert.ok(k.w >= 44 && k.h >= 44, `${at}: #${k.id} is a 44 px key: ${JSON.stringify(k)}`);
    assert.ok(parseFloat(k.radius) >= Math.min(k.w, k.h) / 2 - 0.5, `${at}: #${k.id} is round (radius at least half its side): ${JSON.stringify(k)}`);
    if (k.id !== 'go') assert.ok(k.svg && k.svg[0] >= 16 && k.svg[1] >= 16, `${at}: #${k.id} shows its icon: ${JSON.stringify(k)}`);
  }
  assert.ok(g.scroll <= g.inner, `${at}: the page does not scroll sideways (${g.scroll} px wide in a ${g.inner} px window)`);
}

for (const width of [390, 1280]) {
  test(`at ${width} px the ask bar's keys are dark and none is empty`, async () => {
    const p = await browser.newPage({ ...VIEW[width], colorScheme: 'dark' });
    try {
      await local(p);
      await p.goto(base + '/', { waitUntil: 'load' });
      await p.waitForSelector('#row #mic', { state: 'attached', timeout: 15000 });
      await p.mouse.move(195, 300); await p.mouse.move(200, 320); await p.waitForTimeout(500);
      keysHold(await p.evaluate(look), `the empty home at ${width} px`);
      const found = await p.evaluate(bare);
      const inBar = (x) => /^#(go|mic|sound)\b/.test(x.sel);
      assert.deepEqual(found.unstyled.filter(inBar), [], 'no unstyled key in the ask bar');
      assert.deepEqual(found.empty.filter(inBar), [], 'no empty key in the ask bar');
    } finally { await p.close(); }
  });

  // the answer card sits above the bar: void-cards.css loads with the first ask, and when it went in after void-home.css the cards'
  // older .vpage rules won and the card covered the keys (2026-11-06). The time card holds a picture, so it grows to the most the
  // stage lets a card take and scrolls inside: a taller answer gets the same box, and this is the box that must clear the bar.
  test(`at ${width} px the answer card ends 12 px or more above the ask bar`, async () => {
    const p = await browser.newPage({ ...VIEW[width], colorScheme: 'dark' });
    try {
      await local(p);
      await p.goto(base + '/', { waitUntil: 'load' });
      await p.waitForSelector('#input', { timeout: 15000 });
      await p.fill('#input', 'what time is it'); await p.press('#input', 'Enter');
      await p.waitForFunction(() => { const v = document.querySelector('.vpage'); return v && v.getBoundingClientRect().height > 40 && document.getElementById('void-cards-css'); }, null, { timeout: 20000 });
      await p.waitForTimeout(800);
      const g = await p.evaluate(() => { const v = document.querySelector('.vpage').getBoundingClientRect(), r = document.getElementById('row').getBoundingClientRect();
        const sheets = [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => l.getAttribute('href'));
        return { card: [Math.round(v.top), Math.round(v.bottom)], row: Math.round(r.top), sheets }; });
      if (SHOTS) await p.screenshot({ path: path.join(SHOTS, `ask-bar-${width}.png`) });
      console.log(`at ${width} px: the card ends at ${g.card[1]} px, the bar starts at ${g.row} px (${g.row - g.card[1]} px clear)`);
      assert.ok(g.card[1] + 12 <= g.row, `the card ends 12 px or more above the bar: ${JSON.stringify(g)}`);
      const c = g.sheets.indexOf('/void-cards.css'), h = g.sheets.indexOf('/void-home.css');
      if (c >= 0 && h >= 0) assert.ok(c < h, `void-cards.css loads before void-home.css: ${JSON.stringify(g.sheets)}`);
      keysHold(await p.evaluate(look), `the home with a card open at ${width} px`);
    } finally { await p.close(); }
  });
}

test('bare() finds a key with the browser look and an icon key that shows nothing, and passes a styled one', async () => {
  const p = await browser.newPage({ viewport: { width: 390, height: 600 }, colorScheme: 'dark' });
  try {
    await p.setContent(`<!doctype html><body style="background:#05060a">
      <button id="plain">Go</button>
      <button id="nothing" aria-label="sound"><svg viewBox="0 0 24 24" style="width:0;height:0"><path d="M3 9h4l5-4v14l-5-4H3z"/></svg></button>
      <button id="dark" style="appearance:none;border:0;background:#1c2030;color:#fff">Ask</button>
      <button id="icon" style="appearance:none;border:0;background:#1c2030"><svg viewBox="0 0 24 24" style="width:18px;height:18px"><path d="M3 9h4l5-4v14l-5-4H3z"/></svg></button>
      <div aria-hidden="true"><button id="away">x</button></div></body>`);
    const found = await p.evaluate(bare);
    const u = found.unstyled.map((x) => x.sel), e = found.empty.map((x) => x.sel);
    assert.ok(u.includes('#plain'), 'the plain button is unstyled: ' + JSON.stringify(found));
    assert.ok(e.includes('#nothing'), 'the icon button with a 0 px icon is empty: ' + JSON.stringify(found));
    assert.ok(found.empty.find((x) => x.sel === '#nothing').svg, 'it says the empty key holds an svg');
    for (const ok of ['#dark', '#icon', '#away']) assert.ok(!u.includes(ok) && !e.includes(ok), ok + ' passes: ' + JSON.stringify(found));
  } finally { await p.close(); }
});
