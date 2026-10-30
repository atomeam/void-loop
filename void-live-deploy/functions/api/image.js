// The text-to-image page's painter, the server half (owner, 2026-10-25: "how do we beat perchance if we dont have images?"); the rules are in
// lib/image-gen.js, the page is /image/. POST { prompt, negative, style, shape, seed } -> { state: 'art', img, seed, painter } or
// { state: 'resting' | 'refused', why, say }. One picture per call; the page asks up to four times for "several images per go".
//
// WHAT A STRANGER COULD MAKE THIS DO, AND WHY IT IS BOUNDED. This is an open endpoint with no account. The most a caller can do is:
//   - make Verse paint one picture of a typed prompt (at most 400 characters, plus a "leave out" line of 200, a style and a shape from closed
//     lists and a whole-number seed). Typed words DO reach the painter here (that is the page's whole job), so they are checked first: sexual and
//     hateful words, a photo of a named real person, anything the keeper refuses and anything shaped like a key or a secret get no painter call
//     (lib/image-gen.js refusalOf), the painted prompt always carries "safe for work", and the free painter's own safety filter is asked for;
//   - do that PER_MINUTE times a minute and PER_CONN times a day from one connection (keyed by SHA-256 of the address, the UTC day and the SALT
//     secret: the address is never stored, logged or returned), and only while the day's pictures last: Workers AI's share (AI_SHARE a day of
//     its own, also counted in the Art Forge's total, so the two never pass AI_SHARE + FREE_CAP), then the free painter (POLL_CAP a day);
//     past both it says the painter is resting. No money is spent that the forge did not already have (STANDING.md money rule);
//   - get the same picture again for the same words, style, shape and seed within a day: it is kept in the edge cache under a hash of those,
//     costs nothing and counts nothing;
//   - change a picture painted here today ("Change it", act 'change'): its reference (that hash) names the picture, which must still be in the
//     edge cache, so a change starts from a Verse picture, never from a stranger's photo by address. The model takes reference pictures smaller
//     than 512x512 only and the server cannot shrink one inside its CPU limit, so the page sends its own shrunk copy (at most EDIT_BYTES, a JPEG or
//     a PNG smaller than 512x512 in the named picture's proportions, checked from its header). The server cannot prove that copy's pixels are
//     the named picture's; the typed change goes through the same refusals as a prompt, the same safe words, and counts against the same caps
//     (a change is one Workers AI picture; there is no free-painter fallback for it). Nothing of the copy is stored. Nothing typed is written to D1: the table holds counters only ('ai', 'poll', 'c:<hash>', the day, n).
// With no SALT or no D1 the route is off (the page says the painter is resting), never unguarded. Same-origin only.
import { bump, ownerOk } from '../../lib/guard.js';
import { clientKey, dayOf, secondsToMidnight } from '../../lib/reactions.js';
import { redact } from '../../lib/automation-fix.js';
import { scrubOut } from '../../lib/keeper.js';
import { models } from '../../lib/models.js';
import { imageOf } from '../../lib/art-rules.js';
import { capOf, asImage } from './card-art.js';
import { publicPainter, paintWith } from './studio.js';
import { IMAGE_MODELS } from '../../lib/models.js';
import { cleanLine, refusalOf, promptOf, pollUrl, styleOf, shapeOf, seedOf, SHAPES, SAYS, aiShareOf, POLL_CAP, PER_CONN, PER_MINUTE, PROMPT_MAX, NEGATIVE_MAX, CHANGE_MAX, EDIT_BYTES, imageSizeOf, fitsEdit, changePromptOf } from '../../lib/image-gen.js';

export const AI_MS = 25000, POLL_MS = 30000; // both inside the gate's 60 s wait for a first picture (2026-10-25: 40 + 40 s let a slow painter hold a picture past it)
const json = (o, status = 200, extra = {}) => Response.json(o, { status, headers: { 'cache-control': 'no-store', ...extra } });
const isSecret = (t) => redact(t) !== t || scrubOut(t) !== t;
const say = (why, de) => (SAYS[why] || SAYS.busy)[de ? 1 : 0];
const resting = (why, de, status = 200, extra = {}) => json({ state: 'resting', why, say: say(why, de) }, status, extra);

let ready = null;
async function ensure(env) {
  if (!ready) ready = env.DB.prepare('CREATE TABLE IF NOT EXISTS void_image_days (k TEXT PRIMARY KEY, day TEXT NOT NULL, n INTEGER NOT NULL)').run().catch((e) => { ready = null; throw e; });
  await ready;
}
export const resetReady = () => { ready = null; }; // tests: a new fake database needs its table made again
const used = async (env, k, day) => { const r = await env.DB.prepare('SELECT n FROM void_image_days WHERE k = ? AND day = ?').bind(k, day).first(); return r ? Number(r.n) || 0 : 0; };
const tick = (env, k, day) => env.DB.prepare('INSERT INTO void_image_days (k, day, n) VALUES (?, ?, 1) ON CONFLICT(k) DO UPDATE SET n = CASE WHEN day = excluded.day THEN n + 1 ELSE 1 END, day = excluded.day').bind(k, day).run();
/** the image page's Workers AI pictures today, for the Art Forge's own count (functions/api/card-art.js madeToday): the two share one cap */
export async function imageAiToday(env) {
  try { const r = await env.DB.prepare('SELECT n FROM void_image_days WHERE k = ? AND day = ?').bind('ai', dayOf()).first(); return r ? Number(r.n) || 0 : 0; } catch (_) { return 0; }
}
async function forgeToday(env, day) {
  try { const r = await env.DB.prepare('SELECT COUNT(*) AS n FROM void_art WHERE day = ?').bind(day).first(); return Number(r && r.n) || 0; } catch (_) { return 0; } // no table yet: the forge has painted nothing
}
const hex = (buf) => [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('');
/** the edge-cache key of one picture: the day, the words, the style, the shape and the seed, hashed (functions/api/gallery.js reads it too) */
export async function cacheReq(origin, parts) { return new Request(origin + '/__void-image/' + hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(parts.join('\u0001'))))); }
/** a cached picture's reference: the hash its cache key ends with (the page sends it back to change that picture) */
export const refOf = (key) => key.url.slice(key.url.lastIndexOf('/') + 1);
const CHANGE_BODY = 240000; // a change carries the page's shrunk copy as base64 (EDIT_BYTES * 4 / 3) plus its fields

// one picture from Workers AI's image model (klein takes multipart form data with the size and the seed, and reference pictures as input_image_N)
export async function paintAi(env, prompt, [w, h], seed, withSeed = true, refs = []) {
  const form = new FormData(); form.append('prompt', prompt); form.append('width', String(w)); form.append('height', String(h)); if (withSeed) form.append('seed', String(seed));
  refs.slice(0, 4).forEach((r, i) => form.append('input_image_' + i, new Blob([r.bytes], { type: r.type }), 'image-' + i + (r.type === 'image/png' ? '.png' : '.jpg')));
  const body = new Response(form);
  const r = await Promise.race([env.AI.run(models('art'), { multipart: { body: body.body, contentType: body.headers.get('content-type') } }), new Promise((_, no) => setTimeout(() => no(new Error('slow')), AI_MS))]);
  const img = imageOf(await asImage(r && r.image !== undefined ? r.image : r));
  if (!img) throw new Error('not an image: ' + (r && typeof r === 'object' ? Object.keys(r).join(',').slice(0, 40) : typeof r));
  return img;
}
// why a painter gave no picture, counted by day (no prompt, nothing typed): read by the owner with GET /api/image?diag=1
const why = (e) => redact(String((e && e.message) || e || 'error')).replace(/\s+/g, ' ').slice(0, 100);
async function noteMiss(env, painter, e) {
  try { await env.DB.prepare('CREATE TABLE IF NOT EXISTS void_image_miss (day TEXT NOT NULL, why TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (day, why))').run();
    await env.DB.prepare('INSERT INTO void_image_miss (day, why, n) VALUES (?, ?, 1) ON CONFLICT(day, why) DO UPDATE SET n = n + 1').bind(dayOf(), painter + ': ' + why(e)).run(); } catch (_) {}
}
export async function paintFree(env, prompt, size, seed, fetchFn = (u, o) => fetch(u, o)) {
  const token = String((env && env.POLLINATIONS_KEY) || '').trim(), ac = new AbortController(), t = setTimeout(() => ac.abort(), POLL_MS);
  try {
    const res = await fetchFn(pollUrl(prompt, size, seed, token), { headers: token ? { authorization: 'Bearer ' + token } : {}, signal: ac.signal });
    const type = (res.headers.get('content-type') || '').toLowerCase();
    if (!res.ok || !/^image\/(jpeg|png)/.test(type)) throw new Error('answered ' + res.status + ' ' + type.slice(0, 24));
    const img = imageOf(await asImage(res.body)); if (!img) throw new Error('not a usable image');
    return img;
  } catch (e) { if (env && env.DB) await noteMiss(env, 'pollinations', e && e.name === 'AbortError' ? 'timeout after ' + POLL_MS + ' ms' : e); return ''; } finally { clearTimeout(t); }
}

export async function onRequestPost({ request, env }, fetchFn) {
  const here = new URL(request.url).origin, from = request.headers.get('origin');
  if (from && from !== here) return json({ state: 'refused', why: 'origin', say: 'same-origin only' }, 403);
  if (Number(request.headers.get('content-length') || 0) > CHANGE_BODY) return json({ state: 'refused', why: 'bad', say: 'bad request' }, 413);
  const raw = (await request.text()).slice(0, CHANGE_BODY);
  let b = {}; try { b = JSON.parse(raw); } catch (_) { return json({ state: 'refused', why: 'bad', say: 'bad request' }, 400); }
  if (b && b.act === 'change') return changeOf(request, env, here, b);
  if (raw.length > 2000) return json({ state: 'refused', why: 'bad', say: 'bad request' }, 400); // a picture's ask is small; only a change carries a copy
  const de = b && b.lang === 'de';
  const prompt = cleanLine(b && b.prompt, PROMPT_MAX), negative = cleanLine(b && b.negative, NEGATIVE_MAX), style = styleOf(b && b.style), shape = shapeOf(b && b.shape), seed = seedOf(b && b.seed);
  const why = refusalOf(prompt, negative, style, isSecret);
  if (why) return json({ state: 'refused', why, say: say(why, de) });
  if (!env || !env.DB || !env.SALT) return resting('off', de);
  // the same words, style, shape and seed today: the picture already made, free
  const day = dayOf(), key = await cacheReq(here, [day, prompt, negative, style, shape, seed]);
  try { const hit = await caches.default.match(key); if (hit) return json({ ...(await hit.json()), ref: refOf(key), cached: true }); } catch (_) {}
  const lim = await limitsOf(request, env, here, day, de); if (lim instanceof Response) return lim;
  const { conn, ai, poll } = lim;
  const full = promptOf(prompt, style, negative), size = SHAPES[shape];
  // the image page's own share of Workers AI (2026-10-25, live: the forge had used its 30 by the afternoon and /image/ got none, so the first picture
  // depended on the free painter alone): AI_SHARE a day of its own, counted in the forge's total too (the forge paints that many fewer when /image/
  // paints first); at most AI_SHARE + the forge's FREE_CAP a day in all, ~4,000 neurons, inside the free daily allowance
  const aiRoom = !!env.AI && !/^(1|true|yes|on)$/i.test(String(env.ART_OFF || '').trim()) && ai < aiShareOf(env);
  const pollRoom = poll < POLL_CAP && !/^(0|false|no|off)$/i.test(String(env.ART_POLLINATIONS || '').trim());
  if (!aiRoom && !pollRoom) return resting('cap', de);
  let img = '', painter = '';
  if (aiRoom) {
    // the studio's bench picks the painter (functions/api/studio.js publicPainter): its best-scoring model inside klein-4b's cost; a square-only
    // model paints square shapes only, and any miss falls back to klein-4b below, so a bad pick never costs the user a picture
    const champ = await publicPainter(env).catch(() => 'klein-4b');
    if (champ !== 'klein-4b' && IMAGE_MODELS[champ] && !(IMAGE_MODELS[champ].square && size[0] !== size[1])) {
      try { img = imageOf((await paintWith(env, champ, full, size, seed, AI_MS)).img.replace(/^data:image\/[a-z]+;base64,/, '')) || ''; } catch (e) { await noteMiss(env, champ, e); img = ''; }
    }
    if (!img) try { img = await paintAi(env, full, size, seed); } catch (e) { await noteMiss(env, 'workers-ai', e); if (!/slow/.test(String(e && e.message))) { try { img = await paintAi(env, full, size, seed, false); } catch (e2) { await noteMiss(env, 'workers-ai without seed', e2); img = ''; } } } // a model that refuses the seed field paints without it
    if (img) painter = 'workers-ai';
  }
  if (!img && pollRoom) { img = await paintFree(env, full, size, seed, fetchFn); if (img) painter = 'pollinations'; }
  if (!img) return resting('busy', de);
  try { await tick(env, painter === 'workers-ai' ? 'ai' : 'poll', day); await tick(env, 'c:' + conn, day); } catch (_) {}
  const out = { state: 'art', img, seed, style, shape, painter, w: size[0], h: size[1], ref: refOf(key) };
  try { await caches.default.put(key, new Response(JSON.stringify(out), { headers: { 'content-type': 'application/json', 'cache-control': 'max-age=86400' } })); } catch (_) {}
  return json(out);
}
// the per-minute, per-connection and daily counts one more picture needs: a Response that says why not, or { conn, ai, poll } to go on
async function limitsOf(request, env, here, day, de) {
  const conn = await clientKey(request.headers.get('cf-connecting-ip'), day, env.SALT);
  if ((await bump(here, 'image:c:' + conn)) > PER_MINUTE) return resting('slow', de, 429, { 'retry-after': '60' });
  try {
    await ensure(env);
    if ((await used(env, 'c:' + conn, day)) >= PER_CONN) return resting('mine', de, 429, { 'retry-after': String(secondsToMidnight()) });
    return { conn, ai: await used(env, 'ai', day), poll: await used(env, 'poll', day) };
  } catch (_) { return resting('off', de); }
}

// "Change it": POST { act: 'change', ref, change, src } -> the picture `ref` names (painted here today, still in the edge cache), changed by the
// typed line at its own size and seed, with the page's shrunk copy as klein's input_image_0. The answer carries its own ref, so a change can be
// changed again. The same ref and change again today come from the cache, free.
async function changeOf(request, env, here, b) {
  const de = b && b.lang === 'de', ref = String((b && b.ref) || '');
  if (!/^[0-9a-f]{64}$/.test(ref)) return json({ state: 'refused', why: 'bad', say: 'bad request' }, 400);
  if (!env || !env.DB || !env.SALT) return resting('off', de);
  let from = null; try { const hit = await caches.default.match(new Request(here + '/__void-image/' + ref)); if (hit) from = await hit.json(); } catch (_) { from = null; }
  if (!from || from.state !== 'art') return resting('gone', de);
  const change = cleanLine(b.change, CHANGE_MAX), style = styleOf(from.style), shape = shapeOf(from.shape), seed = seedOf(from.seed);
  const why = refusalOf(change, '', style, isSecret);
  if (why) return json({ state: 'refused', why, say: say(why, de) });
  const day = dayOf(), key = await cacheReq(here, [day, 'change', ref, change]);
  try { const hit = await caches.default.match(key); if (hit) return json({ ...(await hit.json()), cached: true }); } catch (_) {}
  const src = String(b.src || '').replace(/^data:image\/(?:jpeg|png);base64,/, ''), size = Number(from.w) > 0 && Number(from.h) > 0 ? [Number(from.w), Number(from.h)] : SHAPES[shape];
  let bytes = null; try { if (src.length <= Math.ceil(EDIT_BYTES / 3) * 4) bytes = Uint8Array.from(atob(src), (c) => c.charCodeAt(0)); } catch (_) { bytes = null; }
  const dims = imageSizeOf(bytes);
  if (!bytes || !fitsEdit(dims, size)) return json({ state: 'refused', why: 'badpic', say: say('badpic', de) }, 400);
  const lim = await limitsOf(request, env, here, day, de); if (lim instanceof Response) return lim;
  if (!env.AI || /^(1|true|yes|on)$/i.test(String(env.ART_OFF || '').trim()) || lim.ai >= aiShareOf(env)) return resting('cap', de);
  let img = '';
  try { img = await paintAi(env, changePromptOf(change), size, seed, true, [{ bytes, type: dims.type }]); } catch (e) { await noteMiss(env, 'workers-ai change', e); img = ''; }
  if (!img) return resting('busy', de);
  try { await tick(env, 'ai', day); await tick(env, 'c:' + lim.conn, day); } catch (_) {}
  const out = { state: 'art', img, seed, style, shape, painter: 'workers-ai', w: size[0], h: size[1], change, ref: refOf(key) };
  try { await caches.default.put(key, new Response(JSON.stringify(out), { headers: { 'content-type': 'application/json', 'cache-control': 'max-age=86400' } })); } catch (_) {}
  return json(out);
}
// GET: how many pictures are left today for everyone (no input, nothing typed): the page shows it under the button
export async function onRequestGet({ request, env }) {
  const u = new URL((request && request.url) || 'https://x/');
  if (u.searchParams.get('diag') === '1') return diag(request, env, u.searchParams.get('try') === '1');
  if (!env || !env.DB || !env.SALT) return json({ left: 0, off: true });
  try { await ensure(env); const day = dayOf(), ai = await used(env, 'ai', day), poll = await used(env, 'poll', day), forge = await forgeToday(env, day);
    const aiLeft = env.AI ? Math.max(0, aiShareOf(env) - ai) : 0; void forge;
    return json({ left: aiLeft + Math.max(0, POLL_CAP - poll), perConnection: PER_CONN }); } catch (_) { return json({ left: 0, off: true }); }
}

// the owner's look at why pictures fail (GET /api/image?diag=1 with the owner key; &try=1 paints one small test picture with each painter and says
// how long it took or why it failed). Never a key, a prompt or an address: counts, switches and the painters' own error words, cut short.
async function diag(request, env, attempt) {
  if (!(await ownerOk(request, env))) return json({ ok: false, error: 'owner only' }, 401);
  const day = dayOf(), out = { day, aiBound: !!(env && env.AI), artOff: /^(1|true|yes|on)$/i.test(String((env && env.ART_OFF) || '').trim()), pollinationsOff: /^(0|false|no|off)$/i.test(String((env && env.ART_POLLINATIONS) || '').trim()), pollinationsKey: !!String((env && env.POLLINATIONS_KEY) || '').trim(), salt: !!(env && env.SALT), db: !!(env && env.DB), aiShare: aiShareOf(env), forgeCap: capOf(env), aiModel: models('art') };
  if (env && env.DB) {
    try { await ensure(env); out.aiUsedToday = await used(env, 'ai', day); out.pollUsedToday = await used(env, 'poll', day); out.forgeToday = await forgeToday(env, day); } catch (e) { out.dbError = why(e); }
    try { const { results } = await env.DB.prepare('SELECT why, n FROM void_image_miss WHERE day >= ? ORDER BY n DESC LIMIT 20').bind(dayOf(Date.now() - 864e5)).all(); out.missesSinceYesterday = results || []; } catch (_) { out.missesSinceYesterday = []; }
  }
  if (attempt) {
    const t0 = Date.now(), test = 'a red apple on a wooden table, simple, safe for work';
    try { const img = env.AI ? await paintAi(env, test, [512, 512], 1) : ''; out.tryWorkersAi = { ok: !!img, ms: Date.now() - t0 }; } catch (e) { out.tryWorkersAi = { ok: false, ms: Date.now() - t0, why: why(e) }; }
    const t1 = Date.now(); const img = await paintFree(env, test, [512, 512], 1); out.tryPollinations = { ok: !!img, ms: Date.now() - t1 };
  }
  return json(out);
}
