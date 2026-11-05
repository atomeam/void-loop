// /api/agent: Verse's agent (lib/agent-core.js). One ongoing thread per visitor (a random id their browser keeps).
// POST { thread, ask }                    -> a task; it runs in the background (waitUntil) and writes each step to D1 as it goes.
// POST { thread, id, decision: yes|no }   -> approve resumes the held task onto the Made shelf; decline stops it. Nothing outside the
//                                            site is ever done: there is no send, pay or delete executor on this route.
// POST { thread, seen: [id, ...] }        -> the member has seen those follow-ups (the inbox clears them). Only this thread's rows.
// POST { thread, proactive: true }        -> Verse may write one note first (a finished job, a due check, or a next step from past asks).
//                                            Free tier only. A send, pay or delete in that note waits for a yes and nothing is sent.
// GET ?thread=<id>                        -> the thread, live steps, the Made shelf, the inbox, the daily brief and the model tier.
// GET ?thread=<id>&task=<id>              -> one task, so a finished one can be reopened from the Made shelf.
// WHAT A STRANGER COULD MAKE THIS DO: 20 tasks a day per visitor (lib/daily-cap.js), 400 a day in all. A task may ask the free model,
// its fallback, and one better bot when the first answer does not address the ask. An exact free bot answers with no model call.
// It can read and mark only its own thread.
import { tierFor, needsYes, brief, TIERS, inboxOf, decisionOf, planNudge, isNudge, NUDGE_LINE } from '../../lib/agent-core.js';
import { attemptsFor, answerBrief, addressesAsk } from '../../lib/agent-answer.js';
import { cap } from '../../lib/daily-cap.js';
import { ANSWER_FALLBACK } from '../../lib/models.js';
import { reasonOf, recordShortfall } from '../../lib/shortfall.js';
import { planOf, routeFree, loadRegistry } from '../../lib/answer-free.js';

const json = (o, status = 200) => Response.json(o, { status, headers: { 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } });
const TABLE = 'CREATE TABLE IF NOT EXISTS void_agent_tasks (id TEXT PRIMARY KEY, thread TEXT NOT NULL, ask TEXT NOT NULL, status TEXT NOT NULL, bot TEXT, tier TEXT, steps TEXT NOT NULL, result TEXT, created INTEGER NOT NULL, done INTEGER, seen INTEGER NOT NULL DEFAULT 0)';
const SEEN = 'ALTER TABLE void_agent_tasks ADD COLUMN seen INTEGER NOT NULL DEFAULT 0';
const FACING = new Set(['needs_yes', 'done', 'failed']);
const okThread = (t) => /^[a-z0-9]{16,40}$/.test(String(t || ''));
const okId = (id) => /^[a-z0-9]{8,40}$/.test(String(id || ''));
let ready = null;
async function table(db) {
  if (!ready) ready = (async () => { await db.prepare(TABLE).run(); try { await db.prepare(SEEN).run(); } catch (_) { /* the column is already there */ } })().catch((e) => { ready = null; throw e; });
  return ready;
}

async function step(db, id, line, patch = {}) {
  // a new facing status is unseen again, so a closed tab hears the change and not the one it already saw
  if (patch.status && patch.seen === undefined && FACING.has(patch.status)) patch = { ...patch, seen: 0 };
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

// the reply text, whichever shape the model answers in (Workers AI's { response } or the OpenAI-style choices); never a thinking block
export const textOf = (out) => String((out && (out.response || (out.choices && out.choices[0] && out.choices[0].message && out.choices[0].message.content))) || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();

// the answer pipeline (lib/answer-free.js) for an exact bot or a research ask; '' when the model should answer. An open ask is the model's.
async function pipelineAnswer(env, origin, ask) {
  const plan = planOf(ask);
  if (!plan || plan.kind === 'llm') return '';
  try {
    const registry = plan.kind === 'api' ? await loadRegistry(env, origin) : null;
    const routed = await routeFree(ask, { env, registry });
    return routed && routed.answer ? String(routed.answer).trim() : '';
  } catch (_) { return ''; }
}

// one bot, the free model then the fallback. Thinking stays off: with it on, Gemma 4 can spend the whole budget and return nothing.
async function replyFrom(env, db, id, tier, bot, ask) {
  const messages = [{ role: 'system', content: answerBrief(bot) }, { role: 'user', content: ask }];
  const runOpts = { messages, max_tokens: 700, chat_template_kwargs: { enable_thinking: false }, reasoning_effort: 'low' };
  let text = '', why = '';
  for (const model of [tier.model, ANSWER_FALLBACK]) {
    try { text = textOf(await env.AI.run(model, runOpts)); why = ''; } catch (e) { why = reasonOf(e); text = ''; }
    if (text.length >= 2) return { text, why: '' };
    if (!why) why = 'empty';
    if (model !== ANSWER_FALLBACK) await step(db, id, 'The ' + tier.name + ' model did not answer (' + why + '); asking the second free model.');
  }
  return { text: '', why };
}

/** one note from Verse on this thread, if one is due. Free tier, no model. Null when there is nothing to say or one was written today. */
export async function considerNudge(env, thread, now = Date.now()) {
  if (!env || !env.DB || !okThread(thread)) return null;
  await table(env.DB);
  const r = await env.DB.prepare('SELECT id, ask, status, bot, tier, steps, result, created, done, seen FROM void_agent_tasks WHERE thread = ? ORDER BY created DESC LIMIT 50').bind(thread).all();
  const tasks = (r.results || []).map((t) => ({ ...t, steps: JSON.parse(t.steps || '[]'), seen: Number(t.seen) || 0 }));
  const plan = planNudge(tasks, now);
  if (!plan) return null;
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 20);
  const steps = JSON.stringify([{ at: now, line: NUDGE_LINE }, { at: now, line: plan.line }]);
  const done = plan.status === 'needs_yes' ? null : now;
  await env.DB.prepare('INSERT INTO void_agent_tasks (id, thread, ask, status, bot, tier, steps, result, created, done, seen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, thread, String(plan.ask).slice(0, 1000), plan.status, 'verse', 'free', steps, String(plan.result || '').slice(0, 4000), now, done, 0).run();
  return { id, status: plan.status, kind: plan.kind, tier: 'free' };
}

export async function run(env, origin, id, ask, thread) {
  const db = env.DB;
  try {
    if (thread) { try { await considerNudge(env, thread); } catch (_) { /* a note is never required for the task itself */ } }
    await step(db, id, 'Read your task.', { status: 'running' });
    const tier = tierFor(await infraCents(origin));
    await step(db, id, 'Thinking on the ' + tier.name + ' model tier.', { tier: tier.name });
    let text = '', why = 'empty', missed = false;
    // an exact free bot (base64, a unit, a prime) answers with no model call. Anything else still goes to the free model below.
    if (planOf(ask).kind === 'bot') {
      const piped = await pipelineAnswer(env, origin, ask);
      if (addressesAsk(ask, piped)) {
        text = piped;
        await step(db, id, 'Handed it to the answer pipeline.', { bot: 'verse' });
        await step(db, id, 'Checked the result (' + piped.split(/\s+/).length + ' words). It addresses the ask.');
      }
    }
    const tries = text ? [] : attemptsFor(ask, await bots(origin, env));
    for (const bot of tries) {
      if (bot.repair && !missed) break; // the previous try was empty, not a wrong answer: the same models will not do better
      await step(db, id, 'Handed it to ' + bot.name + (bot.repair ? ' again, to answer the task.' : '.'), { bot: bot.name });
      if (bot.name === 'verse' && !bot.repair) {
        const piped = await pipelineAnswer(env, origin, ask);
        if (addressesAsk(ask, piped)) { text = piped; await step(db, id, 'Checked the result (' + piped.split(/\s+/).length + ' words). It addresses the ask.'); break; }
      }
      const got = await replyFrom(env, db, id, tier, bot, ask);
      if (addressesAsk(ask, got.text)) { text = got.text; await step(db, id, 'Checked the result (' + got.text.split(/\s+/).length + ' words). It addresses the ask.'); break; }
      text = '';
      if (got.text) { missed = true; await step(db, id, bot.name + ' did not address the ask.'); }
      else { why = got.why || why; missed = false; if (bot.name === 'verse') break; }
    }
    if (!text) throw new Error(why || 'empty');
    if (needsYes(ask)) {
      await step(db, id, 'This one sends, pays or deletes something, so it waits for your yes.', { status: 'needs_yes', result: text.slice(0, 4000) });
    } else {
      await step(db, id, 'Done. It is on your Made shelf.', { status: 'done', result: text.slice(0, 4000), done: Date.now() });
    }
    if (thread) { try { await considerNudge(env, thread); } catch (_) {} }
  } catch (e) {
    try { await recordShortfall(env, 'agent', reasonOf(e)); } catch (_) {}
    try { await step(db, id, 'Got stuck: the model did not answer. Try again in a minute.', { status: 'failed', done: Date.now() }); } catch (_) {}
  }
}

export async function onRequestGet({ request, env }) {
  const thread = new URL(request.url).searchParams.get('thread');
  if (!okThread(thread)) return json({ ok: false, say: 'no thread' }, 400);
  if (!env.DB) return json({ ok: false, say: 'storage is off' }, 503);
  await table(env.DB);
  const r = await env.DB.prepare('SELECT id, ask, status, bot, tier, steps, result, created, done, seen FROM void_agent_tasks WHERE thread = ? ORDER BY created DESC LIMIT 50').bind(thread).all();
  const tasks = (r.results || []).map((t) => ({ ...t, steps: JSON.parse(t.steps || '[]'), seen: Number(t.seen) || 0 }));
  const taskId = new URL(request.url).searchParams.get('task');
  if (taskId) {
    if (!okId(taskId)) return json({ ok: false, say: 'no task' }, 400);
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return json({ ok: false, say: 'no task' }, 404);
    return json({ ok: true, task });
  }
  return json({ ok: true, tasks, made: tasks.filter((t) => t.status === 'done' && !isNudge(t)), inbox: inboxOf(tasks), brief: brief(tasks), tiers: TIERS.map(({ name, month_cents, why }) => ({ name, month_cents, why })) });
}

export async function onRequestPost({ request, env, waitUntil }) {
  let b; try { b = await request.json(); } catch (_) { return json({ ok: false, say: 'send JSON' }, 400); }
  if (!okThread(b.thread)) return json({ ok: false, say: 'no thread' }, 400);
  if (b.proactive === true) {
    if (!env.DB) return json({ ok: false, say: 'the agent is off' }, 503);
    const nudge = await considerNudge(env, b.thread);
    return json({ ok: true, nudge: nudge || null });
  }
  if (!env.DB || !env.AI) return json({ ok: false, say: 'the agent is off' }, 503);
  await table(env.DB);
  if (b.id && b.decision) {
    const t = await env.DB.prepare('SELECT status, result FROM void_agent_tasks WHERE id = ? AND thread = ?').bind(String(b.id), b.thread).first();
    const d = decisionOf(b.decision, t);
    if (!d.ok) return json({ ok: false, say: d.say }, d.say === 'yes or no' ? 400 : 409);
    await step(env.DB, String(b.id), d.line, { status: d.status, seen: d.seen, done: Date.now() });
    return json({ ok: true, status: d.status });
  }
  if (Array.isArray(b.seen)) {
    const ids = [...new Set(b.seen.map((x) => String(x || '')).filter(okId))].slice(0, 20);
    if (!ids.length) return json({ ok: false, say: 'nothing to mark' }, 400);
    const qs = ids.map(() => '?').join(', ');
    await env.DB.prepare('UPDATE void_agent_tasks SET seen = 1 WHERE thread = ? AND id IN (' + qs + ')').bind(b.thread, ...ids).run(); // void-review: ok (one ? per id, every value is bound, and the WHERE thread is this caller's own)
    return json({ ok: true, seen: ids.length });
  }
  const ask = String(b.ask || '').trim().slice(0, 1000);
  if (ask.length < 3) return json({ ok: false, say: 'tell me the task' }, 400);
  const ip = request.headers.get('cf-connecting-ip') || 'x';
  const h = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip + (env.SALT || '')))).slice(0, 8)].map((x) => x.toString(16).padStart(2, '0')).join('');
  if (!(await cap(env, 'agent-all', 400)).ok || !(await cap(env, 'agent:' + h, 20)).ok) return json({ ok: false, say: 'that is today\'s free tasks; more come back tomorrow' }, 429);
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 20);
  await env.DB.prepare('INSERT INTO void_agent_tasks (id, thread, ask, status, steps, created) VALUES (?, ?, ?, ?, ?, ?)').bind(id, b.thread, ask, 'queued', JSON.stringify([{ at: Date.now(), line: 'Got it. Queued.' }]), Date.now()).run();
  waitUntil(run(env, new URL(request.url).origin, id, ask, b.thread));
  return json({ ok: true, id });
}
