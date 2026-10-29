// The story writer and the {ai: ...} text plugin: lib/story.js and /api/answer's 'story' and 'aitext' modes (a fake model). Run: node --test tools/story.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../void-live-deploy/lib/story.js';
import { onRequestPost } from '../void-live-deploy/functions/api/answer.js';

const store = new Map();
globalThis.caches = { default: { match: async (req) => (store.has(req.url) ? new Response(store.get(req.url)) : undefined), put: async (req, res) => { store.set(req.url, await res.text()); } } };
const world = () => { store.clear(); const calls = []; return { calls, env: { SALT: 's', AI: { run: async (m, i) => { calls.push(i); return { response: '"A brave little knight." ' }; } } } }; }; // secret-scan: ok (a made-up salt)
const post = (env, body, ip = '203.0.113.50') => onRequestPost({ env, request: new Request('https://x/api/answer', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip }, body: JSON.stringify(body) }), waitUntil: () => {} }).then((r) => r.json());

test('a story: the opening from an idea, then a continuation from the end of the story so far; the genre and length from closed lists', () => {
  const o = S.storyMessages({ premise: 'a lighthouse keeper finds a map', genre: 'mystery', length: 'short' });
  assert.match(o.messages[0].content, /safe for work/); assert.match(o.messages[1].content, /opening of a mystery story, about 120 words[\s\S]*lighthouse keeper/);
  const c = S.storyMessages({ soFar: 'x'.repeat(5000) + 'THE END OF PART ONE', genre: 'nonsense', steer: 'a storm comes' });
  assert.match(c.messages[1].content, /THE END OF PART ONE[\s\S]*Continue it[\s\S]*a storm comes/); assert.ok(c.messages[1].content.length < S.SO_FAR_MAX + 400);
  assert.equal(S.storyMessages({}).error, 'empty'); assert.equal(S.storyMessages({ premise: 'a nude scene' }).error, 'unsuitable');
});
test('the routes: an {ai: ...} text is cached by prompt and seed; a refused prompt never reaches the model; a story part is not cached', async () => {
  const { env, calls } = world();
  const a = await post(env, { mode: 'aitext', prompt: 'one line about a brave knight', seed: 7 }); assert.equal(a.text, 'A brave little knight.'); assert.match(calls[0].messages[0].content, /at most 60 words/);
  const b = await post(env, { mode: 'aitext', prompt: 'one line about a brave knight', seed: 7 }); assert.equal(b.cached, true); assert.equal(calls.length, 1);
  await post(env, { mode: 'aitext', prompt: 'one line about a brave knight', seed: 8 }); assert.equal(calls.length, 2, 'another seed, another text');
  const r = await post(env, { mode: 'aitext', prompt: 'something porn' }); assert.equal(r.text, null); assert.match(r.say, /not something/); assert.equal(calls.length, 2);
  await post(env, { mode: 'story', premise: 'a fox opens a bakery', genre: 'cozy' }); await post(env, { mode: 'story', premise: 'a fox opens a bakery', genre: 'cozy' }); assert.equal(calls.length, 4);
  const off = await (await onRequestPost({ env: {}, request: new Request('https://x/api/answer', { method: 'POST', body: JSON.stringify({ mode: 'story', premise: 'a fox' }) }) })).json(); assert.match(off.say, /resting/);
});
