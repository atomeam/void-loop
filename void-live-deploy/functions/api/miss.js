// void-misses: collects asks Verse could not answer, so agents know what to build next.
// Stores only the words typed (normalized, max 200 chars), counts, first/last time, and which fallback ran.
// No IPs, cookies or user agents are stored. The connection is hashed only for a 60s rate-limit window.
// Storage: D1 (void_misses). Older rows still in KV are merged in by /api/misses until they expire.
// Verse learns from it by itself (lib/learn.js): an ask missed 3 times over at least two days becomes a `miss:<slug>`
// job in the build queue at once, so the builders see it without anyone in between. The browser-sent fallback never
// queues a job by itself: this endpoint is open to anyone. `{ kind: 'used', id }` counts one open of a lab experiment instead
// (lib/used.js): only an id naming a live /fringe/ page, nothing typed, one per connection per experiment per day. `origin: 'agent'` (sent by the page for a WebMCP call) is counted
// apart in void_misses.agent and only ever takes a miss out of the job count: asks only agents made never become jobs.
import { redact } from '../../lib/automation-fix.js';
import { redactPersonal } from '../../lib/privacy.js';
import { isNoise } from '../../lib/noise.js';
import { learnFromMiss, noteAgentMiss, agentCount } from '../../lib/learn.js';
import { isLab, noteUse } from '../../lib/used.js';
import { recordGap } from '../../lib/product-gap.js';
import { loadCatalog } from '../../lib/store-db.js';
const MAX_LEN = 200;
const RL_MAX = 20; // writes per connection per minute

async function sha(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('').slice(0, 24);
}
function norm(t) {
  return String(t || '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase().slice(0, MAX_LEN);
}

export async function onRequestPost({ request: req, env, waitUntil }) {
  let body = {};
  try { body = JSON.parse((await req.text()).slice(0, 1000)); } catch (_) { return new Response('bad', { status: 400 }); }
  if (body && body.kind === 'used') return used(req, env, body.id);
  if (body && body.kind === 'gap') { // no product matched a buy/hire ask: count its topic (stems only), never its words
    const a = redactPersonal(norm(body.ask));
    if (!a || isNoise(a)) return new Response(null, { status: 204 });
    try { const cat = await loadCatalog(env); await recordGap(env, a, (cat && cat.products) || cat || []); } catch (_) {}
    return new Response(null, { status: 204 });
  }
  const ask = redactPersonal(norm(body.ask)); // a key typed into Verse never lands on the miss list
  const fallback = String(body.fallback || '').slice(0, 40);
  const fromAgent = body.origin === 'agent'; // the page's label for a miss a visiting agent's tool call caused; anything else is people
  if (!ask || ask.length < 2) return new Response('empty', { status: 400 });
  if (isNoise(ask)) return new Response(null, { status: 204 }); // test traffic is not a miss (lib/noise.js)
  if (body.origin === 'robot') return new Response(null, { status: 204 }); // a page driven by automation (navigator.webdriver) replaying our own asks: not people, never a want
  const id = await sha(ask);
  try { // the edge cache (per colo); the /api middleware also limits every connection
    const conn = await sha((req.headers.get('cf-connecting-ip') || '') + (env.SALT || ''));
    const cache = caches.default, base = new URL(req.url).origin + '/__void-miss/';
    const short = (v) => new Response(v, { headers: { 'cache-control': 'max-age=60' } });
    const rlReq = new Request(base + 'rl/' + conn);
    const n = parseInt((await (await cache.match(rlReq))?.text()) || '0', 10);
    if (n >= RL_MAX) return new Response('slow down', { status: 429 });
    await cache.put(rlReq, short(String(n + 1)));
    const dupReq = new Request(base + 'd/' + conn + '/' + id);
    if (await cache.match(dupReq)) return new Response(null, { status: 204 });
    await cache.put(dupReq, short('1'));
  } catch (_) {}
  const now = new Date().toISOString();
  try {
    await env.DB.prepare(`INSERT INTO void_misses (id, ask, count, first, last, fallback) VALUES (?, ?, 1, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET count = count + 1, last = excluded.last, fallback = COALESCE(NULLIF(excluded.fallback, ''), fallback)`)
      .bind(id, ask, now, now, fallback).run();
  } catch (_) { return new Response('miss list unavailable', { status: 503 }); }
  if (fromAgent) await noteAgentMiss(env, id); // a separate statement, so the people's path above is the one it always was
  // after the answer is sent: does this miss earn a job? Best effort: a queue hiccup, a D1 stand-in without
  // bound .first(), or a runtime without waitUntil never fails the miss itself.
  const learn = (async () => {
    try { const row = await env.DB.prepare('SELECT ask, count, first, last, fallback FROM void_misses WHERE id = ?').bind(id).first(); if (row) await learnFromMiss(env, { ...row, agent: await agentCount(env, id) }); } catch (_) {}
  })();
  if (typeof waitUntil === 'function') waitUntil(learn);
  return new Response(null, { status: 204 });
}

// one open of a lab experiment: a stranger can add at most one open per experiment per connection per day, to an id that is
// already a page here; nothing they type is stored
async function used(req, env, id) {
  const origin = new URL(req.url).origin;
  if (!(await isLab(env, origin, id))) return new Response('not a lab experiment', { status: 400 });
  const day = new Date().toISOString().slice(0, 10);
  try {
    const conn = await sha((req.headers.get('cf-connecting-ip') || '') + (env.SALT || ''));
    const cache = caches.default, base = origin + '/__void-used/';
    const rlReq = new Request(base + 'rl/' + conn);
    const n = parseInt((await (await cache.match(rlReq))?.text()) || '0', 10);
    if (n >= RL_MAX) return new Response('slow down', { status: 429 });
    await cache.put(rlReq, new Response(String(n + 1), { headers: { 'cache-control': 'max-age=60' } }));
    const dupReq = new Request(base + 'd/' + day + '/' + conn + '/' + id);
    if (await cache.match(dupReq)) return new Response(null, { status: 204 });
    await cache.put(dupReq, new Response('1', { headers: { 'cache-control': 'max-age=86400' } }));
  } catch (_) {}
  try { await noteUse(env, id, day); } catch (_) { return new Response('use count unavailable', { status: 503 }); }
  return new Response(null, { status: 204 });
}
