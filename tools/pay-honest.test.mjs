// node --test tools/pay-honest.test.mjs: asked how to test payments, Verse once invented providers, fee scores and live features.
// Payment asks now get verified facts only (no model), and every model answer carries the no-invention rule.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPayAsk, payAnswer, HONEST_RULE } from '../void-live-deploy/lib/pay-honest.js';
import { ANSWER_SYSTEM, onRequestPost } from '../void-live-deploy/functions/api/answer.js';

test('payment-testing asks are caught; unrelated asks are not', () => {
  for (const a of ['how do I test payments on void', 'does cash app work here', 'which payment providers are best for void', 'can I pay with crypto', 'set up stripe checkout testing'])
    assert.ok(isPayAsk(a), a);
  for (const a of ['what is the capital of france', 'how much is the starter pack', 'pay attention to me']) assert.ok(!isPayAsk(a), a);
});
test('the answer invents nothing: no real charges, no dashboard logins, no fee figures, no live claims for Cash App or crypto', () => {
  const t = payAnswer();
  assert.doesNotMatch(t, /\$\s?0?\.01|one cent|log ?in|dashboard|\d+(?:\.\d+)?\s*%|score/i);
  assert.match(t, /not live unless/); assert.match(t, /docs\/payments\.md/); assert.match(t, /test mode/);
});
test('the model rule forbids invented products and figures', () => { assert.ok(ANSWER_SYSTEM.includes(HONEST_RULE)); });
test('the route answers a payment ask without any model call', async () => {
  let called = 0;
  const env = { AI: { run: async () => { called++; return { response: 'x' }; } } };
  const r = await onRequestPost({ request: new Request('https://a-to-mind.com/api/answer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ask: 'how do I test payments on void' }) }), env });
  const j = await r.json(); assert.equal(j.note, 'pay-honest'); assert.equal(called, 0);
});
