// Stripe membership helpers (void-live-deploy/lib/stripe.js): the Checkout parameters, the webhook signature, and the
// active/trial/until rule the gate uses. No network, no Stripe key.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { checkoutParams, verifyStripeSignature, signatureOf, activeMembership, fromSubscription } from '../void-live-deploy/lib/stripe.js';

test('the $10/month Checkout is a subscription for the configured price, back to /join/ with the session id', () => {
  const p = checkoutParams({ STRIPE_PRICE_ID: 'price_10month' }, { name: 'Sam', email: 'sam@example.com', next: '/team/?c=work' });
  assert.equal(p.mode, 'subscription');
  assert.equal(p['line_items[0][price]'], 'price_10month');
  assert.equal(p['line_items[0][quantity]'], '1');
  assert.match(p.success_url, /^https:\/\/a-to-mind\.com\/join\/\?paid=1&session_id=\{CHECKOUT_SESSION_ID\}/);
  assert.match(p.success_url, /next=%2Fteam%2F%3Fc%3Dwork/);
  assert.equal(p.cancel_url, 'https://a-to-mind.com/join/?canceled=1');
  assert.equal(p['metadata[name]'], 'Sam'); assert.equal(p.customer_email, 'sam@example.com');
  assert.throws(() => checkoutParams({}, {}), /no price/);
  const bad = checkoutParams({ STRIPE_PRICE_ID: 'p' }, { next: '//evil.example' });
  assert.equal(bad.success_url, 'https://a-to-mind.com/join/?paid=1&session_id={CHECKOUT_SESSION_ID}', 'an off-site next is dropped');
});

test('the webhook signature is HMAC-SHA256 over "<t>.<raw body>", and only within five minutes', async () => {
  const secret = 'whsec_test_secret', payload = '{"id":"evt_1","type":"checkout.session.completed"}', t = Math.floor(Date.now() / 1000);
  const v1 = createHmac('sha256', secret).update(t + '.' + payload).digest('hex');
  assert.equal(await verifyStripeSignature(payload, 't=' + t + ',v1=' + v1, secret), true);
  assert.equal(await verifyStripeSignature(payload, 't=' + t + ',v1=' + v1, 'another-secret'), false);
  assert.equal(await verifyStripeSignature(payload + ' ', 't=' + t + ',v1=' + v1, secret), false, 'a changed body is refused');
  assert.equal(await verifyStripeSignature(payload, 't=' + (t - 400) + ',v1=' + v1, secret), false, 'older than five minutes');
  assert.equal(await verifyStripeSignature(payload, '', secret), false);
  assert.deepEqual(signatureOf('t=12,v1=ab,v1=cd'), { t: '12', v1: ['ab', 'cd'] });
});

test('a membership is active only while the subscription is active/trialing and its paid-through date has not passed', () => {
  const now = Date.now();
  assert.equal(activeMembership({ status: 'active', until: 0 }, now), true);
  assert.equal(activeMembership({ status: 'trialing', until: now + 1000 }, now), true);
  assert.equal(activeMembership({ status: 'active', until: now - 1 }, now), false);
  assert.equal(activeMembership({ status: 'past_due', until: now + 10000 }, now), false);
  assert.equal(activeMembership({ status: 'canceled', until: 0 }, now), false);
  assert.equal(activeMembership(null, now), false);
});

test('a Stripe subscription gives the row its status, paid-through date and customer', () => {
  const s = { id: 'sub_1', status: 'active', customer: 'cus_1', current_period_end: 1800000000, metadata: { name: 'Sam', email: 'sam@example.com' } };
  assert.deepEqual(fromSubscription(s), { status: 'active', until: 1800000000000, customer: 'cus_1', subscription: 'sub_1', email: 'sam@example.com', name: 'Sam' });
  const item = { id: 'sub_2', status: 'trialing', customer: 'cus_2', items: { data: [{ current_period_end: 1700000000 }] }, metadata: {} };
  assert.equal(fromSubscription(item, { name: 'Ada' }).until, 1700000000000, 'the item period end is read when the subscription has none');
  assert.equal(fromSubscription(item, { name: 'Ada' }).name, 'Ada');
});
