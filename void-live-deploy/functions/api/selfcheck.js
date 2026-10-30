// Verse's check of its own pages (lib/selfcheck.js): the newest report, kept in KV under one key.
//   GET                          -> { report } the newest report, or { report: null } before the first run. Public: it names only public pages
//                                   and what they did when opened; the status card reads it for everyone, and opens by itself for the owner.
//   POST { report } (the owner)  -> { ok, broken } tools/self-check.mjs after a deploy (.github/workflows/self-check.yml, VOID_OWNER_TOKEN).
// One KV write per report, so a day of deploys stays far under KV's free 1,000 writes. Nothing a visitor typed is ever kept here.
import { ownerOk } from '../../lib/guard.js';
import { cleanReport } from '../../lib/selfcheck.js';

export const KEY = 'selfcheck:last';
const json = (o, status = 200, cache = 'no-store') => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': cache } });

export async function onRequestGet({ env }) {
  if (!env.MISSES) return json({ report: null, note: 'no store bound' });
  const report = await env.MISSES.get(KEY, 'json').catch(() => null);
  return json({ report: report || null }, 200, 'public, max-age=60');
}

export async function onRequestPost({ request, env }) {
  if (!(await ownerOk(request, env))) return json({ error: 'owner only' }, 401);
  if (!env.MISSES) return json({ error: 'no store bound' }, 503);
  let body = null; try { body = JSON.parse(await request.text()); } catch (_) { body = null; }
  const report = cleanReport(body && body.report);
  if (!report) return json({ error: 'a report is needed: { report: { at, checked, pages: [...] } }' }, 400);
  await env.MISSES.put(KEY, JSON.stringify(report));
  return json({ ok: true, checked: report.checked, broken: report.broken });
}
