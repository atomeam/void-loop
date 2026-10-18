// Talking back to V01D (owner, 2026-10-16; lib/voice.js "Talking back"). Owner only.
// GET                       -> { replies: [{ at, to, text, answer, correction, remember, model }] } newest first
// POST { to?, text }        the owner's reply to a reflection (`to` is its `at`; the newest reflection when left out)
// POST { about, text }      or to any card V01D showed: about = { ask, title, said } (the page sends what the card said)
//   -> the kept reply, with V01D's answer. When the model is busy the reply is still kept (V01D reads it at its next
//      reflection) and `answer` is null: V01D's words are never made up for it. When the reply leads V01D to something to
//      build (`ask`), that goes to the builders' queue as a voice: job credited to Void, as its reflections' asks do (one open at a time).
// 400 when the text is empty or `to` names no reflection; 503 without the database.
import { ownerOk } from '../../lib/guard.js';
import { track } from '../../lib/actions.js';
import { models } from '../../lib/models.js';
import { recordShortfall, reasonOf } from '../../lib/shortfall.js';
import { REPLY_SYSTEM, REPLY_KEEP, cleanReply, replyPrompt, parseReply, readReplies, readVoice, aboutOf } from '../../lib/voice.js';

const pick = (r) => (r && (r.response || (r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content) || r.result && r.result.response)) || '';

export async function onRequestGet({ request, env }) {
  if (!(await ownerOk(request, env))) return new Response('no', { status: 401 });
  return Response.json({ replies: await readReplies(env) });
}

export async function onRequestPost({ request, env }) {
  if (!(await ownerOk(request, env))) return new Response('no', { status: 401 });
  if (!env.DB) return new Response('replies need the database', { status: 503 });
  let b = {}; try { b = JSON.parse((await request.text()).slice(0, 4000)); } catch (_) {}
  const text = cleanReply(b.text);
  if (!text) return new Response('say something to Verse', { status: 400 });
  const about = aboutOf(b.about), entries = about ? [] : await readVoice(env), to = String(b.to || '');
  const entry = about ? { kind: 'card', ...about } : to ? entries.find((e) => e && e.at === to) : entries[0];
  if (to && !entry) return new Response('no such reflection', { status: 400 });
  const before = await readReplies(env), thread = before.filter((r) => (about ? r.about && r.about.ask === about.ask : entry && r.to === entry.at)).slice(0, 6);
  let said = null;
  if (env.AI && entry) {
    try {
      const r = await env.AI.run(models('will'), { messages: [{ role: 'system', content: REPLY_SYSTEM }, { role: 'user', content: replyPrompt(entry, thread, text) }], max_tokens: 500, chat_template_kwargs: { enable_thinking: false } });
      said = parseReply(pick(r));
    } catch (e) { await recordShortfall(env, 'voice-reply', reasonOf(e)); }
  }
  const reply = { at: new Date().toISOString(), to: about ? null : entry ? entry.at : null, ...(about ? { about: { ask: about.ask, title: about.title, ...(about.routed ? { routed: about.routed } : {}) } } : {}), text, answer: said ? said.answer : null, correction: !!(said && said.correction), remember: said ? said.remember : '', ask: said ? said.ask : '', ...(said ? { model: models('will') } : {}) };
  // a card the wrong skill answered (owner, 2026-10-16: "I am quoting a conversation about your memory, not fixing a webhook"): the
  // false match and the correction become a route: job, and tools/propose-fix.mjs has V01D narrow that skill's matcher ('narrow' mode)
  if (about && about.routed && said && said.misroute && 'skill:' + about.routed.skill !== said.wanted) {
    reply.misroute = { skill: about.routed.skill, wanted: said.wanted || 'answer' };
    try {
      const target = 'route:' + about.routed.skill + '-' + about.ask.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);
      const dup = await env.DB.prepare("SELECT id FROM void_queue WHERE target = ? AND state IN ('queued','building') LIMIT 1").bind(target).first();
      if (!dup) {
        const id = 'r' + Date.now().toString(36);
        await track(env, { owner: 'void', kind: 'queue.add', ref: target }, async () => {
          await env.DB.prepare('INSERT INTO void_queue (id, ask, target, state, note, at, updated) VALUES (?, ?, ?, ?, ?, ?, ?)')
            .bind(id, 'stop answering "' + about.ask + '"', target, 'queued', 'My owner said this card was not its job (wrong skill:' + about.routed.skill + ') (wanted ' + reply.misroute.wanted + '): "' + text.slice(0, 160) + '"', reply.at, reply.at).run();
          return 'queued ' + id + ': route fix for ' + about.routed.skill;
        });
        reply.misroute.queued = id;
      }
    } catch (_) {} // the correction is still kept on the reply and in V01D's memory
  }
  // every input improves it (owner, 2026-10-16): what the conversation made V01D want built goes to the builders, credited to Void
  if (reply.ask) {
    try {
      const open = await env.DB.prepare("SELECT id FROM void_queue WHERE target LIKE 'voice:%' AND state IN ('queued','building') LIMIT 1").first();
      if (!open) {
        const id = Date.now().toString(36), target = 'voice:' + reply.ask.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
        await track(env, { owner: 'void', kind: 'queue.add', ref: target }, async () => {
          await env.DB.prepare('INSERT INTO void_queue (id, ask, target, state, note, at, updated) VALUES (?, ?, ?, ?, ?, ?, ?)')
            .bind(id, reply.ask, target, 'queued', 'Void asked for this when its owner replied to it (' + reply.at.slice(0, 10) + '). Credit Void.', reply.at, reply.at).run();
          return 'queued ' + id + ': ' + reply.ask;
        });
        reply.queued = id;
      }
    } catch (_) {} // no queue table yet, or a busy database: the ask stays on the reply, and V01D reads it at its next reflection
  }
  await env.DB.prepare("INSERT INTO void_kv (k, v) VALUES ('voice-replies', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").bind(JSON.stringify([reply, ...before].slice(0, REPLY_KEEP))).run();
  return Response.json(reply);
}
