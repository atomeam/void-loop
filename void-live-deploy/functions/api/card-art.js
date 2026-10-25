// The Art Forge, the server half (owner, 2026-10-17: "the art should be of the subject of each card"; lib/art-rules.js has the rules, lib/card-forge.js is the page).
// A card's subject in, one painted picture out, the same for everyone: the first time a folded subject is painted the image model is asked ONCE and the
// picture is kept in D1 (void_art, created here on first use) for ever; a cached picture is never made again. A GET only reads the cache. A POST reads
// it too, and on a miss paints. The model is Workers AI's text-to-image model through the site's own AI binding (lib/models.js models('art')): no
// other image binding exists on this site, and no R2 bucket is bound for public art, so the picture (a small jpeg or png, at most ~500 KB) is a base64 row.
//
// WHAT A STRANGER COULD MAKE THIS DO, AND WHY IT IS BOUNDED. This is an open endpoint. The most a caller can do is:
//   - read a cached picture for a folded subject (public by design: it came from the model, not from the caller);
//   - make Verse paint ONE new picture for a subject, never more than RL_MAX times a minute per connection (the answer route's rateLimited(), its own
//     bucket), never more than CAP images a day for everyone together (env ART_DAILY_CAP, default 30, counted in D1), and never at all when ART_OFF=1.
//     A second ask for the same subject costs nothing: it reads the row. The model sees a FIXED template with only the folded key (letters, digits,
//     spaces: no markup or quotes), the kind and the rarity from short allow-lists, so a typed instruction never reaches it. The Art Director's
//     text call before it sees the same folded key, kind and family (an allow-list) and nothing else, and its scene is cut to plain words and
//     refused like a subject (sceneOf), so it widens nothing; it runs only when a painting is about to be made (under the cap, after the rate limit). Subjects that are a real
//     person, sexual, hateful, a brand or an artist, a secret or key shape, or refused by the keeper get no model call;
//   - ask for a NEW painting of a subject already painted (`again: true`): at most once a day per subject, inside the same cap and rate limit,
//     replacing the row only when the new picture is good;
//   - past the Workers AI cap, or when it fails, the same prompt goes to Pollinations (free; POLL_CAP more a day), never with anything typed;
//   - fill the table: one row per distinct folded subject (at most ~700 KB), only when the model really drew, and only up to the daily cap.
// Nothing a person typed is stored and nobody is recorded: the row holds the folded key, the picture and the day. A model that fails, is busy, or
// returns something that is not a small jpeg or png gives { state: 'plate' } and writes NOTHING, so a bad moment is never cached and the card keeps
// Verse's ink plate. Over the cap is the same answer.
import { rateLimited } from './answer.js';
import { imageAiToday } from './image.js';
import { redact } from '../../lib/automation-fix.js';
import { scrubOut } from '../../lib/keeper.js';
import { leadPhoto, PHOTO_ASK } from '../../lib/wiki-look.js';
import { models, ART_FALLBACK } from '../../lib/models.js';
import { rawSubject, subjectKey, kindWordOf, rarityOf, refusal, artPrompt, imageOf, ART_W, ART_H, DIRECTOR_SYSTEM, directorPrompt, sceneOf, directedPrompt, LOOK_SYSTEM, lookPrompt, lookOf, lookParts, spellingOf, cartoonPrompt, keyOfKind, sizeOfKind, drawableLook, undirected } from '../../lib/art-rules.js';

export const RL_MAX = 3, TIMEOUT_MS = 40000, DEFAULT_CAP = 30, DIRECT_MS = 12000, POLL_CAP = 100; // POLL_CAP: free paintings a day from Pollinations past the Workers AI cap (bounded by D1 storage, ~250 KB a row)
const json = (o, status = 200, extra = {}) => Response.json(o, { status, headers: extra });
const on = (env) => !!(env && env.AI) && !/^(1|true|yes|on)$/i.test(String(env.ART_OFF || '').trim());
/** the daily cap (owner, 2026-10-17: Verse spends only what it has earned; with no earnings there is no budget): ART_DAILY_CAP when it is a whole number from 0 up, else 30,
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

// a cartoon's name as usually spelled (lookFor), kept beside its picture so a later ask with the same misspelling gets the right name too
async function nameOf(env, key) {
  if (!/^cartoon\d+ /.test(key)) return '';
  try { const r = await env.DB.prepare('SELECT name FROM void_art_name WHERE subject = ?').bind(key).first(); return (r && r.name) || ''; } catch (_) { return ''; }
}
async function keepName(env, key, name) {
  if (!name) return;
  try { await env.DB.prepare('CREATE TABLE IF NOT EXISTS void_art_name (subject TEXT PRIMARY KEY, name TEXT NOT NULL)').run(); await env.DB.prepare('INSERT OR REPLACE INTO void_art_name (subject, name) VALUES (?, ?)').bind(key, name).run(); } catch (_) {}
}
async function cached(env, key) {
  try { await ensure(env); return await env.DB.prepare('SELECT img, day FROM void_art WHERE subject = ?').bind(key).first(); } catch (_) { return null; }
}
// the image page's Workers AI pictures (functions/api/image.js) count here too: the two share one daily cap, so /image/ spends nothing new
async function madeToday(env) {
  try { await ensure(env); const r = await env.DB.prepare('SELECT COUNT(*) AS n FROM void_art WHERE day = ?').bind(today()).first(); return (Number(r && r.n) || 0) + (await imageAiToday(env)); } catch (_) { return Infinity; }
}
// why a paint gave the plate, counted by day (owner, 2026-10-17: "still no art": three paintings in a day, and nothing said why). The reason is the model's
// own error (cut to 80 characters, keys and secrets removed), "timeout" or "not an image"; never a subject or anything typed. Read with D1: void_art_miss.
export const missWhy = (e) => (e && /^slow$/.test(e.message) ? 'timeout' : redact(String((e && e.message) || e || 'error')).replace(/\s+/g, ' ').slice(0, 80));
async function noteMiss(env, why) {
  try { await env.DB.prepare('CREATE TABLE IF NOT EXISTS void_art_miss (day TEXT NOT NULL, why TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (day, why))').run();
    await env.DB.prepare('INSERT INTO void_art_miss (day, why, n) VALUES (?, ?, 1) ON CONFLICT(day, why) DO UPDATE SET n = n + 1').bind(today(), why).run(); } catch (_) {}
}
// the Art Director (lib/art-rules.js): one short call to the free text model with the folded subject, the kind and the family (allow-lists only);
// its scene is cleaned and checked by sceneOf, and anything that fails, is slow or is refused gives '' and the fixed template paints instead
const pick = (r) => (r && (r.response || (r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content) || (r.result && r.result.response))) || '';
export async function direct(env, key, kind, family, take = '', ask = [DIRECTOR_SYSTEM, directorPrompt(key, kind, family, take)], clean = sceneOf, maxTokens = 90) {
  try {
    const r = await Promise.race([
      env.AI.run(models('merge'), { messages: [{ role: 'system', content: ask[0] }, { role: 'user', content: ask[1] }], max_tokens: maxTokens }),
      new Promise((_, no) => setTimeout(() => no(new Error('slow')), DIRECT_MS)),
    ]);
    return clean(scrubOut(redact(String(pick(r))), env), isSecret);
  } catch (_) { return ''; }
}
// a cartoon's look (lib/art-rules.js LOOK_SYSTEM): { look, why } where why says, when there is no look, what happened: 'error <name>', 'empty'
// (the reply had no text), 'unknown' or 'refused' (the cleaned reply failed lookOf), with the reply's first words cleaned to plain letters, so a
// builder can see it (the art-look workflow). The reply is the model's words about the subject, never what a person typed.
export async function lookFor(env, key) {
  const photoWhy = [], seen = await photoLook(env, String(key).replace(/^cartoon\d* /, ''), undefined, photoWhy);
  if (seen && drawableLook(seen.look)) return { look: seen.look, name: seen.name, why: '', source: seen.source };
  if (seen) photoWhy.push('the photo is a table or text, not a thing to draw'); // lib/art-rules.js FLAT_LOOK: the text model is asked instead
  const res = await lookFromText(env, key); return { ...res, ...(seen && !res.look ? { flat: true } : {}), photoWhy: photoWhy.join('; ').slice(0, 200) }; // why the photo was not used, so a builder can see it
}
// whether a cartoon's painting may be kept for ever: drawn from the photo, or from words when there is no photo to be had (no page by that name, no free
// image). A photo that exists but was lost on the way (a Commons, download or vision error) or a look that failed leaves the painting unkept, so the
// next ask tries the photo again; 'unknown' is an answer and is kept (2026-10-24: a text look drew Dimebag with a short brown goatee and a plain guitar)
const NO_PHOTO = /^(?:name too short|no search hit|top page .* is not that name|page type|no wikidata item|no wikidata image|wikidata image is not)/;
export function keepable(seen) {
  if (!seen || seen.source === 'wikipedia') return true;
  if (!seen.look) return !/^(?:error|empty)\b/.test(seen.why || '');
  const first = String(seen.photoWhy || '').split('; ')[0];
  return !first || NO_PHOTO.test(first) || /^no AI binding/.test(first);
}
async function lookFromText(env, key) {
  let text = '';
  try {
    const r = await Promise.race([
      // the answer model (gpt-oss-120b), not the small free one: one call per subject ever (the picture is kept), and the free model knew a famous
      // guitarist only as "a long dark beard and a lightning-bolt guitar" (live, 2026-10-24), missing the dyed goatee and the outfit
      env.AI.run(models('answer'), { messages: [{ role: 'system', content: LOOK_SYSTEM }, { role: 'user', content: lookPrompt(key) }], max_tokens: 700, chat_template_kwargs: { enable_thinking: false }, reasoning_effort: 'low' }), // a thinking model spent the 400 tokens thinking and said nothing (live, 2026-10-24: 'empty ... choices')
      new Promise((_, no) => setTimeout(() => no(new Error('slow')), DIRECT_MS)),
    ]);
    text = scrubOut(redact(String(pick(r))), env);
    if (!text.trim()) return { look: '', why: 'empty ' + (r && typeof r === 'object' ? Object.keys(r).join(',').slice(0, 60) + (r.choices && r.choices[0] ? ' finish ' + String(r.choices[0].finish_reason || '').slice(0, 20) : '') : typeof r) };
  } catch (e) { return { look: '', why: 'error ' + String(e && e.message || e).replace(/[^A-Za-z0-9 .:-]/g, ' ').slice(0, 80) }; }
  const parts = lookParts(text), name = spellingOf(String(key).replace(/^cartoon\d* /, ''), parts.name), look = lookOf(parts.text, isSecret), said = text.replace(/[^A-Za-z0-9 ,.'-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
  if (look && !drawableLook(look)) return { look: '', name, flat: true, why: 'flat: ' + said }; // a table or text again: the mascot prompt draws it (lib/art-rules.js cartoonPrompt)
  return look ? { look, name, why: '' } : { look: '', name, why: (/\bunknown\b/i.test(text) ? 'unknown' : 'refused') + ': ' + said };
}
// a cartoon's look from a real photo (lib/wiki-look.js; owner, 2026-10-24, the "dimebag darrel" cartoon was a made-up guitarist because a language model
// describes a person from memory): Wikipedia's lead photo of the page the name means, described by the vision model in plain visual words. { look, name, source }
// or null when there is no such page or photo, nothing was seen, or the description fails the scene checks; the caller then asks the text model as before.
export async function photoLook(env, asked, get = (u, o) => fetch(u, o), why = []) {
  if (!env || !env.AI) { why.push('no AI binding'); return null; }
  const ph = await leadPhoto(asked, get, why); if (!ph) return null;
  try {
    const r = await Promise.race([
      env.AI.run(models('vision'), { messages: [{ role: 'user', content: [{ type: 'text', text: PHOTO_ASK }, { type: 'image_url', image_url: { url: ph.img } }] }], max_tokens: 400, chat_template_kwargs: { enable_thinking: false }, reasoning_effort: 'low' }),
      new Promise((_, no) => setTimeout(() => no(new Error('slow')), DIRECT_MS + 8000)),
    ]);
    const said = scrubOut(redact(String(pick(r))), env), look = lookOf(said, isSecret); if (!look) { why.push('vision said ' + (said.trim() ? 'something refused: ' + said.replace(/[^A-Za-z0-9 ,.'-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) : 'nothing (' + (r && typeof r === 'object' ? Object.keys(r).join(',').slice(0, 40) : typeof r) + ')')); return null; }
    // Wikipedia's one line on what the subject is ("American guitarist"), so a headshot that crops out the guitar still paints a guitarist
    const role = String(ph.description || '').replace(/\s*\(?\s*(?:born|b\.|c\.)?\s*\d{3,4}\b.*$/i, '').replace(/\s+(?:born|b\.)$/i, '').trim(); // "(born 1968)", "(1966-2004)" and a dangling "born" go
    return { look: role ? look + '; ' + role.charAt(0).toLowerCase() + role.slice(1) : look, name: ph.usual, source: 'wikipedia' };
  } catch (e) { why.push('vision error ' + String((e && e.message) || e).replace(/[^A-Za-z0-9 .:-]/g, ' ').slice(0, 60)); return null; }
}
// one painting from one model: FLUX.2 [klein] takes multipart form data with the card's 16:9 art window or a poster's tall 2:3 (its steps are fixed at 4); schnell takes JSON
// and paints a square. The reply is { image: base64 }, or a stream of the image's bytes, read here.
export function paintOnce(env, model, prompt, [w, h] = [ART_W, ART_H]) {
  if (!/flux-2/.test(model)) return env.AI.run(model, { prompt, steps: 4 });
  const form = new FormData(); form.append('prompt', prompt); form.append('width', String(w)); form.append('height', String(h));
  const body = new Response(form);
  return env.AI.run(model, { multipart: { body: body.body, contentType: body.headers.get('content-type') } });
}
export async function asImage(r) {
  if (!r || typeof r.getReader !== 'function') return r;
  const buf = new Uint8Array(await new Response(r).arrayBuffer()); let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  return btoa(s);
}
// Pollinations (open source, free): with a POLLINATIONS_KEY secret (a free account's key) its keyed endpoint, else the anonymous one. The prompt is the same
// fixed or directed prompt (nothing typed), the size the card's 16:9 window, the seed the subject's, so a subject asks for one picture. ART_POLLINATIONS=0 turns it off.
export const pollOn = (env) => !/^(0|false|no|off)$/i.test(String((env && env.ART_POLLINATIONS) || '').trim());
export function pollinationsUrl(prompt, key, token = '', [w, h] = [ART_W, ART_H]) {
  let seed = 0; for (const ch of String(key)) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const q = 'width=' + w + '&height=' + h + '&seed=' + (seed % 1000000) + '&nologo=true';
  return token ? 'https://gen.pollinations.ai/image/' + encodeURIComponent(prompt) + '?' + q : 'https://image.pollinations.ai/prompt/' + encodeURIComponent(prompt) + '?' + q + '&model=flux';
}
export async function pollinations(env, prompt, key, fetchFn = (u, o) => fetch(u, o), size = [ART_W, ART_H]) {
  const token = String((env && env.POLLINATIONS_KEY) || '').trim(), ac = new AbortController(), t = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const res = await fetchFn(pollinationsUrl(prompt, key, token, size), { headers: token ? { authorization: 'Bearer ' + token } : {}, signal: ac.signal });
    const type = (res.headers.get('content-type') || '').toLowerCase();
    if (!res.ok || !/^image\/(jpeg|png)/.test(type)) throw new Error('answered ' + res.status + ' ' + type.slice(0, 20));
    return imageOf(await asImage(res.body));
  } finally { clearTimeout(t); }
}
const hit = (row, key) => ({ state: 'art', key, img: row.img, cached: true, day: row.day });
const plate = (why, extra = {}) => json({ state: 'plate', why, ...extra });

export async function onRequestGet({ request, env }) {
  const u = new URL(request.url), raw = u.searchParams.get('key'), kind = u.searchParams.get('kind');
  const key = keyOfKind(subjectKey(raw), kind); // a cartoon and a poster keep rows of their own (lib/art-rules.js)
  if (!key) return json({ error: 'a subject, please' }, 400);
  const why = refusal(raw, kind, isSecret);
  if (why) return plate(why);
  const row = await cached(env, key);
  if (row) { const name = await nameOf(env, key); return json({ ...hit(row, key), ...(name ? { name } : {}) }, 200, { 'cache-control': 'public, max-age=3600' }); }
  if (!on(env)) return plate('off', {}); // nothing can be painted: the page shows no button
  if ((await madeToday(env)) >= capOf(env)) return plate('cap');
  return json({ state: 'none', key }, 200, { 'cache-control': 'no-store' });
}

export async function onRequestPost({ request, env }) {
  let body = {};
  try { body = JSON.parse((await request.text()).slice(0, 2000)); } catch (_) { return new Response('bad', { status: 400 }); }
  const raw = rawSubject(body && body.subject), kind = kindWordOf(body && body.kind), rarity = rarityOf(body && body.rarity);
  const key = keyOfKind(subjectKey(raw), kind), size = sizeOfKind(kind); // a cartoon and a poster keep rows of their own; a poster is painted tall (lib/art-rules.js)
  if (!key) return json({ error: 'a subject, please' }, 400);
  const why = refusal(raw, kind, isSecret);
  if (why) return plate(why);
  const row = await cached(env, key), again = !!(body && body.again === true);
  // a new painting of a subject already painted (owner, 2026-10-18: "each card could have a regenerate card art button"): at most once a day per
  // subject (the row's day says when it was last painted), counted in the same daily cap and rate limit; the old picture stays if the new one fails
  if (row && (!again || row.day === today())) { const name = await nameOf(env, key); return json({ ...hit(row, key), ...(name ? { name } : {}), ...(again ? { why: 'again-today' } : {}) }); }
  if (!on(env)) return plate('off');
  const made = await madeToday(env), overWorkers = made >= capOf(env);
  if (overWorkers && (!pollOn(env) || made >= capOf(env) + POLL_CAP)) return plate('cap');
  if (await rateLimited(request, env, 'card-art', RL_MAX)) return json({ state: 'plate', why: 'slow', error: 'slow down' }, 429);
  // the Art Director's scene (from the card and Verse's take on it), or '' for the fixed template; a cartoon gets its look instead (lib/art-rules.js LOOK_SYSTEM)
  const seen = kind === 'cartoon' ? await lookFor(env, key) : { look: '', why: '' }, look = seen.look, scene = undirected(kind) ? '' : await direct(env, key, kind, body && body.family, body && body.take); // a cartoon, a poster and a backdrop paint from their own templates (lib/art-rules.js)
  let img = '';
  try {
    const prompt = scene ? directedPrompt(scene, rarity) : kind === 'cartoon' ? cartoonPrompt(seen.name ? 'cartoon ' + seen.name.toLowerCase() : key, look, { mascot: !!seen.flat }) : artPrompt(key, kind, rarity), slow = () => new Promise((_, no) => setTimeout(() => no(new Error('slow')), TIMEOUT_MS));
    let r = null;
    if (!overWorkers) {
      try { r = await Promise.race([paintOnce(env, models('art'), prompt, size), slow()]); img = imageOf(await asImage(r)); } catch (e) { await noteMiss(env, 'klein ' + missWhy(e)); }
      if (!img && models('art') !== ART_FALLBACK) { try { r = await Promise.race([paintOnce(env, ART_FALLBACK, prompt, size), slow()]); img = imageOf(await asImage(r)); } catch (e) { await noteMiss(env, 'schnell ' + missWhy(e)); } } // the square model, cropped into the window
    }
    // past the Workers AI share, or when it failed: Pollinations, free (owner, 2026-10-18: "try to find fallbacks ... for free")
    if (!img && pollOn(env)) { try { img = await pollinations(env, prompt, key, undefined, size); } catch (e) { await noteMiss(env, 'pollinations ' + missWhy(e)); } }
    if (!img && !r) throw new Error('no painter answered');
    if (!img) await noteMiss(env, 'not an image: ' + (r && typeof r === 'object' ? Object.keys(r).join(',').slice(0, 40) : typeof r));
  } catch (e) { await noteMiss(env, missWhy(e)); return plate('busy'); }
  if (!img) return plate('busy'); // nothing usable: nothing is kept
  const told = kind === 'cartoon' ? { look, lookWhy: seen.why, lookFrom: seen.source || 'text model', ...(seen.photoWhy ? { photoWhy: seen.photoWhy } : {}), ...(seen.name ? { name: seen.name } : {}) } : {};
  // a cartoon painted without a look because the look failed (no photo, and the text model erred or said nothing; 'unknown' is an answer and is kept) is a guess at the subject: shown once, never kept, so the next ask tries
  // again instead of serving the guess for ever (2026-10-24: the kept "dimebag darrel" was a smiling stranger in a blue shirt, painted when the look timed out)
  if (kind === 'cartoon' && !keepable(seen)) return json({ state: 'art', key, img, cached: false, kept: false, ...told });
  await keepName(env, key, seen.name);
  try {
    await ensure(env);
    if (row) { await env.DB.prepare('UPDATE void_art SET img = ?, day = ? WHERE subject = ?').bind(img, today(), key).run(); return json({ state: 'art', key, img, cached: false, again: true, ...told }); }
    await env.DB.prepare('INSERT OR IGNORE INTO void_art (subject, img, day) VALUES (?, ?, ?)').bind(key, img, today()).run();
    const won = await cached(env, key); // two people at once: both get the picture stored first
    if (won) return json({ ...hit(won, key), cached: false, ...told });
  } catch (_) {}
  return json({ state: 'art', key, img, cached: false, ...told });
}
