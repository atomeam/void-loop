// Verse's service worker: lets the installed app open offline. Network first, always,
// so every deploy shows up on the next load; the cache is only a fallback. /api is never touched.
const CACHE = 'void-shell-v2';
const SHELL = ['/', '/manifest.webmanifest', '/icon-192.png', '/icon.svg', '/skills/index.json'];
// the one-tool pages open offline too (owner, 2026-10-24: the tower gate measures offline): each page is kept under its own path, with the
// modules its generated modulepreload block names (tools/preload.mjs), fetched once at install
const TOOLS = ['/photos/', '/ledger/', '/stopwatch/', '/word-count/', '/color/', '/gradient/', '/wheel/', '/random-user/', '/base-converter/', '/convert/', '/resize-image/', '/password-strength/', '/random/', '/flip/', '/base64/', '/calculator/', '/calculators/', '/time/', '/password/', '/weather/', '/translate/', '/recipes/', '/markets/', '/markets/caps/', '/metronome/', '/paint/', '/emojis/', '/tournaments/', '/prizes/', '/hosting/', '/identity/', '/cpan/', '/obituaries/', '/books/', '/podcasts/', '/scores/', '/sports/', '/fantasy/', '/calendar/', '/notes/', '/generators/', '/boards/', '/fanfic/', '/learn-to-draw/', '/news/', '/image/', '/pdf/', '/pdf/merge/', '/pdf/organize/', '/pdf/toolbox/', '/pdf/editor/', '/pdf/suite/', '/pdf/studio/', '/kanban/', '/kanban/simple/', '/kanban/quick/', '/kanban/teams/', '/kanban/flow/', '/g/', '/is-it/christmas', '/tools/', '/convert/unit-converter/', '/convert/unit-converter-2/'];
// any /is-it/<day> page (not its .rss or .json) is kept under its own path once visited
// the pages whose own module files (/generators/<page>/app.js, /image/app.js) are kept like /lib/ code: the page itself is shelled at install
// with every other kept page (see KEPT below), and its modules are kept the first time it loads under the worker
// the six music pages (2026-10-26) are kept the first time each is opened, with their app.js, for the same reason
// the flights pages (2026-10-26) are kept the first time each is opened, with their app.js and the airport list
// the jobs pages (2026-10-26) likewise, with their app.js and the listings snapshot
// the drawing course (2026-10-29, /learn-to-draw/) is a tool page too: its app.js and lib/drawing-drills.js are kept like the others, so the drills work offline
// the fan-fiction archive (2026-10-29, owner: "all the pages are supposed to be able to work together") is a tool page like /boards/, its app.js kept like the others
// the store (2026-10-26, owner: "need a /store page that beats amazons") likewise; its catalogue is kept by the page itself in localStorage, so an offline visit still shows every product and the cart
const LATER = ['/store/', '/jobs/', '/jobs/regions/', '/jobs/alerts/', '/jobs/europe/', '/jobs/salary/', '/jobs/categories/', '/jobs/tags/', '/jobs/companies/', '/flights/', '/flights/trip/', '/flights/airports/', '/flights/time/', '/flights/distance/', '/flights/map/', '/flights/co2/', '/flights/routes/', '/music/', '/piano/', '/tuner/', '/bpm/', '/chords/', '/markets/screener/', '/photos/squoosh/', '/photos/tinypng/', '/photos/exif/', '/photos/exifeditor/', '/photos/photopea/', '/photos/iloveimg/', '/generators/make/', '/generators/chat/', '/generators/story/', '/generators/forum/'];
// Every page the site keeps — TOOLS and LATER alike — is pre-cached as a THIN HTML SHELL at install (owner, 2026-10-26: the offline class
// deletion). A LATER page used to be kept only on its first open, so the gate's fresh context could lose the race and read 0 offline while
// the page passed here every time: two floors stalled on exactly that, and 33 pages carried the risk. The shells are HTML only, which is what
// makes this cheap (the 2026-10-25 install slowdown was MODULES); a page's modules are still kept the first time it loads under the worker.
const KEPT = TOOLS.concat(LATER);
const isTool = (p) => KEPT.includes(p) || /^\/is-it\/[a-z0-9-]+$/.test(p);
const pageCode = (p) => /^\/paint\/(?:app\.js|templates\/[a-z-]+\.json)$/.test(p) || /^\/(?:generators\/[a-z]+\/app|image\/(?:app|layers)|photos\/app|scores\/(?:app|more|sports|reports|gfx)|(?:sports|fantasy)\/(?:app|boot)|(?:music|metronome|piano|tuner|bpm|chords)\/app|(?:pdf|kanban|flights|jobs|ledger|fanfic|learn-to-draw)(?:\/[a-z]+)?\/app)\.js$/.test(p) || p === '/flights/airports.json' || p === '/jobs/snapshot.json' || p === '/flights/routes.json';
// the install keeps each tool page itself and nothing more (2026-10-25: with 21 pages, fetching every page's modules at install took longer than the
// gate's wait, and Verse's own pages read 0 offline); a page's modules are kept the first time they load under the worker (the fetch handler below),
// and a page opened offline before that still shows itself from its own HTML
const keepTool = (c, t) => fetch(t).then((res) => (res.ok ? c.put(t, res) : null)).catch(() => {});
// the files a kept page fetches that are neither its HTML nor a modulepreload: /paint/ asks for its paintings by fetch and /emojis/
// imports the closed list directly, so neither arrives through keepWhole — and a page that shows itself but cannot draw is offline 0
// (the gate's own reading: paint measured 0 against an ideal of 1 until these were kept)
const EXTRA = ['/paint/app.js', '/paint/templates/index.json', '/paint/templates/wave.json', '/paint/templates/starry.json', '/lib/emoji.js'];

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
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {}).then(() => Promise.all(KEPT.map((t) => keepTool(c, t)))).then(() => Promise.all(EXTRA.map((t) => keepTool(c, t))))).catch(() => {}).then(() => self.skipWaiting()));
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
  // every other script of the site (a page's own app.js and what it imports, a /lab/ page's app.js) is asked again of the server too, for the
  // same 4-hour reason (2026-10-29: a returning browser ran an old /fanfic/app.js under a new page), and is never kept: offline it falls back
  // to whatever copy the browser's own cache holds. /visit.js keeps its day in the cache (_headers), and /vendor/ files never change.
  // The answer goes back marked no-cache: with the server's 4 hours on it, the tab's memory cache ran the old file on the next reload without
  // asking the worker at all (tools/fresh-scripts.test.mjs).
  if (!nav && !code && /\.m?js$/.test(url.pathname) && url.pathname !== '/visit.js') {
    const asked = (res) => { if (!res || !res.ok) return res; const h = new Headers(res.headers); h.set('cache-control', 'no-cache'); return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h }); };
    e.respondWith(fetch(new Request(req, { cache: 'no-cache' })).catch(() => fetch(new Request(req, { cache: 'force-cache' }))).then(asked).catch(() => Response.error()));
    return;
  }
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
