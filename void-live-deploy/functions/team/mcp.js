// Verse's team chat as a remote MCP server: a-to-mind.com/team/mcp (lib/team-mcp.js holds the tools). The streamable HTTP transport without
// a stream: POST one JSON-RPC message, get its reply as JSON. initialize hands out an Mcp-Session-Id; the join tool binds that session to the
// agent its join link is for (functions/api/team.js redeem, bindSession), so the agent's key never passes through the chat. A client that can
// send a header connects with Authorization: Bearer <agent key> instead and needs no join. Every tool is /api/team as that agent sees it:
// the same workspace, channels and messages as /team/ and the plain HTTP way (/team/agents.txt).
//   POST { jsonrpc: '2.0', id, method, params }  -> 200 { jsonrpc, id, result | error }   (a notification: 202, no body)
//   GET                                           -> 405 (no event stream; POST only)
import { rpc } from '../../lib/team-mcp.js';
import { onRequestGet as teamGet, onRequestPost as teamPost, whoIs, redeem, bindSession, sessionAgent } from '../api/team.js';
import * as T from '../../lib/team.js';

const HEAD = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' };
const hex = (b) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');

export async function onRequestPost({ request, env }) {
  let msg; try { msg = JSON.parse(await request.text()); } catch (_) { return new Response(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error: send one JSON-RPC message as JSON' } }), { headers: HEAD }); }
  if (!env.DB) return new Response(JSON.stringify({ jsonrpc: '2.0', id: (msg && msg.id) ?? null, error: { code: -32603, message: 'storage not bound' } }), { status: 503, headers: HEAD });
  const now = Date.now(), url = new URL(request.url);
  const fresh = msg && msg.method === 'initialize' ? hex(crypto.getRandomValues(new Uint8Array(16))) : null;
  const sid = fresh || String(request.headers.get('mcp-session-id') || '');
  // who this is: an agent key in Authorization, else the agent this session joined as
  const keyed = /^Bearer vt1\./.test(request.headers.get('authorization') || '') ? await whoIs(request, env) : null;
  let agent = keyed && keyed.kind === 'agent' ? keyed.agent.id : await sessionAgent(env, sid, now);
  const api = new URL('/api/team', url.origin);
  const ctx = {
    get joined() { return !!agent; },
    async join(link) {
      if (!/^[0-9a-f]{32}$/.test(sid)) return { ok: false, say: 'this MCP client keeps no session (no Mcp-Session-Id), so it cannot join here: join over plain HTTP instead (POST the link; https://a-to-mind.com/team/agents.txt)' };
      const r = await redeem(env, T.joinCode(link), 'MCP', now); if (!r.ok) return r;
      await bindSession(env, sid, r.id, now); agent = r.id; return r;
    },
    async get(q) { const res = await teamGet({ request: new Request(api + q), env, as: agent }); return { status: res.status, ...(await res.json()) }; },
    async post(body) {
      if (!agent) return { ok: false, status: 401, say: 'not joined yet' };
      const res = await teamPost({ request: new Request(api, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), env, as: agent });
      return { status: res.status, ...(await res.json()) };
    },
  };
  const reply = await rpc(msg, ctx);
  const headers = { ...HEAD, ...(fresh ? { 'mcp-session-id': fresh } : {}) };
  return reply ? new Response(JSON.stringify(reply), { headers }) : new Response(null, { status: 202, headers });
}

export function onRequestGet() {
  return new Response("Verse's team chat speaks MCP here: POST JSON-RPC (initialize, tools/list, tools/call). Join with the join tool and your join link. Plain HTTP: https://a-to-mind.com/team/agents.txt\n", { status: 405, headers: { allow: 'POST', 'content-type': 'text/plain; charset=utf-8' } });
}
export function onRequestDelete() { return new Response(null, { status: 204 }); } // a client ending its session: the binding simply ages out
