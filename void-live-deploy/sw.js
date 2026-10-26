// Verse's service worker: lets the installed app open offline. Network first, always,
// so every deploy shows up on the next load; the cache is only a fallback. /api is never touched.
const CACHE = 'void-shell-v2';
const SHELL = ['/', '/manifest.webmanifest', '/icon-192.png', '/icon.svg', '/skills/index.json'];
// the one-tool pages open offline too (owner, 2026-10-24: the tower gate measures offline): each page is kept under its own path, with the
// modules its generated modulepreload block names (tools/preload.mjs), fetched once at install
const TOOLS = ['/photos/', '/stopwatch/', '/word-count/', '/color/', '/gradient/', '/wheel/', '/random-user/', '/base-converter/', '/convert/', '/resize-image/', '/password-strength/', '/random/', '/flip/', '/base64/', '/calculator/', '/time/', '/password/', '/weather/', '/translate/', '/recipes/', '/markets/', '/podcasts/', '/scores/', '/sports/', '/calendar/', '/notes/', '/generators/', '/boards/', '/news/', '/image/', '/g/', '/is-it/christmas', '/tools/'];
// any /is-it/<day> page (not its .rss or .json) is kept under its own path once visited
// pages kept the first time they are opened, never at install (2026-10-25: four more pages at install made the worker miss the gate's 10 s wait,
// and /generators/ read 0 offline again); their own module files (/generators/<page>/app.js, /image/app.js) are kept like /lib/ code
const LATER = ['/markets/caps/', '/markets/screener/', '/photos/squoosh/', '/photos/tinypng/', '/photos/exif/', '/photos/exifeditor/', '/photos/photopea/', '/photos/iloveimg/', '/generators/make/', '/generators/chat/', '/generators/story/', '/generators/forum/'];
const isTool = (p) => TOOLS.includes(p) || LATER.includes(p) || /^\/is-it\/[a-z0-9-]+$/.test(p);
const pageCode = (p) => /^\/(?:generators\/[a-z]+\/app|image\/(?:app|layers)|photos\/app|scores\/(?:app|more|sports|reports|gfx)|sports\/app)\.js$/.test(p);
// the install keeps each tool page itself and nothing more (2026-10-25: with 21 pages, fetching every page's modules at install took longer than the
// gate's wait, and Verse's own pages read 0 offline); a page's modules are kept the first time they load under the worker (the fetch handler below),
// and a page opened offline before that still shows itself from its own HTML
const keepTool = (c, t) => fetch(t).then((res) => (res.ok ? c.put(t, res) : null)).catch(() => {});
// a tool page and the modules it preloads: kept for the pages open when the worker takes over, so the page that installed it works offline
// on its very next load (2026-10-25: /color/ reloaded offline showed its shell with no colour, its modules never kept)
const keepWhole = (c, t) => fetch(t).then((res) => (res.ok ? res.clone().text().then((h) => c.put(t, res).then(() => c.addAll([...h.matchAll(/<link rel="modulepreload" href="([^"]+)">/g)].map((m) => m[1])))) : null)).catch(() => {});
// 3D files (vendored three.js, models, textures) never change under the same name: a new version gets a new path.
// They are cache first, in their own cache that survives shell updates, so a chess set downloads once.
const CACHE_3D = 'void-3d-v2'; // v2: v1 could hold the page's HTML under a vendor path (below), so it is dropped on activate
// the scores page's own answers (owner, 2026-10-26: the offline reload must show the last scoreboard from the worker, not only from localStorage): network first,
// the last good JSON kept per address and served when the network is cut or answers an error; nothing else under /api/ is ever touched
const CACHE_SCORES = 'void-scores-v1';
const is3d = (p) => p.startsWith('/vendor/') || p.startsWith('/models/');

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {}).then(() => Promise.all(TOOLS.map((t) => keepTool(c, t))))).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE && k !== CACHE_3D && k !== CACHE_SCORES).map((k) => caches.delete(k)))).then(() => self.clients.claim())
    .then(() => self.clients.matchAll({ type: 'window' })).then((cs) => caches.open(CACHE).then((c) => Promise.all(cs.map((x) => new URL(x.url).pathname).filter(isTool).map((t) => keepWhole(c, t))))).catch(() => {}));
});
self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method === 'GET' && url.origin === location.origin && url.pathname === '/api/scores') {
    e.respondWith(fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE_SCORES).then((c) => c.put(req, copy)).catch(() => {}); return res; } return caches.open(CACHE_SCORES).then((c) => c.match(req)).then((r) => r || res); })
      .catch(() => caches.open(CACHE_SCORES).then((c) => c.match(req)).then((r) => r || Response.error())));
    return;
  }
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
  const code = url.pathname.startsWith('/skills/') || url.pathname.startsWith('/lib/') || pageCode(url.pathname);
  if (!nav && !code && !SHELL.includes(url.pathname)) return;
  // skill and card code is re-checked with the server on every load (owner, 2026-10-22: the films card still read "VERSE F   I   LMS"
  // hours after the fix): Cloudflare stretches .js browser caching to 4 hours whatever _headers says, so a plain fetch kept the old file.
  // An unchanged file costs a 304; a deploy reaches a returning visitor on the next load.
  e.respondWith(fetch(code ? new Request(req, { cache: 'no-cache' }) : req).then((res) => {
    // only the front page is the offline fallback for a navigation; /handoff or /surface never replaces it
    const tool = nav && isTool(url.pathname);
    if (res.ok && (!nav || tool || (url.pathname === '/' && /text\/html/.test(res.headers.get('content-type') || '')))) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(tool ? url.pathname : nav ? '/' : req, copy)); }
    return res;
  }).catch(() => (nav && isTool(url.pathname) ? caches.match(url.pathname).then((r) => r || caches.match('/')) : caches.match(nav ? '/' : req)).then((r) => r || Response.error())));
});
