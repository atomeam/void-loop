// /api/clip: the AI video page's server half (owner, 2026-10-30: "same with image and video ... we should have the best of everything"); the rules
// are in lib/video-gen.js, the page is /video/, the clip itself comes from functions/api/studio.js makeVideo (a partner video model on Workers AI).
//   GET  /api/clip                 whether video is on, why not, and when Verse last tested it. While it is off and the last test is older than
//                                  six hours, this GET also starts the self-check: one 1 second draft clip (half a cent). Only a real clip turns
//                                  the page on; an answer with no clip leaves it off with the model's reason ("credits" when the account has none).
//   GET  /api/clip?probe=1         (owner key) the self-check now, waited for, with the model's own answer
//   POST { prompt, seconds, shape, from }  one clip; `from` names a picture /api/image made today or yesterday (its words, style, shape and seed),
//                                  found in the edge cache, so the first frame is always Verse's own picture and never an upload
//
// WHAT A STRANGER COULD MAKE THIS DO, AND WHY IT IS BOUNDED. No account. A caller can:
//   - make one short clip (2, 3 or 5 seconds, draft quality, 720p) of a typed prompt of at most 400 characters. The words are checked first with
//     /image/'s rules (lib/image-gen.js refusalOf: sexual, hateful, a named real person, the keeper's list, anything like a key get no model call),
//     and the model's own safety filter stays on;
//   - do that PER_MINUTE times a minute and PER_CONN times a day from one connection (SHA-256 of the address, the UTC day and SALT; the address is
//     never stored), and only while today's dollars last: PUBLIC_VIDEO_DAILY_USD (default $0.25, at most $2), counted in D1 by day before the
//     clip is answered. A clip is reserved against the connection's count before the model runs, so parallel asks cannot pass it;
//   - start the self-check by reading GET, at most once every six hours, inside PROBE_DAILY_USD ($0.02) a day, and only while video is off.
// Nothing typed is stored: D1 holds counters, dollars and the self-check's state ('on', a reason word, a time). STUDIO_OFF=1, no AI binding, no D1
// or no SALT turns the route off (the page says so). Same-origin only. What is NOT prevented: many addresses can each make PER_CONN clips until the
// day's dollars are spent; the cap is what bounds the money.
import { bump, ownerOk } from '../../lib/guard.js';
import { clientKey, dayOf, secondsToMidnight } from '../../lib/reactions.js';
import { redact } from '../../lib/automation-fix.js';
import { scrubOut } from '../../lib/keeper.js';
import { styleOf, shapeOf as imageShapeOf, seedOf, cleanLine, NEGATIVE_MAX } from '../../lib/image-gen.js';
import { videoAskOf } from '../../lib/studio.js';
import { ASPECTS, PER_MINUTE, PER_CONN, PROBE_SECONDS, PROBE_DAILY_USD, PROBE_PROMPT, secondsOf, shapeOf, publicCapOf, noCredits, promptCheck, stateOf, afterProbe, sayOf } from '../../lib/video-gen.js';
import { makeVideo, ensureStudio } from './studio.js';
import { cacheReq } from './image.js';

const json = (o, status = 200, extra = {}) => Response.json(o, { status, headers: { 'cache-control': 'no-store', ...extra } });
const isSecret = (t) => redact(t) !== t || scrubOut(t) !== t;
const off = (env) => !env || !env.AI || !env.DB || /^(1|true|yes|on)$/i.test(String(env.STUDIO_OFF || '').trim());
const resting = (why, status = 200, extra = {}) => json({ state: 'resting', why, say: sayOf(why) }, status, extra);
const short = (s) => redact(String(s || '')).replace(/\s+/g, ' ').slice(0, 160);

let ready = null;
async function ensure(env) {
  if (!ready) ready = env.DB.batch([
    env.DB.prepare('CREATE TABLE IF NOT EXISTS void_clip_state (k TEXT PRIMARY KEY, on_ INTEGER NOT NULL, why TEXT NOT NULL, at INTEGER NOT NULL)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS void_clip_days (k TEXT PRIMARY KEY, day TEXT NOT NULL, n INTEGER NOT NULL)'),
  ]).then(() => ensureStudio(env)).catch((e) => { ready = null; throw e; });
  await ready;
}
export const resetReady = () => { ready = null; }; // tests: a new fake database needs its tables made again
const readState = async (env) => { const r = await env.DB.prepare('SELECT on_, why, at FROM void_clip_state WHERE k = ?').bind('video').first(); return r ? { on: r.on_, why: r.why, at: r.at } : null; };
const writeState = (env, s) => env.DB.prepare('INSERT INTO void_clip_state (k, on_, why, at) VALUES (?, ?, ?, ?) ON CONFLICT(k) DO UPDATE SET on_ = excluded.on_, why = excluded.why, at = excluded.at').bind('video', s.on, s.why, s.at).run();
const used = async (env, k, day) => { const r = await env.DB.prepare('SELECT n FROM void_clip_days WHERE k = ? AND day = ?').bind(k, day).first(); return r ? Number(r.n) || 0 : 0; };
const tick = (env, k, day, by = 1) => env.DB.prepare('INSERT INTO void_clip_days (k, day, n) VALUES (?, ?, ?) ON CONFLICT(k) DO UPDATE SET n = CASE WHEN day = excluded.day THEN n + excluded.n ELSE excluded.n END, day = excluded.day').bind(k, day, by).run();

/** whether a clip's address is a real video: the host answers with a video type (a HEAD, then a 1 KB GET for hosts that refuse HEAD) */
export async function isRealClip(url, fetchFn = (u, o) => fetch(u, o)) {
  if (!/^https:\/\//.test(String(url || ''))) return false;
  for (const o of [{ method: 'HEAD' }, { method: 'GET', headers: { range: 'bytes=0-1023' } }]) {
    try { const r = await fetchFn(url, o); const type = (r.headers.get('content-type') || '').toLowerCase(); if (r.ok && /^(?:video\/|application\/octet-stream)/.test(type)) return true; } catch (_) {}
  }
  return false;
}
/** the self-check: one 1 second draft clip; the stored state after it, and what the model said */
export async function probe(env, fetchFn) {
  const r = await makeVideo(env, { prompt: PROBE_PROMPT, model: 'p-video', seconds: PROBE_SECONDS, draft: true, aspect: '16:9' }, 'probe', PROBE_DAILY_USD);
  if (r.state === 'video') r.real = await isRealClip(r.url, fetchFn);
  const s = afterProbe(r);
  await writeState(env, s);
  return { state: s, model: { state: r.state, why: short(r.why), real: !!r.real, ms: r.ms } };
}

export async function onRequestGet({ request, env, waitUntil }, fetchFn) {
  const u = new URL((request && request.url) || 'https://x/');
  if (off(env)) return json({ on: false, why: 'off', say: sayOf('off') });
  try { await ensure(env); } catch (_) { return json({ on: false, why: 'off', say: sayOf('off') }); }
  if (u.searchParams.get('probe') === '1') {
    if (!(await ownerOk(request, env))) return json({ ok: false, error: 'owner only' }, 401);
    return json({ ok: true, ...(await probe(env, fetchFn)) });
  }
  let s = stateOf(await readState(env).catch(() => null));
  if (s.due) {
    // claim the check first, so a burst of visitors starts one test clip, not many
    await writeState(env, { on: 0, why: s.why, at: Date.now() }).catch(() => {});
    const run = probe(env, fetchFn).catch(() => {});
    if (typeof waitUntil === 'function') waitUntil(run); else await run;
    s = { ...s, checking: true };
  }
  const day = dayOf(), cap = publicCapOf(env);
  let left = 0; try { const r = await env.DB.prepare('SELECT usd FROM void_studio_spend WHERE day = ? AND who = ?').bind(day, 'public').first(); left = Math.max(0, cap - (r ? Number(r.usd) || 0 : 0)); } catch (_) {}
  const per5 = videoAskOf('p-video', { seconds: 5, draft: true }).usd;
  return json({ on: s.on, why: s.on ? 'ok' : s.why, say: s.on ? '' : sayOf(s.why), checkedAt: s.at ? new Date(s.at).toISOString() : null, checking: !!s.checking,
    clipsLeft: s.on ? Math.floor(left / per5 + 1e-9) : 0, perConnection: PER_CONN });
}

export async function onRequestPost({ request, env }) {
  const here = new URL(request.url).origin, from = request.headers.get('origin');
  if (from && from !== here) return json({ state: 'refused', why: 'origin', say: 'same-origin only' }, 403);
  let b = {}; try { b = JSON.parse((await request.text()).slice(0, 4000)); } catch (_) { return json({ state: 'refused', why: 'bad', say: 'bad request' }, 400); }
  const checked = promptCheck(b && b.prompt, isSecret);
  if (checked.why) return json({ state: 'refused', why: checked.why, say: sayOf(checked.why) });
  if (off(env) || !env.SALT) return resting('off');
  try { await ensure(env); } catch (_) { return resting('off'); }
  const s = stateOf(await readState(env).catch(() => null));
  if (!s.on) return resting(s.why === 'unchecked' ? 'unchecked' : s.why);
  const day = dayOf(), conn = await clientKey(request.headers.get('cf-connecting-ip'), day, env.SALT);
  if ((await bump(here, 'clip:c:' + conn)) > PER_MINUTE) return resting('slow', 429, { 'retry-after': '60' });
  if ((await used(env, 'c:' + conn, day)) >= PER_CONN) return resting('mine', 429, { 'retry-after': String(secondsToMidnight()) });
  // the first frame: a picture /api/image made today or yesterday, looked up by its own words, style, shape and seed (never bytes sent in)
  let image = '', shape = shapeOf(b.shape);
  if (b.from && typeof b.from === 'object') {
    const f = b.from, parts = [cleanLine(f.prompt, 400), cleanLine(f.negative, NEGATIVE_MAX), styleOf(f.style), imageShapeOf(f.shape), seedOf(f.seed)];
    for (const d of [day, dayOf(Date.now() - 864e5)]) {
      try { const r = await caches.default.match(await cacheReq(here, [d, ...parts])); const hit = r ? await r.json() : null; if (hit && /^data:image\/(?:jpeg|png);base64,/.test(hit.img || '')) { image = hit.img; break; } } catch (_) {}
    }
    if (!image) return resting('gone');
    shape = shapeOf(parts[3]);
  }
  await tick(env, 'c:' + conn, day).catch(() => {}); // reserved before the model runs
  const r = await makeVideo(env, { prompt: checked.prompt + ', safe for work', model: 'p-video', seconds: secondsOf(b.seconds), draft: true, aspect: ASPECTS[shape], image }, 'public', publicCapOf(env));
  if (r.state === 'video') return json({ state: 'video', url: r.url, seconds: r.seconds, shape, ms: r.ms });
  await tick(env, 'c:' + conn, day, -1).catch(() => {}); // no clip: the reservation goes back
  if (r.state === 'resting') return resting('cap');
  if (noCredits(r.why)) { await writeState(env, { on: 0, why: 'credits', at: Date.now() }).catch(() => {}); return resting('credits'); }
  return resting('busy');
}
