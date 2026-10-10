// The model bake-off's transport, inside the site (operator, 2026-10-10): this container holds no Cloudflare
// credentials, but the Pages project already holds the Workers AI binding the answer engine uses — so the bench's
// calls run here, owner-gated, and CI orchestrates them through READ_TOKEN (model-bench-site.yml drives
// tools/model-bench.mjs --via this route). Same contract as tools/model-bench-worker: POST {model, messages,
// max_tokens} -> {ok, result} | {ok: false, error}. Nothing is stored; every call spends Workers AI neurons, which is
// why the gate is the owner's and the rate limit is the room's ceiling, not a budget — the bench plans its own cap.
import { ownerOk } from '../../lib/guard.js';

const MODEL_RE = /^@[\w.-]+\/[\w.-]+\/[\w.-]{1,80}$/;
export async function onRequestPost({ request, env }) {
  if (!(await ownerOk(request, env))) return new Response('no', { status: 401 });
  if (!env.AI) return Response.json({ ok: false, error: 'Workers AI is not bound' }, { status: 503 });
  let b; try { b = await request.json(); } catch (_) { return Response.json({ ok: false, error: 'not JSON' }, { status: 400 }); }
  const model = String(b.model || '');
  if (!MODEL_RE.test(model)) return Response.json({ ok: false, error: 'model: a Workers AI id like @cf/vendor/name' }, { status: 400 });
  const messages = Array.isArray(b.messages) ? b.messages.slice(0, 20).map((m) => ({ role: String((m && m.role) || 'user').slice(0, 12), content: String((m && m.content) || '').slice(0, 16000) })) : null;
  if (!messages || !messages.length) return Response.json({ ok: false, error: 'messages: [{role, content}, …]' }, { status: 400 });
  const max_tokens = Math.max(1, Math.min(parseInt(b.max_tokens, 10) || 800, 1200));
  try { return Response.json({ ok: true, result: await env.AI.run(model, { messages, max_tokens }) }); }
  catch (e) { return Response.json({ ok: false, error: String((e && e.message) || e).slice(0, 300) }); }
}
