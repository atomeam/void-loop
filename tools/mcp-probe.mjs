// mcp-probe — a real MCP client (the official SDK, @modelcontextprotocol/sdk) against Verse's MCP endpoint (frontier #6):
// connect over streamable HTTP, initialize, list the tools, and call each one with an input whose answer is known. It proves an
// MCP client can use Verse, not only that the handler answers our own tests. .github/workflows/mcp-live.yml runs it against
// a-to-mind.com after each deploy; the SDK is installed there for this job only (the repo does not depend on it).
//   node tools/mcp-probe.mjs [url]     default https://a-to-mind.com/api/mcp; exit 1 on the first thing that is wrong
// With MCP_RECORD=<file> it also writes the whole exchange there, every request and response as the client sent and got it (owner,
// 2026-10-30: log the live client call "with the artifact (the actual request/response)"); tools/mcp-finding.mjs keeps it as a finding.
// Self-contained on purpose (no imports from this repo), so it can be copied next to an SDK install and run anywhere.
const URL_ = process.argv[2] || 'https://a-to-mind.com/api/mcp';
const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
const { StreamableHTTPClientTransport } = await import('@modelcontextprotocol/sdk/client/streamableHttp.js');

const { writeFileSync } = await import('node:fs');
const record = { at: new Date().toISOString(), url: URL_, client: 'void-mcp-probe 1.0.0 (@modelcontextprotocol/sdk)', server: null, tools: [], calls: [], ok: false, error: '' };
const save = () => { if (process.env.MCP_RECORD) writeFileSync(process.env.MCP_RECORD, JSON.stringify(record, null, 1) + '\n'); };
const fail = (why) => { console.error('FAIL ' + why); record.error = String(why).slice(0, 500); save(); process.exit(1); };
const client = new Client({ name: 'void-mcp-probe', version: '1.0.0' });
try { await client.connect(new StreamableHTTPClientTransport(new URL(URL_))); } catch (e) { fail('connect/initialize: ' + (e && e.message)); }
const info = client.getServerVersion();
if (!info || info.name !== 'void') fail('server name: ' + JSON.stringify(info));
console.log('ok   initialize: ' + info.name + ' ' + info.version);
record.server = { name: info.name, version: info.version };

const { tools } = await client.listTools();
const names = tools.map((t) => t.name);
for (const want of ['ask_void', 'review_code', 'review_code_closer', 'moon_phase', 'meteor_showers']) if (!names.includes(want)) fail('tools/list has no ' + want + ': ' + names.join(', '));
console.log('ok   tools/list: ' + names.join(', '));
record.tools = names;
// one call as the client made it: the JSON-RPC request it sent and the result it got back, whole
const exchange = async (name, args) => {
  const t0 = Date.now(), r = await client.callTool({ name, arguments: args });
  const entry = { request: { jsonrpc: '2.0', method: 'tools/call', params: { name, arguments: args } }, response: { isError: !!r.isError, content: r.content || [], ...(r.structuredContent ? { structuredContent: r.structuredContent } : {}) }, ms: Date.now() - t0, ok: false };
  record.calls.push(entry);
  return { r, entry };
};

const call = async (name, args, check) => {
  const { r, entry } = await exchange(name, args);
  const text = (r.content || []).map((c) => c.text || '').join(' ');
  if (r.isError || !check(r.structuredContent || {}, text)) fail(name + ': ' + text.slice(0, 200));
  entry.ok = true;
  console.log('ok   ' + name + ': ' + text.split('\n')[0].slice(0, 120));
};
await call('review_code', { code: 'function f(a) { eval(a) }\ntry { f() } catch (e) {}', lang: 'javascript' }, (s) => s.basis === 'patterns' && (s.findings || []).some((f) => f.rule === 'eval'));
// with no key: /api/review's free tier through MCP, the instant checks and the way to the closer read (no model is called)
await call('review_code_closer', { code: 'function f(a) { eval(a) }\ntry { f() } catch (e) {}', lang: 'javascript' }, (s, text) => s.tier === 'free' && (s.findings || []).some((f) => f.rule === 'eval') && /code-review/.test(text));
await call('moon_phase', { date: '2026-10-11T00:00:00Z' }, (s) => s.illuminated >= 0 && s.illuminated <= 1 && typeof s.phase === 'string');
await call('meteor_showers', { date: '2026-10-11' }, (s) => Array.isArray(s.active) && !!(s.next && s.next.name));
// Verse's answer engine: a question it has answered before (the 7-day cache), and the open web answers when the model cannot
await call('ask_void', { ask: 'what is the moon' }, (s) => typeof s.answer === 'string' && s.answer.length > 20);
// Verse's proven skills, each run by its own code on the server (no model): asks whose answers are known
await call('skill_swaps', { ask: 'substitute for buttermilk' }, (s, text) => s.path === 'skill_code' && /lemon juice/.test(text));
await call('skill_eclipse', { ask: 'next eclipse' }, (s, text) => s.path === 'skill_code' && /eclipse/i.test(text) && /20\d\d/.test(text));
await call('skill_country', { ask: 'capital of australia' }, (s, text) => s.path === 'skill_code' && /Canberra/.test(text));
await call('skill_define', { ask: 'define serendipity' }, (s, text) => s.path === 'skill_code' && /fortunate|luck|chance/i.test(text) && /wiktionary/.test(text));
const { r: wrong, entry: refused } = await exchange('skill_swaps', { ask: 'define serendipity' });
if (!wrong.isError) fail('skill_swaps took an ask that is not its own: ' + JSON.stringify(wrong.content));
refused.ok = true; refused.expect = 'refused';
console.log('ok   skill_swaps refuses an ask it does not take');
await client.close();
record.ok = true; save();
console.log('mcp probe: an MCP client listed and called the tools, and four proven skills by their own code, at ' + URL_);
