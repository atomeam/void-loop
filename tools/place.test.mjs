// place (skills/place.js): which map and directions asks it takes (and the geometry, "my phone" and dependency-map asks it leaves), and the map card run()
// draws from a canned Open-Meteo geocoding answer (fetch stubbed): the biggest place first with the others listed, the zoom by population, the
// directions links only for a directions ask, the whole-world map without a lookup, and a miss reported.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import place, { routeWords, wikiHit } from '../void-live-deploy/skills/place.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const KYOTO = { name: 'Kyoto', admin1: 'Kyoto', country: 'Japan', latitude: 35.02107, longitude: 135.75385, population: 1459640 };
const KYOTO_US = { name: 'Kyoto', admin1: 'Texas', country: 'United States', latitude: 30.1, longitude: -97.2, population: 120 };
const LOUVRE = { name: 'Louvre', admin1: 'Île-de-France', country: 'France', latitude: 48.86, longitude: 2.336, population: 0 };
const SPRINGFIELD_IL = { name: 'Springfield', admin1: 'Illinois', country: 'United States', latitude: 39.8, longitude: -89.65, population: 114394 };
const SPRINGFIELD_MO = { name: 'Springfield', admin1: 'Missouri', country: 'United States', latitude: 37.21, longitude: -93.29, population: 169724 };
const PARIS_FR = { name: 'Paris', admin1: 'Île-de-France', country: 'France', latitude: 48.85, longitude: 2.35, population: 2138551 };
const PARIS_TX = { name: 'Paris', admin1: 'Texas', country: 'United States', latitude: 33.66, longitude: -95.55, population: 24807 };
const PLACES = { Kyoto: [KYOTO_US, KYOTO], Louvre: [LOUVRE], kioto: [KYOTO_US, KYOTO], Springfield: [SPRINGFIELD_IL, SPRINGFIELD_MO], Paris: [PARIS_FR, PARIS_TX] };
const withGeo = async (fn, fail) => { const real = globalThis.fetch, urls = []; globalThis.fetch = async (u) => { urls.push(String(u)); if (fail) throw new Error('offline'); const n = new URL(u).searchParams.get('name'); return { json: async () => (PLACES[n] ? { results: PLACES[n] } : {}) }; }; try { return await fn(urls); } finally { globalThis.fetch = real; } };
const apiOf = () => { const pages = [], misses = []; return { pages, misses, esc, reportMiss: (t) => misses.push(t), showPage: (fn) => { const el = { innerHTML: '', querySelectorAll: () => [] }; fn(el); pages.push(el); return el; }, _pageStill: () => true }; };

test('examples taken, and the asks it should and should not take', () => {
  for (const e of place.examples) assert.ok(place.match(e.toLowerCase(), e), e);
  for (const n of place.nearMisses || []) assert.ok(!place.match(n.toLowerCase(), n), n); // place.js lists no nearMisses of its own; the hand-written ones follow
  for (const a of ['show me a street map of Porto', 'where are the Azores', 'neighbourhood around Shibuya', 'take me to Lisbon', 'how can i get to the airport', 'mapa de kioto', '¿dónde está Kioto?', 'muéstrame Kioto en un mapa']) assert.ok(place.match(a.toLowerCase(), a), a);
  for (const a of ['area of a circle with radius 5', 'area of a 10 by 12 room', 'dependency map', 'where is my phone', 'where are you', 'directions to work', 'how do i get to sleep']) assert.ok(!place.match(a.toLowerCase(), a), a);
  // a question about maps is not a place: "what is a map" is no street map of "what is a"
  for (const a of ['what is a map', "what's a map", 'How to read a map?', 'why is the map wrong', 'which map', 'is it a map', 'map of what is that']) assert.ok(!place.match(a.toLowerCase(), a), a);
  for (const a of ['Whitby map', 'map of Howth', 'where is Isfahan', 'Canterbury map']) assert.ok(place.match(a.toLowerCase(), a), a); // a place that only starts with the same letters still is one
});

test('run "where is Kyoto": the biggest Kyoto, zoomed for a city of a million, the small one offered, no directions', async () => {
  await withGeo(async (urls) => {
    const api = apiOf(); assert.equal(await place.run('where is Kyoto', api), 'place');
    assert.equal(urls.length, 1); assert.ok(urls[0].includes('name=Kyoto'), urls[0]);
    const h = api.pages[0].innerHTML;
    assert.ok(h.includes('<h2>Kyoto</h2><div class="sub">Japan</div>'), h); // admin1 equal to the name is not repeated
    assert.match(h, /bbox=135\.5738\d*,34\.9130\d*,135\.9338\d*,35\.1290\d*&/); // ±0.18 lon, ±0.108 lat
    assert.ok(h.includes('marker=35.02107,135.75385'), h); assert.ok(h.includes('#map=11/35.02107/135.75385'), h);
    assert.ok(h.includes('Several places share this name; others: <a href="#" data-alt="0">Kyoto, Texas, United States</a>'), h);
    assert.ok(!h.includes('Directions:'), h);
  });
});

test('run "mapa de kioto": the Spanish map ask reaches Kyoto', async () => {
  await withGeo(async (urls) => {
    const api = apiOf(); assert.equal(await place.run('mapa de kioto', api), 'place');
    assert.ok(urls[0].includes('name=kioto'), urls[0]);
    const h = api.pages[0].innerHTML;
    assert.ok(h.includes('<h2>Kyoto</h2>'), h);
  });
});

test('an ambiguous name says several places share it, so the reader is asked which', async () => {
  await withGeo(async () => {
    const a = apiOf(); assert.equal(await place.run('map of Springfield', a), 'place');
    assert.match(a.pages[0].innerHTML, /Several places share this name; others:/);
    const b = apiOf(); assert.equal(await place.run('show me Paris on a map', b), 'place');
    assert.match(b.pages[0].innerHTML, /Several places share this name; others:/);
  });
});

test('run "directions to the Louvre": the route links to the place, a close zoom for a place with no population', async () => {
  await withGeo(async (urls) => {
    const api = apiOf(); assert.equal(await place.run('directions to the Louvre', api), 'place');
    assert.ok(urls[0].includes('name=Louvre'), urls[0]); // "the" dropped
    const h = api.pages[0].innerHTML;
    assert.ok(h.includes('openstreetmap.org/directions?to=48.86%2C2.336') && h.includes('google.com/maps/dir/?api=1&destination=48.86%2C2.336'), h);
    assert.ok(h.includes('Route on openstreetmap.org.'), h); // the route is in the words, not only in a link address
    assert.ok(h.includes('#map=15/48.86/2.336'), h); assert.ok(!h.includes('Other places'), h);
  });
});

test('a route is said in kilometres, and a landmark is the Wikipedia page that shares its name', () => {
  assert.equal(routeWords({ km: 12.34, min: 18 }, 9), '12.3 km by road, about 18 min from near you.');
  assert.equal(routeWords(null, 8400), '8400 km in a straight line from near you (roads are longer).');
  assert.equal(routeWords(null, NaN), 'Route on openstreetmap.org.');
  const pages = { a: { title: 'Baltimore Penn Station', index: 4, coordinates: [{ lat: 39.3, lon: -76.6 }] }, b: { title: 'New York Penn Station', index: 1, coordinates: [{ lat: 40.75, lon: -73.99 }] }, c: { title: 'Penn Station Access', index: 2 } };
  assert.equal(wikiHit(pages, 'Penn Station').name, 'New York Penn Station');
  assert.equal(wikiHit({ a: { title: 'Gustave Eiffel', index: 2 } }, 'eiffel tower'), null);
});

test('run: the world needs no lookup; a place not found is reported as a miss; a dead service says so', async () => {
  await withGeo(async (urls) => { const api = apiOf(); assert.equal(await place.run('map of the world', api), 'place'); assert.equal(urls.length, 0); assert.ok(api.pages[0].innerHTML.includes('<h2>The world</h2>') && api.pages[0].innerHTML.includes('bbox=-170,-58,170,75')); });
  await withGeo(async () => { const api = apiOf(); assert.equal(await place.run('map of Atlantis', api), 'none'); assert.deepEqual(api.misses, ['map of Atlantis']); assert.ok(api.pages[0].innerHTML.includes('couldn\'t find that place')); });
  await withGeo(async () => { const api = apiOf(); assert.equal(await place.run('map of Kyoto', api), 'none'); assert.ok(api.pages[0].innerHTML.includes("didn't answer")); }, true);
  const api = apiOf(); assert.equal(await place.run('where is my phone', api), 'none'); assert.equal(api.pages.length, 0);
});
