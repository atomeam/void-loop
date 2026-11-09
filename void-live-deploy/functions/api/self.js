// The self card's reading (lib/self-model.js). GET computes one tick from the files and the stored journal.
// It does not write. POST is the owner (the will also writes, on its own run). No model call, no send, no spend.
import { ownerOk } from '../../lib/guard.js';
import { blank, betterPair, publicView, tick } from '../../lib/self-model.js';

export const KEY = 'self-model';
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': status === 200 ? 'public, max-age=60' : 'no-store' } });

async function asset(env, request, path) {
  try {
    if (!env.ASSETS) return null;
    const r = await env.ASSETS.fetch(new Request(new URL(path, request.url)));
    return r.ok ? await r.json() : null;
  } catch (_) { return null; }
}
async function kv(env, key) {
  try { const v = await env.DB.prepare('SELECT v FROM void_kv WHERE k = ?').bind(key).first('v'); return v ? JSON.parse(v) : null; } catch (_) { return null; }
}

export async function gather(env, request) {
  const [betterRows, exam, stored, will] = await Promise.all([asset(env, request, '/void.better.json'), asset(env, request, '/progress/exam.json'), kv(env, KEY), kv(env, 'will')]);
  let rows = [];
  try { rows = ((await env.DB.prepare("SELECT target, state, ask FROM void_queue WHERE target LIKE 'will:%' LIMIT 120").all()).results) || []; } catch (_) { rows = []; }
  const goals = ((will && will.wants) || []).map((w) => w.i_want || w.title).filter(Boolean);
  const actions = rows.map((r) => ({ id: r.target, title: r.ask || r.target, state: r.state, tried: ['live', 'done', 'failed', 'declined', 'deferred', 'set aside'].includes(r.state) ? 1 : 0, succeeded: r.state === 'live' || r.state === 'done' ? 1 : 0, drive: 'competence' }));
  // tally repeats of the same target
  const by = new Map();
  for (const a of actions) {
    const e = by.get(a.id) || { ...a, tried: 0, succeeded: 0 };
    e.tried += a.tried; e.succeeded += a.succeeded; by.set(a.id, e);
  }
  return { stored, raw: { better: betterPair(betterRows), exam, will: will && Array.isArray(will.wants) ? { open: will.wants.length } : null, goals, actions: [...by.values()] } };
}

export async function onRequestGet({ request, env }) {
  const { stored, raw } = await gather(env, request);
  const now = new Date().toISOString();
  const step = tick(stored || blank(now), raw, now);
  const view = publicView(step.self);
  view.stored = !!(stored && stored.tick);
  view.signals = step.signals.map((s) => ({ id: s.id, detail: s.detail, file: s.file, suite: s.suite, value: s.value }));
  view.plan = step.plan;
  view.journalNote = stored ? 'The journal below is the stored ticks, with this reading applied. A page view does not save a new line.' : 'No stored tick yet. This line is computed from the files just read. The will saves a line when it runs.';
  return json(view);
}

export async function remember(env, request, will, at) {
  const { stored, raw } = await gather(env, request);
  if (will && Array.isArray(will.wants)) { raw.goals = will.wants.map((w) => w.i_want || w.title); raw.will = { open: raw.goals.length }; }
  const step = tick(stored || blank(at), raw, at);
  await env.DB.prepare("INSERT INTO void_kv (k, v) VALUES ('self-model', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").bind(JSON.stringify(step.self)).run();
  return step;
}

export async function onRequestPost({ request, env }) {
  if (!(await ownerOk(request, env))) return new Response('no', { status: 401 });
  const step = await remember(env, request, null, new Date().toISOString());
  return json({ ok: true, tick: step.self.tick, at: step.self.at });
}
