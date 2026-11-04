// Verse's own status page (owner, 2026-11-03: build our own version of the paid tools; an uptime monitor and its status page):
// lib/status.js (pure), functions/api/status.js (reads the hourly guards' watch.check records), the /autopilot/#status panel.
// node --test tools/status-page.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as S from '../void-live-deploy/lib/status.js';
import { readStatus } from '../void-live-deploy/functions/api/status.js';
import { LIMITS } from '../void-live-deploy/lib/guard.js';

const NOW = Date.parse('2026-11-03T20:00:00Z');
const at = (h) => new Date(NOW - h * 3600e3).toISOString();

test('stateOf: a MATCH is down, a clean check is up, a failed badge is unknown but a failed page is down', () => {
  const page = S.GUARDS.find((g) => g.page), badge = S.GUARDS.find((g) => !g.page);
  assert.equal(S.stateOf({ state: 'done', result: 'MATCH · the home page did not say Verse' }, page), 'down');
  assert.equal(S.stateOf({ state: 'done', result: 'no match' }, page), 'up');
  assert.equal(S.stateOf({ state: 'failed', result: 'timeout' }, page), 'down');
  assert.equal(S.stateOf({ state: 'failed', result: 'timeout' }, badge), 'unknown');
  assert.equal(S.stateOf({ state: 'deferred' }, page), 'unknown');
  assert.equal(S.stateOf(null, page), 'unknown');
});

test('summarize: uptime, now, history oldest first, the 7-day window and the overall verdict', () => {
  const rows = [
    { ref: 'hourly-site-up', state: 'done', result: 'ok', started: at(1) },
    { ref: 'hourly-site-up', state: 'done', result: 'MATCH · down', started: at(2) },
    { ref: 'hourly-site-up', state: 'done', result: 'ok', started: at(3) },
    { ref: 'hourly-site-up', state: 'done', result: 'MATCH · old', started: at(24 * 8) }, // outside the window
    { ref: 'hourly-main-green', state: 'done', result: 'MATCH · red', started: at(1) },
    { ref: 'someone-else', state: 'done', result: 'MATCH', started: at(1) },
  ];
  const s = S.summarize(rows, NOW);
  const site = s.guards.find((g) => g.id === 'hourly-site-up');
  assert.equal(site.checks, 3); assert.equal(site.up, 2); assert.equal(site.down, 1);
  assert.equal(site.uptime, 66.67); assert.equal(site.now, 'up'); assert.equal(site.lastAt, at(1));
  assert.deepEqual(site.history, ['u', 'd', 'u']);
  assert.equal(s.guards.find((g) => g.id === 'hourly-films-page').uptime, null);
  assert.equal(s.overall, 'degraded');
  assert.equal(s.guards.length, S.GUARDS.length);
  assert.equal(S.summarize([], NOW).overall, 'unknown');
  const many = Array.from({ length: 40 }, (_, i) => ({ ref: 'hourly-site-up', state: 'done', result: 'ok', started: at(i + 1) }));
  assert.equal(S.summarize(many, NOW).guards[0].history.length, S.HISTORY);
});

test('readStatus: only fixed guard ids, a window bind, never a record text in the answer; no DB says so', async () => {
  let seen;
  const env = { DB: { prepare: (sql) => ({ bind: (...b) => { seen = { sql, b }; return { all: async () => ({ results: [
    { ref: 'hourly-site-up', state: 'done', result: 'MATCH · secret detail', started: at(1) }] }) }; } }) } };
  const out = await readStatus(env, NOW);
  assert.match(seen.sql, /kind = 'watch\.check'/); assert.match(seen.sql, /owner = 'owner'/);
  assert.deepEqual(seen.b.slice(0, S.GUARDS.length), S.GUARDS.map((g) => g.id));
  assert.ok(!JSON.stringify(out).includes('secret detail'));
  assert.equal(out.guards[0].now, 'down');
  const none = await readStatus({}, NOW);
  assert.ok(none.note);
});

test('the route is rate-limited, /status/ opens the panel, and the panel is on /autopilot/', () => {
  assert.deepEqual(LIMITS.status, { rpm: 30, body: 0 });
  const r = readFileSync(new URL('../void-live-deploy/_redirects', import.meta.url), 'utf8');
  assert.match(r, /^\/status\/ \/autopilot\/#status 301$/m);
  const h = readFileSync(new URL('../void-live-deploy/autopilot/index.html', import.meta.url), 'utf8');
  for (const id of ['status', 'st-head', 'st-guards', 'st-live', 'st-inc']) assert.match(h, new RegExp('id="' + id + '"'));
  const a = readFileSync(new URL('../void-live-deploy/autopilot/app.js', import.meta.url), 'utf8');
  assert.match(a, /\/api\/status/); assert.match(a, /PROBES/);
  assert.ok(S.PROBES.some((p) => p.path === '/api/mcp' && p.method === 'POST'));
});

test('the panel times Verse\'s pages and its APIs, every probe a cheap read, and says how many answered', () => {
  const kinds = new Set(S.PROBES.map((p) => p.kind));
  assert.deepEqual([...kinds].sort(), ['api', 'page']);
  assert.ok(S.PROBES.filter((p) => p.kind === 'page').length >= 6 && S.PROBES.filter((p) => p.kind === 'api').length >= 5);
  for (const p of S.PROBES) {
    assert.match(p.path, /^\/[\w./-]*$/, p.name + ': a path on this site');
    assert.ok(p.method === 'GET' || (p.method === 'POST' && p.path === '/api/mcp' && /"method":"ping"/.test(p.body)), p.name + ': a read, never a write or a model call');
  }
  assert.equal(new Set(S.PROBES.map((p) => p.path)).size, S.PROBES.length, 'no path timed twice');
  assert.deepEqual(S.probeSummary([{ ok: true, ms: 100 }, { ok: true, ms: 300 }, { ok: false, ms: null }]), { total: 3, ok: 2, down: 1, median: 200, all: false });
  assert.deepEqual(S.probeSummary([{ ok: true, ms: 50 }]), { total: 1, ok: 1, down: 0, median: 50, all: true });
  assert.deepEqual(S.probeSummary([]), { total: 0, ok: 0, down: 0, median: null, all: false });
  const a = readFileSync(new URL('../void-live-deploy/autopilot/app.js', import.meta.url), 'utf8');
  assert.match(a, /probeSummary/); assert.match(a, /APIs and feeds/);
});
