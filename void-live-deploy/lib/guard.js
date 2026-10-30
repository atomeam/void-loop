// Verse's defences (the will's "check my defences" want, 2026-09-28). Shared by functions/api/_middleware.js and the routes.
// Uses what the platform already gives: the edge cache (caches.default) as a per-colo counter, plus a per-isolate map so a
// burst is caught even before the cache answers. Pages Functions have no rate-limit binding; a Cloudflare WAF rate-limiting
// rule on the zone is the stronger outer layer (dashboard, see domains/void.defences.md).
//
// Every /api route gets: a per-connection budget per minute, a request-size cap, a brake on repeated wrong keys, no
// cross-site writes from other websites' pages (Gumroad's server-to-server ping and Verse's own tools send no Origin), no CORS,
// nosniff and no-store by default. Owner keys are compared in constant time.
import { OWNER_ACCOUNTS, ACCOUNT_ID_RE } from './owner-accounts.js';

export const WINDOW_MS = 60e3;
// rpm: requests per connection per minute on that route. body: the largest request body accepted, in bytes.
export const LIMITS = {
  mcp: { rpm: 60, body: 64000 }, // Verse as an MCP server (functions/api/mcp.js): read-only tools; a review_code call carries up to 60,000 characters of code
  answer: { rpm: 30, body: 20000 },
  appraise: { rpm: 6, body: 1200000 },
  translate: { rpm: 40, body: 1200000 }, // 5,000 characters of text, or one downsized photo whose text the vision model reads, 40 a minute: a translation model call each (functions/api/translate.js) // one downsized photo (768 px JPEG) per call, 6 a minute: a vision model call each (functions/api/appraise.js) // /api/answer also keeps its own tighter 12 a minute for model calls
  'fanfic-hits': { rpm: 60, body: 0 }, // /fanfic/ read counts (functions/api/fanfic-hits.js): a POST has no body; one count per visitor, story and day, 30 a minute per connection in the route
  boards: { rpm: 600, body: 4700000 }, // the boards (functions/api/boards/[[path]].js): a catalog page loads up to 150 thumbnails; a post carries one picture of up to 4 MB and its thumbnail; posting, reporting and making boards are rate-limited per hashed address in the route itself, behind a bot check
  calshare: { rpm: 60, body: 200000 }, // a whole calendar shared by link (functions/api/calshare.js): one document of up to 1,000 events; 30 a minute and daily ceilings in the route itself
  rapvoice: { rpm: 200, body: 0 }, // GET only: one bar of a rap in, Verse's voice saying it out (functions/api/rapvoice.js), edge-cached a week; a rap asks for every bar at once, so 200 a minute here and 120 new bars a minute and 2,500 a day in all in the route
  icsfeed: { rpm: 30, body: 0 }, // GET only: a calendar address in, its parsed events out (functions/api/icsfeed.js), edge-cached 30 minutes, 20 addresses a minute in the route
  rsvp: { rpm: 60, body: 2000 }, // replies to an invite (functions/api/rsvp.js): a name and yes, maybe or no; daily ceilings in the route
  podcasts: { rpm: 30, body: 0 }, // GET only: a search phrase, a chart, an iTunes id or a public https feed address in, normalised JSON out; SSRF-safe fetch, 3 MB and 8 s caps, edge-cached 15 min; 20 misses a minute in the route itself (functions/api/podcasts.js)
  news: { rpm: 30, body: 0 }, // GET only: a section and a language from two closed lists in, grouped headlines from fixed public feeds out, edge-cached seven minutes; 20 misses a minute in the route itself (functions/api/news.js)
  recipeimport: { rpm: 30, body: 1200000 }, // a recipe page's address in (GET) or one downsized photo of a recipe card (POST): the recipe or the text read out (functions/api/recipeimport.js); 15 addresses and 6 photos a minute in the route
  recipes: { rpm: 30, body: 0 }, // GET only: a dish, up to three ingredients or an id in, TheMealDB's recipes out, edge-cached an hour; 20 misses a minute in the route itself (functions/api/recipes.js)
  scores: { rpm: 60, body: 0 }, // GET only: a league from a closed list and a day in, public scores out (functions/api/scores.js), edge-cached 20 s live to 6 h final; 30 misses a minute in the route itself
  sportsearch: { rpm: 30, body: 0 }, // GET only: a name in, TheSportsDB's public answers out (functions/api/sportsearch.js), edge-cached a day; 15 misses a minute in the route itself
  report: { rpm: 30, body: 0 }, // GET only: a league, a kind and a game id or day in, a short story out (functions/api/report.js), edge-cached 5 minutes to 7 days, at most 40 model calls an hour and 600 a day in all, one D1 counter (lib/daily-cap.js)
  miss: { rpm: 30, body: 1000 },
  misses: { rpm: 30, body: 0 },
  aurora: { rpm: 30, body: 0 }, // GET only, no input, edge-cached 15 min: the most a stranger can do is read a number
  joins: { rpm: 30, body: 0 }, // GET only, no input, one COUNT read, cached a minute: the member count and the newest join's time (functions/api/joins.js)
  routes: { rpm: 30, body: 0 }, // owner-only: the router's decisions (GET)
  earnings: { rpm: 30, body: 0 },
  queue: { rpm: 60, body: 4000 },
  bench: { rpm: 30, body: 10000 }, // owner-only (functions/api/bench.js): model bake-off chunks of 8 built-in asks, or { route } with up to 16 asks of at most 300 characters (frontier #9)
  share: { rpm: 30, body: 200 }, // invites (POST, a signed-in member) and joining one (a WebSocket per tab)
  approval: { rpm: 60, body: 8000 },
  will: { rpm: 60, body: 64000 },
  catalog: { rpm: 60, body: 1000 },
  passkey: { rpm: 60, body: 20000 },
  mine: { rpm: 120, body: 900200 },
  publish: { rpm: 20, body: 40000 }, // a paid Verse's public page (/@name)
  members: { rpm: 20, body: 8000 }, // paid Verse: a member's idea (functions/api/members.js; its own daily limit is in lib/members.js)
  gumroad: { rpm: 120, body: 50000 },
  team: { rpm: 240, body: 16000 }, // the team chat (functions/api/team.js): a page polls a channel every few seconds; every write needs the owner or an agent key the owner made, with per-agent rates in the route
  handoff: { rpm: 30, body: 262144 }, // agent drop-links; 256 KB matches functions/api/handoff.js
  rehearsal: { rpm: 10, body: 500 }, // owner-only: seed and clean the rehearsal's stand-in reply (functions/api/rehearsal.js)
  figurescript: { rpm: 60, body: 4000 }, // Next #19: behavior script for a summoned figure (AI once, then D1 cache)
  memory: { rpm: 30, body: 262144 }, // owner-only: what Verse remembers (tools/ouroboros.py push); 256 KB matches MAX_BODY in lib/memory-core.js
  films: { rpm: 120, body: 40000000 }, // Verse's films for people who pay (functions/api/films.js): a video seeks with many Range GETs; only the owner POSTs a film (OWNER_WRITES)
  'film-views': { rpm: 60, body: 0 }, // Verse Tube view counts (functions/api/film-views.js): one D1 upsert per view, no KV
  'film-review': { rpm: 30, body: 4000 }, // a paying member's or the owner's verdict on a film and a note of up to 1,000 characters (functions/api/film-review.js)
  support: { rpm: 10, body: 6000 }, // the support desk (functions/api/support.js): paying users only, a report of up to 2,000 characters
  review: { rpm: 60, body: 70000 }, // Verse's code review API (lib/review-api.js): the instant checks free, the closer read with a Pro key
  studies: { rpm: 20, body: 0 }, // owner-only, read only: the study panel lists Verse's studies (functions/api/studies.js)
  reflect: { rpm: 30, body: 2000 }, // Verse's voice: public GET of its reflections, owner POST asks it what it thinks (lib/voice.js)
  'voice-reply': { rpm: 20, body: 4000 }, // owner-only: a reply to Verse's reflection or card; one model call (functions/api/voice-reply.js)
  'probe-log': { rpm: 60, body: 2000 }, // the growth card reads it; the probe and fix tools write one record each (lib/probe-log.js)
  'v01d-fixes': { rpm: 10, body: 500 }, // owner-only: approve one of Verse's fix pull requests (functions/api/v01d-fixes.js)
  coder: { rpm: 60, body: 400000 }, // owner-only: one turn of Verse's coder on Verse's own model (functions/api/coder.js); the body carries the lap's conversation, capped at 380,000 characters there, with its own hourly and daily call caps
  'propose-fix': { rpm: 6, body: 40000 }, // owner-only: Verse proposes a matcher fix for an ask its probe missed (lib/propose-fix.js); the body carries one skill file
  'probe-asks': { rpm: 6, body: 8000 }, // owner-only: Verse writes its own probe asks for one family (lib/probe-asks.js); the body carries 14 example asks and the wants
  automations: { rpm: 60, body: 2200000 }, // owner-only: Verse's own automations; a pull-request rule carries up to 20 files of 100 KB
  merge: { rpm: 30, body: 2000 }, // two idea names in, a cached name and line out (functions/api/merge.js); the model is asked at most 6 times a minute per connection by its own bucket
  'card-art': { rpm: 30, body: 2000 }, // the Art Forge (functions/api/card-art.js): a subject word in, a cached picture out; the model runs at most 3 times a minute per connection and 30 times a day in all
  image: { rpm: 30, body: 2000 }, // the text-to-image page (functions/api/image.js): a prompt of 400 characters in, one picture out; 6 a minute and 24 a day per hashed connection and the day's shared cap in the route itself
  studio: { rpm: 30, body: 6000000 }, // the studio (functions/api/studio.js): GET is the scoreboard; every POST is owner-only (the bench's fixed prompts, a picture or four video frames to judge, a clip with an optional first frame of up to 4 MB) inside the bench's neuron cap and the video dollar cap
  'daily-art': { rpm: 240, body: 0 }, // the daily picture for the reports (functions/api/daily-art.js): GET (a picture, or its credit as JSON), closed lists, one painting per kind, key and day, a day's budget; photos only from three fixed APIs; the owner's refresh, diag and delete
  'gen-data': { rpm: 60, body: 4000 }, // a published generator's shared data (functions/api/gen-data.js): 5 small writes a call, 20 calls a minute per hashed connection in the route itself
  comments: { rpm: 60, body: 4000 }, // comments under a published generator and /image/ (functions/api/comments.js): 500 characters, a signed sum, 2 a minute and 15 a day per hashed connection in the route itself
  gallery: { rpm: 60, body: 2000 }, // the public image gallery (functions/api/gallery.js): a share names a picture /api/image made today (no bytes in), votes and reports; limits per hashed connection in the route itself
  generators: { rpm: 60, body: 64000 }, // the generators hub (functions/api/generators.js): a published generator of up to 20,000 characters; 3 publishes a minute, 10 a day per hashed connection in the route itself
  visit: { rpm: 60, body: 300 }, // who visits Verse (functions/api/visit.js): one beacon per page load, a page path and a referrer host in, counts out; 20 a minute and 300 a day per hashed connection in the route itself, no model
  tally: { rpm: 60, body: 200 }, // everyone's tally (functions/api/tally.js): a closed list (coin: heads, tails) and a count up to 20 in; integers out; 30 a minute and 600 a day per hashed connection in the route itself, no model
  react: { rpm: 60, body: 300 }, // spectator reactions (functions/api/react.js): a closed list of 6 ids and a ledger slug in; integer counts out; 20 a minute and 200 a day per hashed connection in the route itself, no model
  digest: { rpm: 6, body: 70000 }, // Verse reads a pasted transcript or a PeerTube/Archive video's open captions (functions/api/digest.js): Gemma at most once per answer, edge-cached
  video: { rpm: 30, body: 0 }, // Verse's video search and link lookup (functions/api/video.js): GET only, edge-cached, no KV, no model
  weather: { rpm: 30, body: 0 }, // the weather page's forecast for a place (functions/api/weather.js): GET, edge-cached ten minutes, 10 fresh lookups a minute, no model, no KV
  repo: { rpm: 20, body: 0 }, // a public GitHub repo's facts (functions/api/repo.js): GET, edge-cached ten minutes, 6 fresh lookups a minute, no token, no model, no KV
  media: { rpm: 30, body: 0 }, // real songs and shows (functions/api/media.js): GET only, a fixed list of sources, edge-cached, no KV, no model
  filmfind: { rpm: 20, body: 0 }, // film discovery as JSON (functions/api/filmfind.js): GET only, one fixed host (iTunes), at most 10 upstream GETs per call, edge-cached a day, no KV, no model, nothing written
  holidays: { rpm: 30, body: 0 }, // the next public holidays in one country (functions/api/holidays.js): GET only, two letters in, one fixed host (Nager.Date), edge-cached six hours, no KV, no model
  movies: { rpm: 30, body: 0 }, // real movies (functions/api/movies.js): GET only, a fixed list of sources, edge-cached, no KV, no model
  where: { rpm: 20, body: 0 }, // the connection's own coarse place (functions/api/where.js): GET, no input, never cached
  jobs: { rpm: 60, body: 0 }, // GET only: the jobs pages' listings and a search's RSS (functions/api/jobs.js); three fixed upstream addresses, each edge-cached for as long as its terms ask (an hour to a day), nothing taken from the caller but a search read against the cached list
  markets: { rpm: 90, body: 0 }, // the crypto card's price list and the /markets/ page's quotes (functions/api/markets.js): GET, edge-cached two minutes (an hour for currencies), 40 fresh lookups a minute in the route itself, no KV
  hook: { rpm: 60, body: 64000 },
  routines: { rpm: 30, body: 2000 }, // routines offered to other Voids (functions/api/routines.js): an offer waits for the owner; the route keeps 5 offers a minute itself
  actions: { rpm: 60, body: 4000 },
  selfcheck: { rpm: 30, body: 60000 }, // Verse's check of its own pages (functions/api/selfcheck.js): public GET of the newest report; only the owner's job POSTs one (80 pages at most)
  watch: { rpm: 30, body: 8000 }, // the owner's or a paid member's standing watches (functions/api/watch.js) // owner-only: the execution record (lib/actions.js); GET reads it, POST writes an extension.* record (B3); nothing here takes an action // webhooks into an automation (functions/api/hook/[id].js); MAX_EVENT in lib/automations.js
};
export const DEFAULT_LIMIT = { rpm: 60, body: 16000 };
export const FAIL_MAX = 10; // wrong keys (401/403) per connection per minute before every /api call from it is refused
export const NO_ORIGIN_CHECK = ['gumroad']; // server-to-server: Gumroad's ping
export const OWNER_WRITES = ['films']; // routes whose large writes only the owner sends: anyone else is refused before a byte of the body is read

const enc = new TextEncoder();
const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
const digest = (s) => crypto.subtle.digest('SHA-256', enc.encode(String(s)));

// Constant-time secret check (both sides hashed first, so length and content never leak through timing).
export async function sameSecret(given, secret) {
  if (!secret || typeof given !== 'string' || !given) return false;
  const [a, b] = await Promise.all([digest('void-key:' + given), digest('void-key:' + secret)]);
  const x = new Uint8Array(a), y = new Uint8Array(b);
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}
// The one owner check for the whole site (owner, 2026-10-30: "make it to where i have access to everything stop locking me out of
// things"). The owner is: Bearer READ_TOKEN, an owner session (below), or the signed-in session of the owner's account, which is any
// account with a passkey the owner bound with the key (void_owner_passkeys, /api/passkey 'owner-bind'). Every route that asks
// "is this the owner?" asks ownerOk, so signing in with the owner's passkey opens every owner page. Fails closed on any error.
export async function ownerOk(request, env) {
  const h = request.headers.get('authorization') || '';
  if (!h.startsWith('Bearer ')) return false;
  const t = h.slice(7);
  if (t.startsWith(OWNER_SESSION_PREFIX)) return ownerSessionOk(t, env);
  if (await sameSecret(t, env && env.READ_TOKEN)) return true;
  return !!(await ownerAccountSession(t, env));
}
// An account is the owner's when the owner named it (lib/owner-accounts.js, or env.OWNER_ACCOUNTS, comma separated), or when one of
// its passkeys was bound by the owner key. Any read error is false.
export function ownerListed(env, userId) {
  if (!ACCOUNT_ID_RE.test(String(userId || ''))) return false;
  const extra = String((env && env.OWNER_ACCOUNTS) || '').split(',').map((x) => x.trim()).filter((x) => ACCOUNT_ID_RE.test(x));
  return OWNER_ACCOUNTS.includes(userId) || extra.includes(userId);
}
export async function ownerAccount(env, userId) {
  if (!userId) return false;
  if (ownerListed(env, userId)) return true;
  if (!env || !env.DB) return false;
  try {
    // void-review: ok (bound parameter)
    const row = await env.DB.prepare('SELECT 1 AS y FROM void_owner_passkeys o JOIN void_passkeys p ON p.id = o.id WHERE p.user_id = ? LIMIT 1').bind(userId).first();
    return !!(row && row.y);
  } catch (_) { return false; }
}
// A Verse account session token (the stage's a2m.void.me.v1) -> the owner's user id when it is a live session of the owner's account,
// else null. Only the SHA-256 of a session token is stored (lib/void-me.js sessionId uses the same 'void-session:' prefix).
export async function ownerAccountSession(token, env) {
  if (!env || !env.DB || typeof token !== 'string' || !/^[A-Za-z0-9_-]{40,64}$/.test(token)) return null;
  try {
    const row = await env.DB.prepare('SELECT user_id, expires FROM void_sessions WHERE id = ?').bind(hex(await digest('void-session:' + token))).first();
    if (!row || Number(row.expires) <= Date.now()) return null;
    return (await ownerAccount(env, row.user_id)) ? row.user_id : null;
  } catch (_) { return null; }
}
// The key itself, never a session. Binding a passkey as the owner's login needs this, so a copied session can't make itself permanent.
export function ownerKeyOk(request, env) {
  const h = request.headers.get('authorization') || '';
  return h.startsWith('Bearer ') && !h.startsWith('Bearer ' + OWNER_SESSION_PREFIX) ? sameSecret(h.slice(7), env && env.READ_TOKEN) : Promise.resolve(false);
}

// Owner sessions (owner login, 2026-10-03): signing in with a passkey the owner bound (/api/passkey 'owner-bind') returns one, so a
// browser never needs READ_TOKEN to be the owner. Form: vo1.<expiry ms, base36>.<credential tag>.<HMAC-SHA256>, keyed from
// READ_TOKEN + SALT, so rotating either one ends every owner session at once. 30 days, renewed while used (/api/passkey 'owner').
export const OWNER_SESSION_PREFIX = 'vo1.';
export const OWNER_SESSION_TTL_MS = 30 * 864e5;
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
async function ownerSessionKey(env) {
  if (!env || !env.READ_TOKEN) return null;
  return crypto.subtle.importKey('raw', await digest('void-owner-session:' + env.READ_TOKEN + '|' + (env.SALT || '')), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
// tag: keep the same credential tag when renewing a session
export async function mintOwnerSession(env, credentialId, now = Date.now(), tag = null) {
  const key = await ownerSessionKey(env);
  if (!key) return null;
  const exp = now + OWNER_SESSION_TTL_MS;
  const t = tag && /^[A-Za-z0-9_-]{16}$/.test(tag) ? tag : b64u(await digest('owner-cred:' + credentialId)).slice(0, 16);
  const body = OWNER_SESSION_PREFIX + exp.toString(36) + '.' + t;
  return { token: body + '.' + b64u(await crypto.subtle.sign('HMAC', key, enc.encode(body))), expires: new Date(exp).toISOString() };
}
export async function ownerSessionOk(token, env, now = Date.now()) {
  const m = typeof token === 'string' && token.length < 120 ? /^vo1\.([0-9a-z]{1,12})\.([A-Za-z0-9_-]{16})\.([A-Za-z0-9_-]{43})$/.exec(token) : null;
  if (!m) return false;
  const exp = parseInt(m[1], 36);
  if (!(exp > now) || exp > now + OWNER_SESSION_TTL_MS + 60e3) return false;
  const key = await ownerSessionKey(env);
  if (!key) return false;
  try { return await crypto.subtle.verify('HMAC', key, unb64u(m[3]), enc.encode('vo1.' + m[1] + '.' + m[2])); } catch (_) { return false; }
}

export async function connId(request, env) {
  return hex(await digest((request.headers.get('cf-connecting-ip') || 'local') + '|' + ((env && env.SALT) || ''))).slice(0, 24);
}

// Per-isolate counts (fixed one-minute windows), mirrored to the colo's edge cache when there is one.
const mem = new Map();
function slotKey(key, now) { return key + ':' + Math.floor(now / WINDOW_MS); }
async function read(origin, k) {
  let n = mem.get(k) || 0;
  try {
    if (typeof caches !== 'undefined' && caches.default) {
      const hit = await caches.default.match(new Request(origin + '/__void-guard/' + encodeURIComponent(k)));
      if (hit) n = Math.max(n, parseInt(await hit.text(), 10) || 0);
    }
  } catch (_) {}
  return n;
}
async function write(origin, k, n) {
  mem.set(k, n);
  if (mem.size > 20000) mem.clear();
  try {
    if (typeof caches !== 'undefined' && caches.default) await caches.default.put(new Request(origin + '/__void-guard/' + encodeURIComponent(k)), new Response(String(n), { headers: { 'cache-control': 'max-age=120' } }));
  } catch (_) {}
}
export async function bump(origin, key, now = Date.now()) {
  const k = slotKey(key, now), n = (await read(origin, k)) + 1;
  await write(origin, k, n);
  return n;
}
export const peek = (origin, key, now = Date.now()) => read(origin, slotKey(key, now));
export function resetGuard() { mem.clear(); } // tests only

// Another website's page trying to write through a visitor's browser. Requests with no Origin (servers, Verse's own tools,
// curl) and same-origin pages pass; GET, HEAD and OPTIONS never change anything here.
export function crossSite(request) {
  if (/^(GET|HEAD|OPTIONS)$/.test(request.method)) return false;
  if (request.headers.get('sec-fetch-site') === 'cross-site') return true;
  const o = request.headers.get('origin');
  if (!o) return false;
  return o !== new URL(request.url).origin;
}

// Refusals are JSON the page already understands ({ note: 'slow down' } is what /api/answer's own limit says).
const plain = (status, text, extra) => new Response(JSON.stringify({ ok: false, error: text, note: text, answer: null, sources: [] }), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...(extra || {}) } });

// Reads at most `max` bytes of the body; null = too big.
async function capped(request, max) {
  if (!request.body) return new Uint8Array(0);
  const reader = request.body.getReader(), parts = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) { try { await reader.cancel(); } catch (_) {} return null; }
    parts.push(value);
  }
  const out = new Uint8Array(size); let at = 0;
  for (const p of parts) { out.set(p, at); at += p.byteLength; }
  return out;
}

// The middleware for every /api route (functions/api/_middleware.js).
export async function guard(ctx) {
  const { request, env } = ctx;
  const url = new URL(request.url), route = url.pathname.split('/')[2] || '';
  const lim = LIMITS[route] || DEFAULT_LIMIT;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { allow: 'GET, POST, PUT, PATCH', 'cache-control': 'no-store' } }); // no CORS: other sites can't read Verse's API
  if (!NO_ORIGIN_CHECK.includes(route) && crossSite(request)) return plain(403, 'cross-site requests are refused');
  const conn = await connId(request, env);
  if ((await peek(url.origin, 'fail:' + conn)) >= FAIL_MAX) return plain(429, 'too many wrong keys, wait a minute', { 'retry-after': '60' });
  if ((await bump(url.origin, 'rl:' + route + ':' + conn)) > lim.rpm) return plain(429, 'slow down', { 'retry-after': '60' });
  let req = request;
  if (!/^(GET|HEAD)$/.test(request.method) && OWNER_WRITES.includes(route) && !(await ownerOk(request, env))) { await bump(url.origin, 'fail:' + conn); return plain(403, 'only the owner writes here'); }
  if (!/^(GET|HEAD)$/.test(request.method)) {
    const len = Number(request.headers.get('content-length'));
    if (Number.isFinite(len) && len > lim.body) return plain(413, 'too big');
    const bytes = await capped(request, lim.body);
    if (!bytes) return plain(413, 'too big');
    req = new Request(request, { body: bytes.byteLength ? bytes : null });
  }
  const res = await ctx.next(req);
  if (res.status === 101 || res.webSocket) return res; // an invite's WebSocket (functions/api/share/): rewrapping it would drop the socket
  if (res.status === 401 || res.status === 403) await bump(url.origin, 'fail:' + conn);
  const out = new Response(res.body, res);
  out.headers.set('x-content-type-options', 'nosniff');
  if (!out.headers.has('cache-control')) out.headers.set('cache-control', 'no-store');
  out.headers.delete('access-control-allow-origin');
  return out;
}
