// quake (skills/quake.js): which asks it takes, and what run() does with canned answers (fetch stubbed): the USGS query it builds (near a geocoded
// place within 500 km from M2.5, or worldwide from M4.5, over the last 7 days), each quake's magnitude band, place, age and depth, the safety tip of the
// strongest, and the empty, unknown-place and dead-service cards.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import quake from '../void-live-deploy/skills/quake.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const TOKYO = { name: 'Tokyo', admin1: 'Tokyo', country: 'Japan', latitude: 35.6895, longitude: 139.69171 };
const feat = (mag, place, hoursAgo, depth, url) => ({ properties: { mag, place, time: Date.now() - hoursAgo * 3600e3, url }, geometry: { coordinates: [139.7, 35.6, depth] } });
const withFetch = async (usgs, fn, fail) => {
  const real = globalThis.fetch, urls = [];
  globalThis.fetch = async (u) => { urls.push(String(u)); if (fail) throw new Error('offline'); const x = new URL(u); const body = x.hostname.startsWith('geocoding') ? (x.searchParams.get('name') === 'Tokyo' ? { results: [TOKYO] } : {}) : usgs; return { json: async () => body }; };
  try { return await fn(urls); } finally { globalThis.fetch = real; }
};
const apiOf = () => { const pages = []; return { pages, esc, showPage: (fn) => { const el = { innerHTML: '' }; fn(el); pages.push(el); return el; }, _pageStill: () => true }; };
const weekAgo = () => new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);

test('examples taken, near misses refused, and a few more asks', () => {
  for (const e of quake.examples) assert.ok(quake.match(e.toLowerCase(), e), e);
  for (const n of quake.nearMisses) assert.ok(!quake.match(n.toLowerCase(), n), n);
  for (const a of ['any earthquakes today', 'seismic activity in Chile', 'tremors near Naples', 'was there an earth quake in Lima']) assert.ok(quake.match(a.toLowerCase(), a), a);
  for (const a of ['earthquake insurance', 'earthquake proof buildings', 'define earthquake', 'weather and earthquakes in Tokyo', 'earthquake drill at school']) assert.ok(!quake.match(a.toLowerCase(), a), a);
});

test('run near a place: geocodes it, asks USGS within 500 km from M2.5, lists each quake with its band, age and depth', async () => {
  const usgs = { features: [feat(6.24, '20 km E of Tokyo', 2, 41.6, 'https://earthquake.usgs.gov/earthquakes/eventpage/us1'), feat(3.1, 'off the coast', 30, 10)] };
  await withFetch(usgs, async (urls) => {
    const api = apiOf(); assert.equal(await quake.run('earthquakes near Tokyo today', api), 'quake');
    assert.equal(urls.length, 2); assert.ok(urls[0].includes('name=Tokyo') && !urls[0].includes('today'), urls[0]); // "today" is not part of the place
    assert.ok(urls[1].startsWith('https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=' + weekAgo() + '&orderby=time&limit=8'), urls[1]);
    assert.ok(urls[1].endsWith('&latitude=35.6895&longitude=139.69171&maxradiuskm=500&minmagnitude=2.5'), urls[1]);
    const h = api.pages[0].innerHTML;
    assert.ok(h.includes('<h2>Near Tokyo, Japan</h2>'), h); // admin1 equal to the name is not repeated
    assert.ok(h.includes('<b>M6.2</b> · Major — 20 km E of Tokyo'), h); assert.ok(h.includes('2 hours ago · 42 km deep · <a href="https://earthquake.usgs.gov/earthquakes/eventpage/us1"'), h);
    assert.ok(h.includes('<b>M3.1</b> · Light — off the coast'), h); assert.ok(h.includes('1 day ago · 10 km deep</div>'), h); // no link without a url
    assert.ok(h.includes('Serious shaking. Follow official emergency guidance if nearby.'), h); // the tip of the first (latest) quake
  });
});

test('run worldwide: M4.5 and up; the bands at their edges', async () => {
  const usgs = { features: [feat(2.9, 'a', 0.001, 5), feat(4, 'b', 0.5, 5), feat(5.5, 'c', 1, 5), feat(7.8, 'd', 1, 5)] };
  await withFetch(usgs, async (urls) => {
    const api = apiOf(); assert.equal(await quake.run('recent earthquakes', api), 'quake');
    assert.equal(urls.length, 1); assert.ok(urls[0].endsWith('&minmagnitude=4.5') && !urls[0].includes('latitude'), urls[0]);
    const h = api.pages[0].innerHTML;
    assert.ok(h.includes('worldwide (M4.5+) · last 7 days'), h);
    assert.ok(h.includes('M2.9</b> · Minor') && h.includes('M4</b> · Moderate') && h.includes('M5.5</b> · Strong') && h.includes('M7.8</b> · Great'), h);
    assert.ok(h.includes('just now') && h.includes('30 minutes ago'), h);
    assert.ok(h.includes('Usually felt only nearby, if at all.'), h);
  });
});

test('run: none this week, a place it cannot find, a dead service', async () => {
  await withFetch({ features: [] }, async () => { const api = apiOf(); assert.equal(await quake.run('quakes around Tokyo', api), 'quake'); assert.ok(api.pages[0].innerHTML.includes('No matching quakes in the last week within about 500 km.'), api.pages[0].innerHTML); });
  await withFetch({ features: [] }, async (urls) => { const api = apiOf(); assert.equal(await quake.run('earthquakes in Atlantis', api), 'none'); assert.equal(urls.length, 1); assert.ok(api.pages[0].innerHTML.includes('couldn\'t find "Atlantis"')); });
  await withFetch(null, async () => { const api = apiOf(); assert.equal(await quake.run('recent earthquakes', api), 'none'); assert.ok(api.pages[0].innerHTML.includes("didn't answer just now")); }, true);
  // not asserted: "earthquakes in the last week", "... in the past 24 hours" and "earthquakes near me" geocode "the last week" / "me" as a place (bug reported)
});
