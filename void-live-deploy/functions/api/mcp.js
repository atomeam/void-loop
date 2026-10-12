// Void as an MCP server (frontier #6): POST one JSON-RPC message, get its reply as JSON (the streamable HTTP transport without a
// stream). Read-only tools (lib/mcp.js), and the guard's own limit for the route covers it (lib/guard.js LIMITS.mcp). Public: an MCP
// client needs no key. review_code_closer is /api/review's own handler, given the caller's Authorization: the closer read (a model)
// comes only with the key that endpoint takes, on its terms (who, the daily cap, the count). The tools are listed at /tools.json.
//   POST { jsonrpc: '2.0', id, method: 'initialize' | 'tools/list' | 'tools/call' | 'ping', params }  -> 200 { jsonrpc, id, result | error }
//   POST a notification (no id)                                                                    -> 202, no body
//   GET                                                                                            -> 405 (no event stream; POST only)
import { rpc } from '../../lib/mcp.js';
import { onRequestPost as review } from './review.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

export async function onRequestPost({ request, env }) {
  let msg;
  try { msg = JSON.parse(await request.text()); } catch (_) { return json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error: send one JSON-RPC message as JSON' } }); }
  const auth = request.headers.get('authorization');
  const ctx = { review: async (args) => { // the same request /api/review gets from the page or the GitHub Action
    const res = await review({ request: new Request(new URL('/api/review', request.url), { method: 'POST', headers: { 'content-type': 'application/json', ...(auth ? { authorization: auth } : {}) }, body: JSON.stringify(args) }), env: env || {} });
    return { status: res.status, body: await res.json().catch(() => null) };
  } };
  const reply = await rpc(msg, ctx);
  return reply ? json(reply) : new Response(null, { status: 202 });
}

export function onRequestGet() {
  return new Response('Void speaks MCP here: POST JSON-RPC (initialize, tools/list, tools/call). The tools: https://a-to-mind.com/tools.json\n', { status: 405, headers: { allow: 'POST', 'content-type': 'text/plain; charset=utf-8' } });
}
