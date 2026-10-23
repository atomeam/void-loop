// Verse's service worker: lets the installed app open offline. Network first, always,
// so every deploy shows up on the next load; the cache is only a fallback. /api is never touched.
const CACHE = 'void-shell-v2';
const SHELL = ['/', '/manifest.webmanifest', '/icon-192.png', '/icon.svg', '/skills/index.json'];
// 3D files (vendored three.js, models, textures) never change under the same name: a new version gets a new path.
// They are cache first, in their own cache that survives shell updates, so a chess set downloads once.
const CACHE_3D = 'void-3d-v2'; // v2: v1 could hold the page's HTML under a vendor path (below), so it is dropped on activate
const is3d = (p) => p.startsWith('/vendor/') || p.startsWith('/models/');

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE && k !== CACHE_3D).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  if (is3d(url.pathname)) {
    // a missing file comes back as the page's HTML with a 200 (the site's fallback), and a cache first copy of that would break
    // every 3D board for that browser for good (issue #1114): only a real file is kept, and a kept HTML copy is dropped and refetched
    const real = (res) => res && res.ok && res.status === 200 && !/text\/html/.test(res.headers.get('content-type') || '');
    e.respondWith(caches.open(CACHE_3D).then((c) => c.match(req).then((hit) => {
      if (real(hit)) return hit;
      if (hit) c.delete(req);
      return fetch(req).then((res) => { if (real(res)) c.put(req, res.clone()); return res; });
    })));
    return;
  }
  const nav = req.mode === 'navigate';
  const code = url.pathname.startsWith('/skills/') || url.pathname.startsWith('/lib/');
  if (!nav && !code && !SHELL.includes(url.pathname)) return;
  // skill and card code is re-checked with the server on every load (owner, 2026-10-22: the films card still read "VERSE F   I   LMS"
  // hours after the fix): Cloudflare stretches .js browser caching to 4 hours whatever _headers says, so a plain fetch kept the old file.
  // An unchanged file costs a 304; a deploy reaches a returning visitor on the next load.
  e.respondWith(fetch(code ? new Request(req, { cache: 'no-cache' }) : req).then((res) => {
    // only the front page is the offline fallback for a navigation; /handoff or /surface never replaces it
    if (res.ok && (!nav || (url.pathname === '/' && /text\/html/.test(res.headers.get('content-type') || '')))) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(nav ? '/' : req, copy)); }
    return res;
  }).catch(() => caches.match(nav ? '/' : req).then((r) => r || Response.error())));
});
