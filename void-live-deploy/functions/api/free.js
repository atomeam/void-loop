// GET /api/free: Verse's free-resource registry (resources/free.json) with today's live status from lib/free-router.js: which are
// reachable, how much of each daily share is used. Public, read-only; it says whether a key is set, never its value.
import { status } from '../../lib/free-router.js';

export async function onRequestGet({ request, env }) {
  let registry = null;
  try { const r = env && env.ASSETS ? await env.ASSETS.fetch(new Request(new URL('/resources/free.json', request.url))) : null; registry = r && r.ok ? await r.json() : null; } catch (_) {}
  if (!registry) return new Response(JSON.stringify({ error: 'registry unavailable' }), { status: 503, headers: { 'content-type': 'application/json; charset=utf-8' } });
  const rows = await status(registry, env || {});
  return new Response(JSON.stringify({ checked: registry.checked, rules: registry.rules, at: new Date().toISOString(), resources: rows }), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=60' } });
}
