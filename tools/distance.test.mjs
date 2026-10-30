// distance (skills/distance.js): the two places an ask names (and which way round), the great-circle km, the rough flight time, and the card run() draws
// from canned Open-Meteo geocoding answers (fetch stubbed): the bigger of two same-named places, the miles, the route links, a place it cannot find.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import distance, { placesOf, placeName, flightTime, km, geo } from '../void-live-deploy/skills/distance.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const LON = { name: 'London', country: 'United Kingdom', latitude: 51.50853, longitude: -0.12574, population: 8961989 };
const PAR = { name: 'Paris', country: 'France', latitude: 48.85341, longitude: 2.3488, population: 2138551 };
const PTX = { name: 'Paris', country: 'United States', latitude: 33.66094, longitude: -95.55551, population: 24782 };
const NYC = { name: 'New York', country: 'United States', latitude: 40.71427, longitude: -74.00597, population: 8804190 };
const PLACES = { London: [LON], london: [LON], Paris: [PTX, PAR], 'New York': [NYC] };
const withGeo = async (fn) => { const real = globalThis.fetch, urls = []; globalThis.fetch = async (u) => { urls.push(String(u)); const n = new URL(u).searchParams.get('name'); return { json: async () => (PLACES[n] ? { results: PLACES[n] } : {}) }; }; try { return await fn(urls); } finally { globalThis.fetch = real; } };
const apiOf = () => { const pages = []; return { pages, esc, showPage: (fn) => { const el = { innerHTML: '' }; fn(el); pages.push(el); return el; }, _pageStill: () => true }; };

test('the asks: from and to, either wording, flights, and the ones it refuses', () => {
  assert.deepEqual(placesOf('distance from London to Paris'), { a: 'London', b: 'Paris' });
  assert.deepEqual(placesOf('how far is Tokyo from Osaka'), { a: 'Osaka', b: 'Tokyo' }); // "how far is B from A" reads A to B
  assert.deepEqual(placesOf('distance between Lyon and Turin'), { a: 'Lyon', b: 'Turin' });
  assert.deepEqual(placesOf('Lyon to Turin distance'), { a: 'Lyon', b: 'Turin' });
  assert.deepEqual(placesOf('how many km from Lyon to Turin?'), { a: 'Lyon', b: 'Turin' });
  assert.deepEqual(placesOf('how long is the flight from London to New York'), { a: 'London', b: 'New York', flight: true });
  // the flights card ask "flight distance" alone opens the flights page (lib/flight-sites.js); with two places it is this skill's, with the flight time
  assert.deepEqual(placesOf('flight distance from London to Paris'), { a: 'London', b: 'Paris', flight: true });
  assert.deepEqual(placesOf('air distance New York to Tokyo'), { a: 'New York', b: 'Tokyo', flight: true });
  assert.deepEqual(placesOf("what's the flight distance between Lyon and Turin?"), { a: 'Lyon', b: 'Turin', flight: true });
  assert.equal(placesOf('flight distance'), null); assert.equal(placesOf('flight distance london'), null);
  assert.equal(placesOf('how far is the moon'), null); assert.equal(placesOf('distance learning'), null);
  for (const e of distance.examples) assert.ok(distance.match(e.toLowerCase(), e), e);
  for (const n of distance.nearMisses) assert.ok(!distance.match(n.toLowerCase(), n), n);
  for (const a of ['distance frm Lyon to Turin', 'miles from Boston to Chicago']) assert.ok(distance.match(a.toLowerCase(), a), a);
  for (const a of ['distance from earth to the moon', 'how far is it from here to mars', 'distance formula']) assert.ok(!distance.match(a.toLowerCase(), a), a);
});

test('km: London to Paris 343.8, London to New York 5570, half the world 20015, a place to itself 0', () => {
  assert.equal(Math.round(km(LON, PAR) * 10) / 10, 343.8);
  assert.equal(Math.round(km(LON, NYC)), 5570);
  assert.equal(Math.round(km({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 180 })), 20015);
  assert.equal(km(LON, LON), 0); assert.equal(Math.round(km(LON, PAR) * 1e6), Math.round(km(PAR, LON) * 1e6));
});

test('flight time: 800 km/h plus half an hour, to the nearest 5 minutes', () => {
  assert.equal(flightTime(343.77), 'About 55 min'); assert.equal(flightTime(5570.2), 'About 7 h 30 min');
  assert.equal(flightTime(1200), 'About 2 h'); assert.equal(flightTime(0), 'About 30 min');
});

test('geo: the most populous of the places with that name, asked by the part before a comma', async () => {
  await withGeo(async (urls) => {
    assert.equal((await geo('Paris, France')).country, 'France');
    assert.ok(urls[0].includes('name=Paris') && !urls[0].includes('France'), urls[0]);
    assert.equal(await geo('Nowhereville'), null);
  });
});

test('run: the card with km, miles, route links; the flight line only for a flight ask', async () => {
  await withGeo(async () => {
    const api = apiOf(); assert.equal(await distance.run('distance from London to Paris', api), 'distance');
    const h = api.pages[0].innerHTML;
    assert.ok(h.includes('<h2>London → Paris</h2>') && h.includes('London, United Kingdom to Paris, France'), h);
    assert.ok(h.includes('>344 km<'), h); assert.ok(h.includes('214 miles, in a straight line'), h);
    assert.ok(h.includes('openstreetmap.org/directions?from=51.50853%2C-0.12574&to=48.85341%2C2.3488'), h);
    assert.ok(!h.includes('in the air'), h);
    const f = apiOf(); await distance.run('how long is the flight from London to New York', f);
    assert.ok(f.pages[0].innerHTML.includes('About 7 h 30 min in the air'), f.pages[0].innerHTML); assert.ok(f.pages[0].innerHTML.includes('>5,570 km<'));
  });
});

test('run: a place it cannot find, a dead service, an ask it does not read', async () => {
  await withGeo(async () => { const api = apiOf(); assert.equal(await distance.run('distance from London to Nowhereville', api), 'none'); assert.ok(api.pages[0].innerHTML.includes('couldn\'t find “Nowhereville”')); });
  const real = globalThis.fetch; globalThis.fetch = async () => { throw new Error('offline'); };
  try { const api = apiOf(); assert.equal(await distance.run('distance from London to Paris', api), 'none'); assert.ok(api.pages[0].innerHTML.includes("didn't answer")); } finally { globalThis.fetch = real; }
  const api = apiOf(); assert.equal(await distance.run('map of Paris', api), 'none'); assert.equal(api.pages.length, 0);
});

// Adam's card (2026-10-30): "is nyc → london" said "I couldn't find “is nyc”". The lead word was read as part of the place, and the
// place search finds nothing for "nyc" anyway; both are fixed here, and the arrow form is read as a distance
test('the arrow, the lead words and the short names: "is nyc → london" is New York to London', () => {
  assert.deepEqual(placesOf('is nyc → london'), { a: 'New York', b: 'london' });
  assert.deepEqual(placesOf('how far is nyc to london'), { a: 'New York', b: 'london' });
  assert.deepEqual(placesOf('how far is LA from NYC?'), { a: 'New York', b: 'Los Angeles' });
  assert.deepEqual(placesOf('nyc -> la'), { a: 'New York', b: 'Los Angeles' });
  assert.deepEqual(placesOf('is LA → SF'), { a: 'Los Angeles', b: 'San Francisco' });
  assert.deepEqual(placesOf('Paris → Rome'), { a: 'Paris', b: 'Rome' });
  assert.deepEqual(placesOf('distance from D.C. to Boston'), { a: 'Washington', b: 'Boston' });
  assert.deepEqual(placesOf('distance between ldn and brum'), { a: 'London', b: 'Birmingham' });
  assert.deepEqual(placesOf('how far from manc to edi please'), { a: 'Manchester', b: 'Edinburgh' });
  assert.deepEqual(placesOf('distance from The Hague to Paris'), { a: 'The Hague', b: 'Paris' }, '"the" is part of some names');
  for (const n of ['usd → eur', 'USD → EUR', '5 km -> miles', 'Celsius -> Fahrenheit', 'KG → LB', 'hello → world', 'London → Paris → Rome']) {
    assert.equal(placesOf(n), null, n); assert.ok(!distance.match(n.toLowerCase(), n), n);
  }
  for (const [k, v] of Object.entries({ nyc: 'New York', 'N.Y.C.': 'New York', 'L.A.': 'Los Angeles', 'Washington, DC': 'Washington', ldn: 'London', ' is nyc ': 'New York', Boston: 'Boston' })) assert.equal(placeName(k), v, k);
});

test('run: "is nyc → london" asks the place search for New York and London and draws the real distance', async () => {
  await withGeo(async (urls) => {
    const api = apiOf(); assert.equal(await distance.run('is nyc → london', api), 'distance');
    const h = api.pages[0].innerHTML;
    assert.ok(urls.some((u) => u.includes('name=New%20York')) && urls.some((u) => u.includes('name=london')), urls.join(' '));
    assert.ok(!urls.some((u) => /name=is|name=nyc/i.test(u)), urls.join(' '));
    assert.ok(h.includes('<h2>New York → London</h2>') && h.includes('>5,570 km<') && h.includes('3,461 miles'), h);
  });
});
