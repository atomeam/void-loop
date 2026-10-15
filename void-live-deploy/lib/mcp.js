// mcp — Void as an MCP server (frontier #6): the JSON-RPC half of functions/api/mcp.js, pure and tested in node
// (tools/mcp.test.mjs). An MCP client POSTs one JSON-RPC message to /api/mcp (the streamable HTTP transport, answered with plain
// JSON, no stream) and lists and calls Void's tools. Every tool is read-only: it computes from what it is given and from Void's own
// tables and reaches no other service, except ask_void, which is /api/answer itself (the route hands it over, ctx.answer: the open
// web and the model, on that endpoint's terms and limits). One, review_code_closer, is /api/review itself (the route hands it over, ctx.review): the
// closer read by a model comes only with the key that endpoint takes, on its terms, and the only thing written is that key's daily
// count. /tools.json is the same list, public.
import { quick } from './review-api.js';
import { jde, moonPhase } from './sky-math.js';
import { activeShowers, nextShower } from './showers.js';

export const PROTOCOL = '2025-06-18';
export const SERVER = { name: 'void', title: 'Void (a-to-mind.com)', version: '1.1.0' };
const RO = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
// what shape an agent wants back (asked by Void, ask-20261014-1722-1): 'text' (default: the words, sources listed) or 'raw_data'
// (the structured result as JSON text). 'image' is named so an agent learns it is not offered yet, rather than guessing.
const RESPONSE_TYPE = { type: 'string', enum: ['text', 'raw_data', 'image'], description: "What to get back: 'text' (default) or 'raw_data' (the structured result as JSON). 'image' is not offered yet." };
export function shaped(result, type) {
  if (!result || result.isError || !type || type === 'text') return result;
  if (type === 'raw_data') return { ...result, content: [{ type: 'text', text: JSON.stringify(result.structuredContent || {}) }] };
  return { content: [{ type: 'text', text: "This tool gives 'text' or 'raw_data'; 'image' is not offered yet." }], isError: true };
}
const DATE = { type: 'string', description: 'An ISO date or date-time (UTC). Leave it out for now.' };

export const TOOLS = [
  { name: 'ask_void', title: 'Ask Void anything', annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    description: "Ask Void a question in plain words and get its answer: a short, direct answer from Void's answer engine (a-to-mind.com), citing the Wikipedia pages it drew on when they match. Ask about Void itself (\"what are you building?\") and it answers from its own live facts. Up to 12 model answers a minute per caller; a repeated question may come from the 7-day cache.",
    inputSchema: { type: 'object', required: ['ask'], properties: { ask: { type: 'string', description: 'The question, in plain words (3 to 600 characters).' }, response_type: RESPONSE_TYPE } } },
  { name: 'review_code', title: 'Review code (instant checks)', annotations: RO,
    description: "Void's instant code review: pattern checks for bugs, risks and style in pasted code or a diff's added lines, in many languages. The same checks a-to-mind.com runs when someone asks Void to review code. No model; the closer read is not included. Its structured result says basis 'patterns' and confidence 'low'.",
    inputSchema: { type: 'object', properties: { code: { type: 'string', description: 'The code to review (up to 60,000 characters).' }, diff: { type: 'string', description: 'A unified diff instead of code: only the added lines are reviewed, with their line numbers in the new file.' }, lang: { type: 'string', description: 'The language, if known (javascript, python, go, rust, sql, ...).' } } } },
  { name: 'review_code_closer', title: 'Review code (with the closer read)', annotations: { ...RO, idempotentHint: false },
    description: "Void's code review with the closer read: the instant checks, then an AI reviewer that confirms real findings, drops wrong ones and adds what the patterns missed, each quoting its line. The closer read needs a key in the MCP request's Authorization header (Bearer: a Void Pro review key vr1.… or a Void Code Review Pro license key; https://a-to-mind.com/code-review/#pro). Without one you get the instant checks and how to get it. The structured result says what it rests on: basis 'closer_read' (confidence 'reviewed') only when the closer read came back, else 'patterns' (confidence 'low').",
    inputSchema: { type: 'object', properties: { code: { type: 'string', description: 'The code to review (up to 60,000 characters).' }, diff: { type: 'string', description: 'A unified diff instead of code: the added lines are reviewed.' }, lang: { type: 'string', description: 'The language, if known.' } } } },
  { name: 'moon_phase', title: "The moon's phase", annotations: RO,
    description: "The moon's illuminated fraction, whether it is waxing or waning, and the phase's name for a moment, from Meeus' formulas (Astronomical Algorithms, ch. 47-48).",
    inputSchema: { type: 'object', properties: { date: DATE } } },
  { name: 'meteor_showers', title: 'Meteor showers', annotations: RO,
    description: 'The meteor showers active on a date (strongest first, with days to each peak and the peak rate) and the next peak on or after it, from the IMO calendar of the major showers.',
    inputSchema: { type: 'object', properties: { date: DATE } } },
];

const err = (id, code, message) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });
const ok = (id, result) => ({ jsonrpc: '2.0', id, result });
const toolResult = (text, data) => ({ content: [{ type: 'text', text }], structuredContent: data, isError: false });
const toolError = (text) => ({ content: [{ type: 'text', text }], isError: true });
function when(a) {
  if (a == null || a === '') return new Date();
  const d = new Date(String(a));
  return Number.isNaN(d.getTime()) ? null : d;
}
// what a review rests on (asked by Void): pattern checks alone are low confidence; the closer read is only claimed when its answer came back
const BASIS = {
  patterns: { basis: 'patterns', confidence: 'low', line: 'Basis: pattern checks only, no model. A finding can be a false positive, and finding nothing is not proof the code is right.' },
  closer_read: { basis: 'closer_read', confidence: 'reviewed', line: 'Basis: pattern checks, then an AI reviewer read the code. It can still miss things.' },
};
const based = (text, data, read) => { const b = BASIS[read ? 'closer_read' : 'patterns']; return toolResult(text + '\n\n' + b.line, { ...data, basis: b.basis, confidence: b.confidence }); };
const PHASES = [[0.02, 'new moon'], [0.35, 'crescent'], [0.65, 'quarter'], [0.98, 'gibbous'], [1.01, 'full moon']];

// the closer read: /api/review answers (ctx.review hands it { code | diff, lang } with the caller's Authorization), this words it
async function closer(a, ctx) {
  if (typeof a.code !== 'string' && typeof a.diff !== 'string') return toolError('Give the code to review as "code" (or a unified diff as "diff").');
  if (!ctx || typeof ctx.review !== 'function') return toolError('The closer read is only reachable at https://a-to-mind.com/api/mcp.');
  const args = { ...(typeof a.code === 'string' ? { code: a.code } : { diff: a.diff }), ...(typeof a.lang === 'string' ? { lang: a.lang } : {}) };
  const { status, body } = await ctx.review(args);
  if (!body || status !== 200 || body.ok === false) return toolError('The review said no: ' + String((body && body.error) || 'status ' + status).slice(0, 200));
  const { ok: _ok, ...data } = body;
  const found = (data.findings || []).length ? data.findings.map((f) => 'line ' + f.line + ' · ' + f.kind + ' · ' + f.message).join('\n') : 'The instant checks found nothing in ' + data.lines + ' line' + (data.lines === 1 ? '' : 's') + '.';
  const more = data.answer ? '\n\nCloser read:\n' + data.answer : data.note || data.upgrade ? '\n\n' + [data.note, data.upgrade].filter(Boolean).join(' ') : '';
  return based(found + more, data, data.review === 'model' && !!data.answer);
}

// ask_void: /api/answer answers (ctx.answer hands it { ask } with the caller's connection, so its per-caller limit holds), this words it
async function askVoid(a, ctx) {
  const ask = typeof a.ask === 'string' ? a.ask.trim().slice(0, 600) : '';
  if (ask.length < 3) return toolError('Give the question as "ask", in plain words.');
  if (!ctx || typeof ctx.answer !== 'function') return toolError('Asking Void is only reachable at https://a-to-mind.com/api/mcp.');
  const { status, body } = await ctx.answer({ ask });
  if (status === 429) return toolError('Slow down: Void answers up to 12 questions a minute per caller. Try again in a minute.');
  if (!body || !body.answer) return toolError('Void had no answer for that just now' + (body && body.note ? ' (' + String(body.note).slice(0, 160) + ')' : '') + '. Rephrase it, or try again in a moment.');
  const sources = (body.sources || []).map(({ title, url }) => ({ title, url }));
  const text = body.answer + (sources.length ? '\n\nSources:\n' + sources.map((x) => '- ' + x.title + ': ' + x.url).join('\n') : '');
  return toolResult(text, { answer: body.answer, sources, at: body.at || null, cached: !!body.cached });
}

const RUN = {
  ask_void: askVoid,
  review_code_closer: closer,
  review_code(a) {
    if (typeof a.code !== 'string' && typeof a.diff !== 'string') return toolError('Give the code to review as "code" (or a unified diff as "diff").');
    const r = quick({ code: a.code, diff: a.diff, lang: typeof a.lang === 'string' ? a.lang : undefined });
    const text = r.findings.length ? r.findings.map((f) => 'line ' + f.line + ' · ' + f.kind + ' · ' + f.message).join('\n') : 'The instant checks found nothing in ' + r.lines + ' line' + (r.lines === 1 ? '' : 's') + '.';
    return based(text, { lang: r.lang, lines: r.lines, findings: r.findings }, false);
  },
  moon_phase(a) {
    const d = when(a.date); if (!d) return toolError('That date could not be read; use ISO, like 2026-10-11 or 2026-10-11T21:00:00Z.');
    const p = moonPhase(jde(d)), name = PHASES.find(([x]) => p.fraction < x)[1];
    const phase = name === 'new moon' || name === 'full moon' ? name : (p.waxing ? 'waxing ' : 'waning ') + (name === 'quarter' ? (p.waxing ? 'first quarter' : 'last quarter') : name);
    const out = { date: d.toISOString(), illuminated: Math.round(p.fraction * 1000) / 1000, waxing: p.waxing, phase };
    return toolResult(Math.round(p.fraction * 100) + '% lit, ' + phase + ' (' + out.date + ').', out);
  },
  meteor_showers(a) {
    const d = when(a.date); if (!d) return toolError('That date could not be read; use ISO, like 2026-10-11.');
    const active = activeShowers(d).map(({ name, zhr, daysToPeak, note }) => ({ name, zhr, daysToPeak, note }));
    const n = nextShower(d), next = n && { name: n.name, peak: n.date.toISOString().slice(0, 10), zhr: n.zhr, note: n.note };
    const text = (active.length ? 'Active: ' + active.map((s) => s.name + ' (up to ' + s.zhr + ' an hour, peak ' + (s.daysToPeak === 0 ? 'today' : s.daysToPeak > 0 ? 'in ' + s.daysToPeak + ' days' : Math.abs(s.daysToPeak) + ' days ago') + ')').join(', ') + '. ' : 'No major shower is active. ')
      + (next ? 'Next peak: ' + next.name + ' on ' + next.peak + '.' : '');
    return toolResult(text, { date: d.toISOString().slice(0, 10), active, next });
  },
};

/** one JSON-RPC message in, its reply out (null for a notification, which gets none). ctx: what the route lends a tool (ctx.review) */
export async function rpc(msg, ctx) {
  if (!msg || typeof msg !== 'object' || Array.isArray(msg) || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') return err(msg && msg.id, -32600, 'Invalid request: one JSON-RPC 2.0 message');
  const { id, method } = msg, params = (msg.params && typeof msg.params === 'object') ? msg.params : {};
  if (id === undefined) return null; // notifications (notifications/initialized, cancelled) need no reply
  if (method === 'initialize') return ok(id, { protocolVersion: PROTOCOL, capabilities: { tools: { listChanged: false } }, serverInfo: SERVER, instructions: "Void's read-only tools: ask Void anything (ask_void, its answer engine), the instant code review, the closer read (with a key in Authorization), the moon's phase, the meteor showers. ask_void and the closer read call a model." });
  if (method === 'ping') return ok(id, {});
  if (method === 'tools/list') return ok(id, { tools: TOOLS });
  if (method === 'tools/call') {
    const fn = Object.prototype.hasOwnProperty.call(RUN, params.name) ? RUN[params.name] : null;
    if (!fn) return err(id, -32602, 'Unknown tool: ' + String(params.name).slice(0, 60));
    const args = params.arguments && typeof params.arguments === 'object' && !Array.isArray(params.arguments) ? params.arguments : {};
    try { return ok(id, shaped(await fn(args, ctx), args.response_type)); } catch (_) { return ok(id, toolError('The tool failed on that input.')); }
  }
  return err(id, -32601, 'Method not found: ' + method.slice(0, 60));
}
