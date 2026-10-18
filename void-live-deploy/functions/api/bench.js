// POST /api/bench, owner only (Bearer READ_TOKEN or an owner session): the model bake-off run inside the site, through its own
// Workers AI binding, so CI needs no Workers AI token (tools/model-bench.mjs --site, .github/workflows/model-bench.yml).
//   { model, from, to, file? }  -> { model, total, results: [{ i, text, ms } | { i, error, ms }] }
//                                  the built-in asks from..to-1 (lib/bench-asks.js), at most CHUNK a call, with the messages
//                                  /api/answer sends, run with its options (ANSWER_RUN: thinking off, its token budget) and its
//                                  think-stripping (Verse's live facts for self asks, pages masked); scoring stays in the tool
//   { probe: true }             -> { ok, asks, chunk, catalog, clef }  the route is there and the key works; the text models the
//                                  binding lists, with prices when it gives them (for the tool's spend plan); and what the
//                                  binding knows of Clef and Clef-flash (frontier #9: tools/clef-probe.mjs prints it, so the
//                                  router's Clef call is written to the real input shape, not a guess)
//   { route: true, asks: [..] } -> { route, results: [{ i, embed: { skill|null, score, ms, nearest? }, clef: { skill|null, p, ms } }] }
//                                  nearest (on a none): { skill, score, bar, held }, the skill the embedding came closest to and what held it back (asked by Void)
//                                  frontier #9: both routers on up to ROUTE_CHUNK asks (lib/router.js's embedding guess and
//                                  Clef-flash, lib/clef.js); null = no skill, answer in words; a failure is { error }
// What a stranger could make it do: nothing (owner only). With the key: run at most CHUNK built-in asks a call, on a free
// @cf text model only (never PAID_MODEL), under the guard's per-minute limit; or route at most ROUTE_CHUNK asks of at most 300
// characters (two classifier calls each: one embedding, one Clef-flash). It writes nothing and stores no answer.
import { ownerOk } from '../../lib/guard.js';
import { buildAsks, messagesFor } from '../../lib/bench-asks.js';
import { readSelf, selfFacts } from '../../lib/self-context.js';
import { PAID_MODEL } from '../../lib/models.js';
import { FINDINGS_SCHEMA } from '../../lib/review-api.js';
import { ANSWER_RUN, noThink } from './answer.js';
import { classify } from '../../lib/router.js';
import { skillQuestion, clefRoute } from '../../lib/clef.js';

export const CHUNK = 8;
export const ROUTE_CHUNK = 16;
const FILES = ['builtin'];
const MODEL_ID = /^@cf\/[a-z0-9][\w.-]{0,60}\/[a-z0-9][\w.-]{0,80}$/i;
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const pick = (r) => String((r && (r.response ?? r.choices?.[0]?.message?.content ?? r.result?.response)) || '');

// Clef and Clef-flash as the binding describes them: name, task, description and the raw properties (where Workers AI keeps a
// model's limits and schema), capped. An empty list when the binding has no models() or no Clef, never an error.
const capped = (list, max = 8000) => { const out = []; let n = 2; for (const x of list) { const k = JSON.stringify(x).length + 1; if (n + k > max) break; out.push(x); n += k; } return out; };
async function clefModels(env) {
  try {
    if (typeof env.AI.models !== 'function') return [];
    const list = await env.AI.models({ search: 'clef' });
    return (list || []).filter((m) => /clef/i.test(String(m && m.name))).slice(0, 4).map((m) => ({
      id: m.name, task: (m.task && m.task.name) || '', description: String(m.description || '').slice(0, 600),
      properties: capped(Array.isArray(m.properties) ? m.properties : []),
    }));
  } catch (_) { return []; }
}

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
  if (b.route) {
    const list = Array.isArray(b.asks) ? b.asks : [];
    if (!list.length || list.length > ROUTE_CHUNK || !list.every((a) => typeof a === 'string' && a.trim() && a.length <= 300)) return json(400, { error: `asks: 1 to ${ROUTE_CHUNK} asks of at most 300 characters` });
    const question = skillQuestion(), origin = new URL(request.url).origin;
    const results = await Promise.all(list.map(async (ask, i) => {
      const [e, c] = await Promise.all([classify(env, ask, { origin }), clefRoute(env, ask, { question })]);
      return { i, embed: e.kind === 'fallback' ? { error: e.why, ms: e.ms } : { skill: e.kind === 'skill' ? e.skill : null, score: e.score, ms: e.ms, ...(e.kind !== 'skill' && e.nearest ? { nearest: e.nearest } : {}) },
        clef: c.kind === 'fallback' ? { error: c.why, ms: c.ms } : { skill: c.skill, p: c.p, ms: c.ms } };
    }));
    return json(200, { route: true, results });
  }
  const sf = await readSelf(env, new URL(request.url).origin);
  const asks = buildAsks({ self: sf.self, skills: sf.skills }), facts = selfFacts(sf);
  if (b.probe) return json(200, { ok: true, asks: asks.length, chunk: CHUNK, catalog: await catalog(env), clef: await clefModels(env) });
  const model = String(b.model || ''), from = Number(b.from), to = Number(b.to), file = b.file == null ? 'builtin' : b.file;
  if (!MODEL_ID.test(model) || model === PAID_MODEL) return json(400, { error: 'a free @cf text model id' });
  if (!FILES.includes(file)) return json(400, { error: 'unknown ask file' });
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to <= from || to - from > CHUNK) return json(400, { error: `from..to, at most ${CHUNK} asks` });
  const results = await Promise.all(asks.slice(from, Math.min(to, asks.length)).map(async (a, k) => {
    const t0 = Date.now();
    try { // an answer ask runs as /api/answer runs it; a review ask as the closer read does: JSON mode on the findings schema (a model without it gets the same ask held by the prompt alone), as lib/review-api.js does
      const messages = messagesFor(a, facts);
      let r; if (a.diff) { const base = { messages, max_tokens: 1200 }; try { r = await env.AI.run(model, { ...base, response_format: { type: 'json_schema', json_schema: FINDINGS_SCHEMA } }); } catch (_) { r = await env.AI.run(model, base); } } else r = await env.AI.run(model, { messages, ...ANSWER_RUN });
      return { i: from + k, text: noThink(pick(r)), ms: Date.now() - t0 }; }
    catch (e) { return { i: from + k, error: String((e && e.message) || e).slice(0, 200), ms: Date.now() - t0 }; }
  }));
  return json(200, { model, total: asks.length, results });
}
