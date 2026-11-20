// Offer clicks, the revenue lane's measure (tools/revenue-lane.mjs, docs/money-playbook.md).
//   GET /api/buy?id=<product>&from=<slot.exp.variant>[&direct=1]   counts one click, then 302 to that product's hosted checkout
//                                                    (direct: straight to its payment form, Gumroad's documented ?wanted=true)
//   POST /api/buy?seen=<slot.exp.variant>                 counts one showing of an offer (the page's beacon)
//   GET /api/buy?stats=1&days=N                           the counts, per day, product and source (N 1..60)
// WHAT A STRANGER COULD MAKE THIS DO, AND WHY IT IS BOUNDED. No account, cookie or key. A caller can add 1 to a click or seen count
// for a source name that matches SRC, and only as a person (lib/visits.js classify: our tools and bots are not counted); 30 a minute
// from one connection (edge cache, lib/guard.js bump), 3,000 rows a day in all. The redirect goes only to the catalog's own checkout
// for a live product (the server picks the URL; `from` is never a URL), so it is not an open redirect. Nothing a caller sends is
// echoed except the integers and source names already counted. The counts can be pushed up by someone with many addresses: they
// steer which honest offer copy the lane keeps, never a price, a payment or money.
import { bump } from '../../lib/guard.js';
import { classify } from '../../lib/visits.js';
import { productOf, gumroadUrl } from '../../lib/store.js';
import { tablesReady } from '../../lib/db.js';

export const SRC = /^[a-z0-9-]{1,24}(\.[a-z0-9-]{1,32}){0,2}$/;
const ROWS_PER_DAY = 3000, PER_MINUTE = 30;
const ready = tablesReady(['CREATE TABLE IF NOT EXISTS void_buy (day TEXT NOT NULL, kind TEXT NOT NULL, id TEXT NOT NULL, src TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (day, kind, id, src))']);
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const day = () => new Date().toISOString().slice(0, 10);

/** the checkout a click goes to: the catalog's own link for a live, buyable product; null otherwise. Pure. */
export function checkoutFor(id, src, direct = false) {
  const p = productOf(String(id || ''));
  if (!p || p.soon || !p.gumroad || !p.cents) return null;
  return gumroadUrl(p, 'offer') + (SRC.test(src || '') ? '&utm_content=' + encodeURIComponent(src) : '') + (direct ? '&wanted=true' : '');
}

async function count(env, request, kind, id, src) {
  if (!env || !env.DB || !SRC.test(src || '')) return;
  if (classify({ ua: request.headers.get('user-agent') || '', test: request.headers.get('x-void-test') }) !== 'person') return;
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  if ((await bump(new URL(request.url).origin, 'buy:' + ip)) > PER_MINUTE) return;
  try {
    await ready(env);
    const d = day(), c = await env.DB.prepare('SELECT COUNT(*) AS c FROM void_buy WHERE day = ?').bind(d).first();
    if (c && Number(c.c) >= ROWS_PER_DAY) return;
    await env.DB.prepare('INSERT INTO void_buy (day, kind, id, src, n) VALUES (?,?,?,?,1) ON CONFLICT(day, kind, id, src) DO UPDATE SET n = n + 1').bind(d, kind, id, src).run();
  } catch (_) { /* a count that fails never blocks a buyer */ }
}

export async function onRequestGet({ request, env }) {
  const u = new URL(request.url), q = u.searchParams;
  if (q.get('stats')) {
    const n = Number(q.get('days') || 14), days = Number.isInteger(n) && n >= 1 && n <= 60 ? n : 14;
    if (!env || !env.DB) return json({ ok: false, error: 'the count is off for now' }, 503);
    try {
      await ready(env);
      const since = new Date(Date.now() - (days - 1) * 864e5).toISOString().slice(0, 10);
      const { results } = await env.DB.prepare('SELECT kind, id, src, SUM(n) AS n FROM void_buy WHERE day >= ? GROUP BY kind, id, src').bind(since).all();
      return json({ ok: true, since, rows: (results || []).map((r) => ({ kind: r.kind, id: r.id, src: r.src, n: Number(r.n) || 0 })) });
    } catch (_) { return json({ ok: false, error: 'the count is off for now' }, 503); }
  }
  const id = q.get('id'), src = q.get('from') || '', to = checkoutFor(id, src, q.get('direct') === '1');
  if (!to) return Response.redirect(u.origin + '/store/', 302);
  await count(env, request, 'click', id, src);
  return new Response(null, { status: 302, headers: { location: to, 'cache-control': 'no-store' } });
}

export async function onRequestPost({ request, env }) {
  const u = new URL(request.url), from = request.headers.get('origin');
  if (from && from !== u.origin) return json({ ok: false, error: 'same-origin only' }, 403);
  const src = u.searchParams.get('seen') || '', id = u.searchParams.get('id') || '';
  if (!SRC.test(src) || !productOf(id)) return json({ ok: false, error: 'not an offer' }, 400);
  await count(env, request, 'seen', id, src);
  return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
}
