// Verse's defences (the will's "check my defences" want, 2026-09-28). Shared by functions/api/_middleware.js and the routes.
// Uses what the platform already gives: the edge cache (caches.default) as a per-colo counter, plus a per-isolate map so a
// burst is caught even before the cache answers. Pages Functions have no rate-limit binding; a Cloudflare WAF rate-limiting
// rule on the zone is the stronger outer layer (dashboard, see domains/void.defences.md).
//
// Every /api route gets: a per-connection budget per minute, a request-size cap, a brake on repeated wrong keys, no
// cross-site writes from other websites' pages (Gumroad's server-to-server ping and Verse's own tools send no Origin), no CORS,
// nosniff and no-store by default. Owner keys are compared in constant time.

export const WINDOW_MS = 60e3;
// rpm: requests per connection per minute on that route. body: the largest request body accepted, in bytes.
export const LIMITS = {
  mcp: { rpm: 60, body: 64000 }, // Verse as an MCP server (functions/api/mcp.js): read-only tools; a review_code call carries up to 60,000 characters of code
  answer: { rpm: 30, body: 20000 },
  appraise: { rpm: 6, body: 1200000 },
  translate: { rpm: 40, body: 1200000 }, // 5,000 characters of text, or one downsized photo whose text the vision model reads, 40 a minute: a translation model call each (functions/api/translate.js) // one downsized photo (768 px JPEG) per call, 6 a minute: a vision model call each (functions/api/appraise.js) // /api/answer also keeps its own tighter 12 a minute for model calls
  miss: { rpm: 30, body: 1000 },
  misses: { rpm: 30, body: 0 },
  aurora: { rpm: 30, body: 0 }, // GET only, no input, edge-cached 15 min: the most a stranger can do is read a number
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
  gumroad: { rpm: 120, body: 50000 },
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
  'propose-fix': { rpm: 6, body: 40000 }, // owner-only: Verse proposes a matcher fix for an ask its probe missed (lib/propose-fix.js); the body carries one skill file
  'probe-asks': { rpm: 6, body: 8000 }, // owner-only: Verse writes its own probe asks for one family (lib/probe-asks.js); the body carries 14 example asks and the wants
  automations: { rpm: 60, body: 2200000 }, // owner-only: Verse's own automations; a pull-request rule carries up to 20 files of 100 KB
  merge: { rpm: 30, body: 2000 }, // two idea names in, a cached name and line out (functions/api/merge.js); the model is asked at most 6 times a minute per connection by its own bucket
  'card-art': { rpm: 30, body: 2000 }, // the Art Forge (functions/api/card-art.js): a subject word in, a cached picture out; the model runs at most 3 times a minute per connection and 30 times a day in all
  tally: { rpm: 60, body: 200 }, // everyone's tally (functions/api/tally.js): a closed list (coin: heads, tails) and a count up to 20 in; integers out; 30 a minute and 600 a day per hashed connection in the route itself, no model
  react: { rpm: 60, body: 300 }, // spectator reactions (functions/api/react.js): a closed list of 6 ids and a ledger slug in; integer counts out; 20 a minute and 200 a day per hashed connection in the route itself, no model
  digest: { rpm: 6, body: 70000 }, // Verse reads a pasted transcript or a PeerTube/Archive video's open captions (functions/api/digest.js): Gemma at most once per answer, edge-cached
  video: { rpm: 30, body: 0 }, // Verse's video search and link lookup (functions/api/video.js): GET only, edge-cached, no KV, no model
  weather: { rpm: 30, body: 0 }, // the weather page's forecast for a place (functions/api/weather.js): GET, edge-cached ten minutes, 10 fresh lookups a minute, no model, no KV
  repo: { rpm: 20, body: 0 }, // a public GitHub repo's facts (functions/api/repo.js): GET, edge-cached ten minutes, 6 fresh lookups a minute, no token, no model, no KV
  media: { rpm: 30, body: 0 }, // real songs and shows (functions/api/media.js): GET only, a fixed list of sources, edge-cached, no KV, no model
  filmfind: { rpm: 20, body: 0 }, // film discovery as JSON (functions/api/filmfind.js): GET only, one fixed host (iTunes), at most 10 upstream GETs per call, edge-cached a day, no KV, no model, nothing written
  movies: { rpm: 30, body: 0 }, // real movies (functions/api/movies.js): GET only, a fixed list of sources, edge-cached, no KV, no model
  where: { rpm: 20, body: 0 }, // the connection's own coarse place (functions/api/where.js): GET, no input, never cached
  markets: { rpm: 30, body: 0 }, // the crypto card's price list (functions/api/markets.js): GET, edge-cached two minutes, no KV
  hook: { rpm: 60, body: 64000 },
  routines: { rpm: 30, body: 2000 }, // routines offered to other Voids (functions/api/routines.js): an offer waits for the owner; the route keeps 5 offers a minute itself
  actions: { rpm: 60, body: 4000 },
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
// Bearer READ_TOKEN (the owner) or an owner session (below). Fails closed when READ_TOKEN isn't set.
export async function ownerOk(request, env) {
  const h = request.headers.get('authorization') || '';
  if (!h.startsWith('Bearer ')) return false;
  const t = h.slice(7);
  return t.startsWith(OWNER_SESSION_PREFIX) ? ownerSessionOk(t, env) : sameSecret(t, env && env.READ_TOKEN);
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
