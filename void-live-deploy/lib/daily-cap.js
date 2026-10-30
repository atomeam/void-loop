// One global counter for anything that spends the free allowance (owner, 2026-10-26): "cap(env, key, limit) -> { ok, n }". The count lives in D1
// (void_daily_cap(day, key, n), one row per UTC day and key), so every edge location shares it: a count kept in the edge cache is per location and the
// real ceiling was the limit times the locations. One statement both counts and compares, so two requests at once cannot both take the last place:
//   INSERT ... VALUES (day, key, 1) ON CONFLICT (day, key) DO UPDATE SET n = n + 1 WHERE n < limit RETURNING n
// A row comes back only when a place was taken. No D1, or any D1 error, is { ok: false } (fail closed: the caller shows its free fallback, never spends).
// Not KV: its writes are already over the free allowance (docs/wishlist.md item 2). Users so far: 'news-report' (functions/api/answer.js mode 'report').
// Tests: tools/daily-cap.test.mjs.
const TABLE = 'CREATE TABLE IF NOT EXISTS void_daily_cap (day TEXT NOT NULL, key TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (day, key))';
const ready = new WeakSet();
/** the UTC date, "2026-10-26". Pure. */
export const dayOf = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);
/** take one place under `key` today: { ok, n } (n is the count after, or 0 when refused). `now` is for tests. */
export async function cap(env, key, limit, now = Date.now()) {
  try {
    const db = env && env.DB; if (!db || !(limit >= 1) || !/^[a-z0-9:_-]{1,60}$/i.test(String(key))) return { ok: false, n: 0 };
    if (!ready.has(db)) { await db.prepare(TABLE).run(); ready.add(db); }
    const r = await db.prepare('INSERT INTO void_daily_cap (day, key, n) VALUES (?, ?, 1) ON CONFLICT (day, key) DO UPDATE SET n = n + 1 WHERE n < ? RETURNING n').bind(dayOf(now), String(key), Math.floor(limit)).all();
    const row = r && r.results && r.results[0];
    return row ? { ok: true, n: Number(row.n) } : { ok: false, n: 0 };
  } catch (_) { return { ok: false, n: 0 }; }
}
/** how many places `key` has taken today, without taking one: a number, or null when D1 is missing or errs. `now` is for tests. */
export async function peek(env, key, now = Date.now()) {
  try {
    const db = env && env.DB; if (!db || !/^[a-z0-9:_-]{1,60}$/i.test(String(key))) return null;
    if (!ready.has(db)) { await db.prepare(TABLE).run(); ready.add(db); }
    const row = await db.prepare('SELECT n FROM void_daily_cap WHERE day = ? AND key = ?').bind(dayOf(now), String(key)).first();
    return row ? Number(row.n) || 0 : 0;
  } catch (_) { return null; }
}
/** take a place under every [key, limit] pair in order; refused, with nothing more taken, at the first that is full. List the short windows (an hour) before the day, so a full hour never uses up a place in the day. */
export async function capAll(env, pairs, now = Date.now()) {
  for (const [key, limit] of pairs) { const r = await cap(env, key, limit, now); if (!r.ok) return { ok: false, key }; }
  return { ok: true };
}
