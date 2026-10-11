// Void as an MCP server (frontier #6): POST one JSON-RPC message, get its reply as JSON (the streamable HTTP transport without a
// stream). Read-only tools (lib/mcp.js): nothing here writes, calls a model or reaches another service, and the guard's own limit
// for the route covers it (lib/guard.js LIMITS.mcp). Public: an MCP client needs no key. The tools are listed at /tools.json (its mcp field).
//   POST { jsonrpc: '2.0', id, method: 'initialize' | 'tools/list' | 'tools/call' | 'ping', params }  -> 200 { jsonrpc, id, result | error }
//   POST a notification (no id)                                                                    -> 202, no body
//   GET                                                                                            -> 405 (no event stream; POST only)
import { rpc } from '../../lib/mcp.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

export async function onRequestPost({ request }) {
  let msg;
  try { msg = JSON.parse(await request.text()); } catch (_) { return json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error: send one JSON-RPC message as JSON' } }); }
  const reply = await rpc(msg);
  return reply ? json(reply) : new Response(null, { status: 202 });
}

export function onRequestGet() {
  return new Response('Void speaks MCP here: POST JSON-RPC (initialize, tools/list, tools/call). The tools: https://a-to-mind.com/tools.json\n', { status: 405, headers: { allow: 'POST', 'content-type': 'text/plain; charset=utf-8' } });
}
