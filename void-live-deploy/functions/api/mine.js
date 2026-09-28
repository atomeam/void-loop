// Your Void follows you (plan item 6): the owner's stage, look and kept cards, kept server-side per passkey account.
// GET  (Bearer session) -> { data, rev, updated }   (data null until the first sync)
// PUT  (Bearer session) { data, baseRev } -> { rev, updated } | 409 { data, rev, updated } when another device wrote first
// data = { v, state, look, entered }: stored as JSON, never interpreted here; the page cleans it before showing it.
// Writes are lean on purpose (D1 free-tier daily limits): the page only sends when something changed, debounced.
import { ensureTables, bad, good, session, MAX_DATA } from '../../lib/void-me.js';

export async function onRequestGet({ request, env }) {
  try {
    await ensureTables(env);
    const me = await session(request, env);
    if (!me) return bad(401, 'not signed in');
    const row = await env.DB.prepare('SELECT data, rev, updated FROM void_mine WHERE user_id = ?').bind(me.userId).first();
    return good(row ? { data: JSON.parse(row.data), rev: Number(row.rev), updated: row.updated } : { data: null, rev: 0, updated: null });
  } catch (_) { return bad(503, 'sync unavailable'); }
}

export async function onRequestPut({ request, env }) {
  const text = await request.text();
  if (text.length > MAX_DATA + 200) return bad(413, 'too big to sync');
  let b;
  try { b = JSON.parse(text); } catch (_) { return bad(400, 'bad json'); }
  const d = b && b.data;
  if (!d || typeof d !== 'object' || Array.isArray(d) || typeof d.state !== 'object' || !d.state || Array.isArray(d.state) || typeof d.look !== 'object' || !d.look || Array.isArray(d.look)) return bad(400, 'data should be { state, look }');
  const data = JSON.stringify({ v: 1, state: d.state, look: d.look, entered: typeof d.entered === 'string' ? d.entered.slice(0, 40) : null });
  if (data.length > MAX_DATA) return bad(413, 'too big to sync');
  const baseRev = Math.max(0, Math.floor(Number(b.baseRev) || 0));
  try {
    await ensureTables(env);
    const me = await session(request, env);
    if (!me) return bad(401, 'not signed in');
    const now = new Date().toISOString();
    const res = baseRev === 0
      ? await env.DB.prepare('INSERT INTO void_mine (user_id, data, rev, updated) VALUES (?, ?, 1, ?) ON CONFLICT(user_id) DO NOTHING').bind(me.userId, data, now).run()
      : await env.DB.prepare('UPDATE void_mine SET data = ?, rev = rev + 1, updated = ? WHERE user_id = ? AND rev = ?').bind(data, now, me.userId, baseRev).run();
    if (res.meta && res.meta.changes === 1) return good({ ok: true, rev: baseRev + 1, updated: now });
    const row = await env.DB.prepare('SELECT data, rev, updated FROM void_mine WHERE user_id = ?').bind(me.userId).first();
    return bad(409, 'another device wrote first', row ? { data: JSON.parse(row.data), rev: Number(row.rev), updated: row.updated } : { data: null, rev: 0 });
  } catch (_) { return bad(503, 'sync unavailable'); }
}
export const onRequestPost = onRequestPut;
