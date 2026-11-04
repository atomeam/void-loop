// a2a — Verse as an A2A (Agent2Agent, v1.0) agent: the JSON-RPC half of functions/api/a2a.js, pure and tested in node
// (tools/a2a.test.mjs). Another agent finds Verse at /.well-known/agent-card.json (IANA-registered, A2A §8.2) and sends it a
// message; Verse answers with one message (no long-running task). The answer is ask_void's (lib/mcp.js): /api/answer on its own
// terms and per-caller limit. Read-only: nothing is sent, spent or remembered from here. Accepts the v1.0 method SendMessage and
// the 0.3 name message/send, and the parts of both shapes ({ text } and { kind: 'text', text }).
import { rpc as mcpRpc } from './mcp.js';

export const A2A_VERSION = '1.0';
export function agentCard(origin = 'https://a-to-mind.com') {
  return {
    name: 'Verse',
    description: "Verse by A-to-Mind: a self-improving agent that answers questions in plain words, citing its sources. Read-only over A2A: it never sends, spends or remembers anything for a caller.",
    version: '1.0.0',
    provider: { organization: 'A-to-Mind', url: origin + '/' },
    documentationUrl: origin + '/llms.txt',
    iconUrl: origin + '/icon-512.png',
    supportedInterfaces: [{ url: origin + '/api/a2a', protocolBinding: 'JSONRPC', protocolVersion: A2A_VERSION }],
    capabilities: { streaming: false, pushNotifications: false },
    defaultInputModes: ['text/plain'],
    defaultOutputModes: ['text/plain'],
    skills: [
      { id: 'ask', name: 'Ask Verse', description: "Ask anything in plain words; Verse answers briefly and lists the pages it drew on.", tags: ['question-answering', 'research'], examples: ['what is a black hole', 'what are you building?'] },
    ],
  };
}

const err = (id, code, message) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });
const textOf = (msg) => (msg && Array.isArray(msg.parts) ? msg.parts : []).map((p) => (p && typeof p.text === 'string' && (!p.kind || p.kind === 'text') ? p.text : '')).join(' ').trim();
let seq = 0;
const newId = () => 'verse-' + Date.now().toString(36) + '-' + (seq++).toString(36);

export async function rpc(msg, ctx) {
  if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') return err(msg && msg.id, -32600, 'Invalid request: send one JSON-RPC 2.0 message');
  const v03 = msg.method === 'message/send';
  if (msg.method === 'GetAgentCard' || msg.method === 'agent/getAuthenticatedExtendedCard') return { jsonrpc: '2.0', id: msg.id, result: agentCard() };
  if (msg.method !== 'SendMessage' && !v03) return err(msg.id, -32601, 'Method not found: Verse takes SendMessage (or message/send)');
  const m = msg.params && msg.params.message;
  const ask = textOf(m);
  if (ask.length < 3) return err(msg.id, -32602, 'Invalid params: send params.message with a text part of 3 or more characters');
  const r = await mcpRpc({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'ask_void', arguments: { ask } } }, ctx);
  const text = (r && r.result && r.result.content && r.result.content[0] && r.result.content[0].text) || 'Verse had no answer just now.';
  const reply = { messageId: newId(), role: v03 ? 'agent' : 'ROLE_AGENT', parts: [v03 ? { kind: 'text', text } : { text }], ...(m.contextId ? { contextId: m.contextId } : {}) };
  return { jsonrpc: '2.0', id: msg.id, result: v03 ? { kind: 'message', ...reply } : { message: reply } };
}
