// The owner workshop, as MCP. Every tool calls something Verse already has (the route wires the handlers).
// A stranger gets nothing: the route checks the owner before it calls rpc.
export const SERVER = { name: 'verse-workshop', title: 'Verse workshop', version: '1.0.0' };
const schema = (props, required) => ({ type: 'object', properties: props, required: required || [] });
const str = { type: 'string' };

export const TOOLS = Object.freeze([
  { name: 'web_search', description: 'Search the public web through Wikipedia. Titles and links only.', inputSchema: schema({ q: str }, ['q']) },
  { name: 'web_fetch', description: 'Fetch one public https page as text, size capped. Private hosts are refused.', inputSchema: schema({ url: str }, ['url']) },
  { name: 'page_check', description: 'Read the latest self-check for a Verse page, and whether the stranger gate has a say.', inputSchema: schema({ path: str }, ['path']) },
  { name: 'run_tests', description: 'Queue one test file from the closed list. It does not run a shell command from the request.', inputSchema: schema({ file: str }, ['file']) },
  { name: 'propose_change', description: 'Propose files for the self-build runner. The runner applies them to a copy and tests before any commit.', inputSchema: schema({ files: { type: 'array' } }, ['files']) },
  { name: 'searches', description: 'Read the router log of what visitors asked. Already redacted. Owner only.', inputSchema: schema({}) },
  { name: 'growth_stats', description: 'Read the growth loop board: picks, pass rate, levers and cost.', inputSchema: schema({}) },
  { name: 'image_pick', description: 'Pick a public photo for a subject from the picture finder the answer pages use.', inputSchema: schema({ title: str }, ['title']) },
  { name: 'image_make', description: 'Paint one picture through the existing image route, under that route\'s own caps.', inputSchema: schema({ prompt: str }, ['prompt']) },
  { name: 'deploy_status', description: 'Read deploy health from the status guards and the latest self-check.', inputSchema: schema({}) },
  { name: 'rollback', description: 'Queue a rollback through the existing live-revert path. It does not force-push.', inputSchema: schema({ sha: str }) },
  { name: 'cost_log', description: 'Read the growth loop\'s recorded cost. It does not spend.', inputSchema: schema({}) },
]);

const ok = (id, result) => ({ jsonrpc: '2.0', id, result });
const err = (id, code, message) => ({ jsonrpc: '2.0', id: id === undefined ? null : id, error: { code, message } });
const text = (t, data, isError = false) => ({ content: [{ type: 'text', text: String(t).slice(0, 4000) }], ...(data ? { structuredContent: data } : {}), isError });

export const TEST_FILES = Object.freeze([
  'tools/workshop.test.mjs', 'tools/growth-runner.test.mjs', 'tools/idea-core.test.mjs', 'tools/idea-engine.test.mjs',
]);

/** one JSON-RPC message. ctx holds the handlers the route lends. Null means no reply (a notification). */
export async function rpc(msg, ctx) {
  if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') return err(msg && msg.id, -32600, 'Invalid request');
  const { id, method } = msg;
  const params = msg.params && typeof msg.params === 'object' ? msg.params : {};
  if (id === undefined) return null;
  if (method === 'initialize') return ok(id, { protocolVersion: '2025-06-18', capabilities: { tools: { listChanged: false } }, serverInfo: SERVER, instructions: 'Owner only. These tools call Verse\'s own routes. They do not print secrets.' });
  if (method === 'ping') return ok(id, {});
  if (method === 'tools/list') return ok(id, { tools: TOOLS });
  if (method !== 'tools/call') return err(id, -32601, 'Method not found');
  const name = String(params.name || '');
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) return err(id, -32602, 'Unknown tool');
  const args = params.arguments && typeof params.arguments === 'object' ? params.arguments : {};
  try {
    const out = await run(name, args, ctx || {});
    return ok(id, out);
  } catch (e) {
    return ok(id, text('The tool failed: ' + String(e && e.message || e).slice(0, 160), null, true));
  }
}

async function run(name, a, ctx) {
  if (name === 'web_search') return text(await ctx.search(String(a.q || '').slice(0, 120)));
  if (name === 'web_fetch') return text(await ctx.fetchPage(String(a.url || '')));
  if (name === 'page_check') return text(await ctx.page(String(a.path || '').slice(0, 200)));
  if (name === 'run_tests') {
    const file = String(a.file || '');
    if (!TEST_FILES.includes(file)) return text('That test is not on the closed list.', { files: TEST_FILES }, true);
    return text(await ctx.tests(file));
  }
  if (name === 'propose_change') return text(await ctx.propose(Array.isArray(a.files) ? a.files.slice(0, 8) : []));
  if (name === 'searches') return text(await ctx.searches());
  if (name === 'growth_stats') return text(await ctx.growth());
  if (name === 'image_pick') return text(await ctx.picture(String(a.title || '').slice(0, 120)));
  if (name === 'image_make') return text(await ctx.paint(String(a.prompt || '').slice(0, 400)));
  if (name === 'deploy_status') return text(await ctx.deploy());
  if (name === 'rollback') return text(await ctx.rollback(String(a.sha || '').slice(0, 40)));
  if (name === 'cost_log') return text(await ctx.cost());
  return text('Unknown tool', null, true);
}
