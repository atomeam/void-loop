import { ownerOk } from '../../lib/guard.js';
import { mergeMisses } from '../../lib/misskey.js';
import { readUse } from '../../lib/used.js';
export async function onRequestGet({ request: req, env }) {
  if (!(await ownerOk(req, env))) return new Response('no', { status: 401 });
  // ?used=1: how often each lab experiment was opened in the last 30 days (lib/used.js), for tools/lab-use.mjs
  if (new URL(req.url).searchParams.get('used')) {
    try { return Response.json({ used: await readUse(env, new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10)) }); }
    catch (_) { return new Response('use count unavailable', { status: 503 }); }
  }
  const byAsk = new Map();
  let results;
  try { ({ results } = await env.DB.prepare('SELECT ask, count, first, last, fallback, agent FROM void_misses').all()); } // agent: added when the first agent miss arrives
  catch (_) { ({ results } = await env.DB.prepare('SELECT ask, count, first, last, fallback FROM void_misses').all()); }
  for (const r of results) byAsk.set(r.ask, r);
  // older rows still in KV (read-only now) until they expire
  try {
    let cursor;
    do {
      const page = await env.MISSES.list({ prefix: 'm:', cursor });
      for (const k of page.keys) {
        const v = JSON.parse((await env.MISSES.get(k.name)) || 'null'); if (!v) continue;
        const d = byAsk.get(v.ask);
        if (!d) byAsk.set(v.ask, v);
        else byAsk.set(v.ask, { ...d, count: d.count + v.count, first: v.first < d.first ? v.first : d.first, last: v.last > d.last ? v.last : d.last });
      }
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
  } catch (_) {}
  const out = mergeMisses([...byAsk.values()]).sort((a, b) => b.count - a.count || (b.last > a.last ? 1 : -1));
  return Response.json(out);
}
