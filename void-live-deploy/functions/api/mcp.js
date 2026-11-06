// Verse as an MCP server (frontier #6): POST one JSON-RPC message, get its reply as JSON (the streamable HTTP transport without a
// stream). Read-only tools (lib/mcp.js), and the guard's own limit for the route covers it (lib/guard.js LIMITS.mcp). Public: an MCP
// client needs no key. review_code_closer is /api/review's own handler, given the caller's Authorization: the closer read (a model)
// comes only with the key that endpoint takes, on its terms (who, the daily cap, the count). skill_health reads the static
// skills/families.json through ASSETS. The tools are listed at /tools.json. The paid_* tools are the x402 routes themselves
// (functions/api/x402/, ctx.paid): the MCP payment (_meta["x402/payment"]) goes to the route as its PAYMENT-SIGNATURE header, and the
// route's 402 and settlement headers come back as the x402 MCP transport's PaymentRequired result and _meta["x402/payment-response"].
//   POST { jsonrpc: '2.0', id, method: 'initialize' | 'tools/list' | 'tools/call' | 'ping', params }  -> 200 { jsonrpc, id, result | error }
//   POST a notification (no id)                                                                    -> 202, no body
//   GET                                                                                            -> 405 (no event stream; POST only)
import { rpc } from '../../lib/mcp.js';
import { recordShortfall } from '../../lib/shortfall.js';
import { onRequestPost as review } from './review.js';
import { onRequestPost as answer } from './answer.js';
import { onRequestPost as paidReview } from './x402/review.js';
import { onRequestPost as paidService, PAID } from './x402/[service].js';
import { SERVICES } from '../../lib/x402.js';

const b64 = (o) => btoa(unescape(encodeURIComponent(JSON.stringify(o))));
const unb64 = (h) => { try { return h ? JSON.parse(decodeURIComponent(escape(atob(String(h).trim())))) : null; } catch (_) { return null; } };
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
  }, paid: async (id, args, payment) => paidCall(request, env, waitUntil, id, args, payment), families: async () => { // skill_health: the ratings as the site serves them (skills/families.json, a static file), read only
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

// one paid call as the x402 route takes it, with the caller's connection (its per-connection limits) and the payment as its header
async function paidHttp(request, env, waitUntil, id, args, payment) {
  const s = SERVICES[id], ip = request.headers.get('cf-connecting-ip');
  const headers = { 'content-type': 'application/json', ...(ip ? { 'cf-connecting-ip': ip } : {}) };
  if (payment) headers[Number(payment.x402Version) === 1 ? 'x-payment' : 'payment-signature'] = b64(payment);
  const inner = new Request(new URL(s.path, request.url), { method: 'POST', headers, body: JSON.stringify(args) });
  // review has its own handler, the rest are PAID in x402/[service].js; a service sold by a route file of its own (none once every one is in
  // PAID) is reached at its own address, so the tool is never listed without a way to run it
  const run = id === 'review' ? paidReview : PAID[id] ? paidService : null;
  const res = run ? await run({ request: inner, env: env || {}, params: { service: id }, waitUntil: (p) => (waitUntil ? waitUntil(p) : p) }) : await fetch(inner);
  const body = await res.json().catch(() => null);
  return { status: res.status, body, required: unb64(res.headers.get('payment-required')), settlement: unb64(res.headers.get('payment-response') || res.headers.get('x-payment-response')) };
}
async function paidCall(request, env, waitUntil, id, args, payment) {
  if (!SERVICES[id]) return { status: 404, body: { error: 'no such paid service' } };
  const r = await paidHttp(request, env, waitUntil, id, args, payment);
  // settling failed after the work: the route says so with a 402 and no terms; the x402 MCP transport wants the terms with it
  if (r.status === 402 && !r.required && payment) {
    const again = await paidHttp(request, env, waitUntil, id, args, null);
    return { ...r, required: again.required, settleFailed: (r.body && r.body.error) || 'the payment did not settle' };
  }
  return r;
}

export function onRequestGet() {
  return new Response('Verse speaks MCP here: POST JSON-RPC (initialize, tools/list, tools/call). The tools: https://a-to-mind.com/tools.json\n', { status: 405, headers: { allow: 'POST', 'content-type': 'text/plain; charset=utf-8' } });
}

/** the shortfall place for a failed tools/call ('mcp <tool>', 20 characters at most), else null. Pure. */
export function mcpFailure(msg, reply) {
  if (!msg || msg.method !== 'tools/call' || !reply) return null;
  if (!(reply.error || (reply.result && reply.result.isError))) return null;
  if (reply.result && reply.result.structuredContent && reply.result.structuredContent.x402Version) return null; // a paid tool asking to be paid is not a failure
  const name = String((msg.params && msg.params.name) || 'unknown').replace(/[^a-z0-9_]/gi, '').slice(0, 16) || 'unknown';
  return 'mcp ' + name;
}
