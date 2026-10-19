// The approval gate as tested functions (lib/approval-gate.js): risk, rollback, no repeats, cooldown, the owner's co-sign.
// Run: node --test tools/approval-gate.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { riskOf, rollbackOf, gate, REPEAT_MS, COOLDOWN_MS, HIGH_SPEND } from '../void-live-deploy/lib/approval-gate.js';
import { GATED } from '../void-live-deploy/lib/approval-core.js';

const T0 = Date.parse('2026-10-18T12:00:00Z'), iso = (ms) => new Date(ms).toISOString();
const OWNER = 'owner';

test('every gated action has a risk and a rollback answer; an ungated one has none', () => {
  for (const tool of Object.keys(GATED)) {
    assert.ok(['low', 'medium', 'high'].includes(riskOf(tool, {})), tool);
    assert.equal(typeof rollbackOf(tool).undo, 'boolean', tool);
  }
  assert.equal(riskOf('weather.look', {}), 'none');
});

test('risk: tasks and reminders are low, messages medium, payments and big spends high, a small order medium, an unknown price high', () => {
  assert.equal(riskOf('bridge.task', {}), 'low');
  assert.equal(riskOf('email.send', { to: 'a@b.co' }), 'medium');
  assert.equal(riskOf('payment.send', { cost: { amount: 1 } }), 'high');
  assert.equal(riskOf('order.place', { cost: { amount: HIGH_SPEND - 1 } }), 'medium');
  assert.equal(riskOf('order.place', { cost: { amount: HIGH_SPEND } }), 'high');
  assert.equal(riskOf('order.place', { item: 'x' }), 'high', 'no price: assume the worst');
});

test('rollback: a send and a payment cannot be undone, a booking, order and standing spend can', () => {
  assert.equal(rollbackOf('email.send').undo, false);
  assert.equal(rollbackOf('payment.send').undo, false);
  for (const t of ['order.place', 'booking.make', 'models.spend', 'bridge.task']) assert.equal(rollbackOf(t).undo, true, t);
});

test('a low-risk action goes ahead; a medium one needs the owner, who can say it themselves; a high one needs the owner as a second person', () => {
  assert.equal(gate({ tool: 'bridge.task', args: {}, fp: 'a', actor: 'guest' }, [], T0, { owner: OWNER }).ok, true);
  const m = gate({ tool: 'email.send', args: {}, fp: 'b', actor: 'guest' }, [], T0, { owner: OWNER });
  assert.deepEqual([m.ok, m.need], [false, 'cosign']);
  assert.equal(gate({ tool: 'email.send', args: {}, fp: 'b', actor: OWNER }, [], T0, { owner: OWNER }).ok, true);
  const h = { tool: 'payment.send', args: { cost: { amount: 5 } }, fp: 'c' };
  assert.equal(gate({ ...h, actor: OWNER }, [], T0, { owner: OWNER }).need, 'cosign', 'the owner asking alone is not enough above medium');
  assert.equal(gate({ ...h, actor: 'guest', cosigner: 'guest' }, [], T0, { owner: OWNER }).need, 'cosign', 'one person cannot sign twice');
  assert.equal(gate({ ...h, actor: 'guest', cosigner: 'someone' }, [], T0, { owner: OWNER }).need, 'cosign', 'the second signature must be the owner\'s');
  assert.equal(gate({ ...h, actor: 'guest', cosigner: OWNER }, [], T0, { owner: OWNER }).ok, true);
});

test('no repeats: the same request does not run twice in a day; only executed runs count; a changed request is a new one', () => {
  const req = { tool: 'email.send', args: {}, fp: 'same', actor: OWNER };
  const ran = [{ fp: 'same', tool: 'email.send', at: iso(T0 - 5 * 3600e3), state: 'executed' }];
  assert.equal(gate(req, ran, T0, { owner: OWNER }).need, 'repeat');
  assert.equal(gate(req, [{ ...ran[0], state: 'rejected' }], T0, { owner: OWNER }).ok, true);
  assert.equal(gate(req, [{ ...ran[0], at: iso(T0 - REPEAT_MS - 1) }], T0, { owner: OWNER }).ok, true);
  assert.equal(gate({ ...req, fp: 'other' }, ran, T0, { owner: OWNER }).ok, true, 'a different fingerprint is allowed (the cooldown is long past)');
});

test('cooldown: a second action of the same tool waits by its risk; another tool does not', () => {
  const ran = [{ fp: 'x', tool: 'email.send', at: iso(T0 - 20e3), state: 'executed' }];
  const g = gate({ tool: 'email.send', args: {}, fp: 'y', actor: OWNER }, ran, T0, { owner: OWNER });
  assert.deepEqual([g.ok, g.need, g.waitMs], [false, 'wait', COOLDOWN_MS.medium - 20e3]);
  assert.equal(gate({ tool: 'message.send', args: {}, fp: 'z', actor: OWNER }, ran, T0, { owner: OWNER }).ok, true);
  assert.equal(gate({ tool: 'email.send', args: {}, fp: 'y', actor: OWNER }, ran, T0 + COOLDOWN_MS.medium, { owner: OWNER }).ok, true);
  assert.equal(gate({ tool: 'bridge.task', args: {}, fp: 'q', actor: 'g' }, [{ fp: 'p', tool: 'bridge.task', at: iso(T0), state: 'executed' }], T0, {}).ok, true, 'low risk has no cooldown');
});

test('bad input does not throw or let anything through', () => {
  assert.equal(gate(null, null, T0).ok, true, 'nothing gated');
  assert.equal(gate({ tool: 'payment.send', args: null }, [null, { at: 'x' }], T0, {}).need, 'cosign');
});
