// Life arbitrage, private (lib/life-arb.js; owner, 2026-11-06: "an arb scanner only we can use for life itself").
// GET   (owner only, Bearer owner key) -> the latest scan, ranked by net value per hour of Atom's time with deadlines first, each
//       opportunity with its source, evidence, value, cost, minutes (estimated), deadline, risk, next step and the asks that wait on his
//       yes; plus what he marked done or skipped. A read older than 6 hours starts a fresh scan in the background.
// POST  { action: 'scan' }  runs the scanners. With the owner key: now (at most every 10 minutes). Without it (the scheduled workflow,
//       .github/workflows/life-arb.yml, needs no secret): at most once every 3 hours, and the answer is counts per source only, never an
//       opportunity, so a stranger learns nothing and can cost at most four small scans a day.
// POST  (owner only) { action: 'mark', id, status: 'done' | 'skipped' | 'open' }  Atom's own record of what he took or passed on.
// Never listed: not in llms.txt, the sitemap, openapi.json or x402 discovery. Finds and ranks only; buys, signs up and claims nothing.
import { ownerOk } from '../../lib/guard.js';
import { scan, verseJobs, SCAN_EVERY_MS, OPEN_SCAN_MIN_MS } from '../../lib/life-arb.js';

const TABLE = 'CREATE TABLE IF NOT EXISTS void_life_arb (k TEXT PRIMARY KEY, at TEXT NOT NULL, v TEXT)';
const QUEUE = 'CREATE TABLE IF NOT EXISTS void_queue (id TEXT PRIMARY KEY, ask TEXT, target TEXT, state TEXT, note TEXT, at TEXT, updated TEXT)';
const OWNER_SCAN_MIN_MS = 10 * 60e3;
const MAX_OPEN_JOBS = 3; // Verse's queue never holds more than this many life-arb jobs at once
const json = (body, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' } });

async function ensure(env) { await env.DB.prepare(TABLE).run(); }
const latest = async (env) => { const r = await env.DB.prepare("SELECT at, v FROM void_life_arb WHERE k = 'scan'").first(); try { return r ? JSON.parse(r.v) : null; } catch (_) { return null; } };
const marks = async (env) => Object.fromEntries((((await env.DB.prepare("SELECT k, at, v FROM void_life_arb WHERE k LIKE 'mark:%'").all()).results) || []).map((r) => [r.k.slice(5), { status: r.v, at: r.at }]));

// The jobs Verse can do alone go onto its own build queue (void_queue), one per opportunity ever, a few at a time.
async function queueJobs(env, ranked) {
  await env.DB.prepare(QUEUE).run();
  const rows = ((await env.DB.prepare("SELECT target, state FROM void_queue WHERE target LIKE 'lifearb:%'").all()).results) || [];
  const open = rows.filter((r) => r.state === 'queued' || r.state === 'building').length;
  const room = Math.max(0, MAX_OPEN_JOBS - open);
  if (!room) return [];
  const jobs = verseJobs(ranked, { max: room, have: new Set(rows.map((r) => r.target)) });
  const now = new Date().toISOString();
  const ins = 'INSERT INTO void_queue (id, ask, target, state, note, at, updated) VALUES (?, ?, ?, ?, ?, ?, ?)';
  if (jobs.length) await env.DB.batch(jobs.map((j, i) => env.DB.prepare(ins).bind(Date.now().toString(36) + i, j.ask, j.target, 'queued', 'from the private life-arb scan', now, now)));
  return jobs;
}

export async function runScan(env, request, fetchImpl = fetch) {
  const assets = env.ASSETS ? (p) => env.ASSETS.fetch(new URL(p, request.url)) : null;
  const s = await scan({ fetchImpl, assets });
  let queued = [];
  try { queued = await queueJobs(env, s.opportunities); } catch (_) { queued = []; }
  s.queued = queued.map((j) => j.target);
  await env.DB.prepare("INSERT INTO void_life_arb (k, at, v) VALUES ('scan', ?, ?) ON CONFLICT(k) DO UPDATE SET at = excluded.at, v = excluded.v").bind(s.as_of, JSON.stringify(s)).run();
  return s;
}

const counts = (s) => ({ ran: true, as_of: s.as_of, count: s.count, queued: (s.queued || []).length,
  sources: Object.fromEntries(Object.entries(s.sources).map(([k, v]) => [k, { state: v.state, count: v.count }])) });

export async function onRequestGet({ request, env, waitUntil }) {
  if (!(await ownerOk(request, env))) return json({ error: 'owner only' }, 401);
  try {
    await ensure(env);
    let s = await latest(env);
    if (!s) s = await runScan(env, request);
    else if (Date.now() - Date.parse(s.as_of) > SCAN_EVERY_MS && typeof waitUntil === 'function') { try { waitUntil(runScan(env, request).catch(() => null)); } catch (_) {} }
    const m = await marks(env);
    const opportunities = s.opportunities.map((o) => ({ ...o, mark: m[o.id] || null }));
    return json({ ...s, opportunities, marks: m });
  } catch (_) { return json({ error: 'life-arb unavailable' }, 503); }
}

export async function onRequestPost({ request, env }) {
  let body = {};
  try { body = await request.json(); } catch (_) { return json({ error: 'json body' }, 400); }
  const owner = await ownerOk(request, env);
  try {
    await ensure(env);
    if (body.action === 'scan') {
      const last = await env.DB.prepare("SELECT at FROM void_life_arb WHERE k = 'scan'").first();
      const age = last ? Date.now() - Date.parse(last.at) : Infinity, min = owner ? OWNER_SCAN_MIN_MS : OPEN_SCAN_MIN_MS;
      if (age < min) return json({ ran: false, last: last.at, next_after: new Date(Date.parse(last.at) + min).toISOString() });
      const s = await runScan(env, request);
      return json(owner ? s : counts(s));
    }
    if (!owner) return json({ error: 'owner only' }, 401);
    if (body.action === 'mark') {
      const id = String(body.id || '').slice(0, 40), st = String(body.status || '');
      if (!/^[a-z0-9]+$/.test(id) || !['done', 'skipped', 'open'].includes(st)) return json({ error: 'id and status done|skipped|open' }, 400);
      if (st === 'open') await env.DB.prepare('DELETE FROM void_life_arb WHERE k = ?').bind('mark:' + id).run();
      else await env.DB.prepare('INSERT INTO void_life_arb (k, at, v) VALUES (?, ?, ?) ON CONFLICT(k) DO UPDATE SET at = excluded.at, v = excluded.v').bind('mark:' + id, new Date().toISOString(), st).run();
      return json({ ok: true, id, status: st });
    }
    return json({ error: 'unknown action', actions: ['scan', 'mark'] }, 400);
  } catch (_) { return json({ error: 'life-arb unavailable' }, 503); }
}
