// Frontier #6, the first piece: Void as an MCP server (functions/api/mcp.js over lib/mcp.js). An MCP client (Claude, ChatGPT, any
// agent) POSTs JSON-RPC to /api/mcp and lists and calls three read-only tools: the instant code review, the moon's phase, and the
// meteor showers. Nothing here writes, calls a model or reaches another service. Run: node --test tools/mcp.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rpc, TOOLS, PROTOCOL } from '../void-live-deploy/lib/mcp.js';
import { onRequestPost, onRequestGet } from '../void-live-deploy/functions/api/mcp.js';
import { LIMITS } from '../void-live-deploy/lib/guard.js';

test('mcp: initialize names Void and its tools capability; tools/list gives three read-only tools with input schemas', async () => {
  const init = await rpc({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: PROTOCOL, capabilities: {}, clientInfo: { name: 't', version: '1' } } });
  assert.equal(init.id, 1); assert.equal(init.result.serverInfo.name, 'void'); assert.ok(init.result.capabilities.tools); assert.equal(init.result.protocolVersion, PROTOCOL);
  const list = await rpc({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  assert.deepEqual(list.result.tools.map((t) => t.name), ['review_code', 'moon_phase', 'meteor_showers']);
  for (const t of list.result.tools) { assert.equal(t.inputSchema.type, 'object'); assert.ok(t.description.length > 20); assert.equal(t.annotations.readOnlyHint, true); }
  assert.equal(await rpc({ jsonrpc: '2.0', method: 'notifications/initialized' }), null, 'a notification gets no reply');
  assert.deepEqual((await rpc({ jsonrpc: '2.0', id: 3, method: 'ping' })).result, {});
});

test('mcp: tools/call runs the real checks: a bug in pasted code is found, the moon has a phase, the showers have a next peak', async () => {
  const r = await rpc({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'review_code', arguments: { code: 'function f(a) { eval(a) }\ntry { f() } catch (e) {}', lang: 'javascript' } } });
  const rules = r.result.structuredContent.findings.map((f) => f.rule);
  assert.equal(r.result.isError, false); assert.ok(rules.includes('eval') && rules.includes('empty-catch'), rules.join()); assert.match(r.result.content[0].text, /line 1 · risk/);
  const m = await rpc({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'moon_phase', arguments: { date: '2026-10-11T00:00:00Z' } } });
  const mc = m.result.structuredContent; assert.ok(mc.illuminated >= 0 && mc.illuminated <= 1); assert.equal(typeof mc.waxing, 'boolean'); assert.match(mc.phase, /moon|quarter|crescent|gibbous/);
  const s = await rpc({ jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'meteor_showers', arguments: { date: '2026-10-11' } } });
  assert.ok(Array.isArray(s.result.structuredContent.active)); assert.ok(s.result.structuredContent.next.name);
});

test('mcp: bad calls are JSON-RPC errors, never a crash: unknown method, unknown tool, bad arguments, no code, a bad date', async () => {
  assert.equal((await rpc({ jsonrpc: '2.0', id: 7, method: 'resources/list' })).error.code, -32601);
  assert.equal((await rpc({ jsonrpc: '2.0', id: 8, method: 'tools/call', params: { name: 'delete_everything', arguments: {} } })).error.code, -32602);
  assert.equal((await rpc({ jsonrpc: '2.0', id: 9, method: 'tools/call', params: { name: 'review_code', arguments: {} } })).result.isError, true);
  assert.equal((await rpc({ jsonrpc: '2.0', id: 10, method: 'tools/call', params: { name: 'moon_phase', arguments: { date: 'not a date' } } })).result.isError, true);
  assert.equal((await rpc({ id: 11, method: 'tools/list' })).error.code, -32600, 'not JSON-RPC 2.0');
});

test('mcp: the endpoint speaks HTTP: POST JSON in, JSON out; a notification is 202; bad JSON is a parse error; GET says how to use it', async () => {
  const post = (body) => onRequestPost({ request: new Request('https://a-to-mind.com/api/mcp', { method: 'POST', headers: { 'content-type': 'application/json' }, body }) });
  const r = await post(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }));
  assert.equal(r.status, 200); assert.match(r.headers.get('content-type'), /application\/json/); assert.equal((await r.json()).result.tools.length, 3);
  assert.equal((await post(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }))).status, 202);
  assert.equal((await (await post('{not json')).json()).error.code, -32700);
  const g = await onRequestGet({ request: new Request('https://a-to-mind.com/api/mcp') });
  assert.equal(g.status, 405); assert.match(g.headers.get('allow'), /POST/);
  assert.ok(LIMITS.mcp && LIMITS.mcp.rpm <= 60 && LIMITS.mcp.body >= 60000, 'the guard has its own limit for the route');
});

test('mcp: /tools.json (the public list) names the endpoint and lists exactly what tools/list serves', async () => {
  const { onRequestGet: toolsJson } = await import('../void-live-deploy/functions/tools.json.js');
  const r = await toolsJson({ request: new Request('https://a-to-mind.com/tools.json'), env: { ASSETS: { fetch: async () => new Response('', { status: 404 }) } } });
  const pub = await r.json();
  assert.equal(pub.mcp.endpoint, 'https://a-to-mind.com/api/mcp');
  assert.deepEqual(pub.mcp.tools, TOOLS.map(({ name, title, description, inputSchema, annotations }) => ({ name, title, description, inputSchema, annotations })));
  assert.ok(pub.call && pub.tools.length >= 5, 'the skill list is still there');
});

// through the guard (functions/api/_middleware.js), as an MCP client sends it: no Origin, so it passes; another website's page cannot
import { guard, resetGuard } from '../void-live-deploy/lib/guard.js';
test('mcp: an MCP client (no Origin) gets through the guard to the tools; a page on another site is refused', async () => {
  resetGuard();
  const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
  const ctx = (headers) => ({ request: new Request('https://a-to-mind.com/api/mcp', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body }), env: {}, next: (req) => onRequestPost({ request: req }) });
  const r = await guard(ctx({}));
  assert.equal(r.status, 200); assert.equal((await r.json()).result.tools.length, 3);
  assert.equal((await guard(ctx({ origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' }))).status, 403);
});
