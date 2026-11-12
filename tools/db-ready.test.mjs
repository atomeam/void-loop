// lib/db.js (convergence step 3, lists run 24): the table-making promise 8 endpoints wrote out as `let ready = null` has one copy.
// Made once and shared, forgotten after a failure so the next request tries again, forgotten on purpose by reset() for a test's new
// database; tablesReady runs its statements in order. No endpoint grows the old copy back.
// Run: node --test tools/db-ready.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readyOnce, tablesReady } from '../void-live-deploy/lib/db.js';

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
