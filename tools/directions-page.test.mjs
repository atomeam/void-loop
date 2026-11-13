import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { tripFields, tripLine } from '../void-live-deploy/lib/directions-page.js';
import { onRequestGet } from '../void-live-deploy/functions/directions/index.js';

test('a trip needs two place names', () => {
  assert.equal(tripFields('  Madrid ', ' Museo del Prado ').from, 'Madrid');
  assert.equal(tripFields('', 'Madrid').reason, 'empty');
  assert.equal(tripFields('https://example.com', 'Madrid').ok, false);
});

test('a route is said in minutes and kilometres', () => {
  assert.equal(tripLine({ ok: true, minutes: 12, km: 4.2 }), '12 minutes, 4.2 km. Road time with no live traffic.');
  assert.equal(tripLine({ ok: false }), '');
});

test('a query fills the page when scripts are off', async () => {
  const html = readFileSync(new URL('../void-live-deploy/directions/index.html', import.meta.url), 'utf8');
  const real = globalThis.fetch;
  globalThis.fetch = async (u) => {
    const url = String(u);
    if (url.includes('open-meteo')) return new Response(JSON.stringify({ results: [{ name: 'Madrid', admin1: '', country: 'Spain', latitude: 40.4, longitude: -3.7 }] }));
    if (url.includes('project-osrm')) return new Response(JSON.stringify({ code: 'Ok', routes: [{ duration: 720, distance: 4200 }] }));
    throw new Error(url);
  };
  try {
    const res = await onRequestGet({
      request: new Request('https://a-to-mind.com/directions/?from=Madrid&to=Prado'),
      next: async () => new Response(html),
    });
    const body = await res.text();
    assert.match(body, /12 minutes, 4\.2 km/);
    assert.match(body, /value="Madrid"/);
    assert.match(body, /value="Prado"/);
  } finally {
    globalThis.fetch = real;
  }
});
