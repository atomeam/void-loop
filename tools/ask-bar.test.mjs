// The home's ask bar keeps Verse's dark keys (owner, 2026-11-06: "why is the microphone highlighted and the other button", "the ambient
// sound button"). The base rules for #mic and #sound once sat in the style sheet that loads only with the first ask, so the empty home showed
// the browser's grey buttons and the sound key's icon had no size. This opens the home as the deploy serves it (split by
// tools/split-void-page.mjs) in installed Chrome, dark, at phone and desktop width, and fails main when a key in the bar is unstyled or
// empty, by the design loop's own check (tools/design-loop.mjs bare()). It also checks bare() itself on a small page it builds.
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
const exe = [process.env.VOID_TEST_BROWSER, process.env.CHROME_PATH, '/usr/bin/google-chrome', '/opt/pw-browsers/chromium'].find((p) => p && fs.existsSync(p));
if (!exe) { console.log('skip the ask bar: no Chrome'); process.exit(0); }
await acquireHeavy('the ask bar keeps dark keys (ask-bar.test.mjs)');

const T = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const split = splitHome(fs.readFileSync(path.join(root, 'index.html'), 'utf8'));
const server = http.createServer((q, r) => {
  const p = decodeURIComponent(new URL(q.url, 'http://x').pathname);
  if (p === '/' || p === '/index.html') { r.writeHead(200, { 'content-type': 'text/html' }); return r.end(split.html); }
  const name = p.slice(1);
  if (split.files && Object.prototype.hasOwnProperty.call(split.files, name)) { r.writeHead(200, { 'content-type': T[path.extname(name)] || 'text/plain' }); return r.end(split.files[name]); }
  const f = path.join(root, p.endsWith('/') ? p + 'index.html' : p);
  if (!f.startsWith(root)) { r.writeHead(403); return r.end(); }
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); r.end(d); });
}).listen(0);
await new Promise((r) => server.once('listening', r));
const base = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
test.after(async () => { await browser.close(); server.close(); });

for (const width of [390, 1280]) {
  test(`at ${width} px the ask bar's keys are dark and none is empty`, async () => {
    const p = await browser.newPage({ viewport: { width, height: 800 }, colorScheme: 'dark' });
    try {
      // the home's own scripts only; nothing outside the test server
      await p.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
      await p.goto(base + '/', { waitUntil: 'load' });
      await p.waitForSelector('#row #mic', { state: 'attached', timeout: 15000 });
      await p.mouse.move(195, 300); await p.mouse.move(200, 320); await p.waitForTimeout(500);
      const keys = await p.evaluate(() => ['go', 'mic', 'sound'].map((id) => { const e = document.getElementById(id); if (!e) return { id, missing: true };
        const c = getComputedStyle(e), r = e.getBoundingClientRect(), svg = e.querySelector('svg'), s = svg && svg.getBoundingClientRect();
        return { id, shown: r.width > 0 && r.height > 0 && c.display !== 'none', w: r.width, h: r.height, bg: c.backgroundColor, radius: c.borderRadius, svg: s ? [s.width, s.height] : null }; }));
      for (const k of keys) {
        assert.ok(!k.missing, `#${k.id} is in the bar`);
        if (!k.shown) continue; // the sound key is hidden until there is sound to play
        assert.notEqual(k.bg, 'rgb(107, 107, 107)', `#${k.id} is not the browser's grey key: ${JSON.stringify(k)}`);
        assert.notEqual(k.bg, 'rgb(239, 239, 239)', `#${k.id} is not the browser's light key: ${JSON.stringify(k)}`);
        assert.ok(k.w >= 44 && k.h >= 44, `#${k.id} is a 44 px key: ${JSON.stringify(k)}`);
        assert.ok(parseFloat(k.radius) >= 22, `#${k.id} is round: ${JSON.stringify(k)}`);
        if (k.id !== 'go') assert.ok(k.svg && k.svg[0] >= 16 && k.svg[1] >= 16, `#${k.id} shows its icon: ${JSON.stringify(k)}`);
      }
      const found = await p.evaluate(bare);
      const inBar = (x) => /^#(go|mic|sound)\b/.test(x.sel);
      assert.deepEqual(found.unstyled.filter(inBar), [], 'no unstyled key in the ask bar');
      assert.deepEqual(found.empty.filter(inBar), [], 'no empty key in the ask bar');
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
