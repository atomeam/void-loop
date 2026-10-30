// The will's last run on the growth card (void-live-deploy/lib/will-last.js): GET /api/will carries the newest tried will job in a public
// shape (the PR it shipped, or why not, redacted), and the growth card's today view shows it. Run: node --test tools/will-last.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { lastRun, lastRunHtml, whyOf, WILL_LAST_SQL } from '../void-live-deploy/lib/will-last.js';
import { onRequestGet } from '../void-live-deploy/functions/api/will.js';
import { redact } from '../void-live-deploy/lib/automation-fix.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// the live rows' shapes (void_queue, read 2026-10-29)
const CAPPED = { ask: 'Overhaul surface:ask: persona playtest and best-site comparison, then rebuild what falls short', state: 'queued', note: "tries 1 · no-change: Verse's coder: stopped at the token cap (250000) · Verse chose this: its turn in this lap; it must end measurably better than last lap", at: '2026-10-26T23:45:13.542Z', updated: '2026-10-29T06:27:53.677Z' };
const SHIPPED = { ask: 'learn to handle "fantasy name generator"', state: 'done', note: 'verse-job: PR https://github.com/atomeam/void-loop/pull/1455', at: '2026-10-29T06:30:00Z', updated: '2026-10-29T06:46:27Z' };
const ASIDE = { ask: 'Absorb and connect every repo', state: 'set aside', note: 'set aside: untouched for 3.0 days, a newer want takes its place · Verse chose this: It turns fragmented pieces into a singular, cohesive Verse.', at: '2026-10-20T23:07:45Z', updated: '2026-10-23T23:12:55Z' };

test('a row becomes the public shape: shipped with its PR, or why not, without the try count or the want\'s own reason', () => {
  assert.deepEqual(lastRun(CAPPED), { title: CAPPED.ask, state: 'queued', at: CAPPED.updated, tries: 1, shipped: false, pr: null, why: "no-change: Verse's coder: stopped at the token cap (250000)" });
  const s = lastRun(SHIPPED);
  assert.deepEqual([s.shipped, s.pr, s.why], [true, 'https://github.com/atomeam/void-loop/pull/1455', 'PR https://github.com/atomeam/void-loop/pull/1455']);
  assert.equal(lastRun(ASIDE).why, 'untouched for 3.0 days, a newer want takes its place', 'the state is not said twice');
  assert.equal(lastRun({ ...SHIPPED, note: 'verse-job: PR https://github.com/someone/else/pull/9' }).pr, null, 'only a PR on Verse\'s own repo is linked');
  assert.equal(lastRun(null), null); assert.equal(lastRun({ ask: 'x' }), null);
  assert.equal(whyOf('claimed by conductor · tries 2 · error: busy'), 'error: busy', 'no claim, no try count');
  assert.match(whyOf('tries 1 · error: key AIza' + 'A'.repeat(35) + ' leaked', redact), /error: key \[redacted\] leaked/);
});

test('the line names the run and its result, escapes every value, and is empty without a run', () => {
  assert.match(lastRunHtml(esc, lastRun(CAPPED)), /The will's last run<\/b> \(2026-10-29 06:27 UTC\): Overhaul surface:ask.*Not shipped yet \(try 1 of 3\): no-change: Verse&#39;s coder: stopped at the token cap \(250000\)\./);
  const shipped = lastRunHtml(esc, lastRun(SHIPPED));
  assert.match(shipped, /Shipped: <a href="https:\/\/github\.com\/atomeam\/void-loop\/pull\/1455" target="_blank" rel="noopener">PR #1455<\/a>\./);
  assert.match(shipped, /data-will-shipped="1"/);
  assert.match(lastRunHtml(esc, lastRun(ASIDE)), /Set aside: untouched for 3\.0 days/);
  const evil = lastRunHtml(esc, lastRun({ ask: '<img src=x onerror=alert(1)>', state: 'queued', note: 'tries 1 · error: <script>x</script>' }));
  assert.ok(!/<img|<script/.test(evil), evil);
  assert.equal(lastRunHtml(esc, null), ''); assert.equal(lastRunHtml(esc, lastRun({ ask: '', state: 'queued' })), '');
});

const db = (rows) => {
  const d = new DatabaseSync(':memory:');
  d.exec('CREATE TABLE void_kv (k TEXT PRIMARY KEY, v TEXT); CREATE TABLE void_queue (id TEXT, ask TEXT, target TEXT, state TEXT, note TEXT, at TEXT, updated TEXT)');
  for (const r of rows) d.prepare('INSERT INTO void_queue VALUES (?, ?, ?, ?, ?, ?, ?)').run(r.id, r.ask, r.target, r.state, r.note ?? null, r.at, r.updated ?? null);
  const stmt = (sql, a = []) => ({ bind: (...b) => stmt(sql, b), all: async () => ({ results: d.prepare(sql).all(...a) }), first: async (col) => { const r = d.prepare(sql).get(...a) || null; return col && r ? r[col] : r; }, run: async () => { d.prepare(sql).run(...a); return {}; } });
  return { prepare: (sql) => stmt(sql) };
};

test('GET /api/will carries the newest tried will job, redacted; a fresh want, another kind of job or no queue table adds nothing', async () => {
  const env = { DB: db([
    { id: 'a', target: 'will:old', ...ASIDE },
    { id: 'b', target: 'will:capped', ...CAPPED, note: CAPPED.note.replace('token cap', 'token cap AIza' + 'B'.repeat(35)) },
    { id: 'c', target: 'will:fresh', ask: 'a want nobody tried yet', state: 'queued', note: '', at: '2026-10-29T07:00:00Z' },
    { id: 'd', target: 'miss:x', ask: 'not the will', state: 'done', note: 'verse-job: PR https://github.com/atomeam/void-loop/pull/1', at: '2026-10-29T07:10:00Z' },
  ]), ASSETS: { fetch: async () => new Response('no', { status: 404 }) } };
  const w = await (await onRequestGet({ request: new Request('https://a-to-mind.com/api/will'), env })).json();
  assert.equal(w.lastRun.title, CAPPED.ask, 'the newest tried will job, not the fresh want or the miss job');
  assert.match(w.lastRun.why, /token cap \[redacted\] \(250000\)/, 'the why is redacted on the server');
  assert.deepEqual(Object.keys(w.lastRun).sort(), ['at', 'pr', 'shipped', 'state', 'title', 'tries', 'why'], 'only the public shape');
  const none = await (await onRequestGet({ request: new Request('https://a-to-mind.com/api/will'), env: { DB: { prepare: (sql) => ({ first: async () => { if (sql === WILL_LAST_SQL) throw new Error('no such table'); return null; }, all: async () => ({ results: [] }) }) }, ASSETS: env.ASSETS } })).json();
  assert.equal(none.lastRun, undefined);
});

test('the growth card fills its will slot from /api/will under the day\'s lines, and the browser module loads no server code', () => {
  const src = readFileSync(new URL('../void-live-deploy/skills/growth.js', import.meta.url), 'utf8');
  assert.match(src, /'<div data-today><\/div>' \+ '<div data-will-last><\/div>'/);
  assert.match(src, /fetch\('\/api\/will', \{ cache: 'no-cache' \}\)[\s\S]{0,200}lastRunHtml\(esc, w\.lastRun\)/);
  assert.ok(!/^import /m.test(readFileSync(new URL('../void-live-deploy/lib/will-last.js', import.meta.url), 'utf8')), 'lib/will-last.js imports nothing');
});
