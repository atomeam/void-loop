// Void's answer engine: any ask no skill covers gets a short sourced answer.
// Sources are fetched here (Wikipedia search + summaries); the model only writes from them.
// Cached in D1 (void_answers) so each new question is written once; per-connection rate limit in the edge cache.
import { FIX_SYSTEM, ruleFix, redact, platformOf } from '../../lib/automation-fix.js';
const MODEL = '@cf/google/gemma-4-26b-a4b-it';
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
    if (j && j.extract) out.push({ title: j.title, url: (j.content_urls && j.content_urls.desktop && j.content_urls.desktop.page) || 'https://en.wikipedia.org/wiki/' + encodeURIComponent(h.title), text: j.extract.slice(0, 1200), edited: j.timestamp || null });
  }
  return out;
}
const pick = (r) => (r && (r.response || (r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content) || r.result && r.result.response)) || '';

// Fix mode: { mode: 'fix', ask, details } -> { answer, sources: [], fix: 'model' | 'rules' | null }.
// Works on the broken automation as it is. Secrets are masked first; nothing is cached or stored (pasted configs stay private).
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
  if (env.AI) {
    try {
      const r = await env.AI.run(MODEL, {
        messages: [
          { role: 'system', content: FIX_SYSTEM },
          { role: 'user', content: 'What they said: ' + ask + (platform ? '\nPlatform (guessed): ' + platform : '') + (details ? '\n\nWhat they pasted (as is):\n' + details : '\n\n(nothing pasted yet)') },
        ],
        max_tokens: 1600, chat_template_kwargs: { enable_thinking: false }, reasoning_effort: 'low',
      });
      const answer = String(pick(r)).trim();
      if (answer) return Response.json({ answer, sources: [], fix: 'model', platform });
    } catch (_) {}
  }
  const rules = ruleFix(all);
  return Response.json({ answer: rules, sources: [], fix: rules ? 'rules' : null, platform, note: rules ? 'model busy, fixed from the error' : 'model busy' });
}

export async function onRequestPost({ request, env }) {
  let body = {};
  try { body = JSON.parse((await request.text()).slice(0, 20000)); } catch (_) { return new Response('bad', { status: 400 }); }
  if (body && body.mode === 'fix') return fixAnswer(request, env, body);
  const ask = norm(body.ask);
  if (ask.length < 3) return new Response('empty', { status: 400 });
  const key = await sha(ask.toLowerCase());
  // cached answer?
  try {
    const hit = await env.DB.prepare('SELECT answer, sources, at FROM void_answers WHERE id = ? AND at > ?').bind(key, new Date(Date.now() - TTL_DAYS * 864e5).toISOString()).first();
    if (hit) return Response.json({ answer: hit.answer, sources: JSON.parse(hit.sources), at: hit.at, cached: true });
  } catch (_) {}
  // rate limit per connection (edge cache, no writes)
  const conn = await sha((request.headers.get('cf-connecting-ip') || '') + (env.SALT || ''));
  const cache = caches.default, rlReq = new Request(new URL(request.url).origin + '/__void-answer/rl/' + conn);
  const n = parseInt((await (await cache.match(rlReq))?.text()) || '0', 10);
  if (n >= RL_MAX) return Response.json({ answer: null, sources: [], note: 'slow down' }, { status: 429 });
  await cache.put(rlReq, new Response(String(n + 1), { headers: { 'cache-control': 'max-age=60' } }));

  const src = await sources(ask);
  if (!env.AI) return Response.json({ answer: null, sources: src, note: 'no model' });
  const ctx = src.map((s, i) => `[${i + 1}] ${s.title}: ${s.text}`).join('\n\n') || '(no sources found)';
  let answer = '', raw = null;
  try {
    const r = await env.AI.run(MODEL, {
      messages: [
        { role: 'system', content: 'You are Void. Answer the question in 2 to 6 plain sentences, using only the numbered sources. Cite sources inline like [1]. If the sources do not answer it, say briefly what you could not find. No preamble, no markdown headings.' },
        { role: 'user', content: `Question: ${ask}\n\nSources:\n${ctx}` },
      ],
      max_tokens: 1200, chat_template_kwargs: { enable_thinking: false }, reasoning_effort: 'low',
    });
    raw = r; answer = String(pick(r)).trim();
  } catch (e) {
    return Response.json({ answer: null, sources: src, note: 'model busy' });
  }
  if (!answer) return Response.json({ answer: null, sources: src, note: 'no answer' });
  const at = new Date().toISOString();
  try {
    await env.DB.prepare('INSERT INTO void_answers (id, ask, answer, sources, at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET answer = excluded.answer, sources = excluded.sources, at = excluded.at')
      .bind(key, ask, answer, JSON.stringify(src.map(({ title, url, edited }) => ({ title, url, edited }))), at).run();
  } catch (_) {}
  return Response.json({ answer, sources: src.map(({ title, url, edited }) => ({ title, url, edited })), at });
}
