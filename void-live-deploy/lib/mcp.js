// mcp — Void as an MCP server (frontier #6): the JSON-RPC half of functions/api/mcp.js, pure and tested in node
// (tools/mcp.test.mjs). An MCP client POSTs one JSON-RPC message to /api/mcp (the streamable HTTP transport, answered with plain
// JSON, no stream) and lists and calls Void's tools. Every tool is read-only: it computes from what it is given and from Void's own
// tables, writes nothing, calls no model and reaches no other service. /tools.json is the same list, public.
import { quick } from './review-api.js';
import { jde, moonPhase } from './sky-math.js';
import { activeShowers, nextShower } from './showers.js';

export const PROTOCOL = '2025-06-18';
export const SERVER = { name: 'void', title: 'Void (a-to-mind.com)', version: '1.0.0' };
const RO = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const DATE = { type: 'string', description: 'An ISO date or date-time (UTC). Leave it out for now.' };

export const TOOLS = [
  { name: 'review_code', title: 'Review code (instant checks)', annotations: RO,
    description: "Void's instant code review: pattern checks for bugs, risks and style in pasted code or a diff's added lines, in many languages. The same checks a-to-mind.com runs when someone asks Void to review code. No model; the closer read is not included.",
    inputSchema: { type: 'object', properties: { code: { type: 'string', description: 'The code to review (up to 60,000 characters).' }, diff: { type: 'string', description: 'A unified diff instead of code: only the added lines are reviewed, with their line numbers in the new file.' }, lang: { type: 'string', description: 'The language, if known (javascript, python, go, rust, sql, ...).' } } } },
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
const PHASES = [[0.02, 'new moon'], [0.35, 'crescent'], [0.65, 'quarter'], [0.98, 'gibbous'], [1.01, 'full moon']];

const RUN = {
  review_code(a) {
    if (typeof a.code !== 'string' && typeof a.diff !== 'string') return toolError('Give the code to review as "code" (or a unified diff as "diff").');
    const r = quick({ code: a.code, diff: a.diff, lang: typeof a.lang === 'string' ? a.lang : undefined });
    const text = r.findings.length ? r.findings.map((f) => 'line ' + f.line + ' · ' + f.kind + ' · ' + f.message).join('\n') : 'The instant checks found nothing in ' + r.lines + ' line' + (r.lines === 1 ? '' : 's') + '.';
    return toolResult(text, { lang: r.lang, lines: r.lines, findings: r.findings });
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

/** one JSON-RPC message in, its reply out (null for a notification, which gets none) */
export async function rpc(msg) {
  if (!msg || typeof msg !== 'object' || Array.isArray(msg) || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') return err(msg && msg.id, -32600, 'Invalid request: one JSON-RPC 2.0 message');
  const { id, method } = msg, params = (msg.params && typeof msg.params === 'object') ? msg.params : {};
  if (id === undefined) return null; // notifications (notifications/initialized, cancelled) need no reply
  if (method === 'initialize') return ok(id, { protocolVersion: PROTOCOL, capabilities: { tools: { listChanged: false } }, serverInfo: SERVER, instructions: "Void's read-only tools: the instant code review, the moon's phase, the meteor showers. Nothing here writes or calls a model." });
  if (method === 'ping') return ok(id, {});
  if (method === 'tools/list') return ok(id, { tools: TOOLS });
  if (method === 'tools/call') {
    const fn = Object.prototype.hasOwnProperty.call(RUN, params.name) ? RUN[params.name] : null;
    if (!fn) return err(id, -32602, 'Unknown tool: ' + String(params.name).slice(0, 60));
    const args = params.arguments && typeof params.arguments === 'object' && !Array.isArray(params.arguments) ? params.arguments : {};
    try { return ok(id, fn(args)); } catch (_) { return ok(id, toolError('The tool failed on that input.')); }
  }
  return err(id, -32601, 'Method not found: ' + method.slice(0, 60));
}
