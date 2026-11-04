// Verse as an A2A agent (lib/a2a.js, functions/api/a2a.js). Run: node --test tools/a2a.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rpc, agentCard } from '../void-live-deploy/lib/a2a.js';
import { LIMITS } from '../void-live-deploy/lib/guard.js';

const ctx = { answer: async ({ ask }) => ({ status: 200, body: { answer: 'Answer to ' + ask, sources: [{ title: 'W', url: 'https://en.wikipedia.org/wiki/W' }] } }) };

test('a2a: the static card is the generated one and has every field A2A 1.0 requires', () => {
  const card = JSON.parse(readFileSync(new URL('../void-live-deploy/.well-known/agent-card.json', import.meta.url)));
  assert.deepEqual(card, agentCard());
  for (const k of ['name', 'description', 'supportedInterfaces', 'version', 'capabilities', 'defaultInputModes', 'defaultOutputModes', 'skills']) assert.ok(card[k], k);
  const i = card.supportedInterfaces[0]; assert.ok(i.url && i.protocolBinding && i.protocolVersion);
  assert.ok(LIMITS.a2a);
  assert.match(readFileSync(new URL('../void-live-deploy/.well-known/api-catalog', import.meta.url), 'utf8'), /agent-card\.json/);
});

test('a2a: SendMessage (1.0) and message/send (0.3) get ask_void answers in their own shapes', async () => {
  const a = await rpc({ jsonrpc: '2.0', id: 1, method: 'SendMessage', params: { message: { role: 'ROLE_USER', messageId: 'm', contextId: 'c', parts: [{ text: 'what is a star' }] } } }, ctx);
  assert.equal(a.result.message.role, 'ROLE_AGENT'); assert.equal(a.result.message.contextId, 'c'); assert.match(a.result.message.parts[0].text, /Answer to what is a star[\s\S]*Sources/);
  const b = await rpc({ jsonrpc: '2.0', id: 2, method: 'message/send', params: { message: { role: 'user', messageId: 'm', parts: [{ kind: 'text', text: 'hello there' }] } } }, ctx);
  assert.equal(b.result.kind, 'message'); assert.equal(b.result.parts[0].kind, 'text');
});

test('a2a: bad requests are JSON-RPC errors, not answers', async () => {
  assert.equal((await rpc({ jsonrpc: '2.0', id: 3, method: 'tasks/cancel' }, ctx)).error.code, -32601);
  assert.equal((await rpc({ jsonrpc: '2.0', id: 4, method: 'SendMessage', params: { message: { parts: [] } } }, ctx)).error.code, -32602);
  assert.equal((await rpc({ id: 5 }, ctx)).error.code, -32600);
});
