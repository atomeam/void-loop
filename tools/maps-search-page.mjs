// A person-like run of the maps and search pages at 390 px (Chrome), every outside service answered by a stand-in so the run is the same anywhere: the map style
// (OpenFreeMap), the place search (Nominatim), the router (FOSSGIS OSRM), elevation (Open-Meteo), Wikipedia, Wikidata and Verse's own /api/answer and /api/where.
// Maps: a search, a pin with its coordinates, directions with steps and a GPX file, the traffic notice, a saved place that survives a reload, the link that holds a
// route. Search: an answer with its cited source, Wikipedia results with edit dates, the five engine links, a bang that leaves for its site, the history. Both: German
// on a German browser, open offline after a visit, no sideways overflow, tap targets of 24 px, layout shift under 0.05, first paint under 200 ms, no console errors.
// Saves screenshots into the directory given.   node tools/heavy.mjs node tools/maps-search-page.mjs <dir>
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { chromium } from 'playwright-core';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'void-live-deploy'), out = process.argv[2] || '.';
const only = process.argv[3] || ''; // 'maps' or 'search' to run one half
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.xml': 'application/xml', '.webmanifest': 'application/manifest+json' };
const ANSWER = { answer: 'Hamlet was written by William Shakespeare, probably between 1599 and 1601 [1].', sources: [{ title: 'Hamlet', url: 'https://en.wikipedia.org/wiki/Hamlet', edited: '2026-10-20T10:00:00Z' }], at: '2026-10-26T10:00:00Z' };
const srv = http.createServer((req, res) => { const u = new URL(req.url, 'http://x');
  if (u.pathname === '/api/answer') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify(ANSWER)); }
  if (u.pathname === '/api/where') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ ok: true, lat: 38.7, lon: -9.1, city: 'Lisbon', country: 'PT', timezone: 'Europe/Lisbon' })); }
  let f = path.join(root, u.pathname); if (f.endsWith('/')) f += 'index.html';
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('no'); } res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f)); });
await new Promise((r) => srv.listen(0, r)); const base = 'http://localhost:' + srv.address().port;
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/usr/bin/google-chrome'].find((x) => fs.existsSync(x)), args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [], asked = [];
// ---- the stand-ins ----
const STYLE = { version: 8, glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf', sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#e8eef0' } }] };
const LISBON = [{ lat: '38.7077507', lon: '-9.1365919', name: 'Lisboa', display_name: 'Lisboa, Portugal', type: 'city', category: 'place', boundingbox: ['38.6913', '38.7967', '-9.2298', '-9.0866'], osm_type: 'relation', osm_id: 5400890, address: { city: 'Lisboa', country: 'Portugal' } }];
const PORTO = [{ lat: '41.1494512', lon: '-8.6107884', name: 'Porto', display_name: 'Porto, Portugal', type: 'city', category: 'place', boundingbox: ['41.13', '41.18', '-8.69', '-8.55'], osm_type: 'relation', osm_id: 3372453, address: { city: 'Porto', country: 'Portugal' } }];
const ROUTE = { code: 'Ok', routes: [{ distance: 313400, duration: 10980, geometry: { type: 'LineString', coordinates: [[-9.1366, 38.7078], [-8.9, 39.5], [-8.6108, 41.1495]] }, legs: [{ steps: [
  { distance: 1200, maneuver: { type: 'depart', modifier: 'right', location: [-9.1366, 38.7078] }, name: 'Avenida da Liberdade' }, { distance: 300000, maneuver: { type: 'turn', modifier: 'left', location: [-9.13, 38.72] }, name: 'A1' },
  { distance: 12200, maneuver: { type: 'roundabout', exit: 2, location: [-8.62, 41.14] }, name: 'Rua de Santa Catarina' }, { distance: 0, maneuver: { type: 'arrive', modifier: 'right', location: [-8.6108, 41.1495] }, name: '' }] }] },
  { distance: 330000, duration: 12000, geometry: { type: 'LineString', coordinates: [[-9.1366, 38.7078], [-8.4, 40.2], [-8.6108, 41.1495]] }, legs: [{ steps: [{ distance: 330000, maneuver: { type: 'depart', location: [-9.1366, 38.7078] }, name: 'IC2' }, { distance: 0, maneuver: { type: 'arrive', location: [-8.6108, 41.1495] }, name: '' }] }] }] };
const WIKI = { query: { searchinfo: { totalhits: 5321 }, search: [{ title: 'Hamlet', snippet: 'The Tragedy of <span class="searchmatch">Hamlet</span>, Prince of Denmark, is a tragedy written by William Shakespeare', timestamp: '2026-10-20T10:00:00Z', wordcount: 20000 }, { title: 'Hamlet (1948 film)', snippet: 'a 1948 film', timestamp: '2026-09-01T10:00:00Z', wordcount: 3000 }] } };
const WD = { search: [{ id: 'Q41567', label: 'Hamlet', description: 'tragedy by William Shakespeare' }] };
const route = async (ctx) => ctx.route(/^https:\/\/(?!localhost)/, (r) => { const u = r.request().url(); asked.push(u);
  const json = (o) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
  if (/tiles\.openfreemap\.org\/styles/.test(u)) return json(STYLE);
  if (/tiles\.openfreemap\.org\/fonts/.test(u)) return r.fulfill({ status: 200, contentType: 'application/x-protobuf', headers: { 'access-control-allow-origin': '*' }, body: Buffer.alloc(0) });
  if (/nominatim\.openstreetmap\.org\/search/.test(u)) return json(/porto/i.test(decodeURIComponent(u)) ? PORTO : /lisbo/i.test(decodeURIComponent(u)) ? LISBON : []);
  if (/nominatim\.openstreetmap\.org\/reverse/.test(u)) return json({ ...LISBON[0], name: 'Praça do Comércio', display_name: 'Praça do Comércio, Baixa, Lisboa, Portugal', address: { road: 'Praça do Comércio', suburb: 'Baixa', city: 'Lisboa', country: 'Portugal' } });
  if (/routing\.openstreetmap\.de/.test(u)) return json(ROUTE);
  if (/api\.open-meteo\.com\/v1\/elevation/.test(u)) { const n = (new URL(u).searchParams.get('latitude') || '').split(',').length; return json({ elevation: Array.from({ length: n }, (_, i) => 50 + Math.round(100 * Math.sin(i / 8))) }); }
  if (/wikipedia\.org\/w\/api\.php.*list=search/.test(u)) return json(WIKI);
  if (/wikidata\.org/.test(u)) return json(WD);
  return r.abort(); });
const mk = async (locale = 'en-US') => { const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write', 'geolocation'], geolocation: { latitude: 38.7106, longitude: -9.1364, accuracy: 12 } });
  await route(ctx); const p = await ctx.newPage(); p.on('console', (m) => m.type() === 'error' && !/favicon|404|ERR_FAILED|net::|Failed to load resource|pbf|glyph|webgl|WebGL/i.test(m.text()) && errors.push(m.text())); p.on('pageerror', (e) => errors.push(String(e))); return { ctx, p }; };
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail = 1; };
const open = async (p, url, flag) => { await p.addInitScript(() => { window.__cls = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); });
  await p.goto(base + url, { waitUntil: 'load' }); await p.waitForFunction((f) => document.documentElement.dataset[f] === '1', flag, { timeout: 8000 }).catch(() => {}); await p.waitForTimeout(600);
  return p.evaluate(() => (performance.getEntriesByName('first-contentful-paint')[0] || {}).startTime || 0); };
const sane = async (p, name, fcp) => { ok(await p.evaluate(() => document.documentElement.scrollWidth <= 390), name + ': no sideways overflow at 390 px'); const cls = await p.evaluate(() => window.__cls); ok(cls < 0.05, name + ': layout shift ' + cls.toFixed(3)); ok(fcp > 0 && fcp < 200, name + ': first paint ' + Math.round(fcp) + ' ms');
  const small = await p.evaluate(() => [...document.querySelectorAll('button,a,input,select,textarea,summary')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.width < 24 || r.height < 24) && !e.classList.contains('pick') && !e.closest('footer,.maplibregl-ctrl-attrib,.maplibregl-ctrl-scale') && e.type !== 'checkbox'; }).map((e) => (e.id || e.tagName) + ':' + (e.textContent || '').trim().slice(0, 20)));
  ok(small.length === 0, name + ': every control is at least 24 px' + (small.length ? ' (' + small.slice(0, 5).join(', ') + ')' : '')); };
const shot = (p, n) => p.screenshot({ path: path.join(out, n + '.png'), fullPage: false });
const text = (p) => p.evaluate(() => document.body.innerText);

if (only !== 'search') {
  { // ---- maps: a search ----
    const { ctx, p } = await mk(); const fcp = await open(p, '/maps/?q=Lisbon', 'mapsReady'); await p.waitForFunction(() => document.querySelector('#m-res li'), null, { timeout: 6000 }).catch(() => {});
    await p.waitForFunction(() => document.getElementById('m-map').dataset.ready === '1' || document.querySelector('#m-map svg'), null, { timeout: 15000 }).catch(() => {});
    await sane(p, 'maps', fcp); let t = await text(p);
    ok(/Lisboa/.test(t) && /38\.70775, -9\.13659/.test(t), 'maps: Lisbon is found and its pin shows its coordinates');
    ok(/38°42′27\.9″N 9°08′11\.7″W/.test(t), 'maps: the pin in degrees, minutes and seconds');
    ok(await p.evaluate(() => !!document.querySelector('#m-map canvas.maplibregl-canvas') || !!document.querySelector('#m-map svg')), 'maps: a map is drawn (' + (await p.evaluate(() => (document.querySelector('#m-map canvas') ? 'MapLibre' : 'the offline coastlines'))) + ')');
    ok(asked.some((u) => /nominatim\.openstreetmap\.org\/search\?format=jsonv2.*q=Lisbon/.test(u)), 'maps: the place search asked Nominatim once, on load from the link');
    ok(/Live traffic: Verse does not have it/.test(t) && (await p.getAttribute('#m-traffic', 'href')).startsWith('https://www.google.com/maps/@'), 'maps: says plainly there is no live traffic and links to Google Maps\' traffic layer');
    const links = await p.$$eval('#m-pin .links a', (a) => a.map((x) => x.href)); ok(links.some((h) => h.startsWith('https://www.google.com/maps/search/?api=1&query=38.70775')) && links.some((h) => h.startsWith('https://www.openstreetmap.org/?mlat=')) && links.some((h) => h.startsWith('https://maps.apple.com/')), 'maps: the place opens on Google Maps, OpenStreetMap and Apple Maps');
    await shot(p, 'maps-search-390');
    await p.click('#m-pin button.go'); await p.waitForTimeout(150); t = await text(p); ok(/★ Lisboa/.test(t), 'maps: Save puts Lisbon in the saved places');
    await p.click('#m-pin button:has-text("Copy link")'); const link = await p.evaluate(() => navigator.clipboard.readText()); ok(/\/maps\/\?ll=38\.70775,-9\.13659&z=16&name=Lisboa/.test(link), 'maps: the place link holds the point and the name (' + link.replace(base, '') + ')');
    // what is here
    await p.click('#m-pin button:has-text("What is here?")'); await p.waitForTimeout(1500); t = await text(p); ok(/Praça do Comércio/.test(t), 'maps: "What is here?" names the place under the pin');
    // directions
    await p.fill('#m-from', 'Lisbon'); await p.fill('#m-to', 'Porto'); const n0 = asked.filter((u) => /routing/.test(u)).length; await p.click('#m-route ~ * , form button[type=submit]:has-text("Get directions")').catch(() => p.click('button:has-text("Get directions")'));
    await p.waitForFunction(() => /\d h \d\d min/.test((document.getElementById('m-route') || {}).innerText || ''), null, { timeout: 8000 }).catch(() => {}); t = await text(p);
    ok(/3 h 03 min/.test(t) && /313 km · 195 mi/.test(t), 'maps: Lisbon to Porto by car is 3 h 03 min and 313 km (195 mi)');
    ok(/Turn left onto A1/.test(t) && /At the roundabout take exit 2 onto Rua de Santa Catarina/.test(t) && /Arrive: it is on the right/.test(t), 'maps: every turn in words');
    ok(/Fastest/.test(t) && /Other route/.test(t), 'maps: the other route is offered beside the fastest');
    ok(asked.filter((u) => /routing\.openstreetmap\.de\/routed-car\/route\/v1\/driving\/-9\.136592,38\.707751;-8\.610788,41\.149451\?overview=full&geometries=geojson&steps=true&alternatives=true/.test(u)).length >= 1 && asked.filter((u) => /routing/.test(u)).length === n0 + 1, 'maps: one call to the FOSSGIS car router with both points');
    ok(/FOSSGIS OSRM demo servers/.test(t) && /free demo/.test(t), 'maps: says the router is a free demo');
    const rl = await p.$$eval('#m-route .links a', (a) => a.map((x) => x.href)); ok(rl.some((h) => /google\.com\/maps\/dir\/\?api=1&origin=38\.70775\d*,-9\.13659\d*&destination=41\.14945\d*,-8\.61078\d*&travelmode=driving/.test(h)) && rl.some((h) => /openstreetmap\.org\/directions\?engine=fossgis_osrm_car/.test(h)) && rl.some((h) => /travelmode=transit/.test(h)), 'maps: the same route on Google Maps and OpenStreetMap, and transit on Google');
    ok(new URL(await p.url()).search === '?from=Lisbon&to=Porto', 'maps: the address bar holds the route');
    const dl = p.waitForEvent('download'); await p.click('#m-route button:has-text("Download GPX")'); const gpx = fs.readFileSync(await (await dl).path(), 'utf8'); ok(/<gpx version="1\.1"/.test(gpx) && /<trkpt lat="41\.149500" lon="-8\.610800">/.test(gpx) && /<name>Lisboa<\/name>/.test(gpx), 'maps: the route downloads as GPX');
    await shot(p, 'maps-directions-390');
    // the bike mode re-asks the bike router
    await p.click('[data-mode=bike]'); await p.waitForTimeout(1600); ok(asked.some((u) => /routed-bike/.test(u)), 'maps: Bike asks the bike router');
    // saved place survives a reload
    await p.goto(base + '/maps/', { waitUntil: 'load' }); await p.waitForFunction(() => document.documentElement.dataset.mapsReady === '1'); t = await text(p); ok(/★ Lisboa/.test(t), 'maps: the saved place is still there after a reload (on the device)');
    await ctx.close();
  }
  { // ---- maps: a route from the link, German ----
    const { ctx, p } = await mk('de-DE'); await open(p, '/maps/?from=Lisbon&to=Porto&mode=foot', 'mapsReady'); await p.waitForFunction(() => /\d h/.test((document.getElementById('m-route') || {}).innerText || ''), null, { timeout: 8000 }).catch(() => {}); const t = await text(p);
    ok(/Karten/.test(t) && /Route berechnen/.test(t) && /Live-Verkehr: Verse hat ihn nicht/.test(t) && /Links abbiegen auf A1|links abbiegen auf A1/i.test(t), 'maps German: the page and the steps speak German');
    ok(asked.some((u) => /routed-foot/.test(u)), 'maps: a link with mode=foot asks the walking router'); await shot(p, 'maps-de-390'); await ctx.close();
  }
  { // ---- maps: offline ----
    const { ctx, p } = await mk(); await open(p, '/maps/', 'mapsReady'); await p.evaluate(() => { localStorage.setItem('a2m.maps.saved.v1', JSON.stringify([{ id: 'x', name: 'Home', lat: 38.71, lon: -9.14, note: '', at: '2026-10-26' }])); });
    await p.evaluate(() => navigator.serviceWorker.ready); await p.waitForTimeout(1500); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1200);
    await ctx.setOffline(true); await p.reload({ waitUntil: 'load' }).catch(() => {}); await p.waitForFunction(() => document.documentElement.dataset.mapsReady === '1', null, { timeout: 8000 }).catch(() => {}); await p.waitForTimeout(800); const t = await text(p);
    ok(/★ Home/.test(t) && /You are offline/.test(t), 'maps offline: the page reloads with the network cut and shows the saved place');
    ok(await p.evaluate(() => !!document.querySelector('#m-map svg path')), 'maps offline: the coastlines are drawn instead of the tiles'); await shot(p, 'maps-offline-390'); await ctx.close();
  }
}
if (only !== 'maps') {
  { // ---- search ----
    const { ctx, p } = await mk(); const fcp = await open(p, '/search/?q=who+wrote+hamlet', 'searchReady'); await p.waitForFunction(() => /Shakespeare/.test((document.getElementById('s-answer') || {}).innerText || '') && document.querySelector('#s-wiki li'), null, { timeout: 8000 }).catch(() => {});
    await sane(p, 'search', fcp); let t = await text(p);
    ok(/Hamlet was written by William Shakespeare/.test(t), 'search: Verse answers who wrote Hamlet');
    ok((await p.getAttribute('#s-answer sup a', 'href')) === 'https://en.wikipedia.org/wiki/Hamlet', 'search: the answer\'s [1] links to its source');
    ok(/Verse does not crawl the web/.test(t), 'search: says plainly Verse does not crawl the web');
    ok(/5,321 results/.test(t) && /edited 2026-10-20/.test(t) && /tragedy written by William Shakespeare/.test(t), 'search: Wikipedia results with how many, the snippet and when each was edited');
    ok(/Q41567/.test(t), 'search: Wikidata names the entity');
    const eng = await p.$$eval('#s-eng a', (a) => a.map((x) => [x.dataset.engine, x.href, x.rel, x.target]));
    const want = { google: 'https://www.google.com/search?q=who+wrote+hamlet', bing: 'https://www.bing.com/search?q=who+wrote+hamlet', duckduckgo: 'https://duckduckgo.com/?q=who+wrote+hamlet', brave: 'https://search.brave.com/search?q=who+wrote+hamlet', wikipedia: 'https://en.wikipedia.org/w/index.php?search=who+wrote+hamlet' };
    ok(Object.entries(want).every(([k, u]) => eng.some((e) => e[0] === k && e[1] === u && /noopener/.test(e[2]) && e[3] === '_blank')), 'search: the same search on Google, Bing, DuckDuckGo, Brave and Wikipedia, each in a new tab without a referrer');
    ok(/who wrote hamlet/.test(await p.innerText('#s-hist')), 'search: the search is in the history on the device');
    await shot(p, 'search-390');
    // a bang leaves for its site
    await p.fill('#s-q', '!w eiffel tower'); const nav = p.waitForRequest((r) => /wikipedia\.org\/w\/index\.php\?search=eiffel\+tower/.test(r.url()), { timeout: 5000 }).then(() => true).catch(() => false); await p.press('#s-q', 'Enter'); ok(await nav, 'search: "!w eiffel tower" goes straight to Wikipedia\'s search');
    await ctx.close();
  }
  { // ---- search: history pause and clear, custom bang (the history and bangs live on the device) ----
    const { ctx, p } = await mk(); await open(p, '/search/', 'searchReady'); await p.evaluate(() => localStorage.setItem('a2m.search.history.v1', JSON.stringify([{ q: 'old one', at: '2026-10-01T00:00:00Z' }]))); await p.reload({ waitUntil: 'load' }); await p.waitForFunction(() => document.documentElement.dataset.searchReady === '1');
    ok(/old one/.test(await p.innerText('#s-hist')), 'search: the history lists an earlier search'); await p.click('button:has-text("Clear history")'); ok(/No searches yet/.test(await p.innerText('#s-hist')), 'search: Clear history empties it');
    await ctx.close();
  }
  { // ---- search: German, offline ----
    const { ctx, p } = await mk('de-DE'); await open(p, '/search/', 'searchReady'); let t = await text(p); ok(/Suche/.test(t) && /Verse durchsucht das Web nicht selbst/.test(t) && /Verlauf/.test(t), 'search German: the page speaks German'); await shot(p, 'search-de-390');
    await p.evaluate(() => navigator.serviceWorker.ready); await p.waitForTimeout(1500); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1200);
    await ctx.setOffline(true); await p.reload({ waitUntil: 'load' }).catch(() => {}); await p.waitForFunction(() => document.documentElement.dataset.searchReady === '1', null, { timeout: 8000 }).catch(() => {}); t = await text(p);
    ok(/Sie sind offline/.test(t) && /Bangs/.test(t), 'search offline: the page reloads with the network cut, bangs and history still there'); await ctx.close();
  }
}
ok(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
await b.close(); srv.close(); process.exit(fail);
