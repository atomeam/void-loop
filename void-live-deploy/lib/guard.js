// Void's defences (the will's "check my defences" want, 2026-09-28). Shared by functions/api/_middleware.js and the routes.
// Uses what the platform already gives: the edge cache (caches.default) as a per-colo counter, plus a per-isolate map so a
// burst is caught even before the cache answers. Pages Functions have no rate-limit binding; a Cloudflare WAF rate-limiting
// rule on the zone is the stronger outer layer (dashboard, see domains/void.defences.md).
//
// Every /api route gets: a per-connection budget per minute, a request-size cap, a brake on repeated wrong keys, no
// cross-site writes from other websites' pages (Gumroad's server-to-server ping and Void's own tools send no Origin), no CORS,
// nosniff and no-store by default. Owner keys are compared in constant time.

export const WINDOW_MS = 60e3;
// rpm: requests per connection per minute on that route. body: the largest request body accepted, in bytes.
export const LIMITS = {
  answer: { rpm: 30, body: 20000 }, // /api/answer also keeps its own tighter 12 a minute for model calls
  miss: { rpm: 30, body: 1000 },
  misses: { rpm: 30, body: 0 },
  earnings: { rpm: 30, body: 0 },
  queue: { rpm: 60, body: 4000 },
  approval: { rpm: 60, body: 8000 },
  will: { rpm: 60, body: 64000 },
  catalog: { rpm: 60, body: 1000 },
  passkey: { rpm: 60, body: 20000 },
  mine: { rpm: 120, body: 900200 },
  gumroad: { rpm: 120, body: 50000 },
};
export const DEFAULT_LIMIT = { rpm: 60, body: 16000 };
export const FAIL_MAX = 10; // wrong keys (401/403) per connection per minute before every /api call from it is refused
export const NO_ORIGIN_CHECK = ['gumroad']; // server-to-server: Gumroad's ping

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
// Bearer READ_TOKEN (the owner). Fails closed when READ_TOKEN isn't set.
export function ownerOk(request, env) {
  const h = request.headers.get('authorization') || '';
  return h.startsWith('Bearer ') ? sameSecret(h.slice(7), env && env.READ_TOKEN) : Promise.resolve(false);
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

// Another website's page trying to write through a visitor's browser. Requests with no Origin (servers, Void's own tools,
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
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { allow: 'GET, POST, PUT, PATCH', 'cache-control': 'no-store' } }); // no CORS: other sites can't read Void's API
  if (!NO_ORIGIN_CHECK.includes(route) && crossSite(request)) return plain(403, 'cross-site requests are refused');
  const conn = await connId(request, env);
  if ((await peek(url.origin, 'fail:' + conn)) >= FAIL_MAX) return plain(429, 'too many wrong keys, wait a minute', { 'retry-after': '60' });
  if ((await bump(url.origin, 'rl:' + route + ':' + conn)) > lim.rpm) return plain(429, 'slow down', { 'retry-after': '60' });
  let req = request;
  if (!/^(GET|HEAD)$/.test(request.method)) {
    const len = Number(request.headers.get('content-length'));
    if (Number.isFinite(len) && len > lim.body) return plain(413, 'too big');
    const bytes = await capped(request, lim.body);
    if (!bytes) return plain(413, 'too big');
    req = new Request(request, { body: bytes.byteLength ? bytes : null });
  }
  const res = await ctx.next(req);
  if (res.status === 401 || res.status === 403) await bump(url.origin, 'fail:' + conn);
  const out = new Response(res.body, res);
  out.headers.set('x-content-type-options', 'nosniff');
  if (!out.headers.has('cache-control')) out.headers.set('cache-control', 'no-store');
  out.headers.delete('access-control-allow-origin');
  return out;
}
