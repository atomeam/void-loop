// The public image gallery (owner, 2026-10-25: perchance's gallery with votes, moderated): pictures people made on /image/ and chose to share.
//   GET  ?sort=new|top            -> { items: [{ id, prompt, style, shape, votes, day }] } (24 at most; reported ones left out)
//   GET  ?img=<id>                -> the picture itself (image/jpeg or png), cached a day
//   POST { act: 'share', prompt, negative, style, shape, seed } -> { ok, id }: the picture /api/image made for exactly that today
//   POST { id, act: 'vote' }      -> { ok, votes } one vote per connection, picture and day
//   POST { id, act: 'report' }    -> { ok } three reports from three connections hide it until the owner looks
//   DELETE ?id=<id> (owner key)   -> { ok } gone for good
//
// WHAT A STRANGER COULD MAKE THIS DO, AND WHY IT IS BOUNDED. This is an open endpoint with no account. The most a caller can do is:
//   - share a picture: NEVER bytes they send. The share names the words, style, shape and seed of a picture /api/image painted in the last day, and the
//     picture is read from that route's own edge cache; nothing is kept unless Verse's painter made it, under its refusals (no sexual or hateful
//     words, no photo of a named real person, no keys) and the free painter's safety filter. The prompt is checked again here. So a stranger cannot
//     upload an image, only re-show one Verse made for a refused-checked prompt. SHARE_MINUTE a minute and SHARE_DAY a day from one connection,
//     SHARE_ALL a day for everyone; at ROWS_MAX rows the oldest picture with fewer than KEEP_VOTES votes makes room (or the share is refused);
//     a picture over IMG_KEEP characters is refused. So the table stays under about ROWS_MAX x IMG_KEEP (~105 MB) in D1;
//   - vote: one vote per connection, picture and day (a hashed row, cleared daily). THAT IS NOT PREVENTED: many addresses can push a picture up;
//     "top" is a curiosity, never a decision;
//   - hide a picture: three reports from three connections; the owner deletes for good.
// The prompt a person shares is shown publicly with the picture (they pressed "Share to the gallery", which says so). Connections are SHA-256
// of the address, the UTC day and the SALT secret; no address is stored. No D1 or no SALT: off (503). Same-origin writes only. No model.
import { bump, ownerOk } from '../../lib/guard.js';
import { clientKey, dayOf, secondsToMidnight } from '../../lib/reactions.js';
import { redact } from '../../lib/automation-fix.js';
import { scrubOut } from '../../lib/keeper.js';
import { cleanLine, refusalOf, styleOf, shapeOf, seedOf, PROMPT_MAX, NEGATIVE_MAX } from '../../lib/image-gen.js';
import { cacheReq } from './image.js';

export const SHARE_MINUTE = 5, SHARE_DAY = 10, SHARE_ALL = 100, ROWS_MAX = 300, IMG_KEEP = 350000, KEEP_VOTES = 3, REPORTS_HIDE = 3, ID_RE = /^[a-z2-7]{8}$/;
const json = (o, status = 200, extra = {}) => Response.json(o, { status, headers: { 'cache-control': 'no-store', ...extra } });
const off = () => json({ ok: false, error: 'the gallery is off for now' }, 503);
const isSecret = (t) => redact(t) !== t || scrubOut(t) !== t;
function newId() { const a = new Uint8Array(8); crypto.getRandomValues(a); return [...a].map((x) => 'abcdefghijklmnopqrstuvwxyz234567'[x & 31]).join(''); }

let ready = null;
async function ensure(env) {
  if (!ready) ready = (async () => {
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS void_gallery (id TEXT PRIMARY KEY, prompt TEXT NOT NULL, style TEXT NOT NULL, shape TEXT NOT NULL, seed INTEGER NOT NULL, img TEXT NOT NULL, day TEXT NOT NULL, made INTEGER NOT NULL, votes INTEGER NOT NULL DEFAULT 0, reports INTEGER NOT NULL DEFAULT 0)').run();
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS void_gallery_seen (k TEXT PRIMARY KEY, day TEXT NOT NULL)').run();
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS void_gallery_days (k TEXT PRIMARY KEY, day TEXT NOT NULL, n INTEGER NOT NULL)').run();
  })().catch((e) => { ready = null; throw e; });
  await ready;
}
export const resetReady = () => { ready = null; };
const used = async (env, k, day) => { const r = await env.DB.prepare('SELECT n FROM void_gallery_days WHERE k = ? AND day = ?').bind(k, day).first(); return r ? Number(r.n) || 0 : 0; };
const tick = (env, k, day) => env.DB.prepare('INSERT INTO void_gallery_days (k, day, n) VALUES (?, ?, 1) ON CONFLICT(k) DO UPDATE SET n = CASE WHEN day = excluded.day THEN n + 1 ELSE 1 END, day = excluded.day').bind(k, day).run();
async function firstTime(env, k, day) { const r = await env.DB.prepare('INSERT INTO void_gallery_seen (k, day) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET day = excluded.day WHERE void_gallery_seen.day <> excluded.day').bind(k, day).run(); return Number(r && r.meta && r.meta.changes) > 0; }

export async function onRequestGet({ request, env }) {
  if (!env || !env.DB) return off();
  const u = new URL(request.url), img = u.searchParams.get('img');
  try {
    await ensure(env);
    if (img !== null) {
      if (!ID_RE.test(img)) return new Response('not found', { status: 404 });
      const r = await env.DB.prepare('SELECT img FROM void_gallery WHERE id = ? AND reports < ?').bind(img, REPORTS_HIDE).first();
      const m = r && /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/]+=*)$/.exec(r.img);
      if (!m) return new Response('not found', { status: 404 });
      return new Response(Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0)), { headers: { 'content-type': m[1], 'cache-control': 'public, max-age=86400', 'x-content-type-options': 'nosniff' } });
    }
    const order = u.searchParams.get('sort') === 'top' ? 'votes DESC, made DESC' : 'made DESC';
    const { results } = await env.DB.prepare('SELECT id, prompt, style, shape, votes, day FROM void_gallery WHERE reports < ? ORDER BY ' + order + ' LIMIT 24').bind(REPORTS_HIDE).all();
    return json({ ok: true, items: results || [] }, 200, { 'cache-control': 'public, max-age=30' });
  } catch (_) { return off(); }
}

export async function onRequestPost({ request, env }) {
  const here = new URL(request.url).origin, from = request.headers.get('origin');
  if (from && from !== here) return json({ ok: false, error: 'same-origin only' }, 403);
  if (!env || !env.DB || !env.SALT) return off();
  let b; try { b = JSON.parse((await request.text()).slice(0, 2000)); } catch (_) { return json({ ok: false, error: 'bad request' }, 400); }
  if (!b || typeof b !== 'object') return json({ ok: false, error: 'bad request' }, 400);
  const day = dayOf(), conn = await clientKey(request.headers.get('cf-connecting-ip'), day, env.SALT);
  try {
    await ensure(env);
    if (b.act === 'vote' || b.act === 'report') {
      if (!ID_RE.test(String(b.id || ''))) return json({ ok: false, error: 'not a picture' }, 404);
      if ((await bump(here, 'gallery:c:' + conn)) > 30) return json({ ok: false, error: 'slow down' }, 429, { 'retry-after': '60' });
      if (b.act === 'vote') {
        if (await firstTime(env, 'v:' + conn + ':' + b.id, day)) await env.DB.prepare('UPDATE void_gallery SET votes = votes + 1 WHERE id = ?').bind(b.id).run();
        const r = await env.DB.prepare('SELECT votes FROM void_gallery WHERE id = ?').bind(b.id).first(); return json({ ok: true, votes: r ? r.votes : 0 });
      }
      if (await firstTime(env, 'r:' + conn + ':' + b.id, day)) await env.DB.prepare('UPDATE void_gallery SET reports = reports + 1 WHERE id = ?').bind(b.id).run();
      return json({ ok: true });
    }
    if (b.act !== 'share') return json({ ok: false, error: 'bad request' }, 400);
    if ((await bump(here, 'gallery:share:' + conn)) > SHARE_MINUTE) return json({ ok: false, error: 'slow down: a few a minute' }, 429, { 'retry-after': '60' });
    const prompt = cleanLine(b.prompt, PROMPT_MAX), negative = cleanLine(b.negative, NEGATIVE_MAX), style = styleOf(b.style), shape = shapeOf(b.shape), seed = seedOf(b.seed);
    if (refusalOf(prompt, negative, style, isSecret)) return json({ ok: false, error: 'that picture cannot go in the gallery' }, 400);
    // the picture as /api/image kept it: made today, or yesterday while its day in the edge cache lasts (the cache keeps a picture 24 hours, and
    // only in the data centre that made it: an older picture, or one made far away, is gone and is made again with the same seed)
    let hit = null;
    for (const d of [day, dayOf(Date.now() - 864e5)]) { try { const r = await caches.default.match(await cacheReq(here, [d, prompt, negative, style, shape, seed])); hit = r ? await r.json() : null; } catch (_) { hit = null; } if (hit) break; }
    if (!hit || hit.state !== 'art' || !/^data:image\/(?:jpeg|png);base64,/.test(hit.img || '')) return json({ ok: false, why: 'gone', error: 'the painter keeps a picture for about a day, so this one can no longer be shared: press "Same seed again" to make it again (the same words and seed make the same picture), then share it' }, 404);
    if (hit.img.length > IMG_KEEP) return json({ ok: false, error: 'that picture is too big for the gallery' }, 413);
    if ((await used(env, 's:' + conn, day)) >= SHARE_DAY) return json({ ok: false, error: 'that is enough sharing for today' }, 429, { 'retry-after': String(secondsToMidnight()) });
    if ((await used(env, 's:all', day)) >= SHARE_ALL) return json({ ok: false, error: 'the gallery is busy today; try tomorrow' }, 429, { 'retry-after': String(secondsToMidnight()) });
    const dup = await env.DB.prepare('SELECT id FROM void_gallery WHERE prompt = ? AND style = ? AND shape = ? AND seed = ?').bind(prompt, style, shape, seed).first();
    if (dup) return json({ ok: true, id: dup.id, already: true });
    const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM void_gallery').first();
    if (Number(n && n.n) >= ROWS_MAX) {
      const old = await env.DB.prepare('SELECT id FROM void_gallery WHERE votes < ? ORDER BY made ASC LIMIT 1').bind(KEEP_VOTES).first();
      if (!old) return json({ ok: false, error: 'the gallery is full of favourites for now' }, 507);
      await env.DB.prepare('DELETE FROM void_gallery WHERE id = ?').bind(old.id).run();
    }
    if (!(await used(env, 's:all', day))) await env.DB.prepare('DELETE FROM void_gallery_seen WHERE day < ?').bind(day).run();
    const id = newId();
    await env.DB.prepare('INSERT INTO void_gallery (id, prompt, style, shape, seed, img, day, made) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(id, prompt, style, shape, seed, hit.img, day, Date.now()).run();
    await tick(env, 's:' + conn, day); await tick(env, 's:all', day);
    return json({ ok: true, id });
  } catch (_) { return off(); }
}

export async function onRequestDelete({ request, env }) {
  if (!(await ownerOk(request, env))) return json({ ok: false, error: 'owner only' }, 401);
  const id = new URL(request.url).searchParams.get('id');
  if (!ID_RE.test(String(id || ''))) return json({ ok: false, error: 'not a picture' }, 404);
  try { await ensure(env); await env.DB.prepare('DELETE FROM void_gallery WHERE id = ?').bind(id).run(); return json({ ok: true }); } catch (_) { return off(); }
}
