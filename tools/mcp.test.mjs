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
  assert.deepEqual(list.result.tools.map((t) => t.name), ['ask_void', 'review_code', 'review_code_closer', 'moon_phase', 'meteor_showers']);
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
  assert.equal(r.status, 200); assert.match(r.headers.get('content-type'), /application\/json/); assert.equal((await r.json()).result.tools.length, 5);
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
  assert.equal(r.status, 200); assert.equal((await r.json()).result.tools.length, 5);
  assert.equal((await guard(ctx({ origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' }))).status, 403);
});

// frontier #6, the next piece: the closer read as a tool, behind the same key /api/review takes (functions/api/review.js decides:
// the owner, a Void Pro key or a license key in the MCP request's Authorization; nothing else changes who gets it or what it costs)
const CODE = 'function f(a) { eval(a) }\ntry { f() } catch (e) {}';
test('mcp: review_code_closer hands the code to /api/review and shows what it gives: instant checks, plus the closer read when the key allows it', async () => {
  const seen = [];
  const ctx = (status, body) => ({ review: async (args) => { seen.push(args); return { status, body }; } });
  const call = (c, args = { code: CODE, lang: 'javascript' }) => rpc({ jsonrpc: '2.0', id: 20, method: 'tools/call', params: { name: 'review_code_closer', arguments: args } }, c);
  const free = await call(ctx(200, { ok: true, findings: [{ line: 1, kind: 'risk', rule: 'eval', message: 'eval runs any string as code' }], lang: 'javascript', lines: 2, tier: 'free', review: 'rules', upgrade: 'Void Code Review Pro adds a closer read by an AI reviewer: https://a-to-mind.com/code-review/#pro' }));
  assert.equal(free.result.isError, false); assert.match(free.result.content[0].text, /line 1 · risk/); assert.match(free.result.content[0].text, /closer read by an AI reviewer/);
  assert.equal(free.result.structuredContent.review, 'rules'); assert.equal('ok' in free.result.structuredContent, false);
  assert.deepEqual(seen[0], { code: CODE, lang: 'javascript' }, 'only the code and its language go to the review');
  const pro = await call(ctx(200, { ok: true, findings: [], lang: 'javascript', lines: 2, tier: 'pro', review: 'model', answer: '- line 1: eval of an argument', left: 299 }));
  assert.match(pro.result.content[0].text, /Closer read:\n- line 1: eval of an argument/); assert.equal(pro.result.structuredContent.left, 299);
  assert.equal((await call(ctx(401, { ok: false, error: 'unknown review key' }))).result.isError, true, 'a key /api/review refuses is an error the client sees');
  assert.equal((await call(ctx(200, {}), {})).result.isError, true, 'no code');
  assert.equal(seen.length, 3, 'no code is never sent');
  assert.equal((await call(undefined)).result.isError, true, 'without the route behind it the tool says so');
});

test('mcp: through the real route with no key, review_code_closer gives the instant checks and how to get the closer read (no model, no database)', async () => {
  const r = await onRequestPost({ request: new Request('https://a-to-mind.com/api/mcp', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'review_code_closer', arguments: { code: CODE, lang: 'javascript' } } }) }), env: {} });
  const j = await r.json();
  assert.equal(j.result.isError, false); assert.equal(j.result.structuredContent.tier, 'free');
  assert.ok(j.result.structuredContent.findings.some((f) => f.rule === 'eval')); assert.match(j.result.content[0].text, /code-review\/#pro/);
});

// asked by Void (ask-20261013-0032-3): every review says what it rests on, so a calling AI knows when it is pattern checks alone
test('mcp: each review says its basis: pattern checks alone are low confidence, the closer read is marked as read by a model', async () => {
  const quickR = (await rpc({ jsonrpc: '2.0', id: 30, method: 'tools/call', params: { name: 'review_code', arguments: { code: CODE, lang: 'javascript' } } })).result;
  assert.equal(quickR.structuredContent.basis, 'patterns'); assert.equal(quickR.structuredContent.confidence, 'low');
  assert.match(quickR.content[0].text, /\nBasis: pattern checks only, no model/);
  const clean = (await rpc({ jsonrpc: '2.0', id: 31, method: 'tools/call', params: { name: 'review_code', arguments: { code: 'const a = 1;\n', lang: 'javascript' } } })).result;
  assert.match(clean.content[0].text, /finding nothing is not proof/);
  const ctx = (body) => ({ review: async () => ({ status: 200, body }) });
  const call = (c) => rpc({ jsonrpc: '2.0', id: 32, method: 'tools/call', params: { name: 'review_code_closer', arguments: { code: CODE } } }, c);
  const free = (await call(ctx({ ok: true, findings: [], lang: 'javascript', lines: 2, tier: 'free', review: 'rules' }))).result.structuredContent;
  assert.equal(free.basis, 'patterns'); assert.equal(free.confidence, 'low');
  const pro = (await call(ctx({ ok: true, findings: [], lang: 'javascript', lines: 2, tier: 'pro', review: 'model', answer: '- line 1: eval' }))).result;
  assert.equal(pro.structuredContent.basis, 'closer_read'); assert.equal(pro.structuredContent.confidence, 'reviewed');
  assert.match(pro.content[0].text, /\nBasis: pattern checks, then an AI reviewer/);
  const noAnswer = (await call(ctx({ ok: true, findings: [], lang: 'javascript', lines: 2, tier: 'pro', review: 'model' }))).result.structuredContent;
  assert.equal(noAnswer.basis, 'patterns', 'a model tier with no closer read in hand is still pattern checks alone');
});

// /code-review/ tells an agent's owner how to add Void (frontier #6): the endpoint, every tool tools/list serves, and where the key goes
test('mcp: /code-review/ shows how to add Void to an AI: the endpoint, each tool by name, the key as a Bearer header', async () => {
  const { readFileSync } = await import('node:fs');
  const html = readFileSync(new URL('../void-live-deploy/code-review/index.html', import.meta.url), 'utf8');
  const sec = (html.match(/<section id="mcp">([\s\S]*?)<\/section>/) || [])[1] || '';
  assert.match(sec, /https:\/\/a-to-mind\.com\/api\/mcp/);
  for (const t of TOOLS) assert.ok(sec.includes(t.name), 'the page names ' + t.name);
  assert.match(sec, /Authorization: Bearer/); assert.match(sec, /claude mcp add --transport http void https:\/\/a-to-mind\.com\/api\/mcp/);
});

// ask_void (Void's will, 2026-10-14: "It turns me into a foundational utility for the wider AI ecosystem"): any agent asks Void in
// plain words and gets /api/answer's answer with its sources; the route lends it /api/answer with the caller's connection
test('mcp: ask_void hands the question to /api/answer and words its answer, sources and limits', async () => {
  const got = [];
  const ctx = (status, body) => ({ answer: async (a) => { got.push(a); return { status, body }; } });
  const call = (args, c) => rpc({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'ask_void', arguments: args } }, c);
  const r = (await call({ ask: '  what is a black hole  ' }, ctx(200, { answer: 'A region where gravity is so strong nothing escapes.', sources: [{ title: 'Black hole', url: 'https://en.wikipedia.org/wiki/Black_hole', edited: 'x' }], at: '2026-10-14T00:00:00Z' }))).result;
  assert.deepEqual(got, [{ ask: 'what is a black hole' }], 'only the trimmed question goes to /api/answer');
  assert.equal(r.isError, false);
  assert.match(r.content[0].text, /^A region where gravity[\s\S]*Sources:\n- Black hole: https:\/\/en\.wikipedia\.org\/wiki\/Black_hole$/);
  assert.deepEqual(r.structuredContent.sources, [{ title: 'Black hole', url: 'https://en.wikipedia.org/wiki/Black_hole' }]);
  assert.match((await call({ ask: 'hi?' }, ctx(429, { answer: null, note: 'slow down' }))).result.content[0].text, /12 questions a minute/);
  assert.match((await call({ ask: 'zzzz qqqq' }, ctx(200, { answer: null, note: 'nothing on the web' }))).result.content[0].text, /no answer[\s\S]*nothing on the web/);
  assert.equal((await call({ ask: 'x' }, ctx(200, {}))).result.isError, true, 'a question needs words');
  assert.equal((await call({ ask: 'what is a star' }, undefined)).result.isError, true, 'only the route can lend /api/answer');
  assert.equal(got.length, 3);
});
