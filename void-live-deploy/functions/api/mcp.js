// Verse as an MCP server (frontier #6): POST one JSON-RPC message, get its reply as JSON (the streamable HTTP transport without a
// stream). Read-only tools (lib/mcp.js), and the guard's own limit for the route covers it (lib/guard.js LIMITS.mcp). Public: an MCP
// client needs no key. review_code_closer is /api/review's own handler, given the caller's Authorization: the closer read (a model)
// comes only with the key that endpoint takes, on its terms (who, the daily cap, the count). skill_health reads the static
// skills/families.json through ASSETS. The tools are listed at /tools.json.
//   POST { jsonrpc: '2.0', id, method: 'initialize' | 'tools/list' | 'tools/call' | 'ping', params }  -> 200 { jsonrpc, id, result | error }
//   POST a notification (no id)                                                                    -> 202, no body
//   GET                                                                                            -> 405 (no event stream; POST only)
import { rpc } from '../../lib/mcp.js';
import { recordShortfall } from '../../lib/shortfall.js';
import { onRequestPost as review } from './review.js';
import { onRequestPost as answer } from './answer.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

export async function onRequestPost({ request, env, waitUntil }) {
  let msg;
  try { msg = JSON.parse(await request.text()); } catch (_) { return json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error: send one JSON-RPC message as JSON' } }); }
  const auth = request.headers.get('authorization');
  const ctx = { review: async (args) => { // the same request /api/review gets from the page or the GitHub Action
    const res = await review({ request: new Request(new URL('/api/review', request.url), { method: 'POST', headers: { 'content-type': 'application/json', ...(auth ? { authorization: auth } : {}) }, body: JSON.stringify(args) }), env: env || {} });
    return { status: res.status, body: await res.json().catch(() => null) };
  }, answer: async (args) => { // ask_void: /api/answer as the page asks it, with the caller's connection (its per-caller limit) and no credential
    const ip = request.headers.get('cf-connecting-ip');
    const res = await answer({ request: new Request(new URL('/api/answer', request.url), { method: 'POST', headers: { 'content-type': 'application/json', ...(ip ? { 'cf-connecting-ip': ip } : {}) }, body: JSON.stringify({ ask: args.ask }) }), env: env || {}, waitUntil: (p) => (waitUntil ? waitUntil(p) : p) });
    return { status: res.status, body: await res.json().catch(() => null) };
  }, families: async () => { // skill_health: the ratings as the site serves them (skills/families.json, a static file), read only
    if (!env || !env.ASSETS) return null;
    const res = await env.ASSETS.fetch(new Request(new URL('/skills/families.json', request.url)));
    return res.ok ? res.json() : null;
  } };
  const reply = await rpc(msg, ctx);
  // a failed tool call is counted where Verse reads its shortfalls (asked by Verse, ask-20261014-1722-3): the tool's name and the day only,
  // never the arguments or who called
  const failed = mcpFailure(msg, reply);
  if (failed) { const p = recordShortfall(env, failed, 'failed'); if (waitUntil) waitUntil(p); else await p; }
  return reply ? json(reply) : new Response(null, { status: 202 });
}

export function onRequestGet() {
  return new Response('Verse speaks MCP here: POST JSON-RPC (initialize, tools/list, tools/call). The tools: https://a-to-mind.com/tools.json\n', { status: 405, headers: { allow: 'POST', 'content-type': 'text/plain; charset=utf-8' } });
}

/** the shortfall place for a failed tools/call ('mcp <tool>', 20 characters at most), else null. Pure. */
export function mcpFailure(msg, reply) {
  if (!msg || msg.method !== 'tools/call' || !reply) return null;
  if (!(reply.error || (reply.result && reply.result.isError))) return null;
  const name = String((msg.params && msg.params.name) || 'unknown').replace(/[^a-z0-9_]/gi, '').slice(0, 16) || 'unknown';
  return 'mcp ' + name;
}
