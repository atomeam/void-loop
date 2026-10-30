// Verse proposes the fix for an ask its own probe missed (frontier #28, step 3; lib/propose-fix.js). Owner only; nothing is stored.
// POST { ask, skill, source, mode?, said?, tried? }   mode 'narrow': the skill answered an ask that is not its own (a routing correction)   the missed ask, the owning skill's name and its file as it stands (tools/propose-fix.mjs sends it)
//   -> { edits: [{ find, replace }], why, confidence, evidence: [{ file, line, was }], model }   exact line replacements that passed the gate; the caller applies and tests them
// 400 when the ask, the skill name or the source is missing or malformed; 503 when no model is bound or it did not answer; 502 when
// it answered nothing that passes the gate (a wrong line, a replacement that runs or reaches out).
import { ownerOk } from '../../lib/guard.js';
import { models } from '../../lib/models.js';
import { recordShortfall, reasonOf } from '../../lib/shortfall.js';
import { FIX_SYSTEM, NARROW_SYSTEM, MAX_SOURCE, MAX_TRIED, fixPrompt, parseEdits, evidenceOf } from '../../lib/propose-fix.js';

const pick = (r) => (r && (r.response || (r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content) || r.result && r.result.response)) || '';

export async function onRequestPost(ctx) {
  // one catch around everything: a failure anywhere answers JSON with its reason category, never the platform's HTML page
  try { return await propose(ctx); } catch (e) { try { await recordShortfall(ctx.env, 'propose-fix', reasonOf(e)); } catch (_) {} return Response.json({ error: 'Verse could not propose a fix: ' + reasonOf(e) }, { status: 502 }); }
}

async function propose({ request, env }) {
  if (!(await ownerOk(request, env))) return new Response('no', { status: 401 });
  let b = {}; try { b = JSON.parse(await request.text()); } catch (_) {}
  const ask = String(b.ask || '').replace(/\s+/g, ' ').trim().slice(0, 160), skill = String(b.skill || '').trim(), source = String(b.source || '');
  const mode = b.mode === 'narrow' ? 'narrow' : 'learn', note = String(b.said || '').slice(0, 300); // narrow: the skill took an ask that is not its own
  const tried = String(b.tried || '').slice(0, MAX_TRIED); // what the collision check said about the last try (tools/propose-fix.mjs settles)
  if (ask.length < 3 || !/^[a-z][a-z0-9-]{1,40}$/.test(skill) || source.length < 40 || source.length > MAX_SOURCE + 2000) return new Response('ask, skill and source are needed', { status: 400 });
  if (!env.AI) return new Response('no model bound', { status: 503 });
  // one call on the will path (Gemma 4): the review path's two back-to-back calls to the 120B model outlasted the platform's limit
  // and came back as Cloudflare's HTML 502 (2026-10-15 22:02 and 2026-10-16 03:03), never reaching this code
  let said = '';
  try {
    const r = await env.AI.run(models('will'), { messages: [{ role: 'system', content: mode === 'narrow' ? NARROW_SYSTEM : FIX_SYSTEM }, { role: 'user', content: fixPrompt(ask, skill, source, mode, note, tried) }], max_tokens: 900, chat_template_kwargs: { enable_thinking: false } });
    said = pick(r); if (said && typeof said !== 'string') said = JSON.stringify(said);
  } catch (e) { await recordShortfall(env, 'propose-fix', reasonOf(e)); return Response.json({ error: 'Verse could not propose a fix just now: ' + reasonOf(e) }, { status: 503 }); }
  const { edits, why, confidence } = parseEdits(said, source);
  if (!edits.length) return new Response('Verse proposed nothing that passes the gate', { status: 502 });
  return Response.json({ edits, why, confidence, evidence: evidenceOf(source, edits, skill), model: models('will') });
}
