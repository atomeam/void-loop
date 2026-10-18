// Spectator reactions, the server half (owner, 2026-10-18: a fixed reaction list backed by a basic rate limit; lib/reactions.js has the list and the rules).
// POST { target, reaction } adds one reaction; GET ?target= reads the counts.
//
// WHAT A STRANGER COULD MAKE THIS DO, AND WHY IT IS BOUNDED. This is an open endpoint with no account, cookie or key. The most a caller can do is:
//   - add one of 8 reactions (an id from a closed list; anything else is a 400) to one of the items in the growth ledger (a slug checked against
//     /void.growth.json) or one of the newest incidents (an 'incident-' slug checked against the site's own /incidents.json; anything else is a 404), and read the counts back. Nothing a caller types is stored, echoed or drawn: the response is ids and integers;
//   - do that 20 times a minute and 200 times a day from one connection (keyed by SHA-256 of address + UTC day + the SALT secret, cut to 16 hex: the address itself
//     is never stored, logged or returned, and the key changes every day), at most 120 a minute onto one item from everyone, and 5,000 a day in all (the D1 write
//     budget: about 3 writes a reaction). Past a limit the answer is 429 with Retry-After;
//   - so inflate a count a little. THAT IS NOT PREVENTED: reactions are anonymous, so one person with many addresses (a botnet or a rotating proxy) can push a
//     count up; the ceilings above bound how fast, and a count stops at 99,999. The counts are applause, never a vote that decides anything;
//   - fill the table: at most 8 rows per item and 2,000 items, because an item must be in the ledger or in incidents.json.
// The minute limits live in the edge cache (lib/guard.js bump, per data centre, best effort); the daily limits are rows in D1. With no D1, no SALT or no readable
// ledger the route is off (503) rather than unguarded. No model, no KV, no third party. Same-origin only: no CORS header, and a foreign Origin is refused.
import { bump } from '../../lib/guard.js';
import { LIMITS, parseReaction, targetOk, targetOf, incidentTargetOf, countsOf, REACTION_IDS, dayOf, secondsToMidnight, clientKey } from '../../lib/reactions.js';

const json = (o, status = 200, extra = {}) => Response.json(o, { status, headers: { 'cache-control': 'no-store', ...extra } });
const off = () => json({ ok: false, error: 'reactions are off for now' }, 503);
const slow = (secs, error = 'slow down') => json({ ok: false, error }, 429, { 'retry-after': String(secs) });

let ready = null;
async function ensure(env) {
  if (!ready) ready = (async () => {
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS void_reactions (target TEXT NOT NULL, reaction TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (target, reaction))').run();
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS void_reaction_days (k TEXT PRIMARY KEY, day TEXT NOT NULL, n INTEGER NOT NULL)').run(); // k: a hashed client key or "all"; no address
  })().catch((e) => { ready = null; throw e; });
  await ready;
}
export const resetReady = () => { ready = null; }; // tests: a new fake database needs its tables made again

// the items spectators may react to: the growth ledger's entries, read through the site's own assets and kept ten minutes per isolate
let seenTargets = { at: 0, set: null };
const INCIDENTS_MAX = 50; // incidents.json keeps 30; read no more than this whatever the file holds
export const resetKnown = () => { seenTargets = { at: 0, set: null }; };
async function knownTargets(request, env, now) {
  if (seenTargets.set && now - seenTargets.at < 600000) return seenTargets.set;
  if (!env.ASSETS) return null;
  try {
    const r = await env.ASSETS.fetch(new Request(new URL('/void.growth.json', request.url)));
    if (!r.ok) return seenTargets.set;
    const list = await r.json(), set = new Set();
    for (const e of Array.isArray(list) ? list : []) { const t = e && targetOf(e.at); if (t) set.add(t); }
    // the incidents on the autopsy card (asked by Void): the site's own incidents.json, newest 30 (tools/incident-log.mjs KEEP), each under an
    // 'incident-' slug; unreadable means no incident targets, never an open door
    try {
      const ri = await env.ASSETS.fetch(new Request(new URL('/incidents.json', request.url)));
      const j = ri.ok ? await ri.json() : null, inc = Array.isArray(j) ? j : j && Array.isArray(j.incidents) ? j.incidents : [];
      for (const i of inc.slice(0, INCIDENTS_MAX)) { const t = i && incidentTargetOf(i.at); if (t) set.add(t); }
    } catch (_) { /* no incident targets this time */ }
    if (set.size) seenTargets = { at: now, set };
  } catch (_) { /* keep what was read before, if anything */ }
  return seenTargets.set;
}

async function readCounts(env, target) {
  const { results } = await env.DB.prepare('SELECT reaction, n FROM void_reactions WHERE target = ?').bind(target).all();
  return countsOf(results);
}
const used = async (env, k, day) => { const r = await env.DB.prepare('SELECT n FROM void_reaction_days WHERE k = ? AND day = ?').bind(k, day).first(); return r ? Number(r.n) || 0 : 0; };
const tick = (env, k, day) => env.DB.prepare('INSERT INTO void_reaction_days (k, day, n) VALUES (?, ?, 1) ON CONFLICT(k) DO UPDATE SET n = CASE WHEN day = excluded.day THEN n + 1 ELSE 1 END, day = excluded.day').bind(k, day).run();

export async function onRequestGet({ request, env }) {
  const target = new URL(request.url).searchParams.get('target');
  if (!targetOk(target)) return json({ ok: false, error: 'not a target' }, 400);
  if (!env || !env.DB) return off();
  try { await ensure(env); return json({ ok: true, counts: await readCounts(env, target) }); } catch (_) { return off(); }
}

export async function onRequestPost({ request, env }) {
  const here = new URL(request.url).origin, from = request.headers.get('origin');
  if (from && from !== here) return json({ ok: false, error: 'same-origin only' }, 403);
  if (!env || !env.DB || !env.SALT) return off(); // closed, not open: no way to hash the address or keep the day's count
  const len = Number(request.headers.get('content-length'));
  if (Number.isFinite(len) && len > LIMITS.body) return json({ ok: false, error: 'too big' }, 413);
  const p = parseReaction(request.headers.get('content-type'), (await request.text()).slice(0, LIMITS.body + 1));
  if (!p.ok) return json({ ok: false, error: p.error }, p.status);
  const now = Date.now(), day = dayOf(now);
  const targets = await knownTargets(request, env, now);
  if (!targets) return off(); // the ledger cannot be read: nothing to check the target against, so nothing is counted
  if (!targets.has(p.target)) return json({ ok: false, error: 'not a target' }, 404);
  const key = await clientKey(request.headers.get('cf-connecting-ip'), day, env.SALT);
  // the cheap limits first (edge cache, no D1): this client's minute, then this target's minute from everyone
  if ((await bump(here, 'react:c:' + key)) > LIMITS.perMinute) return slow(60);
  if ((await bump(here, 'react:t:' + p.target)) > LIMITS.targetPerMinute) return slow(60, 'busy');
  try {
    await ensure(env);
    const all = await used(env, 'all', day);
    if (all >= LIMITS.globalPerDay) return slow(secondsToMidnight(now), 'the crowd is loud today');
    if ((await used(env, 'c:' + key, day)) >= LIMITS.perDay) return slow(secondsToMidnight(now), 'that is enough for today');
    if (all === 0) await env.DB.prepare('DELETE FROM void_reaction_days WHERE day < ?').bind(day).run(); // the day's first reaction clears yesterday's counters
    const have = await readCounts(env, p.target);
    if (have[p.reaction] < LIMITS.countCap) {
      if (REACTION_IDS.every((id) => have[id] === 0)) { // a first reaction on an item: the table is bounded
        const t = await env.DB.prepare('SELECT COUNT(DISTINCT target) AS t FROM void_reactions').first();
        if ((Number(t && t.t) || 0) >= LIMITS.targets) return off();
      }
      await env.DB.prepare('INSERT INTO void_reactions (target, reaction, n) VALUES (?, ?, 1) ON CONFLICT(target, reaction) DO UPDATE SET n = MIN(n + 1, ?)').bind(p.target, p.reaction, LIMITS.countCap).run();
      have[p.reaction] += 1;
    }
    await tick(env, 'c:' + key, day); await tick(env, 'all', day);
    return json({ ok: true, counts: have });
  } catch (_) { return off(); }
}
