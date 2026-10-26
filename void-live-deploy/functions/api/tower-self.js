// Verse's own model for Versus by itself (tools/tower-self.mjs, .github/workflows/tower-self.yml): the loop's two questions (which floor does a site's
// job and the new page's words; a site's feature list) answered on the site's own Workers AI binding, the free model of the will path, because the
// repo's Cloudflare token cannot run Workers AI. Owner only: a stranger gets 401 and nothing runs. Nothing is stored.
// POST { messages: [{ role: 'system'|'user', content }], schema?: { name, schema }, max_tokens? }  -> { text }
// 400 for a malformed body (at most 4 messages, 24,000 characters in all, 2,000 tokens out); 503 when no model is bound or it did not answer.
import { ownerOk } from '../../lib/guard.js';
import { models } from '../../lib/models.js';
import { recordShortfall, reasonOf } from '../../lib/shortfall.js';

const pick = (r) => (r && (r.response || (r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content) || (r.result && r.result.response))) || '';
/** the body checked: { messages, schema, max } or null. Pure. */
export function bodyOf(b) {
  const ms = Array.isArray(b && b.messages) ? b.messages : null; if (!ms || !ms.length || ms.length > 4) return null;
  let total = 0; const messages = [];
  for (const m of ms) { if (!m || !['system', 'user'].includes(m.role) || typeof m.content !== 'string' || !m.content.trim()) return null; total += m.content.length; messages.push({ role: m.role, content: m.content }); }
  if (total > 24000) return null;
  const schema = b.schema && typeof b.schema === 'object' && typeof b.schema.name === 'string' && b.schema.schema && typeof b.schema.schema === 'object' && JSON.stringify(b.schema).length <= 4000 ? b.schema : null;
  return { messages, schema, max: Math.max(100, Math.min(2000, Number(b.max_tokens) || 900)) };
}
export async function onRequestPost({ request, env }) {
  if (!(await ownerOk(request, env))) return new Response('no', { status: 401 });
  let b = null; try { b = bodyOf(JSON.parse(await request.text())); } catch (_) { b = null; }
  if (!b) return new Response('messages are needed (at most 4, 24,000 characters)', { status: 400 });
  if (!env.AI) return new Response('no model bound', { status: 503 });
  try {
    const r = await env.AI.run(models('will'), { messages: b.messages, max_tokens: b.max, chat_template_kwargs: { enable_thinking: false }, // thinking spent the whole budget and left the answer empty (the first proof runs)
      ...(b.schema ? { response_format: { type: 'json_schema', json_schema: b.schema } } : {}) });
    let text = pick(r); if (text && typeof text !== 'string') text = JSON.stringify(text);
    return Response.json({ text: String(text || '') });
  } catch (e) { try { await recordShortfall(env, 'tower-self', reasonOf(e)); } catch (_) {} return Response.json({ error: 'the model did not answer: ' + reasonOf(e) }, { status: 503 }); }
}
