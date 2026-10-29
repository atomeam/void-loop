// Verse's probe ledger (lib/probe-log.js). GET is public: counts, skill names, confidences and outcomes only, never an ask.
// GET                         -> { log: newest first, stats: probeStats(log) }
// POST (owner) { kind, … }    one record from tools/probe-asks.mjs ('probe') or tools/propose-fix.mjs ('fix') -> the kept record
// 400 for a record that is neither kind or out of range; 503 without the database.
import { ownerOk } from '../../lib/guard.js';
import { recordOf, probeStats, LOG_KEEP } from '../../lib/probe-log.js';

const read = async (env) => { try { const v = await env.DB.prepare("SELECT v FROM void_kv WHERE k = 'probe-log'").first('v'); const l = v ? JSON.parse(v) : []; return Array.isArray(l) ? l : []; } catch (_) { return []; } };

export async function onRequestGet({ env }) {
  const log = env && env.DB ? await read(env) : [];
  return Response.json({ log, stats: probeStats(log) }, { headers: { 'cache-control': 'max-age=60' } });
}

export async function onRequestPost({ request, env }) {
  if (!(await ownerOk(request, env))) return new Response('no', { status: 401 });
  if (!env.DB) return new Response('the probe ledger needs the database', { status: 503 });
  let b = {}; try { b = JSON.parse((await request.text()).slice(0, 2000)); } catch (_) {}
  const rec = recordOf(b);
  if (!rec) return new Response('a probe or fix record', { status: 400 });
  const log = await read(env);
  await env.DB.prepare("INSERT INTO void_kv (k, v) VALUES ('probe-log', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").bind(JSON.stringify([rec, ...log].slice(0, LOG_KEEP))).run();
  return Response.json(rec);
}
