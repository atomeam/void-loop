// Void's memory: GET /api/memory?q=react&limit=20 · ?id=<record id> (with its stored digest) · ?ask=what did I build with react · ?view=topics · ?related=<record id> · POST { source, records: [...] } (up to 200) · DELETE /api/memory?id=...
// Owner token, or a paid member's session (their own memory only). Records come from tools such as tools/ouroboros.py (`ouroboros.py push`); each is validated and re-redacted
// (lib/memory-core.js), and the tables are created on first use. Without D1 this answers 503 and changes nothing.
import { scopeOf } from '../../lib/memory-scope.js';
import { ensure, upsert, search, ask, byId, topics, related, forget, MAX_BATCH, MAX_BODY, MEMBER_MAX } from '../../lib/memory-core.js';

// Who is asking, and whose memory that is: lib/memory-scope.js (owner, paid member, free account, stranger).
const guard = (fn) => async (ctx) => {
  const who = await scopeOf(ctx);
  if (!who) return new Response('no', { status: 401 });
  if (who.free) return new Response('Void memory is for the owner and paid members: ' + who.why, { status: 403 });
  if (!ctx.env.DB) return new Response('memory needs the database', { status: 503 });
  try { await ensure(ctx.env); return await fn(ctx, who.scope); } catch (_) { return new Response('memory error', { status: 500 }); }
};

export const onRequestGet = guard(async ({ request, env }, scope) => {
  const u = new URL(request.url);
  if (u.searchParams.get('view') === 'topics') return Response.json({ topics: await topics(env, scope) });
  if (u.searchParams.get('related')) {
    const rel = await related(env, u.searchParams.get('related'), u.searchParams.get('limit'), scope);
    return rel ? Response.json({ related: rel }) : new Response('no such record', { status: 404 });
  }
  if (u.searchParams.get('ask') != null) return Response.json(await ask(env, u.searchParams.get('ask'), u.searchParams.get('limit'), scope));
  if (u.searchParams.get('id')) return Response.json({ memory: await byId(env, u.searchParams.get('id'), scope) }); // exact record, with its sha256: what a client checks before it lets go of a source
  return Response.json({ memory: await search(env, u.searchParams.get('q'), u.searchParams.get('limit'), scope) });
});

export const onRequestPost = guard(async ({ request, env }, scope) => {
  const raw = await request.text();
  if (raw.length > MAX_BODY) return new Response('too large', { status: 413 });
  let b;
  try { b = JSON.parse(raw); } catch (_) { return new Response('bad json', { status: 400 }); }
  const records = Array.isArray(b && b.records) ? b.records : null;
  if (!records || records.length > MAX_BATCH) return new Response('send 1 to ' + MAX_BATCH + ' records', { status: 400 });
  const out = await upsert(env, records, scope ? 'member' : b.source, scope);
  return out.full ? new Response('your memory is full (' + MEMBER_MAX + ' projects)', { status: 413 }) : Response.json(out);
});

export const onRequestDelete = guard(async ({ request, env }, scope) => {
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return new Response('id?', { status: 400 });
  return Response.json({ removed: await forget(env, id, scope) });
});
