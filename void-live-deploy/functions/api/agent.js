// /api/agent: Verse's agent (lib/agent-core.js). One ongoing thread per visitor (a random id their browser keeps).
// POST { thread, ask }                    -> a task; it runs in the background (waitUntil) and writes each step to D1 as it goes.
// POST { thread, id, decision: yes|no }   -> the approval card's answer. Nothing outside the site is ever done: a yes on a send/pay/delete
//                                            records the yes and Verse says the service isn't connected yet (functions/api/approval.js keeps real executors, owner only).
// GET ?thread=<id>                        -> the thread, live steps, the Made shelf, the daily brief and the model tier.
// WHAT A STRANGER COULD MAKE THIS DO: spend up to 20 free model calls a day per visitor (lib/daily-cap.js), 400 a day in all, and read only their own thread.
import { tierFor, needsYes, pickBot, brief, TIERS } from '../../lib/agent-core.js';
import { cap } from '../../lib/daily-cap.js';

const json = (o, status = 200) => Response.json(o, { status, headers: { 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } });
const TABLE = 'CREATE TABLE IF NOT EXISTS void_agent_tasks (id TEXT PRIMARY KEY, thread TEXT NOT NULL, ask TEXT NOT NULL, status TEXT NOT NULL, bot TEXT, tier TEXT, steps TEXT NOT NULL, result TEXT, created INTEGER NOT NULL, done INTEGER)';
const okThread = (t) => /^[a-z0-9]{16,40}$/.test(String(t || ''));
let ready = null;
const table = (db) => (ready ||= db.prepare(TABLE).run().catch((e) => { ready = null; throw e; }));

async function step(db, id, line, patch = {}) {
  const row = await db.prepare('SELECT steps FROM void_agent_tasks WHERE id = ?').bind(id).first();
  const steps = JSON.parse((row && row.steps) || '[]'); steps.push({ at: Date.now(), line });
  const sets = ['steps = ?'], vals = [JSON.stringify(steps)];
  for (const [k, v] of Object.entries(patch)) { sets.push(k + ' = ?'); vals.push(v); }
  await db.prepare('UPDATE void_agent_tasks SET ' + sets.join(', ') + ' WHERE id = ?').bind(...vals, id).run(); // void-review: ok (column names are this file's fixed keys; every value is bound)
}

async function bots(origin, env) {
  for (const p of ['/bots/registry.json', '/tools.json']) {
    try {
      const r = p === '/tools.json' ? await fetch(origin + p) : await env.ASSETS.fetch(new Request(origin + p)); // void-review: ok (two fixed files, tried in order until one answers)
      if (r.ok) { const j = await r.json(); const list = Array.isArray(j) ? j : (j.bots || j.tools || []); if (list.length) return list; }
    } catch (_) {}
  }
  return [];
}

async function infraCents(origin) {
  try { const j = await (await fetch(origin + '/api/treasury')).json(); return Number(j.pots && j.pots.infrastructure) || 0; } catch (_) { return 0; }
}

export async function run(env, origin, id, ask) {
  const db = env.DB;
  try {
    await step(db, id, 'Read your task.', { status: 'running' });
    const bot = pickBot(ask, await bots(origin, env));
    await step(db, id, 'Handed it to ' + bot.name + '.', { bot: bot.name });
    const tier = tierFor(await infraCents(origin));
    await step(db, id, 'Thinking on the ' + tier.name + ' model tier.', { tier: tier.name });
    const out = await env.AI.run(tier.model, { messages: [
      { role: 'system', content: 'You are Verse, a helpful agent. You are acting as the bot "' + bot.name + '" (' + bot.description + '). Do the task fully and concretely. Plain text, under 250 words. Never claim to have sent, paid, posted or deleted anything.' },
      { role: 'user', content: ask } ], max_tokens: 700 });
    const text = String((out && (out.response || (out.choices && out.choices[0] && out.choices[0].message && out.choices[0].message.content))) || '').trim();
    if (text.length < 2) throw new Error('empty');
    await step(db, id, 'Checked the result (' + text.split(/\s+/).length + ' words).');
    if (needsYes(ask)) {
      await step(db, id, 'This one sends, pays or deletes something, so it waits for your yes.', { status: 'needs_yes', result: text.slice(0, 4000) });
    } else {
      await step(db, id, 'Done. It is on your Made shelf.', { status: 'done', result: text.slice(0, 4000), done: Date.now() });
    }
  } catch (e) {
    try { await step(db, id, 'Got stuck: the model did not answer. Try again in a minute.', { status: 'failed', done: Date.now() }); } catch (_) {}
  }
}

export async function onRequestGet({ request, env }) {
  const thread = new URL(request.url).searchParams.get('thread');
  if (!okThread(thread)) return json({ ok: false, say: 'no thread' }, 400);
  if (!env.DB) return json({ ok: false, say: 'storage is off' }, 503);
  await table(env.DB);
  const r = await env.DB.prepare('SELECT id, ask, status, bot, tier, steps, result, created, done FROM void_agent_tasks WHERE thread = ? ORDER BY created DESC LIMIT 50').bind(thread).all();
  const tasks = (r.results || []).map((t) => ({ ...t, steps: JSON.parse(t.steps || '[]') }));
  return json({ ok: true, tasks, made: tasks.filter((t) => t.status === 'done'), brief: brief(tasks), tiers: TIERS.map(({ name, month_cents, why }) => ({ name, month_cents, why })) });
}

export async function onRequestPost({ request, env, waitUntil }) {
  let b; try { b = await request.json(); } catch (_) { return json({ ok: false, say: 'send JSON' }, 400); }
  if (!okThread(b.thread)) return json({ ok: false, say: 'no thread' }, 400);
  if (!env.DB || !env.AI) return json({ ok: false, say: 'the agent is off' }, 503);
  await table(env.DB);
  if (b.id && b.decision) {
    const yes = b.decision === 'yes';
    const t = await env.DB.prepare('SELECT status FROM void_agent_tasks WHERE id = ? AND thread = ?').bind(String(b.id), b.thread).first();
    if (!t || t.status !== 'needs_yes') return json({ ok: false, say: 'nothing waiting' }, 409);
    await step(env.DB, String(b.id), yes ? 'You said yes. The draft is on your Made shelf; sending it for you needs that service connected, which is coming.' : 'You said no. Nothing was done.', { status: yes ? 'done' : 'declined', done: Date.now() });
    return json({ ok: true });
  }
  const ask = String(b.ask || '').trim().slice(0, 1000);
  if (ask.length < 3) return json({ ok: false, say: 'tell me the task' }, 400);
  const ip = request.headers.get('cf-connecting-ip') || 'x';
  const h = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip + (env.SALT || '')))).slice(0, 8)].map((x) => x.toString(16).padStart(2, '0')).join('');
  if (!(await cap(env, 'agent-all', 400)).ok || !(await cap(env, 'agent:' + h, 20)).ok) return json({ ok: false, say: 'that is today\'s free tasks; more come back tomorrow' }, 429);
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 20);
  await env.DB.prepare('INSERT INTO void_agent_tasks (id, thread, ask, status, steps, created) VALUES (?, ?, ?, ?, ?, ?)').bind(id, b.thread, ask, 'queued', JSON.stringify([{ at: Date.now(), line: 'Got it. Queued.' }]), Date.now()).run();
  waitUntil(run(env, new URL(request.url).origin, id, ask));
  return json({ ok: true, id });
}
