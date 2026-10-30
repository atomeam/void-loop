// A published generator's shared data (owner, 2026-10-25: perchance's key-value storage): a small JSON object everyone using the generator reads
// and adds to, written by the list language's {add: key} and {set: key = text} (lib/listgen.js) and read back as [shared.key].
//   GET  ?id=<generator id>      -> { ok, data }
//   POST { id, writes: [{ op: 'add', key } | { op: 'set', key, value }] } -> { ok, data } (at most 5 writes a call)
//   DELETE ?id=<id> (owner key)  -> { ok } the data is cleared
//
// WHAT A STRANGER COULD MAKE THIS DO, AND WHY IT IS BOUNDED. An open endpoint with no account. The most a caller can do is change the shared data of a
// generator that is published: count a key up by one or set it to a short text. At most SHARED_KEYS keys of 30 characters, values of 200, the whole
// object at most DATA_MAX bytes; a text with sexual or hateful words, a link or a key shape is refused. 20 calls a minute and 300 a day per hashed
// connection, WRITES_DAY writes a day per generator. THAT IS NOT PREVENTED: anyone can change a counter or a text, as on perchance; the data is a toy
// for the generator's results, never something that decides anything, and the owner can clear it. No address is stored. No D1 or SALT: off.
import { bump, ownerOk } from '../../lib/guard.js';
import { clientKey, dayOf, secondsToMidnight } from '../../lib/reactions.js';
import { redact } from '../../lib/automation-fix.js';
import { scrubOut } from '../../lib/keeper.js';
import { commentProblem } from '../../lib/comments.js';
import { SHARED_KEYS } from '../../lib/listgen.js';

export const DATA_MAX = 4096, WRITES_DAY = 5000, CONN_DAY = 300, ID_RE = /^[a-z2-7]{8}$/, KEY_RE = /^[A-Za-z_]\w{0,29}$/;
const json = (o, status = 200, extra = {}) => Response.json(o, { status, headers: { 'cache-control': 'no-store', ...extra } });
const off = () => json({ ok: false, error: 'shared data is off for now' }, 503);
const isSecret = (t) => redact(t) !== t || scrubOut(t) !== t;
let ready = null;
async function ensure(env) {
  if (!ready) ready = (async () => {
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS void_gen_data (id TEXT PRIMARY KEY, data TEXT NOT NULL, day TEXT NOT NULL, writes INTEGER NOT NULL)').run();
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS void_gen_data_days (k TEXT PRIMARY KEY, day TEXT NOT NULL, n INTEGER NOT NULL)').run();
  })().catch((e) => { ready = null; throw e; });
  await ready;
}
export const resetReady = () => { ready = null; };
const read = async (env, id) => { const r = await env.DB.prepare('SELECT data, day, writes FROM void_gen_data WHERE id = ?').bind(id).first(); let data = {}; try { data = r ? JSON.parse(r.data) : {}; } catch (_) { data = {}; } return { data, day: r && r.day, writes: r ? Number(r.writes) || 0 : 0 }; };
/** the data after the writes: { data } or { error }. Pure. */
export function applyWrites(data, writes, secret = isSecret) {
  const out = { ...(data || {}) };
  for (const w of (Array.isArray(writes) ? writes : []).slice(0, 5)) {
    const key = String((w && w.key) || ''); if (!KEY_RE.test(key) || key === '__proto__') return { error: 'a key is letters, digits and _' };
    if (!(key in out) && Object.keys(out).length >= SHARED_KEYS) return { error: 'a generator keeps at most ' + SHARED_KEYS + ' keys' };
    if (w.op === 'add') out[key] = Math.min(1e12, (typeof out[key] === 'number' ? out[key] : Number(out[key]) || 0) + 1);
    else if (w.op === 'set') { const v = String(w.value == null ? '' : w.value).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 200); const bad = v && commentProblem('', v, secret); if (bad) return { error: bad }; out[key] = v; }
    else return { error: 'a write is add or set' };
  }
  if (new TextEncoder().encode(JSON.stringify(out)).length > DATA_MAX) return { error: 'the shared data is full (' + DATA_MAX + ' bytes)' };
  return { data: out };
}
export async function onRequestGet({ request, env }) {
  if (!env || !env.DB) return off();
  const id = new URL(request.url).searchParams.get('id') || ''; if (!ID_RE.test(id)) return json({ ok: false, error: 'not a generator' }, 404);
  try { await ensure(env); return json({ ok: true, data: (await read(env, id)).data }); } catch (_) { return off(); }
}
export async function onRequestPost({ request, env }) {
  const here = new URL(request.url).origin, from = request.headers.get('origin');
  if (from && from !== here) return json({ ok: false, error: 'same-origin only' }, 403);
  if (!env || !env.DB || !env.SALT) return off();
  let b; try { b = JSON.parse((await request.text()).slice(0, 4000)); } catch (_) { return json({ ok: false, error: 'bad request' }, 400); }
  const id = String((b && b.id) || ''); if (!ID_RE.test(id)) return json({ ok: false, error: 'not a generator' }, 404);
  const day = dayOf(), conn = await clientKey(request.headers.get('cf-connecting-ip'), day, env.SALT);
  if ((await bump(here, 'gendata:c:' + conn)) > 20) return json({ ok: false, error: 'slow down' }, 429, { 'retry-after': '60' });
  try {
    await ensure(env);
    if (!(await env.DB.prepare('SELECT 1 FROM void_gens WHERE id = ? AND reports < 3').bind(id).first().catch(() => null))) return json({ ok: false, error: 'not a published generator' }, 404);
    const c = await env.DB.prepare('SELECT n FROM void_gen_data_days WHERE k = ? AND day = ?').bind(conn, day).first(); if (c && c.n >= CONN_DAY) return json({ ok: false, error: 'that is enough for today' }, 429, { 'retry-after': String(secondsToMidnight()) });
    const cur = await read(env, id), writesToday = cur.day === day ? cur.writes : 0;
    if (writesToday >= WRITES_DAY) return json({ ok: false, error: 'this generator\'s data is busy today' }, 429, { 'retry-after': String(secondsToMidnight()) });
    const r = applyWrites(cur.data, b.writes); if (r.error) return json({ ok: false, error: r.error }, 400);
    await env.DB.prepare('INSERT INTO void_gen_data (id, data, day, writes) VALUES (?, ?, ?, 1) ON CONFLICT(id) DO UPDATE SET data = excluded.data, writes = CASE WHEN day = excluded.day THEN writes + 1 ELSE 1 END, day = excluded.day').bind(id, JSON.stringify(r.data), day).run();
    await env.DB.prepare('INSERT INTO void_gen_data_days (k, day, n) VALUES (?, ?, 1) ON CONFLICT(k) DO UPDATE SET n = CASE WHEN day = excluded.day THEN n + 1 ELSE 1 END, day = excluded.day').bind(conn, day).run();
    return json({ ok: true, data: r.data });
  } catch (_) { return off(); }
}
export async function onRequestDelete({ request, env }) {
  if (!(await ownerOk(request, env))) return json({ ok: false, error: 'owner only' }, 401);
  const id = new URL(request.url).searchParams.get('id') || ''; if (!ID_RE.test(id)) return json({ ok: false, error: 'not a generator' }, 404);
  try { await ensure(env); await env.DB.prepare('DELETE FROM void_gen_data WHERE id = ?').bind(id).run(); return json({ ok: true }); } catch (_) { return off(); }
}
