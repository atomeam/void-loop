// lib/db.js (convergence step 3, lists runs 24 and 25): the table-making promise 19 endpoints wrote out as `let ready = null` has one copy.
// Made once and shared, forgotten after a failure so the next request tries again, forgotten on purpose by reset() for a test's new
// database; tablesReady runs its statements in order, batchReady sends them as one D1 batch. No endpoint grows the old copy back.
// Run: node --test tools/db-ready.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readFileSync as read, readdirSync } from 'node:fs';
import { readyOnce, tablesReady, batchReady } from '../void-live-deploy/lib/db.js';

test('made once and shared by concurrent and later callers', async () => {
  let n = 0; const ready = readyOnce(async () => { n++; await null; return 'made'; });
  const [a, b] = await Promise.all([ready({}), ready({})]);
  assert.equal(a, 'made'); assert.equal(b, 'made'); await ready({});
  assert.equal(n, 1);
});
test('a failure is forgotten, so the next call tries again', async () => {
  let n = 0; const ready = readyOnce(async () => { n++; if (n === 1) throw new Error('d1 down'); });
  await assert.rejects(ready({}), /d1 down/);
  await ready({}); await ready({});
  assert.equal(n, 2);
});
test('a synchronous throw in make is a rejected promise, not a throw', async () => {
  const ready = readyOnce(() => { throw new Error('boom'); });
  const p = ready({}); assert.ok(p instanceof Promise);
  await assert.rejects(p, /boom/);
});
test('reset() makes the tables again for a new database', async () => {
  let n = 0; const ready = readyOnce(async () => { n++; });
  await ready({}); ready.reset(); await ready({});
  assert.equal(n, 2);
});
test('tablesReady runs each statement in order on env.DB, once', async () => {
  const ran = []; const env = { DB: { prepare: (s) => ({ run: async () => { ran.push(s); } }) } };
  const ready = tablesReady(['CREATE TABLE a (x)', 'CREATE INDEX b ON a (x)']);
  await ready(env); await ready(env);
  assert.deepEqual(ran, ['CREATE TABLE a (x)', 'CREATE INDEX b ON a (x)']);
});
test('the converted endpoints use lib/db.js and keep no copy of the old promise', () => {
  for (const f of ['visit', 'calshare', 'react', 'rsvp', 'tally', 'gen-data', 'fanfic-hits', 'boards/[[path]]']) {
    const s = readFileSync(new URL('../void-live-deploy/functions/api/' + f + '.js', import.meta.url), 'utf8');
    assert.match(s, /tablesReady\(/, f);
    assert.doesNotMatch(s, /let ready = null/, f);
    assert.match(s, /export const resetReady = \(\) => ready\.reset\(\)/, f + ' keeps resetReady for its tests');
  }
});
test('batchReady sends one batch, then its follow-up, once', async () => {
  const batches = [], after = []; const env = { DB: { prepare: (q) => q, batch: async (qs) => { batches.push(qs); } } };
  const ready = batchReady(['CREATE TABLE a (x)', 'CREATE TABLE b (y)'], async (e) => { after.push(e === env); });
  await Promise.all([ready(env), ready(env)]); await ready(env);
  assert.deepEqual(batches, [['CREATE TABLE a (x)', 'CREATE TABLE b (y)']]); assert.deepEqual(after, [true]);
});
test('a failed batch is forgotten, so the next call tries again', async () => {
  let n = 0; const env = { DB: { prepare: (q) => q, batch: async () => { if (++n === 1) throw new Error('d1 down'); } } };
  const ready = batchReady(['CREATE TABLE a (x)']);
  await assert.rejects(ready(env), /d1 down/); await ready(env); assert.equal(n, 2);
});
test('lists run 25: the other 11 endpoints use lib/db.js too', () => {
  for (const f of ['agent', 'card-art', 'clip', 'comments', 'daily-art', 'gallery', 'generators', 'image', 'merge', 'studio', 'watchalong']) {
    const s = read(new URL('../void-live-deploy/functions/api/' + f + '.js', import.meta.url), 'utf8');
    assert.match(s, /(readyOnce|tablesReady|batchReady)\(/, f);
    assert.doesNotMatch(s, /let ready = null/, f);
    if (/export const resetReady/.test(s)) assert.match(s, /export const resetReady = \(\) => ready\.reset\(\)/, f + ' keeps resetReady for its tests');
  }
});
test('no endpoint writes out the old promise any more', () => {
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(d + '/' + e.name) : e.name.endsWith('.js') ? [d + '/' + e.name] : []);
  const dir = new URL('../void-live-deploy/functions', import.meta.url).pathname;
  assert.deepEqual(walk(dir).filter((f) => /let ready = null/.test(read(f, 'utf8'))), []);
});
