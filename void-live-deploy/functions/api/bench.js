// POST /api/bench, owner only (Bearer READ_TOKEN or an owner session): the model bake-off run inside the site, through its own
// Workers AI binding, so CI needs no Workers AI token (tools/model-bench.mjs --site, .github/workflows/model-bench.yml).
//   { model, from, to, file? }  -> { model, total, results: [{ i, text, ms } | { i, error, ms }] }
//                                  the built-in asks from..to-1 (lib/bench-asks.js), at most CHUNK a call, with the messages
//                                  /api/answer sends (Void's live facts for self asks, pages masked); scoring stays in the tool
//   { probe: true }             -> { ok, asks, chunk, catalog }  the route is there and the key works; the text models the
//                                  binding lists, with prices when it gives them (for the tool's spend plan)
// What a stranger could make it do: nothing (owner only). With the key: run at most CHUNK built-in asks a call, on a free
// @cf text model only (never PAID_MODEL), under the guard's per-minute limit. It writes nothing and stores no answer.
import { ownerOk } from '../../lib/guard.js';
import { buildAsks, messagesFor } from '../../lib/bench-asks.js';
import { readSelf, selfFacts } from '../../lib/self-context.js';
import { PAID_MODEL } from '../../lib/models.js';
import { FINDINGS_SCHEMA } from '../../lib/review-api.js';

export const CHUNK = 8;
const FILES = ['builtin'];
const MODEL_ID = /^@cf\/[a-z0-9][\w.-]{0,60}\/[a-z0-9][\w.-]{0,80}$/i;
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const pick = (r) => String((r && (r.response ?? r.choices?.[0]?.message?.content ?? r.result?.response)) || '');

async function catalog(env) {
  try {
    const list = typeof env.AI.models === 'function' ? await env.AI.models({ task: 'Text Generation' }) : [];
    const prop = (m, k) => (m.properties || []).find((p) => p.property_id === k);
    return (list || []).map((m) => ({ id: m.name, created: m.created_at || '', price: (prop(m, 'price') || {}).value || null }));
  } catch (_) { return []; }
}

export async function onRequestPost({ request, env }) {
  if (!(await ownerOk(request, env))) return json(401, { error: 'owner only' });
  let b = {}; try { b = await request.json(); } catch (_) {}
  if (!env.AI) return json(503, { error: 'no Workers AI binding on this deployment' });
  const sf = await readSelf(env, new URL(request.url).origin);
  const asks = buildAsks({ self: sf.self, skills: sf.skills }), facts = selfFacts(sf);
  if (b.probe) return json(200, { ok: true, asks: asks.length, chunk: CHUNK, catalog: await catalog(env) });
  const model = String(b.model || ''), from = Number(b.from), to = Number(b.to), file = b.file == null ? 'builtin' : b.file;
  if (!MODEL_ID.test(model) || model === PAID_MODEL) return json(400, { error: 'a free @cf text model id' });
  if (!FILES.includes(file)) return json(400, { error: 'unknown ask file' });
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to <= from || to - from > CHUNK) return json(400, { error: `from..to, at most ${CHUNK} asks` });
  const results = await Promise.all(asks.slice(from, Math.min(to, asks.length)).map(async (a, k) => {
    const t0 = Date.now();
    try { // a review ask: the closer read's JSON mode (a model without it gets the same ask held by the prompt alone), as lib/review-api.js does
      const base = { messages: messagesFor(a, facts), max_tokens: 1200 };
      let r; if (a.diff) { try { r = await env.AI.run(model, { ...base, response_format: { type: 'json_schema', json_schema: FINDINGS_SCHEMA } }); } catch (_) { r = await env.AI.run(model, base); } } else r = await env.AI.run(model, base);
      return { i: from + k, text: pick(r), ms: Date.now() - t0 }; }
    catch (e) { return { i: from + k, error: String((e && e.message) || e).slice(0, 200), ms: Date.now() - t0 }; }
  }));
  return json(200, { model, total: asks.length, results });
}
