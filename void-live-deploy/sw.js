// Void's service worker: lets the installed app open offline. Network first, always,
// so every deploy shows up on the next load; the cache is only a fallback. /api is never touched.
const CACHE = 'void-shell-v1';
const SHELL = ['/', '/manifest.webmanifest', '/icon-192.png', '/icon.svg', '/skills/index.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  const nav = req.mode === 'navigate';
  if (!nav && !url.pathname.startsWith('/skills/') && !SHELL.includes(url.pathname)) return;
  e.respondWith(fetch(req).then((res) => {
    // only the front page is the offline fallback for a navigation; /handoff or /surface never replaces it
    if (res.ok && (!nav || (url.pathname === '/' && /text\/html/.test(res.headers.get('content-type') || '')))) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(nav ? '/' : req, copy)); }
    return res;
  }).catch(() => caches.match(nav ? '/' : req).then((r) => r || Response.error())));
});
