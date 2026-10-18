// Verse's probe ledger (lib/probe-log.js, functions/api/probe-log.js; asked by Void): records keep counts, skills, confidences and
// outcomes only; the stats give the success rate and the proposals most certain first. Run: node --test tools/probe-log.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { recordOf, probeStats, probeHtml, LOG_KEEP } from '../void-live-deploy/lib/probe-log.js';
import * as route from '../void-live-deploy/functions/api/probe-log.js';

const TOKEN = 'owner-token-for-tests-1234567890';
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function d1() {
  const db = new DatabaseSync(':memory:'); db.exec('CREATE TABLE void_kv (k TEXT PRIMARY KEY, v TEXT)');
  const stmt = (sql, a = []) => ({ bind: (...b) => stmt(sql, b), run: async () => db.prepare(sql).run(...a), first: async (col) => { const r = db.prepare(sql).get(...a) || null; return col ? (r ? r[col] : null) : r; } });
  return { prepare: (sql) => stmt(sql) };
}
const post = (body, auth = TOKEN) => new Request('https://a-to-mind.com/api/probe-log', { method: 'POST', headers: { ...(auth ? { authorization: 'Bearer ' + auth } : {}), 'content-type': 'application/json' }, body: JSON.stringify(body) });

test('probe ledger: a record keeps known fields only, in range, and never words', () => {
  const at = '2026-10-16T13:30:00.000Z';
  assert.deepEqual(recordOf({ kind: 'probe', family: 'life', wrote: 25, probed: 22, misses: 4, queued: 2, asks: ['secret words'] }, at), { at, kind: 'probe', family: 'life', wrote: 25, probed: 22, misses: 4, queued: 2 });
  assert.deepEqual(recordOf({ kind: 'fix', skill: 'rides', edits: 2, confidence: '0.824', passed: false, failed: 'collisions', why: 'words', ask: 'an ask' }, at), { at, kind: 'fix', skill: 'rides', edits: 2, confidence: 0.82, passed: false, failed: 'collisions' });
  assert.equal(recordOf({ kind: 'fix', skill: 'rides', edits: 1, passed: false, failed: 'made up' }, at).failed, 'checks', 'an unknown step is just "checks"');
  assert.equal(recordOf({ kind: 'fix', skill: 'rides', edits: 1, confidence: 7, passed: true, pr: 'https://github.com/atomeam/void-loop/pull/900' }, at).confidence, 1);
  assert.equal(recordOf({ kind: 'fix', skill: 'rides', edits: 1, passed: true, pr: 'https://evil.example/x' }, at).pr, undefined);
  for (const bad of [null, {}, { kind: 'probe', wrote: 5, probed: 6, misses: 1, queued: 0 }, { kind: 'probe', wrote: 5, probed: 5, misses: 6, queued: 0 }, { kind: 'probe', wrote: -1, probed: 0, misses: 0, queued: 0 }, { kind: 'fix', skill: 'Not A Slug', edits: 1 }, { kind: 'fix', skill: 'rides' }, { kind: 'other' }])
    assert.equal(recordOf(bad, at), null, JSON.stringify(bad));
});

test('probe ledger: the stats give the rate, where fixes stop, whether confidence predicts a pass, and the proposals most certain first', () => {
  const log = [
    { at: '2026-10-18T13:00:00Z', kind: 'fix', skill: 'weather', edits: 1, confidence: 0.9, passed: true, failed: null },
    { at: '2026-10-17T13:00:00Z', kind: 'fix', skill: 'rides', edits: 2, confidence: 0.4, passed: false, failed: 'collisions' },
    { at: '2026-10-17T12:00:00Z', kind: 'fix', skill: 'dating', edits: 3, confidence: null, passed: false, failed: 'benchmark' },
    { at: '2026-10-16T13:00:00Z', kind: 'fix', skill: 'rides', edits: 2, confidence: 0.8, passed: false, failed: 'collisions' },
    { at: '2026-10-17T13:23:00Z', kind: 'probe', family: 'life', wrote: 25, probed: 25, misses: 5, queued: 2 },
    { at: '2026-10-16T13:23:00Z', kind: 'probe', family: 'life', wrote: 25, probed: 23, misses: 3, queued: 2 },
  ];
  const s = probeStats(log);
  assert.equal(s.runs, 2); assert.equal(s.wrote, 50); assert.equal(s.misses, 8); assert.equal(s.missRate, 16);
  assert.equal(s.proposed, 4); assert.equal(s.passed, 1); assert.equal(s.rate, 13); assert.equal(s.passRate, 25);
  assert.deepEqual(s.stoppedAt, { collisions: 2, benchmark: 1 });
  assert.deepEqual(s.high, { n: 2, passed: 1 }); assert.deepEqual(s.low, { n: 1, passed: 0 });
  assert.deepEqual(s.ranked.map((f) => f.confidence), [0.9, 0.8, 0.4, null], 'most certain first, no confidence last');
  const h = probeHtml(esc, s);
  assert.match(h, /2 probe runs: 50 asks I wrote for myself, 8 missed \(16%\)/); assert.match(h, /4 fixes proposed, 1 passed every check: <b data-probe-rate>13%<\/b>/);
  assert.match(h, /Where my fixes stop: collisions 2, benchmark 1/); assert.match(h, /When I was sure \(0\.7 and up\) 1 of 2 passed; when I was not, 0 of 1/);
  assert.ok(h.indexOf('0.90') < h.indexOf('0.80') && h.indexOf('0.80') < h.indexOf('0.40'));
  assert.equal(probeHtml(esc, probeStats([])), '', 'nothing to show until there is a record');
  assert.equal(probeStats([]).rate, null);
});

test('probe ledger: POST is owner only and keeps a bounded log; GET is public and carries no words', async () => {
  const env = { DB: d1(), READ_TOKEN: TOKEN };
  assert.equal((await route.onRequestPost({ request: post({ kind: 'probe', wrote: 1, probed: 1, misses: 0, queued: 0 }, ''), env })).status, 401);
  assert.equal((await route.onRequestPost({ request: post({ kind: 'nope' }), env })).status, 400);
  const kept = await (await route.onRequestPost({ request: post({ kind: 'fix', skill: 'rides', edits: 2, confidence: 0.8, passed: false, failed: 'collisions', ask: 'best way to get from a to b' }), env })).json();
  assert.equal(kept.ask, undefined);
  for (let i = 0; i < LOG_KEEP + 5; i++) await route.onRequestPost({ request: post({ kind: 'probe', family: 'life', wrote: 25, probed: 25, misses: 1, queued: 1 }), env });
  const j = await (await route.onRequestGet({ env })).json();
  assert.equal(j.log.length, LOG_KEEP); assert.equal(j.stats.runs, LOG_KEEP);
  assert.doesNotMatch(JSON.stringify(j), /best way/);
  assert.deepEqual((await (await route.onRequestGet({ env: {} })).json()).log, [], 'no database: an empty ledger, not an error');
});

test('probe ledger and the forge (asked by Void, ask-20261015-2045-2): what probes asked the forge for and it missed, counted across runs', async () => {
  const { forgeWants } = await import('./probe-asks.mjs');
  assert.deepEqual(forgeWants([{ ask: 'make me a giraffe', want: 'skill:forge' }, { ask: 'Can you 3D print a bicycle for me?', want: 'skill:forge' }, { ask: 'make me a coffee', want: 'answer' }, { ask: 'weather in oslo', want: 'skill:weather' }]), ['giraffe', 'bicycle']);
  const at = '2026-10-16T13:30:00.000Z';
  assert.deepEqual(recordOf({ kind: 'probe', wrote: 5, probed: 5, misses: 2, queued: 1, forge: ['Giraffe', 'giraffe', 'bike!', '<script>', 'a'.repeat(40)] }, at).forge, ['giraffe'], 'only plain names, once each');
  assert.equal(recordOf({ kind: 'probe', wrote: 5, probed: 5, misses: 0, queued: 0, forge: [] }, at).forge, undefined);
  const s = probeStats([{ kind: 'probe', wrote: 5, probed: 5, misses: 2, queued: 1, forge: ['giraffe', 'bicycle'] }, { kind: 'probe', wrote: 5, probed: 5, misses: 1, queued: 1, forge: ['giraffe'] }]);
  assert.deepEqual(s.forge, [{ thing: 'giraffe', n: 2 }, { thing: 'bicycle', n: 1 }]);
  assert.match(probeHtml(esc, s), /Things my probes asked the forge for that it cannot make yet \(frontier #14\): giraffe \(2\), bicycle</);
  assert.doesNotMatch(probeHtml(esc, { ...s, forge: undefined }), /forge for/, 'an older stats object without forge still draws');
});
