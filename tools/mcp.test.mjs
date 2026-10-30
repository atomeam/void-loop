// Frontier #6, the first piece: Verse as an MCP server (functions/api/mcp.js over lib/mcp.js). An MCP client (Claude, ChatGPT, any
// agent) POSTs JSON-RPC to /api/mcp and lists and calls three read-only tools: the instant code review, the moon's phase, and the
// meteor showers. Nothing here writes, calls a model or reaches another service. Run: node --test tools/mcp.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rpc, TOOLS, PROTOCOL } from '../void-live-deploy/lib/mcp.js';
import { onRequestPost, onRequestGet } from '../void-live-deploy/functions/api/mcp.js';
import { LIMITS } from '../void-live-deploy/lib/guard.js';
import { SKILL_TOOLS } from '../void-live-deploy/lib/mcp-skills.js';
import { choose, evidenceOf, OVER_MCP, HELD, TOP } from './mcp-skills.mjs';
import { readFileSync } from 'node:fs';

test('mcp: initialize names Verse and its tools capability; tools/list gives its read-only tools with input schemas', async () => {
  const init = await rpc({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: PROTOCOL, capabilities: {}, clientInfo: { name: 't', version: '1' } } });
  assert.equal(init.id, 1); assert.equal(init.result.serverInfo.name, 'void'); assert.ok(init.result.capabilities.tools); assert.equal(init.result.protocolVersion, PROTOCOL);
  const list = await rpc({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  assert.deepEqual(list.result.tools.map((t) => t.name), ['ask_void', 'review_code', 'review_code_closer', 'moon_phase', 'meteor_showers', 'drive_time', ...SKILL_TOOLS.map((s) => s.tool), 'seo_audit', 'readability', 'colour_contrast', 'skill_health', 'skill_discovery']);
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
  assert.equal(r.status, 200); assert.match(r.headers.get('content-type'), /application\/json/); assert.equal((await r.json()).result.tools.length, TOOLS.length);
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
  assert.equal(r.status, 200); assert.equal((await r.json()).result.tools.length, TOOLS.length);
  assert.equal((await guard(ctx({ origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' }))).status, 403);
});

// frontier #6, the next piece: the closer read as a tool, behind the same key /api/review takes (functions/api/review.js decides:
// the owner, a Verse Pro key or a license key in the MCP request's Authorization; nothing else changes who gets it or what it costs)
const CODE = 'function f(a) { eval(a) }\ntry { f() } catch (e) {}';
test('mcp: review_code_closer hands the code to /api/review and shows what it gives: instant checks, plus the closer read when the key allows it', async () => {
  const seen = [];
  const ctx = (status, body) => ({ review: async (args) => { seen.push(args); return { status, body }; } });
  const call = (c, args = { code: CODE, lang: 'javascript' }) => rpc({ jsonrpc: '2.0', id: 20, method: 'tools/call', params: { name: 'review_code_closer', arguments: args } }, c);
  const free = await call(ctx(200, { ok: true, findings: [{ line: 1, kind: 'risk', rule: 'eval', message: 'eval runs any string as code' }], lang: 'javascript', lines: 2, tier: 'free', review: 'rules', upgrade: 'Verse Code Review Pro adds a closer read by an AI reviewer: https://a-to-mind.com/code-review/#pro' }));
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

// asked by Verse (ask-20261013-0032-3): every review says what it rests on, so a calling AI knows when it is pattern checks alone
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

// /code-review/ tells an agent's owner how to add Verse (frontier #6): the endpoint, every tool tools/list serves, and where the key goes
test('mcp: /code-review/ shows how to add Verse to an AI: the endpoint, each tool by name, the key as a Bearer header', async () => {
  const { readFileSync } = await import('node:fs');
  const html = readFileSync(new URL('../void-live-deploy/code-review/index.html', import.meta.url), 'utf8');
  const sec = (html.match(/<section id="mcp">([\s\S]*?)<\/section>/) || [])[1] || '';
  assert.match(sec, /https:\/\/a-to-mind\.com\/api\/mcp/);
  for (const t of TOOLS) assert.ok(sec.includes(t.name), 'the page names ' + t.name);
  assert.match(sec, /Authorization: Bearer/); assert.match(sec, /claude mcp add --transport http void https:\/\/a-to-mind\.com\/api\/mcp/);
});

// ask_void (Verse's will, 2026-10-14: "It turns me into a foundational utility for the wider AI ecosystem"): any agent asks Verse in
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

// asked by Verse (2026-10-15): "Define and implement the MCP tool definitions for my top 10 most 'proven' skills to ensure seamless
// cross-agent invocation" and "a 'Skill Discovery' endpoint for the MCP registry that returns my current skill-family health metrics".
// The ten are chosen from the ratings (tools/mcp-skills.mjs), each answered on ask_void's own path; skill_health reads families.json.
const FAMILIES = JSON.parse(readFileSync(new URL('../void-live-deploy/skills/families.json', import.meta.url), 'utf8'));
const ratingOf = (n) => FAMILIES.families.flatMap((f) => f.skills.map((s) => ({ ...s, family: f.id }))).find((s) => s.name === n);

test('mcp skills: the skill tools (up to ten) are proven, in families that answer in words, not held back, and the most evidence of what qualifies', () => {
  assert.ok(SKILL_TOOLS.length > 0 && SKILL_TOOLS.length <= TOP);
  const scores = [];
  for (const s of SKILL_TOOLS) {
    const r = ratingOf(s.skill);
    assert.equal(r.tier, 'proven', s.skill + ' is rated proven'); assert.ok(OVER_MCP.includes(r.family), s.skill + ' is in a family that answers in words');
    assert.ok(!(s.skill in HELD), s.skill + ' is not held back'); assert.ok(s.examples.length >= 1, s.skill + ' has real asks as examples');
    scores.push(evidenceOf(r.why).score);
  }
  // nothing left out has more evidence than the least of those chosen
  const left = FAMILIES.families.filter((f) => OVER_MCP.includes(f.id)).flatMap((f) => f.skills)
    .filter((s) => s.tier === 'proven' && !(s.name in HELD) && !SKILL_TOOLS.some((t) => t.skill === s.name));
  for (const s of left) assert.ok(evidenceOf(s.why).score <= Math.min(...scores), s.name + ' has more evidence than a chosen skill');
  // a skill that works out an exact sum is not offered: over MCP a model would answer in its name
  assert.ok(!OVER_MCP.includes('numbers'));
  // nothing that sends, books, spends or touches the owner's data: those families are never offered
  for (const f of ['self', 'stage', 'make', 'games', 'time', 'body']) assert.ok(!OVER_MCP.includes(f));
  assert.deepEqual(evidenceOf('a self-test, 4 browser-suite mentions, 30 real asks in the benchmark'), { suite: true, browser: 4, bench: 30, score: 35 });
  assert.deepEqual(evidenceOf('1 real ask in the benchmark'), { suite: false, browser: 0, bench: 1, score: 1 });
});

test('mcp skills: the choice is a pure function of the ratings: held back, unproven, not live or a family not offered never gets in', () => {
  const fam = (skills) => ({ families: [{ id: 'words', name: 'Words', skills }, { id: 'self', name: 'Verse itself', skills: [{ name: 'actions', tier: 'proven', why: 'a self-test, 9 browser-suite mentions, 900 real asks in the benchmark' }] }] });
  const bench = [{ ask: 'a', want: 'skill:a' }, { ask: 'b1', want: 'skill:b|calc' }, { ask: 'b1', want: 'skill:b' }];
  const got = choose(fam([{ name: 'a', tier: 'proven', why: '3 real asks in the benchmark' }, { name: 'b', tier: 'proven', why: 'a self-test, 9 real asks in the benchmark' },
    { name: 'c', tier: 'checked', why: 'a self-test, 99 real asks in the benchmark' }, { name: 'util', tier: 'proven', why: 'a self-test, 99 real asks in the benchmark' },
    { name: 'gone', tier: 'proven', why: '50 real asks in the benchmark' }]), ['a', 'b', 'c', 'util', 'actions'], bench, 1);
  assert.deepEqual(got, [{ skill: 'b', tool: 'skill_b', family: 'words', familyName: 'Words', examples: ['b1'] }]);
});

test('mcp skills: lib/mcp-skills.js and the names on /code-review/ are in step with the ratings (else: node tools/mcp-skills.mjs)', async () => {
  const { spawnSync } = await import('node:child_process');
  const r = spawnSync(process.execPath, [new URL('./mcp-skills.mjs', import.meta.url).pathname, '--check'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr || r.stdout);
});

test('mcp skills: each skill tool has a clear description and an ask schema, and calls ask_void\'s own path with the link to the skill', async () => {
  const list = (await rpc({ jsonrpc: '2.0', id: 1, method: 'tools/list' })).result.tools;
  for (const s of SKILL_TOOLS) {
    const t = list.find((x) => x.name === s.tool);
    assert.ok(t, s.tool + ' is listed'); assert.deepEqual(t.inputSchema.required, ['ask']); assert.equal(t.inputSchema.properties.ask.type, 'string');
    assert.equal(t.annotations.readOnlyHint, true); assert.equal(t.annotations.destructiveHint, false);
    assert.match(t.description, new RegExp('"' + s.skill + '" skill[\\s\\S]*answered the way ask_void is'));
  }
  const seen = [];
  const ctx = { answer: async (a) => { seen.push(a); return { status: 200, body: { answer: 'Serendipity: finding something good without looking for it.', sources: [], at: '2026-10-15T00:00:00Z' } }; } };
  const r = (await rpc({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'skill_define', arguments: { ask: ' define serendipity ' } } }, ctx)).result;
  assert.deepEqual(seen, [{ ask: 'define serendipity' }], 'the same call ask_void makes, nothing more');
  assert.equal(r.isError, false); assert.match(r.content[0].text, /^Serendipity: finding[\s\S]*The define skill itself: https:\/\/a-to-mind\.com\/\?q=define%20serendipity$/);
  assert.deepEqual([r.structuredContent.skill, r.structuredContent.path], ['define', 'answer_engine']);
  const viaAsk = (await rpc({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'ask_void', arguments: { ask: 'define serendipity' } } }, ctx)).result;
  assert.equal(viaAsk.structuredContent.answer, r.structuredContent.answer, 'the same answer ask_void gives');
  assert.equal((await rpc({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'skill_define', arguments: { ask: 'x' } } }, ctx)).result.isError, true, 'too short: ask_void\'s own check');
  assert.equal((await rpc({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'skill_define', arguments: { ask: 'define serendipity' } } })).result.isError, true, 'only the route lends /api/answer');
  const raw = (await rpc({ jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'skill_define', arguments: { ask: 'define serendipity', response_type: 'raw_data' } } }, ctx)).result;
  assert.equal(JSON.parse(raw.content[0].text).skill, 'define');
});

test('mcp skills: through the real route, a skill tool reaches /api/answer and comes back with a real answer (no model bound: the open web)', async () => {
  // only the network is stubbed: the MCP route, lib/mcp.js and /api/answer's own handler run for real
  const real = globalThis.fetch;
  globalThis.fetch = async (u) => {
    const url = String(u);
    if (url.includes('list=search')) return Response.json({ query: { search: [{ title: 'Canberra' }] } });
    if (url.includes('/page/summary/')) return Response.json({ title: 'Canberra', extract: 'Canberra is the capital city of Australia.', content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Canberra' } }, timestamp: '2026-10-01T00:00:00Z' });
    return new Response('', { status: 404 });
  };
  try {
    const res = await onRequestPost({ request: new Request('https://a-to-mind.com/api/mcp', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'skill_country', arguments: { ask: 'capital of australia' } } }) }), env: {} });
    const j = await res.json();
    assert.equal(j.result.isError, false, JSON.stringify(j));
    assert.match(j.result.content[0].text, /Canberra is the capital city of Australia\.[\s\S]*Sources:\n- Canberra: https:\/\/en\.wikipedia\.org\/wiki\/Canberra[\s\S]*The country skill itself: https:\/\/a-to-mind\.com\/\?q=capital%20of%20australia/);
    assert.equal(j.result.structuredContent.skill, 'country');
  } finally { globalThis.fetch = real; }
});

test('mcp skills: skill_health gives the family health metrics from families.json, a family\'s skills one by one, and errors plainly', async () => {
  const ctx = { families: async () => FAMILIES };
  const call = (args, c = ctx) => rpc({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'skill_health', arguments: args } }, c);
  const h = (await call({})).result;
  assert.equal(h.isError, false);
  const d = h.structuredContent;
  assert.deepEqual(d.totals, FAMILIES.totals, 'the totals are families.json\'s own');
  assert.equal(d.skills, Object.values(FAMILIES.totals).reduce((a, b) => a + b, 0));
  assert.equal(d.families.length, FAMILIES.families.length);
  for (const f of d.families) {
    const src = FAMILIES.families.find((x) => x.id === f.id);
    assert.deepEqual(f.count, src.count); assert.equal(f.skills, src.skills.length); assert.ok(f.proven_share >= 0 && f.proven_share <= 1); assert.equal(f.members, undefined);
  }
  assert.deepEqual(d.tools, SKILL_TOOLS.map((s) => s.tool)); assert.equal(d.source, 'https://a-to-mind.com/skills/families.json');
  assert.match(h.content[0].text, new RegExp('^' + d.skills + ' skills, rated from evidence only: ' + d.totals.proven + ' proven'));
  const one = (await call({ family: 'Numbers' })).result.structuredContent.families.find((f) => f.id === 'numbers');
  assert.deepEqual(one.members.map((s) => s.name), FAMILIES.families.find((f) => f.id === 'numbers').skills.map((s) => s.name));
  assert.match((await call({ family: 'nope' })).result.content[0].text, /No family "nope"\. The families: make, /);
  assert.equal((await call({}, null)).result.isError, true, 'only the route lends the ratings');
  assert.equal((await call({}, { families: async () => null })).result.isError, true, 'unreadable ratings are an error, not zeros');
  const listed = (await rpc({ jsonrpc: '2.0', id: 2, method: 'tools/list' })).result.tools.find((t) => t.name === 'skill_health');
  assert.equal(listed.annotations.readOnlyHint, true); assert.equal(listed.annotations.openWorldHint, false);
});

test('mcp skills: through the real route, skill_health reads skills/families.json as the site serves it (ASSETS, a GET)', async () => {
  const asked = [];
  const env = { ASSETS: { fetch: async (req) => { asked.push([req.method, new URL(req.url).pathname]); return new Response(readFileSync(new URL('../void-live-deploy/skills/families.json', import.meta.url))); } } };
  const res = await onRequestPost({ request: new Request('https://a-to-mind.com/api/mcp', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'skill_health', arguments: { family: 'words' } } }) }), env });
  const j = await res.json();
  assert.equal(j.result.isError, false); assert.deepEqual(asked, [['GET', '/skills/families.json']]);
  assert.deepEqual(j.result.structuredContent.totals, FAMILIES.totals);
  assert.ok(j.result.structuredContent.families.find((f) => f.id === 'words').members.length > 0);
});

test('mcp skill_discovery (asked by Verse): the families as a distribution with their skills by name, one family or a rating floor, errors plainly', async () => {
  const ctx = { families: async () => FAMILIES };
  const call = (args, c = ctx) => rpc({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'skill_discovery', arguments: args } }, c);
  const r = (await call({})).result; assert.equal(r.isError, false);
  const d = r.structuredContent, all = FAMILIES.families.reduce((n, f) => n + f.skills.length, 0);
  assert.equal(d.skills, all); assert.equal(d.family_count, FAMILIES.families.length);
  assert.ok(Math.abs(d.distribution.reduce((n, x) => n + x.share, 0) - 1) < 0.01, 'the shares add up to the whole');
  assert.deepEqual(d.families[0].members.map((m) => m.name), FAMILIES.families[0].skills.map((s) => s.name));
  const one = (await call({ family: FAMILIES.families[0].id })).result.structuredContent; assert.equal(one.families.length, 1);
  const top = (await call({ tier: 'proven' })).result.structuredContent; assert.ok(top.families.every((f) => f.members.every((m) => m.tier === 'proven')));
  assert.equal((await call({ tier: 'shiny' })).result.isError, true); assert.match((await call({ family: 'nope' })).result.content[0].text, /No family "nope"/);
  assert.equal((await call({}, null)).result.isError, true); assert.equal((await call({}, { families: async () => null })).result.isError, true);
});

// Verse's own tools over MCP (owner, 2026-10-26: "Verse uses its own tools"): the SEO audit, readability and contrast it runs on its own pages
test('mcp: seo_audit, readability and colour_contrast answer from the libraries Verse runs on itself', async () => {
  const call = async (name, args) => (await rpc({ jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name, arguments: args } })).result;
  const page = '<html lang="en"><head><title>Pricing for small teams · Example</title><meta name="description" content="What it costs, what you get and how to cancel, in plain words for small teams."><link rel="canonical" href="https://a-to-mind.com/x/"></head><body><h1>A</h1><h1>B</h1><a href="/y/">y</a></body></html>';
  const a = await call('seo_audit', { html: page, path: '/pricing/' });
  assert.ok(!a.isError); const kinds = a.structuredContent.defects.map((d) => d.kind);
  assert.ok(kinds.includes('canonical') && kinds.includes('h1') && kinds.includes('share'), kinds.join());
  assert.deepEqual(a.structuredContent.internal_links, ['/y/']);
  assert.ok((await call('seo_audit', {})).isError);
  const r = await call('readability', { text: 'The cat sat on the the mat. it was warm.' });
  assert.ok(r.structuredContent.grade < 5 && r.structuredContent.proofread.includes('doubled word'), r.content[0].text);
  const c = await call('colour_contrast', { text: 'black', background: '#ffffff' });
  assert.equal(c.structuredContent.ratio, 21); assert.equal(c.structuredContent.aaa, true);
  assert.ok((await call('colour_contrast', { text: 'nope', background: 'white' })).isError);
});

test('mcp: the Server Card (SEP-2127) at /api/mcp/server-card matches the v1 schema, server.json and the live endpoint, and lists no tools', async () => {
  const { serverCard, CARD_SCHEMA, SERVER } = await import('../void-live-deploy/lib/mcp.js');
  const { onRequestGet: cardGet } = await import('../void-live-deploy/functions/api/mcp/server-card.js');
  const res = cardGet();
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /^application\/json/);
  const card = await res.json();
  assert.deepEqual(card, serverCard());
  assert.equal(card.$schema, CARD_SCHEMA);
  assert.equal(CARD_SCHEMA, 'https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json');
  assert.match(card.name, /^[^/]+\/[^/]+$/, 'exactly one slash between namespace and name');
  assert.ok(card.name.length >= 3 && card.name.length <= 200);
  assert.ok(card.description.length >= 1 && card.description.length <= 100, 'description is 1 to 100 characters');
  assert.ok(card.title.length >= 1 && card.title.length <= 100);
  assert.match(card.version, /^\d+\.\d+\.\d+$/);
  assert.equal(card.version, SERVER.version, 'the card version is the one initialize reports');
  const registry = JSON.parse(readFileSync(new URL('../server.json', import.meta.url), 'utf8'));
  assert.equal(card.name, registry.name, 'the same identity as the registry entry');
  assert.deepEqual(card.repository, registry.repository);
  assert.equal(card.remotes.length, 1);
  assert.equal(card.remotes[0].type, 'streamable-http');
  assert.equal(card.remotes[0].url, registry.remotes[0].url, 'the endpoint the registry names');
  assert.deepEqual(card.remotes[0].supportedProtocolVersions, [PROTOCOL]);
  for (const k of ['tools', 'resources', 'prompts', 'capabilities']) assert.ok(!(k in card), 'a card carries no ' + k);
  const allowed = new Set(['$schema', 'name', 'version', 'description', 'title', 'websiteUrl', 'repository', 'icons', 'remotes', '_meta']);
  for (const k of Object.keys(card)) assert.ok(allowed.has(k), 'not a Server Card field: ' + k);
  assert.ok(readFileSync(new URL('../void-live-deploy/icon-512.png', import.meta.url)).length > 0, 'the icon is a file the site serves');
});
