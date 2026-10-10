// The standing watch (void-live-deploy/lib/watch.js, skills/watch.js, /api/watch, the watch step in lib/automations.js and
// lib/automations-run.js): one asked-for thing, checked on the 15-minute clock, every check an execution record.
// Run: node --test tools/watch.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { parseWatchAsk, watchOf, validateWatch, evaluate, describe, checkText, pageText, priceIn, fingerprint, localTime, timeOf, zoneOf } from '../void-live-deploy/lib/watch.js';
import { watchRule, validate } from '../void-live-deploy/lib/automations.js';
import * as A from '../void-live-deploy/lib/automations-run.js';
import * as api from '../void-live-deploy/functions/api/watch.js';
import * as actionsApi from '../void-live-deploy/functions/api/actions.js';
import skill, { lastLine } from '../void-live-deploy/skills/watch.js';
import { lineOf } from '../void-live-deploy/skills/actions.js';

test('the asks become watches; look-alikes and plain questions do not', () => {
  assert.deepEqual(parseWatchAsk("tell me when it's below 0 in Oslo"), { kind: 'weather', place: 'Oslo', op: '<', value: 0, unit: 'c' });
  assert.deepEqual(parseWatchAsk('alert me when it goes above 86 F in Phoenix'), { kind: 'weather', place: 'Phoenix', op: '>', value: 86, unit: 'f' });
  assert.deepEqual(parseWatchAsk('let me know if https://shop.example/x says sold out'), { kind: 'page', url: 'https://shop.example/x', op: 'contains', value: 'sold out' });
  assert.deepEqual(parseWatchAsk('tell me when https://shop.example/x no longer says out of stock'), { kind: 'page', url: 'https://shop.example/x', op: 'not-contains', value: 'out of stock' });
  assert.deepEqual(parseWatchAsk('alert me when the price on https://shop.example/y drops below 50'), { kind: 'price', url: 'https://shop.example/y', op: '<', value: 50 });
  assert.deepEqual(parseWatchAsk('watch https://example.com/news for changes'), { kind: 'page', url: 'https://example.com/news', op: 'changes' });
  assert.deepEqual(parseWatchAsk("tell me when it's 9am in Tokyo"), { kind: 'time', zone: 'Asia/Tokyo', at: '09:00', place: 'Tokyo' });
  assert.deepEqual(watchOf('my watches'), { list: true }); assert.deepEqual(watchOf('what are you watching?'), { list: true });
  for (const a of ['watch a movie', 'apple watch', 'tell me a joke', 'what time is it in Tokyo', 'weather in Oslo', 'watch the throne', "tell me when it's 9am in Narnia", '']) assert.equal(watchOf(a), null, a);
  for (const e of skill.examples) assert.ok(skill.match(e.toLowerCase(), e), e);
  for (const e of skill.nearMisses) assert.ok(!skill.match(e.toLowerCase(), e), e);
  assert.equal(timeOf('5:30 pm'), '17:30'); assert.equal(timeOf('noon'), '12:00'); assert.equal(timeOf('25'), ''); assert.equal(zoneOf('Europe/Oslo'), 'Europe/Oslo'); assert.equal(zoneOf('Nowhere/Land'), '');
});

test('a watch is checked field by field; a page must be a public https address; the rule it becomes is a valid scheduled automation', () => {
  assert.equal(validateWatch(parseWatchAsk("tell me when it's below 0 in Oslo")).ok, true);
  assert.match(validateWatch({ kind: 'page', url: 'http://x.com', op: 'changes' }).errors[0], /public https/);
  assert.match(validateWatch({ kind: 'page', url: 'https://localhost/x', op: 'changes' }).errors[0], /public https/);
  assert.match(validateWatch({ kind: 'weather', place: '', op: '<', value: 0 }).errors.join(' '), /place/);
  assert.match(validateWatch({ kind: 'time', zone: 'Mars/Base', at: '09:00' }).errors[0], /time zone/);
  const rule = watchRule(parseWatchAsk('watch https://example.com/news for changes'));
  assert.equal(rule.name, 'Watch: https://example.com/news changes'); assert.deepEqual(rule.when, { on: 'schedule', every: 15 });
  const v = validate(rule, {}); assert.equal(v.ok, true, v.errors.join(' | ')); assert.deepEqual(v.rule.do[0], { action: 'watch', watch: { kind: 'page', url: 'https://example.com/news', op: 'changes' }, tell: 'note' });
  assert.match(validate({ ...rule, when: { on: 'manual' } }, {}).errors.join(' '), /runs on a schedule/);
  assert.equal(describe(rule.do[0].watch), 'https://example.com/news changes');
});

test('evaluate: each kind judged against a sample, with the evidence in words and the state for next time', () => {
  const oslo = { kind: 'weather', place: 'Oslo', op: '<', value: 0, unit: 'c' };
  assert.deepEqual(evaluate(oslo, { temperature: -2.3 }), { matched: true, seen: '-2.3°C in Oslo', state: { seen: -2.3, matched: true } });
  assert.equal(evaluate(oslo, { temperature: 4 }).matched, false);
  assert.equal(evaluate({ ...oslo, unit: 'f', value: 32 }, { temperature: -1 }).matched, true, '30.2°F is below 32');
  assert.match(evaluate(oslo, { temperature: null }).seen, /no temperature/);
  const page = { kind: 'page', url: 'https://x.example', op: 'contains', value: 'Sold Out' };
  assert.equal(evaluate(page, { text: 'Status: sold out until June' }).matched, true);
  assert.equal(evaluate({ ...page, op: 'not-contains' }, { text: 'Status: sold out' }).matched, false);
  const ch = { kind: 'page', url: 'https://x.example', op: 'changes' };
  const first = evaluate(ch, { text: 'hello' }); assert.equal(first.matched, false); assert.match(first.seen, /first look/);
  assert.equal(evaluate(ch, { text: 'hello' }, first.state).matched, false);
  assert.equal(evaluate(ch, { text: 'hello world' }, first.state).matched, true);
  const price = { kind: 'price', url: 'https://x.example', op: '<', value: 50 };
  assert.deepEqual(evaluate(price, { text: 'Now only $49.99 per month' }), { matched: true, seen: 'price 49.99 on the page', state: { seen: 49.99, matched: true } });
  assert.equal(priceIn('from €1.234,50 a year'), 1234.5); assert.equal(priceIn('no money here'), null);
  const nine = { kind: 'time', zone: 'Asia/Tokyo', at: '09:00', place: 'Tokyo' };
  const before = evaluate(nine, { now: Date.UTC(2026, 9, 10, 23, 30) }); // 08:30 in Tokyo on the 11th
  assert.equal(before.matched, false); assert.match(before.seen, /08:30 in Tokyo \(before 09:00\)/);
  const at = evaluate(nine, { now: Date.UTC(2026, 9, 11, 0, 5) }, before.state); assert.equal(at.matched, true); assert.equal(at.state.day, '2026-10-11');
  assert.equal(evaluate(nine, { now: Date.UTC(2026, 9, 11, 0, 20) }, at.state).matched, false, 'told once a day');
  assert.equal(evaluate(nine, { now: Date.UTC(2026, 9, 12, 0, 20) }, at.state).matched, true, 'the next day again');
  assert.equal(localTime('UTC', Date.UTC(2026, 0, 1, 0, 0)), '00:00');
  assert.equal(pageText('<html><script>x()</script><p>Hello&nbsp;<b>world</b></p><style>a{}</style></html>'), 'Hello world');
  assert.equal(fingerprint('a'), fingerprint('a')); assert.notEqual(fingerprint('a'), fingerprint('b'));
  assert.equal(checkText(oslo, { matched: true, seen: '-2°C in Oslo' }, 'told on the stage'), 'MATCH · -2°C in Oslo · watching for below 0°C in Oslo · told on the stage');
});

const TOKEN = 'owner-token-for-tests-1234567890';
function d1() {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE void_queue (id TEXT PRIMARY KEY, ask TEXT, target TEXT, state TEXT, note TEXT, at TEXT, updated TEXT)');
  const stmt = (sql, a = []) => ({ sql, a, bind: (...b) => stmt(sql, b), run: async () => { const r = db.prepare(sql).run(...a); return { meta: { changes: Number(r.changes) } }; }, all: async () => ({ results: db.prepare(sql).all(...a) }), first: async (col) => { const r = db.prepare(sql).get(...a) || null; return col ? (r ? r[col] : null) : r; } });
  return { prepare: (sql) => stmt(sql), raw: db, batch: async (list) => Promise.all(list.map((s) => s.run())) };
}
const records = (env) => env.DB.raw.prepare('SELECT owner, kind, ref, state, result, error FROM void_actions ORDER BY started, rowid').all();
const call = (env, method, body, auth = true) => api['onRequest' + method[0] + method.slice(1).toLowerCase()]({ env, request: new Request('https://x/api/watch', { method, headers: { 'content-type': 'application/json', ...(auth ? { authorization: 'Bearer ' + TOKEN } : {}) }, body: body ? JSON.stringify(body) : undefined }) });
const pages = { 'https://shop.example/x': 'Nice bike. Status: in stock. $120' };
const fetcher = async (url) => (/geocoding/.test(url) ? new Response(JSON.stringify({ results: [{ latitude: 59.9, longitude: 10.7 }] })) : /forecast/.test(url) ? new Response(JSON.stringify({ current: { temperature_2m: -3 } })) : pages[url] != null ? new Response(pages[url]) : new Response('', { status: 404 }));

test('the tick runs one watch: the check is a watch.check record in the asker\'s scope, a fresh match is told once, a send is stubbed', async () => {
  const env = { DB: d1(), READ_TOKEN: TOKEN };
  const saved = await A.save(env, watchRule(parseWatchAsk("tell me when it's below 0 in Oslo"), 'send'), { scope: 'member-1' });
  assert.ok(saved.ok, saved.errors && saved.errors.join());
  const t1 = await A.tick(env, Date.now(), { fetcher });
  assert.deepEqual(t1.ran.map((r) => r.ok), [true]);
  let rs = records(env);
  assert.deepEqual(rs.map((r) => [r.owner, r.kind, r.ref, r.state]), [['member-1', 'watch.check', saved.rule.id, 'done'], ['member-1', 'watch.send', saved.rule.id, 'stubbed']]);
  assert.equal(rs[0].result, 'MATCH · -3°C in Oslo · watching for below 0°C in Oslo · send stubbed (the confirm line would ask first)');
  assert.match(rs[1].result, /^would have sent: MATCH · -3°C in Oslo/);
  // the same match on the next tick is evidence, not a second telling
  const t2 = await A.tick(env, Date.now() + 16 * 60e3, { fetcher });
  assert.equal(t2.ran.length, 1);
  rs = records(env);
  assert.equal(rs.length, 3); assert.equal(rs[2].kind, 'watch.check'); assert.equal(rs[2].result, 'MATCH · -3°C in Oslo · watching for below 0°C in Oslo');
  // a page that cannot be read is a failed check, kept as such; the watch stays
  const bad = await A.save(env, watchRule(parseWatchAsk('watch https://gone.example/p for changes')), { scope: '' });
  const t3 = await A.tick(env, Date.now() + 40 * 60e3, { fetcher });
  const failed = records(env).find((r) => r.ref === bad.rule.id);
  assert.equal(failed.state, 'failed'); assert.match(failed.error, /answered 404/); assert.equal(failed.owner, 'owner');
  assert.equal(t3.ran.find((r) => r.id === bad.rule.id).ok, false);
  // the owner's actions card shows the record as a line
  assert.equal(lineOf(records(env).map((r) => ({ ...r, started: '2026-10-10T09:00:00Z' }))[0]).slice(0, 2), '✓ ');
  assert.match(lineOf({ ...rs[0], started: '2026-10-10T09:00:00Z' }), /watch\.check · .* · MATCH · -3°C in Oslo/);
});

test('/api/watch: a stranger gets nothing; the owner makes a watch from an ask, sees its first check, pauses and stops it', async () => {
  const env = { DB: d1(), READ_TOKEN: TOKEN };
  assert.equal((await call(env, 'POST', { ask: "tell me when it's below 0 in Oslo" }, false)).status, 401);
  assert.equal((await call(env, 'GET', null, false)).status, 401);
  assert.equal(env.DB.raw.prepare("SELECT name FROM sqlite_master WHERE name = 'void_automations'").get(), undefined, 'nothing kept for a stranger');
  assert.equal((await call(env, 'POST', { ask: 'watch a movie' })).status, 400);
  const realFetch = globalThis.fetch; globalThis.fetch = fetcher;
  let made;
  try { made = await (await call(env, 'POST', { ask: 'let me know if https://shop.example/x says sold out' })).json(); } finally { globalThis.fetch = realFetch; }
  assert.equal(made.saved.scope, ''); assert.equal(made.saved.do[0].watch.value, 'sold out');
  assert.equal(made.check.ok, true);
  assert.equal(made.watches.length, 1);
  const w = made.watches[0];
  assert.equal(w.enabled, true); assert.equal(w.every, 15); assert.equal(w.checks.length, 1); assert.equal(w.checks[0].kind, 'watch.check');
  assert.match(w.checks[0].result, /^did not find "sold out" on the page \(\d+ chars\) · watching for https:\/\/shop\.example\/x says "sold out"$/);
  assert.ok(w.last && w.last.at);
  assert.match(lastLine(w), /^· .* · did not find "sold out"/);
  const paused = await (await call(env, 'PATCH', { id: w.id, enabled: false })).json();
  assert.equal(paused.watches[0].enabled, false);
  assert.equal((await A.tick(env, Date.now() + 60 * 60e3, { fetcher })).ran.length, 0, 'a paused watch is not checked');
  assert.equal((await call(env, 'DELETE', { id: 'nope' })).status, 404);
  const gone = await (await call(env, 'DELETE', { id: w.id })).json();
  assert.deepEqual(gone.watches, []);
  assert.equal(env.DB.raw.prepare('SELECT COUNT(*) n FROM void_watch_state').get().n, 0);
});

test('a member sees only their own watches, and the owner\'s automations card does not list a member\'s', async () => {
  const env = { DB: d1(), READ_TOKEN: TOKEN };
  await A.save(env, watchRule(parseWatchAsk("tell me when it's 9am in Tokyo")), { scope: 'member-1' });
  await A.save(env, watchRule(parseWatchAsk("tell me when it's 9am in Tokyo")), { scope: 'member-2' });
  assert.equal((await A.list(env, { scope: 'member-1' })).rules.length, 1);
  assert.equal((await A.list(env, { scope: '' })).rules.length, 0);
  const id = (await A.list(env, { scope: 'member-1' })).rules[0].id;
  assert.equal(await A.get(env, id, 'member-2'), null);
  assert.equal(await A.setEnabled(env, id, false, 'member-2'), false);
  assert.equal(await A.remove(env, id, 'member-2'), false);
  assert.equal(await A.remove(env, id, 'member-1'), true);
});
