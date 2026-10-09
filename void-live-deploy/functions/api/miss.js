// void-misses: collects asks Void could not answer, so agents know what to build next.
// Stores only the words typed (normalized, max 200 chars), counts, first/last time, and which fallback ran.
// No IPs, cookies or user agents are stored. The connection is hashed only for a 60s rate-limit window.
// Storage: D1 (void_misses). Older rows still in KV are merged in by /api/misses until they expire.
// Void learns from it by itself (lib/learn.js): the second miss of the same ask, or one Void says is not built yet,
// becomes a `miss:<slug>` job in the build queue at once, so the builders see it without anyone in between.
import { redact } from '../../lib/automation-fix.js';
import { isNoise } from '../../lib/noise.js';
import { learnFromMiss } from '../../lib/learn.js';
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
  const ask = redact(norm(body.ask)); // a key typed into Void never lands on the miss list
  const fallback = String(body.fallback || '').slice(0, 40);
  if (!ask || ask.length < 2) return new Response('empty', { status: 400 });
  if (isNoise(ask)) return new Response(null, { status: 204 }); // test traffic is not a miss (lib/noise.js)
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
  // after the answer is sent: does this miss earn a job? Best effort: a queue hiccup, a D1 stand-in without
  // bound .first(), or a runtime without waitUntil never fails the miss itself.
  const learn = (async () => {
    try { const row = await env.DB.prepare('SELECT ask, count, last, fallback FROM void_misses WHERE id = ?').bind(id).first(); if (row) await learnFromMiss(env, row); } catch (_) {}
  })();
  if (typeof waitUntil === 'function') waitUntil(learn);
  return new Response(null, { status: 204 });
}
