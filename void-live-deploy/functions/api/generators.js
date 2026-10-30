// The generators hub, the server half (owner, 2026-10-25: "we have to have everything all the sites have"): generators people chose to publish,
// written in the list language (lib/listgen.js), listed newest or most played on /generators/ and opened at /generators/make/?id=<id>.
//   GET  ?sort=new|popular        -> { items: [{ id, title, plays, day, lines }] } (30 at most, reported ones left out)
//   GET  ?id=<id>                 -> { id, title, text, plays, day }
//   POST { title, text }          -> { ok, id } publish (a random 8-letter id; the text must compile without errors)
//   POST { id, act: 'play' }      -> { ok } one more play (for "popular")
//   POST { id, act: 'report' }    -> { ok } a report; three reports from three connections hide it until the owner looks
//   DELETE ?id=<id> (owner key)   -> { ok } gone for good
//
// WHAT A STRANGER COULD MAKE THIS DO, AND WHY IT IS BOUNDED. This is an open endpoint with no account. The most a caller can do is:
//   - publish a generator: at most 20,000 characters of text and a 60-character title, refused when it does not compile, when its title has sexual
//     or hateful words, or when anything in it is shaped like a key or a secret (redact, scrubOut); PUB_MINUTE a minute and PUB_DAY a day from one
//     connection, PUB_ALL a day for everyone, and never past ROWS_MAX rows in all (then "the hub is full"). So at most ~6 MB of text a day lands in D1.
//     The text is never run on the server and never shown as HTML: pages put it in with textContent; the hub shows only titles;
//   - push a generator up "popular" by playing it: one play per generator per connection per day counts (a row per connection and generator,
//     hashed, cleared daily), and a connection's plays a day are capped. THAT IS NOT PREVENTED: many addresses can still skew it; popular is a
//     curiosity, never a decision;
//   - hide a generator by reporting it: only three reports from three different connections hide one, and the owner can delete it for good.
// Connections are SHA-256 of the address, the UTC day and the SALT secret, cut short: no address is stored, logged or returned. With no D1 or
// no SALT the route is off (503). Same-origin writes only. No model, no KV, no third party.
import { bump, ownerOk } from '../../lib/guard.js';
import { clientKey, dayOf, secondsToMidnight } from '../../lib/reactions.js';
import { redact } from '../../lib/automation-fix.js';
import { scrubOut } from '../../lib/keeper.js';
import { SEXUAL, HATE } from '../../lib/art-rules.js';
import { compile, MAX_TEXT } from '../../lib/listgen.js';

export const TITLE_MAX = 60, PUB_MINUTE = 3, PUB_DAY = 10, PUB_ALL = 300, ROWS_MAX = 20000, PLAYS_DAY = 300, REPORTS_HIDE = 3, ID_RE = /^[a-z2-7]{8}$/;
const json = (o, status = 200, extra = {}) => Response.json(o, { status, headers: { 'cache-control': 'no-store', ...extra } });
const off = () => json({ ok: false, error: 'the hub is off for now' }, 503);
const isSecret = (t) => redact(t) !== t || scrubOut(t) !== t;
/** a title: one clean line of at most 60 characters, or 'Untitled'. Pure. */
export const titleOf = (v) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f-\u009f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, TITLE_MAX) || 'Untitled generator';
/** why a generator may not be published: '' or a plain sentence. Pure but for `isSecret`. */
export function publishProblem(title, text, secret = isSecret) {
  const t = String(text == null ? '' : text);
  if (!t.trim()) return 'the generator is empty';
  if (t.length > MAX_TEXT) return 'a generator is at most ' + MAX_TEXT + ' characters';
  const g = compile(t); if (g.errors.length) return 'fix line ' + g.errors[0].line + ' first: ' + g.errors[0].message;
  const lo = String(title).toLowerCase(); if (SEXUAL.test(lo) || HATE.test(lo)) return 'pick another title';
  if (secret(String(title)) || secret(t)) return 'something in it looks like a key or a password; take it out first';
  return '';
}
export function newId() { const a = new Uint8Array(8); crypto.getRandomValues(a); return [...a].map((x) => 'abcdefghijklmnopqrstuvwxyz234567'[x & 31]).join(''); }

let ready = null;
async function ensure(env) {
  if (!ready) ready = (async () => {
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS void_gens (id TEXT PRIMARY KEY, title TEXT NOT NULL, text TEXT NOT NULL, day TEXT NOT NULL, made INTEGER NOT NULL, plays INTEGER NOT NULL DEFAULT 0, reports INTEGER NOT NULL DEFAULT 0)').run();
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS void_gens_seen (k TEXT PRIMARY KEY, day TEXT NOT NULL)').run(); // k: what + hashed connection + id; no address
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS void_gens_days (k TEXT PRIMARY KEY, day TEXT NOT NULL, n INTEGER NOT NULL)').run();
  })().catch((e) => { ready = null; throw e; });
  await ready;
}
export const resetReady = () => { ready = null; };
const used = async (env, k, day) => { const r = await env.DB.prepare('SELECT n FROM void_gens_days WHERE k = ? AND day = ?').bind(k, day).first(); return r ? Number(r.n) || 0 : 0; };
const tick = (env, k, day) => env.DB.prepare('INSERT INTO void_gens_days (k, day, n) VALUES (?, ?, 1) ON CONFLICT(k) DO UPDATE SET n = CASE WHEN day = excluded.day THEN n + 1 ELSE 1 END, day = excluded.day').bind(k, day).run();
// once per connection, generator and day: true the first time
async function firstTime(env, k, day) {
  const r = await env.DB.prepare('INSERT INTO void_gens_seen (k, day) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET day = excluded.day WHERE void_gens_seen.day <> excluded.day').bind(k, day).run();
  return Number(r && r.meta && r.meta.changes) > 0;
}

export async function onRequestGet({ request, env }) {
  if (!env || !env.DB) return off();
  const u = new URL(request.url), id = u.searchParams.get('id');
  try {
    await ensure(env);
    if (id !== null) {
      if (!ID_RE.test(id)) return json({ ok: false, error: 'not a generator' }, 404);
      const r = await env.DB.prepare('SELECT id, title, text, plays, day FROM void_gens WHERE id = ? AND reports < ?').bind(id, REPORTS_HIDE).first();
      return r ? json({ ok: true, ...r }) : json({ ok: false, error: 'not a generator (or it was taken down)' }, 404);
    }
    const order = u.searchParams.get('sort') === 'popular' ? 'plays DESC, made DESC' : 'made DESC';
    const { results } = await env.DB.prepare('SELECT id, title, plays, day, length(text) - length(replace(text, char(10), \'\')) + 1 AS lines FROM void_gens WHERE reports < ? ORDER BY ' + order + ' LIMIT 30').bind(REPORTS_HIDE).all();
    return json({ ok: true, items: results || [] }, 200, { 'cache-control': 'public, max-age=30' });
  } catch (_) { return off(); }
}

export async function onRequestPost({ request, env }) {
  const here = new URL(request.url).origin, from = request.headers.get('origin');
  if (from && from !== here) return json({ ok: false, error: 'same-origin only' }, 403);
  if (!env || !env.DB || !env.SALT) return off();
  let b; try { b = JSON.parse((await request.text()).slice(0, 64000)); } catch (_) { return json({ ok: false, error: 'bad request' }, 400); }
  if (!b || typeof b !== 'object') return json({ ok: false, error: 'bad request' }, 400);
  const day = dayOf(), conn = await clientKey(request.headers.get('cf-connecting-ip'), day, env.SALT);
  try {
    await ensure(env);
    if (b.act === 'play' || b.act === 'report') {
      if (!ID_RE.test(String(b.id || ''))) return json({ ok: false, error: 'not a generator' }, 404);
      if ((await bump(here, 'gens:c:' + conn)) > 30) return json({ ok: false, error: 'slow down' }, 429, { 'retry-after': '60' });
      if (b.act === 'play') {
        if ((await used(env, 'p:' + conn, day)) >= PLAYS_DAY) return json({ ok: true, counted: false });
        if (await firstTime(env, 'p:' + conn + ':' + b.id, day)) { await env.DB.prepare('UPDATE void_gens SET plays = plays + 1 WHERE id = ?').bind(b.id).run(); await tick(env, 'p:' + conn, day); return json({ ok: true, counted: true }); }
        return json({ ok: true, counted: false });
      }
      if (await firstTime(env, 'r:' + conn + ':' + b.id, day)) await env.DB.prepare('UPDATE void_gens SET reports = reports + 1 WHERE id = ?').bind(b.id).run();
      return json({ ok: true });
    }
    // publish
    if ((await bump(here, 'gens:pub:' + conn)) > PUB_MINUTE) return json({ ok: false, error: 'slow down: a few a minute' }, 429, { 'retry-after': '60' });
    const title = titleOf(b.title), text = String(b.text == null ? '' : b.text);
    const problem = publishProblem(title, text); if (problem) return json({ ok: false, error: problem }, 400);
    if ((await used(env, 'pub:' + conn, day)) >= PUB_DAY) return json({ ok: false, error: 'that is enough publishing for today' }, 429, { 'retry-after': String(secondsToMidnight()) });
    if ((await used(env, 'pub:all', day)) >= PUB_ALL) return json({ ok: false, error: 'the hub is busy today; try tomorrow' }, 429, { 'retry-after': String(secondsToMidnight()) });
    const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM void_gens').first(); if (Number(n && n.n) >= ROWS_MAX) return json({ ok: false, error: 'the hub is full for now' }, 507);
    if (!(await used(env, 'pub:all', day))) await env.DB.prepare('DELETE FROM void_gens_seen WHERE day < ?').bind(day).run(); // the day's first publish clears yesterday's once-a-day rows
    let id = newId(); for (let i = 0; i < 3 && (await env.DB.prepare('SELECT 1 FROM void_gens WHERE id = ?').bind(id).first()); i++) id = newId();
    await env.DB.prepare('INSERT INTO void_gens (id, title, text, day, made) VALUES (?, ?, ?, ?, ?)').bind(id, title, text, day, Date.now()).run();
    await tick(env, 'pub:' + conn, day); await tick(env, 'pub:all', day);
    return json({ ok: true, id });
  } catch (_) { return off(); }
}

export async function onRequestDelete({ request, env }) {
  if (!(await ownerOk(request, env))) return json({ ok: false, error: 'owner only' }, 401);
  const id = new URL(request.url).searchParams.get('id');
  if (!ID_RE.test(String(id || ''))) return json({ ok: false, error: 'not a generator' }, 404);
  try { await ensure(env); await env.DB.prepare('DELETE FROM void_gens WHERE id = ?').bind(id).run(); return json({ ok: true }); } catch (_) { return off(); }
}
