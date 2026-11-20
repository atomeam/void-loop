// GET /api/brain: Verse's live brain (docs/brain.md; the shaping is lib/brain-live.js). Every region with its true state, recent events and
// when it last fired, the drives with their numbers, and the newest real chain sense -> want -> job -> PR -> result -> lesson, for /brain/.
// WHAT A STRANGER COULD MAKE THIS DO: nothing but read. Open GET, no input. It reads what is public already (the will, the crew, the status,
// the page check, the exam, what Verse knows, the unbidden lines, the reflection journal) and counts from the route log (never an ask's
// words). One answer is kept at the edge for 60 seconds, so a burst of viewers costs one read a minute. A part that fails is left out.
import { brainOf } from '../../lib/brain-live.js';
import { crewView } from '../../lib/team-crew-run.js';
import { readStatus } from './status.js';
import { onRequestGet as willGet } from './will.js';
import { onRequestGet as selfcheckGet } from './selfcheck.js';
import { KEY as UNBIDDEN } from '../../lib/unbidden.js';
import { jsonOkCached } from '../../lib/http.js';
import { sleepIfDue, due, LOG as SLEEP_LOG } from '../../lib/brain-sleep.js';

export const TTL = 60;
const parse = (v) => { try { return v ? JSON.parse(v) : null; } catch (_) { return null; } };
const safe = (p) => Promise.resolve().then(p).catch(() => null);
// the newest want that has a job, joined to that job (one fixed query, no input)
export const CHAIN_SQL = "SELECT w.key, w.title, w.lane, w.label, w.cite, w.baseline, w.latest, w.state AS wstate, w.private, w.job, q.state AS qstate, q.note, q.updated FROM void_team_wants w JOIN void_queue q ON q.id = w.job ORDER BY CASE WHEN q.note LIKE '%github.com/%/pull/%' THEN 0 ELSE 1 END, q.updated DESC LIMIT 1";
// today's routed asks by route, and the close calls (a skill within 0.04 of its bar): counts only
export const ROUTES_SQL = "SELECT route, COUNT(*) AS c, SUM(CASE WHEN score IS NOT NULL AND score >= 0.66 AND route != 'skill' THEN 1 ELSE 0 END) AS close FROM void_routes WHERE last >= ? GROUP BY route";

export async function readBrain(request, env, now = Date.now()) {
  const asset = async (p) => { try { const r = await env.ASSETS.fetch(new Request(new URL(p, request.url))); return r.ok ? await r.json() : null; } catch (_) { return null; } };
  const kv = async (k) => { try { return parse(await env.DB.prepare('SELECT v FROM void_kv WHERE k = ?').bind(k).first('v')); } catch (_) { return null; } };
  const ctx = { request, env };
  const [will, crew, status, selfcheck, exam, knows, knowledge, skills, voice, unb, lessons, sleep, chainRow, routeRows] = await Promise.all([
    safe(async () => (await willGet(ctx)).json()), env.DB ? safe(() => crewView(env, now)) : null, env.DB ? safe(() => readStatus(env, now)) : null,
    safe(async () => (await selfcheckGet(ctx)).json()), env.ASSETS ? asset('/exam/latest.json') : null, env.ASSETS ? asset('/brain/knows.json') : null,
    env.ASSETS ? asset('/void.knowledge.json') : null, env.ASSETS ? asset('/skills/index.json') : null,
    env.DB ? kv('voice') : null, env.DB ? kv(UNBIDDEN) : null, env.DB ? kv('lessons') : null, env.DB ? kv('sleep') : null,
    env.DB ? safe(() => env.DB.prepare(CHAIN_SQL).first()) : null,
    env.DB ? safe(async () => (await env.DB.prepare(ROUTES_SQL).bind(new Date(now - 864e5).toISOString()).all()).results || []) : null,
  ]);
  const routes = Array.isArray(routeRows) ? routeRows.reduce((a, r) => { a.today += r.c; a[r.route] = (a[r.route] || 0) + r.c; a.close += r.close || 0; return a; }, { today: 0, close: 0 }) : null;
  // sleep (lib/brain-sleep.js): once a night the last day becomes one note and the lessons are consolidated; a failed sleep never breaks the read
  let slept = sleep;
  if (env.DB && due(sleep, now)) slept = (await safe(async () => sleepIfDue(env, { now, crew, routes, exam, lessons: Array.isArray(lessons) ? lessons : [], last: sleep, log: await kv(SLEEP_LOG),
    voice: Array.isArray(voice) ? voice : [], unbidden: unb && Array.isArray(unb.lines) ? unb.lines : [] }))) || sleep;
  const L = Array.isArray(knowledge) ? knowledge : [];
  const newest = L.slice().sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')))[0] || null;
  const skillCount = Array.isArray(skills) ? skills.length : skills && typeof skills === 'object' ? (Array.isArray(skills.skills) ? skills.skills.length : Object.keys(skills).length) : null;
  return brainOf({
    now, will, crew, status, selfcheck, exam, routes,
    knows: knows ? { counts: knows.counts, builtWith: knows.builtWith } : null,
    knowledge: L.length ? { count: L.length, newest } : null, skills: skillCount != null ? { count: skillCount } : null,
    voice: Array.isArray(voice) ? voice.slice(0, 6).map((v) => ({ at: v.at, kind: v.kind, shipped: v.shipped, thoughts: v.thoughts, question: v.question })) : [],
    unbidden: unb && Array.isArray(unb.lines) ? unb.lines.slice(-6).map((l) => ({ at: l.at, say: l.say })) : [],
    lessons: Array.isArray(lessons) ? lessons.slice(0, 20) : [], sleep: slept, chainRow: chainRow && !chainRow.private ? chainRow : chainRow ? { ...chainRow, note: '' } : null,
    prs: null,
  });
}

export async function onRequestGet({ request, env }) {
  const key = new Request(new URL(request.url).origin + '/__verse-brain');
  try { const hit = await caches.default.match(key); if (hit) return jsonOkCached({ ...(await hit.json()), cached: true }, 200, TTL); } catch (_) { /* no cache here */ }
  let out; try { out = await readBrain(request, env); } catch (_) { return jsonOkCached({ ok: false, say: 'the brain could not be read just now' }, 503, TTL); }
  try { await caches.default.put(key, new Response(JSON.stringify(out), { headers: { 'cache-control': 'max-age=' + TTL } })); } catch (_) { /* no cache here */ }
  return jsonOkCached(out, 200, TTL, { 'x-robots-tag': 'noindex' });
}
