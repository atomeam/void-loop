// V01D writes its own probe asks (frontier #28, step 2; lib/probe-asks.js). Owner only; nothing is stored.
// POST { family?: '<id or name>', examples?: [{ask, want}], wants?: ['skill:…'] }
//   -> { family: { id, name }, asks: [{ ask, want }], model }   bench-shaped asks V01D wrote for that family
// The family comes from /skills/families.json (the least proven one when none is named); the examples and wants are
// builder-written benchmark data the caller (tools/probe-asks.mjs) reads from tools/bench.json, since the page does not carry
// it. 400 for an unknown family, 503 when no model is bound or it did not answer, 502 when it answered nothing usable.
import { ownerOk } from '../../lib/guard.js';
import { models } from '../../lib/models.js';
import { recordShortfall, reasonOf } from '../../lib/shortfall.js';
import { PROBE_SYSTEM, MAX_EXAMPLES, pickFamily, allowedWants, askPrompt, parseAsks } from '../../lib/probe-asks.js';

const pick = (r) => (r && (r.response || (r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content) || r.result && r.result.response)) || '';
const clean = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);

export async function onRequestPost({ request, env }) {
  if (!(await ownerOk(request, env))) return new Response('no', { status: 401 });
  let b = {}; try { b = JSON.parse(await request.text()); } catch (_) {}
  if (!env.AI) return new Response('no model bound', { status: 503 });
  let fam = null;
  try { const r = await env.ASSETS.fetch(new Request(new URL('/skills/families.json', request.url))); fam = r.ok ? await r.json() : null; } catch (_) { fam = null; }
  const family = pickFamily(fam, clean(b.family, 40));
  if (!family) return new Response(b.family ? 'no family called ' + clean(b.family, 40) : 'families.json not readable', { status: 400 });
  // the caller's examples and wants are kept only as plain strings, and only wants this family really answers with
  const examples = (Array.isArray(b.examples) ? b.examples : []).slice(0, MAX_EXAMPLES).map((e) => ({ ask: clean(e && e.ask, 100), want: clean(e && e.want, 60) })).filter((e) => e.ask && e.want);
  const own = new Set(allowedWants(family));
  const wants = [...new Set([...own, ...(Array.isArray(b.wants) ? b.wants : []).map((w) => clean(w, 60)).filter((w) => w && w.split('|').some((p) => own.has(p) || own.has('skill:' + p)))])].sort();
  let said = '';
  try {
    const r = await env.AI.run(models('will'), {
      messages: [{ role: 'system', content: PROBE_SYSTEM }, { role: 'user', content: askPrompt(family, examples, wants) }],
      max_tokens: 1200, chat_template_kwargs: { enable_thinking: false },
    });
    said = pick(r);
  } catch (e) { await recordShortfall(env, 'probe-asks', reasonOf(e)); return new Response('Verse could not write asks just now', { status: 503 }); }
  const asks = parseAsks(said, wants, examples);
  if (!asks.length) return new Response('Verse wrote nothing usable', { status: 502 });
  return Response.json({ family: { id: family.id, name: family.name }, asks, model: models('will') });
}
