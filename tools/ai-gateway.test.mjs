import test from 'node:test';
import assert from 'node:assert/strict';
import { FREE_MODEL, PAID_MODEL, GATEWAY_ALIASES } from '../void-live-deploy/lib/models.js';
import { isFreeAllowance, resolveFree, gatewayOptions, runFree, EVALUATED } from '../void-live-deploy/lib/ai-gateway.js';

test('free aliases resolve, and Kimi and Gemini stay off the free path', () => {
  assert.equal(resolveFree('verse-answer'), FREE_MODEL);
  assert.equal(resolveFree('verse-fallback'), GATEWAY_ALIASES['verse-fallback']);
  assert.equal(isFreeAllowance(FREE_MODEL), true);
  assert.equal(isFreeAllowance(PAID_MODEL), false);
  assert.equal(resolveFree('@cf/moonshotai/kimi-k2.6'), null);
  assert.equal(resolveFree('google/gemini-3-flash'), null);
  assert.equal(resolveFree('dynamic/verse-answer'), null);
  for (const row of EVALUATED) assert.equal(row.free, false, row.name);
});

test('the gateway third argument is sent only for a free model when an id is set', async () => {
  assert.equal(gatewayOptions({}, FREE_MODEL), null);
  assert.equal(gatewayOptions({ AI_GATEWAY_ID: 'verse' }, PAID_MODEL), null);
  assert.deepEqual(gatewayOptions({ AI_GATEWAY_ID: 'verse' }, FREE_MODEL), { gateway: { id: 'verse' } });
  const calls = [];
  const env = { AI_GATEWAY_ID: 'verse', AI: { run: async (...a) => { calls.push(a); return { ok: 1 }; } } };
  assert.equal((await runFree(env, 'verse-answer', { messages: [] })).ok, 1);
  assert.equal(calls[0][0], FREE_MODEL);
  assert.deepEqual(calls[0][2], { gateway: { id: 'verse' } });
  const bare = { AI: { run: async (...a) => { calls.push(a); return { ok: 2 }; } } };
  await runFree(bare, FREE_MODEL, { messages: [] });
  assert.equal(calls[1].length, 2);
  await assert.rejects(() => runFree(env, '@cf/moonshotai/kimi-k2.6', {}), /not a free model/);
  await assert.rejects(() => runFree(env, 'google/gemini-3-flash', {}), /not a free model/);
});
