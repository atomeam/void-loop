// Void's answer engine: any ask no skill covers gets answered directly, from the model's own knowledge, citing a
// Wikipedia source when one genuinely matches; it never refuses just because nothing matched (there's no Wikipedia
// page for "write me a script"). Without a model (VOID_ANSWER_MODELS=off or Workers AI unbound) it falls back to
// the plain Wikipedia extract, since there's no model left to generate anything beyond that.
// Gemma 4 26B on Workers AI is the one free model (answers and fixes). A tiny router (lib/router.js) runs while the sources
// load: skill / simple / hard. A hard ask may pay for a stronger model only from what Void earned, under a standing spend said
// yes to on the confirm line; otherwise Gemma answers and the stronger model is recorded, not called ('would escalate' in
// void_shortfalls, lib/shortfall.js: the one evidence ledger). A slow or failed router = the plain Gemma answer. When Gemma
// itself fails (allowance out, busy, empty) the same paid rule applies, and without it the answer is the open web (the
// Wikipedia extracts, no model, no D1 write) and a fix is the rules (ruleFix). VOID_ANSWER_MODELS=off (Pages env var) turns
// the models off. With models on, D1 is written: the answer cache, the route log (void_routes), the shortfall counts.
// An ask about Void itself ("what's next?", "what are you building?") skips Wikipedia and the cache: it is answered from
// Void's own facts, its skills, growth inbox and will (lib/self-context.js), so the answer is about this project, not generic.
import { FIX_SYSTEM, INJECTION_RULE, ruleFix, redact, platformOf } from '../../lib/automation-fix.js';
import { DEFAULT_MODEL, PAID_MODEL, BUDGET_MS, STRONG_TIMEOUT_MS, classify, settle, paidAccess, costCents, recordSpend, logRoute } from '../../lib/router.js';
import { recordShortfall, reasonOf } from '../../lib/shortfall.js';
import { isSelfAsk, readSelf, selfFacts, SELF_RULE } from '../../lib/self-context.js';
const MODEL = DEFAULT_MODEL;
// models are on whenever Workers AI is bound; VOID_ANSWER_MODELS=off (Pages env var) = open-web answers and rules-only fixes
const modelsOn = (env) => !!(env && env.AI) && String(env.VOID_ANSWER_MODELS || '').trim().toLowerCase() !== 'off';
const pick = (r) => (r && (r.response || (r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content) || r.result && r.result.response)) || '';
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
  const on = modelsOn(env);
  if (on) {
    try {
      const r = await env.AI.run(MODEL, {
        messages: [
          { role: 'system', content: FIX_SYSTEM },
          { role: 'user', content: 'What they said: ' + ask + (platform ? '\nPlatform (guessed): ' + platform : '') + (details ? '\n\nWhat they pasted (as is):\n' + details : '\n\n(nothing pasted yet)') },
        ],
        max_tokens: 1600, chat_template_kwargs: { enable_thinking: false }, reasoning_effort: 'low',
      });
      const answer = redact(String(pick(r)).trim()); // never echo a secret, even one the model made up
      if (answer) return Response.json({ answer, sources: [], fix: 'model', platform });
      await recordShortfall(env, 'fix', 'empty');
    } catch (e) { await recordShortfall(env, 'fix', reasonOf(e)); }
  }
  // the fallback: fixed from the error itself (rules only)
  const rules = ruleFix(all);
  const note = on ? (rules ? 'model busy, fixed from the error' : 'model busy') : (rules ? null : 'no rule for that');
  return Response.json({ answer: rules, sources: [], fix: rules ? 'rules' : null, platform, note });
}


export async function onRequestPost({ request, env, waitUntil }) {
  const t0 = Date.now();
  let body = {};
  try { body = JSON.parse((await request.text()).slice(0, 20000)); } catch (_) { return new Response('bad', { status: 400 }); }
  if (body && body.mode === 'fix') return fixAnswer(request, env, body);
  const typed = norm(body.ask), ask = redact(typed), masked = ask !== typed;
  if (ask.length < 3) return new Response('empty', { status: 400 });
  const key = await sha(ask.toLowerCase());
  // an ask about Void itself is answered from its own facts, which change with every ship: never from the 7-day cache
  const self = isSelfAsk(ask);
  try {
    const hit = masked || self ? null : await env.DB.prepare('SELECT answer, sources, at FROM void_answers WHERE id = ? AND at > ?').bind(key, new Date(Date.now() - TTL_DAYS * 864e5).toISOString()).first();
    if (hit) return Response.json({ answer: hit.answer, sources: JSON.parse(hit.sources), at: hit.at, cached: true });
  } catch (_) {}
  if (await rateLimited(request, env)) return Response.json({ answer: null, sources: [], note: 'slow down' }, { status: 429 });

  if (modelsOn(env)) return modelAnswer(request, env, waitUntil, t0, ask, masked, key, self);
  if (self) {
    // no model: the facts themselves are the answer (Wikipedia knows nothing about Void)
    const facts = selfFacts(await readSelf(env, new URL(request.url).origin));
    if (facts) return Response.json({ answer: facts, sources: [], at: new Date().toISOString(), self: true });
  }
  const src = await sources(ask);
  const answer = fromWeb(src);
  if (!answer) return Response.json({ answer: null, sources: [], note: 'nothing on the web' });
  return Response.json({ answer, sources: src.map(({ title, url, edited }) => ({ title, url, edited })), at: new Date().toISOString() });
}

// Sources are help, not a cage: cite one when it actually answers the question, but never refuse just because
// none matched (they're only Wikipedia searches; a script, a plan, a proof, a poem has no Wikipedia page at all).
const ANSWER_SYSTEM = 'You are Void. Answer the question directly and completely, from what you know. Use a numbered source only when it genuinely answers part of the question, citing it inline like [1]; when the sources do not cover it, answer anyway from your own knowledge and reasoning. Never refuse or say you lack sources: that is only true if you genuinely cannot help at all. For code, write the whole thing in a fenced code block with the language named, then a short explanation after. Keep plain answers to 2 to 6 sentences unless the question needs more (a full script, a step-by-step, a worked example). No preamble, no markdown headings. ' + INJECTION_RULE;
const noThink = (t) => String(t || '').replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/^[\s\S]*<\/think>/i, '').trim();
function within(p, ms) { let t; return Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej(new Error('timeout')), ms); })]).finally(() => clearTimeout(t)); }

// The model path (on unless VOID_ANSWER_MODELS=off).
async function modelAnswer(request, env, waitUntil, t0, ask, masked, key, self) {
  const later = (p) => { try { if (waitUntil) waitUntil(p); } catch (_) {} return p; };
  const origin = new URL(request.url).origin;
  // the router runs alongside the source fetch; the answer waits for it until BUDGET_MS from the start, then moves on without it
  const routeP = classify(env, ask, { origin, waitUntil });
  // an ask about Void itself reads Void's own facts instead of Wikipedia (lib/self-context.js)
  let selfP = self ? readSelf(env, origin) : null;
  let src = self ? [] : await sources(ask);
  const srcAt = Date.now();
  const route = await settle(routeP, t0 + BUDGET_MS);
  const waited = Date.now() - srcAt;
  // the router's 'self' examples catch self asks the regex missed
  if (!self && route.kind === 'skill' && route.skill === 'self') { self = true; selfP = readSelf(env, origin); src = []; }
  const facts = self ? selfFacts(await selfP) : '';
  const pub = src.map(({ title, url, edited }) => ({ title, url, edited }));
  const ctx = src.map((s, i) => `[${i + 1}] ${s.title}: ${s.text}`).join('\n\n') || '(no sources found)';
  const messages = self ? [
    { role: 'system', content: ANSWER_SYSTEM + ' ' + SELF_RULE },
    { role: 'user', content: `Question: ${ask}\n\nFacts about Void:\n${facts || '(my facts could not be read just now)'}` },
  ] : [
    { role: 'system', content: ANSWER_SYSTEM },
    { role: 'user', content: `Question: ${ask}\n\nSources:\n${ctx}` },
  ];
  let answer = '', model = MODEL, outcome = route.kind === 'fallback' ? route.why : 'default', would = null;
  if (route.kind === 'skill') outcome = 'skill missed: ' + route.skill;
  if (self) outcome += '; self-grounded';
  // one paid call: only with earned budget > 0 AND an approved standing spend with room left (lib/router.js paidAccess)
  const tryPaid = async (access, why) => {
    try {
      const r = await within(env.AI.run(access.model, { messages, max_tokens: 3000 }), STRONG_TIMEOUT_MS);
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
      // no second free model (Atom): Gemma answers, and the stronger model is recorded, not called
      would = PAID_MODEL;
      outcome = 'would escalate; paid: ' + (access.model ? 'paid model failed' : access.why);
      later(recordShortfall(env, 'answer', 'would escalate'));
    }
  }
  const log = (extra) => later(logRoute(env, { ask, masked, route: route.kind, skill: route.skill, score: route.score, scores: route.scores, ms: route.ms, waited, model, outcome, would, ...extra }));
  if (!answer) {
    try {
      const r = await env.AI.run(MODEL, { messages, max_tokens: 2200, chat_template_kwargs: { enable_thinking: false }, reasoning_effort: 'low' });
      answer = redact(String(pick(r)).trim());
      model = MODEL;
      if (!answer) throw new Error('empty');
    } catch (e) {
      // the free allowance ran out (or Gemma is down): the free ceiling isn't a stop, but paying still needs both conditions
      later(recordShortfall(env, 'answer', String(e && e.message) === 'empty' ? 'empty' : reasonOf(e)));
      const access = await paidAccess(env);
      const paid = access.model ? await tryPaid(access, 'free allowance out') : '';
      if (!paid) {
        // no paid path: the open-web answer, as with the switch off (for an ask about Void: its facts)
        const web = self ? facts : fromWeb(src);
        log({ model: null, outcome: outcome + '; model busy, open web' + (access.model ? '' : '; paid: ' + access.why), would: PAID_MODEL });
        if (!web) return Response.json({ answer: null, sources: [], note: 'nothing on the web', route: route.kind });
        return Response.json({ answer: web, sources: pub, at: new Date().toISOString(), route: route.kind, note: self ? 'model busy, my own facts' : 'model busy, from the web', ...(self ? { self: true } : {}) });
      }
      answer = paid; model = access.model; outcome += '; default busy, paid from earnings';
    }
  }
  log({ model });
  const at = new Date().toISOString();
  if (!masked && !self) try {
    await env.DB.prepare('INSERT INTO void_answers (id, ask, answer, sources, at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET answer = excluded.answer, sources = excluded.sources, at = excluded.at')
      .bind(key, ask, answer, JSON.stringify(pub), at).run();
  } catch (_) {}
  return Response.json({ answer, sources: pub, at, route: route.kind, ...(self ? { self: true } : {}) });
}
