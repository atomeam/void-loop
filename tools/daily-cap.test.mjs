// The global daily cap (lib/daily-cap.js) on a real SQLite standing in for D1, shared by two simulated edge locations. Run: node --test tools/daily-cap.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { cap, capAll, dayOf } from '../void-live-deploy/lib/daily-cap.js';

const d1 = () => { const db = new DatabaseSync(':memory:'); const stmt = (sql, a = []) => ({ bind: (...b) => stmt(sql, b), run: async () => { db.prepare(sql).run(...a); return {}; }, all: async () => ({ results: db.prepare(sql).all(...a) }) }); return { prepare: (sql) => stmt(sql) }; };

test('the limit is enforced across two locations sharing one database, and only the limit is let through', async () => {
  const db = d1(), a = { DB: db }, b = { DB: db }; let ok = 0;
  for (let i = 0; i < 10; i++) if ((await cap(i % 2 ? a : b, 'news-report', 7)).ok) ok++;
  assert.equal(ok, 7); assert.deepEqual(await cap(a, 'news-report', 7), { ok: false, n: 0 });
  assert.deepEqual(await cap(a, 'sports-report', 7), { ok: true, n: 1 }, 'another key has its own count');
});
test('requests at the same moment cannot both take the last place', async () => {
  const env = { DB: d1() }; const r = await Promise.all(Array.from({ length: 20 }, () => cap(env, 'k', 5))); assert.equal(r.filter((x) => x.ok).length, 5);
});
test('a new UTC day starts again from nothing', async () => {
  const env = { DB: d1() }, d1st = Date.UTC(2026, 9, 26, 23, 59), next = Date.UTC(2026, 9, 27, 0, 1);
  assert.equal((await cap(env, 'k', 1, d1st)).ok, true); assert.equal((await cap(env, 'k', 1, d1st)).ok, false); assert.equal((await cap(env, 'k', 1, next)).ok, true); assert.equal(dayOf(next), '2026-10-27');
});
test('fail closed: no database, a database that errors, a bad key or a bad limit all refuse', async () => {
  assert.equal((await cap({}, 'k', 5)).ok, false); assert.equal((await cap(null, 'k', 5)).ok, false);
  assert.equal((await cap({ DB: { prepare: () => { throw new Error('d1 down'); } } }, 'k', 5)).ok, false);
  const env = { DB: d1() }; assert.equal((await cap(env, 'bad key!', 5)).ok, false); assert.equal((await cap(env, 'k', 0)).ok, false); assert.equal((await cap(env, 'k', NaN)).ok, false);
});
test('capAll: the hourly and the daily place are both needed; a full hour takes nothing from the day', async () => {
  const env = { DB: d1() }, h10 = Date.UTC(2026, 9, 26, 10, 5), pairs = (h) => [['r:h' + h, 2], ['r', 3]];
  assert.equal((await capAll(env, pairs(10), h10)).ok, true); assert.equal((await capAll(env, pairs(10), h10)).ok, true); assert.deepEqual(await capAll(env, pairs(10), h10), { ok: false, key: 'r:h10' });
  assert.equal((await capAll(env, pairs(11), Date.UTC(2026, 9, 26, 11, 1))).ok, true, 'a new hour has room: the full hour used nothing of the day');
  assert.deepEqual(await capAll(env, pairs(11), Date.UTC(2026, 9, 26, 11, 2)), { ok: false, key: 'r' }, 'the day is now full');
});
