// Void's build queue (D1): the owner asks Void to update itself; the laptop builder picks it up.
// GET -> { items, heartbeat } · POST { ask, target } · PATCH { id?, state?, note?, heartbeat? } — all owner token.
import { ownerOk } from '../../lib/guard.js';
import { track } from '../../lib/actions.js';
import { draftOnClaim } from '../../lib/job-draft.js';
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
  // its execution record (lib/actions.js): builder.wake, done or failed with the builder's answer
  ctx.waitUntil(track(env, { owner: 'owner', kind: 'builder.wake', ref: item.id }, async () => {
    const r = await fetch(env.BUILDER_WEBHOOK_URL, { method: 'POST', headers, body: JSON.stringify({ source: 'void', item }) });
    await ctx.env.DB.prepare('UPDATE void_queue SET note = ? WHERE id = ? AND state = ?').bind(r.ok ? 'builder woken' : 'builder wake failed ' + r.status, item.id, 'queued').run();
    if (!r.ok) throw new Error('the builder answered ' + r.status);
    return 'builder woken';
  }).catch(() => {}));
}

export const onRequestPost = guard(async (ctx) => {
  const { request, env } = ctx;
  const b = await body(request);
  const ask = String(b.ask || '').slice(0, 200), target = String(b.target || 'next').slice(0, 40);
  const open = await env.DB.prepare("SELECT * FROM void_queue WHERE target = ? AND state IN ('queued','building') LIMIT 1").bind(target).first();
  if (open) return Response.json({ item: open, ...(await view(env)) });
  const item = { id: Date.now().toString(36), ask, target, state: 'queued', note: '', at: new Date().toISOString() };
  // the execution record (lib/actions.js): written before the job is queued; no record, no job
  await track(env, { owner: 'owner', kind: 'queue.add', ref: target }, async () => {
    await env.DB.prepare('INSERT INTO void_queue (id, ask, target, state, note, at, updated) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(item.id, ask, target, 'queued', '', item.at, item.at).run();
    return 'queued ' + item.id + ': ' + ask;
  });
  wakeBuilder(ctx, item);
  return Response.json({ item, ...(await view(env)) });
});

export const onRequestPatch = guard(async ({ request, env }) => {
  const b = await body(request), now = new Date().toISOString();
  if (b.heartbeat) await env.DB.prepare("INSERT INTO void_kv (k, v) VALUES ('heartbeat', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").bind(now).run();
  const state = b.state ? String(b.state).slice(0, 20) : null, note = b.note ? String(b.note).slice(0, 300) : null;
  // a claim: { target | id, state: 'building', from: 'queued' } moves the job only if it is still in `from`, in one statement,
  // so of two builders claiming at once exactly one gets it; the other is told who holds it (409) or that there is none (404)
  if (b.from && (b.target || b.id)) {
    const from = String(b.from).slice(0, 20), target = b.target ? String(b.target).slice(0, 40) : null;
    // the claimer is named at the front of the note, keeping what the note already said (a miss job's counts, say)
    const by = b.by ? String(b.by).slice(0, 60) : null;
    const r = await env.DB.prepare(target
      ? "UPDATE void_queue SET state = COALESCE(?, state), note = CASE WHEN ? IS NULL THEN COALESCE(?, note) ELSE substr('claimed by ' || ? || CASE WHEN COALESCE(note, '') = '' THEN '' ELSE ' · ' || note END, 1, 300) END, updated = ? WHERE id = (SELECT id FROM void_queue WHERE target = ? AND state = ? ORDER BY at LIMIT 1)"
      : "UPDATE void_queue SET state = COALESCE(?, state), note = CASE WHEN ? IS NULL THEN COALESCE(?, note) ELSE substr('claimed by ' || ? || CASE WHEN COALESCE(note, '') = '' THEN '' ELSE ' · ' || note END, 1, 300) END, updated = ? WHERE id = ? AND state = ?")
      .bind(state, by, note, by, now, target || String(b.id), from).run();
    const row = target ? await env.DB.prepare('SELECT * FROM void_queue WHERE target = ? ORDER BY updated DESC LIMIT 1').bind(target).first()
      : await env.DB.prepare('SELECT * FROM void_queue WHERE id = ?').bind(String(b.id)).first();
    if (!r.meta.changes) return row ? Response.json({ held: row }, { status: 409 }) : new Response('not found', { status: 404 });
    // a claimed serve job carrying a buyer's reply drafts its own proposal (lib/job-draft.js); a draft failure
    // never breaks the claim — the claimer is told either way in the same reply
    let draft = '';
    try { draft = await draftOnClaim(env, row); } catch (e) { draft = 'no draft: ' + ((e && e.message) || String(e)); }
    return Response.json({ claimed: row, ...(draft ? { draft } : {}), ...(await view(env)) });
  }
  if (b.id) {
    const r = await env.DB.prepare('UPDATE void_queue SET state = COALESCE(?, state), note = COALESCE(?, note), updated = ? WHERE id = ?')
      .bind(state, note, now, String(b.id)).run();
    if (!r.meta.changes) return new Response('not found', { status: 404 });
  }
  return Response.json(await view(env));
});
