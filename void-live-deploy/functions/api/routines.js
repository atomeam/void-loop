// /api/routines — routines people offer to other Verses (lib/shared-routines.js). POST an offer: it waits, pending, for the
// owner. GET: the approved ones, { id, name, author, asks }. The owner (Bearer READ_TOKEN) reads what waits with ?pending=1
// and decides with POST { approve: id } or { reject: id }. Stored: the routine's name, its asks, the chosen display name, the
// state and the day; no IPs or browser details (the connection is hashed only for a 60s rate-limit window, as /api/miss).
import { ownerOk } from '../../lib/guard.js';
import { TABLE, MAX_SHOWN, cleanOffer, offerId } from '../../lib/shared-routines.js';
const RL_MAX = 5; // offers per connection per minute

const rows = (results) => (results || []).map((r) => ({ id: r.id, name: r.name, author: r.author, asks: JSON.parse(r.asks || '[]') }));

export async function onRequestGet({ request: req, env }) {
  try {
    await env.DB.prepare(TABLE).run();
    if (new URL(req.url).searchParams.get('pending')) {
      if (!(await ownerOk(req, env))) return new Response('no', { status: 401 });
      const { results } = await env.DB.prepare("SELECT id, name, author, asks FROM void_routines WHERE state = 'pending' ORDER BY at").all();
      return Response.json(rows(results));
    }
    const { results } = await env.DB.prepare("SELECT id, name, author, asks FROM void_routines WHERE state = 'approved' ORDER BY at DESC LIMIT ?").bind(MAX_SHOWN).all();
    return Response.json(rows(results));
  } catch (_) { return new Response('routines unavailable', { status: 503 }); }
}

export async function onRequestPost({ request: req, env }) {
  let body;
  try { body = JSON.parse((await req.text()).slice(0, 2000)); } catch (_) { return new Response('bad', { status: 400 }); }
  if (body && (body.approve || body.reject)) {
    if (!(await ownerOk(req, env))) return new Response('no', { status: 401 });
    const id = String(body.approve || body.reject).slice(0, 40);
    try {
      await env.DB.prepare(TABLE).run();
      const r = await env.DB.prepare("UPDATE void_routines SET state = ? WHERE id = ? AND state = 'pending'").bind(body.approve ? 'approved' : 'rejected', id).run();
      return Response.json({ ok: !!(r.meta && r.meta.changes) });
    } catch (_) { return new Response('routines unavailable', { status: 503 }); }
  }
  const o = cleanOffer(body);
  if (o.error) return Response.json({ error: o.error }, { status: 400 });
  try { // the edge cache (per colo), as /api/miss
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode((req.headers.get('cf-connecting-ip') || '') + (env.SALT || '')));
    const conn = [...new Uint8Array(b)].slice(0, 12).map((x) => x.toString(16).padStart(2, '0')).join('');
    const rl = new Request(new URL(req.url).origin + '/__void-routines/rl/' + conn);
    const n = parseInt((await (await caches.default.match(rl))?.text()) || '0', 10);
    if (n >= RL_MAX) return new Response('slow down', { status: 429 });
    await caches.default.put(rl, new Response(String(n + 1), { headers: { 'cache-control': 'max-age=60' } }));
  } catch (_) {}
  try {
    await env.DB.prepare(TABLE).run();
    await env.DB.prepare("INSERT INTO void_routines (id, name, author, asks, state, at) VALUES (?, ?, ?, ?, 'pending', ?) ON CONFLICT(id) DO NOTHING")
      .bind(await offerId(o), o.name, o.author, JSON.stringify(o.asks), new Date().toISOString().slice(0, 10)).run();
  } catch (_) { return new Response('routines unavailable', { status: 503 }); }
  return Response.json({ state: 'pending' }, { status: 202 });
}
