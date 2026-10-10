// The send executor behind the confirm line (lib/email-send.js, wired in functions/api/approval.js): dry run by
// default, sender on the domain, daily cap, and a send only after the owner's yes on the exact draft — a forged
// session and an ask with no draft both stop short. A stand-in binding; no real mail anywhere here.
// Run: node --test tools/email-send.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { sendProposal, DAILY_CAP } from '../void-live-deploy/lib/email-send.js';
import { executors, onRequestPost } from '../void-live-deploy/functions/api/approval.js';
import { fingerprint } from '../void-live-deploy/lib/approval-core.js';
import { mintOwnerSession } from '../void-live-deploy/lib/guard.js';

const TOKEN = 'owner-token-for-tests-1234567890';
function d1() {
  const db = new DatabaseSync(':memory:');
  const stmt = (sql, a = []) => ({ bind: (...b) => stmt(sql, b),
    run: async () => ({ meta: { changes: Number(db.prepare(sql).run(...a).changes) } }),
    all: async () => ({ results: db.prepare(sql).all(...a) }),
    first: async (col) => { const r = db.prepare(sql).get(...a) || null; return col ? (r ? r[col] : null) : r; } });
  return { prepare: (sql) => stmt(sql), batch: async (list) => { const out = []; for (const q of list) out.push(await q.run()); return out; }, raw: db };
}
const mail = () => { const sent = []; return { sent, send: async (m) => { sent.push(m); } }; };
const ARGS = { to: 'maria@sunrisebakery.example', title: 'Fix the double orders', body: 'Proposal\n\nWhat they asked for:\nfix the zap.\n\nPrice:\n[price: left for the owner to fill in]' };

test('dry run is the default: everything is checked, the line says what would go, and the binding is never touched', async () => {
  const EMAIL = mail();
  const out = await sendProposal(ARGS, { DB: d1(), EMAIL });
  assert.match(out, /^dry run: would send “Proposal: Fix the double orders” to maria@sunrisebakery\.example from atom@a-to-mind\.com/);
  assert.equal(EMAIL.sent.length, 0);
});

test('EMAIL_LIVE=send really sends, counts against the day, and the cap stops it', async () => {
  const DB = d1(), EMAIL = mail();
  const env = { DB, EMAIL, EMAIL_LIVE: 'send', EMAIL_DAILY_CAP: '2' };
  assert.match(await sendProposal(ARGS, env), /\(1 of 2 today\)$/);
  assert.match(await sendProposal(ARGS, env), /\(2 of 2 today\)$/);
  await assert.rejects(() => sendProposal(ARGS, env), /daily send cap \(2\) is reached/);
  assert.equal(EMAIL.sent.length, 2);
  assert.deepEqual(Object.keys(EMAIL.sent[0]).sort(), ['from', 'subject', 'text', 'to']);
  assert.equal(EMAIL.sent[0].to, ARGS.to); assert.equal(EMAIL.sent[0].from, 'atom@a-to-mind.com');
  assert.equal(DAILY_CAP, 10, 'the default cap when EMAIL_DAILY_CAP is unset');
});

test('what never sends: no draft on the ask, a sender off the domain, a bad address, no binding when live', async () => {
  const EMAIL = mail();
  await assert.rejects(() => sendProposal({ to: ARGS.to, title: 'x' }, { DB: d1(), EMAIL }), /no draft on the ask/);
  await assert.rejects(() => sendProposal(ARGS, { DB: d1(), EMAIL, SEND_FROM: 'void@elsewhere.example' }), /sender must be on a-to-mind\.com/);
  await assert.rejects(() => sendProposal({ ...ARGS, to: 'not-an-address' }, { DB: d1(), EMAIL }), /no valid address/);
  await assert.rejects(() => sendProposal(ARGS, { DB: d1(), EMAIL_LIVE: 'send' }), /no EMAIL send binding/);
  assert.equal(EMAIL.sent.length, 0);
  assert.equal(typeof executors['proposal.send'], 'function', 'the executor is on the confirm line');
});

test('through the confirm line: the yes on the exact draft runs the dry run; a forged session and a changed draft do not', async () => {
  const DB = d1(), EMAIL = mail();
  const env = { READ_TOKEN: TOKEN, SALT: 'test-salt', DB, EMAIL };
  const session = (await mintOwnerSession(env, 'cred-1')).token;
  const call = (body, tok = session) => onRequestPost({ env, request: new Request('https://x/api/approval', { method: 'POST', headers: { authorization: 'Bearer ' + tok, 'content-type': 'application/json' }, body: JSON.stringify(body) }) });
  const fp = await fingerprint('proposal.send', ARGS);
  const req = await (await call({ type: 'a2m.approval.requested', toolName: 'proposal.send', args: ARGS, argsFingerprint: fp })).json();
  assert.ok(req.approvalId);
  // an unconfirmed draft: a decision carrying another draft's fingerprint never runs the send
  const other = await fingerprint('proposal.send', { ...ARGS, body: ARGS.body + ' with a line the owner never saw' });
  const no = await (await call({ type: 'a2m.approval.decision', approvalId: req.approvalId, decision: 'approve', actor: 'owner', argsFingerprint: other })).json();
  assert.equal(no.ran, false); assert.match(String(no.error || ''), /fingerprint mismatch/);
  // the mismatch consumed the approval (fails closed): the same approval can never be re-decided into a send
  assert.equal((await call({ type: 'a2m.approval.decision', approvalId: req.approvalId, decision: 'approve', actor: 'owner', argsFingerprint: fp })).status, 409);
  // a fresh ask; a forged owner session is 401 before anything else and consumes nothing
  const req2 = await (await call({ type: 'a2m.approval.requested', toolName: 'proposal.send', args: ARGS, argsFingerprint: fp })).json();
  const forged = (await mintOwnerSession({ READ_TOKEN: 'another-key-123456', SALT: 'test-salt' }, 'cred-1')).token;
  assert.equal((await call({ type: 'a2m.approval.decision', approvalId: req2.approvalId, decision: 'approve', actor: 'owner', argsFingerprint: fp }, forged)).status, 401);
  // the real yes on the exact draft: runs, dry run, nothing on the binding
  const yes = await (await call({ type: 'a2m.approval.decision', approvalId: req2.approvalId, decision: 'approve', actor: 'owner', argsFingerprint: fp })).json();
  assert.equal(yes.ran, true); assert.match(String(yes.result || ''), /^dry run: would send/);
  assert.equal(EMAIL.sent.length, 0);
  const recs = DB.raw.prepare("SELECT kind, state, result FROM void_actions WHERE kind = 'confirm.proposal.send'").all();
  assert.equal(recs.length, 1); assert.equal(recs[0].state, 'done'); assert.match(recs[0].result, /dry run/);
});
