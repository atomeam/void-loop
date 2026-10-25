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
//     secret: the address is never stored, logged or returned), and only while the day's pictures last: Workers AI's share (AI_SHARE a day,
//     counted TOGETHER with the Art Forge's paintings so the two never pass the forge's FREE_CAP), then the free painter (POLL_CAP a day);
//     past both it says the painter is resting. No money is spent that the forge did not already have (STANDING.md money rule);
//   - get the same picture again for the same words, style, shape and seed within a day: it is kept in the edge cache under a hash of those,
//     costs nothing and counts nothing. Nothing typed is written to D1: the table holds counters only ('ai', 'poll', 'c:<hash>', the day, n).
// With no SALT or no D1 the route is off (the page says the painter is resting), never unguarded. Same-origin only.
import { bump } from '../../lib/guard.js';
import { clientKey, dayOf, secondsToMidnight } from '../../lib/reactions.js';
import { redact } from '../../lib/automation-fix.js';
import { scrubOut } from '../../lib/keeper.js';
import { models } from '../../lib/models.js';
import { imageOf } from '../../lib/art-rules.js';
import { capOf, asImage } from './card-art.js';
import { cleanLine, refusalOf, promptOf, pollUrl, styleOf, shapeOf, seedOf, SHAPES, SAYS, aiShareOf, POLL_CAP, PER_CONN, PER_MINUTE, PROMPT_MAX, NEGATIVE_MAX } from '../../lib/image-gen.js';

export const TIMEOUT_MS = 40000;
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

// one picture from Workers AI's image model (klein takes multipart form data with the size and the seed)
export async function paintAi(env, prompt, [w, h], seed) {
  const form = new FormData(); form.append('prompt', prompt); form.append('width', String(w)); form.append('height', String(h)); form.append('seed', String(seed));
  const body = new Response(form);
  const r = await Promise.race([env.AI.run(models('art'), { multipart: { body: body.body, contentType: body.headers.get('content-type') } }), new Promise((_, no) => setTimeout(() => no(new Error('slow')), TIMEOUT_MS))]);
  return imageOf(await asImage(r && r.image !== undefined ? r.image : r));
}
export async function paintFree(env, prompt, size, seed, fetchFn = (u, o) => fetch(u, o)) {
  const token = String((env && env.POLLINATIONS_KEY) || '').trim(), ac = new AbortController(), t = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const res = await fetchFn(pollUrl(prompt, size, seed, token), { headers: token ? { authorization: 'Bearer ' + token } : {}, signal: ac.signal });
    const type = (res.headers.get('content-type') || '').toLowerCase();
    if (!res.ok || !/^image\/(jpeg|png)/.test(type)) return '';
    return imageOf(await asImage(res.body));
  } catch (_) { return ''; } finally { clearTimeout(t); }
}

export async function onRequestPost({ request, env }, fetchFn) {
  const here = new URL(request.url).origin, from = request.headers.get('origin');
  if (from && from !== here) return json({ state: 'refused', why: 'origin', say: 'same-origin only' }, 403);
  let b = {}; try { b = JSON.parse((await request.text()).slice(0, 2000)); } catch (_) { return json({ state: 'refused', why: 'bad', say: 'bad request' }, 400); }
  const de = b && b.lang === 'de';
  const prompt = cleanLine(b && b.prompt, PROMPT_MAX), negative = cleanLine(b && b.negative, NEGATIVE_MAX), style = styleOf(b && b.style), shape = shapeOf(b && b.shape), seed = seedOf(b && b.seed);
  const why = refusalOf(prompt, negative, style, isSecret);
  if (why) return json({ state: 'refused', why, say: say(why, de) });
  if (!env || !env.DB || !env.SALT) return resting('off', de);
  // the same words, style, shape and seed today: the picture already made, free
  const day = dayOf(), key = await cacheReq(here, [day, prompt, negative, style, shape, seed]);
  try { const hit = await caches.default.match(key); if (hit) return json({ ...(await hit.json()), cached: true }); } catch (_) {}
  const conn = await clientKey(request.headers.get('cf-connecting-ip'), day, env.SALT);
  if ((await bump(here, 'image:c:' + conn)) > PER_MINUTE) return resting('slow', de, 429, { 'retry-after': '60' });
  let ai = 0, poll = 0;
  try {
    await ensure(env);
    if ((await used(env, 'c:' + conn, day)) >= PER_CONN) return resting('mine', de, 429, { 'retry-after': String(secondsToMidnight()) });
    ai = await used(env, 'ai', day); poll = await used(env, 'poll', day);
  } catch (_) { return resting('off', de); }
  const full = promptOf(prompt, style, negative), size = SHAPES[shape];
  const aiRoom = !!env.AI && !/^(1|true|yes|on)$/i.test(String(env.ART_OFF || '').trim()) && ai < aiShareOf(env) && ai + (await forgeToday(env, day)) < capOf(env);
  const pollRoom = poll < POLL_CAP && !/^(0|false|no|off)$/i.test(String(env.ART_POLLINATIONS || '').trim());
  if (!aiRoom && !pollRoom) return resting('cap', de);
  let img = '', painter = '';
  if (aiRoom) { try { img = await paintAi(env, full, size, seed); } catch (_) { img = ''; } if (img) painter = 'workers-ai'; }
  if (!img && pollRoom) { img = await paintFree(env, full, size, seed, fetchFn); if (img) painter = 'pollinations'; }
  if (!img) return resting('busy', de);
  try { await tick(env, painter === 'workers-ai' ? 'ai' : 'poll', day); await tick(env, 'c:' + conn, day); } catch (_) {}
  const out = { state: 'art', img, seed, style, shape, painter, w: size[0], h: size[1] };
  try { await caches.default.put(key, new Response(JSON.stringify(out), { headers: { 'content-type': 'application/json', 'cache-control': 'max-age=86400' } })); } catch (_) {}
  return json(out);
}
// GET: how many pictures are left today for everyone (no input, nothing typed): the page shows it under the button
export async function onRequestGet({ env }) {
  if (!env || !env.DB || !env.SALT) return json({ left: 0, off: true });
  try { await ensure(env); const day = dayOf(), ai = await used(env, 'ai', day), poll = await used(env, 'poll', day), forge = await forgeToday(env, day);
    const aiLeft = env.AI ? Math.max(0, Math.min(aiShareOf(env) - ai, capOf(env) - forge - ai)) : 0;
    return json({ left: aiLeft + Math.max(0, POLL_CAP - poll), perConnection: PER_CONN }); } catch (_) { return json({ left: 0, off: true }); }
}
