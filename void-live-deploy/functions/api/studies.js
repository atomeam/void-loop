// The owner's study panel (/studies.html): GET /api/studies lists Verse's studies (private memory, kind "study"), ?id=<id> returns one
// digest, ?wants=1 the study-ready wants (tools/loop-study.mjs). Owner only (ownerOk), read only, never cached. Nothing here studies or
// fetches anything: studies run in tools/rea-study.mjs, passive only.
import { ownerOk } from '../../lib/guard.js';
import { ensure, search, byId } from '../../lib/memory-core.js';

const no = (s, m) => new Response(m, { status: s, headers: { 'cache-control': 'no-store' } });
export async function onRequestGet({ request, env }) {
  if (!(await ownerOk(request, env))) return no(401, 'no');
  if (!env.DB) return no(503, 'studies need the database');
  try {
    await ensure(env);
    const u = new URL(request.url), id = u.searchParams.get('id');
    const json = (b) => Response.json(b, { headers: { 'cache-control': 'no-store' } });
    if (id) { const r = await byId(env, id); return r && (r.kind === 'study' || r.kind === 'want') ? json({ study: r }) : no(404, 'no such study'); }
    const kind = u.searchParams.get('wants') ? 'want' : 'study';
    const rows = (await search(env, kind === 'want' ? 'study-ready' : 'study', 100, '')).filter((r) => r.kind === kind);
    return json({ [kind === 'want' ? 'wants' : 'studies']: rows.map((r) => ({ id: r.id, name: r.name, summary: r.summary, updated: r.updated, pending: /^pending /.test(r.summary || '') })) });
  } catch (_) { return no(500, 'studies error'); }
}
