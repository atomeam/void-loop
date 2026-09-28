export async function onRequestGet({ request: req, env }) {
  if (!env.READ_TOKEN || req.headers.get('authorization') !== 'Bearer ' + env.READ_TOKEN) return new Response('no', { status: 401 });
  const byAsk = new Map();
  const { results } = await env.DB.prepare('SELECT ask, count, first, last, fallback FROM void_misses').all();
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
  const out = [...byAsk.values()].sort((a, b) => b.count - a.count || (b.last > a.last ? 1 : -1));
  return Response.json(out);
}
