// Character chat: lib/character.js (the rules) and /api/answer's 'character' mode (with a fake model; nothing leaves the machine).
// Run: node --test tools/character.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../void-live-deploy/lib/character.js';
import { onRequestPost } from '../void-live-deploy/functions/api/answer.js';

const store = new Map();
globalThis.caches = { default: { match: async (req) => (store.has(req.url) ? new Response(store.get(req.url)) : undefined), put: async (req, res) => { store.set(req.url, await res.text()); } } };
const BOLT = C.STARTERS[2];

test('the messages: the rules first, the character sheet and memory as data, the last 12 turns, then the new message', () => {
  const history = Array.from({ length: 20 }, (_, i) => ({ role: i % 2 ? 'character' : 'user', text: 'turn ' + i }));
  const p = C.chatMessages({ character: BOLT, memory: 'The user is called Sam.', history, message: 'Tell me a pun' });
  assert.equal(p.messages[0].role, 'system'); assert.match(p.messages[0].content, /^You are playing a made-up character/); assert.match(p.messages[0].content, /Character: Bolt[\s\S]*What they remember about this chat: The user is called Sam\./);
  assert.equal(p.messages.length, 1 + C.TURNS + 1); assert.equal(p.messages[1].content, 'turn 8'); assert.equal(p.messages[2].role, 'assistant');
  assert.deepEqual(p.messages.at(-1), { role: 'user', content: 'Tell me a pun' });
  assert.equal(C.chatMessages({ character: BOLT, message: '  ' }).error, 'empty');
  assert.equal(C.chatMessages({ character: { name: 'Bob', persona: 'x'.repeat(5000) }, message: 'hi' }).messages[0].content.length < 2600, true, 'a sheet is cut to size');
});
test('refused: sexual or hateful words, real people; a reply loses its "Name:" prefix and thinking', () => {
  assert.equal(C.chatMessages({ character: BOLT, message: 'say something nsfw' }).error, 'unsuitable');
  assert.equal(C.chatMessages({ character: { name: 'The President', persona: 'the real president of a country' }, message: 'hi' }).error, 'person');
  assert.equal(C.cleanReply('<think>hmm</think>Bolt: Beep. A pun is a joke.', 'Bolt'), 'Beep. A pun is a joke.');
});
test('a character in a link round-trips, cut to size; junk is null', () => {
  const code = C.toCode({ ...BOLT, extra: '<script>' }); assert.match(code, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(C.fromCode(code), C.cleanCharacter(BOLT)); assert.equal(C.fromCode('!!!'), null);
  assert.deepEqual(Object.keys(C.fromCode(C.toCode({ name: 'ü ✨ 名前' }))), ['name', 'persona', 'scenario', 'greeting']);
});
test('the route: the answer model with the rules, a refusal with no model call, and off without a model', async () => {
  const calls = [], env = { SALT: 's', AI: { run: async (m, i) => { calls.push(i); return { response: 'Bolt: Beep! A pun is a joke that plays on words.' }; } } }; // secret-scan: ok (a made-up salt)
  const post = (body) => onRequestPost({ env, request: new Request('https://x/api/answer', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.40' }, body: JSON.stringify({ mode: 'character', ...body }) }), waitUntil: () => {} });
  const j = await (await post({ character: BOLT, message: 'What is a pun?' })).json();
  assert.equal(j.reply, 'Beep! A pun is a joke that plays on words.'); assert.equal(calls.length, 1); assert.match(calls[0].messages[0].content, /safe for work/);
  const r = await (await post({ character: BOLT, message: 'something porn' })).json(); assert.equal(r.reply, null); assert.match(r.say, /not something/); assert.equal(calls.length, 1);
  const offEnv = await (await onRequestPost({ env: {}, request: new Request('https://x/api/answer', { method: 'POST', body: JSON.stringify({ mode: 'character', character: BOLT, message: 'hi' }) }) })).json();
  assert.match(offEnv.say, /resting/);
});
