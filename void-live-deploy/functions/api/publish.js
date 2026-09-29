// Publish your Void at a-to-mind.com/@name (paid Voids; the tier is checked here, never trusted from the page).
// GET    (Bearer session)                  -> { handle | null }
// POST   (Bearer session) { handle, look, cards } -> { ok, handle, url } | 401 not signed in | 402 not paid | 400 bad handle | 409 taken
// DELETE (Bearer session)                  -> { ok } (the page is gone; the handle is free again)
import { ensureTables, bad, good, session, tierOf } from '../../lib/void-me.js';
import { ensurePages, cleanPage, HANDLE_RE, RESERVED } from '../../lib/pages.js';

async function who(request, env) {
  await ensureTables(env); await ensurePages(env);
  return session(request, env);
}
export async function onRequestGet({ request, env }) {
  try {
    const me = await who(request, env);
    if (!me) return bad(401, 'not signed in');
    const row = await env.DB.prepare('SELECT handle FROM void_pages WHERE user_id = ?').bind(me.userId).first();
    return good({ handle: row ? row.handle : null });
  } catch (_) { return bad(503, 'publishing unavailable'); }
}
export async function onRequestPost({ request, env }) {
  let b; try { b = JSON.parse(await request.text()); } catch (_) { return bad(400, 'bad json'); }
  const handle = String((b && b.handle) || '').toLowerCase().replace(/^@/, '');
  if (!HANDLE_RE.test(handle)) return bad(400, 'a name is 3-24 letters, numbers or _');
  if (RESERVED.has(handle)) return bad(409, 'that name is taken');
  const data = JSON.stringify(cleanPage(b));
  try {
    const me = await who(request, env);
    if (!me) return bad(401, 'not signed in');
    if ((await tierOf(env, me.userId)) !== 'paid') return bad(402, 'publishing is part of a paid Void');
    const owner = await env.DB.prepare('SELECT user_id FROM void_pages WHERE handle = ?').bind(handle).first();
    if (owner && owner.user_id !== me.userId) return bad(409, 'that name is taken');
    const now = new Date().toISOString();
    // one page per Void: moving to a new name frees the old one
    await env.DB.batch([
      env.DB.prepare('DELETE FROM void_pages WHERE user_id = ? AND handle <> ?').bind(me.userId, handle),
      env.DB.prepare('INSERT INTO void_pages (handle, user_id, data, updated) VALUES (?, ?, ?, ?) ON CONFLICT(handle) DO UPDATE SET data = excluded.data, updated = excluded.updated WHERE void_pages.user_id = excluded.user_id').bind(handle, me.userId, data, now),
    ]);
    const mine = await env.DB.prepare('SELECT user_id FROM void_pages WHERE handle = ?').bind(handle).first();
    if (!mine || mine.user_id !== me.userId) return bad(409, 'that name is taken');
    return good({ ok: true, handle, url: new URL(request.url).origin + '/@' + handle, updated: now });
  } catch (_) { return bad(503, 'publishing unavailable'); }
}
export async function onRequestDelete({ request, env }) {
  try {
    const me = await who(request, env);
    if (!me) return bad(401, 'not signed in');
    await env.DB.prepare('DELETE FROM void_pages WHERE user_id = ?').bind(me.userId).run();
    return good({ ok: true });
  } catch (_) { return bad(503, 'publishing unavailable'); }
}
