// Void's answer engine: any ask no skill covers is answered from the open web.
// Wikipedia search + summaries. No Workers AI, no D1 writes.
// Cloudflare's free quota is not required for an answer.
import { ruleFix, redact, platformOf } from '../../lib/automation-fix.js';
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

export async function onRequestPost({ request, env }) {
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

  const src = await sources(ask);
  const answer = fromWeb(src);
  if (!answer) return Response.json({ answer: null, sources: [], note: 'nothing on the web' });
  return Response.json({ answer, sources: src.map(({ title, url, edited }) => ({ title, url, edited })), at: new Date().toISOString() });
}
