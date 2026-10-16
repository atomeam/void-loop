// Drive time over MCP (lib/drive.js, lib/mcp.js drive_time): places by name or "lat,lon", the live router's answer read, and
// honest failures; the network is a stub here (tools/rides-live.mjs is the live check). Run: node --test tools/drive.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placeOf, routeUrl, routeOf, geoOf, drive } from '../void-live-deploy/lib/drive.js';
import { rpc } from '../void-live-deploy/lib/mcp.js';

const ROUTE = { code: 'Ok', routes: [{ duration: 1277.2, distance: 23173.4 }] };
const GEO = { 'san francisco': { results: [{ name: 'San Francisco', admin1: 'California', country: 'United States', latitude: 37.77, longitude: -122.42 }] }, oakland: { results: [{ name: 'Oakland', admin1: 'California', country: 'United States', latitude: 37.80, longitude: -122.27 }] } };
const net = (calls = []) => async (u) => {
  calls.push(u);
  if (u.startsWith('https://geocoding-api.open-meteo.com/')) { const q = decodeURIComponent(u.split('name=')[1]).toLowerCase(); return Response.json(GEO[q] || { results: [] }); }
  if (u.startsWith('https://router.project-osrm.org/')) return Response.json(/-122\.27/.test(u) || /-122\.379/.test(u) ? ROUTE : { code: 'NoRoute', message: 'Impossible route', routes: [] });
  return new Response('no', { status: 404 });
};

test('drive: places read as given, the router URL is longitude first, and its answer is minutes and km', () => {
  assert.deepEqual(placeOf('37.6213, -122.379'), { lat: 37.6213, lon: -122.379 }); assert.deepEqual(placeOf({ lat: 1, lon: 2, name: 'X' }), { lat: 1, lon: 2, name: 'X' });
  assert.deepEqual(placeOf('  San   Francisco '), { name: 'San Francisco' }); assert.equal(placeOf(''), null); assert.equal(placeOf('99,200'), null); assert.equal(placeOf('x'.repeat(101)), null);
  assert.equal(routeUrl({ lat: 37.6213, lon: -122.379 }, { lat: 37.788, lon: -122.4075 }), 'https://router.project-osrm.org/route/v1/driving/-122.379,37.6213;-122.4075,37.788?overview=false&alternatives=false&steps=false');
  assert.deepEqual(routeOf(ROUTE), { minutes: 21, km: 23.2 }); assert.equal(routeOf({ code: 'NoRoute', routes: [] }), null); assert.equal(routeOf(null), null);
  assert.deepEqual(geoOf(GEO.oakland, 'oakland'), { lat: 37.8, lon: -122.27, name: 'Oakland, California, United States' }); assert.equal(geoOf({ results: [] }, 'x'), null);
});

test('drive: names are looked up, then routed; a place not found or no route says so plainly', async () => {
  const calls = [];
  const r = await drive('San Francisco', 'Oakland', net(calls));
  assert.equal(r.ok, true); assert.equal(r.minutes, 21); assert.equal(r.km, 23.2); assert.equal(r.from.name, 'San Francisco, California, United States'); assert.match(r.note, /no live traffic/);
  assert.equal(calls.length, 3, 'two lookups and one route');
  const coords = await drive('37.6213,-122.379', '37.788,-122.4075', net());
  assert.equal(coords.ok, true, 'coordinates need no lookup');
  assert.deepEqual(await drive('Atlantis', 'Oakland', net()), { ok: false, error: 'I could not find "Atlantis" on the map.' });
  const none = await drive('37.0,-100.0', '38.0,-101.0', net()); assert.equal(none.ok, false); assert.match(none.error, /no driving route .*Impossible route/);
  assert.equal((await drive('', 'Oakland', net())).ok, false);
  const down = await drive('San Francisco', 'Oakland', async () => { throw new Error('ENOTFOUND'); }); assert.equal(down.ok, false);
});

test('drive_time over MCP: listed as reaching out to the world, answered in words and data, errors as tool errors', async () => {
  const list = await rpc({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, {});
  const t = list.result.tools.find((x) => x.name === 'drive_time');
  assert.ok(t); assert.equal(t.annotations.openWorldHint, true); assert.equal(t.annotations.readOnlyHint, true); assert.deepEqual(t.inputSchema.required, ['from', 'to']);
  const ok = await rpc({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'drive_time', arguments: { from: 'San Francisco', to: 'Oakland' } } }, { fetch: net() });
  assert.match(ok.result.content[0].text, /^About 21 min by car, 23\.2 km, from San Francisco, California, United States to Oakland, California, United States \(free-flow road time: no live traffic; OSRM public demo router/);
  assert.equal(ok.result.structuredContent.minutes, 21);
  const bad = await rpc({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'drive_time', arguments: { from: 'Atlantis', to: 'Oakland' } } }, { fetch: net() });
  assert.equal(bad.result.isError, true); assert.match(bad.result.content[0].text, /Atlantis/);
});
