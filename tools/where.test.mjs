import test from 'node:test';
import assert from 'node:assert/strict';
import { savedPlace, savePlace, findPlace, whereAmI, latLonText } from '../void-live-deploy/lib/where.js';
import { onRequestGet } from '../void-live-deploy/functions/api/where.js';

const store = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
const json = (b, ok = true) => Promise.resolve({ ok, json: () => Promise.resolve(b) });

test('/api/where echoes only the caller\'s own coarse place, rounded, never cached, and takes no input', async () => {
  const r = onRequestGet({ request: { cf: { latitude: '51.50853', longitude: '-0.12574', city: 'London', country: 'GB', timezone: 'Europe/London', asn: 1234 } } });
  assert.equal(r.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(await r.json(), { ok: true, lat: 51.5, lon: -0.1, city: 'London', country: 'GB', timezone: 'Europe/London' });
  const none = await onRequestGet({ request: {} }).json();
  assert.equal(none.ok, false); assert.equal(none.lat, null);
  const odd = await onRequestGet({ request: { cf: { latitude: 'x', longitude: 5, city: 'y'.repeat(500) } } }).json();
  assert.equal(odd.ok, false); assert.equal(odd.city.length, 80);
});

test('a chosen place is kept in this browser and wins over everything else', async () => {
  const s = store(); savePlace({ lat: 35.7, lon: 139.7, name: 'Tokyo, Japan' }, s);
  assert.deepEqual(savedPlace(s), { lat: 35.7, lon: 139.7, name: 'Tokyo, Japan', tz: '', source: 'chosen' });
  const w = await whereAmI({ store: s, fetch: () => { throw new Error('should not ask the network'); }, navigator: null });
  assert.equal(w.name, 'Tokyo, Japan');
  savePlace(null, s); assert.equal(savedPlace(s), null);
  savePlace({ lat: 200, lon: 0 }, s); assert.equal(savedPlace(s), null, 'an impossible place is not kept');
});

test('without a chosen place: the device if already allowed, then the network\'s coarse place, then the time zone\'s city', async () => {
  const nav = { permissions: { query: async () => ({ state: 'granted' }) }, geolocation: { getCurrentPosition: (ok) => ok({ coords: { latitude: 48.8566, longitude: 2.3522 } }) } };
  assert.deepEqual(await whereAmI({ store: store(), navigator: nav, fetch: () => { throw new Error('no'); } }), { lat: 48.9, lon: 2.4, name: 'where you are', tz: Intl.DateTimeFormat().resolvedOptions().timeZone || '', source: 'device' });
  const prompt = { permissions: { query: async () => ({ state: 'prompt' }) }, geolocation: { getCurrentPosition: () => { throw new Error('must not ask'); } } };
  const net = await whereAmI({ store: store(), navigator: prompt, fetch: (u) => json({ ok: true, lat: 59.9, lon: 10.7, city: 'Oslo', country: 'NO', timezone: 'Europe/Oslo' }) });
  assert.deepEqual(net, { lat: 59.9, lon: 10.7, name: 'Oslo, NO', tz: 'Europe/Oslo', source: 'network' });
  const tz = await whereAmI({ store: store(), navigator: null, timeZone: 'Pacific/Auckland', fetch: (u) => (String(u).startsWith('/api/where') ? json({ ok: false }) : json({ results: [{ name: 'Auckland', country: 'New Zealand', latitude: -36.85, longitude: 174.76, timezone: 'Pacific/Auckland' }] })) });
  assert.deepEqual(tz, { lat: -36.85, lon: 174.76, name: 'Auckland, New Zealand', tz: 'Pacific/Auckland', source: 'timezone' });
  assert.equal(await whereAmI({ store: store(), navigator: null, timeZone: '', fetch: () => json({ ok: false }) }), null, 'nothing known: null, never a made-up place');
});

test('a place by name', async () => {
  assert.deepEqual(await findPlace('Kyoto', () => json({ results: [{ name: 'Kyoto', country: 'Japan', latitude: 35.01, longitude: 135.77 }] })), { lat: 35.01, lon: 135.77, name: 'Kyoto, Japan', tz: '', source: 'chosen' });
  assert.equal(await findPlace('zzzz', () => json({})), null);
  assert.equal(await findPlace('', () => { throw new Error('no'); }), null);
  assert.equal(await findPlace('x', () => { throw new Error('offline'); }), null);
  assert.equal(latLonText(51.5, -0.1), '51.5° N, 0.1° W'); assert.equal(latLonText(-33.9, 151.2), '33.9° S, 151.2° E');
});
