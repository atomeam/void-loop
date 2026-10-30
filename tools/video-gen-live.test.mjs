// tools/video-gen-live.mjs: the record of one live check of the video-gen skill, its ledger line and its occasion number, on made-up responses.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';
import { recordOf, ledgerWhat, nextOccasion, checkOnce, artifactName, apiProblem, pageProblem, pageOf, SITE, SETTLE_MS } from './video-gen-live.mjs';
import { SAYS } from '../void-live-deploy/lib/video-gen.js';
import { entryProblem } from './grow.mjs';

const AT = '2026-10-30T18:41:07.000Z', NOW = Date.parse(AT);
const OFF = { on: false, why: 'credits', say: SAYS.credits, checkedAt: '2026-10-30T16:02:11.000Z', checking: false, clipsLeft: 0, perConnection: 3 };
const PAGE = { status: 200, state: true, make: true, handoff: true };
const api = (body, status = 200) => ({ status, body });

test('video-gen-live: video off for credits, with a fresh test and the page served, passes its checks but is not ok (no clip path, so no rating), and its ledger line is a valid finding', () => {
  const rec = recordOf({ first: api(OFF), page: PAGE, ms: 812.4, at: AT, occasion: 1 });
  assert.equal(rec.attempt, 'live'); assert.equal(rec.skill, 'video-gen'); assert.equal(rec.checksPass, true); assert.equal(rec.ok, false); assert.equal(rec.error, '');
  assert.equal(rec.video, 'off'); assert.equal(rec.why, 'credits'); assert.equal(rec.lastTest, OFF.checkedAt); assert.equal(rec.startedSelfCheck, false);
  assert.equal(rec.ms, 812); assert.deepEqual(rec.request, [SITE + '/api/clip', SITE + '/video/']); assert.deepEqual(rec.page, PAGE);
  assert.equal(artifactName(rec), '2026-10-30T1841.json');
  const what = ledgerWhat(rec);
  assert.match(what, /for the first time/); assert.match(what, /no AI Gateway credits yet/); assert.match(what, /findings\/video-gen\/2026-10-30T1841\.json/);
  assert.equal(entryProblem({ at: '2026-10-30T18:41:07Z', by: 'video-gen-live', kind: 'finding', what, ref: 'https://github.com/atomeam/void-loop/blob/main/findings/video-gen/2026-10-30T1841.json' }), null);
  assert.match(ledgerWhat({ ...rec, occasion: 4 }), /occasion 4/); assert.doesNotMatch(ledgerWhat({ ...rec, occasion: 4 }), /first time/);
});

test('video-gen-live: video on needs a clips-left count, and says how many', () => {
  const on = recordOf({ first: api({ on: true, why: 'ok', clipsLeft: 7, perConnection: 3, checkedAt: OFF.checkedAt }), page: PAGE, at: AT });
  assert.equal(on.ok, true); assert.equal(on.checksPass, true); assert.equal(on.video, 'on'); assert.equal(on.clipsLeft, 7); assert.match(ledgerWhat(on), /video is on, 7 clips left today/);
  assert.match(apiProblem(api({ on: true, why: 'ok' }), NOW), /no clips-left count/);
});

test('video-gen-live: a stale test, an unknown reason, words that are not the route\'s own, or a never-run test are problems', () => {
  assert.match(apiProblem(api({ ...OFF, checkedAt: '2026-10-30T09:00:00.000Z' }), NOW), /10 hours old/);
  assert.match(apiProblem(api({ ...OFF, why: 'mystery', say: 'x' }), NOW), /unknown reason \(mystery\)/);
  assert.match(apiProblem(api({ ...OFF, say: 'Video is fine.' }), NOW), /unknown reason/);
  assert.match(apiProblem(api({ ...OFF, checkedAt: null }), NOW), /never tested/);
  assert.match(apiProblem(api(null, 500), NOW), /answered 500/); assert.match(apiProblem(api({ why: 'credits' }), NOW), /no on field/);
  const bad = recordOf({ first: api({ ...OFF, checkedAt: '2026-10-29T00:00:00.000Z' }), page: PAGE, at: AT, occasion: 2 });
  assert.equal(bad.ok, false); assert.equal(bad.checksPass, false); assert.match(ledgerWhat(bad), /found a problem on a-to-mind\.com: the last test is \d+ hours old/); assert.match(ledgerWhat(bad), /occasion 2/);
});

test('video-gen-live: the page must be served with its state line, its Make button and its hand-off tag', () => {
  assert.equal(pageProblem(PAGE), '');
  assert.equal(pageProblem({ ...PAGE, make: false, handoff: false }), '/video/ has no make, handoff');
  assert.equal(pageProblem({ status: 404 }), 'GET /video/ answered 404'); assert.equal(pageProblem(null), 'GET /video/ answered nothing');
  const html = '<meta name="verse-handoff" content="x"><p id="state"></p><button id="make">';
  assert.deepEqual(pageOf(200, html), { status: 200, state: true, make: true, handoff: true, bytes: html.length });
  assert.equal(recordOf({ first: api(OFF), page: { ...PAGE, state: false }, at: AT }).checksPass, false);
});

test('video-gen-live: checkOnce waits for a self-check it started and stands on the second read; an unreachable site has no status', async () => {
  const calls = [], waits = [];
  const fake = async (u, o) => {
    calls.push(u); assert.ok(o.signal);
    if (u.endsWith('/video/')) return { status: 200, text: async () => '<p id="state"></p><button id="make"></button><meta name="verse-handoff">' };
    return { status: 200, json: async () => (calls.length === 1 ? { ...OFF, checkedAt: AT, checking: true } : { ...OFF, checkedAt: AT }) };
  };
  const res = await checkOnce(fake, async (ms) => { waits.push(ms); }, 'https://example.test');
  assert.deepEqual(calls, ['https://example.test/api/clip', 'https://example.test/api/clip', 'https://example.test/video/']); assert.deepEqual(waits, [SETTLE_MS]);
  const rec = recordOf({ ...res, at: AT });
  assert.equal(rec.startedSelfCheck, true); assert.equal(rec.checksPass, true); assert.match(ledgerWhat(rec), /this check started that test/);
  const once = await checkOnce(async (u) => (u.endsWith('/video/') ? { status: 200, text: async () => '' } : { status: 200, json: async () => OFF }), async () => assert.fail('no wait'), 'https://example.test');
  assert.equal(once.first, once.last);
  const down = await checkOnce(async () => { const e = new Error('fetch failed'); e.cause = { code: 'ENOTFOUND' }; throw e; }, async () => {}, 'https://example.test');
  assert.equal(down.error, 'unreachable: ENOTFOUND'); const r = recordOf({ ...down, at: AT });
  assert.equal(r.status, 0); assert.equal(r.ok, false); assert.equal(r.checksPass, false); assert.equal(r.video, null);
});

test('video-gen-live: the occasion is one more than the artifacts already kept', () => {
  const dir = mkdtempSync(join(os.tmpdir(), 'video-gen-live-'));
  assert.equal(nextOccasion(join(dir, 'missing')), 1); assert.equal(nextOccasion(dir), 1);
  writeFileSync(join(dir, '2026-10-30T1841.json'), '{}'); writeFileSync(join(dir, '2026-10-31T0041.json'), '{}'); writeFileSync(join(dir, 'notes.txt'), '');
  assert.equal(nextOccasion(dir), 3);
});

test('video-gen-live: the family rating counts a check only while video is on', async () => {
  const { liveFindings } = await import('./families.mjs');
  const off = recordOf({ first: api(OFF), page: PAGE, at: AT }), on = recordOf({ first: api({ on: true, why: 'ok', clipsLeft: 2, checkedAt: OFF.checkedAt }), page: PAGE, at: AT });
  const files = { 'a.json': off, 'b.json': on }, read = (p) => JSON.stringify(files[p.split('/').pop()]);
  assert.deepEqual(liveFindings('video-gen', () => ['a.json'], read), { n: 0, at: '' });
  assert.deepEqual(liveFindings('video-gen', () => ['a.json', 'b.json'], read), { n: 1, at: '2026-10-30' });
});
