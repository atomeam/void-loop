// Verse Tube view counts (owner, 2026-10-15: "Verse should be its own version of YouTube"): one D1 row per film, one upsert per
// view (the page counts a film once per tab), no KV. GET ?ids=a,b -> { views: { a: 3 } }; POST ?id= -> { id, views }.
import { ID_RE } from './films.js';
const TABLE = 'CREATE TABLE IF NOT EXISTS void_film_views (id TEXT PRIMARY KEY, n INTEGER NOT NULL DEFAULT 0)';
const json = (b, s = 200) => Response.json(b, { status: s, headers: { 'cache-control': 'no-store' } });
export async function onRequestGet({ request, env }) {
  const ids = String(new URL(request.url).searchParams.get('ids') || '').split(',').filter((x) => ID_RE.test(x)).slice(0, 100);
  if (!env.DB || !ids.length) return json({ views: {} });
  await env.DB.prepare(TABLE).run();
  const { results } = await env.DB.prepare('SELECT id, n FROM void_film_views WHERE id IN (' + ids.map(() => '?').join(',') + ')').bind(...ids).all(); // void-review: ok (only '?' placeholders are pasted; ids are bound)
  return json({ views: Object.fromEntries((results || []).map((r) => [r.id, Number(r.n)])) });
}
export async function onRequestPost({ request, env }) {
  const id = new URL(request.url).searchParams.get('id') || '';
  if (!ID_RE.test(id)) return json({ error: 'send ?id=' }, 400);
  if (!env.DB) return json({ id, views: 0 });
  await env.DB.prepare(TABLE).run();
  const r = await env.DB.prepare('INSERT INTO void_film_views (id, n) VALUES (?, 1) ON CONFLICT(id) DO UPDATE SET n = n + 1 RETURNING n').bind(id).first();
  return json({ id, views: Number(r && r.n) || 1 });
}
