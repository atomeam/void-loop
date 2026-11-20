// The age check on one card picture (owner, 2026-11-20): an adult card's photo shows (blurred until an 18+ tap) only when Workers AI says every
// person in it is clearly an adult. Anything else, an error, no model or a picture off Wikimedia's own hosts, is a no: the page drops the photo.
// The picture is read once here for the model and never stored; only the one-word verdict is kept (edge cache, 30 days, by URL).
// GET ?me=1 says whether the caller is the owner (server-verified session or key): the owner skips the 18+ tap, never the minors block.
import { SAFE_HOST, classify, fileNameOf, ageVerdict, AGE_PROMPT } from '../../lib/image-safety.js';
import { ownerGate } from '../../lib/owner-gate.js';
import { models, VISION_FALLBACK } from '../../lib/models.js';
import { rateLimited } from './answer.js';

const json = (o, status = 200) => Response.json(o, { status, headers: { 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } });
const MAX = 2_000_000;

export async function onRequestGet({ request, env }) {
  const me = new URL(request.url).searchParams.get('me');
  if (!me) return json({ error: 'post a picture' }, 400);
  return json({ owner: !!(await ownerGate(request, env).catch(() => false)) });
}

/** the model's one word on a picture's bytes, or '' when it cannot say. */
export async function askModel(env, bytes, ct) {
  if (!env || !env.AI) return '';
  const pick = (r) => String((r && (r.response || r.description || (r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content))) || '').trim();
  try {
    const b64 = btoa(Array.from(bytes, (c) => String.fromCharCode(c)).join(''));
    const r = await env.AI.run(models('vision'), { messages: [{ role: 'user', content: [{ type: 'text', text: AGE_PROMPT }, { type: 'image_url', image_url: { url: 'data:' + ct + ';base64,' + b64 } }] }], max_tokens: 8, chat_template_kwargs: { enable_thinking: false } });
    const w = pick(r); if (w) return w;
  } catch (_) {}
  try { return pick(await env.AI.run(VISION_FALLBACK, { image: [...bytes], prompt: AGE_PROMPT, max_tokens: 8 })); } catch (_) { return ''; }
}

export async function check(env, url, context = '', get = fetch, cache = null) {
  if (!SAFE_HOST.test(url)) return { ok: false, why: 'host' };
  if (classify(fileNameOf(url), context) === 'minor') return { ok: false, why: 'minor' };
  const key = new Request('https://image-safety.invalid/' + encodeURIComponent(url));
  if (cache) { try { const hit = await cache.match(key); if (hit) return await hit.json(); } catch (_) {} }
  let said = '';
  try {
    const r = await get(url, { headers: { 'user-agent': 'Verse/1 (https://a-to-mind.com; image safety check)' } });
    const ct = (r.headers.get('content-type') || '').split(';')[0];
    if (r.ok && /^image\/(?:jpeg|png|webp|gif)$/.test(ct)) { const b = new Uint8Array(await r.arrayBuffer()); if (b.length && b.length <= MAX) said = await askModel(env, b, ct); }
  } catch (_) {}
  const out = { ok: ageVerdict(said), why: said ? 'model' : 'no verdict' };
  if (cache && said) { try { await cache.put(key, new Response(JSON.stringify(out), { headers: { 'content-type': 'application/json', 'cache-control': 'max-age=2592000' } })); } catch (_) {} }
  return out;
}

export async function onRequestPost({ request, env }) {
  let body = {}; try { body = JSON.parse((await request.text()).slice(0, 4000)); } catch (_) { return json({ ok: false }, 400); }
  const url = String(body.url || '').slice(0, 600), context = String(body.context || '').slice(0, 800);
  if (await rateLimited(request, env, 'image-safety', 40)) return json({ ok: false, why: 'slow' }, 429);
  const c = typeof caches !== 'undefined' ? caches.default : null;
  return json(await check(env, url, context, fetch, c));
}
