// V01D proposes the fix for an ask its own probe missed (frontier #28, step 3; lib/propose-fix.js). Owner only; nothing is stored.
// POST { ask, skill, source }   the missed ask, the owning skill's name and its file as it stands (tools/propose-fix.mjs sends it)
//   -> { edits: [{ find, replace }], why, model }   exact line replacements that passed the gate; the caller applies and tests them
// 400 when the ask, the skill name or the source is missing or malformed; 503 when no model is bound or it did not answer; 502 when
// it answered nothing that passes the gate (a wrong line, a replacement that runs or reaches out).
import { ownerOk } from '../../lib/guard.js';
import { models } from '../../lib/models.js';
import { recordShortfall, reasonOf } from '../../lib/shortfall.js';
import { FIX_SYSTEM, MAX_SOURCE, fixPrompt, parseEdits } from '../../lib/propose-fix.js';

const pick = (r) => (r && (r.response || (r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content) || r.result && r.result.response)) || '';
const SCHEMA = { name: 'edits', schema: { type: 'object', properties: { why: { type: 'string' }, edits: { type: 'array', items: { type: 'object', properties: { find: { type: 'string' }, replace: { type: 'string' } }, required: ['find', 'replace'] } } }, required: ['why', 'edits'] } };

export async function onRequestPost({ request, env }) {
  if (!(await ownerOk(request, env))) return new Response('no', { status: 401 });
  let b = {}; try { b = JSON.parse(await request.text()); } catch (_) {}
  const ask = String(b.ask || '').replace(/\s+/g, ' ').trim().slice(0, 160), skill = String(b.skill || '').trim(), source = String(b.source || '');
  if (ask.length < 3 || !/^[a-z][a-z0-9-]{1,40}$/.test(skill) || source.length < 40 || source.length > MAX_SOURCE + 2000) return new Response('ask, skill and source are needed', { status: 400 });
  if (!env.AI) return new Response('no model bound', { status: 503 });
  let said = '';
  try {
    const base = { messages: [{ role: 'system', content: FIX_SYSTEM }, { role: 'user', content: fixPrompt(ask, skill, source) }], max_tokens: 1400, chat_template_kwargs: { enable_thinking: false }, reasoning_effort: 'low' };
    let r;
    try { r = await env.AI.run(models('review'), { ...base, response_format: { type: 'json_schema', json_schema: SCHEMA } }); }
    catch (_) { r = await env.AI.run(models('review'), base); } // a model without JSON mode: the same ask, the shape held by the prompt alone
    said = pick(r); if (said && typeof said !== 'string') said = JSON.stringify(said);
  } catch (e) { await recordShortfall(env, 'propose-fix', reasonOf(e)); return new Response('V01D could not propose a fix just now', { status: 503 }); }
  const { edits, why } = parseEdits(said, source);
  if (!edits.length) return new Response('V01D proposed nothing that passes the gate', { status: 502 });
  return Response.json({ edits, why, model: models('review') });
}
