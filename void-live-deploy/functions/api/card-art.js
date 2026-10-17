// The Art Forge, the server half (owner, 2026-10-17: "the art should be of the subject of each card"; lib/art-rules.js has the rules, lib/card-forge.js is the page).
// A card's subject in, one painted picture out, the same for everyone: the first time a folded subject is painted the image model is asked ONCE and the
// picture is kept in D1 (void_art, created here on first use) for ever; a cached picture is never made again. A GET only reads the cache. A POST reads
// it too, and on a miss paints. The model is Workers AI's text-to-image model through the site's own AI binding (lib/models.js models('art')): no
// other image binding exists on this site, and no R2 bucket is bound for public art, so the picture (a small jpeg or png, at most ~500 KB) is a base64 row.
//
// WHAT A STRANGER COULD MAKE THIS DO, AND WHY IT IS BOUNDED. This is an open endpoint. The most a caller can do is:
//   - read a cached picture for a folded subject (public by design: it came from the model, not from the caller);
//   - make V01D paint ONE new picture for a subject, never more than RL_MAX times a minute per connection (the answer route's rateLimited(), its own
//     bucket), never more than CAP images a day for everyone together (env ART_DAILY_CAP, default 30, counted in D1), and never at all when ART_OFF=1.
//     A second ask for the same subject costs nothing: it reads the row. The model sees a FIXED template with only the folded key (letters, digits,
//     spaces: no markup or quotes), the kind and the rarity from short allow-lists, so a typed instruction never reaches it. Subjects that are a real
//     person, sexual, hateful, a brand or an artist, a secret or key shape, or refused by the keeper get no model call;
//   - fill the table: one row per distinct folded subject (at most ~700 KB), only when the model really drew, and only up to the daily cap.
// Nothing a person typed is stored and nobody is recorded: the row holds the folded key, the picture and the day. A model that fails, is busy, or
// returns something that is not a small jpeg or png gives { state: 'plate' } and writes NOTHING, so a bad moment is never cached and the card keeps
// V01D's ink plate. Over the cap is the same answer.
import { rateLimited } from './answer.js';
import { redact } from '../../lib/automation-fix.js';
import { scrubOut } from '../../lib/keeper.js';
import { models } from '../../lib/models.js';
import { rawSubject, subjectKey, kindWordOf, rarityOf, refusal, artPrompt, imageOf } from '../../lib/art-rules.js';

export const RL_MAX = 3, TIMEOUT_MS = 40000, DEFAULT_CAP = 30;
const json = (o, status = 200, extra = {}) => Response.json(o, { status, headers: extra });
const on = (env) => !!(env && env.AI) && !/^(1|true|yes|on)$/i.test(String(env.ART_OFF || '').trim());
/** the daily cap (owner, 2026-10-17: V01D spends only what it has earned; with no earnings there is no budget): ART_DAILY_CAP when it is a whole number from 0 up, else 30,
 *  and NEVER above FREE_CAP, the free allowance's share this route may use. There is deliberately no path past it: raising it later means reading /api/earnings
 *  (owner-only, net of refunds) for money that covers it and logging each paid painting publicly, and that code does not exist yet. Pure. */
export const FREE_CAP = 30;
export const capOf = (env) => { const n = Math.floor(Number(env && env.ART_DAILY_CAP)); return Number.isFinite(n) && n >= 0 && String(env.ART_DAILY_CAP).trim() !== '' ? Math.min(n, FREE_CAP) : DEFAULT_CAP; };
const today = () => new Date().toISOString().slice(0, 10);
const isSecret = (t) => redact(t) !== t || scrubOut(t) !== t;

let ready = null;
async function ensure(env) {
  if (!ready) ready = env.DB.prepare('CREATE TABLE IF NOT EXISTS void_art (subject TEXT PRIMARY KEY, img TEXT NOT NULL, day TEXT NOT NULL)').run().catch((e) => { ready = null; throw e; });
  await ready;
}
export const resetReady = () => { ready = null; }; // tests: a new fake database needs its table made again

async function cached(env, key) {
  try { await ensure(env); return await env.DB.prepare('SELECT img, day FROM void_art WHERE subject = ?').bind(key).first(); } catch (_) { return null; }
}
async function madeToday(env) {
  try { await ensure(env); const r = await env.DB.prepare('SELECT COUNT(*) AS n FROM void_art WHERE day = ?').bind(today()).first(); return Number(r && r.n) || 0; } catch (_) { return Infinity; }
}
// why a paint gave the plate, counted by day (owner, 2026-10-17: "still no art": three paintings in a day, and nothing said why). The reason is the model's
// own error (cut to 80 characters, keys and secrets removed), "timeout" or "not an image"; never a subject or anything typed. Read with D1: void_art_miss.
export const missWhy = (e) => (e && /^slow$/.test(e.message) ? 'timeout' : redact(String((e && e.message) || e || 'error')).replace(/\s+/g, ' ').slice(0, 80));
async function noteMiss(env, why) {
  try { await env.DB.prepare('CREATE TABLE IF NOT EXISTS void_art_miss (day TEXT NOT NULL, why TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (day, why))').run();
    await env.DB.prepare('INSERT INTO void_art_miss (day, why, n) VALUES (?, ?, 1) ON CONFLICT(day, why) DO UPDATE SET n = n + 1').bind(today(), why).run(); } catch (_) {}
}
const hit = (row, key) => ({ state: 'art', key, img: row.img, cached: true, day: row.day });
const plate = (why, extra = {}) => json({ state: 'plate', why, ...extra });

export async function onRequestGet({ request, env }) {
  const u = new URL(request.url), raw = u.searchParams.get('key'), kind = u.searchParams.get('kind');
  const key = subjectKey(raw);
  if (!key) return json({ error: 'a subject, please' }, 400);
  const why = refusal(raw, kind, isSecret);
  if (why) return plate(why);
  const row = await cached(env, key);
  if (row) return json(hit(row, key), 200, { 'cache-control': 'public, max-age=3600' });
  if (!on(env)) return plate('off', {}); // nothing can be painted: the page shows no button
  if ((await madeToday(env)) >= capOf(env)) return plate('cap');
  return json({ state: 'none', key }, 200, { 'cache-control': 'no-store' });
}

export async function onRequestPost({ request, env }) {
  let body = {};
  try { body = JSON.parse((await request.text()).slice(0, 2000)); } catch (_) { return new Response('bad', { status: 400 }); }
  const raw = rawSubject(body && body.subject), key = subjectKey(raw);
  if (!key) return json({ error: 'a subject, please' }, 400);
  const kind = kindWordOf(body && body.kind), rarity = rarityOf(body && body.rarity);
  const why = refusal(raw, kind, isSecret);
  if (why) return plate(why);
  const row = await cached(env, key);
  if (row) return json(hit(row, key));
  if (!on(env)) return plate('off');
  if ((await madeToday(env)) >= capOf(env)) return plate('cap');
  if (await rateLimited(request, env, 'card-art', RL_MAX)) return json({ state: 'plate', why: 'slow', error: 'slow down' }, 429);
  let img = '';
  try {
    const r = await Promise.race([
      env.AI.run(models('art'), { prompt: artPrompt(key, kind, rarity), steps: 4 }),
      new Promise((_, no) => setTimeout(() => no(new Error('slow')), TIMEOUT_MS)),
    ]);
    img = imageOf(r);
    if (!img) await noteMiss(env, 'not an image: ' + (r && typeof r === 'object' ? Object.keys(r).join(',').slice(0, 40) : typeof r));
  } catch (e) { await noteMiss(env, missWhy(e)); return plate('busy'); }
  if (!img) return plate('busy'); // nothing usable: nothing is kept
  try {
    await ensure(env);
    await env.DB.prepare('INSERT OR IGNORE INTO void_art (subject, img, day) VALUES (?, ?, ?)').bind(key, img, today()).run();
    const won = await cached(env, key); // two people at once: both get the picture stored first
    if (won) return json({ ...hit(won, key), cached: false });
  } catch (_) {}
  return json({ state: 'art', key, img, cached: false });
}
