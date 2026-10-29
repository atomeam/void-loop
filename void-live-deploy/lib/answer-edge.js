// The edge cache in front of the answer engine (asked by Verse: "Implement edge caching for answers."; its older words: "Implement edge
// caching (caches.default) for counters and caches to reduce KV writes below 1k/day", for speed and to stay inside Workers AI's free
// 10k neurons a day; the owner's review, 2026-10-29: "cache only stable, non-personal answers"). A repeated answer that the D1 answer cache
// would also serve is answered from the colo's own cache (caches.default): no D1 read, no model call, no neurons. caches.default is
// Cloudflare's per-colo HTTP cache, not KV: it costs no KV write (tools/kv-writes.test.mjs stays green).
//
// WHAT MAY BE CACHED: an allow-list, never a deny-list. All of these must hold, or the request is a BYPASS and nothing is read or stored:
//   the request   a POST whose JSON body has no field but `ask`, whose query has no field but `fresh`, and that carries no Authorization,
//                 no Cookie and no key, token, secret, hook, signature, payment or test header (keyedRequest): nothing that says who is
//                 asking, or that the answer could depend on who is asking or what they may see;
//   the ask       not masked (lib/privacy.js found a personal detail or a secret), not about Verse (isSelfAsk: its facts change with every
//                 ship), not answered from what this person told Verse, not a paste, and one of the KINDS below (answerKind): an ask that
//                 says my, me, our or us is about someone and is not one of them;
//   the answer    from a free model (a paid escalation is never served again for free), status 200, a non-empty answer, and no field
//                 outside ANSWER_FIELDS: a note (model busy, open web, slow down), a refusal (noAnswer), self, told, kept or page all
//                 fall outside it. The modes (fix, review, take, draft, proposal, plan, character, report, story, aitext,
//                 market-report) and an ask about a page return before this is reached, so they are never cached.
//
// THE KEY: a synthetic same-origin GET, origin + /__answer-cache/<schema>-<build>/<hash>. <hash> is the D1 cache's own key
// (functions/api/answer.js: SHA-256 of the normalised, masked, lowercased ask), so the person's words never appear in a URL and two asks
// the D1 cache treats as one are one here. <build> is the commit the deploy wrote to /build.json (deploy.yml), so every deploy starts a
// new key space and the old copies are never read again; with no build id (local dev, a broken deploy) nothing is cached. <schema>
// (EDGE_SCHEMA) is bumped by hand only if the stored shape changes.
//
// TTL PER KIND (cache-control max-age on the stored copy): reference answers (what a thing is, how it works) live a day; timely answers
// (prices, weather, scores, news, today, latest: anything that can change) live ten minutes. Never longer than the D1 row has left of
// its 7 days (edgeTtl).
//
// INVALIDATION: a deploy (new build id), the TTL, or Cloudflare evicting a cold entry. To skip the edge copy for one ask, send ?fresh=1,
// the header x-verse-fresh: 1, or cache-control: no-cache: the edge is not read (REFRESH), the answer comes from D1 or the model as before,
// and a fresh storable answer replaces the edge copy.
//
// STALE: never served. An expired copy is gone from the colo; the next ask is a MISS and falls through to the D1 cache (7 days) and then
// the model, exactly as without this file.
//
// MEASURE: every answer-path reply says x-verse-cache: HIT, MISS, REFRESH or BYPASS and server-timing: verse-cache;desc="<that>";dur=<ms>,
// so hit rate and latency can be read from the outside before and after. Nothing is counted in D1 or KV (a count per ask would cost the
// write this file exists to save).
//
// Every cache call fails open: no caches global (local dev, tests) or any cache error is the behaviour without this file, exactly. The key
// and gate functions are pure; the cache is passed in, so tools/answer-edge.test.mjs runs them with a Map.
export const EDGE_SCHEMA = 'v1';
export const EDGE_PATH = '/__answer-cache/';
export const EDGE_HEADER = 'x-verse-cache';
export const HIT = 'HIT', MISS = 'MISS', BYPASS = 'BYPASS', REFRESH = 'REFRESH';

// the answer kinds that may be cached, with how long a copy lives at the edge (seconds); an ask that is none of them is never cached
export const KINDS = Object.freeze({ reference: 86400, timely: 600 });
// an ask about something that changes: prices, weather, scores, news, anything dated
export const TIMELY = /\b(?:today|tonight|tomorrow|yesterday|now|currently|current|latest|recent|recently|this (?:week|month|year|season)|price|prices|cost|costs|worth|cheap|cheapest|stocks?|shares?|market|rate|rates|exchange|crypto|bitcoin|weather|forecast|temperature|rain|snow|score|scores|standings|fixtures?|news|headlines?|election|polls?|won|winner|trending|open now|opening hours|release date|(?:19|20)\d\d)\b/i;
// an ask that names the person asking or their own things: about someone, so not a stable answer for everyone ("how do I" stays generic,
// and "mine" is left out: "a coal mine" is a thing)
// ("us" only in lower case, so "the US" stays a place)
export const PERSONAL = /\b(?:[Mm][Yy]|[Mm]yself|[Mm][Ee]|[Oo]ur|[Oo]urs|[Oo]urselves)\b|\b(?:us|Us)\b/;
/** the kind of an ask: 'timely', 'reference', or null when it may not be cached (empty, or personal). Pure. */
export function answerKind(ask) {
  const a = String(ask || '').trim();
  if (a.length < 3 || PERSONAL.test(a)) return null;
  return TIMELY.test(a) ? 'timely' : 'reference';
}

// the request fields that may be present: anything else could say who is asking
export const BODY_FIELDS = new Set(['ask']);
export const QUERY_FIELDS = new Set(['fresh']);
// a header that says the request is someone's (a bearer, a cookie, an owner or automation key), carries a secret, or is the browser
// suite's (x-void-test)
const KEYED = /^(?:authorization|cookie|x-[a-z0-9-]*(?:key|token|secret|hook|signature|payment|test|session|user|member|owner))$/i;
/** true when the request carries anything that makes its answer someone's own: a bearer, a cookie, a key, a token. Pure. */
export function keyedRequest(request) {
  try {
    if (!request || !request.headers) return true;
    for (const [name] of request.headers) if (KEYED.test(name)) return true;
    return false;
  } catch (_) { return true; }
}
/** the request asks to skip the edge copy: ?fresh=1, x-verse-fresh: 1, or cache-control: no-cache. Pure. */
export function freshAsked(request) {
  try {
    const q = new URL(request.url).searchParams.get('fresh');
    if (q !== null && q !== '0' && q !== 'false') return true;
    if (/^(?:1|true|yes)$/i.test(request.headers.get('x-verse-fresh') || '')) return true;
    return /\bno-cache\b/i.test(request.headers.get('cache-control') || '');
  } catch (_) { return false; }
}

/** the gate: { ok, why, kind, fresh }. ok only for a request and ask on the allow-list above; why says what closed it. Pure. */
export function edgeGate({ request, body, ask, masked, self, told, paste }) {
  const no = (why) => ({ ok: false, why, kind: null, fresh: false });
  if (!request || String(request.method || '').toUpperCase() !== 'POST') return no('not a POST');
  if (keyedRequest(request)) return no('signed in, keyed or cookie');
  let q; try { q = [...new URL(request.url).searchParams.keys()]; } catch (_) { return no('bad url'); }
  if (q.some((k) => !QUERY_FIELDS.has(k))) return no('query field');
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some((k) => !BODY_FIELDS.has(k))) return no('body field');
  if (masked) return no('personal detail');
  if (self) return no('about Verse');
  if (told) return no('what you told me');
  if (paste) return no('paste');
  const kind = answerKind(ask);
  if (!kind) return no('personal ask');
  return { ok: true, why: '', kind, fresh: freshAsked(request) };
}

// the fields an answer the edge may hold has (functions/api/answer.js modelAnswer and the D1 hit); any other field means it is not one
export const ANSWER_FIELDS = new Set(['answer', 'sources', 'at', 'route', 'near', 'pic', 'fuzzy', 'name', 'desc', 'series', 'cached']);
/** may this finished answer body be stored? Only a real answer from a free model, with no field outside ANSWER_FIELDS. Pure. */
export function storable(body, { paid = false, status = 200 } = {}) {
  if (paid || status !== 200 || !body || typeof body !== 'object' || Array.isArray(body)) return false;
  if (typeof body.answer !== 'string' || !body.answer.trim()) return false;
  return Object.keys(body).every((k) => ANSWER_FIELDS.has(k));
}

/** the build id from /build.json's JSON ({ id: commit }): the first 12 hex characters, or '' when it is not a commit. Pure. */
export function buildIdOf(json) {
  const id = json && typeof json.id === 'string' ? json.id.trim().toLowerCase() : '';
  return /^[0-9a-f]{7,40}$/.test(id) ? id.slice(0, 12) : '';
}
// one read of /build.json per isolate (a deploy starts new isolates); a failed read is not kept, so the next request tries again
const builds = new Map();
/** this deploy's build id, read from the site's own /build.json through env.ASSETS; '' when there is none. Never throws. */
export async function buildId(env, origin, ms = 300) {
  if (builds.has(origin)) return builds.get(origin);
  try {
    if (!env || !env.ASSETS || typeof env.ASSETS.fetch !== 'function') return '';
    let t;
    const r = await Promise.race([env.ASSETS.fetch(new Request(origin + '/build.json')), new Promise((_, rej) => { t = setTimeout(() => rej(new Error('slow')), ms); })]).finally(() => clearTimeout(t));
    const id = r && r.ok ? buildIdOf(await r.json()) : '';
    if (id) builds.set(origin, id);
    return id;
  } catch (_) { return ''; }
}
export function resetBuild() { builds.clear(); } // tests only

/** the cache this runtime has (caches.default), or null where there is none. Never throws. */
export function edgeCache(g = globalThis) {
  try { return g && g.caches && g.caches.default && typeof g.caches.default.match === 'function' ? g.caches.default : null; } catch (_) { return null; }
}

// the D1 key (functions/api/answer.js sha(): 32 hex characters of SHA-256); anything else is not a key and is never used
const KEY_RE = /^[0-9a-f]{32,64}$/;
/** the cache key URL: origin + /__answer-cache/<schema>-<build>/<hash>, or null when the key is not a hash or the build is unknown. Pure. */
export function edgeKeyUrl(origin, key, build, schema = EDGE_SCHEMA) {
  if (!KEY_RE.test(String(key || '')) || !/^[0-9a-f]{7,12}$/.test(String(build || '')) || !/^https?:\/\/[^/\s]+$/.test(String(origin || '')) || !/^[a-z0-9]{1,8}$/.test(String(schema))) return null;
  return origin + EDGE_PATH + schema + '-' + build + '/' + key;
}

/** seconds a copy of this kind may live: its KINDS TTL, cut to what the D1 row has left (its `at` plus ttlDays). 0 = do not store. Pure. */
export function edgeTtl(kind, at, now = Date.now(), ttlDays = 7) {
  const max = KINDS[kind] || 0, t = Date.parse(at || '');
  if (!max || !Number.isFinite(t)) return 0;
  return Math.max(0, Math.min(max, Math.floor((t + ttlDays * 864e5 - now) / 1000)));
}

/** the stored copy of a body: the same JSON, marked cached as a D1 hit is. Pure. */
export const storedBody = (body) => JSON.stringify({ ...body, cached: true });

/** a cached answer for this key URL as a Response marked HIT, or null (a miss, no cache, any error). Never throws. */
export async function edgeGet(cache, keyUrl) {
  if (!cache || !keyUrl) return null;
  try {
    const hit = await cache.match(new Request(keyUrl));
    if (!hit) return null;
    const text = await hit.text();
    if (!storable(JSON.parse(text))) return null; // a damaged or foreign copy is a miss
    return new Response(text, { status: 200, headers: { 'content-type': 'application/json', [EDGE_HEADER]: HIT } });
  } catch (_) { return null; }
}

/** store a finished answer body under this key URL for ttl seconds. Returns a promise that never rejects (for waitUntil). */
export function edgePut(cache, keyUrl, body, ttl) {
  if (!cache || !keyUrl || !(ttl > 0) || !storable(body)) return Promise.resolve(false);
  try {
    return Promise.resolve(cache.put(new Request(keyUrl), new Response(storedBody(body), { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=' + Math.floor(ttl) } })))
      .then(() => true, () => false);
  } catch (_) { return Promise.resolve(false); }
}

/** the server-timing value for a mark and a duration. Pure. */
export const timing = (value, ms) => 'verse-cache;desc="' + value + '"' + (Number.isFinite(ms) ? ';dur=' + Math.max(0, Math.round(ms)) : '');
/** the response with x-verse-cache and server-timing set (a copy when its headers are immutable). Never throws. */
export function marked(res, value, ms) {
  if (!res || !value) return res;
  const set = (h) => { h.set(EDGE_HEADER, value); h.set('server-timing', timing(value, ms)); };
  try { set(res.headers); return res; } catch (_) {}
  try { const h = new Headers(res.headers); set(h); return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h }); } catch (_) { return res; }
}
