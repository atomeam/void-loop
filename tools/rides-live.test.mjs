// tools/rides-live.mjs: the record of one live routing call, its ledger line and its occasion number, on made-up responses.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';
import { recordOf, ledgerWhat, nextOccasion, callOnce, artifactName, url } from './rides-live.mjs';
import { entryProblem } from './grow.mjs';

const AT = '2026-10-16T04:12:33.000Z';
const ROUTE = { code: 'Ok', routes: [{ duration: 1260.4, distance: 21843.2, legs: [] }], waypoints: [] };

test('rides-live: a route back is a live, ok record with minutes and km, and its ledger line is a valid finding', () => {
  const rec = recordOf({ status: 200, body: ROUTE, ms: 412.6, at: AT, occasion: 1 });
  assert.equal(rec.attempt, 'live'); assert.equal(rec.occasion, 1); assert.equal(rec.ok, true); assert.equal(rec.skill, 'rides');
  assert.deepEqual(rec.answer, { minutes: 21, km: 21.8 }); assert.equal(rec.ms, 413); assert.equal(rec.error, '');
  assert.deepEqual(rec.excerpt, { code: 'Ok', routes: 1, duration_s: 1260, distance_m: 21843 });
  assert.equal(rec.request, url()); assert.match(rec.request, /^https:\/\/router\.project-osrm\.org\/route\/v1\/driving\/-122\.379,37\.6213;-122\.4075,37\.788\?/);
  assert.equal(artifactName(rec), '2026-10-16T0412.json');
  const what = ledgerWhat(rec);
  assert.match(what, /for the first time/); assert.match(what, /21 min and 21\.8 km/); assert.match(what, /findings\/rides\/2026-10-16T0412\.json/);
  assert.equal(entryProblem({ at: '2026-10-16T04:12:33Z', by: 'rides-live', kind: 'finding', what, ref: 'https://github.com/atomeam/void-loop/blob/main/findings/rides/2026-10-16T0412.json' }), null);
  assert.match(ledgerWhat({ ...rec, occasion: 3 }), /occasion 3/); assert.doesNotMatch(ledgerWhat({ ...rec, occasion: 3 }), /first time/);
});

test('rides-live: no route, a server error or no body is never ok, and says why', () => {
  const none = recordOf({ status: 200, body: { code: 'NoRoute', message: 'Impossible route between points', routes: [] }, ms: 90, at: AT });
  assert.equal(none.ok, false); assert.equal(none.answer, null); assert.equal(none.error, 'Impossible route between points');
  assert.match(ledgerWhat(none), /got no route \(Impossible route between points\)/);
  const down = recordOf({ status: 503, body: null, ms: 15000, at: AT });
  assert.equal(down.ok, false); assert.equal(down.error, 'HTTP 503'); assert.equal(down.excerpt, null);
  const zero = recordOf({ status: 200, body: { code: 'Ok', routes: [{ duration: 0, distance: 0 }] }, ms: 50, at: AT });
  assert.equal(zero.ok, false, 'a zero-length route is not an answer');
});

test('rides-live: callOnce reads the body, and an unreachable service comes back as status 0 with the reason', async () => {
  const ok = await callOnce(async (u, o) => { assert.equal(u, url()); assert.ok(o.signal); return { status: 200, json: async () => ROUTE }; });
  assert.equal(ok.status, 200); assert.equal(ok.body.code, 'Ok');
  const bad = await callOnce(async () => { const e = new Error('fetch failed'); e.cause = { code: 'ENOTFOUND' }; throw e; });
  assert.equal(bad.status, 0); assert.equal(bad.error, 'ENOTFOUND'); assert.equal(recordOf({ ...bad, at: AT }).ok, false);
  const html = await callOnce(async () => ({ status: 502, json: async () => { throw new SyntaxError('not json'); } }));
  assert.equal(html.status, 502); assert.equal(html.body, null);
});

test('rides-live: the occasion is one more than the artifacts already kept', () => {
  const dir = mkdtempSync(join(os.tmpdir(), 'rides-'));
  assert.equal(nextOccasion(join(dir, 'missing')), 1);
  assert.equal(nextOccasion(dir), 1);
  writeFileSync(join(dir, '2026-10-16T0412.json'), '{}'); writeFileSync(join(dir, '2026-10-17T0412.json'), '{}'); writeFileSync(join(dir, 'notes.txt'), '');
  assert.equal(nextOccasion(dir), 3);
});
