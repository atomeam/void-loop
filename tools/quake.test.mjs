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
const hoursBack = (u) => (Date.now() - Date.parse(new URL(u).searchParams.get('starttime') + (/T/.test(new URL(u).searchParams.get('starttime')) ? 'Z' : 'T00:00:00Z'))) / 3600e3;

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
    assert.ok(urls[1].startsWith('https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime='), urls[1]);
    assert.ok(Math.abs(hoursBack(urls[1]) - 24) < 0.1, urls[1]); assert.ok(urls[1].includes('&orderby=time&limit=8'), urls[1]); // "today" is the last 24 hours
    assert.ok(urls[1].endsWith('&latitude=35.6895&longitude=139.69171&maxradiuskm=500&minmagnitude=2.5'), urls[1]);
    const h = api.pages[0].innerHTML;
    assert.ok(h.includes('<h2>Near Tokyo, Japan</h2>'), h); // admin1 equal to the name is not repeated
    assert.ok(h.includes('<b>M6.2</b> · Major — 20 km E of Tokyo'), h); assert.ok(h.includes('2 hours ago · 42 km deep · <a href="https://earthquake.usgs.gov/earthquakes/eventpage/us1"'), h);
    assert.ok(h.includes('<b>M3.1</b> · Light — off the coast'), h); assert.ok(h.includes('1 day ago · 10 km deep</div>'), h); // no link without a url
    assert.ok(h.includes('Serious shaking. Follow official emergency guidance if nearby.'), h); // the tip of the first (latest) quake
    assert.ok(h.includes('Tokyo, Japan · last 24 hours'), h);
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
});

test('a time phrase sets the window and is never a place; "near me" is where the visitor is, or worldwide with a line saying so', async () => {
  await withFetch({ features: [feat(5, 'x', 1, 10)] }, async (urls) => {
    let api = apiOf(); assert.equal(await quake.run('earthquakes in the last week', api), 'quake');
    assert.equal(urls.length, 1); assert.ok(urls[0].includes('starttime=' + weekAgo() + '&') && urls[0].endsWith('&minmagnitude=4.5'), urls[0]); // no geocoding of "the last week"
    assert.ok(api.pages[0].innerHTML.includes('worldwide (M4.5+) · last week'), api.pages[0].innerHTML);
    api = apiOf(); await quake.run('earthquakes in the past 24 hours', api);
    assert.equal(urls.length, 2); assert.ok(!urls[1].includes('geocoding') && Math.abs(hoursBack(urls[1]) - 24) < 0.1, urls[1]);
    assert.ok(api.pages[0].innerHTML.includes('last 24 hours'), api.pages[0].innerHTML);
    api = apiOf(); await quake.run('quakes near Tokyo over the past 3 days', api);
    assert.ok(urls[2].includes('name=Tokyo&') || urls[2].endsWith('name=Tokyo'), urls[2]); assert.ok(Math.abs(hoursBack(urls[3]) / 24 - 3) < 1, urls[3]);
    assert.ok(api.pages[0].innerHTML.includes('Tokyo, Japan · last 3 days'), api.pages[0].innerHTML);
  });
  // near me, the place unknown (no saved place, no device permission, /api/where and the time zone give nothing): worldwide, said plainly
  await withFetch({ features: [feat(5, 'x', 1, 10)] }, async (urls) => {
    const api = apiOf(); assert.equal(await quake.run('earthquakes near me', api), 'quake');
    assert.ok(!urls.some((u) => u.includes('name=me')), urls.join(' ')); // "me" is never geocoded
    const usgs = urls.filter((u) => u.includes('earthquake.usgs.gov')); assert.equal(usgs.length, 1); assert.ok(usgs[0].endsWith('&minmagnitude=4.5'), usgs[0]);
    assert.ok(api.pages[0].innerHTML.includes('I don&#39;t know where you are') || api.pages[0].innerHTML.includes("I don't know where you are"), api.pages[0].innerHTML);
  });
  // near me, the connection's city known (/api/where): within 500 km of it
  const real = globalThis.fetch, urls = [];
  globalThis.fetch = async (u) => { urls.push(String(u)); if (String(u) === '/api/where') return { ok: true, json: async () => ({ ok: true, lat: 35.7, lon: 139.7, city: 'Tokyo', country: 'JP' }) }; return { json: async () => ({ features: [feat(4.2, 'near Tokyo', 3, 30)] }) }; };
  try {
    const api = apiOf(); assert.equal(await quake.run('any earthquakes near me today', api), 'quake');
    const usgs = urls.find((u) => u.includes('earthquake.usgs.gov')); assert.ok(usgs.endsWith('&latitude=35.7&longitude=139.7&maxradiuskm=500&minmagnitude=2.5'), usgs);
    assert.ok(api.pages[0].innerHTML.includes('<h2>Near Tokyo, JP</h2>'), api.pages[0].innerHTML);
  } finally { globalThis.fetch = real; }
});
