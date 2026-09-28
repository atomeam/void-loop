// Void's answer engine: any ask no skill covers is answered from the open web.
// Wikipedia search + summaries. By default: no Workers AI, no D1 writes (Cloudflare's free quota is not required for an answer).
// VOID_ANSWER_MODELS=on (Pages env var, off unless set) turns on the model path with a tiny router in front (lib/router.js):
// skill / simple / hard while the sources are fetched. Gemma 4 26B answers by default; a hard ask may pay for a stronger model
// only from what Void earned under a standing spend said yes to on the confirm line, else a stronger free model, else it logs
// 'would escalate'. A slow or failed router = the plain Gemma answer; no model at all = the open-web answer below.
// With the switch on, D1 is written: the answer cache, the route log (void_routes) and the escalation counters.
import { INJECTION_RULE, ruleFix, redact, platformOf } from '../../lib/automation-fix.js';
import { DEFAULT_MODEL, PAID_MODEL, BUDGET_MS, STRONG_TIMEOUT_MS, classify, settle, escalation, paidAccess, costCents, recordSpend, logRoute } from '../../lib/router.js';
const MODEL = DEFAULT_MODEL;
const TTL_DAYS = 7, RL_MAX = 12;
const norm = (t) => String(t || '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);
async function sha(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('').slice(0, 32);
}
const UA = { 'user-agent': 'Void/1.0 (https://a-to-mind.com; atom@a-to-mind.com)' };
async function sources(ask) {
  const q = ask.replace(/^(please\s+)?(what|who|where|when|why|how|which|can|could|should|is|are|do|does)\b\s*/i, '').replace(/[?!.]+$/, '') || ask;
  const s = await fetch('https://en.wikipedia.org/w/api.php?action=query&list=search&srlimit=3&format=json&srsearch=' + encodeURIComponent(q), { headers: UA }).then((r) => r.json()).catch(() => null);
  const hits = (s && s.query && s.query.search) || [];
  const out = [];
  for (const h of hits.slice(0, 3)) {
    const j = await fetch('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(h.title.replace(/ /g, '_')), { headers: UA }).then((r) => r.json()).catch(() => null);
    const page = j && j.content_urls && j.content_urls.desktop && j.content_urls.desktop.page;
    if (j && j.extract) out.push({ title: String(j.title || h.title).slice(0, 200), url: /^https:\/\/en\.wikipedia\.org\//.test(page || '') ? page : 'https://en.wikipedia.org/wiki/' + encodeURIComponent(h.title), text: j.extract.slice(0, 1200), edited: j.timestamp || null });
  }
  return out;
}
function fromWeb(src) {
  if (!src.length) return '';
  return src.slice(0, 2).map((s) => s.text.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' ').slice(0, 900);
}

async function rateLimited(request, env) {
  try {
    const conn = await sha((request.headers.get('cf-connecting-ip') || '') + (env.SALT || ''));
    const cache = caches.default, rlReq = new Request(new URL(request.url).origin + '/__void-answer/rl/' + conn);
    const n = parseInt((await (await cache.match(rlReq))?.text()) || '0', 10);
    if (n >= RL_MAX) return true;
    await cache.put(rlReq, new Response(String(n + 1), { headers: { 'cache-control': 'max-age=60' } }));
  } catch (_) {}
  return false;
}
async function fixAnswer(request, env, body) {
  const ask = redact(String(body.ask || '').replace(/[\u0000-\u0008\u000b-\u001f]/g, ' ').trim().slice(0, 600));
  const details = redact(String(body.details || '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ').slice(0, 8000));
  if (ask.length < 3) return new Response('empty', { status: 400 });
  if (await rateLimited(request, env)) return Response.json({ answer: null, sources: [], note: 'slow down' }, { status: 429 });
  const all = ask + (details ? '\n\n' + details : '');
  const platform = platformOf(all);
  const rules = ruleFix(all);
  return Response.json({ answer: rules, sources: [], fix: rules ? 'rules' : null, platform, note: rules ? null : 'no rule for that' });
}

const modelsOn = (env) => String(env.VOID_ANSWER_MODELS || '').toLowerCase() === 'on' && !!env.AI;

export async function onRequestPost({ request, env, waitUntil }) {
  const t0 = Date.now();
  let body = {};
  try { body = JSON.parse((await request.text()).slice(0, 20000)); } catch (_) { return new Response('bad', { status: 400 }); }
  if (body && body.mode === 'fix') return fixAnswer(request, env, body);
  const typed = norm(body.ask), ask = redact(typed), masked = ask !== typed;
  if (ask.length < 3) return new Response('empty', { status: 400 });
  const key = await sha(ask.toLowerCase());
  try {
    const hit = masked ? null : await env.DB.prepare('SELECT answer, sources, at FROM void_answers WHERE id = ? AND at > ?').bind(key, new Date(Date.now() - TTL_DAYS * 864e5).toISOString()).first();
    if (hit) return Response.json({ answer: hit.answer, sources: JSON.parse(hit.sources), at: hit.at, cached: true });
  } catch (_) {}
  if (await rateLimited(request, env)) return Response.json({ answer: null, sources: [], note: 'slow down' }, { status: 429 });

  if (modelsOn(env)) return modelAnswer(request, env, waitUntil, t0, ask, masked, key);
  const src = await sources(ask);
  const answer = fromWeb(src);
  if (!answer) return Response.json({ answer: null, sources: [], note: 'nothing on the web' });
  return Response.json({ answer, sources: src.map(({ title, url, edited }) => ({ title, url, edited })), at: new Date().toISOString() });
}

const ANSWER_SYSTEM = 'You are Void. Answer the question in 2 to 6 plain sentences, using only the numbered sources. Cite sources inline like [1]. If the sources do not answer it, say briefly what you could not find. No preamble, no markdown headings. ' + INJECTION_RULE;
const pick = (r) => (r && (r.response || (r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content) || r.result && r.result.response)) || '';
const noThink = (t) => String(t || '').replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/^[\s\S]*<\/think>/i, '').trim();
function within(p, ms) { let t; return Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej(new Error('timeout')), ms); })]).finally(() => clearTimeout(t)); }

// The model path (VOID_ANSWER_MODELS=on only).
async function modelAnswer(request, env, waitUntil, t0, ask, masked, key) {
  const later = (p) => { try { if (waitUntil) waitUntil(p); } catch (_) {} return p; };
  // the router runs alongside the source fetch; the answer waits for it until BUDGET_MS from the start, then moves on without it
  const routeP = classify(env, ask, { origin: new URL(request.url).origin, waitUntil });
  const src = await sources(ask);
  const srcAt = Date.now();
  const route = await settle(routeP, t0 + BUDGET_MS);
  const waited = Date.now() - srcAt;
  const pub = src.map(({ title, url, edited }) => ({ title, url, edited }));
  const ctx = src.map((s, i) => `[${i + 1}] ${s.title}: ${s.text}`).join('\n\n') || '(no sources found)';
  const messages = [
    { role: 'system', content: ANSWER_SYSTEM },
    { role: 'user', content: `Question: ${ask}\n\nSources:\n${ctx}` },
  ];
  let answer = '', model = MODEL, outcome = route.kind === 'fallback' ? route.why : 'default', would = null;
  if (route.kind === 'skill') outcome = 'skill missed: ' + route.skill;
  // one paid call: only with earned budget > 0 AND an approved standing spend with room left (lib/router.js paidAccess)
  const tryPaid = async (access, why) => {
    try {
      const r = await within(env.AI.run(access.model, { messages, max_tokens: 2000 }), STRONG_TIMEOUT_MS);
      const out = redact(noThink(pick(r)));
      await recordSpend(env, access, costCents(access.model, r, JSON.stringify(messages).length, String(pick(r)).length), { why });
      return out;
    } catch (_) { return ''; }
  };
  if (route.kind === 'hard') {
    const access = await paidAccess(env);
    if (access.model) {
      answer = await tryPaid(access, 'hard');
      if (answer) { model = access.model; outcome = 'escalated, paid from earnings'; }
    }
    if (!answer) {
      const esc = await escalation(env);
      const paidWhy = access.model ? 'paid model failed' : access.why;
      would = PAID_MODEL; // the paid model wasn't used: recorded, not spent (evidence for the will)
      if (esc.model) {
        try {
          const r = await within(env.AI.run(esc.model, { messages, max_tokens: 2000, reasoning_effort: 'low' }), STRONG_TIMEOUT_MS);
          answer = redact(noThink(pick(r)));
          if (answer) { model = esc.model; outcome = 'escalated (free); paid: ' + paidWhy; } else outcome = 'escalation empty, default answered; paid: ' + paidWhy;
        } catch (_) { outcome = 'escalation failed, default answered; paid: ' + paidWhy; }
      } else outcome = 'would escalate: ' + esc.why + '; paid: ' + paidWhy;
    }
  }
  const log = (extra) => later(logRoute(env, { ask, masked, route: route.kind, skill: route.skill, score: route.score, scores: route.scores, ms: route.ms, waited, model, outcome, would, ...extra }));
  if (!answer) {
    try {
      const r = await env.AI.run(MODEL, { messages, max_tokens: 1200, chat_template_kwargs: { enable_thinking: false }, reasoning_effort: 'low' });
      answer = redact(String(pick(r)).trim());
      model = MODEL;
    } catch (e) {
      // the free allowance ran out (or Gemma is down): the free ceiling isn't a stop, but paying still needs both conditions
      const access = await paidAccess(env);
      const paid = access.model ? await tryPaid(access, 'free allowance out') : '';
      if (!paid) {
        // no paid path: the open-web answer, as with the switch off
        const web = fromWeb(src);
        log({ model: null, outcome: outcome + '; model busy, open web' + (access.model ? '' : '; paid: ' + access.why), would: PAID_MODEL });
        if (!web) return Response.json({ answer: null, sources: [], note: 'nothing on the web', route: route.kind });
        return Response.json({ answer: web, sources: pub, at: new Date().toISOString(), route: route.kind, note: 'model busy, from the web' });
      }
      answer = paid; model = access.model; outcome += '; default busy, paid from earnings';
    }
  }
  log({ model });
  if (!answer) return Response.json({ answer: null, sources: src, note: 'no answer' });
  const at = new Date().toISOString();
  if (!masked) try {
    await env.DB.prepare('INSERT INTO void_answers (id, ask, answer, sources, at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET answer = excluded.answer, sources = excluded.sources, at = excluded.at')
      .bind(key, ask, answer, JSON.stringify(pub), at).run();
  } catch (_) {}
  return Response.json({ answer, sources: pub, at, route: route.kind });
}
