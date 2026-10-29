// The maps pages' screen (/maps/ and its lane pages): a real map (MapLibre GL, vendored, with OpenFreeMap's free OpenStreetMap tiles), place search
// (Nominatim, on submit, one a second, answers kept on the device), directions by car, bike or on foot (the FOSSGIS OSRM demo servers, said plainly),
// a pin with what is there, saved places kept on the device, coordinates in any form, measuring (radius, path, area, elevation), a route planner with
// GPX in and out, the same place or route opened on Google Maps, OpenStreetMap or Apple Maps, and a link that holds it all. Live traffic: Verse has
// none, and says so. With the network cut the page still opens (sw.js LATER), the saved places, coordinates and measuring still work, and the map is
// drawn from the coastlines Verse carries. mountMaps(root, { panels: [...] }) mounts the panels a page asks for.
import * as C from '/lib/maps-core.js';
import { DE } from '/lib/maps-de.js';

const params = new URLSearchParams(location.search);
const lang = params.get('lang') === 'de' || (params.get('lang') !== 'en' && /^de\b/i.test(navigator.language || '')) ? 'de' : 'en';
const de = lang === 'de';
export const t = (s) => (de && DE[s]) || s;
const VENDOR = '/vendor/maplibre-gl-6.13.0/';
const COL = { accent: '#6d4aff', alt: '#8a8799', saved: '#e0662b', res: '#1a7f4b', pin: '#b42318', shape: '#0b72b9' };

/** a DOM element: h('button', { type: 'button', onclick }, 'Save') */
function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) { if (v == null || v === false) continue; if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else e.setAttribute(k, v === true ? '' : v); }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(String(k)));
  return e;
}
const $ = (id) => document.getElementById(id);
const say = (el, msg, bad = false) => { if (!el) return; el.textContent = msg || ''; el.classList.toggle('bad', !!bad); };
function download(name, text, type) { const a = h('a', { href: URL.createObjectURL(new Blob([text], { type })), download: name }); document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
async function copyText(text, el) { try { await navigator.clipboard.writeText(text); say(el, t('Link copied')); } catch (_) { const i = h('input', { value: text }); document.body.append(i); i.select(); try { document.execCommand('copy'); say(el, t('Link copied')); } catch (__) { say(el, text); } i.remove(); } }
const linkRow = (links) => h('p', { class: 'links' }, t('Open in') + ': ', ...links.flatMap((l, i) => [i ? ' · ' : '', h('a', { href: l.url, target: l.id === 'geo' ? null : '_blank', rel: 'noopener noreferrer' }, l.name + (l.id === 'geo' ? '' : ' ↗'))]));

// ---------- the network: one call a second per service, every answer kept ----------
const gates = { nominatim: C.makeGate(1100), router: C.makeGate(1100), elevation: C.makeGate(300) };
async function getJson(url, gate) {
  const hit = C.cacheGet(url); if (hit) return hit;
  if (!navigator.onLine) throw new Error('offline');
  await gates[gate]();
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 12000);
  // the site sends no referrer anywhere (_headers); these two services ask to know which application calls them, so these calls name the site (its origin only)
  try { const r = await fetch(url, { signal: ctl.signal, headers: { Accept: 'application/json' }, referrerPolicy: 'origin' }); if (!r.ok) throw new Error('http ' + r.status); const j = await r.json(); C.cachePut(url, j); return j; } finally { clearTimeout(timer); }
}
const searchPlaces = (q, near) => getJson(C.searchUrl(q, lang, near), 'nominatim').then(C.placesOf);
const reverse = (p) => getJson(C.reverseUrl(p, lang), 'nominatim').then((j) => (j && !j.error ? C.placeOf(j) : null));
/** a typed place to a point: coordinates as they are, "my location", a saved place by name, else the first search answer */
async function resolvePlace(text) {
  const s = String(text || '').trim(); if (!s) return null;
  const c = C.parseCoords(s); if (c) return { ...c, name: C.fmtLatLon(c.lat, c.lon) };
  if (/^(my location|meinen? standort|here|hier)$/i.test(s)) return myPosition();
  const saved = C.savedPlaces().find((p) => p.name.toLowerCase() === s.toLowerCase()); if (saved) return saved;
  const r = await searchPlaces(s, S.pin || null); return r[0] || null;
}
function myPosition() {
  return new Promise((res, rej) => { if (!navigator.geolocation) return rej(new Error('no geolocation')); navigator.geolocation.getCurrentPosition((p) => res({ lat: p.coords.latitude, lon: p.coords.longitude, name: t('My location'), acc: p.coords.accuracy, alt: p.coords.altitude, speed: p.coords.speed, heading: p.coords.heading }), (e) => rej(e), { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }); });
}

// ---------- state ----------
const S = { pin: null, results: [], routes: null, ri: 0, routePts: [], mode: 'car', tool: 'pin', center: null, r: 5, path: [], area: [], plan: [], planLine: [], planEle: [], follow: true, view: null };
let M = null; // { map, ml } once MapLibre is up
let fallback = false, mapEl = null, mapNote = null, pinCard = null, onMapClick = null, cfg = {}, path = '/maps/';
const changed = new Set();
const subs = [];

// ---------- the map ----------
function features() {
  const F = [], P = (p, kind, name) => F.push({ type: 'Feature', properties: { kind, name: name || p.name || '' }, geometry: { type: 'Point', coordinates: [p.lon, p.lat] } });
  const L = (coords, kind) => coords.length > 1 && F.push({ type: 'Feature', properties: { kind }, geometry: { type: 'LineString', coordinates: coords } });
  if (cfg.panels.includes('saved') || cfg.panels.includes('search')) for (const p of C.savedPlaces()) P(p, 'saved');
  S.results.forEach((p, i) => P(p, 'res', (i + 1) + '. ' + p.name));
  if (S.routes) { S.routes.forEach((r, i) => i !== S.ri && L(r.line, 'alt')); L(S.routes[S.ri].line, 'route'); S.routePts.forEach((p, i) => P(p, 'stop', i === 0 ? 'A' : String.fromCharCode(65 + i))); }
  if (S.center) { P(S.center, 'shape', ''); F.push({ type: 'Feature', properties: { kind: 'shape' }, geometry: { type: 'Polygon', coordinates: [C.circleRing(S.center, S.r)] } }); }
  if (S.path.length) { S.path.forEach((p) => P(p, 'shape', '')); L(S.path.map((p) => [p.lon, p.lat]), 'path'); }
  if (S.area.length) { S.area.forEach((p) => P(p, 'shape', '')); if (S.area.length > 2) F.push({ type: 'Feature', properties: { kind: 'shape' }, geometry: { type: 'Polygon', coordinates: [[...S.area, S.area[0]].map((p) => [p.lon, p.lat])] } }); else L(S.area.map((p) => [p.lon, p.lat]), 'path'); }
  if (S.plan.length) { S.plan.forEach((p, i) => P(p, 'stop', String(i + 1))); L(S.planLine.length ? S.planLine.map((c) => [c[0], c[1]]) : S.plan.map((p) => [p.lon, p.lat]), 'route'); }
  if (S.pin) P(S.pin, 'pin', S.pin.name || '');
  return { type: 'FeatureCollection', features: F };
}
function draw() {
  if (M && M.map.getSource('v')) M.map.getSource('v').setData(features());
  else if (fallback) drawFallback();
}
function fit(points, maxZoom = 15) {
  const pts = points.filter(Boolean); if (!pts.length) return;
  if (M) { if (pts.length === 1) M.map.flyTo({ center: [pts[0].lon, pts[0].lat], zoom: Math.max(M.map.getZoom(), Math.min(maxZoom, 14)), speed: 2 }); else { const b = new M.ml.LngLatBounds(); pts.forEach((p) => b.extend([p.lon, p.lat])); M.map.fitBounds(b, { padding: 40, maxZoom, duration: 600 }); } }
  else if (fallback) drawFallback();
}
function fitBox(bbox) { if (M && bbox) M.map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 30, maxZoom: 16, duration: 600 }); }
let coast = null;
async function drawFallback() {
  if (!mapEl) return; mapEl.classList.add('flat');
  try { if (!coast) { const [{ COAST, COAST_Q }, { decodeCoast }] = await Promise.all([import('/lib/flights-coast.js'), import('/lib/flights-core.js')]); coast = decodeCoast(COAST, COAST_Q); } } catch (_) { coast = []; }
  const fc = features(), pts = []; for (const f of fc.features) { const g = f.geometry; if (g.type === 'Point') pts.push(g.coordinates); else if (g.type === 'LineString') pts.push(...g.coordinates); else pts.push(...g.coordinates[0]); }
  let [w0, s0, e0, n0] = pts.length ? [Math.min(...pts.map((c) => c[0])), Math.min(...pts.map((c) => c[1])), Math.max(...pts.map((c) => c[0])), Math.max(...pts.map((c) => c[1]))] : [-180, -60, 180, 80];
  const span = Math.max(e0 - w0, (n0 - s0) * 2, 6); const cx = (w0 + e0) / 2, cy = (s0 + n0) / 2; w0 = cx - span * 0.6; e0 = cx + span * 0.6; s0 = cy - span * 0.3; n0 = cy + span * 0.3;
  const W = 640, H = 320, X = (lon) => (lon - w0) / (e0 - w0) * W, Y = (lat) => (n0 - lat) / (n0 - s0) * H;
  let d = ''; for (const l of coast) { let prev = null; for (const [lon, lat] of l) { const x = X(lon); d += (prev === null || Math.abs(x - prev) > W / 2 ? 'M' : 'L') + x.toFixed(1) + ' ' + Y(lat).toFixed(1); prev = x; } }
  let g = '<path d="' + d + '" fill="none" stroke="currentColor" stroke-opacity=".55" stroke-width="1"/>';
  const col = (k) => ({ route: COL.accent, alt: COL.alt, path: COL.shape, saved: COL.saved, res: COL.res, pin: COL.pin, stop: COL.accent, shape: COL.shape }[k] || COL.accent);
  for (const f of fc.features) { const gm = f.geometry, k = f.properties.kind;
    if (gm.type === 'LineString') g += '<polyline fill="none" stroke="' + col(k) + '" stroke-width="3" points="' + gm.coordinates.map((c) => X(c[0]).toFixed(1) + ',' + Y(c[1]).toFixed(1)).join(' ') + '"/>';
    else if (gm.type === 'Polygon') g += '<polygon fill="' + COL.shape + '" fill-opacity=".15" stroke="' + COL.shape + '" points="' + gm.coordinates[0].map((c) => X(c[0]).toFixed(1) + ',' + Y(c[1]).toFixed(1)).join(' ') + '"/>'; }
  for (const f of fc.features) { const gm = f.geometry; if (gm.type !== 'Point') continue; const x = X(gm.coordinates[0]), y = Y(gm.coordinates[1]); g += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="5" fill="' + col(f.properties.kind) + '"/>' + (f.properties.name ? '<text x="' + (x + 7).toFixed(1) + '" y="' + (y - 6).toFixed(1) + '" font-size="12" fill="currentColor">' + f.properties.name.replace(/[<&]/g, ' ').slice(0, 40) + '</text>' : ''); }
  mapEl.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + t('Map') + '">' + g + '</svg>';
  mapEl.querySelector('svg').addEventListener('click', (e) => { const r = e.currentTarget.getBoundingClientRect(), lon = w0 + (e.clientX - r.left) / r.width * (e0 - w0), lat = n0 - (e.clientY - r.top) / r.height * (n0 - s0); const p = C.pt(lat, lon); if (p && onMapClick) onMapClick(p); });
}
async function loadMap(view) {
  const wanted = view || { lat: 30, lon: 0, z: 1.4 };
  if (!navigator.onLine) { fallback = true; say(mapNote, t('The map tiles need the network. Offline, Verse draws the coastlines it carries with your places on them.')); return drawFallback(); }
  try {
    if (!document.querySelector('link[data-ml]')) document.head.append(h('link', { rel: 'stylesheet', href: VENDOR + 'maplibre-gl.css', 'data-ml': '1' }));
    const ml = await import(VENDOR + 'maplibre-gl.js');
    ml.setWorkerUrl(VENDOR + 'maplibre-gl-worker.js'); // served as .js (Pages' content type for .mjs is not promised); an ES module worker beside it
    const map = new ml.Map({ container: mapEl, style: C.STYLE, center: [wanted.lon, wanted.lat], zoom: wanted.z, attributionControl: { compact: true }, cooperativeGestures: false, maxPitch: 60 });
    map.addControl(new ml.NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(new ml.ScaleControl({ unit: de ? 'metric' : 'imperial' }), 'bottom-left'); map.addControl(new ml.ScaleControl({ unit: de ? 'imperial' : 'metric' }), 'bottom-left');
    let up = false;
    const fail = () => { if (up || fallback) return; fallback = true; try { map.remove(); } catch (_) {} M = null; say(mapNote, t('The map tiles need the network. Offline, Verse draws the coastlines it carries with your places on them.')); drawFallback(); };
    const timer = setTimeout(fail, 15000);
    map.on('error', (e) => { if (!up && /style|Failed to fetch|NetworkError/i.test(String(e && e.error && e.error.message))) fail(); });
    map.on('load', () => {
      up = true; clearTimeout(timer); M = { map, ml };
      map.addSource('v', { type: 'geojson', data: features() });
      map.addLayer({ id: 'v-fill', type: 'fill', source: 'v', filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': COL.shape, 'fill-opacity': 0.15 } });
      map.addLayer({ id: 'v-edge', type: 'line', source: 'v', filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'line-color': COL.shape, 'line-width': 2 } });
      map.addLayer({ id: 'v-alt', type: 'line', source: 'v', filter: ['==', ['get', 'kind'], 'alt'], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': COL.alt, 'line-width': 5, 'line-opacity': 0.8 } });
      map.addLayer({ id: 'v-route', type: 'line', source: 'v', filter: ['in', ['get', 'kind'], ['literal', ['route', 'path']]], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['match', ['get', 'kind'], 'path', COL.shape, COL.accent], 'line-width': 6 } });
      map.addLayer({ id: 'v-pt', type: 'circle', source: 'v', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': ['match', ['get', 'kind'], 'pin', 9, 'shape', 5, 7], 'circle-color': ['match', ['get', 'kind'], 'saved', COL.saved, 'res', COL.res, 'pin', COL.pin, 'shape', COL.shape, COL.accent], 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 } });
      map.addLayer({ id: 'v-lbl', type: 'symbol', source: 'v', filter: ['all', ['==', ['geometry-type'], 'Point'], ['!=', ['get', 'name'], '']], layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 12, 'text-offset': [0, 1.3], 'text-anchor': 'top', 'text-max-width': 12, 'text-optional': true }, paint: { 'text-color': '#15131c', 'text-halo-color': '#fff', 'text-halo-width': 1.5 } });
      map.on('click', (e) => { const p = C.pt(e.lngLat.lat, e.lngLat.lng); if (p && onMapClick) onMapClick(p); });
      map.on('moveend', () => { const c = map.getCenter(); S.view = { lat: c.lat, lon: c.lng, z: Math.round(map.getZoom() * 10) / 10 }; });
      say(mapNote, t('Tap the map to drop a pin.')); mapEl.dataset.ready = '1'; for (const f of subs) f();
    });
  } catch (_) { fallback = true; say(mapNote, t('The map tiles need the network. Offline, Verse draws the coastlines it carries with your places on them.')); drawFallback(); }
}

// ---------- the pin ----------
function showPin(p, opts = {}) {
  S.pin = p; draw(); if (opts.fly !== false) { if (p.bbox) fitBox(p.bbox); else fit([p], opts.z || 16); }
  if (!pinCard) return; pinCard.hidden = false; pinCard.textContent = '';
  const st = h('p', { class: 'live', 'aria-live': 'polite' });
  const title = h('h3', {}, p.name || C.fmtLatLon(p.lat, p.lon));
  const rows = h('dl', { class: 'dl' }, h('div', {}, h('dt', {}, t('Decimal degrees')), h('dd', {}, C.fmtLatLon(p.lat, p.lon))), h('div', {}, h('dt', {}, t('Degrees, minutes, seconds')), h('dd', {}, C.toDms(p.lat, p.lon))), p.where ? h('div', {}, h('dt', {}, t('Address')), h('dd', {}, p.where)) : null);
  const saveBtn = h('button', { type: 'button', class: 'go', onclick: () => { C.savePlace(p); say(st, t('Saved')); draw(); for (const f of subs) f(); } }, t('Save'));
  const what = h('button', { type: 'button', onclick: async () => { say(st, t('Loading…')); try { const r = await reverse(p); if (r) { showPin({ ...p, name: r.name, where: r.full }, { fly: false }); } else say(st, t('Nothing found. Try a city, a street with its town, or coordinates.')); } catch (_) { say(st, t('The place search did not answer. Check the connection and try again in a moment.'), true); } } }, t('What is here?'));
  const buttons = h('div', { class: 'row' }, saveBtn, what);
  if (cfg.panels.includes('directions')) buttons.append(h('button', { type: 'button', onclick: () => setEnd('from', p) }, t('Directions from here')), h('button', { type: 'button', onclick: () => setEnd('to', p) }, t('Directions to here')));
  buttons.append(h('button', { type: 'button', onclick: () => copyText(C.stateLink(path, { ll: p, z: 16, name: p.name }, location.origin), st) }, t('Copy link')));
  if (navigator.share) buttons.append(h('button', { type: 'button', onclick: () => navigator.share({ title: p.name || 'Verse map', url: C.stateLink(path, { ll: p, z: 16, name: p.name }, location.origin) }).catch(() => {}) }, t('Share')));
  pinCard.append(title, rows, buttons, linkRow([...C.placeLinks(p), { id: 'traffic', name: t('Live traffic') + ' (Google Maps)', url: C.trafficLink(p) }]), st);
}

// ---------- panels ----------
function searchPanel() {
  const input = h('input', { type: 'search', id: 'm-q', name: 'q', placeholder: t('Place, address or coordinates'), 'aria-label': t('Place, address or coordinates'), autocomplete: 'off', enterkeyhint: 'search' });
  const list = h('ol', { class: 'alist', id: 'm-res', 'aria-live': 'polite' }), st = h('p', { class: 'live', 'aria-live': 'polite' });
  const local = h('ul', { class: 'alist', id: 'm-local' });
  input.addEventListener('input', () => { const q = input.value.trim().toLowerCase(); local.textContent = ''; if (q.length < 2) return; for (const p of C.savedPlaces().filter((x) => x.name.toLowerCase().includes(q)).slice(0, 5)) local.append(h('li', {}, h('button', { type: 'button', onclick: () => showPin(p) }, '★ ' + p.name))); });
  async function run(q) {
    q = String(q || '').trim(); if (!q) return; list.textContent = ''; local.textContent = '';
    const c = C.parseCoords(q); if (c) { S.results = []; showPin({ ...c, name: C.fmtLatLon(c.lat, c.lon) }); say(st, ''); return; }
    say(st, t('Searching…'));
    try {
      const r = await searchPlaces(q, null); S.results = r; draw();
      if (!r.length) return say(st, t('Nothing found. Try a city, a street with its town, or coordinates.'));
      say(st, r.length + ' ' + (de ? 'Treffer' : r.length === 1 ? 'result' : 'results'));
      r.forEach((p, i) => list.append(h('li', {}, h('button', { type: 'button', onclick: () => showPin(p) }, h('b', {}, (i + 1) + '. ' + p.name), h('br'), h('span', { class: 'soft' }, [p.kind, p.where].filter(Boolean).join(' · '))))));
      showPin(r[0]); if (r.length > 1 && M) fit(r, 13);
    } catch (e) { say(st, String(e.message) === 'offline' ? t('You are offline: search, directions and tiles need the network; saved places, coordinates and measuring still work.') : t('The place search did not answer. Check the connection and try again in a moment.'), true); }
  }
  const form = h('form', { role: 'search', class: 'row', onsubmit: (e) => { e.preventDefault(); history.replaceState(null, '', C.stateLink(path, { q: input.value.trim() }, '') || path); run(input.value); } }, input, h('button', { type: 'submit', class: 'go' }, t('Search')));
  subs.push(() => {}); searchPanel.run = run; searchPanel.input = input;
  return h('section', { class: 'panel', 'aria-label': t('Search places') }, h('h2', {}, t('Search places')), form, local, st, list, h('p', { class: 'note' }, t('Place search runs when you press Search (OpenStreetMap\'s Nominatim asks for no search-as-you-type, one search a second); answers are kept on this device.')));
}
function mapPanel() {
  mapEl = h('div', { id: 'm-map', class: 'mapbox', role: 'region', 'aria-label': t('Map') });
  mapNote = h('p', { class: 'live', 'aria-live': 'polite' }, t('Loading the map…'));
  pinCard = h('div', { id: 'm-pin', class: 'card', hidden: true });
  const st = h('p', { class: 'live', 'aria-live': 'polite' });
  const locate = h('button', { type: 'button', onclick: async () => { say(st, t('Loading…')); try { const p = await myPosition(); say(st, ''); showPin(p, { z: 16 }); } catch (_) { say(st, t('Location is blocked or not available here.'), true); } } }, '◎ ' + t('My location'));
  const link = h('button', { type: 'button', onclick: () => copyText(C.stateLink(path, currentState(), location.origin), st) }, t('Copy link'));
  const bar = h('div', { class: 'row' }, locate, link); if (navigator.share) bar.append(h('button', { type: 'button', onclick: () => navigator.share({ title: document.title, url: C.stateLink(path, currentState(), location.origin) }).catch(() => {}) }, t('Share')));
  return h('section', { class: 'panel', 'aria-label': t('Map') }, bar, mapEl, mapNote, st, pinCard,
    h('p', { class: 'note' }, 'Map: ', h('a', { href: 'https://openfreemap.org/', target: '_blank', rel: 'noopener noreferrer' }, 'OpenFreeMap'), ' © ', h('a', { href: 'https://openmaptiles.org/', target: '_blank', rel: 'noopener noreferrer' }, 'OpenMapTiles'), ' · Data © ', h('a', { href: 'https://www.openstreetmap.org/copyright', target: '_blank', rel: 'noopener noreferrer' }, 'OpenStreetMap contributors'), ' · MapLibre GL'));
}
function trafficPanel() {
  const p = h('p', {}, t('Live traffic: Verse does not have it. No free source allows it, so Verse will not pretend: route times here are at free-flow speed.'), ' ');
  const a = h('a', { href: C.trafficLink({ lat: 51.5074, lon: -0.1278 }), target: '_blank', rel: 'noopener noreferrer', id: 'm-traffic' }, t('See live traffic on Google Maps') + ' ↗');
  subs.push(() => { const v = S.pin || S.view; if (v) a.href = C.trafficLink(v, v.z || 13); });
  return h('section', { class: 'notice', 'aria-label': t('Live traffic') }, h('h2', {}, t('Live traffic')), p, a);
}
const ends = { from: null, to: null, via: [] };
function setEnd(which, p) { const el = $('m-' + which); if (el) { el.value = p.name && !/^-?\d/.test(p.name) ? p.name : C.fmtLatLon(p.lat, p.lon); ends[which] = { ...p, typed: el.value }; el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } }
function directionsPanel() {
  const st = h('p', { class: 'live', 'aria-live': 'polite' }), out = h('div', { id: 'm-route' });
  const from = h('input', { type: 'text', id: 'm-from', placeholder: t('Place, address or coordinates'), autocomplete: 'off' }), to = h('input', { type: 'text', id: 'm-to', placeholder: t('Place, address or coordinates'), autocomplete: 'off' });
  const vias = h('div', { id: 'm-vias' });
  const addVia = (v = '') => { const i = h('input', { type: 'text', class: 'via', value: v, placeholder: t('Stop'), 'aria-label': t('Stop') }); const row = h('div', { class: 'field rowf' }, i, h('button', { type: 'button', 'aria-label': t('Remove'), onclick: () => row.remove() }, '✕')); vias.append(row); return i; };
  const modes = h('div', { class: 'row', role: 'radiogroup', 'aria-label': 'Mode' }, ...[['car', '🚗 ' + t('Car')], ['bike', '🚲 ' + t('Bike')], ['foot', '🚶 ' + t('Walk')]].map(([m, label]) => h('button', { type: 'button', role: 'radio', 'data-mode': m, 'aria-checked': String(S.mode === m), onclick: (e) => { S.mode = m; for (const b of modes.querySelectorAll('button')) b.setAttribute('aria-checked', String(b.dataset.mode === m)); if (S.routes) go(); } }, label)));
  const me = h('button', { type: 'button', onclick: async () => { try { const p = await myPosition(); from.value = C.fmtLatLon(p.lat, p.lon); } catch (_) { say(st, t('Location is blocked or not available here.'), true); } } }, '◎ ' + t('Use my location'));
  const swap = h('button', { type: 'button', 'aria-label': t('Swap'), onclick: () => { [from.value, to.value] = [to.value, from.value]; } }, '⇅ ' + t('Swap'));
  async function go() {
    const typed = [from.value, ...[...vias.querySelectorAll('input')].map((i) => i.value), to.value].map((x) => x.trim()).filter(Boolean);
    if (typed.length < 2) return say(st, t('Type where from and where to.'));
    say(st, t('Finding the route…')); out.textContent = '';
    const pts = [];
    for (const s of typed) { let p = null; try { p = await resolvePlace(s); } catch (e) { return say(st, String(e && e.message) === 'offline' ? t('You are offline: search, directions and tiles need the network; saved places, coordinates and measuring still work.') : t('The place search did not answer. Check the connection and try again in a moment.'), true); } if (!p) return say(st, t('Could not find') + ': ' + s, true); pts.push({ ...p, name: p.name || s }); }
    let routes = null; try { routes = C.routesOf(await getJson(C.routeUrl(pts, S.mode), 'router'), de); } catch (_) { return say(st, t('The router did not answer (it is a free demo). Try again in a moment.'), true); }
    if (!routes) return say(st, t('No route found between those places.'), true);
    S.routes = routes; S.ri = 0; S.routePts = pts; draw(); fit(routes[0].line.filter((_, i, a) => i % Math.max(1, Math.floor(a.length / 50)) === 0).map((c) => ({ lon: c[0], lat: c[1] })).concat(pts));
    history.replaceState(null, '', C.stateLink(path, { from: typed[0], via: typed.slice(1, -1), to: typed[typed.length - 1], mode: S.mode }, ''));
    say(st, ''); show();
  }
  function show() {
    out.textContent = ''; const r = S.routes[S.ri], pts = S.routePts;
    if (S.routes.length > 1) out.append(h('div', { class: 'row', role: 'tablist' }, ...S.routes.map((x, i) => h('button', { type: 'button', role: 'tab', 'aria-selected': String(i === S.ri), onclick: () => { S.ri = i; draw(); show(); } }, (i ? t('Other route') : t('Fastest')) + ': ' + C.fmtMin(x.min) + ' · ' + C.fmtKm(x.km, de)))));
    out.append(h('p', { class: 'big' }, C.fmtMin(r.min), ' ', h('small', {}, C.fmtKm(r.km, de))), h('p', { class: 'soft' }, pts.map((p) => p.name).join(' → ')));
    const s2 = h('p', { class: 'live', 'aria-live': 'polite' });
    const link = C.stateLink(path, { from: from.value.trim(), via: [...vias.querySelectorAll('input')].map((i) => i.value.trim()).filter(Boolean), to: to.value.trim(), mode: S.mode }, location.origin);
    out.append(h('div', { class: 'row' }, h('button', { type: 'button', onclick: () => copyText(link, s2) }, t('Copy link')), navigator.share ? h('button', { type: 'button', onclick: () => navigator.share({ title: pts.map((p) => p.name).join(' → '), url: link }).catch(() => {}) }, t('Share')) : null,
      h('button', { type: 'button', onclick: () => download('route.gpx', C.gpxOf({ places: pts, line: r.line, name: pts.map((p) => p.name).join(' - ') }), 'application/gpx+xml') }, t('Download GPX'))), s2);
    out.append(linkRow(C.routeLinks(pts, S.mode)), h('p', { class: 'links' }, h('a', { href: C.transitLink(pts[0], pts[pts.length - 1]), target: '_blank', rel: 'noopener noreferrer' }, t('By public transport on Google Maps') + ' ↗'), ' · ', h('a', { href: C.trafficLink(pts[0]), target: '_blank', rel: 'noopener noreferrer' }, t('See live traffic on Google Maps') + ' ↗')));
    const ol = h('ol', { class: 'steps' }); for (const s of r.steps) ol.append(h('li', {}, h('button', { type: 'button', class: 'step', onclick: () => s.at && fit([s.at], 17) }, s.text, s.km > 0.01 ? h('span', { class: 'soft' }, ' · ' + C.fmtKm(s.km, de)) : null)));
    out.append(h('details', { open: r.steps.length <= 30 }, h('summary', {}, t('Steps') + ' (' + r.steps.length + ')'), ol));
  }
  directionsPanel.go = go; directionsPanel.from = from; directionsPanel.to = to; directionsPanel.addVia = addVia;
  const form = h('form', { onsubmit: (e) => { e.preventDefault(); go(); } },
    h('div', { class: 'field' }, h('label', { for: 'm-from' }, t('From')), from), vias, h('div', { class: 'field' }, h('label', { for: 'm-to' }, t('To')), to),
    h('div', { class: 'row' }, me, swap, h('button', { type: 'button', onclick: () => addVia().focus() }, '+ ' + t('Add a stop'))), modes, h('div', { class: 'row' }, h('button', { type: 'submit', class: 'go' }, t('Get directions'))));
  return h('section', { class: 'panel', 'aria-label': t('Directions') }, h('h2', {}, t('Directions')), form, st, out, h('p', { class: 'note' }, t('Routes come from the FOSSGIS OSRM demo servers on OpenStreetMap data (a free demo: it can be slow or down). Times are at free-flow speed with no live traffic.')));
}
function savedPanel() {
  const list = h('ul', { class: 'alist', id: 'm-saved' }), st = h('p', { class: 'live', 'aria-live': 'polite' });
  const render = () => {
    list.textContent = ''; const l = C.savedPlaces();
    if (!l.length) list.append(h('li', { class: 'soft' }, t('No saved places yet. Search or tap the map, then press Save.')));
    for (const p of l) list.append(h('li', { class: 'saved' }, h('button', { type: 'button', class: 'grow', onclick: () => showPin(p) }, '★ ' + p.name, h('span', { class: 'soft' }, ' · ' + C.fmtLatLon(p.lat, p.lon))),
      h('button', { type: 'button', 'aria-label': t('Rename') + ' ' + p.name, onclick: () => { const n = prompt(t('New name'), p.name); if (n) { C.renamePlace(p.id, n); render(); draw(); } } }, '✎'),
      h('button', { type: 'button', 'aria-label': t('Remove') + ' ' + p.name, onclick: () => { C.removePlace(p.id); render(); draw(); } }, '✕')));
  };
  subs.push(render);
  const file = h('input', { type: 'file', accept: '.gpx,.geojson,.json,application/gpx+xml,application/geo+json', class: 'pick', id: 'm-import', onchange: async (e) => { const f = e.target.files[0]; if (!f) return; const { places } = C.readGeoFile(await f.text()); for (const p of places) C.savePlace(p); say(st, t('Imported') + ' ' + places.length + ' ' + t('places')); render(); draw(); e.target.value = ''; } });
  render();
  return h('section', { class: 'panel', 'aria-label': t('Saved places') }, h('h2', {}, t('Saved places')), h('p', { class: 'note' }, t('Kept on this device only. They open with the network cut.')), list,
    h('div', { class: 'row' }, h('button', { type: 'button', onclick: () => download('saved-places.gpx', C.gpxOf({ places: C.savedPlaces(), name: 'Saved places' }), 'application/gpx+xml') }, t('Download GPX')), h('button', { type: 'button', onclick: () => download('saved-places.geojson', C.geojsonOf({ places: C.savedPlaces() }), 'application/geo+json') }, t('Download GeoJSON')), h('label', { class: 'btn', for: 'm-import' }, t('Import GPX or GeoJSON')), file), st);
}
function coordsPanel() {
  const input = h('input', { type: 'text', id: 'm-coord', placeholder: '38.7223, -9.1393', 'aria-label': t('Coordinates in any form'), autocomplete: 'off' }), out = h('div', { id: 'm-coord-out', 'aria-live': 'polite' });
  const conv = () => { out.textContent = ''; const p = C.parseCoords(input.value); if (!p) { if (input.value.trim()) out.append(h('p', { class: 'bad' }, t('Not coordinates I can read.'))); return; }
    out.append(h('dl', { class: 'dl' }, h('div', {}, h('dt', {}, t('Decimal degrees')), h('dd', {}, C.fmtLatLon(p.lat, p.lon))), h('div', {}, h('dt', {}, t('Degrees, minutes, seconds')), h('dd', {}, C.toDms(p.lat, p.lon)))),
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'go', onclick: () => showPin({ ...p, name: C.fmtLatLon(p.lat, p.lon) }) }, t('Show')), h('button', { type: 'button', onclick: async () => { const s = h('span', {}, t('Looking up the address…')); out.append(s); try { const r = await reverse(p); s.textContent = r ? r.full : t('Nothing found. Try a city, a street with its town, or coordinates.'); if (r) showPin({ ...p, name: r.name, where: r.full }); } catch (_) { s.textContent = t('The place search did not answer. Check the connection and try again in a moment.'); } } }, t('Address of these coordinates'))), linkRow(C.placeLinks(p))); };
  input.addEventListener('input', conv);
  const a = h('input', { type: 'text', id: 'm-d1', placeholder: '51.5074, -0.1278', 'aria-label': t('First point') }), b = h('input', { type: 'text', id: 'm-d2', placeholder: '48.8566, 2.3522', 'aria-label': t('Second point') }), d = h('p', { id: 'm-dist', 'aria-live': 'polite' });
  const dist = () => { const p = C.parseCoords(a.value), q = C.parseCoords(b.value); d.textContent = p && q ? t('Distance') + ': ' + C.fmtKm(C.haversine(p, q), de) + ' (' + t('as the crow flies') + ')' : ''; };
  a.addEventListener('input', dist); b.addEventListener('input', dist);
  coordsPanel.input = input; coordsPanel.conv = conv;
  return h('section', { class: 'panel', 'aria-label': t('Coordinates') }, h('h2', {}, t('Coordinates')), h('p', { class: 'note' }, t('Paste coordinates in any form: 38.7223, -9.1393 · 38°43′20″N 9°08′21″W · a Google Maps, OpenStreetMap or Apple Maps link.')), input, out,
    h('h3', {}, t('Distance between two points')), h('div', { class: 'grid2' }, a, b), d);
}
function wherePanel() {
  const out = h('div', { id: 'm-where', 'aria-live': 'polite' }), rough = h('div', { class: 'soft', id: 'm-rough' }), st = h('p', { class: 'live', 'aria-live': 'polite' });
  // the coarse place Cloudflare gives the connection (/api/where: city level, rounded to a tenth of a degree), shown at once without asking for permission
  fetch('/api/where').then((r) => r.json()).then((j) => { if (!j || !j.ok) return; const row = (k, v) => h('div', {}, h('dt', {}, k), h('dd', {}, v));
    rough.append(t('Roughly, from your connection (city level, without asking):'), h('dl', { class: 'dl' }, row(t('Decimal degrees'), C.fmtLatLon(j.lat, j.lon)), row(t('Degrees, minutes, seconds'), C.toDms(j.lat, j.lon)), row(t('Address'), [j.city, j.country].filter(Boolean).join(', ') || '—'), row(t('Accuracy'), '± 10 km'), j.timezone ? row(t('Time zone'), j.timezone) : null)); }).catch(() => {});
  const find = h('button', { type: 'button', class: 'go', id: 'm-findme', onclick: async () => {
    say(st, t('Loading…')); out.textContent = '';
    let p; try { p = await myPosition(); } catch (_) { return say(st, t('Location is blocked or not available here.'), true); }
    say(st, ''); showPin(p, { z: 16 });
    const row = (k, v) => v == null || v === '' ? null : h('div', {}, h('dt', {}, k), h('dd', {}, v));
    const addr = h('dd', {}, t('Looking up the address…'));
    out.append(h('dl', { class: 'dl' }, row(t('Decimal degrees'), C.fmtLatLon(p.lat, p.lon)), row(t('Degrees, minutes, seconds'), C.toDms(p.lat, p.lon)), row(t('Accuracy'), p.acc != null ? '± ' + Math.round(p.acc) + ' m' : null), row(t('Altitude'), p.alt != null ? Math.round(p.alt) + ' m' : null), row(t('Speed'), p.speed != null ? (p.speed * 3.6).toFixed(1) + ' km/h' : null), row(t('Heading'), p.heading != null && Number.isFinite(p.heading) ? Math.round(p.heading) + '°' : null), row(t('Time zone'), Intl.DateTimeFormat().resolvedOptions().timeZone), h('div', {}, h('dt', {}, t('Address')), addr)));
    try { const r = await reverse(p); addr.textContent = r ? r.full : '—'; } catch (_) { addr.textContent = '—'; }
  } }, '◎ ' + t('Find me'));
  return h('section', { class: 'panel', 'aria-label': t('Where am I?') }, h('h2', {}, t('Where am I?')), rough, h('div', { class: 'row' }, find), st, out, h('p', { class: 'note' }, t('Press Find me and allow location for the exact spot. Your position stays on this device unless you share it.')));
}
function measurePanel() {
  const st = h('p', { class: 'live', 'aria-live': 'polite', id: 'm-measure-out' }), tools = ['radius', 'path', 'area', 'elevation'];
  const tabs = h('div', { class: 'row', role: 'tablist' }, ...tools.map((k) => h('button', { type: 'button', role: 'tab', 'data-tool': k, 'aria-selected': String(k === 'radius'), onclick: () => pick(k) }, t({ radius: 'Radius', path: 'Path', area: 'Area', elevation: 'Elevation' }[k]))));
  const rIn = h('input', { type: 'number', id: 'm-r', min: '0.01', step: 'any', value: String(S.r), inputmode: 'decimal' });
  const help = h('p', { class: 'note' }), extra = h('div', {});
  const report = () => {
    if (S.tool === 'radius') st.textContent = S.center ? t('Radius') + ' ' + C.fmtKm(S.r, de) + ' · ' + t('Circle area') + ' ' + (Math.PI * S.r * S.r).toLocaleString(de ? 'de-DE' : 'en-US', { maximumFractionDigits: S.r < 3 ? 2 : 0 }) + ' km² · ' + C.fmtLatLon(S.center.lat, S.center.lon) : '';
    else if (S.tool === 'path') st.textContent = S.path.length ? S.path.length + ' ' + t('Points') + ' · ' + t('Distance') + ' ' + C.fmtKm(C.pathKm(S.path), de) : '';
    else if (S.tool === 'area') { const a = C.areaKm2(S.area); st.textContent = S.area.length ? S.area.length + ' ' + t('Points') + (S.area.length > 2 ? ' · ' + t('Area') + ' ' + (a < 1 ? Math.round(a * 1e6).toLocaleString(de ? 'de-DE' : 'en-US') + ' m² · ' + (a * 247.105).toFixed(2) + ' acres' : a.toLocaleString(de ? 'de-DE' : 'en-US', { maximumFractionDigits: 2 }) + ' km² · ' + (a * 0.386102).toFixed(2) + ' mi²') + ' · ' + t('Distance') + ' ' + C.fmtKm(C.pathKm([...S.area, S.area[0]]), de) : '') : ''; }
  };
  function pick(k) {
    S.tool = k; for (const b of tabs.querySelectorAll('button')) b.setAttribute('aria-selected', String(b.dataset.tool === k)); extra.textContent = '';
    if (k === 'radius') { help.textContent = t('Tap the map to set the centre (or search a place), choose a radius, and the circle is drawn.'); extra.append(h('div', { class: 'row' }, h('label', { for: 'm-r' }, t('Radius (km)')), rIn, h('button', { type: 'button', class: 'go', onclick: () => { S.center = S.center || S.pin; S.r = Math.max(0.01, +rIn.value || 1); draw(); if (S.center) fit(C.circleRing(S.center, S.r).map((c) => ({ lon: c[0], lat: c[1] })), 17); report(); } }, t('Draw the circle')))); }
    else if (k === 'path' || k === 'area') { help.textContent = t('Tap the map point by point; the length (or the area inside) adds up as you go.'); extra.append(h('div', { class: 'row' }, h('button', { type: 'button', onclick: () => { (k === 'path' ? S.path : S.area).pop(); draw(); report(); } }, t('Undo')), h('button', { type: 'button', onclick: () => { if (k === 'path') S.path = []; else S.area = []; draw(); report(); } }, t('Clear')))); }
    else { help.textContent = t('Elevation from Open-Meteo (Copernicus DEM, 90 m).'); const out = h('p', { id: 'm-ele' }); extra.append(h('div', { class: 'row' }, h('button', { type: 'button', class: 'go', onclick: async () => { const p = S.pin; if (!p) { out.textContent = t('Tap the map to drop a pin.'); return; } out.textContent = t('Loading…'); try { const j = await getJson(C.elevationUrl([p]), 'elevation'); const e = j && j.elevation && j.elevation[0]; out.textContent = t('Elevation of the pin') + ': ' + Math.round(e) + ' m · ' + Math.round(e * 3.28084) + ' ft · ' + C.fmtLatLon(p.lat, p.lon); } catch (_) { out.textContent = t('You are offline: search, directions and tiles need the network; saved places, coordinates and measuring still work.'); } } }, t('Get the elevation'))), out); }
    report();
  }
  measurePanel.click = (p) => { if (S.tool === 'radius') { S.center = p; S.r = Math.max(0.01, +rIn.value || S.r); draw(); report(); return true; } if (S.tool === 'path') { S.path.push(p); draw(); report(); return true; } if (S.tool === 'area') { S.area.push(p); draw(); report(); return true; } return false; };
  measurePanel.pick = pick; measurePanel.report = report;
  rIn.addEventListener('change', () => { S.r = Math.max(0.01, +rIn.value || 1); if (S.center) { draw(); report(); } });
  const sec = h('section', { class: 'panel', 'aria-label': t('Measure') }, h('h2', {}, t('Measure')), tabs, help, extra, st,
    h('div', { class: 'row' }, h('button', { type: 'button', onclick: () => { const s2 = st; copyText(C.stateLink(path, { ll: S.center || undefined, r: S.center ? S.r : undefined, pts: S.tool === 'area' ? S.area : S.path }, location.origin), s2); } }, t('Copy link')), h('button', { type: 'button', onclick: () => download('measure.gpx', C.gpxOf({ places: S.center ? [{ ...S.center, name: 'Centre' }] : [], line: (S.tool === 'area' ? [...S.area, ...S.area.slice(0, 1)] : S.path).map((p) => [p.lon, p.lat]), name: 'Measure' }), 'application/gpx+xml') }, t('Download GPX'))));
  pick('radius'); return sec;
}
function planPanel() {
  const st = h('p', { class: 'live', 'aria-live': 'polite', id: 'm-plan-out' }), list = h('ol', { class: 'plain', id: 'm-plan-pts' }), prof = h('div', { class: 'chart', id: 'm-prof' });
  const follow = h('input', { type: 'checkbox', id: 'm-follow', checked: true, onchange: () => { S.follow = follow.checked; rebuild(); } });
  const modeSel = h('select', { id: 'm-pmode', 'aria-label': 'Mode', onchange: () => { S.mode = modeSel.value; rebuild(); } }, h('option', { value: 'car' }, t('Car')), h('option', { value: 'bike' }, t('Bike')), h('option', { value: 'foot' }, t('Walk')));
  let busy = 0;
  async function rebuild() {
    const my = ++busy; list.textContent = ''; S.plan.forEach((p, i) => list.append(h('li', {}, t('Point') + ' ' + (i + 1) + ' · ' + C.fmtLatLon(p.lat, p.lon), ' ', h('button', { type: 'button', 'aria-label': t('Remove') + ' ' + (i + 1), onclick: () => { S.plan.splice(i, 1); rebuild(); } }, '✕'))));
    S.planLine = []; S.planEle = []; prof.textContent = ''; draw();
    if (S.plan.length < 2) { st.textContent = S.plan.length ? t('Points') + ': 1' : ''; return; }
    let km = C.pathKm(S.plan), min = null;
    if (S.follow) { try { const r = C.routesOf(await getJson(C.routeUrl(S.plan, S.mode), 'router'), de); if (my !== busy) return; if (r) { S.planLine = r[0].line; km = r[0].km; min = r[0].min; } } catch (_) { st.textContent = t('The router did not answer (it is a free demo). Try again in a moment.'); } }
    if (!S.planLine.length) S.planLine = S.plan.map((p) => [p.lon, p.lat]);
    draw(); st.textContent = t('Total') + ': ' + C.fmtKm(km, de) + (min != null ? ' · ' + C.fmtMin(min) : '');
    try { const sm = C.sampleLine(S.planLine, 100); const j = await getJson(C.elevationUrl(sm), 'elevation'); if (my !== busy) return; S.planEle = (j && j.elevation) || []; const c = C.climb(S.planEle); st.textContent += ' · ' + t('Climb') + ' ' + c.up + ' m · ' + t('Descent') + ' ' + c.down + ' m'; prof.innerHTML = profileSvg(S.planEle, km); } catch (_) { /* the profile needs the network */ }
  }
  planPanel.click = (p) => { if (S.tool !== 'plan') return false; S.plan.push(p); rebuild(); return true; };
  planPanel.rebuild = rebuild;
  const file = h('input', { type: 'file', class: 'pick', id: 'm-gpx', accept: '.gpx,.geojson,.json', onchange: async (e) => { const f = e.target.files[0]; if (!f) return; const { places, line } = C.readGeoFile(await f.text()); if (line.length) { S.plan = C.sampleLine(line, Math.min(line.length, 25)).map((p) => C.pt(p.lat, p.lon)); S.follow = false; follow.checked = false; } else S.plan = places.map((p) => C.pt(p.lat, p.lon)); await rebuild(); fit(S.plan); e.target.value = ''; } });
  return h('section', { class: 'panel', 'aria-label': t('Plan a route') }, h('h2', {}, t('Plan a route')), h('p', { class: 'note' }, t('Tap the map to add points. Follow roads and paths for the chosen mode, or draw straight lines.')),
    h('div', { class: 'row' }, h('label', { class: 'chk' }, follow, t('Follow roads')), modeSel, h('button', { type: 'button', onclick: () => { S.plan.pop(); rebuild(); } }, t('Undo')), h('button', { type: 'button', onclick: () => { S.plan.reverse(); rebuild(); } }, t('Reverse')), h('button', { type: 'button', onclick: () => { S.plan = []; rebuild(); } }, t('Clear'))),
    list, st, h('h3', {}, t('Elevation profile')), prof,
    h('div', { class: 'row' }, h('button', { type: 'button', onclick: () => download('route.gpx', C.gpxOf({ places: S.plan.map((p, i) => ({ ...p, name: t('Point') + ' ' + (i + 1) })), line: S.planLine.map((c, i) => [c[0], c[1], ...(S.planEle.length === S.planLine.length ? [S.planEle[i]] : [])]), name: 'Verse route' }), 'application/gpx+xml') }, t('Download GPX')),
      h('button', { type: 'button', onclick: () => download('route.geojson', C.geojsonOf({ places: S.plan, line: S.planLine }), 'application/geo+json') }, t('Download GeoJSON')), h('label', { class: 'btn', for: 'm-gpx' }, t('Open a GPX or GeoJSON file')), file,
      h('button', { type: 'button', onclick: () => copyText(C.stateLink(path, { pts: S.plan, mode: S.mode }, location.origin), st) }, t('Copy link'))));
}
function profileSvg(hs, km) {
  const v = hs.filter(Number.isFinite); if (v.length < 2) return ''; const lo = Math.min(...v), hi = Math.max(...v), W = 600, H = 140, pad = 24;
  const X = (i) => pad + i / (hs.length - 1) * (W - pad - 6), Y = (e) => H - 18 - (e - lo) / Math.max(1, hi - lo) * (H - 34);
  const d = hs.map((e, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(Number.isFinite(e) ? e : lo).toFixed(1)).join(' ');
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + t('Elevation profile') + '"><path d="' + d + ' L' + X(hs.length - 1) + ' ' + (H - 18) + ' L' + pad + ' ' + (H - 18) + 'Z" fill="currentColor" fill-opacity=".15"/><path d="' + d + '" fill="none" stroke="currentColor" stroke-width="2"/><text x="2" y="' + (Y(hi) + 4) + '" font-size="11" fill="currentColor">' + Math.round(hi) + ' m</text><text x="2" y="' + (H - 20) + '" font-size="11" fill="currentColor">' + Math.round(lo) + ' m</text><text x="' + (W - 6) + '" y="' + (H - 2) + '" font-size="11" text-anchor="end" fill="currentColor">' + C.fmtKm(km, de) + '</text></svg>';
}
function currentState() {
  if (S.routes && directionsPanel.from) return { from: directionsPanel.from.value.trim(), to: directionsPanel.to.value.trim(), mode: S.mode };
  if (S.plan.length) return { pts: S.plan, mode: S.mode };
  if (S.pin) return { ll: S.pin, z: S.view ? S.view.z : 15, name: S.pin.name };
  return S.view ? { ll: S.view, z: S.view.z } : {};
}

// ---------- the page keeps itself for offline (sw.js CACHE 'void-shell-v2', as lib/flights-ui.js does) ----------
function keepForOffline() {
  try { if (!('caches' in window)) return; caches.open('void-shell-v2').then((c) => Promise.all([location.pathname, location.pathname + 'app.js', '/lib/maps-ui.js', '/lib/maps-core.js', '/lib/maps-de.js', '/lib/flights-coast.js', '/lib/flights-core.js', '/lib/toolkit.js', '/lib/tool-sites.js', '/lib/flight-sites.js'].map((u) => c.match(u).then((hit) => hit || c.add(u)).catch(() => {})))).catch(() => {}); } catch (_) { /* the page still works online */ }
}

/** mounts the panels a page asks for into root: { panels: ['search', 'map', 'traffic', 'directions', 'saved', 'coords', 'where', 'measure', 'plan'], de: { h1, intro }, tool }. */
export function mountMaps(root, config = {}) {
  cfg = { panels: ['search', 'map', 'traffic', 'directions', 'saved'], ...config }; path = location.pathname;
  if (de) { document.documentElement.lang = 'de'; const d = cfg.de || {}; if (d.h1 && document.querySelector('h1')) document.querySelector('h1').textContent = d.h1; if (d.intro && document.querySelector('.intro')) document.querySelector('.intro').textContent = d.intro; if (d.foot && document.querySelector('footer')) document.querySelector('footer').textContent = d.foot; }
  const off = h('p', { class: 'notice', id: 'm-offline', hidden: navigator.onLine }, t('You are offline: search, directions and tiles need the network; saved places, coordinates and measuring still work.'));
  addEventListener('online', () => { off.hidden = true; }); addEventListener('offline', () => { off.hidden = false; });
  root.append(off);
  const make = { search: searchPanel, map: mapPanel, traffic: trafficPanel, directions: directionsPanel, saved: savedPanel, coords: coordsPanel, where: wherePanel, measure: measurePanel, plan: planPanel };
  for (const p of cfg.panels) if (make[p]) root.append(make[p]());
  S.tool = cfg.tool || (cfg.panels.includes('measure') ? 'radius' : cfg.panels.includes('plan') ? 'plan' : 'pin');
  if (cfg.panels.includes('measure') && measurePanel.pick) measurePanel.pick(S.tool === 'plan' ? 'radius' : S.tool);
  onMapClick = (p) => { if (cfg.panels.includes('plan') && planPanel.click && planPanel.click(p)) return; if (cfg.panels.includes('measure') && measurePanel.click && measurePanel.click(p)) { S.pin = p; return; } showPin({ ...p, name: C.fmtLatLon(p.lat, p.lon) }, { fly: false }); if (cfg.panels.includes('coords') && coordsPanel.input) { coordsPanel.input.value = C.fmtLatLon(p.lat, p.lon); coordsPanel.conv(); } };
  // the link: a search, a place, a route, a circle, a path
  const st = C.readState(location.search);
  if (st.mode) S.mode = st.mode;
  for (const b of root.querySelectorAll('[data-mode]')) b.setAttribute('aria-checked', String(b.dataset.mode === S.mode));
  const view = st.ll ? { ...st.ll, z: st.z || 15 } : null;
  if (mapEl) { const go = () => loadMap(view); if (document.readyState === 'complete') setTimeout(go, 0); else addEventListener('load', () => setTimeout(go, 0), { once: true }); }
  if (st.ll) { S.pin = { ...st.ll, name: st.name || C.fmtLatLon(st.ll.lat, st.ll.lon) }; showPin(S.pin, { fly: false }); if (st.r && cfg.panels.includes('measure')) { S.center = st.ll; S.r = st.r; const r = $('m-r'); if (r) r.value = String(st.r); measurePanel.report(); } }
  if (st.pts && cfg.panels.includes('plan')) { S.plan = st.pts; planPanel.rebuild(); subs.push(() => fit(S.plan)); }
  else if (st.pts && cfg.panels.includes('measure')) { measurePanel.pick('path'); S.path = st.pts; measurePanel.report(); draw(); }
  if (st.q && searchPanel.input) { searchPanel.input.value = st.q; searchPanel.run(st.q); }
  if (st.q && !searchPanel.input && coordsPanel.input) { coordsPanel.input.value = st.q; coordsPanel.conv(); }
  if ((st.from || st.to) && directionsPanel.from) { directionsPanel.from.value = st.from || ''; directionsPanel.to.value = st.to || ''; for (const v of st.via || []) directionsPanel.addVia(v); if (st.from && st.to) directionsPanel.go(); }
  subs.push(() => { if (S.pin && !S.routes && !S.plan.length) fit([S.pin], st.z || 15); else if (S.routes) draw(); });
  document.documentElement.dataset.mapsReady = '1';
  keepForOffline();
}
