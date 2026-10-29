// A whole calendar shared by link with view or edit rights, no account (lib/calshare.js has the rules and the shape).
//   POST   /api/calshare               { name, color, events }            -> { ok, id, owner, edit, view, rev }   share a calendar
//   GET    /api/calshare?id=  (x-cal-key)                                -> { ok, role, name, color, events, rev } open it
//   PUT    /api/calshare?id=  (x-cal-key: edit or owner) { name, color, events, rev } -> { ok, rev } | 409 { ok:false, ...current } change it
//   POST   /api/calshare?id=&op=reset  (x-cal-key: owner)                -> { ok, edit, view }                    new links, the old ones stop
//   DELETE /api/calshare?id=  (x-cal-key: owner)                          -> { ok }                                stop sharing
//
// WHAT A STRANGER COULD MAKE THIS DO, AND WHY IT IS BOUNDED. Anyone may share a calendar, and anyone holding a link may read or change what it opens.
//   - Store text: a calendar document is at most 200 KB and 1,000 events, each one cut to the calendar's own shape (a title of 200 characters, notes
//     of 5,000, emails that look like emails; lib/calendar.js normalize); 20 new calendars a day from one connection and 2,000 a day in all, 600
//     changes a day from one connection, 30 requests a minute (the edge cache, lib/guard.js bump). A calendar nobody opens or changes for 400 days
//     is deleted. The table can hold at most about 2,000 x 200 KB of new text a day: it is free storage for whoever wants it, BOUNDED, NOT PREVENTED.
//   - Show text to people: only to people holding that calendar's link (there is no list, no search, no public page); the page draws it as text,
//     never as HTML.
//   - Read or change someone's calendar: only with its key. Ids are 64 random bits and keys 128; a wrong id and a wrong key are the same 404, and
//     the minute limit makes guessing hopeless. Keys are kept only as SHA-256 with the SALT secret, so the table opens nothing; the owner's reset
//     makes old links dead at once.
//   - Lose someone's changes: a change says which version it started from (rev); a stale one is refused with the current calendar (409).
// Same-origin writes only (a foreign Origin is refused). No model, no KV, no third party. Without D1 or the SALT the route is off (503).
import { bump } from '../../lib/guard.js';
import { dayOf, secondsToMidnight, clientKey } from '../../lib/reactions.js';
import { LIMITS, newKey, newShareId, isId, isKey, hashKey, parseDoc } from '../../lib/calshare.js';

const json = (o, status = 200, extra = {}) => Response.json(o, { status, headers: { 'cache-control': 'no-store', ...extra } });
const off = () => json({ ok: false, error: 'shared calendars are off for now' }, 503);
const gone = () => json({ ok: false, error: 'no such calendar, or the link was reset' }, 404);
const slow = (secs) => json({ ok: false, error: 'slow down' }, 429, { 'retry-after': String(secs) });
const DAY_MS = 864e5;

let ready = null;
async function ensure(env) {
  if (!ready) ready = (async () => {
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS void_calshare (id TEXT PRIMARY KEY, owner_h TEXT NOT NULL, edit_h TEXT NOT NULL, view_h TEXT NOT NULL, doc TEXT NOT NULL, rev INTEGER NOT NULL, created INTEGER NOT NULL, touched INTEGER NOT NULL)').run();
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS void_calshare_days (k TEXT PRIMARY KEY, day TEXT NOT NULL, n INTEGER NOT NULL)').run(); // k: kind + a hashed client key, or kind + "all"; no address
  })().catch((e) => { ready = null; throw e; });
  await ready;
}
export const resetReady = () => { ready = null; }; // tests

const used = async (env, k, day) => { const r = await env.DB.prepare('SELECT n, day FROM void_calshare_days WHERE k = ?').bind(k).first(); return r && r.day === day ? Number(r.n) || 0 : 0; };
const tick = (env, k, day) => env.DB.prepare('INSERT INTO void_calshare_days (k, day, n) VALUES (?, ?, 1) ON CONFLICT(k) DO UPDATE SET n = CASE WHEN day = excluded.day THEN n + 1 ELSE 1 END, day = excluded.day').bind(k, day).run();

async function gate(request, env, write) {
  const here = new URL(request.url).origin, from = request.headers.get('origin');
  if (write && from && from !== here) return { stop: json({ ok: false, error: 'same-origin only' }, 403) };
  if (!env || !env.DB || !env.SALT) return { stop: off() };
  const day = dayOf(), who = await clientKey(request.headers.get('cf-connecting-ip'), day, env.SALT);
  if ((await bump(here, 'calshare:' + who)) > LIMITS.perMinute) return { stop: slow(60) };
  try { await ensure(env); } catch (_) { return { stop: off() }; }
  return { day, who };
}
async function body(request) {
  const len = Number(request.headers.get('content-length'));
  if (Number.isFinite(len) && len > LIMITS.body) return { ok: false, status: 413, error: 'too big' };
  if (!/^application\/json\b/i.test(request.headers.get('content-type') || '')) return { ok: false, status: 415, error: 'JSON only' };
  return parseDoc((await request.text()).slice(0, LIMITS.body + 1));
}
/** the row and the role a key opens on it ('owner', 'edit', 'view'), or null */
async function open(env, id, key) {
  if (!isId(id) || !isKey(key)) return null;
  const row = await env.DB.prepare('SELECT * FROM void_calshare WHERE id = ?').bind(id).first(); if (!row) return null;
  const h = await hashKey(key, env.SALT);
  const role = h === row.owner_h ? 'owner' : h === row.edit_h ? 'edit' : h === row.view_h ? 'view' : null;
  return role ? { row, role } : null;
}
const keyOf = (request) => request.headers.get('x-cal-key') || '';
const idOf = (request) => new URL(request.url).searchParams.get('id') || '';

export async function onRequestGet({ request, env }) {
  const g = await gate(request, env, false); if (g.stop) return g.stop;
  const o = await open(env, idOf(request), keyOf(request)); if (!o) return gone();
  const now = Date.now(); if (now - Number(o.row.touched) > DAY_MS) await env.DB.prepare('UPDATE void_calshare SET touched = ? WHERE id = ?').bind(now, o.row.id).run(); // kept while it is used
  const doc = JSON.parse(o.row.doc);
  return json({ ok: true, role: o.role, ...doc, rev: Number(o.row.rev) });
}

export async function onRequestPost({ request, env }) {
  const g = await gate(request, env, true); if (g.stop) return g.stop;
  const u = new URL(request.url);
  if (u.searchParams.get('op') === 'reset') { // new edit and view links; the old ones stop at once
    const o = await open(env, idOf(request), keyOf(request)); if (!o || o.role !== 'owner') return gone();
    const edit = newKey(), view = newKey();
    await env.DB.prepare('UPDATE void_calshare SET edit_h = ?, view_h = ?, touched = ? WHERE id = ?').bind(await hashKey(edit, env.SALT), await hashKey(view, env.SALT), Date.now(), o.row.id).run();
    return json({ ok: true, edit, view });
  }
  if (await used(env, 'new:' + g.who, g.day) >= LIMITS.createsPerDay || await used(env, 'new:all', g.day) >= LIMITS.allCreatesPerDay) return slow(secondsToMidnight());
  const p = await body(request); if (!p.ok) return json({ ok: false, error: p.error }, p.status);
  const now = Date.now(), id = newShareId(), owner = newKey(), edit = newKey(), view = newKey();
  // a calendar nobody has opened for LIMITS.idleDays goes, a few at a time, each time one is made
  await env.DB.prepare('DELETE FROM void_calshare WHERE id IN (SELECT id FROM void_calshare WHERE touched < ? LIMIT 20)').bind(now - LIMITS.idleDays * DAY_MS).run();
  await env.DB.prepare('INSERT INTO void_calshare (id, owner_h, edit_h, view_h, doc, rev, created, touched) VALUES (?, ?, ?, ?, ?, 1, ?, ?)')
    .bind(id, await hashKey(owner, env.SALT), await hashKey(edit, env.SALT), await hashKey(view, env.SALT), JSON.stringify(p.doc), now, now).run();
  await tick(env, 'new:' + g.who, g.day); await tick(env, 'new:all', g.day);
  return json({ ok: true, id, owner, edit, view, rev: 1 });
}

export async function onRequestPut({ request, env }) {
  const g = await gate(request, env, true); if (g.stop) return g.stop;
  const o = await open(env, idOf(request), keyOf(request)); if (!o) return gone();
  if (o.role === 'view') return json({ ok: false, error: 'this link can only show the calendar' }, 403);
  if (await used(env, 'put:' + g.who, g.day) >= LIMITS.writesPerDay) return slow(secondsToMidnight());
  const p = await body(request); if (!p.ok) return json({ ok: false, error: p.error }, p.status);
  const cur = Number(o.row.rev);
  if (p.rev !== cur) return json({ ok: false, error: 'changed since', role: o.role, ...JSON.parse(o.row.doc), rev: cur }, 409);
  const r = await env.DB.prepare('UPDATE void_calshare SET doc = ?, rev = rev + 1, touched = ? WHERE id = ? AND rev = ?').bind(JSON.stringify(p.doc), Date.now(), o.row.id, cur).run();
  if (!r.meta || !r.meta.changes) { const now = await env.DB.prepare('SELECT doc, rev FROM void_calshare WHERE id = ?').bind(o.row.id).first(); return json({ ok: false, error: 'changed since', role: o.role, ...JSON.parse(now.doc), rev: Number(now.rev) }, 409); }
  await tick(env, 'put:' + g.who, g.day);
  return json({ ok: true, rev: cur + 1 });
}

export async function onRequestDelete({ request, env }) {
  const g = await gate(request, env, true); if (g.stop) return g.stop;
  const o = await open(env, idOf(request), keyOf(request)); if (!o || o.role !== 'owner') return gone();
  await env.DB.prepare('DELETE FROM void_calshare WHERE id = ?').bind(o.row.id).run();
  return json({ ok: true });
}
