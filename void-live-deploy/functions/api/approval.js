// The confirm line's server side (plan item 7, ApprovalEvent v0). Owner token, like /api/queue.
// POST { type: 'a2m.approval.requested', toolName, args, argsFingerprint, runId?, stepId? }
//   -> stores the paused action (args snapshot + fingerprint) and returns the approval with its plain line.
// POST { type: 'a2m.approval.decision', approvalId, decision, actor, reason?, argsFingerprint }
//   -> the decision event. Only an in-time 'approve' whose fingerprint still matches resumes the action.
// GET ?id=<approvalId> -> the approval record.
//
// Pause/resume: Pages Functions can't host a Cloudflare Workflow, so the paused action lives in D1
// (void_approvals) and resumeOnDecision() below is the continuation that step.waitForEvent would give us.
// Nothing runs at request time; the action can only run inside the decision handler, exactly once
// (the pending -> decided update is conditional), and never after expiresAt (timeout fails closed).
// Tables are created on first use (ensureTables; same SQL as tools/d1/void_approvals.sql), because the deploy
// (tools/deploy.ps1) doesn't run D1 SQL. If they can't be made, every call answers 503 and nothing runs.
// Moving to Workflows later: domains/void.confirm-line.md.
import { ownerOk } from '../../lib/guard.js';
import {
  EVENT_REQUESTED, EVENT_DECISION, POLICY_VERSION, GATED, ORG_ID, WORKFLOW_ID, CONFIRM_TTL_MS,
  isGated, fingerprint, confirmLine, budgetImpact, checkDecision,
} from '../../lib/approval-core.js';

// toolName -> async (args, env) => result. Empty until a connector ships: an approved action with no
// executor is recorded as approved-but-not-run and Void says the service isn't connected yet.
export const executors = {};

const ok = ownerOk; // constant-time, fails closed without READ_TOKEN (lib/guard.js)
const bad = (status, error, extra) => Response.json({ ok: false, error, ...(extra || {}) }, { status });
const uuid = () => crypto.randomUUID();

// CREATE ... IF NOT EXISTS once per isolate and database; a failure isn't remembered, so the next call retries.
const TABLES = [
  'CREATE TABLE IF NOT EXISTS void_approvals (id TEXT PRIMARY KEY, state TEXT NOT NULL, record TEXT NOT NULL, at TEXT NOT NULL, updated TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS void_ledger (id TEXT PRIMARY KEY, approval_id TEXT NOT NULL, kind TEXT NOT NULL, at TEXT NOT NULL, entry TEXT NOT NULL)',
  'CREATE INDEX IF NOT EXISTS void_ledger_at ON void_ledger (at)',
];
const made = new WeakMap();
function ensureTables(env) {
  let p = made.get(env.DB);
  if (!p) { p = env.DB.batch(TABLES.map((q) => env.DB.prepare(q))).catch((e) => { made.delete(env.DB); throw e; }); made.set(env.DB, p); }
  return p;
}

async function load(env, id) {
  const row = await env.DB.prepare('SELECT state, record FROM void_approvals WHERE id = ?').bind(String(id)).first();
  return row ? { state: row.state, rec: JSON.parse(row.record) } : null;
}
async function ledger(env, rec, kind, detail) {
  const id = uuid(), at = new Date().toISOString();
  await env.DB.prepare('INSERT INTO void_ledger (id, approval_id, kind, at, entry) VALUES (?, ?, ?, ?, ?)')
    .bind(id, rec.approvalId, kind, at, JSON.stringify({ toolName: rec.toolName, policyRuleId: rec.policyRuleId, budgetImpact: rec.budgetImpact, ...detail })).run();
  return id;
}

async function requested(env, b) {
  const toolName = String(b.toolName || '');
  if (!isGated(toolName)) return bad(400, 'not a gated action'); // read-only asks never enter the gate
  const args = b.args && typeof b.args === 'object' && !Array.isArray(b.args) ? b.args : null;
  if (!args) return bad(400, 'args missing');
  const fp = await fingerprint(toolName, args);
  if (b.argsFingerprint && b.argsFingerprint !== fp) return bad(409, 'fingerprint mismatch');
  const now = Date.now(), ttl = Math.max(1000, Math.min(Number(env.CONFIRM_TTL_MS) || CONFIRM_TTL_MS, 24 * 3600e3));
  const approvalId = uuid();
  const rec = {
    type: EVENT_REQUESTED,
    approvalId,
    runId: String(b.runId || uuid()).slice(0, 64),
    orgId: env.ORG_ID || ORG_ID,
    workflowId: String(b.workflowId || WORKFLOW_ID).slice(0, 64),
    stepId: String(b.stepId || toolName).slice(0, 64),
    toolName,
    argsFingerprint: fp,
    argsSnapshot: args,
    policyVersion: POLICY_VERSION,
    policyRuleId: GATED[toolName].rule,
    budgetImpact: budgetImpact(toolName, args),
    requestedAt: new Date(now).toISOString(),
    requestedBy: 'owner',
    expiresAt: new Date(now + ttl).toISOString(),
    correlateKey: approvalId,
    line: confirmLine(toolName, args),
  };
  await env.DB.prepare('INSERT INTO void_approvals (id, state, record, at, updated) VALUES (?, ?, ?, ?, ?)')
    .bind(approvalId, 'pending', JSON.stringify(rec), rec.requestedAt, rec.requestedAt).run();
  return Response.json(rec);
}

// The continuation. With Workflows this is the code after `await step.waitForEvent(...)`.
async function resumeOnDecision(env, rec, event) {
  const now = await fingerprint(rec.toolName, rec.argsSnapshot);
  if (event.argsFingerprint !== rec.argsFingerprint || now !== rec.argsFingerprint) return { ran: false, error: 'fingerprint mismatch' };
  const run = executors[rec.toolName];
  if (!run) return { ran: false, note: 'not connected' };
  try { return { ran: true, result: await run(rec.argsSnapshot, env) }; } catch (e) { return { ran: false, error: 'action failed: ' + String(e && e.message).slice(0, 120) }; }
}

async function decided(env, b) {
  const problem = checkDecision(b);
  if (problem) return bad(400, problem);
  const found = await load(env, b.approvalId);
  if (!found) return bad(404, 'no such approval');
  const { rec } = found;
  if (found.state !== 'pending') return bad(409, 'already decided', { decision: rec.decision || found.state });
  const decidedAt = new Date().toISOString();
  let decision = b.decision, reason = String(b.reason || '').slice(0, 300);
  if (Date.now() >= Date.parse(rec.expiresAt) && decision !== 'reject') { decision = 'timeout'; reason = reason || 'no answer in time'; } // fails closed
  const event = { type: EVENT_DECISION, approvalId: rec.approvalId, correlateKey: rec.approvalId, decision, actor: String(b.actor).slice(0, 64), reason, decidedAt, argsFingerprint: String(b.argsFingerprint || '') };
  // claim the approval first so two decisions can never both run it
  const claim = await env.DB.prepare("UPDATE void_approvals SET state = ?, record = ?, updated = ? WHERE id = ? AND state = 'pending'")
    .bind('deciding', JSON.stringify({ ...rec, decision }), decidedAt, rec.approvalId).run();
  if (!claim.meta || !claim.meta.changes) return bad(409, 'already decided');
  const outcome = decision === 'approve' ? await resumeOnDecision(env, rec, event) : { ran: false };
  const state = outcome.ran ? 'done' : outcome.error ? 'failed' : decision === 'approve' ? 'approved-not-run' : decision;
  const ledgerEntryId = await ledger(env, rec, state, { decision, actor: event.actor, reason, ran: outcome.ran, error: outcome.error || null, note: outcome.note || null });
  const out = { ...event, ledgerEntryId, ran: outcome.ran, ...(outcome.note ? { note: outcome.note } : {}), ...(outcome.error ? { error: outcome.error } : {}), ...(outcome.ran ? { result: outcome.result ?? null } : {}) };
  await env.DB.prepare('UPDATE void_approvals SET state = ?, record = ?, updated = ? WHERE id = ?')
    .bind(state, JSON.stringify({ ...rec, ...out, type: EVENT_REQUESTED, decisionEvent: EVENT_DECISION }), decidedAt, rec.approvalId).run();
  return Response.json(out, { status: outcome.error === 'fingerprint mismatch' ? 409 : 200 });
}

export async function onRequestPost({ request, env }) {
  if (!(await ok(request, env))) return new Response('no', { status: 401 });
  let b = {};
  try { b = JSON.parse((await request.text()).slice(0, 8000)); } catch (_) { return bad(400, 'bad json'); }
  try {
    await ensureTables(env);
    if (b.type === EVENT_REQUESTED) return await requested(env, b);
    if (b.type === EVENT_DECISION) return await decided(env, b);
    return bad(400, 'unknown event type');
  } catch (e) { return bad(503, 'approvals unavailable'); } // fails closed: nothing runs
}

export async function onRequestGet({ request, env }) {
  if (!(await ok(request, env))) return new Response('no', { status: 401 });
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return bad(400, 'id missing');
  try { await ensureTables(env); const f = await load(env, id); return f ? Response.json({ state: f.state, ...f.rec }) : bad(404, 'no such approval'); } catch (_) { return bad(503, 'approvals unavailable'); }
}
