// Verse's coder thinks on Verse's own model (tools/verse-coder.mjs, provider "verse"). Owner only; nothing is stored but the day's count.
// The Actions token that reached Workers AI over the REST API answered 401 on every job from 2026-10-28 (it was made for deploys), so
// the coder idled for a day with nothing shipped; the site's own AI binding answers the same free model without that token.
// POST { messages: [{ role: system|user|assistant, content }], max_tokens? }
//   -> { result: { response, usage }, model }   the Workers AI shape, so the coder reads it like a direct call
// 401 for anyone but the owner; 400 for a malformed conversation; 429 when the day's or the hour's calls are used up (lib/daily-cap.js,
// so a runaway lap cannot spend the free allowance the public answers need); 503 when no model is bound or it did not answer.
import { ownerOk } from '../../lib/guard.js';
import { models } from '../../lib/models.js';
import { capAll, peek } from '../../lib/daily-cap.js';
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
  const [h, d] = await Promise.all([peek(env, hourKey(now), now), peek(env, 'coder', now)]);
  return Response.json({ model: models('coder'), ...budgetOf(h, d, now) }, { headers: { 'cache-control': 'no-store' } });
}

const pick = (r) => (r && (r.response || (r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content) || (r.result && r.result.response))) || '';

export async function onRequestPost({ request, env }) {
  if (!(await ownerOk(request, env))) return new Response('no', { status: 401 });
  let b = {}; try { b = JSON.parse(await request.text()); } catch (_) { /* judged below */ }
  const messages = cleanMessages(b.messages);
  if (!messages) return new Response('messages: 1 to ' + CODER_LIMITS.messages + ' of { role, content }, ' + CODER_LIMITS.chars + ' characters in all', { status: 400 });
  if (!env.AI) return new Response('no model bound', { status: 503 });
  const room = await capAll(env, [[hourKey(Date.now()), CODER_LIMITS.perHour], ['coder', CODER_LIMITS.perDay]]);
  if (!room.ok) return new Response('the coder\'s calls for this ' + (room.key === 'coder' ? 'day' : 'hour') + ' are used up', { status: 429 });
  const max = Math.min(CODER_LIMITS.maxOut, Math.max(1, Math.floor(Number(b.max_tokens) || 4096)));
  const model = models('coder');
  try {
    const r = await env.AI.run(model, { messages, max_tokens: max, temperature: 0.2, chat_template_kwargs: { enable_thinking: false } });
    let text = pick(r); if (text && typeof text !== 'string') text = JSON.stringify(text);
    if (!String(text || '').trim()) return new Response('the model answered nothing', { status: 503 });
    return Response.json({ result: { response: text, usage: (r && r.usage) || {} }, model });
  } catch (e) {
    try { await recordShortfall(env, 'coder', reasonOf(e)); } catch (_) { /* the count is best effort */ }
    return new Response('the model did not answer: ' + reasonOf(e), { status: 503 });
  }
}
