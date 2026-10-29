// A deploy reaches a returning browser's scripts on every page, not 4 hours later (coordinator, 2026-10-29: "fix the 4-hour app.js cache on every
// other page that imports it the same way, since all pages must work together"). Cloudflare keeps .js in the browser for 4 hours whatever
// _headers says, so a returning browser ran an old /fanfic/app.js under a new page. Two places fix it for the whole site:
//   sw.js     a page under the service worker asks the server again for every same-origin script (none kept, offline falls back to the browser's copy)
//   visit.js  a page the worker does not control (most never register it) asks again, after load, for each script it used, so the next load is fresh
// The browser half serves a small page with Cache-Control: max-age=14400 on every script, changes a module the page imports, and reloads.
// Run: node --test tools/fresh-scripts.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const site = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'void-live-deploy');
const swSrc = fs.readFileSync(path.join(site, 'sw.js'), 'utf8'), visitSrc = fs.readFileSync(path.join(site, 'visit.js'), 'utf8');
const exe = [process.env.VOID_TEST_BROWSER, process.env.CHROME_PATH, '/opt/pw-browsers/chromium', '/opt/cft/chrome-headless-shell-linux64/chrome-headless-shell', '/usr/bin/google-chrome'].find((x) => x && fs.existsSync(x));

// the worker in a vm: fetch records the cache mode it was asked with; offline makes a network fetch fail and a force-cache fetch answer
function worker({ offline = false } = {}) {
  const handlers = {}, calls = [], kept = [];
  class Req { constructor(r, o = {}) { this.url = r.url; this.method = r.method || 'GET'; this.mode = r.mode; this.cache = o.cache || r.cache || 'default'; } }
  const cache = { match: async () => undefined, put: async (r) => { kept.push(r.url || r); }, addAll: async () => {}, delete: async () => true };
  const ctx = { self: { addEventListener: (k, f) => { handlers[k] = f; }, skipWaiting() {}, clients: { claim() {} } }, location: { origin: 'https://a-to-mind.com' }, URL, Request: Req,
    caches: { open: async () => cache, keys: async () => [], match: async () => undefined },
    fetch: async (r) => { calls.push({ url: r.url, cache: r.cache }); if (offline && r.cache !== 'force-cache') throw new TypeError('offline'); return new Response(r.cache, { status: 200, headers: { 'cache-control': 'public, max-age=14400', 'content-type': 'text/javascript' } }); },
    Headers, Response };
  ctx.addEventListener = ctx.self.addEventListener; vm.createContext(ctx); vm.runInContext(swSrc, ctx);
  const get = async (p) => { let out = null; handlers.fetch({ request: { url: 'https://a-to-mind.com' + p, method: 'GET', mode: 'cors' }, respondWith: (x) => { out = x; } }); return out && (await out); };
  return { get, calls, kept };
}

test('the worker asks the server again for any page script, and keeps none of them', async () => {
  for (const p of ['/stopwatch/app.js', '/lab/f033-vector-field-mind/app.js', '/photos/lib/exif.mjs']) {
    const w = worker(), res = await w.get(p);
    assert.ok(res, p + ' passed through the worker untouched');
    assert.deepEqual(w.calls, [{ url: 'https://a-to-mind.com' + p, cache: 'no-cache' }], p);
    assert.deepEqual(w.kept, [], p + ' was kept in the shell cache');
    assert.equal(res.headers.get('cache-control'), 'no-cache', p + ' went back with the server\'s 4 hours on it, so the tab\'s memory cache keeps the old copy');
  }
});

test('offline, a page script falls back to the browser\'s own copy', async () => {
  const w = worker({ offline: true }), res = await w.get('/stopwatch/app.js');
  assert.deepEqual(w.calls.map((c) => c.cache), ['no-cache', 'force-cache']);
  assert.equal(await res.text(), 'force-cache');
});

test('the worker leaves /visit.js, other files and the 3D files to their own rules', async () => {
  for (const p of ['/visit.js', '/stopwatch/style.css', '/flights/airports.json.gz']) assert.equal(await worker().get(p), null, p);
  const w = worker(); await w.get('/vendor/three-r180a/build/three.module.min.js');
  assert.ok(w.calls.every((c) => c.cache !== 'no-cache'), 'a /vendor/ file is cache first, never asked again');
});

// one small site in a temp folder: the page imports app.js, which imports dep.js; dep.js writes its version into the page
async function withSite(register, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fresh-scripts-'));
  fs.writeFileSync(path.join(dir, 'sw.js'), swSrc); fs.writeFileSync(path.join(dir, 'visit.js'), visitSrc);
  fs.mkdirSync(path.join(dir, 't'));
  fs.writeFileSync(path.join(dir, 't', 'index.html'), '<!doctype html><title>t</title><p id="v">none</p><script type="module" src="/t/app.js"></script><script src="/visit.js" defer></script>'
    + (register ? "<script>navigator.serviceWorker.register('/sw.js')</script>" : ''));
  fs.writeFileSync(path.join(dir, 't', 'app.js'), "import { v } from '/t/dep.js'; document.getElementById('v').textContent = v;\n");
  const version = (v) => fs.writeFileSync(path.join(dir, 't', 'dep.js'), `export const v = '${v}';\n`);
  version('1');
  const server = http.createServer((req, res) => {
    let u = new URL(req.url, 'http://x').pathname; if (u.endsWith('/')) u += 'index.html';
    const f = path.join(dir, u);
    if (!f.startsWith(dir) || !fs.existsSync(f)) { res.writeHead(404); return res.end('no'); }
    const js = f.endsWith('.js'), body = fs.readFileSync(f);
    // Cloudflare's 4 hours on every script but the worker itself, which the browser always asks again for
    res.writeHead(200, { 'content-type': js ? 'text/javascript' : 'text/html', 'cache-control': u === '/sw.js' ? 'no-cache' : js ? 'public, max-age=14400' : 'no-cache' });
    res.end(body);
  }).listen(0, '127.0.0.1');
  const { chromium } = await import('playwright-core');
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  try {
    const ctx = await browser.newContext(register ? {} : { serviceWorkers: 'block' }), page = await ctx.newPage();
    const url = `http://127.0.0.1:${server.address().port}/t/`;
    const shown = async () => { await page.waitForFunction(() => document.getElementById('v').textContent !== 'none'); return page.textContent('#v'); };
    await fn({ page, url, version, shown });
  } finally { await browser.close(); server.close(); fs.rmSync(dir, { recursive: true, force: true }); }
}

test('under the worker, the very next load after a deploy runs the new module', { skip: !exe && 'no browser' }, async () => {
  await withSite(true, async ({ page, url, version, shown }) => {
    await page.goto(url); assert.equal(await shown(), '1');
    await page.waitForFunction(() => navigator.serviceWorker.ready.then(() => true));
    await page.reload(); await page.waitForFunction(() => !!navigator.serviceWorker.controller); assert.equal(await shown(), '1');
    version('2');
    await page.reload(); assert.equal(await shown(), '2', 'a returning browser under the worker ran the old module');
  });
});

test('with no worker, one load after a deploy is the most that runs the old module', { skip: !exe && 'no browser' }, async () => {
  await withSite(false, async ({ page, url, version, shown }) => {
    await page.goto(url); assert.equal(await shown(), '1');
    version('2');
    await page.reload(); assert.equal(await shown(), '1', 'the browser cache holds the old module for this load (the case being fixed)');
    await page.waitForTimeout(3000); // visit.js asks again 2 s after load
    await page.reload(); assert.equal(await shown(), '2', 'the load after a stale one still ran the old module');
  });
});
