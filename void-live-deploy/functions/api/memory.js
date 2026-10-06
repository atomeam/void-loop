// Void's memory: GET /api/memory?q=react&limit=20 · ?id=<record id> (with its stored digest) · ?view=topics · ?related=<record id> · POST { source, records: [...] } (up to 200) · DELETE /api/memory?id=...
// Owner token only. Records come from tools such as tools/ouroboros.py (`ouroboros.py push`); each is validated and re-redacted
// (lib/memory-core.js), and the tables are created on first use. Without D1 this answers 503 and changes nothing.
import { ownerOk } from '../../lib/guard.js';
import { ensure, upsert, search, byId, topics, related, forget, MAX_BATCH, MAX_BODY } from '../../lib/memory-core.js';

const guard = (fn) => async (ctx) => {
  if (!(await ownerOk(ctx.request, ctx.env))) return new Response('no', { status: 401 });
  if (!ctx.env.DB) return new Response('memory needs the database', { status: 503 });
  try { await ensure(ctx.env); return await fn(ctx); } catch (_) { return new Response('memory error', { status: 500 }); }
};

export const onRequestGet = guard(async ({ request, env }) => {
  const u = new URL(request.url);
  if (u.searchParams.get('view') === 'topics') return Response.json({ topics: await topics(env) });
  if (u.searchParams.get('related')) {
    const rel = await related(env, u.searchParams.get('related'), u.searchParams.get('limit'));
    return rel ? Response.json({ related: rel }) : new Response('no such record', { status: 404 });
  }
  if (u.searchParams.get('id')) return Response.json({ memory: await byId(env, u.searchParams.get('id')) }); // exact record, with its sha256: what a client checks before it lets go of a source
  return Response.json({ memory: await search(env, u.searchParams.get('q'), u.searchParams.get('limit')) });
});

export const onRequestPost = guard(async ({ request, env }) => {
  const raw = await request.text();
  if (raw.length > MAX_BODY) return new Response('too large', { status: 413 });
  let b;
  try { b = JSON.parse(raw); } catch (_) { return new Response('bad json', { status: 400 }); }
  const records = Array.isArray(b && b.records) ? b.records : null;
  if (!records || records.length > MAX_BATCH) return new Response('send 1 to ' + MAX_BATCH + ' records', { status: 400 });
  return Response.json(await upsert(env, records, b.source));
});

export const onRequestDelete = guard(async ({ request, env }) => {
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return new Response('id?', { status: 400 });
  return Response.json({ removed: await forget(env, id) });
});
