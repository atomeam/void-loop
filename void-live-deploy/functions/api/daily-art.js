// The daily picture for Verse's reports, the server half (owner, 2026-10-26: "we can have pictures that update daily too", then "actual pictures of the games").
// lib/daily-art.js (what pages import, the closed lists, the prompt, the SVG) and lib/daily-photo.js (the licence and credit rules) hold the pure parts.
//   GET ?kind=sports|news|finance&key=<league|section|wrap>&day=<today|yesterday>[&mood=<word>]   the picture itself (an <img src>): an illustration by Verse,
//       painted at most ONCE per kind, key and day for everyone, or a deterministic SVG when the day's budget is spent or the painter is resting.
//   ... &photo=1&q=<teams, venue, event>[&date=YYYY-MM-DD][&video=<id>]   (sports only) a real photo, when an openly licensed one qualifies; else the illustration.
//   ... &json=1                   the picture's true source and credit, and a verified official video embed when `video` is given.
//   ... &refresh=1                (owner key) paint today's illustration again.     DELETE ?photo=<id> (owner key)  take a photo down for good.
//   GET ?diag=1[&q=&key=&date=&try=1] (owner key) what each source answered, why a candidate was refused, the budget and the switches.
//
// WHAT A STRANGER COULD MAKE THIS DO, AND WHY IT IS BOUNDED. An open endpoint with no account.
//   - Illustrations: kind, key, day and mood come from closed lists (day: today or yesterday in UTC only), so the prompt is made only of our own words (no names, teams, logos;
//     lib/daily-art.js promptFor) and no typed word ever reaches a painter. The first request of a (kind, key, day) paints; every later one reads the kept picture. A separate
//     budget of DAILY_BUDGET pictures a day (config in lib/daily-art.js; the environment may only lower it) is not taken from visitors' /image/ allowance, and Workers AI
//     pictures are counted in the shared total with the Art Forge and /image/ (SHARED_AI_CEILING). A stranger could spend it on rare keys: keys outside PRIMARY get 80% of it,
//     one connection may start 3 paintings a day, one is in flight per key (a D1 lock), a failed key waits 10 minutes and tries 3 times a day. Spent or resting: the SVG.
//   - Photos: `q` is free text (teams, venue, event; 80 characters of letters and digits, rude or real-person words refused), so a stranger can make Verse ASK the three picture
//     sources and one video host about a phrase, never fetch from anywhere else: the hosts are fixed (lib/daily-photo.js HOSTS), only a candidate that passes the licence,
//     attribution and context filters is kept, and the answer is cached per (key, query, date, day) for everyone, a miss too. At most PHOTO_LOOKUPS_DAY lookups a day in all, 6
//     a day from one connection, PHOTO_ROWS_DAY kept pictures a day; a source that answers 429 is left alone until its Retry-After. A stranger CANNOT put a picture of their
//     own on the site: bytes come only from the sources' own thumbnails. THAT IS NOT PREVENTED: a freely licensed photo that is about sport can still show a minor or a person
//     who did not expect it, because no filter sees faces. The backstop is the report link under every photo (mailto) and the owner's delete.
//   - Nothing typed is stored but the cached search phrase's hash; no address is stored (connections are SHA-256 of address, day and SALT). With no D1 or SALT the route paints
//     nothing and answers the SVG. No agency or league site is ever fetched.
// Keys and switches: THESPORTSDB_KEY (off until the owner reads its terms), FLICKR_API_KEY (off until set), OPENVERSE_CLIENT_ID and OPENVERSE_CLIENT_SECRET (optional: higher limits),
// DAILY_ART_BUDGET (lower the budget), DAILY_ART_OFF=1 (no painting), DAILY_ART_CHANNELS (more official channels), ART_OFF=1 (the forge's switch also stops this).
import { bump, ownerOk } from '../../lib/guard.js';
import { clientKey, dayOf, secondsToMidnight } from '../../lib/reactions.js';
import { redact } from '../../lib/automation-fix.js';
import { promptOf, refusalOf, SHAPES } from '../../lib/image-gen.js';
import { imageOf } from '../../lib/art-rules.js';
import { FREE_CAP } from './card-art.js';
import { paintAi, paintFree } from './image.js';
import * as A from '../../lib/daily-art.js';
import * as P from '../../lib/daily-photo.js';
import * as FP from '../../lib/free-pics.js';
import { cap as dayCap } from '../../lib/daily-cap.js';

export const PHOTO_LOOKUPS_DAY = 120, PHOTO_CONN_DAY = 6, PHOTO_ROWS_DAY = 40, NONE_TTL_MS = 6 * 3600e3, LIMITED_TTL_MS = 30 * 60e3, FETCH_MS = 5000, DEADLINE_MS = 16000;
const json = (o, status = 200, extra = {}) => Response.json(o, { status, headers: { 'cache-control': 'no-store', ...extra } });
const enc = (s) => new TextEncoder().encode(s);
async function sha(s) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', enc(s)))].map((x) => x.toString(16).padStart(2, '0')).join(''); }
const bytesOf = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const dataOf = (u) => { const m = /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/]+={0,2})$/.exec(String(u || '')); return m ? { ct: m[1], b64: m[2] } : null; };
const why = (e) => redact(String((e && e.message) || e || 'error')).replace(/\s+/g, ' ').slice(0, 100);
const SAFE_HEADERS = { 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox", 'cross-origin-resource-policy': 'same-origin' };

let ready = null;
async function ensure(env) {
  if (!ready) ready = (async () => {
    const q = (s) => env.DB.prepare(s).run();
    await q('CREATE TABLE IF NOT EXISTS void_image_days (k TEXT PRIMARY KEY, day TEXT NOT NULL, n INTEGER NOT NULL)'); // the same table as functions/api/image.js
    await q('CREATE TABLE IF NOT EXISTS void_daily_art (k TEXT PRIMARY KEY, day TEXT NOT NULL, state TEXT NOT NULL, img TEXT NOT NULL, source TEXT NOT NULL, at INTEGER NOT NULL, attempts INTEGER NOT NULL)');
    await q('CREATE TABLE IF NOT EXISTS void_daily_photo (k TEXT PRIMARY KEY, day TEXT NOT NULL, state TEXT NOT NULL, meta TEXT NOT NULL, img TEXT NOT NULL, at INTEGER NOT NULL, id TEXT NOT NULL)');
    await q('CREATE TABLE IF NOT EXISTS void_daily_block (h TEXT PRIMARY KEY, at INTEGER NOT NULL)');
    await q('CREATE TABLE IF NOT EXISTS void_daily_src (src TEXT PRIMARY KEY, until INTEGER NOT NULL)');
  })().catch((e) => { ready = null; throw e; });
  await ready;
}
export const resetReady = () => { ready = null; };
const used = async (env, k, day) => { const r = await env.DB.prepare('SELECT n FROM void_image_days WHERE k = ? AND day = ?').bind(k, day).first(); return r ? Number(r.n) || 0 : 0; };
const tick = (env, k, day) => env.DB.prepare('INSERT INTO void_image_days (k, day, n) VALUES (?, ?, 1) ON CONFLICT(k) DO UPDATE SET n = CASE WHEN day = excluded.day THEN n + 1 ELSE 1 END, day = excluded.day').bind(k, day).run();
const forgeToday = async (env, day) => { try { const r = await env.DB.prepare('SELECT COUNT(*) AS n FROM void_art WHERE day = ?').bind(day).first(); return Number(r && r.n) || 0; } catch (_) { return 0; } };
/** the day's illustration budget: DAILY_ART_BUDGET when it is a whole number from 0 up, never above DAILY_BUDGET. Pure. */
export const budgetOf = (env) => { const v = env && env.DAILY_ART_BUDGET, n = Math.floor(Number(v)); return v !== undefined && String(v).trim() !== '' && Number.isFinite(n) && n >= 0 ? Math.min(n, A.DAILY_BUDGET) : A.DAILY_BUDGET; };
/** how many of the day's pictures the key may take: primary keys all of it, the others 80%. Pure. */
export const allowedFor = (env, kind, key) => (A.isPrimary(kind, key) ? budgetOf(env) : Math.floor(budgetOf(env) * A.NON_PRIMARY_SHARE));
const flag = (v) => /^(1|true|yes|on)$/i.test(String(v || '').trim());

// ---- responses ----
const imageRes = (ct, bytes, source, maxAge, extra = {}) => new Response(bytes, { headers: { 'content-type': ct, 'cache-control': 'public, max-age=' + maxAge, 'x-illustration': source === 'photo' ? 'photo' : A.LABEL, 'x-art-source': source, ...SAFE_HEADERS, ...extra } });
const svgRes = (svg, note) => new Response(svg, { headers: { 'content-type': 'image/svg+xml', 'cache-control': 'public, max-age=300', 'x-illustration': A.LABEL, 'x-art-source': 'fallback', 'x-art-note': note, ...SAFE_HEADERS } });

// ---- the edge cache: one entry per kept picture, so a day's readers cost no D1 read ----
const ckey = (origin, k) => new Request(origin + '/__void-daily-art/' + encodeURIComponent(k));
async function cacheGet(origin, k) { try { const r = await caches.default.match(ckey(origin, k)); return r ? await r.json() : null; } catch (_) { return null; } }
async function cachePut(origin, k, o, ttl = 3600) { try { await caches.default.put(ckey(origin, k), new Response(JSON.stringify(o), { headers: { 'content-type': 'application/json', 'cache-control': 'max-age=' + ttl } })); } catch (_) {} }
async function cacheDel(origin, k) { try { await caches.default.delete(ckey(origin, k)); } catch (_) {} }

// ---- a fetch that stops, says 429, and never prints a key ----
class Limited extends Error { constructor(src, retry) { super(src + ' answered 429'); this.status = 429; this.retry = retry; } }
async function get(fetchFn, url, { headers = {}, method = 'GET', body = undefined, ms = FETCH_MS } = {}) {
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), ms);
  try { return await fetchFn(url, { method, body, headers: { 'user-agent': P.UA, accept: '*/*', ...headers }, signal: ac.signal }); } finally { clearTimeout(t); }
}
async function getJson(fetchFn, src, url, opts) {
  const r = await get(fetchFn, url, opts);
  if (r.status === 429) throw new Limited(src, Math.max(60, Math.min(86400, parseInt(r.headers.get('retry-after') || '3600', 10) || 3600)));
  if (!r.ok) throw new Error(src + ' answered ' + r.status);
  return r.json();
}
const bytesFrom = async (fetchFn, src, url) => {
  const r = await get(fetchFn, url, { headers: { accept: 'image/jpeg,image/png' }, ms: 8000 });
  if (r.status === 429) throw new Limited(src, 3600);
  const ct = (r.headers.get('content-type') || '').toLowerCase(); if (!r.ok || !/^image\/(?:jpeg|png)/.test(ct)) throw new Error(src + ' image answered ' + r.status + ' ' + ct.slice(0, 20));
  const buf = new Uint8Array(await r.arrayBuffer()); if (buf.length > P.MAX_BYTES) throw new Error('image too big (' + buf.length + ' bytes)');
  let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  const img = imageOf(btoa(s)); if (!img) throw new Error('not a usable image'); return img;
};

// ---- the photo sources (lib/daily-photo.js reads what they return) ----
const SOURCES = ['commons', 'openverse', 'flickr', 'thesportsdb'];
const sourceOn = (env, s) => (s === 'flickr' ? !!String(env.FLICKR_API_KEY || '').trim() : s === 'thesportsdb' ? !!String(env.THESPORTSDB_KEY || '').trim() : true);
async function openverseToken(env, fetchFn, origin) {
  const id = String(env.OPENVERSE_CLIENT_ID || '').trim(), secret = String(env.OPENVERSE_CLIENT_SECRET || '').trim(); if (!id || !secret) return '';
  const hit = await cacheGet(origin, 'openverse-token'); if (hit && hit.t) return hit.t;
  try { const j = await getJson(fetchFn, 'openverse', 'https://' + P.HOSTS.openverse + '/v1/auth_tokens/token/', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials&client_id=' + encodeURIComponent(id) + '&client_secret=' + encodeURIComponent(secret) });
    if (j && j.access_token) { await cachePut(origin, 'openverse-token', { t: String(j.access_token) }, Math.max(60, Math.min(43000, (j.expires_in || 43200) - 600))); return String(j.access_token); } } catch (e) { if (e instanceof Limited) throw e; }
  return '';
}
/** one source's candidates for a phrase (and the event date): they are parsed here and judged by lib/daily-photo.js. Throws Limited on a 429. */
async function search(env, fetchFn, origin, src, q, date) {
  const u = encodeURIComponent;
  if (src === 'commons') return P.parseCommons(await getJson(fetchFn, src, 'https://' + P.HOSTS.commons + '/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=10&gsrsearch=' + u(q + ' filetype:bitmap') + '&prop=imageinfo&iiprop=url|mime|size|extmetadata&iiurlwidth=1024&iiextmetadatafilter=LicenseShortName|Artist|ImageDescription|DateTimeOriginal|DateTime|Categories|ObjectName|NonFree|Restrictions'));
  if (src === 'openverse') { const t = await openverseToken(env, fetchFn, origin); return P.parseOpenverse(await getJson(fetchFn, src, 'https://' + P.HOSTS.openverse + '/v1/images/?q=' + u(q) + '&license=cc0,by,by-sa&category=photograph&mature=false&page_size=10', { headers: t ? { authorization: 'Bearer ' + t } : {} })); }
  if (src === 'flickr') return P.parseFlickr(await getJson(fetchFn, src, 'https://api.flickr.com/services/rest/?method=flickr.photos.search&format=json&nojsoncallback=1&api_key=' + u(String(env.FLICKR_API_KEY).trim()) + '&text=' + u(q) + '&license=' + Object.keys(P.FLICKR_LICENCES).join(',') + '&safe_search=1&content_type=1&media=photos&sort=relevance&per_page=10&extras=' + u('license,owner_name,date_taken,tags,description,url_c,url_l')));
  if (src === 'thesportsdb') return P.parseSportsDb(await getJson(fetchFn, src, 'https://' + P.HOSTS.sportsdb + '/api/v1/json/' + u(String(env.THESPORTSDB_KEY).trim()) + '/searchevents.php?e=' + u(q.replace(/\s+/g, '_')) + (date ? '&d=' + date : '')));
  return [];
}
const limitedUntil = async (env, src, now) => { const r = await env.DB.prepare('SELECT until FROM void_daily_src WHERE src = ?').bind(src).first(); return r && r.until > now ? r.until : 0; };
const setLimit = (env, src, until) => env.DB.prepare('INSERT INTO void_daily_src (src, until) VALUES (?, ?) ON CONFLICT(src) DO UPDATE SET until = excluded.until').bind(src, until).run();
const blockedSet = async (env) => { try { const { results } = await env.DB.prepare('SELECT h FROM void_daily_block').all(); return new Set((results || []).map((r) => Number(r.h))); } catch (_) { return new Set(); } };

/** walk the sources in order and return the first photo that passes every filter: { found, report[], limited }. `bytes` says whether to fetch the thumbnail (the real lookup
 *  does; the owner's diag does only with try=1). Each source's refusals are kept in the report so the owner can see why. */
export async function lookup(env, fetchFn, origin, { q, date, bytes = true, now = Date.now(), key = '' }) {
  const report = [], blocked = await blockedSet(env), t0 = Date.now(); let limited = false;
  for (const src of SOURCES) {
    if (Date.now() - t0 > DEADLINE_MS) { report.push({ source: src, skipped: 'out of time' }); continue; }
    if (!sourceOn(env, src)) { report.push({ source: src, skipped: src === 'thesportsdb' ? 'off until THESPORTSDB_KEY is set (the owner reads its terms first)' : 'off until FLICKR_API_KEY is set' }); continue; }
    const wait = await limitedUntil(env, src, now); if (wait) { limited = true; report.push({ source: src, skipped: 'rate limited until ' + new Date(wait).toISOString() }); continue; }
    let cands; try { cands = await search(env, fetchFn, origin, src, q, date); } catch (e) {
      if (e instanceof Limited) { limited = true; await setLimit(env, src, now + e.retry * 1000); report.push({ source: src, error: 'rate limited (429), left alone for ' + e.retry + ' s' }); } else report.push({ source: src, error: why(e) });
      continue;
    }
    const f = P.filterCandidates(cands, { q, date, blocked }), row = { source: src, found: cands.length, kept: f.ok.length, rejected: f.rejected.slice(0, 8) };
    report.push(row);
    for (const c of f.ok.slice(0, 3)) {
      if (c.link) { row.chosen = c.title; return { found: { ...c }, report, limited }; } // a link-through source: nothing to fetch
      if (!bytes) { row.chosen = c.title; return { found: { ...c }, report, limited }; }
      try { const img = await bytesFrom(fetchFn, src, c.thumb); row.chosen = c.title; return { found: { ...c, img }, report, limited }; }
      catch (e) { if (e instanceof Limited) { limited = true; await setLimit(env, src, now + e.retry * 1000); row.error = 'image rate limited (429)'; break; } row.rejected.push({ title: c.title, why: 'the picture could not be fetched: ' + why(e) }); }
    }
  }
  // the wider registry (lib/free-pics.js): public-domain and open-access sources, asked with the league's own closed subject (never the visitor's words), only when the sources above found nothing
  if (FP.resolveSubject(key)) {
    try {
      const fp = await FP.findPicturesDetailed(key, { kind: 'league', sources: FP.orderFor('league').filter((id) => !['commons', 'openverse', 'flickr'].includes(id)), date, max: 3, env, fetch: fetchFn, cap: (k, l) => dayCap(env, k, l), timeoutMs: FETCH_MS, now });
      report.push(...fp.report.map((r) => ({ ...r, source: 'fp:' + r.source })));
      for (const p of fp.pics) {
        const c = { source: 'fp-' + p.source, title: p.credit.title, author: p.credit.author, authorUrl: p.authorUrl, lic: { code: p.licence, name: p.credit.licence, url: p.credit.licenceUrl }, sourcePage: p.sourcePage, taken: p.taken, provider: '', link: '', credit: FP.creditSegments(p) };
        if (!bytes) return { found: c, report, limited };
        try { return { found: { ...c, img: await bytesFrom(fetchFn, 'fp', p.thumb) }, report, limited }; } catch (e) { if (e instanceof Limited) { limited = true; break; } }
      }
    } catch (e) { report.push({ source: 'fp', error: why(e) }); }
  }
  return { found: null, report, limited };
}

/** the stored form of a photo: the candidate without its bytes, the credit already worked out (a photo without a full credit is never stored). */
const metaOf = (c, date, id) => ({ source: c.source, title: c.title, author: c.author || '', authorUrl: c.authorUrl || '', lic: c.lic ? { code: c.lic.code, name: c.lic.name, url: c.lic.url } : null, sourcePage: c.sourcePage, provider: c.provider || '', taken: c.taken || '', link: c.link || '', id, credit: c.credit ? [...c.credit, { t: ' · ' }, { t: 'Report or request removal', href: P.reportHref(id) }] : P.creditFor(c, { date, id }) });

// ---- the photo path ----
async function photoFor(env, fetchFn, origin, Q, conn, now) {
  const day = Q.day, qn = P.cleanQuery(Q.q).toLowerCase(), problem = P.queryProblem(qn); if (problem) return { none: problem };
  const k = 'photo|' + Q.key + '|' + (await sha(qn)).slice(0, 24) + '|' + (Q.date || '') + '|' + day;
  const row = await env.DB.prepare('SELECT state, meta, img, at, id FROM void_daily_photo WHERE k = ?').bind(k).first();
  // a Flickr answer may be kept for 24 hours at most (its API terms): older, it is asked again
  if (row && row.state === 'done' && !(JSON.parse(row.meta).source === 'flickr' && now - row.at > 864e5)) return { meta: JSON.parse(row.meta), img: row.img, k };
  if (row && row.state === 'none' && now - row.at < (JSON.parse(row.meta || '{}').limited ? LIMITED_TTL_MS : NONE_TTL_MS)) return { none: 'no qualifying photo', k };
  if (row && row.state === 'pending' && now - row.at < A.PENDING_MS) return { none: 'a lookup is in flight', k };
  if ((await used(env, 'photo-look', day)) >= PHOTO_LOOKUPS_DAY || (await used(env, 'pl:' + conn, day)) >= PHOTO_CONN_DAY) return { none: 'lookups are used up for today' };
  const got = await env.DB.prepare("INSERT INTO void_daily_photo (k, day, state, meta, img, at, id) VALUES (?, ?, 'pending', '{}', '', ?, '') ON CONFLICT(k) DO UPDATE SET state = 'pending', at = excluded.at WHERE state <> 'pending' OR at < ?").bind(k, day, now, now - A.PENDING_MS).run();
  if (!Number(got && got.meta && got.meta.changes)) return { none: 'a lookup is in flight', k };
  await tick(env, 'photo-look', day); await tick(env, 'pl:' + conn, day);
  const res = await lookup(env, fetchFn, origin, { q: qn, date: Q.date, now, key: Q.key });
  if (res.found) {
    if ((await used(env, 'photo-rows', day)) >= PHOTO_ROWS_DAY) { await env.DB.prepare('DELETE FROM void_daily_photo WHERE k = ?').bind(k).run(); return { none: 'the day\'s photos are used up' }; }
    let meta; const id = P.photoId(res.found.sourcePage);
    try { meta = metaOf(res.found, Q.date, id); } catch (e) { await env.DB.prepare("UPDATE void_daily_photo SET state = 'none', meta = ?, at = ? WHERE k = ?").bind('{}', now, k).run(); return { none: why(e), k }; }
    await env.DB.prepare("UPDATE void_daily_photo SET state = 'done', meta = ?, img = ?, at = ?, id = ? WHERE k = ?").bind(JSON.stringify(meta), res.found.img || '', now, id, k).run();
    await tick(env, 'photo-rows', day); await env.DB.prepare('DELETE FROM void_daily_photo WHERE day < ?').bind(dayOf(now - 864e5)).run();
    return { meta, img: res.found.img || '', k };
  }
  await env.DB.prepare("UPDATE void_daily_photo SET state = 'none', meta = ?, at = ? WHERE k = ?").bind(JSON.stringify({ limited: res.limited }), now, k).run();
  return { none: 'no qualifying photo', k };
}

// ---- the official embed ----
async function embedFor(env, fetchFn, origin, Q, now) {
  if (Q.kind !== 'sports' || !Q.video) return null;
  const ck = 'embed|' + Q.key + '|' + Q.video, hit = await cacheGet(origin, ck); if (hit) return hit.ok ? hit : null;
  if ((await used(env, 'photo-look', Q.day)) >= PHOTO_LOOKUPS_DAY) return null;
  await tick(env, 'photo-look', Q.day);
  let out = null;
  try { const j = await getJson(fetchFn, 'youtube', 'https://' + P.HOSTS.youtube + '/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + Q.video)); out = P.embedOf(j, Q.video, Q.key, env.DAILY_ART_CHANNELS); }
  catch (e) { out = { ok: false, why: e instanceof Limited ? 'rate limited' : why(e) }; }
  await cachePut(origin, ck, out, out.ok ? 86400 : 3600); return out.ok ? out : null;
}

// ---- the illustration path ----
async function lockRow(env, k, day, now, refresh) {
  const sql = refresh
    ? "INSERT INTO void_daily_art (k, day, state, img, source, at, attempts) VALUES (?, ?, 'pending', '', '', ?, 1) ON CONFLICT(k) DO UPDATE SET state = 'pending', at = excluded.at, attempts = attempts + 1 WHERE state <> 'pending' OR at < ?"
    : "INSERT INTO void_daily_art (k, day, state, img, source, at, attempts) VALUES (?, ?, 'pending', '', '', ?, 1) ON CONFLICT(k) DO UPDATE SET state = 'pending', at = excluded.at, attempts = attempts + 1 WHERE state <> 'done' AND attempts < ? AND ((state = 'pending' AND at < ?) OR (state = 'failed' AND at < ?))";
  const r = await (refresh ? env.DB.prepare(sql).bind(k, day, now, now - A.PENDING_MS) : env.DB.prepare(sql).bind(k, day, now, A.MAX_TRIES_KEY_DAY, now - A.PENDING_MS, now - A.RETRY_MS)).run();
  return Number(r && r.meta && r.meta.changes) > 0;
}
/** the day's illustration: { img (a data URL), source } for a kept or newly painted picture, or { note } naming why the SVG is shown. */
async function illustrate(env, fetchFn, origin, Q, conn, now) {
  const { kind, key, day } = Q, k = kind + '|' + key + '|' + day;
  const row = await env.DB.prepare('SELECT state, img, source, at FROM void_daily_art WHERE k = ?').bind(k).first();
  if (!Q.refresh && row && row.img) return { img: row.img, source: row.source };
  if (flag(env.DAILY_ART_OFF) || flag(env.ART_OFF)) return { note: 'off' };
  const made = await used(env, 'daily', day);
  if (made >= allowedFor(env, kind, key) || (await used(env, 'daily-att', day)) >= A.MAX_ATTEMPTS_DAY) return { note: 'budget' };
  if (!Q.refresh && (await used(env, 'dc:' + conn, day)) >= A.PER_CONN_GENERATIONS) return { note: 'limit' };
  if (!(await lockRow(env, k, day, now, Q.refresh))) {
    const again = await env.DB.prepare('SELECT state, img, source FROM void_daily_art WHERE k = ?').bind(k).first();
    if (again && again.img) return { img: again.img, source: again.source };
    return { note: again && again.state === 'failed' ? 'retry-later' : 'pending' };
  }
  await tick(env, 'daily-att', day); await tick(env, 'dc:' + conn, day);
  const pr = A.promptFor(kind, key, day, Q.mood), full = promptOf(pr.prompt, 'none', pr.negative), size = [A.DAILY_ART_W, A.DAILY_ART_H];
  if (refusalOf(pr.prompt, pr.negative, 'none')) { await env.DB.prepare("UPDATE void_daily_art SET state = 'failed', at = ? WHERE k = ?").bind(now, k).run(); return { note: 'resting' }; } // our own words never trip this; the check is a seat belt
  let img = '', source = '';
  const aiRoom = !!env.AI && (await forgeToday(env, day)) + (await used(env, 'ai', day)) + (await used(env, 'daily-ai', day)) < A.SHARED_AI_CEILING;
  if (aiRoom) {
    try { img = await paintAi(env, full, size, pr.seed); } catch (e) { if (!/slow/.test(String(e && e.message))) { try { img = await paintAi(env, full, size, pr.seed, false); } catch (_) { img = ''; } } }
    if (img) source = 'workers-ai';
  }
  if (!img && !/^(0|false|no|off)$/i.test(String(env.ART_POLLINATIONS || '').trim())) { img = await paintFree(env, full, size, pr.seed, fetchFn); if (img) source = 'pollinations'; }
  if (!img) { await env.DB.prepare("UPDATE void_daily_art SET state = 'failed', at = ? WHERE k = ?").bind(now, k).run(); return { note: 'resting' }; }
  await env.DB.prepare("UPDATE void_daily_art SET state = 'done', img = ?, source = ?, at = ? WHERE k = ?").bind(img, source, now, k).run();
  await tick(env, 'daily', day); if (source === 'workers-ai') await tick(env, 'daily-ai', day);
  await env.DB.prepare('DELETE FROM void_daily_art WHERE day < ?').bind(dayOf(now - 864e5)).run();
  return { img, source };
}

// ---- the route ----
function params(url, now) {
  const q = url.searchParams, today = dayOf(now), yesterday = dayOf(now - 864e5), kind = q.get('kind') || '', key = q.get('key') || '', day = q.get('day') || today, mood = q.get('mood') || '';
  if (!A.validKey(kind, key)) return { error: 'kind and key must come from the lists', status: 400 };
  if (!A.validDay(day)) return { error: 'day is YYYY-MM-DD', status: 400 };
  if (mood && !A.moodOf(mood)) return { error: 'mood must come from the list', status: 400 };
  const date = q.get('date') || '', video = q.get('video') || '';
  if (date && !A.validDay(date)) return { error: 'date is YYYY-MM-DD', status: 400 };
  if (video && !P.YT_RE.test(video)) return { error: 'video is a video id', status: 400 };
  if (day !== today && day !== yesterday) return { redirect: day }; // a day that is not today or yesterday is never made
  return { kind, key, day, mood, today, json: q.get('json') === '1', refresh: q.get('refresh') === '1', photo: q.get('photo') === '1' && kind === 'sports', q: q.get('q') || '', date, video, diag: q.get('diag') === '1', tryit: q.get('try') === '1' };
}
const urlOf = (Q) => A.dailyArt(Q.kind, Q.key, { day: Q.day, mood: Q.mood, photo: Q.photo, q: Q.q, date: Q.date, video: Q.video });

export async function onRequestGet({ request, env }, fetchFn = (u, o) => fetch(u, o)) {
  const url = new URL(request.url), here = url.origin, now = Date.now();
  if (url.searchParams.get('diag') === '1') return diag({ request, env }, fetchFn);
  const Q = params(url, now);
  if (Q.error) return json({ ok: false, error: Q.error }, Q.status);
  if (Q.redirect) { const to = new URL(url); to.searchParams.set('day', dayOf(now)); return new Response(null, { status: 302, headers: { location: to.pathname + to.search, 'cache-control': 'public, max-age=300' } }); }
  if (Q.refresh && !(await ownerOk(request, env))) return json({ ok: false, error: 'owner only' }, 401);
  const dbOk = !!(env && env.DB && env.SALT);
  if (Q.json) return infoOf(env, fetchFn, here, Q, request, now, dbOk);
  const r = await resolve(env, fetchFn, here, Q, request, now, dbOk);
  return pictureRes(r, Q);
}
async function connOf(request, env, day) { return clientKey(request.headers.get('cf-connecting-ip'), day, env.SALT); }
/** what the picture is: a photo (kept bytes or a link), an illustration, or the SVG. The edge cache answers first, so a day's readers cost no database read. */
async function resolve(env, fetchFn, here, Q, request, now, dbOk) {
  const svg = (note) => ({ type: 'svg', svg: A.fallbackSvg(Q.kind, Q.key, Q.day), note });
  if (!dbOk) return svg('off');
  const conn = await connOf(request, env, Q.day);
  if ((await bump(here, 'dailyart:c:' + conn)) > 90) return { type: 'limit' };
  try {
    await ensure(env);
    if (Q.photo && (Q.q || Q.video)) {
      const pk = 'photo-img|' + Q.key + '|' + (await sha(P.cleanQuery(Q.q).toLowerCase())).slice(0, 24) + '|' + (Q.date || '') + '|' + Q.day, hit = await cacheGet(here, pk);
      if (hit) return hit.link ? { type: 'link', link: hit.link, meta: hit.meta } : { type: 'bytes', ct: hit.ct, b64: hit.b64, source: 'photo', meta: hit.meta };
      if (Q.q) { const ph = await photoFor(env, fetchFn, here, Q, conn, now);
        if (ph.meta) { const d = dataOf(ph.img);
          if (d) { await cachePut(here, pk, { ct: d.ct, b64: d.b64, meta: ph.meta }, 600); return { type: 'bytes', ct: d.ct, b64: d.b64, source: 'photo', meta: ph.meta }; }
          if (ph.meta.link) { await cachePut(here, pk, { link: ph.meta.link, meta: ph.meta }, 600); return { type: 'link', link: ph.meta.link, meta: ph.meta }; } } }
    }
    const ik = 'art|' + Q.kind + '|' + Q.key + '|' + Q.day;
    if (!Q.refresh) { const hit = await cacheGet(here, ik); if (hit) return { type: 'bytes', ct: hit.ct, b64: hit.b64, source: hit.source }; }
    const il = await illustrate(env, fetchFn, here, Q, conn, now);
    if (il.img) { const d = dataOf(il.img); if (d) { await cachePut(here, ik, { ct: d.ct, b64: d.b64, source: il.source }, 3600); return { type: 'bytes', ct: d.ct, b64: d.b64, source: il.source, illustration: true }; } }
    return svg(il.note || 'resting');
  } catch (_) { return svg('off'); }
}
function pictureRes(r, Q) {
  if (r.type === 'limit') return json({ ok: false, error: 'slow down' }, 429, { 'retry-after': '60' });
  if (r.type === 'link') return new Response(null, { status: 302, headers: { location: r.link, 'cache-control': 'public, max-age=600', 'x-art-source': 'photo-link', 'referrer-policy': 'no-referrer' } });
  if (r.type === 'bytes') return imageRes(r.ct, bytesOf(r.b64), r.source === 'photo' ? 'photo' : r.source, r.source === 'photo' ? 600 : 3600);
  return svgRes(r.svg, r.note || 'resting');
}
/** ?json=1: the picture's true source and credit for the line under it. */
async function infoOf(env, fetchFn, here, Q, request, now, dbOk) {
  const r = await resolve(env, fetchFn, here, Q, request, now, dbOk);
  if (r.type === 'limit') return json({ ok: false, error: 'slow down' }, 429, { 'retry-after': '60' });
  let source = 'illustration', credit = P.illustrationCredit(), extra = {};
  if (r.type === 'bytes' && r.meta) { source = 'photo'; credit = r.meta.credit; extra = { id: r.meta.id, photoSource: r.meta.source, archive: !(r.meta.taken && Q.date && r.meta.taken === Q.date) }; }
  else if (r.type === 'link' && r.meta) { source = r.meta.source === 'thesportsdb' ? 'thesportsdb' : 'photo'; credit = r.meta.credit; extra = { id: r.meta.id, photoSource: r.meta.source, archive: !(r.meta.taken && Q.date && r.meta.taken === Q.date) }; }
  else if (r.type === 'svg') { source = 'fallback'; extra = { note: r.note }; }
  let embed = null; if (dbOk && Q.video) { try { await ensure(env); embed = await embedFor(env, fetchFn, here, Q, now); } catch (_) { embed = null; } }
  return json({ ok: true, label: source === 'photo' || source === 'thesportsdb' ? credit.map((x) => x.t).join('').split(' · ')[0] : A.LABEL, source, kind: Q.kind, key: Q.key, day: Q.day, src: urlOf(Q), width: A.DAILY_ART_W, height: A.DAILY_ART_H, alt: source === 'photo' || source === 'thesportsdb' ? (r.meta.title ? 'Photo: ' + r.meta.title : 'A photo') : A.altOf(Q.kind, Q.key), credit, ...extra, ...(embed ? { embed: { src: embed.src, watch: embed.watch, title: embed.title, credit: embed.credit } } : {}) },
    200, { 'cache-control': 'public, max-age=60' });
}

// ---- the owner's tools ----
export async function onRequestDelete({ request, env }) {
  if (!(await ownerOk(request, env))) return json({ ok: false, error: 'owner only' }, 401);
  const url = new URL(request.url), id = url.searchParams.get('photo') || '';
  if (!P.ID_RE.test(id)) return json({ ok: false, error: 'a photo id is 12 hex digits' }, 404);
  try {
    await ensure(env);
    const { results } = await env.DB.prepare('SELECT k, meta FROM void_daily_photo WHERE id = ?').bind(id).all(); let n = 0;
    for (const r of results || []) { try { const m = JSON.parse(r.meta); if (m.sourcePage) await env.DB.prepare('INSERT INTO void_daily_block (h, at) VALUES (?, ?) ON CONFLICT(h) DO NOTHING').bind(String(A.hash(m.sourcePage)), Date.now()).run(); } catch (_) {}
      await env.DB.prepare('DELETE FROM void_daily_photo WHERE k = ?').bind(r.k).run(); await cacheDel(url.origin, 'photo-img|' + r.k.split('|').slice(1).join('|')); n++; }
    return json({ ok: true, removed: n, note: 'its source page is blocked from coming back; cached copies at the edge expire within 10 minutes' });
  } catch (_) { return json({ ok: false, error: 'the store is off' }, 503); }
}
/** ?diag=1 (owner key): the budget and switches, and with q (and try=1) what each source answered. Never a key or an address. */
export async function diag({ request, env }, fetchFn = (u, o) => fetch(u, o)) {
  if (!(await ownerOk(request, env))) return json({ ok: false, error: 'owner only' }, 401);
  const url = new URL(request.url), q = P.cleanQuery(url.searchParams.get('q') || ''), now = Date.now(), day = dayOf(now), out = {
    day, budget: budgetOf(env), sharedAiCeiling: A.SHARED_AI_CEILING, neuronsPerPicture: A.NEURONS_PER_PICTURE, aiBound: !!(env && env.AI), db: !!(env && env.DB), salt: !!(env && env.SALT), off: flag(env.DAILY_ART_OFF) || flag(env.ART_OFF), forgeCap: FREE_CAP,
    sources: Object.fromEntries(SOURCES.map((s) => [s, sourceOn(env, s)])), openverseToken: !!(String(env.OPENVERSE_CLIENT_ID || '').trim() && String(env.OPENVERSE_CLIENT_SECRET || '').trim()), shapes: Object.keys(SHAPES).length };
  if (env && env.DB) { try { await ensure(env); for (const k of ['daily', 'daily-ai', 'daily-att', 'ai', 'photo-look', 'photo-rows']) out['today_' + k] = await used(env, k, day); out.forgeToday = await forgeToday(env, day); const { results } = await env.DB.prepare('SELECT src, until FROM void_daily_src WHERE until > ?').bind(now).all(); out.limited = results || []; } catch (e) { out.dbError = why(e); } }
  if (q && env && env.DB) { const res = await lookup(env, fetchFn, url.origin, { q: q.toLowerCase(), date: url.searchParams.get('date') || '', bytes: url.searchParams.get('try') === '1', now }); out.report = res.report; out.found = res.found ? { source: res.found.source, title: res.found.title, licence: res.found.lic && res.found.lic.name, author: res.found.author } : null; }
  if (String(env.FLICKR_API_KEY || '').trim() && url.searchParams.get('licences') === '1') { try { const j = await getJson(fetchFn, 'flickr', 'https://api.flickr.com/services/rest/?method=flickr.photos.licenses.getInfo&format=json&nojsoncallback=1&api_key=' + encodeURIComponent(String(env.FLICKR_API_KEY).trim())); out.flickrLicences = ((j && j.licenses && j.licenses.license) || []).map((l) => ({ id: l.id, name: l.name })); out.flickrAccepted = P.FLICKR_LICENCES; } catch (e) { out.flickrLicences = 'error: ' + why(e); } }
  return json({ ok: true, ...out });
}
