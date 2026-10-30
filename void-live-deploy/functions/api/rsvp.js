// Replies to an invite (lib/rsvp.js has the rules).
//   POST   /api/rsvp                                   -> { ok, id, owner, reply }   an invite that can take replies (the organizer's page)
//   POST   /api/rsvp?id=&op=reply (x-cal-key: reply)   { name, answer }  -> { ok, replies }  yes, maybe or no, one per name
//   GET    /api/rsvp?id=          (x-cal-key: reply or owner)            -> { ok, replies, role }
//   DELETE /api/rsvp?id=          (x-cal-key: owner)                     -> { ok }   the replies cleared
//
// WHAT A STRANGER COULD MAKE THIS DO, AND WHY IT IS BOUNDED. Anyone may make an invite, and anyone holding an invite's link may reply.
//   - Store text: a name of 60 characters and one of three words per reply, at most 200 replies an invite (one per name), 300 replies a day and
//     50 invites a day from one connection, 5,000 invites a day in all, 30 requests a minute; an invite nobody opens for 400 days is deleted.
//   - Show text to people: a name, only to people holding that invite's link; the page draws it as text.
//   - Reply as someone else: anyone with the link can type any name, as on a paper sign-up sheet (Doodle and Teamup's sign-up work the same).
//     NOT PREVENTED: the organizer sees every reply with its time and can clear them; a reply is an answer to a friend, never a vote that decides.
//   - Read or change another invite: only with its key (ids 64 random bits, keys 128); keys are kept only as SHA-256 with the SALT.
// Same-origin writes only. No model, no KV, no third party. Without D1 or the SALT the route is off (503).
import { bump } from '../../lib/guard.js';
import { dayOf, secondsToMidnight, clientKey } from '../../lib/reactions.js';
import { newKey, newShareId, isId, isKey, hashKey } from '../../lib/calshare.js';
import { RSVP, parseReply, withReply } from '../../lib/rsvp.js';

const json = (o, status = 200, extra = {}) => Response.json(o, { status, headers: { 'cache-control': 'no-store', ...extra } });
const off = () => json({ ok: false, error: 'invite replies are off for now' }, 503);
const gone = () => json({ ok: false, error: 'no such invite' }, 404);
const slow = (secs) => json({ ok: false, error: 'slow down' }, 429, { 'retry-after': String(secs) });

let ready = null;
async function ensure(env) {
  if (!ready) ready = (async () => {
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS void_rsvp (id TEXT PRIMARY KEY, owner_h TEXT NOT NULL, reply_h TEXT NOT NULL, replies TEXT NOT NULL, created INTEGER NOT NULL, touched INTEGER NOT NULL)').run();
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS void_rsvp_days (k TEXT PRIMARY KEY, day TEXT NOT NULL, n INTEGER NOT NULL)').run(); // k: kind + a hashed client key, or kind + "all"; no address
  })().catch((e) => { ready = null; throw e; });
  await ready;
}
export const resetReady = () => { ready = null; }; // tests
const used = async (env, k, day) => { const r = await env.DB.prepare('SELECT n, day FROM void_rsvp_days WHERE k = ?').bind(k).first(); return r && r.day === day ? Number(r.n) || 0 : 0; };
const tick = (env, k, day) => env.DB.prepare('INSERT INTO void_rsvp_days (k, day, n) VALUES (?, ?, 1) ON CONFLICT(k) DO UPDATE SET n = CASE WHEN day = excluded.day THEN n + 1 ELSE 1 END, day = excluded.day').bind(k, day).run();

async function gate(request, env, write) {
  const here = new URL(request.url).origin, from = request.headers.get('origin');
  if (write && from && from !== here) return { stop: json({ ok: false, error: 'same-origin only' }, 403) };
  if (!env || !env.DB || !env.SALT) return { stop: off() };
  const day = dayOf(), who = await clientKey(request.headers.get('cf-connecting-ip'), day, env.SALT);
  if ((await bump(here, 'rsvp:' + who)) > RSVP.perMinute) return { stop: slow(60) };
  try { await ensure(env); } catch (_) { return { stop: off() }; }
  return { day, who };
}
async function open(env, request) {
  const id = new URL(request.url).searchParams.get('id') || '', key = request.headers.get('x-cal-key') || '';
  if (!isId(id) || !isKey(key)) return null;
  const row = await env.DB.prepare('SELECT * FROM void_rsvp WHERE id = ?').bind(id).first(); if (!row) return null;
  const h = await hashKey(key, env.SALT); const role = h === row.owner_h ? 'owner' : h === row.reply_h ? 'reply' : null;
  return role ? { row, role } : null;
}

export async function onRequestGet({ request, env }) {
  const g = await gate(request, env, false); if (g.stop) return g.stop;
  const o = await open(env, request); if (!o) return gone();
  return json({ ok: true, role: o.role, replies: JSON.parse(o.row.replies) });
}
export async function onRequestPost({ request, env }) {
  const g = await gate(request, env, true); if (g.stop) return g.stop;
  if (new URL(request.url).searchParams.get('op') === 'reply') {
    const o = await open(env, request); if (!o) return gone();
    if (await used(env, 'reply:' + g.who, g.day) >= RSVP.repliesPerDay) return slow(secondsToMidnight());
    const p = parseReply((await request.text()).slice(0, RSVP.body + 1)); if (!p.ok) return json({ ok: false, error: p.error }, p.status);
    const replies = withReply(JSON.parse(o.row.replies), p);
    await env.DB.prepare('UPDATE void_rsvp SET replies = ?, touched = ? WHERE id = ?').bind(JSON.stringify(replies), Date.now(), o.row.id).run();
    await tick(env, 'reply:' + g.who, g.day);
    return json({ ok: true, replies });
  }
  if (await used(env, 'new:' + g.who, g.day) >= RSVP.createsPerDay || await used(env, 'new:all', g.day) >= RSVP.allCreatesPerDay) return slow(secondsToMidnight());
  const now = Date.now(), id = newShareId(), owner = newKey(), reply = newKey();
  await env.DB.prepare('DELETE FROM void_rsvp WHERE id IN (SELECT id FROM void_rsvp WHERE touched < ? LIMIT 20)').bind(now - RSVP.idleDays * 864e5).run();
  await env.DB.prepare('INSERT INTO void_rsvp (id, owner_h, reply_h, replies, created, touched) VALUES (?, ?, ?, ?, ?, ?)').bind(id, await hashKey(owner, env.SALT), await hashKey(reply, env.SALT), '[]', now, now).run();
  await tick(env, 'new:' + g.who, g.day); await tick(env, 'new:all', g.day);
  return json({ ok: true, id, owner, reply });
}
export async function onRequestDelete({ request, env }) {
  const g = await gate(request, env, true); if (g.stop) return g.stop;
  const o = await open(env, request); if (!o || o.role !== 'owner') return gone();
  await env.DB.prepare('UPDATE void_rsvp SET replies = ?, touched = ? WHERE id = ?').bind('[]', Date.now(), o.row.id).run();
  return json({ ok: true });
}
