// "closer on the figure" is zoom-figure. The site tester read only "waking up" because the page waits for every
// skill above it (162nd of 342), then for the whole index (#2282). Run: node --test tools/zoom-figure.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import skill, { zoomOf, nextLod } from '../void-live-deploy/skills/zoom-figure.js';

test('closer on the figure is zoom-figure, and an empty stage says so', async () => {
  const ask = 'closer on the figure';
  assert.deepEqual(zoomOf(ask), { act: 'in' });
  assert.equal(skill.match(ask.toLowerCase(), ask), true);
  assert.equal(zoomOf('zoom in on the map'), null);
  assert.equal(nextLod(0, 'in'), 1);
  const said = [];
  const api = { say: (s) => said.push(s), stage: { things: () => ({}), selected: () => null } };
  assert.equal(await skill.run(ask, api), 'zoom-figure');
  assert.match(said.join('\n'), /no figure here/);
  const fig = { id: 'f', kind: 'fig3d', lod: 0 };
  const full = { say: (s) => said.push(s), stage: { things: () => ({ f: fig }), selected: () => null, save() {}, render() {} } };
  assert.equal(await skill.run(ask, full), 'zoom-figure');
  assert.equal(fig.lod, 1);
  assert.match(said.join('\n'), /closer/);
});

// #2282: the site tester read only "waking up". zoom-figure already owns the phrase. The page has to import that
// one file before it says waking up, and the case stays in the site tester.
test('the closer ask is answered before waking up, and the site tester still asks it', () => {
  const ask = 'closer on the figure';
  const page = readFileSync(new URL('../void.html', import.meta.url), 'utf8');
  const early = page.indexOf('/skills/zoom-figure.js');
  const wake = page.indexOf("say('waking up')");
  assert.ok(early > 0 && wake > early, 'zoom-figure is imported before the page says waking up');
  const suite = JSON.parse(readFileSync(new URL('./site-test.json', import.meta.url), 'utf8'));
  assert.ok(suite.cases.some((c) => c.ask === ask), 'the site-test case stays');
});

// Hold the skill index back. The answer has to come from zoom-figure.js itself, while data-skills is not ready.
const CHROME = process.env.VOID_TEST_BROWSER || process.env.CHROME_PATH || ['/usr/bin/google-chrome', '/usr/bin/chromium', '/opt/pw-browsers/chromium'].find((p) => existsSync(p));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

test('closer on the figure answers while the skill index is still loading', { timeout: 30000 }, async (t) => {
  if (!CHROME) { t.skip('no Chrome to load the page'); return; }
  let chromium;
  try { ({ chromium } = await import('playwright-core')); } catch (_) { t.skip('playwright-core is not installed'); return; }
  const root = fileURLToPath(new URL('../void-live-deploy/', import.meta.url));
  const held = new Set();
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    if (path.includes('..')) { res.writeHead(400); res.end(); return; }
    const rel = path === '/' ? '/index.html' : path;
    const file = join(root, rel);
    if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    if (rel === '/skills/index.json') {
      const timer = setTimeout(() => { if (res.writableEnded) return; res.writeHead(200, { 'content-type': 'application/json' }); res.end(readFileSync(file)); }, 20000);
      held.add(timer); res.on('close', () => clearTimeout(timer)); return;
    }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(readFileSync(file));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message || e)));
  try {
    await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForSelector('#input', { timeout: 10000 });
    await page.fill('#input', 'closer on the figure');
    await page.keyboard.press('Enter');
    const text = await page.waitForFunction(() => {
      const w = (document.getElementById('whisper') || {}).textContent || '';
      return /no figure here|closer|as close as it goes|zoomed out/i.test(w) ? w : false;
    }, null, { timeout: 4000 }).then((h) => h.jsonValue());
    const ready = await page.evaluate(() => document.documentElement.dataset.skills || '');
    assert.notEqual(ready, 'ready', 'the rest of the skills are still loading');
    assert.match(text, /no figure here|closer|as close as it goes|zoomed out/);
    assert.doesNotMatch(text, /waking up/);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close().catch(() => {});
    for (const timer of held) clearTimeout(timer);
    if (server.closeAllConnections) server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
});
