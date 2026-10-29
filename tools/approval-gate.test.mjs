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

// The gate wired into the confirm line (functions/api/approval.js): a yes runs only when the gate clears it.
import { DatabaseSync } from 'node:sqlite';
import * as api from '../void-live-deploy/functions/api/approval.js';
import { fingerprint } from '../void-live-deploy/lib/approval-core.js';

const TOKEN = 'owner-token-for-tests-1234567890';
function d1() {
  const db = new DatabaseSync(':memory:');
  const stmt = (sql, a = []) => ({ sql, a, bind: (...b) => stmt(sql, b),
    run: async () => { const r = db.prepare(sql).run(...a); return { meta: { changes: Number(r.changes) } }; },
    all: async () => ({ results: db.prepare(sql).all(...a) }), first: async () => db.prepare(sql).get(...a) || null });
  return { prepare: (sql) => stmt(sql), batch: async (list) => Promise.all(list.map((s) => s.run())), raw: db };
}
async function confirmLine(tool, run) {
  const env = { DB: d1(), READ_TOKEN: TOKEN };
  env.DB.raw.exec('CREATE TABLE IF NOT EXISTS void_actions (id TEXT PRIMARY KEY, owner TEXT, kind TEXT, ref TEXT, state TEXT, started TEXT, finished TEXT, result TEXT, error TEXT)');
  const post = async (body) => (await api.onRequestPost({ env, request: new Request('https://x/api/approval', { method: 'POST', headers: { authorization: 'Bearer ' + TOKEN }, body: JSON.stringify(body) }) })).json();
  const had = api.executors[tool];
  api.executors[tool] = run;
  const ask = async (args, actor = 'owner') => {
    const req = await post({ type: 'a2m.approval.requested', toolName: tool, args });
    const d = await post({ type: 'a2m.approval.decision', approvalId: req.approvalId, decision: 'approve', actor, argsFingerprint: await fingerprint(tool, args) });
    const row = env.DB.raw.prepare('SELECT state FROM void_approvals WHERE id = ?').get(req.approvalId);
    return { d, state: row && row.state };
  };
  return { ask, env, done: () => { if (had) api.executors[tool] = had; else delete api.executors[tool]; } };
}

test('the confirm line: the same request, word for word, does not run twice in a day; the second yes is held and says why', async () => {
  const sent = [];
  const c = await confirmLine('message.send', async (args) => { sent.push(args); return { id: 'm' + sent.length }; });
  try {
    const one = await c.ask({ to: 'jane', text: 'hi' });
    assert.deepEqual([one.d.ran, one.state], [true, 'done'], JSON.stringify(one.d));
    const two = await c.ask({ to: 'jane', text: 'hi' });
    assert.deepEqual([two.d.ran, two.state, two.d.held && two.d.held.need], [false, 'held', 'repeat'], JSON.stringify(two.d));
    assert.match(two.d.held.why, /already ran/);
    assert.equal(sent.length, 1, 'the executor ran once');
  } finally { c.done(); }
});

test('the confirm line: a second message right after the first waits out the cooldown; nothing runs meanwhile', async () => {
  const sent = [];
  const c = await confirmLine('message.send', async (args) => { sent.push(args); return {}; });
  try {
    assert.equal((await c.ask({ to: 'jane', text: 'one' })).d.ran, true);
    const two = await c.ask({ to: 'jane', text: 'two' });
    assert.deepEqual([two.d.ran, two.state, two.d.held.need], [false, 'held', 'wait'], JSON.stringify(two.d));
    assert.ok(two.d.held.waitMs > 0 && two.d.held.waitMs <= COOLDOWN_MS.medium);
    assert.equal(sent.length, 1);
  } finally { c.done(); }
});

test('the confirm line: a high-risk spend needs a second person\'s yes, so the owner alone cannot run it; a stop still runs', async () => {
  const ran = [];
  const c = await confirmLine('models.spend', async (args) => { ran.push(args.cost.amount); return {}; });
  try {
    const big = await c.ask({ model: 'm', cost: { amount: HIGH_SPEND + 5, currency: 'USD' }, per: 'month' });
    assert.deepEqual([big.d.ran, big.state, big.d.held.need, big.d.held.risk], [false, 'held', 'cosign', 'high'], JSON.stringify(big.d));
    const stop = await c.ask({ model: 'm', cost: { amount: 0, currency: 'USD' }, per: 'month' });
    assert.equal(stop.d.ran, true, 'stopping a spend is medium risk: the owner\'s own yes runs it');
    assert.deepEqual(ran, [0]);
  } finally { c.done(); }
});

test('the confirm line: a low-risk task needs no co-sign and has no cooldown', async () => {
  const ran = [];
  const c = await confirmLine('bridge.task', async (args) => { ran.push(args.title); return {}; });
  try {
    assert.equal((await c.ask({ title: 'a' }, 'someone')).d.ran, true);
    assert.equal((await c.ask({ title: 'b' }, 'someone')).d.ran, true);
    assert.deepEqual(ran, ['a', 'b']);
  } finally { c.done(); }
});
