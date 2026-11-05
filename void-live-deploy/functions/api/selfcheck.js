// Verse's check of its own pages (lib/selfcheck.js): the newest report, kept in the edge cache (caches.default), not KV.
//   GET                          -> { report } the newest report, or { report: null } before the first run. Public: it names only public pages
//                                   and what they did when opened; the status card reads it for everyone, and opens by itself for the owner.
//   POST { report } (the owner)  -> { ok, broken } tools/self-check.mjs after a deploy (.github/workflows/self-check.yml, VOID_OWNER_TOKEN).
// A day of deploys is a handful of edge writes. KV stays read-only. Nothing a visitor typed is ever kept here.
import { ownerOk } from '../../lib/guard.js';
import { cleanReport } from '../../lib/selfcheck.js';

export const KEY = 'https://a-to-mind.com/__selfcheck/last';
const json = (o, status = 200, cache = 'no-store') => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': cache } });
const edge = () => (typeof caches !== 'undefined' && caches && caches.default) || null;

export async function onRequestGet() {
  const cache = edge();
  if (!cache) return json({ report: null, note: 'no store bound' });
  const hit = await cache.match(KEY).catch(() => null);
  const report = hit ? await hit.json().catch(() => null) : null;
  return json({ report: report || null }, 200, 'public, max-age=60');
}

export async function onRequestPost({ request, env }) {
  if (!(await ownerOk(request, env))) return json({ error: 'owner only' }, 401);
  const cache = edge();
  if (!cache) return json({ error: 'no store bound' }, 503);
  let body = null; try { body = JSON.parse(await request.text()); } catch (_) { body = null; }
  const report = cleanReport(body && body.report);
  if (!report) return json({ error: 'a report is needed: { report: { at, checked, pages: [...] } }' }, 400);
  await cache.put(KEY, new Response(JSON.stringify(report), { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=86400' } }));
  return json({ ok: true, checked: report.checked, broken: report.broken });
}
