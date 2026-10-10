// The execution record (lib/actions.js): GET -> { actions } newest first, owner token only. ?limit=N (up to 500),
// ?offset=N to skip the newest N (the card's Show more), ?owner=... to filter by who an action was for.
// Nothing here takes an action; it only shows what Void did.
// POST (owner only) writes the record of an action the Void extension takes in the owner's tab (B3), which can't run inside
// track(): { op: 'begin', kind, ref } -> { id } (running, before the action); { op: 'end', id, state: 'done' | 'failed', text };
// { op: 'stub', kind, ref, text } (the owner said no: nothing happened). Only extension.* kinds: the server's own actions
// keep writing their records through track(), and nothing posted here can pose as one of them.
import { ownerOk } from '../../lib/guard.js';
import { recent, open, close } from '../../lib/actions.js';
import { scopeOf } from '../../lib/memory-scope.js';
import { recordScene } from '../../lib/scene-advance.js';

export async function onRequestGet({ request, env }) {
  if (!(await ownerOk(request, env))) { // a paid member reads only their own records (scene.advance: what happened to their stage while they were away)
    const sc = await scopeOf({ request, env });
    if (!sc || sc.free) return new Response('no', { status: sc && sc.free ? 403 : 401 });
    if (!env.DB) return new Response('no database', { status: 503 });
    const u = new URL(request.url);
    try { return Response.json({ actions: await recent(env, { limit: u.searchParams.get('limit'), offset: u.searchParams.get('offset'), owner: 'member:' + sc.scope }) }); }
    catch (_) { return new Response('actions error', { status: 500 }); }
  }
  if (!env.DB) return new Response('no database', { status: 503 });
  const u = new URL(request.url);
  try { return Response.json({ actions: await recent(env, { limit: u.searchParams.get('limit'), offset: u.searchParams.get('offset'), owner: u.searchParams.get('owner') || undefined }) }); }
  catch (_) { return new Response('actions error', { status: 500 }); }
}

export const EXT_KIND = /^extension\.[a-z]{2,20}$/;
export async function onRequestPost({ request, env }) {
  const isOwner = await ownerOk(request, env);
  let b; try { b = await request.json(); } catch (_) { return isOwner ? Response.json({ error: 'not JSON' }, { status: 400 }) : new Response('no', { status: 401 }); }
  if (b && b.op === 'scene') { // the owner's or a paid member's stage, written in their own scope only (lib/scene-advance.js)
    const sc = await scopeOf({ request, env });
    if (!sc) return new Response('no', { status: 401 });
    if (sc.free) return Response.json({ error: sc.why }, { status: 403 });
    if (!env.DB) return new Response('no database', { status: 503 });
    try { const r = await recordScene(env, sc, b); return r.id ? Response.json({ id: r.id }) : Response.json({ error: r.error }, { status: r.status }); }
    catch (_) { return new Response('actions error', { status: 500 }); }
  }
  if (!isOwner) return new Response('no', { status: 401 });
  if (!env.DB) return new Response('no database', { status: 503 });
  const op = b && b.op, text = String((b && b.text) || '').slice(0, 500);
  try {
    if (op === 'begin' || op === 'stub') {
      if (!EXT_KIND.test(String(b.kind || ''))) return Response.json({ error: 'only extension.* records are written here' }, { status: 400 });
      const rec = await open(env, { owner: 'owner', kind: b.kind, ref: String(b.ref || '').slice(0, 200) || null });
      if (op === 'begin') return Response.json({ id: rec.id, state: rec.state });
      const done = await close(env, rec.id, 'stubbed', text || 'the owner said no; nothing happened');
      return Response.json({ id: done.id, state: done.state });
    }
    if (op === 'end') {
      if (b.state !== 'done' && b.state !== 'failed') return Response.json({ error: 'state is done or failed' }, { status: 400 });
      const row = await env.DB.prepare('SELECT kind FROM void_actions WHERE id = ?').bind(String(b.id || '')).first();
      if (!row || !EXT_KIND.test(row.kind)) return Response.json({ error: 'no such extension record' }, { status: 404 });
      const rec = await close(env, b.id, b.state, text || b.state);
      return Response.json({ id: rec.id, state: rec.state });
    }
    return Response.json({ error: 'op is begin, end or stub' }, { status: 400 });
  } catch (e) { return Response.json({ error: String((e && e.message) || e).slice(0, 200) }, { status: 409 }); }
}
