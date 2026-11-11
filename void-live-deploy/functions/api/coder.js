// Verse's coder thinks on Verse's own model (tools/verse-coder.mjs, provider "verse"). Owner only; nothing is stored but the day's count.
// The Actions token that reached Workers AI over the REST API answered 401 on every job from 2026-10-28 (it was made for deploys), so
// the coder idled for a day with nothing shipped; the site's own AI binding answers the same free model without that token.
// POST { messages: [{ role: system|user|assistant, content }], max_tokens? }
//   -> { result: { response, usage }, model }   the Workers AI shape, so the coder reads it like a direct call
// 401 for anyone but the owner; 400 for a malformed conversation; 429 when the day's or the hour's calls are used up (lib/daily-cap.js,
// so a runaway lap cannot spend the free allowance the public answers need); 503 when no model is bound or it did not answer.
import { ownerOk } from '../../lib/guard.js';
import { models } from '../../lib/models.js';
import { runFree } from '../../lib/ai-gateway.js';
import { capAll, peek, uncap } from '../../lib/daily-cap.js';
import { recordShortfall, reasonOf } from '../../lib/shortfall.js';

export const CODER_LIMITS = Object.freeze({ messages: 100, chars: 380000, maxOut: 8192, perHour: 90, perDay: 360 });
const ROLES = new Set(['system', 'user', 'assistant']);

/** the conversation as the model gets it, or null when it is malformed. Pure. */
export function cleanMessages(m) {
  if (!Array.isArray(m) || !m.length || m.length > CODER_LIMITS.messages) return null;
  let chars = 0;
  const out = [];
  for (const x of m) {
    if (!x || !ROLES.has(x.role) || typeof x.content !== 'string') return null;
    chars += x.content.length; if (chars > CODER_LIMITS.chars) return null;
    out.push({ role: x.role, content: x.content });
  }
  return out;
}

const hourKey = (now) => 'coder-hour:' + new Date(now).toISOString().slice(11, 13);
// Replies that actually came back. The old `coder` day count filled up on empty answers (the route returned 503 and still kept the place), so the brain stayed dark for the rest of the day.
const DAY_KEY = 'coder-reply';
// The same ask the working answer path uses (functions/api/answer.js ANSWER_RUN). chat_template_kwargs alone no longer stops Gemma thinking, and a turn spent thinking comes back with an empty content, which this route used to report as 503.
const RUN = { chat_template_kwargs: { enable_thinking: false }, reasoning_effort: 'low' };

/** the coder's free calls as counts: { hour: { used, cap }, day: { used, cap }, room, until } (until: when room comes back, ISO, or null).
 *  Pure apart from the two counts it is given (null: unknown, so room is unknown too). */
export function budgetOf(hourUsed, dayUsed, now = Date.now()) {
  const known = hourUsed != null && dayUsed != null;
  const dayFull = known && dayUsed >= CODER_LIMITS.perDay, hourFull = known && hourUsed >= CODER_LIMITS.perHour;
  const d = new Date(now);
  const nextDay = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
  const nextHour = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours() + 1);
  return {
    hour: { used: hourUsed, cap: CODER_LIMITS.perHour },
    day: { used: dayUsed, cap: CODER_LIMITS.perDay },
    room: known ? !dayFull && !hourFull : null,
    until: dayFull ? new Date(nextDay).toISOString() : hourFull ? new Date(nextHour).toISOString() : null,
  };
}

// GET: how many of today's and this hour's calls the coder has used (counts only, no asks, no keys), so the conductor starts the coder only
// when a model will answer (2026-10-30: 40 runs a day went to "no model answered" once the day's calls were used up) and /autopilot/ shows it
export async function onRequestGet({ env }) {
  const now = Date.now();
  const [h, d] = await Promise.all([peek(env, hourKey(now), now), peek(env, DAY_KEY, now)]);
  return Response.json({ model: models('coder'), ...budgetOf(h, d, now) }, { headers: { 'cache-control': 'no-store' } });
}

const clip = (s) => String(s || '').replace(/[A-Za-z0-9_-]{24,}/g, '[masked]').replace(/\s+/g, ' ').trim().slice(0, 80);
/** the visible answer. Gemma now returns an OpenAI chat completion; a thinking turn leaves content empty and puts the words in reasoning_content, or wraps them in think tags. Pure. */
export function saidText(r) {
  if (!r || typeof r !== 'object') return '';
  const msg = r.choices && r.choices[0] && r.choices[0].message;
  let content = '';
  if (typeof r.response === 'string') content = r.response;
  else if (msg && typeof msg.content === 'string') content = msg.content;
  else if (msg && Array.isArray(msg.content)) content = msg.content.map((p) => (p && (p.text || (typeof p.content === 'string' ? p.content : ''))) || '').join('');
  else if (r.result && typeof r.result.response === 'string') content = r.result.response;
  const visible = String(content).replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/^[\s\S]*<\/think>/i, '').trim();
  if (visible) return visible;
  const thought = (msg && (msg.reasoning_content || msg.reasoning)) || r.reasoning || '';
  return String(thought).replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

export async function onRequestPost({ request, env }) {
  if (!(await ownerOk(request, env))) return new Response('no', { status: 401 });
  let b = {}; try { b = JSON.parse(await request.text()); } catch (_) { /* judged below */ }
  const messages = cleanMessages(b.messages);
  if (!messages) return new Response('messages: 1 to ' + CODER_LIMITS.messages + ' of { role, content }, ' + CODER_LIMITS.chars + ' characters in all', { status: 400 });
  if (!env.AI) return new Response('no model bound', { status: 503 });
  const now = Date.now(), keys = [[hourKey(now), CODER_LIMITS.perHour], [DAY_KEY, CODER_LIMITS.perDay]];
  const room = await capAll(env, keys, now);
  if (!room.ok) return new Response('the coder\'s calls for this ' + (room.key === DAY_KEY ? 'day' : 'hour') + ' are used up', { status: 429 });
  const giveBack = async () => { for (const [key] of keys) await uncap(env, key, now); };
  const max = Math.min(CODER_LIMITS.maxOut, Math.max(1, Math.floor(Number(b.max_tokens) || 4096)));
  const model = models('coder');
  const ask = (extra) => runFree(env, model, { messages, max_tokens: max, ...RUN, ...extra });
  try {
    let r = await ask();
    let text = saidText(r);
    if (!text) { r = await ask({ reasoning_effort: 'none', max_tokens: Math.min(max, 1024) }); text = saidText(r); }
    if (!text) { await giveBack(); return new Response('the model answered nothing', { status: 503 }); }
    return Response.json({ result: { response: text, usage: (r && r.usage) || {} }, model });
  } catch (e) {
    await giveBack();
    try { await recordShortfall(env, 'coder', reasonOf(e)); } catch (_) { /* the count is best effort */ }
    return new Response('the model did not answer: ' + reasonOf(e) + (clip(e && e.message) ? ' (' + clip(e && e.message) + ')' : ''), { status: 503 });
  }
}
