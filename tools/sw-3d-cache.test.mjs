// The service worker keeps 3D files cache first (sw.js). A missing file comes back as the page's HTML with a 200 (the site's
// fallback), and Cloudflare's edge kept that HTML under /vendor/three-r180/build/three.module.min.js for a year ("immutable"),
// so every 3D board failed with "Failed to load module script" for fresh browsers (issue #1114, the site tester's 11 failures on
// 2026-10-22). The library now lives at /vendor/three-r180a/ (a path no edge holds), and the worker never keeps HTML as a 3D file.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';

const root = new URL('../void-live-deploy/', import.meta.url);
const src = readFileSync(new URL('sw.js', root), 'utf8');

function worker(network) {
  const store = new Map(), handlers = {};
  const cache = { match: async (r) => store.get(r.url), put: async (r, res) => { store.set(r.url, res); }, delete: async (r) => store.delete(r.url), addAll: async () => {} };
  const res = (type, body = 'x') => ({ ok: true, status: 200, headers: { get: (k) => (k.toLowerCase() === 'content-type' ? type : null) }, body, clone() { return this; } });
  const ctx = { self: { addEventListener: (k, f) => { handlers[k] = f; }, skipWaiting() {}, clients: { claim() {} } }, location: { origin: 'https://a-to-mind.com' },
    caches: { open: async () => cache, keys: async () => [], delete: async () => true, match: async () => undefined }, fetch: async (r) => res(network(r.url)), URL, Response: { error: () => null } };
  ctx.addEventListener = ctx.self.addEventListener; vm.createContext(ctx); vm.runInContext(src, ctx);
  const get = async (path) => { let p; handlers.fetch({ request: { url: 'https://a-to-mind.com' + path, method: 'GET', mode: 'cors' }, respondWith: (x) => { p = x; } }); return p && (await p); };
  return { get, store, res };
}

test('a 3D file that came back as HTML is not kept, and a kept HTML copy is dropped and fetched again', async () => {
  let type = 'text/html; charset=utf-8';
  const w = worker(() => type), path = '/vendor/three-r180a/build/three.module.min.js', url = 'https://a-to-mind.com' + path;
  assert.match((await w.get(path)).headers.get('content-type'), /html/);
  assert.equal(w.store.has(url), false, 'the HTML fallback must not be cached as a 3D file');
  w.store.set(url, w.res('text/html')); type = 'application/javascript';
  assert.equal((await w.get(path)).headers.get('content-type'), 'application/javascript');
  assert.equal(w.store.get(url).headers.get('content-type'), 'application/javascript', 'the real file replaces the HTML copy');
});

test('the 3D cache is v2 (v1 may hold HTML) and the page loads three.js from the fresh path', () => {
  assert.match(src, /CACHE_3D = 'void-3d-v2'/);
  for (const f of ['skills/scene3d.js', 'skills/figures3d.js', 'store/index.html', 'store/receipt/index.html']) {
    const t = readFileSync(new URL(f, root), 'utf8');
    assert.ok(!/\/vendor\/three-r180\//.test(t), f + ' still loads the old path the edge holds as HTML');
  }
  assert.ok(existsSync(new URL('vendor/three-r180a/build/three.module.min.js', root)));
});
