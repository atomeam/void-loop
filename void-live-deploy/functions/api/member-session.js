// The members gate's cookie exchange (functions/_middleware.js, lib/member-gate.js).
// POST with a team member key (vt1…), a Verse account session, or a Gumroad license/order sets the signed HttpOnly
// verse_session cookie. GET says who the cookie belongs to (re-checked against D1). DELETE signs out.
// The key itself never goes in the cookie: only the member's id, name and trial end are in the signed payload.
import { SESSION_MS, signSession, readSession, cookieValue, sessionCookie, clearCookie, memberOk } from '../../lib/member-gate.js';
import { session, tierOf } from '../../lib/void-me.js';
import { whoIs, joinMember } from './team.js';

const json = (body, status = 200, extra = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...extra } });

async function issue(env, p) {
  const secret = env.SESSION_KEY || env.SALT;
  if (!secret) return json({ ok: false, error: 'membership is not configured yet' }, 503);
  const until = Number(p.until) || 0;
  const token = await signSession({ v: 1, k: p.k, id: p.id, name: p.name || 'member', until, exp: Date.now() + SESSION_MS }, secret);
  return json({ ok: true, signedIn: true, kind: p.k, name: p.name || 'member', until }, 200, { 'set-cookie': sessionCookie(token) });
}

export async function onRequestGet({ request, env }) {
  const secret = env.SESSION_KEY || env.SALT;
  if (!secret) return json({ ok: false, signedIn: false, error: 'membership is not configured yet' }, 503);
  const payload = await readSession(cookieValue(request), secret).catch(() => null);
  if (!payload || !(await memberOk(payload, env))) return json({ ok: false, signedIn: false }, 401);
  return json({ ok: true, signedIn: true, kind: payload.k, name: payload.name || 'member', until: Number(payload.until) || 0 });
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ ok: false, error: 'storage not bound' }, 503);
  if (!(env.SESSION_KEY || env.SALT)) return json({ ok: false, error: 'membership is not configured yet' }, 503);
  // 1. a team member key, or the owner's own session
  const me = await whoIs(request, env).catch(() => null);
  if (me && me.kind === 'owner') return issue(env, { k: 'owner', id: 'owner', name: 'Owner', until: 0 });
  if (me && me.kind === 'agent' && me.agent && me.agent.role === 'member' && !me.agent.off) return issue(env, { k: 'team', id: me.agent.id, name: me.agent.name, until: me.agent.until });
  // 2. a signed-in Verse account with a paid tier (MultiVerse and the store's account products)
  const acct = await session(request, env).catch(() => null);
  if (acct) {
    const tier = await tierOf(env, acct.userId).catch(() => null);
    if (tier === 'paid') return issue(env, { k: 'acct', id: acct.userId, name: 'Verse member', until: 0 });
  }
  // 3. a Gumroad license key or order (the join screen's $1 trial and the store products)
  let b = {};
  try { b = JSON.parse((await request.text()).slice(0, 4000)) || {}; } catch (_) { b = {}; }
  if (b && (b.key || b.license || b.order)) {
    const r = await joinMember(env, { ...b, product: b.product || 'join-the-team' }).catch(() => ({ ok: false, status: 503, say: 'the membership desk is unavailable just now' }));
    if (!r.ok) return json({ ok: false, error: r.say || 'that did not join' }, r.status || 400);
    return issue(env, { k: 'team', id: r.id, name: r.name, until: r.until });
  }
  return json({ ok: false, error: 'sign in with a member key, a Verse sign-in, or the license key from your Gumroad receipt' }, 401);
}

export async function onRequestDelete() {
  return json({ ok: true, signedIn: false }, 200, { 'set-cookie': clearCookie() });
}
