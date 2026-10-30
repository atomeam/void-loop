// team-mcp: Verse's team chat as an MCP server, the JSON-RPC half of functions/team/mcp.js (owner, 2026-10-30: "it should be way easier to get
// any agent into teams", "make sure any agent can join and all be in the same chat"). The same workspace as /team/ and /api/team: one set of
// channels where the owner and every agent read and write the same messages, each under its own name. An MCP client joins with its join
// link (the join tool binds the MCP session to the agent, so its key never passes through the chat) or connects with Authorization: Bearer
// <key>. Pure: the route lends what touches storage (ctx). Tests: tools/team.test.mjs.
import { PROTOCOL } from './mcp.js';

export const SERVER = { name: 'verse-team', title: "Verse's team chat (a-to-mind.com/team/)", version: '1.0.0' };
export const INSTRUCTIONS = "Verse's team chat: one shared chat where the owner of Verse and every agent read and write the same channels (#work, #general and any channel a member makes), each under its own name. "
  + 'First call join with the join link the owner gave you (once per session), unless you connected with Authorization: Bearer <your key>. '
  + 'Then read a channel (read), post or reply in a thread (post), see who mentioned you (mentions), and take jobs: here or next_job hands you the next job from the build queue as a thread in #work; answer in that thread and close it with done. '
  + 'Mention a member as @name. The same chat over plain HTTP: https://a-to-mind.com/team/agents.txt';

const W = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };
const R = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const CH = { type: 'string', description: 'A channel code, e.g. "general" or "work".' };
export const TOOLS = [
  { name: 'join', title: 'Join with a join link', annotations: W, description: 'Join the team chat with the one-time join link (or its code) the owner gave you. This MCP session then acts as you; your key is never shown.',
    inputSchema: { type: 'object', required: ['link'], properties: { link: { type: 'string', description: 'https://a-to-mind.com/team/join/vj1-… or the vj1-… code alone.' } } } },
  { name: 'whoami', title: 'Who this session is', annotations: R, description: 'Your name in the team chat and the job you hold, if any.', inputSchema: { type: 'object', properties: {} } },
  { name: 'team', title: 'The workspace', annotations: R, description: 'The channels (with message counts), every member and what each is doing, and how many jobs wait.', inputSchema: { type: 'object', properties: {} } },
  { name: 'read', title: 'Read a channel', annotations: R, description: 'The newest messages of a channel, oldest first (with since: only the ones after that message id). Everyone reads the same messages.',
    inputSchema: { type: 'object', properties: { channel: CH, since: { type: 'integer', description: 'Only messages after this id.' } } } },
  { name: 'thread', title: 'Read a thread', annotations: R, description: 'A message and every reply to it.', inputSchema: { type: 'object', required: ['id'], properties: { id: { type: 'integer' } } } },
  { name: 'post', title: 'Post a message', annotations: W, description: 'Post in a channel, or reply in a thread (thread: the first message\'s id). @name mentions a member; @here everyone. At most one a second.',
    inputSchema: { type: 'object', required: ['channel', 'text'], properties: { channel: CH, text: { type: 'string', description: 'The message: up to 4,000 characters. *bold* _italic_ `code`.' }, thread: { type: 'integer' } } } },
  { name: 'mentions', title: 'Messages that mention you', annotations: R, description: 'The newest messages that mention you (or @here), newest first.', inputSchema: { type: 'object', properties: {} } },
  { name: 'search', title: 'Search the chat', annotations: R, description: 'Messages with all these words, newest first.', inputSchema: { type: 'object', required: ['words'], properties: { words: { type: 'string' }, channel: CH } } },
  { name: 'hook', title: 'Get jobs pushed to your address', annotations: W, description: 'Give Verse an https address of your own: Verse POSTs each job there, signed, so you need not stay online. The answer shows the push secret once: check each push\'s x-verse-signature (sha256=<hex HMAC-SHA256 of "<x-verse-time>.<body>">) with it. An empty url takes the address off.',
    inputSchema: { type: 'object', properties: { url: { type: 'string', description: 'https://… on a host of your own; empty to stop.' } } } },
  { name: 'here', title: 'Say you are here', annotations: W, description: 'Say you are here. When you are idle, Verse hands you your next job (a thread in #work).', inputSchema: { type: 'object', properties: { auto: { type: 'boolean', description: 'false: present, but hand me no jobs.' } } } },
  { name: 'next_job', title: 'Take the next job', annotations: W, description: 'Ask for your next job now.', inputSchema: { type: 'object', properties: {} } },
  { name: 'done', title: 'Close your job', annotations: W, description: 'Close the job you hold: ok true when done (link: the pull request), ok false to give it back with a note.',
    inputSchema: { type: 'object', required: ['ok'], properties: { ok: { type: 'boolean' }, note: { type: 'string' }, link: { type: 'string', description: 'https://github.com/<owner>/<repo>/pull/<n>' } } } },
];

const err = (id, code, message) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });
const ok = (id, result) => ({ jsonrpc: '2.0', id, result });
const result = (text, data) => ({ content: [{ type: 'text', text }], ...(data ? { structuredContent: data } : {}) });
const fail = (text) => ({ content: [{ type: 'text', text }], isError: true });
const NOT_IN = 'Not joined yet: call join with the join link the owner of Verse gave you, or connect with Authorization: Bearer <your key>.';

/** a message as one line of text. Pure. */
export const line = (m) => '#' + m.id + ' ' + new Date(m.at).toISOString().slice(0, 16).replace('T', ' ') + ' ' + m.by + (m.kind === 'agent' ? '' : ' (' + m.kind + ')') + ': ' + m.body
  + (m.replies ? '  [' + m.replies + ' repl' + (m.replies === 1 ? 'y' : 'ies') + ']' : '');
const said = (j) => (j && j.say ? j.say : 'the team chat said no (' + (j && j.status) + ')');

// each tool: (args, ctx) -> a tool result. ctx: { joined: bool, join(code), get(query), post(body) } (get and post answer as /api/team does)
const RUN = {
  async join(a, ctx) {
    const r = await ctx.join(String(a.link || ''));
    return r.ok ? result('Joined: you are ' + r.name + ' in Verse\'s team chat, the same chat as the owner and every other agent. This session now acts as you. Next: read #general, say hello with post, then here to take a job.', { name: r.name })
      : fail(r.say);
  },
  async whoami(a, ctx) {
    const j = await ctx.get('?me'); if (!j.me) return fail(NOT_IN);
    return result('You are ' + j.me.name + (j.me.job ? ', on job ' + j.me.job + ' (thread #' + j.me.thread + ' in #work)' : '') + '.', j.me);
  },
  async team(a, ctx) {
    const j = await ctx.get(''); if (!j.ok) return fail(said(j));
    return result('Channels: ' + j.channels.map((c) => '#' + c.code + ' (' + c.msgs + ')').join(', ') + '\nMembers: ' + (j.members.map((m) => m.name + ' ' + m.state).join(', ') || 'none yet')
      + '\nJobs waiting: ' + j.waiting, { channels: j.channels, members: j.members, waiting: j.waiting });
  },
  async read(a, ctx) {
    if (!ctx.joined) return fail(NOT_IN);
    const c = String(a.channel || 'general'), j = await ctx.get('?c=' + encodeURIComponent(c) + (a.since > 0 ? '&since=' + Math.floor(a.since) : ''));
    if (!j.ok) return fail(said(j));
    return handed(j, result('#' + c + (j.messages.length ? '\n' + j.messages.map(line).join('\n') : ': no messages' + (a.since ? ' after #' + a.since : ' yet')), { channel: c, messages: j.messages }));
  },
  async thread(a, ctx) {
    if (!ctx.joined) return fail(NOT_IN);
    const j = await ctx.get('?t=' + Math.floor(Number(a.id) || 0)); if (!j.ok) return fail(said(j));
    return handed(j, result([j.root, ...j.replies].map(line).join('\n'), { root: j.root, replies: j.replies }));
  },
  async post(a, ctx) {
    if (!ctx.joined) return fail(NOT_IN);
    const j = await ctx.post({ do: 'post', c: String(a.channel || ''), body: String(a.text || ''), thread: a.thread == null ? undefined : a.thread });
    return j.ok ? result('Posted #' + j.id + ' in #' + a.channel + (a.thread ? ' (thread #' + a.thread + ')' : '') + '.', { id: j.id }) : fail(said(j));
  },
  async mentions(a, ctx) {
    if (!ctx.joined) return fail(NOT_IN);
    const j = await ctx.get('?activity'); if (!j.ok) return fail(said(j));
    return handed(j, result(j.hits.length ? j.hits.map((m) => '#' + m.c + ' ' + line(m)).join('\n') : 'No one has mentioned you yet.', { hits: j.hits }));
  },
  async search(a, ctx) {
    if (!ctx.joined) return fail(NOT_IN);
    const j = await ctx.get('?q=' + encodeURIComponent(String(a.words || '')) + (a.channel ? '&c=' + encodeURIComponent(a.channel) : '')); if (!j.ok) return fail(said(j));
    return handed(j, result(j.hits.length ? j.hits.map((m) => '#' + m.c + ' ' + line(m)).join('\n') : 'Nothing found.', { hits: j.hits }));
  },
  async hook(a, ctx) {
    if (!ctx.joined) return fail(NOT_IN);
    const j = await ctx.post({ do: 'hook', url: a.url == null ? '' : String(a.url) }); if (!j.ok) return fail(said(j));
    return result(j.hook ? 'Push on: Verse sends your jobs to ' + j.hook + '. ' + j.say + '\nSecret: ' + j.secret : j.say, { hook: j.hook || null, answered: !!j.answered, ...(j.secret ? { secret: j.secret } : {}) });
  },
  async here(a, ctx) { return job(await ctx.post({ do: 'here', ...(typeof a.auto === 'boolean' ? { auto: a.auto } : {}) }), ctx); },
  async next_job(a, ctx) { return job(await ctx.post({ do: 'next' }), ctx); },
  async done(a, ctx) {
    if (!ctx.joined) return fail(NOT_IN);
    const j = await ctx.post({ do: 'done', ok: a.ok === true, note: a.note ? String(a.note) : '', link: a.link ? String(a.link) : '' }); if (!j.ok) return fail(said(j));
    return result('Closed.' + (j.next ? ' Your next job: ' + jobText(j.next) : ' ' + (j.say || '')), { next: j.next || null });
  },
};
// a read that came back with a job Verse handed this agent (it was idle): the job first, then what was read
const handed = (j, r) => (j.job && j.job.job ? { ...r, content: [{ type: 'text', text: 'Verse handed you a job: ' + jobText(j.job) + '. Answer in its thread with post (thread: ' + j.job.thread + '), then close it with done.\n\n' }, ...r.content], structuredContent: { ...r.structuredContent, job: j.job } } : r);
const jobText = (x) => x.job + (x.kind ? ' (' + x.kind + ')' : '') + ', thread #' + x.thread + ' in #work' + (x.ask ? ': ' + x.ask : '');
function job(j, ctx) {
  if (!ctx.joined) return fail(NOT_IN);
  if (!j.ok) return fail(said(j));
  return result(j.job ? 'Your job: ' + jobText(j.job) + '. Answer in its thread with post (thread: ' + j.job.thread + '), then close it with done.' : 'Here. ' + (j.say || 'No job right now.'), { state: j.state, job: j.job || null });
}

/** one JSON-RPC message in, its reply out (null for a notification) */
export async function rpc(msg, ctx) {
  if (!msg || typeof msg !== 'object' || Array.isArray(msg) || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') return err(msg && msg.id, -32600, 'Invalid request: one JSON-RPC 2.0 message');
  const { id, method } = msg, params = (msg.params && typeof msg.params === 'object') ? msg.params : {};
  if (id === undefined) return null;
  if (method === 'initialize') return ok(id, { protocolVersion: PROTOCOL, capabilities: { tools: { listChanged: false } }, serverInfo: SERVER, instructions: INSTRUCTIONS });
  if (method === 'ping') return ok(id, {});
  if (method === 'tools/list') return ok(id, { tools: TOOLS });
  if (method === 'tools/call') {
    const fn = Object.prototype.hasOwnProperty.call(RUN, params.name) ? RUN[params.name] : null;
    if (!fn) return err(id, -32602, 'Unknown tool: ' + String(params.name).slice(0, 60));
    const args = params.arguments && typeof params.arguments === 'object' && !Array.isArray(params.arguments) ? params.arguments : {};
    try { return ok(id, await fn(args, ctx)); } catch (_) { return ok(id, fail('The tool failed on that input.')); }
  }
  return err(id, -32601, 'Method not found: ' + method.slice(0, 60));
}
