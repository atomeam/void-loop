// Void's service worker: lets the installed app open offline. Network first, always,
// so every deploy shows up on the next load; the cache is only a fallback. /api is never touched.
const CACHE = 'void-shell-v1';
const SHELL = ['/', '/manifest.webmanifest', '/icon-192.png', '/icon.svg', '/skills/index.json'];
// 3D files (vendored three.js, models, textures) never change under the same name: a new version gets a new path.
// They are cache first, in their own cache that survives shell updates, so a chess set downloads once.
const CACHE_3D = 'void-3d-v1';
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
    e.respondWith(caches.open(CACHE_3D).then((c) => c.match(req).then((hit) => hit || fetch(req).then((res) => { if (res.ok && res.status === 200) c.put(req, res.clone()); return res; }))));
    return;
  }
  const nav = req.mode === 'navigate';
  if (!nav && !url.pathname.startsWith('/skills/') && !SHELL.includes(url.pathname)) return;
  e.respondWith(fetch(req).then((res) => {
    // only the front page is the offline fallback for a navigation; /handoff or /surface never replaces it
    if (res.ok && (!nav || (url.pathname === '/' && /text\/html/.test(res.headers.get('content-type') || '')))) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(nav ? '/' : req, copy)); }
    return res;
  }).catch(() => caches.match(nav ? '/' : req).then((r) => r || Response.error())));
});
