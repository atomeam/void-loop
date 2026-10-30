// The confirm line stays strict after #1444 (lib/approval-gate.js, functions/api/approval.js): what that change let through, and
// what it did not. #1444 made two changes there: a $0 stop of a standing spend skips the cooldown (only the cooldown), and a yes
// whose fingerprint does not match the request fails hard before the gate is asked. These tests pin both edges, so a later change
// that widens either one goes red. Run: node --test tools/confirm-line-strict.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { gate, riskOf, COOLDOWN_MS, REPEAT_MS, HIGH_SPEND } from '../void-live-deploy/lib/approval-gate.js';
import { fingerprint, GATED } from '../void-live-deploy/lib/approval-core.js';
import * as api from '../void-live-deploy/functions/api/approval.js';

const T0 = Date.parse('2026-10-30T12:00:00Z'), iso = (ms) => new Date(ms).toISOString();
const OWNER = 'owner';
const spendArgs = (amount) => ({ model: 'm', cost: { amount, currency: 'USD' }, per: 'month' });
const ranSpend = [{ fp: 'earlier', tool: 'models.spend', at: iso(T0 - 5e3), state: 'executed' }];

test('every gated action still needs a yes: the gate has a rule for it, and none of them is low risk unless it is a task, a reminder or a kept automation', () => {
  for (const tool of Object.keys(GATED)) {
    const risk = riskOf(tool, {});
    assert.ok(['low', 'medium', 'high'].includes(risk), tool);
    if (risk === 'low') assert.ok(['reminder.ping', 'bridge.task', 'automation.keep'].includes(tool), tool + ' must not be low risk');
  }
});

test('#1444: a $0 stop right after a spend ran goes ahead at once; any other spend in the cooldown still waits', () => {
  const stop = gate({ tool: 'models.spend', args: spendArgs(0), fp: 'stop', actor: OWNER }, ranSpend, T0, { owner: OWNER });
  assert.equal(stop.ok, true, JSON.stringify(stop));
  for (const amount of [1, 0.01, -1, HIGH_SPEND - 1, 'x', undefined, NaN]) {
    const g = gate({ tool: 'models.spend', args: spendArgs(amount), fp: 'more-' + amount, actor: 'guest', cosigner: OWNER }, ranSpend, T0, { owner: OWNER }); // co-signed, so only the cooldown can hold it
    assert.equal(g.ok, false, 'amount ' + String(amount) + ' must not skip the cooldown');
    assert.equal(g.need, 'wait', 'amount ' + String(amount) + ': ' + JSON.stringify(g));
  }
  const noCost = gate({ tool: 'models.spend', args: { model: 'm', per: 'month' }, fp: 'nocost', actor: 'guest', cosigner: OWNER }, ranSpend, T0, { owner: OWNER });
  assert.equal(noCost.need, 'wait', 'a spend with no cost is not a stop');
});

test('#1444: the stop skips only the cooldown: the same stop twice in a day is a repeat, and a stranger alone still needs the owner', () => {
  const again = gate({ tool: 'models.spend', args: spendArgs(0), fp: 'stop', actor: OWNER }, [...ranSpend, { fp: 'stop', tool: 'models.spend', at: iso(T0 - 60e3), state: 'executed' }], T0, { owner: OWNER });
  assert.equal(again.need, 'repeat', JSON.stringify(again));
  assert.equal(gate({ tool: 'models.spend', args: spendArgs(0), fp: 'stop', actor: OWNER }, [{ fp: 'stop', tool: 'models.spend', at: iso(T0 - REPEAT_MS + 1), state: 'executed' }], T0, { owner: OWNER }).need, 'repeat');
  const stranger = gate({ tool: 'models.spend', args: spendArgs(0), fp: 'stop2', actor: 'guest' }, ranSpend, T0, { owner: OWNER });
  assert.equal(stranger.need, 'cosign', JSON.stringify(stranger));
});

test('#1444: only a standing spend gets the stop: a $0 order or payment of another tool still waits out its cooldown', () => {
  for (const tool of Object.keys(GATED).filter((t) => t !== 'models.spend' && riskOf(t, { cost: { amount: 0 } }) !== 'low')) {
    const ran = [{ fp: 'p', tool, at: iso(T0 - 5e3), state: 'executed' }];
    const g = gate({ tool, args: { cost: { amount: 0, currency: 'USD' } }, fp: 'q', actor: 'guest', cosigner: OWNER }, ran, T0, { owner: OWNER });
    assert.equal(g.need, 'wait', tool + ': ' + JSON.stringify(g));
    assert.ok(g.waitMs > 0 && g.waitMs <= COOLDOWN_MS.high, tool);
  }
});

// the confirm line itself, on an in-memory D1 (node:sqlite), with the real fingerprint and the real spend executor
function d1() {
  const db = new DatabaseSync(':memory:');
  const stmt = (sql, a = []) => ({ sql, a, bind: (...b) => stmt(sql, b),
    run: async () => { const r = db.prepare(sql).run(...a); return { meta: { changes: Number(r.changes) } }; },
    all: async () => ({ results: db.prepare(sql).all(...a) }), first: async () => db.prepare(sql).get(...a) || null });
  return { prepare: (sql) => stmt(sql), batch: async (list) => Promise.all(list.map((s) => s.run())), raw: db };
}
const TOKEN = 'owner-token-for-tests-1234567890';
function line(tool, run) {
  const env = { DB: d1(), READ_TOKEN: TOKEN };
  env.DB.raw.exec('CREATE TABLE IF NOT EXISTS void_actions (id TEXT PRIMARY KEY, owner TEXT, kind TEXT, ref TEXT, state TEXT, started TEXT, finished TEXT, result TEXT, error TEXT)');
  const post = async (body) => { const r = await api.onRequestPost({ env, request: new Request('https://x/api/approval', { method: 'POST', headers: { authorization: 'Bearer ' + TOKEN }, body: JSON.stringify(body) }) }); return { status: r.status, body: await r.json() }; };
  const had = api.executors[tool];
  if (run) api.executors[tool] = run;
  const request = async (args) => (await post({ type: 'a2m.approval.requested', toolName: tool, args })).body;
  const decide = async (req, fp, actor = OWNER) => post({ type: 'a2m.approval.decision', approvalId: req.approvalId, decision: 'approve', actor, argsFingerprint: fp });
  const state = (id) => (env.DB.raw.prepare('SELECT state FROM void_approvals WHERE id = ?').get(id) || {}).state;
  return { env, request, decide, state, done: () => { if (had) api.executors[tool] = had; else delete api.executors[tool]; } };
}

test('#1444: a yes with a different fingerprint never runs: it fails (409), it is not reported as held, and nothing is sent', async () => {
  const sent = [];
  const c = line('message.send', async (args) => { sent.push(args); return {}; });
  try {
    const req = await c.request({ to: 'jane', text: 'hi' });
    const d = await c.decide(req, await fingerprint('message.send', { to: 'jane', text: 'something else' }));
    assert.deepEqual([d.status, d.body.ran, d.body.error, 'held' in d.body, c.state(req.approvalId)], [409, false, 'fingerprint mismatch', false, 'failed'], JSON.stringify(d));
    assert.equal(sent.length, 0);
  } finally { c.done(); }
});

test('#1444: a mismatched yes that the gate would also hold (a repeat) still fails and never runs', async () => {
  const sent = [];
  const c = line('message.send', async (args) => { sent.push(args); return {}; });
  try {
    const args = { to: 'jane', text: 'hi' }, fp = await fingerprint('message.send', args);
    const one = await c.request(args);
    assert.equal((await c.decide(one, fp)).body.ran, true);
    const two = await c.request(args);
    const d = await c.decide(two, 'not-the-fingerprint');
    assert.deepEqual([d.status, d.body.ran, 'held' in d.body, c.state(two.approvalId)], [409, false, false, 'failed'], JSON.stringify(d));
    const three = await c.request(args);
    const held = await c.decide(three, fp);
    assert.deepEqual([held.status, held.body.ran, held.body.held && held.body.held.need], [200, false, 'repeat'], 'a matching yes is still held by the gate: ' + JSON.stringify(held.body));
    assert.equal(sent.length, 1, 'only the first yes ran');
  } finally { c.done(); }
});

test('#1444: a request changed after it was asked fails on the yes, even when the yes carries the fingerprint the person saw', async () => {
  const sent = [];
  const c = line('message.send', async (args) => { sent.push(args); return {}; });
  try {
    const args = { to: 'jane', text: 'hi' };
    const req = await c.request(args);
    const row = c.env.DB.raw.prepare('SELECT record FROM void_approvals WHERE id = ?').get(req.approvalId);
    const rec = JSON.parse(row.record); rec.argsSnapshot = { to: 'someone-else', text: 'hi' };
    c.env.DB.raw.prepare('UPDATE void_approvals SET record = ? WHERE id = ?').run(JSON.stringify(rec), req.approvalId);
    const d = await c.decide(req, await fingerprint('message.send', args));
    assert.deepEqual([d.status, d.body.ran, 'held' in d.body, c.state(req.approvalId)], [409, false, false, 'failed'], JSON.stringify(d));
    assert.equal(sent.length, 0);
  } finally { c.done(); }
});

test('#1444: whatever the gate lets through as a stop, the real spend executor records as a $0 cap, so the stop can never start paying', async () => {
  const recorded = [];
  for (const amount of [0, -0, '0', '', ' ', null, false]) {
    const ruled = gate({ tool: 'models.spend', args: spendArgs(amount), fp: 'x', actor: OWNER }, ranSpend, T0, { owner: OWNER });
    if (!ruled.ok) continue; // not treated as a stop: the cooldown still holds it, nothing to prove
    const { PAID_MODEL } = await import('../void-live-deploy/lib/router.js');
    const c = line('models.spend');
    try {
      const args = { model: PAID_MODEL, cost: { amount, currency: 'USD' }, per: 'month' };
      const req = await c.request(args);
      if (!req.approvalId) continue; // the confirm line refused the request itself
      const d = await c.decide(req, await fingerprint('models.spend', args));
      const caps = (() => { try { return c.env.DB.raw.prepare('SELECT cap_cents FROM void_spends').all().map((r) => r.cap_cents); } catch (_) { return []; } })();
      assert.ok(caps.every((cap) => cap === 0), 'amount ' + JSON.stringify(amount) + ' recorded caps ' + JSON.stringify(caps) + ': ' + JSON.stringify(d.body));
      if (d.body.ran) recorded.push(JSON.stringify(amount));
    } finally { c.done(); }
  }
  assert.ok(recorded.includes('0'), 'the plain $0 stop ran through the real executor: ' + JSON.stringify(recorded));
});
