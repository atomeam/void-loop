// The holiday list (skills/holidays.js, functions/api/holidays.js), 2026-10-30: on a-to-mind.com "holidays in france" said
// "The holiday list didn't answer." The page now asks Verse's own address, and Verse asks Nager.Date.
//   node --test tools/holidays-api.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import holidays, { holidaysUrl } from '../void-live-deploy/skills/holidays.js';
import { ccIn, rowsOf, onRequestGet } from '../void-live-deploy/functions/api/holidays.js';

const FR = [{ date: '2026-11-01', localName: 'Toussaint', name: "All Saints' Day" }, { date: '2026-11-11', localName: 'Armistice 1918', name: 'Armistice Day' }];
const ok = (j) => async () => ({ ok: true, status: 200, json: async () => j });

test('the page asks Verse its own address, never Nager.Date itself', () => {
  assert.equal(holidaysUrl('FR'), '/api/holidays?cc=FR');
});

test('only two letters reach the upstream address', () => {
  assert.equal(ccIn('https://a-to-mind.com/api/holidays?cc=fr'), 'FR');
  for (const c of ['', 'FRA', 'F', '../x', 'F1']) assert.equal(ccIn('https://a-to-mind.com/api/holidays?cc=' + encodeURIComponent(c)), '', c);
});

test('rowsOf keeps dated rows and their names, nothing else', () => {
  assert.deepEqual(rowsOf(FR), FR);
  assert.deepEqual(rowsOf([{ date: 'soon', name: 'x' }, null, { date: '2026-12-25', localName: 'Noël', name: 'Christmas', extra: 1 }]), [{ date: '2026-12-25', localName: 'Noël', name: 'Christmas' }]);
  assert.deepEqual(rowsOf({ error: 1 }), []);
});

test('the endpoint answers the list and keeps it six hours; a failure is not cached', async () => {
  let asked = '';
  const r = await onRequestGet({ request: new Request('https://a-to-mind.com/api/holidays?cc=FR'), fetchFn: async (u) => { asked = u; return ok(FR)(); } });
  assert.equal(asked, 'https://date.nager.at/api/v3/NextPublicHolidays/FR');
  assert.equal(r.status, 200); assert.equal(r.headers.get('cache-control'), 'public, max-age=21600');
  assert.deepEqual(await r.json(), { ok: true, cc: 'FR', rows: FR });
  const down = await onRequestGet({ request: new Request('https://a-to-mind.com/api/holidays?cc=FR'), fetchFn: async () => { throw new Error('offline'); } });
  assert.equal(down.status, 502); assert.equal(down.headers.get('cache-control'), 'no-store');
  const bad = await onRequestGet({ request: new Request('https://a-to-mind.com/api/holidays?cc=xyz') });
  assert.equal(bad.status, 400);
});

test('"holidays in france" shows the list from Verse its own address', async () => {
  const el = { innerHTML: '' }, asked = [], real = globalThis.fetch;
  globalThis.fetch = async (u) => { asked.push(String(u)); return { json: async () => ({ ok: true, cc: 'FR', rows: FR }) }; };
  try { await holidays.run('holidays in france', { showPage: (f) => { f(el); return el; }, esc: (s) => String(s), _pageStill: () => true }); }
  finally { globalThis.fetch = real; }
  assert.deepEqual(asked, ['/api/holidays?cc=FR']);
  assert.ok(el.innerHTML.startsWith('<h2>Next holidays · france</h2>') && el.innerHTML.includes('Toussaint') && el.innerHTML.includes('Nager.Date'), el.innerHTML);
  globalThis.fetch = async () => ({ json: async () => ({ ok: false, kind: 'away' }) });
  try { await holidays.run('holidays in france', { showPage: (f) => { f(el); return el; }, esc: (s) => String(s), _pageStill: () => true }); }
  finally { globalThis.fetch = real; }
  assert.match(el.innerHTML, /didn't answer/);
});
