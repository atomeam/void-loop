// Verse's coding agent's brain on the site's own Workers AI binding (tools/verse-agent.mjs, docs/brains.md, docs/playbooks/verse-agent.md): the repo's
// Cloudflare token cannot run Workers AI (401, found by the Versus loop on 2026-10-26), so the agent's model calls come here.
// What could a stranger make this do? Nothing: without the owner key or an agent ticket (lib/agent-ticket.js: an HMAC of the owner key over an expiry
// and a run id, at most three hours long, minted in a workflow step that runs no model code) it answers 401 and runs nothing. With a ticket: run one
// of the agent's free models (lib/models.js AGENT_MODELS, never a paid one) on at most 40 messages and 60,000 characters, at most 3,000 tokens out,
// at most 300 calls a day across every ticket (lib/daily-cap.js, shared by every edge location; no D1 means no call). Nothing is stored or logged.
// POST { model, messages: [{ role: 'system'|'user'|'assistant', content }], max_tokens? } -> { text, usage: { prompt_tokens, completion_tokens } }
import { ownerOk } from '../../lib/guard.js';
import { ticketOk } from '../../lib/agent-ticket.js';
import { AGENT_MODELS } from '../../lib/models.js';
import { cap } from '../../lib/daily-cap.js';

export const DAY_CALLS = 300, MAX_MESSAGES = 40, MAX_CHARS = 60000, MAX_OUT = 3000;
const ALLOWED = new Set([...AGENT_MODELS.fast, ...AGENT_MODELS.strong]);
const pick = (r) => (r && (r.response || (r.choices && r.choices[0] && r.choices[0].message && (r.choices[0].message.content || r.choices[0].message.reasoning_content)) || (r.result && r.result.response))) || '';

/** the body checked: { model, messages, max } or null. Pure. */
export function bodyOf(b) {
  if (!b || !ALLOWED.has(b.model)) return null;
  const ms = Array.isArray(b.messages) ? b.messages : null; if (!ms || !ms.length || ms.length > MAX_MESSAGES) return null;
  let total = 0; const messages = [];
  for (const m of ms) { if (!m || !['system', 'user', 'assistant'].includes(m.role) || typeof m.content !== 'string') return null; total += m.content.length; messages.push({ role: m.role, content: m.content }); }
  if (total > MAX_CHARS || !messages.some((m) => m.role === 'user' && m.content.trim())) return null;
  return { model: b.model, messages, max: Math.max(50, Math.min(MAX_OUT, Number(b.max_tokens) || 1500)) };
}
/** the model's own options: a reasoning model is asked to think briefly, others not at all (thinking spent whole budgets on the Versus loop). Pure. */
export const optionsFor = (model) => (/gpt-oss/.test(model) ? { reasoning_effort: 'low' } : { chat_template_kwargs: { enable_thinking: false } });

export async function onRequestPost({ request, env }) {
  const h = request.headers.get('authorization') || '';
  const allowed = (await ownerOk(request, env)) || (h.startsWith('Bearer vt1.') && (await ticketOk(h.slice(7), env && env.READ_TOKEN)).ok);
  if (!allowed) return new Response('no', { status: 401 });
  let b = null; try { b = bodyOf(JSON.parse(await request.text())); } catch (_) { b = null; }
  if (!b) return new Response('a model from the agent\'s list and its messages are needed (at most 40, 60,000 characters)', { status: 400 });
  if (!env.AI) return new Response('no model bound', { status: 503 });
  if (!(await cap(env, 'agent-brain', DAY_CALLS)).ok) return Response.json({ error: 'the agent\'s calls for today are used up' }, { status: 429 });
  const run = (opts) => env.AI.run(b.model, { messages: b.messages, max_tokens: b.max, ...opts });
  try {
    let r; try { r = await run(optionsFor(b.model)); } catch (_) { r = await run({}); } // a model that refuses the option gets the plain call
    let text = pick(r); if (text && typeof text !== 'string') text = JSON.stringify(text);
    const u = (r && r.usage) || {};
    return Response.json({ text: String(text || ''), usage: { prompt_tokens: +u.prompt_tokens || 0, completion_tokens: +u.completion_tokens || 0 } });
  } catch (e) { return Response.json({ error: 'the model did not answer: ' + String((e && e.message) || e).replace(/\s+/g, ' ').slice(0, 160) }, { status: 503 }); }
}
