// skills/weather.js: every forecast call has a time limit, a miss is asked once more, then Verse's own edge copy (/api/weather) answers,
// so one slow minute at Open-Meteo is not a card stuck on "…" (the weather exam swung between 54 and 98 on the same asks). No network.
import test from 'node:test'; import assert from 'node:assert/strict';
import { getJson, forecastOf, edgeWeather } from '../void-live-deploy/skills/weather.js';

const W = { current: { temperature_2m: 12 }, hourly: { time: [] }, daily: { time: [] } };
const ok = (j) => ({ ok: true, json: async () => j });
// a host that never answers; the kept timer stands in for the open socket (AbortSignal.timeout's own timer does not hold the process open)
const hang = (_u, o) => new Promise((_, rej) => { const keep = setTimeout(() => {}, 10000); o.signal && o.signal.addEventListener('abort', () => { clearTimeout(keep); rej(new Error('timeout')); }); });

test('getJson gives up after its limit instead of hanging', async () => {
  const t = Date.now();
  await assert.rejects(getJson('https://api.open-meteo.com/x', 50, hang));
  assert.ok(Date.now() - t < 2000);
});

test('a failed status is an error, not a forecast', async () => {
  await assert.rejects(getJson('u', 50, async () => ({ ok: false, status: 503 })));
});

test('a forecast that hangs twice comes from the edge copy for the place', async () => {
  const seen = [];
  const f = (u, o) => { seen.push(u); return u.startsWith('/api/weather') ? Promise.resolve(ok({ ok: true, loc: { name: 'Paris, France', lat: 48.85, lon: 2.35 }, w: W })) : hang(u, o); };
  const w = await forecastOf('https://api.open-meteo.com/v1/forecast?x', 'paris', f, 40);
  assert.equal(w.current.temperature_2m, 12);
  assert.equal(seen.filter((u) => u.startsWith('https://api.open-meteo.com')).length, 2);
  assert.equal(seen.at(-1), '/api/weather?q=paris');
});

test('the first answer from Open-Meteo is used as is', async () => {
  let n = 0; const w = await forecastOf('u', 'paris', async () => { n++; return ok(W); });
  assert.equal(n, 1); assert.equal(w, W);
});

test('no answer anywhere throws, so the card says the service did not answer', async () => {
  await assert.rejects(forecastOf('u', '', async () => ({ ok: false, status: 500 })), /no forecast/);
});

test('edgeWeather turns the edge place into the card shape', async () => {
  const e = await edgeWeather('tokyo', async () => ok({ ok: true, loc: { name: 'Tokyo, Japan', lat: 35.69, lon: 139.69 }, w: W }));
  assert.deepEqual(e.loc, { latitude: 35.69, longitude: 139.69, name: 'Tokyo, Japan' });
  assert.equal(await edgeWeather('nowhere', async () => ok({ ok: false, kind: 'missing' })), null);
  assert.equal(await edgeWeather('', async () => ok({})), null);
});
