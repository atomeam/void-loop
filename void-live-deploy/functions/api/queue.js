// Void's build queue (D1): the owner asks Void to update itself; the laptop builder picks it up.
// GET -> { items, heartbeat } · POST { ask, target } · PATCH { id?, state?, note?, heartbeat? } — all owner token.
import { ownerOk } from '../../lib/guard.js';
const ok = ownerOk; // constant-time, fails closed without READ_TOKEN (lib/guard.js)
const view = async (env) => {
  const { results } = await env.DB.prepare('SELECT * FROM void_queue ORDER BY at DESC LIMIT 20').all();
  const hb = await env.DB.prepare("SELECT v FROM void_kv WHERE k = 'heartbeat'").first('v');
  return { items: results.reverse().map((r) => ({ ...r, note: r.note || '' })), heartbeat: hb || null };
};
const body = async (req) => { try { return JSON.parse(await req.text()); } catch (_) { return {}; } };
const guard = (fn) => async (ctx) => {
  if (!(await ok(ctx.request, ctx.env))) return new Response('no', { status: 401 });
  try { return await fn(ctx); } catch (e) { return new Response('queue error', { status: 500 }); }
};

export const onRequestGet = guard(async ({ env }) => Response.json(await view(env)));

// Wake the on-request builder the moment a job is queued (secrets set in the Pages project:
// BUILDER_WEBHOOK_URL, BUILDER_WEBHOOK_KEY). Without them, scheduled builder runs pick the job up.
function wakeBuilder(ctx, item) {
  const { env } = ctx;
  if (!env.BUILDER_WEBHOOK_URL) return;
  const headers = { 'content-type': 'application/json' };
  if (env.BUILDER_WEBHOOK_KEY) { headers.authorization = 'Bearer ' + env.BUILDER_WEBHOOK_KEY; headers['x-webhook-key'] = env.BUILDER_WEBHOOK_KEY; }
  ctx.waitUntil(fetch(env.BUILDER_WEBHOOK_URL, { method: 'POST', headers, body: JSON.stringify({ source: 'void', item }) })
    .then((r) => ctx.env.DB.prepare('UPDATE void_queue SET note = ? WHERE id = ? AND state = ?').bind(r.ok ? 'builder woken' : 'builder wake failed ' + r.status, item.id, 'queued').run())
    .catch(() => {}));
}

export const onRequestPost = guard(async (ctx) => {
  const { request, env } = ctx;
  const b = await body(request);
  const ask = String(b.ask || '').slice(0, 200), target = String(b.target || 'next').slice(0, 40);
  const open = await env.DB.prepare("SELECT * FROM void_queue WHERE target = ? AND state IN ('queued','building') LIMIT 1").bind(target).first();
  if (open) return Response.json({ item: open, ...(await view(env)) });
  const item = { id: Date.now().toString(36), ask, target, state: 'queued', note: '', at: new Date().toISOString() };
  await env.DB.prepare('INSERT INTO void_queue (id, ask, target, state, note, at, updated) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(item.id, ask, target, 'queued', '', item.at, item.at).run();
  wakeBuilder(ctx, item);
  return Response.json({ item, ...(await view(env)) });
});

export const onRequestPatch = guard(async ({ request, env }) => {
  const b = await body(request), now = new Date().toISOString();
  if (b.heartbeat) await env.DB.prepare("INSERT INTO void_kv (k, v) VALUES ('heartbeat', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").bind(now).run();
  if (b.id) {
    const r = await env.DB.prepare('UPDATE void_queue SET state = COALESCE(?, state), note = COALESCE(?, note), updated = ? WHERE id = ?')
      .bind(b.state ? String(b.state).slice(0, 20) : null, b.note ? String(b.note).slice(0, 300) : null, now, String(b.id)).run();
    if (!r.meta.changes) return new Response('not found', { status: 404 });
  }
  return Response.json(await view(env));
});
