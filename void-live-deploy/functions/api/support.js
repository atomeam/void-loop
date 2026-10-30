// The support desk: someone who pays can say "it broke" and get an answer (from a video the owner shared by Duncan Rogoff:
// people still pay for someone who answers when it breaks; owner, 2026-10-14: "Yes to all"). Paying users only: a Verse Pro
// key, a Code Review Pro license key or a paid Verse account's session (lib/paid-access.js, the same rule the review API uses),
// so no stranger can write here. What they write is masked for keys before it is kept (lib/automation-fix.js redact) and is
// read only by them and the owner. The owner sees the open reports on the status card and answers with POST { action: 'answer' }.
//   POST { what, where? }               (a paying credential) -> 201 { id, status: 'open', at, said }
//   GET                                 (a paying credential) -> { tickets: [{ id, at, where, what, status, answer, answered }] } their own, newest first
//   GET                                 (the owner)           -> { open, tickets } every ticket, open first
//   POST { action: 'answer', id, answer, status? }  (the owner) -> { ok, id, status }
import { bad, good, session, tierOf } from '../../lib/void-me.js';
import { ownerOk, ownerAccount } from '../../lib/guard.js';
import { redact } from '../../lib/automation-fix.js';
import { access } from '../../lib/paid-access.js';
import { BUY_URL } from '../../lib/review-api.js';

export const WHAT_MAX = 2000, ANSWER_MAX = 4000, OPEN_MAX = 20; // a reporter's open tickets at once
export const WHERE = ['review', 'action', 'account', 'site', 'other'];
const TABLE = 'CREATE TABLE IF NOT EXISTS void_support (id TEXT PRIMARY KEY, who TEXT NOT NULL, at TEXT NOT NULL, place TEXT NOT NULL, what TEXT NOT NULL, status TEXT NOT NULL, answer TEXT, answered TEXT)';
const made = new WeakMap();
const ready = (env) => { let p = made.get(env.DB); if (!p) { p = env.DB.prepare(TABLE).run().catch((e) => { made.delete(env.DB); throw e; }); made.set(env.DB, p); } return p; };
const ticketId = () => 'S-' + [...crypto.getRandomValues(new Uint8Array(4))].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
// Verse's own keys are masked too (redact() knows other services' keys): a Pro key vr1.… and a license key XXXXXXXX-XXXXXXXX-…
const OWN_KEYS = [/\bvr1\.[A-Za-z0-9_-]{43}\b/g, /\b[A-Z0-9]{8}(?:-[A-Z0-9]{8}){3}\b/gi];
export const clean = (t, max) => OWN_KEYS.reduce((x, re) => x.replace(re, '[redacted key]'), redact(String(t || '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ').trim())).slice(0, max);

/** who is asking: { owner: true } | { who } for someone who pays | null */
export { ownerAccount }; // the shared check (lib/guard.js), kept here for the routes that import it from support.js
export async function payer(request, env) {
  if (await ownerOk(request, env)) return { owner: true, who: 'owner' };
  const s = await session(request, env).catch(() => null); // a signed-in account first, so its token never reaches access()'s log as an unknown key
  // the owner is an account (functions/api/passkey.js ownerFor): a signed-in session of the account whose passkey was bound as the
  // owner's is the owner here too, so the owner gets in on any device already signed in (owner, 2026-10-15: "i need to be let
  // into the owners access", with the phone that holds the passkey dead)
  if (s && await ownerAccount(env, s.userId)) return { owner: true, who: 'owner' };
  if (s) return (await tierOf(env, s.userId)) === 'paid' ? { who: 'acct:' + s.userId } : null;
  const a = await access(request, env).catch(() => null);
  return a && a.tier === 'pro' && a.who ? { who: a.who } : null;
}

const notPaying = () => bad(401, 'the support desk is for people who pay for Verse: send your Verse Pro key, your Code Review Pro license key or a signed-in paid account as Bearer', { buy: BUY_URL });

export async function onRequestPost({ request, env }) {
  let b; try { b = JSON.parse(await request.text()); } catch (_) { return bad(400, 'bad json'); }
  const p = await payer(request, env);
  if (!p) return notPaying();
  await ready(env);
  if (b && b.action === 'answer') {
    if (!p.owner) return bad(403, 'only the owner answers');
    const answer = clean(b.answer, ANSWER_MAX), status = b.status === 'open' ? 'open' : 'answered';
    if (!answer || !/^S-[0-9A-F]{8}$/.test(String(b.id || ''))) return bad(400, 'send { action: "answer", id, answer }');
    const r = await env.DB.prepare('UPDATE void_support SET answer = ?, answered = ?, status = ? WHERE id = ?').bind(answer, new Date().toISOString(), status, b.id).run();
    if (r && r.meta && r.meta.changes === 0) return bad(404, 'no such ticket');
    return good({ ok: true, id: b.id, status });
  }
  const what = clean(b && b.what, WHAT_MAX);
  if (what.length < 3) return bad(400, 'say what broke in "what" (up to ' + WHAT_MAX + ' characters)');
  const place = WHERE.includes(b.where) ? b.where : 'other';
  const open = await env.DB.prepare("SELECT COUNT(*) AS n FROM void_support WHERE who = ? AND status = 'open'").bind(p.who).first();
  if (open && Number(open.n) >= OPEN_MAX) return bad(429, 'you have ' + OPEN_MAX + ' open reports; the owner answers them first');
  const id = ticketId(), at = new Date().toISOString();
  await env.DB.prepare('INSERT INTO void_support (id, who, at, place, what, status) VALUES (?, ?, ?, ?, ?, ?)').bind(id, p.who, at, place, what, 'open').run();
  return Response.json({ ok: true, id, status: 'open', at, said: 'Got it. The owner sees every report the same day and answers here: GET /api/support with the same key shows the answer.' }, { status: 201, headers: { 'cache-control': 'no-store' } });
}

export async function onRequestGet({ request, env }) {
  const p = await payer(request, env);
  if (!p) return notPaying();
  await ready(env);
  if (p.owner) {
    const { results } = await env.DB.prepare('SELECT id, at, place AS "where", what, status, answer, answered FROM void_support ORDER BY status = \'open\' DESC, at DESC LIMIT 100').all();
    const tickets = results || [];
    return good({ open: tickets.filter((t) => t.status === 'open').length, tickets });
  }
  const { results } = await env.DB.prepare('SELECT id, at, place AS "where", what, status, answer, answered FROM void_support WHERE who = ? ORDER BY at DESC LIMIT 20').bind(p.who).all();
  return good({ tickets: results || [] });
}
