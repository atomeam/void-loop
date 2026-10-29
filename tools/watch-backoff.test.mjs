// A watch that a site asks to slow down (2026-10-29: hourly-store's page answered 429 at 12:36, 13:36 and 14:37, three failed
// records): the 429 (or a 503 with Retry-After) is kept as a `deferred` record that says when it tries again, the watch sends no
// request until then, it backs off 1 h, 2 h, 4 h … a day when the site gives no Retry-After, and the next good answer forgets it.
// The page watches also run at their own minute of the hour (lib/automations.js jitterMinutes), so they do not all knock at once.
// Run: node --test tools/watch-backoff.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { retryAfterMs, backoffMs, waitAfter, slowDown, answerOf, BACKOFF_MAX } from '../void-live-deploy/lib/watch.js';
import { due, jitterMinutes, knocks, validate } from '../void-live-deploy/lib/automations.js';
import { problems, settle, begin } from '../void-live-deploy/lib/actions.js';
import * as A from '../void-live-deploy/lib/automations-run.js';
import hourly from '../automations/hourly.json' with { type: 'json' };

function d1() {
  const db = new DatabaseSync(':memory:');
  const stmt = (sql, a = []) => ({ sql, a, bind: (...b) => stmt(sql, b), run: async () => { const r = db.prepare(sql).run(...a); return { meta: { changes: Number(r.changes) } }; }, all: async () => ({ results: db.prepare(sql).all(...a) }), first: async (col) => { const r = db.prepare(sql).get(...a) || null; return col ? (r ? r[col] : null) : r; } });
  return { prepare: (sql) => stmt(sql), raw: db };
}
const records = (env) => env.DB.raw.prepare('SELECT kind, ref, state, result, error FROM void_actions ORDER BY started, rowid').all();
const waitOf = (env, id) => JSON.parse(env.DB.raw.prepare('SELECT state FROM void_watch_state WHERE rule_id = ?').get(id).state).wait;
const STORE = 'https://moonbeam846.gumroad.com/';
const T0 = Date.parse('2026-10-29T12:36:00Z'), H = 3600e3;
// the site, scripted one answer per request; every request is counted, so a retry inside a run would show
function site(answers) {
  const calls = [];
  const fetcher = async (url, o) => {
    calls.push({ url, ua: o && o.headers && o.headers['user-agent'] });
    const a = answers.shift() || { status: 200, body: 'Store: two products' };
    return new Response(a.body ?? (a.status === 429 ? 'Too many requests' : ''), { status: a.status, headers: { server: 'cloudflare', 'cf-ray': '8d1-IAD', ...(a.retryAfter != null ? { 'retry-after': a.retryAfter } : {}) } });
  };
  return { calls, fetcher };
}
async function storeWatch() {
  const env = { DB: d1() };
  const rule = hourly.rules.find((r) => r.id === 'hourly-store');
  const saved = await A.save(env, rule);
  assert.ok(saved.ok, saved.errors && saved.errors.join());
  return { env, rule: (await A.get(env, 'hourly-store')).rule };
}
const check = (env, rule, s, now) => A.run(env, rule, { tick: true, at: new Date(now).toISOString() }, 'schedule', { fetcher: s.fetcher, now });

test('Retry-After is read as seconds or as an HTTP date; without it the wait doubles from an hour to a day', () => {
  assert.equal(retryAfterMs('120', T0), 120e3);
  assert.equal(retryAfterMs(new Date(T0 + 2 * H).toUTCString(), T0), 2 * H);
  assert.equal(retryAfterMs('Wed, 21 Oct 2015 07:28:00 GMT', T0), 0, 'a date gone by waits no longer');
  assert.equal(retryAfterMs('', T0), null); assert.equal(retryAfterMs(null, T0), null); assert.equal(retryAfterMs('soon', T0), null);
  assert.equal(retryAfterMs(String(365 * 86400), T0), 7 * 864e5, 'a year is taken as a week');
  assert.deepEqual([1, 2, 3, 4, 5, 6, 40].map(backoffMs), [H, 2 * H, 4 * H, 8 * H, 16 * H, BACKOFF_MAX, BACKOFF_MAX]);
  assert.ok(slowDown(429, '')); assert.ok(slowDown(503, '30')); assert.ok(!slowDown(503, '')); assert.ok(!slowDown(404, '30'));
  assert.deepEqual(waitAfter(429, '', { n: 2 }, T0), { until: new Date(T0 + 4 * H).toISOString(), n: 3, why: '429, no Retry-After, backing off 4 h' });
  assert.match(answerOf(429, (k) => ({ server: 'cloudflare', 'cf-ray': 'abc-IAD', 'retry-after': '60' })[k] || '', '<h1>Too many requests</h1>'), /^the page answered 429 \(server cloudflare, cf-ray abc-IAD, Retry-After 60\) "Too many requests"$/);
});

test('a 429 with Retry-After in seconds: one request, a deferred record with the next try, and no request until then', async () => {
  const { env, rule } = await storeWatch();
  const s = site([{ status: 200, body: 'Store: two products' }, { status: 429, retryAfter: '5400' }]);
  await check(env, rule, s, T0 - H); // the first look
  const out = await check(env, rule, s, T0);
  assert.equal(s.calls.length, 2, 'one request a run: nothing retried inside it');
  assert.equal(out.ok, true, 'the run is not a failure');
  const rec = records(env).at(-1);
  assert.equal(rec.state, 'deferred'); assert.equal(rec.error, null);
  assert.match(rec.result, /^rate limited, retry later · the page answered 429 \(server cloudflare, cf-ray 8d1-IAD, Retry-After 5400\)/);
  assert.match(rec.result, /next try after 2026-10-29 14:06 UTC \(429, Retry-After 5400\)/);
  assert.equal(waitOf(env, 'hourly-store').until, new Date(T0 + 5400e3).toISOString());
  // the next hour's run comes inside the wait: no request, no record, and the run log says it waited
  const before = records(env).length, skip = await check(env, rule, s, T0 + H);
  assert.equal(s.calls.length, 2, 'no request while the site asked Verse to wait');
  assert.equal(records(env).length, before, 'a skipped run is no action, so it writes no record (and no failure)');
  assert.equal(skip.ok, true); assert.match(skip.log[0].said, /^waiting as the site asked: no request until 2026-10-29 14:06 UTC/);
  // after the wait it looks again; the page is the same as at the first look, so "changes" compares with that and tells nothing
  await check(env, rule, s, T0 + 2 * H);
  assert.equal(s.calls.length, 3);
  const after = records(env).at(-1);
  assert.equal(after.state, 'done'); assert.match(after.result, /^unchanged/, 'the last look outlived the 429');
  assert.equal(waitOf(env, 'hourly-store'), undefined, 'a good answer forgets the wait');
  assert.ok(records(env).every((r) => r.state !== 'failed'), 'nothing in the log is a failure');
  for (const c of s.calls) { assert.equal(c.url, STORE, 'the same address, no mirror or cache'); assert.match(c.ua, /^Verse\/1\.0 /, 'the same honest user agent every time'); }
});

test('a 429 with Retry-After as an HTTP date waits until that date; a 503 with one waits too, a 503 without one is still a failure', async () => {
  const { env, rule } = await storeWatch();
  const when = new Date(T0 + 3 * H).toUTCString();
  const s = site([{ status: 429, retryAfter: when }, { status: 503, retryAfter: '600' }, { status: 503 }]);
  await check(env, rule, s, T0);
  assert.equal(waitOf(env, 'hourly-store').until, new Date(T0 + 3 * H).toISOString());
  await check(env, rule, s, T0 + 2 * H); assert.equal(s.calls.length, 1, 'still inside the date');
  await check(env, rule, s, T0 + 3 * H); assert.equal(s.calls.length, 2);
  assert.equal(records(env).at(-1).state, 'deferred'); assert.equal(waitOf(env, 'hourly-store').until, new Date(T0 + 3 * H + 600e3).toISOString());
  const failed = await check(env, rule, s, T0 + 4 * H);
  assert.equal(s.calls.length, 3); assert.equal(failed.ok, false);
  assert.equal(records(env).at(-1).state, 'failed'); assert.match(records(env).at(-1).error, /^the page answered 503/);
});

test('without Retry-After the wait doubles, 1 h, 2 h, 4 h, and a good answer resets it to an hour', async () => {
  const { env, rule } = await storeWatch();
  const s = site([{ status: 429 }, { status: 429 }, { status: 429 }, { status: 200, body: 'Store' }, { status: 429 }]);
  let t = T0;
  for (const [n, hours] of [[1, 1], [2, 2], [3, 4]]) {
    await check(env, rule, s, t);
    const w = waitOf(env, 'hourly-store');
    assert.deepEqual([w.n, Date.parse(w.until) - t], [n, hours * H], 'rate limit ' + n);
    assert.match(records(env).at(-1).result, new RegExp('no Retry-After, backing off ' + hours + ' h'));
    t += hours * H;
  }
  assert.equal(s.calls.length, 3);
  await check(env, rule, s, t); assert.equal(records(env).at(-1).state, 'done'); assert.equal(waitOf(env, 'hourly-store'), undefined);
  await check(env, rule, s, t + H);
  assert.deepEqual([waitOf(env, 'hourly-store').n, Date.parse(waitOf(env, 'hourly-store').until) - (t + H)], [1, H], 'the count starts again');
  assert.equal(records(env).filter((r) => r.state === 'failed').length, 0);
});

test('the clock: a page watch is due at its own minute of the hour, stable, inside the hour, and different across rules', () => {
  const ids = hourly.rules.map((r) => r.id);
  for (const id of ids) { const m = jitterMinutes(id, 60); assert.ok(Number.isInteger(m) && m >= 0 && m < 60, id + ' ' + m); assert.equal(jitterMinutes(id, 60), m, 'the same every time'); }
  assert.ok(new Set(ids.map((id) => jitterMinutes(id))).size >= 5, 'the hourly rules spread over the hour');
  assert.notEqual(jitterMinutes('hourly-site-up'), jitterMinutes('hourly-mcp-tools'));
  assert.ok(jitterMinutes('x', 15) < 15, 'a shorter period keeps its minute inside the period');
  const rule = { ...validate(hourly.rules.find((r) => r.id === 'hourly-store'), {}).rule, enabled: true };
  assert.ok(knocks(rule)); assert.ok(!knocks({ do: [{ action: 'note', text: 'x' }] }));
  const m = jitterMinutes('hourly-store'), hour = Date.parse('2026-10-29T13:00:00Z'), at = (min) => hour + min * 60e3, iso = (ms) => new Date(ms).toISOString();
  const lastRun = iso(at(m) - H + 60e3); // it ran a minute after its slot last hour
  assert.ok(!due(rule, lastRun, at(m) - 10 * 60e3), 'ten minutes before its minute: not yet');
  assert.ok(due(rule, lastRun, at(m) - 2 * 60e3), 'a late clock: due a little early rather than a whole tick late');
  assert.ok(due(rule, lastRun, at(m) + 14 * 60e3), 'the first tick after its minute');
  assert.ok(!due(rule, iso(at(m)), at(m) + 14 * 60e3), 'once a slot');
  assert.ok(due(rule, null, hour), 'never run: due at once');
  assert.ok(due(rule, iso(at(m) - 20 * 60e3), at(m) + 10 * 60e3), 'a run off its minute (the first check, made by hand) moves to its minute, 30 minutes later');
  // two page watches that all ran at 12:00 (the seed made them together) part at once: each runs at its own minute after that
  const page = (id) => ({ ...rule, id }), noon = iso(Date.parse('2026-10-29T12:00:00Z')), t = (hm) => Date.parse('2026-10-29T' + hm + ':00Z');
  assert.deepEqual([jitterMinutes('hourly-site-up'), jitterMinutes('hourly-mcp-tools')], [12, 57], 'the minutes these ids hash to');
  assert.deepEqual(['12:15', '12:30', '12:45', '13:00'].map((hm) => [due(page('hourly-site-up'), noon, t(hm)), due(page('hourly-mcp-tools'), noon, t(hm))]),
    [[true, false], [true, false], [true, false], [true, true]], 'site-up from the 12:15 tick, mcp-tools only from 12:57 (the 13:00 tick)');
  // rules that read no one's page keep the old interval
  const note = { id: 'n1', name: 'n', enabled: true, when: { on: 'schedule', every: 60 }, do: [{ action: 'note', text: 'n' }] };
  assert.ok(!due(note, iso(hour - 30 * 60e3), hour)); assert.ok(due(note, iso(hour - 58 * 60e3), hour));
});

test('the record: deferred is its own end state with what happens next, and the action log never calls it failed', () => {
  const r = settle(begin({ owner: 'owner', kind: 'watch.check', ref: 'hourly-store' }), 'deferred', 'rate limited, retry later · next try after 2026-10-29 14:06 UTC');
  assert.deepEqual(problems(r), []);
  assert.equal(r.error, null); assert.match(r.result, /^rate limited, retry later/);
  assert.deepEqual(problems({ ...r, result: null }), ['a deferred record says when it tries again']);
});
