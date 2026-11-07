// place (skills/place.js): which map and directions asks it takes (and the geometry, "my phone" and dependency-map asks it leaves), and the map card run()
// draws from a canned Open-Meteo geocoding answer (fetch stubbed): the biggest place first with the others listed, the zoom by population, the
// directions links only for a directions ask, the whole-world map without a lookup, and a miss reported.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import place, { routeWords, wikiHit, sameNameSpread } from '../void-live-deploy/skills/place.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const KYOTO = { name: 'Kyoto', admin1: 'Kyoto', country: 'Japan', latitude: 35.02107, longitude: 135.75385, population: 1459640 };
const KYOTO_US = { name: 'Kyoto', admin1: 'Texas', country: 'United States', latitude: 30.1, longitude: -97.2, population: 120 };
const LOUVRE = { name: 'Louvre', admin1: 'Île-de-France', country: 'France', latitude: 48.86, longitude: 2.336, population: 0 };
const SPRINGFIELDS = [
  { name: 'Springfield', admin1: 'Missouri', country: 'United States', latitude: 37.2, longitude: -93.3, population: 170188 },
  { name: 'Springfield', admin1: 'Massachusetts', country: 'United States', latitude: 42.1, longitude: -72.6, population: 154341 },
  { name: 'Springfield', admin1: 'Illinois', country: 'United States', latitude: 39.8, longitude: -89.6, population: 114394 },
];
const PARISES = [
  { name: 'Paris', admin1: 'Île-de-France Region', country: 'France', latitude: 48.85, longitude: 2.35, population: 2138551 },
  { name: 'Paris', admin1: 'Texas', country: 'United States', latitude: 33.66, longitude: -95.56, population: 24782 },
];
const LISBONS = [
  { name: 'Lisbon', admin1: 'Lisbon District', country: 'Portugal', latitude: 38.72, longitude: -9.14, population: 517802 },
  { name: 'Lisbon', admin1: 'Maine', country: 'United States', latitude: 44.03, longitude: -70.1, population: 9392 },
];
const PLACES = { Kyoto: [KYOTO_US, KYOTO], kioto: [KYOTO], Louvre: [LOUVRE], Springfield: SPRINGFIELDS, Paris: PARISES, Lisbon: LISBONS };
const withGeo = async (fn, fail) => { const real = globalThis.fetch, urls = []; globalThis.fetch = async (u) => { urls.push(String(u)); if (fail) throw new Error('offline'); const n = new URL(u).searchParams.get('name'); return { json: async () => (PLACES[n] ? { results: PLACES[n] } : {}) }; }; try { return await fn(urls); } finally { globalThis.fetch = real; } };
const apiOf = () => { const pages = [], misses = []; return { pages, misses, esc, reportMiss: (t) => misses.push(t), showPage: (fn) => { const el = { innerHTML: '', querySelectorAll: () => [] }; fn(el); pages.push(el); return el; }, _pageStill: () => true }; };

test('examples taken, and the asks it should and should not take', () => {
  for (const e of place.examples) assert.ok(place.match(e.toLowerCase(), e), e);
  for (const n of place.nearMisses || []) assert.ok(!place.match(n.toLowerCase(), n), n); // place.js lists no nearMisses of its own; the hand-written ones follow
  for (const a of ['show me a street map of Porto', 'where are the Azores', 'neighbourhood around Shibuya', 'take me to Lisbon', 'how can i get to the airport']) assert.ok(place.match(a.toLowerCase(), a), a);
  for (const a of ['mapa de kioto', 'mapa del louvre', 'mapa de Springfield', 'mapa de paris']) assert.ok(place.match(a.toLowerCase(), a), a); // the same asks in Spanish
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
    assert.ok(h.includes('Other places with this name: <a href="#" data-alt="0">Kyoto, Texas, United States</a>'), h);
    assert.ok(!h.includes('Directions:'), h);
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

test('same-name spread: several real towns with one behind the first ask which; a same name whose others are villages shows the big one', () => {
  assert.equal(sameNameSpread(SPRINGFIELDS), true, 'five Springfields');
  assert.equal(sameNameSpread(PARISES), true, 'Paris, France and Paris, Texas');
  assert.equal(sameNameSpread(LISBONS), false, 'Lisbon, Portugal and a Maine village: the big one stands');
  assert.equal(sameNameSpread([KYOTO, KYOTO_US]), false, 'a Kyoto of 120 people is no town');
  assert.equal(sameNameSpread([KYOTO, { name: 'Kioto', admin1: 'Mississippi', country: 'United States', population: 800 }]), false, 'different names, no spread');
  assert.equal(sameNameSpread([KYOTO]), false); assert.equal(sameNameSpread([]), false);
});

test('run "map of Springfield": the card asks which, never guesses; picking one draws its map', async () => {
  await withGeo(async (urls) => {
    const api = apiOf(); assert.equal(await place.run('map of Springfield', api), 'place');
    const h = api.pages[0].innerHTML;
    assert.ok(h.includes('<h2>Which Springfield?</h2>'), h);
    assert.ok(h.includes('Several Springfields — pick one:'), h);
    assert.ok(h.includes('data-pick="0">Springfield, Missouri, United States</a>'), h);
    assert.ok(h.includes('data-pick="2">Springfield, Illinois, United States</a>'), h);
    assert.ok(!h.includes('<iframe'), 'no map before the pick');
  });
});

test('run "mapa de kioto": the Spanish ask shows Kyoto and says how it was asked', async () => {
  await withGeo(async (urls) => {
    const api = apiOf(); assert.equal(await place.run('mapa de kioto', api), 'place');
    assert.ok(urls[0].includes('name=kioto'), urls[0]);
    const h = api.pages[0].innerHTML;
    assert.ok(h.includes('<h2>Kyoto</h2>'), h);
    assert.ok(h.includes('You asked for kioto — the map shows Kyoto, Japan.'), h); // the card carries the asked spelling (the exam's dest check reads it)
    assert.ok(h.includes('marker=35.02107,135.75385'), h);
  });
});
