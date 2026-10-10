// The execution record (frontier build order step 2, owner 2026-10-09): every action Void takes, or stubs, writes one
// record: who it was for (owner), what it was (kind, ref), its state, and its result or its error. Nothing is "done"
// without its record: the record is written as `running` before the action starts, and an action whose record can't be
// written does not run. A record that stays `running` means the action started and Void never learned how it ended.
//   states: running -> done (result) | failed (error) | stubbed (result says what would have happened; nothing left Void)
// D1 table void_actions; the owner reads them at /api/actions. The pure half (begin/settle/problems) has no D1.

export const STATES = ['running', 'done', 'failed', 'stubbed'];
export const KEEP = 1000;
export const TABLE = 'CREATE TABLE IF NOT EXISTS void_actions (id TEXT PRIMARY KEY, owner TEXT NOT NULL, kind TEXT NOT NULL, ref TEXT, state TEXT NOT NULL, result TEXT, error TEXT, started TEXT NOT NULL, finished TEXT)';
const clip = (s, n = 500) => (s == null ? null : String(s).slice(0, n));
let seq = 0;
const newId = (t) => 'act-' + t.getTime().toString(36) + '-' + (seq++).toString(36) + Math.random().toString(36).slice(2, 6);

/** A new record, `running`. Pure. */
export function begin({ owner, kind, ref = null }, now = new Date()) {
  return { id: newId(now), owner: String(owner || ''), kind: String(kind || ''), ref: ref == null ? null : clip(ref, 200), state: 'running', result: null, error: null, started: now.toISOString(), finished: null };
}

/** The record moved to its end state. Only a running record can end, and only once. Pure. */
export function settle(rec, state, text, now = new Date()) {
  if (rec.state !== 'running') throw new Error('record ' + rec.id + ' already ended as ' + rec.state);
  if (!['done', 'failed', 'stubbed'].includes(state)) throw new Error('not an end state: ' + state);
  return { ...rec, state, result: state === 'failed' ? null : clip(text), error: state === 'failed' ? clip(text) || 'failed' : null, finished: now.toISOString() };
}

/** Every way a record breaks the contract, as sentences; [] when it holds. Pure. */
export function problems(r) {
  const out = [];
  if (!r || typeof r !== 'object') return ['not a record'];
  if (!r.id) out.push('no id');
  if (!r.owner) out.push('no owner: every action is done for someone');
  if (!r.kind) out.push('no kind: what the action was');
  if (!STATES.includes(r.state)) out.push('state must be one of ' + STATES.join(', '));
  if (!r.started) out.push('no start time');
  if (r.state === 'running' && r.finished) out.push('a running record has no finish time');
  if (r.state !== 'running' && !r.finished) out.push('an ended record has its finish time');
  if (r.state === 'done' && r.result == null) out.push('a done record says what it did');
  if (r.state === 'stubbed' && r.result == null) out.push('a stubbed record says what would have happened');
  if (r.state === 'failed' && !r.error) out.push('a failed record says why');
  if (r.state !== 'failed' && r.error) out.push('only a failed record has an error');
  return out;
}

const write = (env, r) => env.DB.prepare('INSERT INTO void_actions (id, owner, kind, ref, state, result, error, started, finished) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET state = excluded.state, result = excluded.result, error = excluded.error, finished = excluded.finished')
  .bind(r.id, r.owner, r.kind, r.ref, r.state, r.result, r.error, r.started, r.finished).run();

/**
 * Run one action with its record. The `running` record is written first; if that write fails the action does not run
 * and this throws. Then fn() runs: its return value is the result (done), a thrown error is the error (failed, and
 * rethrown). opts.stub: the action is not taken at all; the record ends `stubbed` with opts.stub as what would have happened.
 * Returns { record, value }.
 */
export async function track(env, { owner, kind, ref }, fn, opts = {}) {
  await env.DB.prepare(TABLE).run();
  let rec = begin({ owner, kind, ref });
  await write(env, rec); // no record, no action
  if (opts.stub != null) { rec = settle(rec, 'stubbed', opts.stub); await write(env, rec); return { record: rec, value: undefined }; }
  let value;
  try { value = await fn(); }
  catch (e) { rec = settle(rec, 'failed', (e && e.message) || String(e)); try { await write(env, rec); } catch (_) {} throw e; }
  rec = settle(rec, 'done', typeof value === 'string' ? value : JSON.stringify(value ?? 'done'));
  try { await write(env, rec); } catch (_) {} // the action happened; a lost update leaves it `running`, which says so
  await env.DB.prepare('DELETE FROM void_actions WHERE id NOT IN (SELECT id FROM void_actions ORDER BY started DESC LIMIT ?)').bind(KEEP).run().catch(() => {});
  return { record: rec, value };
}

// An action taken outside the server (the extension acting in the owner's tab, B3) can't run inside track(), so its record
// is written in two calls with the same contract: open() writes it `running` before the action (no record, no action) and
// close() ends it once, done | failed | stubbed.
export async function open(env, { owner, kind, ref }) {
  await env.DB.prepare(TABLE).run();
  const rec = begin({ owner, kind, ref });
  await write(env, rec);
  return rec;
}
export async function close(env, id, state, text) {
  const row = await env.DB.prepare('SELECT * FROM void_actions WHERE id = ?').bind(String(id || '')).first();
  if (!row) throw new Error('no record ' + id);
  const rec = settle(row, state, text);
  await write(env, rec);
  return rec;
}

/** The newest records first, for the owner; offset skips that many newest (a card pages 30 at a time). */
export async function recent(env, { limit = 100, offset = 0, owner } = {}) {
  await env.DB.prepare(TABLE).run();
  const n = Math.max(1, Math.min(500, Number(limit) || 100)), skip = Math.max(0, Math.min(KEEP, Math.floor(Number(offset)) || 0));
  const q = owner ? env.DB.prepare('SELECT * FROM void_actions WHERE owner = ? ORDER BY started DESC LIMIT ? OFFSET ?').bind(owner, n, skip) : env.DB.prepare('SELECT * FROM void_actions ORDER BY started DESC LIMIT ? OFFSET ?').bind(n, skip);
  return ((await q.all()).results || []);
}
