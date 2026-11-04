// Verse as an A2A agent (lib/a2a.js): POST one JSON-RPC message, get one message back. The card is /.well-known/agent-card.json.
// The answer is /api/answer's, handed the caller's connection so its per-caller limit holds; no credential is passed on.
import { rpc, agentCard } from '../../lib/a2a.js';
import { onRequestPost as answer } from './answer.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'access-control-allow-origin': '*' } });

export async function onRequestPost({ request, env, waitUntil }) {
  let msg;
  try { msg = JSON.parse(await request.text()); } catch (_) { return json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }); }
  const ip = request.headers.get('cf-connecting-ip');
  const ctx = { answer: async (args) => {
    const res = await answer({ request: new Request(new URL('/api/answer', request.url), { method: 'POST', headers: { 'content-type': 'application/json', ...(ip ? { 'cf-connecting-ip': ip } : {}) }, body: JSON.stringify({ ask: args.ask }) }), env: env || {}, waitUntil: (p) => (waitUntil ? waitUntil(p) : p) });
    return { status: res.status, body: await res.json().catch(() => null) };
  } };
  return json(await rpc(msg, ctx));
}

export function onRequestGet() { return json(agentCard()); }
