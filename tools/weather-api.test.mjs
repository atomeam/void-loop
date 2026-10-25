// /api/weather (functions/api/weather.js) with a FAKE Open-Meteo: the place name bounded, the two calls folded into one answer, a miss from the
// geocoder a 404, a service away a 502 never cached, a repeat answered from the edge cache without a second call
import test from 'node:test'; import assert from 'node:assert/strict';
import { placeIn, lookWeather, onRequestGet } from '../void-live-deploy/functions/api/weather.js';

const GEO = { results: [{ name: 'Boston', admin1: 'Massachusetts', country: 'United States', country_code: 'US', latitude: 42.3584, longitude: -71.0598 }] };
const WX = { current: { time: '2026-10-25T14:10', temperature_2m: 16.2 }, hourly: { time: ['2026-10-25T14:00'], temperature_2m: [16] }, daily: { time: ['2026-10-25'], temperature_2m_max: [18], temperature_2m_min: [9] } };
const fake = (calls, { geo = GEO, wx = WX, status = 200 } = {}) => async (u) => { calls.push(u); return { ok: status === 200, status, json: async () => (/geocoding-api/.test(u) ? geo : wx) }; };
const req = (q) => new Request('https://example.test/api/weather?q=' + encodeURIComponent(q));

test('the place in a request is a plain name of at most 60 letters, or nothing', () => {
  assert.equal(placeIn('https://x.test/api/weather?q=Boston'), 'Boston'); assert.equal(placeIn('https://x.test/api/weather?q=weather+in+S%C3%A3o+Paulo'), 'São Paulo');
  assert.equal(placeIn('https://x.test/api/weather?q=' + encodeURIComponent('http://evil.test/x')), ''); assert.equal(placeIn('https://x.test/api/weather'), '');
  assert.equal(placeIn('https://x.test/api/weather?q=' + 'a'.repeat(80)).length, 60, 'a long name is cut at 60, never passed whole');
});
test('the two calls folded into one answer; a place not found; the service away', async () => {
  const calls = []; const r = await lookWeather('Boston', fake(calls));
  assert.equal(r.ok, true); assert.equal(r.loc.name, 'Boston, Massachusetts, United States'); assert.equal(r.w.current.temperature_2m, 16.2); assert.equal(calls.length, 2);
  assert.deepEqual(await lookWeather('Nowhereville', fake([], { geo: { results: [] } })), { ok: false, kind: 'missing' });
  assert.deepEqual(await lookWeather('Boston', fake([], { status: 503 })), { ok: false, kind: 'away' });
});
test('the route: 400 for no place, 404 for a place not found, 502 for the service away (never cached), 200 with the forecast, then the cache answers', async () => {
  const store = new Map(); globalThis.caches = { default: { match: async (k) => store.get(k.url) ? new Response(store.get(k.url)) : undefined, put: async (k, res) => { store.set(k.url, await res.text()); } } };
  const kept = () => [...store.keys()].filter((k) => k.includes('__void-weather/') && !k.includes('/rl/')).length; // the forecasts kept, not the rate limiter's own counters
  try {
    assert.equal((await onRequestGet({ request: req(''), env: {}, fetchFn: fake([]) })).status, 400);
    assert.equal((await onRequestGet({ request: req('Nowhereville'), env: {}, fetchFn: fake([], { geo: { results: [] } }) })).status, 404);
    const away = await onRequestGet({ request: req('Boston'), env: {}, fetchFn: fake([], { status: 503 }) }); assert.equal(away.status, 502); assert.equal(away.headers.get('cache-control'), 'no-store'); assert.equal(kept(), 0);
    const calls = []; const ok = await onRequestGet({ request: req('Boston'), env: {}, fetchFn: fake(calls) }); const j = await ok.json();
    assert.equal(ok.status, 200); assert.equal(j.ok, true); assert.equal(j.loc.us, true); assert.equal(calls.length, 2); assert.equal(kept(), 1);
    const again = await (await onRequestGet({ request: req('boston'), env: {}, fetchFn: fake(calls) })).json(); assert.equal(again.cached, true); assert.equal(calls.length, 2, 'the repeat cost Open-Meteo nothing');
  } finally { delete globalThis.caches; }
});
