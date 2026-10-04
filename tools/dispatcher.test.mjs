// Dispatcher checks: the envelope matches what a2m-bridge POST /tasks requires, the fingerprint is
// the one approval.js will recompute, and there is no path from this tool to the bridge.
// node --test tools/dispatcher.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fingerprint, isGated, GATED } from '../void-live-deploy/lib/approval-core.js';
import { parseQueueMirror, envelopeFor, validateEnvelope, planFor, bridgeUrl, approvalUrl,
  approvalRequestFor, bridgeArgs, run, SCHEMA, BRIDGE_PATH, APPROVAL_PATH, TOOL_NAME,
  DESCRIPTION_LIMIT, AI_ID } from './dispatcher.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const QUEUED = { id: 'mukjtxjm', target: 'will:void-learns-skills', state: 'queued', asked: '2026-09-28T01:08', note: 'Void chose this.' };

test('the queue mirror parses, and the header and rule rows are not rows', async () => {
  const rows = parseQueueMirror(await readFile(path.join(here, '..', 'domains', 'void.queue.md'), 'utf8'));
  assert.ok(rows.length > 0, 'void.queue.md has rows');
  for (const r of rows) {
    assert.match(r.id, /^[a-z0-9-]+$/i);
    assert.ok(r.state);
    assert.ok(!/^-+$/.test(r.id));
  }
});

test('the envelope carries what POST /tasks requires: ai_id and title', () => {
  const env = envelopeFor(QUEUED);
  assert.equal(env.schema, SCHEMA);
  assert.equal(env.ai_id, AI_ID);
  assert.equal(env.title, 'will:void-learns-skills');
  assert.equal(validateEnvelope(env).ok, true);
});

test('an envelope missing ai_id or title is what the bridge answers 400 for', () => {
  assert.match(validateEnvelope({ title: 'x' }).errors.join(), /ai_id/);
  assert.match(validateEnvelope({ ai_id: 'x' }).errors.join(), /title/);
  assert.match(validateEnvelope({ ai_id: 'x', title: 'y', description: 'z'.repeat(DESCRIPTION_LIMIT + 1) }).errors.join(), /truncate/);
});

// Checklist 2, part 1: the fingerprint we send must be the one approval.js recomputes, or every
// approval is refused with 409. We import theirs rather than hashing ourselves.
test('the approval request carries the fingerprint approval.js will recompute', async () => {
  const req = await approvalRequestFor(QUEUED);
  assert.equal(req.type, 'a2m.approval.requested');
  assert.equal(req.toolName, TOOL_NAME);
  assert.deepEqual(req.args, bridgeArgs(QUEUED));
  assert.equal(req.argsFingerprint, await fingerprint(TOOL_NAME, bridgeArgs(QUEUED)));
  assert.equal(req.runId, 'dispatcher:mukjtxjm');
});

// Checklist 2, part 2: changing any envelope argument must change the fingerprint. This is the only
// thing that makes resumeOnDecision's refusal work, so it is checked directly.
test('changing an envelope argument changes the fingerprint, so a stale approval cannot resume', async () => {
  const a = await fingerprint(TOOL_NAME, bridgeArgs(QUEUED));
  const moved = await fingerprint(TOOL_NAME, bridgeArgs({ ...QUEUED, target: 'will:something-else' }));
  const renamed = await fingerprint(TOOL_NAME, bridgeArgs({ ...QUEUED, note: 'a different note' }));
  assert.notEqual(a, moved, 'a retargeted task must not match the approved fingerprint');
  assert.notEqual(a, renamed, 'a changed description must not match either');
  assert.equal(a, await fingerprint(TOOL_NAME, bridgeArgs(QUEUED)), 'the same request is stable');
});

// Checklist 1: with approval mode on, a task halts at awaiting-approval and never reaches the bridge.
test('approval mode halts at awaiting-approval and never posts to the bridge', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return { ok: true, status: 200, text: async () => JSON.stringify({
      approvalId: 'ap-1', expiresAt: '2026-10-04T15:07:00.000Z', line: 'Hand this task to the bridge?' }) };
  };
  const plan = await run({ items: [QUEUED], mode: 'approval', site: 'https://a-to-mind.com', token: 'own', fetchImpl, auditPath: null });
  assert.equal(plan.audit[0].resolution, 'awaiting-approval');
  assert.equal(plan.audit[0].approval_id, 'ap-1');
  assert.equal(plan.audit[0].approval.argsFingerprint, await fingerprint(TOOL_NAME, bridgeArgs(QUEUED)));
  assert.equal(calls.length, 1, 'exactly one call');
  assert.equal(calls[0].url, 'https://a-to-mind.com' + APPROVAL_PATH);
  assert.equal(calls.filter((c) => c.url.endsWith(BRIDGE_PATH)).length, 0, 'the bridge is never called by this tool');
  assert.equal('dry_run' in calls[0].body, false);
  assert.equal(calls[0].body.type, 'a2m.approval.requested');
});

test('dry-run is the default and sends nothing at all', async () => {
  const plan = await run({ items: [QUEUED], fetchImpl: async () => { throw new Error('must not be called'); }, auditPath: null });
  assert.equal(plan.mode, 'dry-run');
  assert.equal(plan.audit[0].resolution, 'would-approve');
});

// `in` against a Set is always false, which quietly turned DISPATCH=approval into a dry run. An
// approval run that silently degrades is worse than one that fails, so the mode is pinned here.
test('DISPATCH=approval is honoured, and anything unrecognised falls back to dry-run', async () => {
  const fetchImpl = async () => ({ ok: true, status: 200, text: async () => '{"approvalId":"ap-9"}' });
  const saved = process.env.DISPATCH;
  try {
    process.env.DISPATCH = 'approval';
    const asked = await run({ items: [QUEUED], site: 'https://a-to-mind.com', token: 'own', fetchImpl, auditPath: null });
    assert.equal(asked.mode, 'approval');
    assert.equal(asked.audit[0].resolution, 'awaiting-approval');
    process.env.DISPATCH = 'live';
    const unknown = await run({ items: [QUEUED], fetchImpl, auditPath: null });
    assert.equal(unknown.mode, 'dry-run', 'an unknown mode must not enable anything');
  } finally {
    if (saved === undefined) delete process.env.DISPATCH; else process.env.DISPATCH = saved;
  }
});

test('an approval run without a site or owner token refuses instead of guessing', async () => {
  const plan = await run({ items: [QUEUED], mode: 'approval', site: '', token: '', fetchImpl: async () => { throw new Error('must not be called'); }, auditPath: null });
  assert.equal(plan.audit[0].resolution, 'refused-no-credentials');
});

// Checklist 3: exactly-once and no-replay-after-expiry are enforced server side by the conditional
// pending -> decided update and expiresAt in resumeOnDecision. What is checkable here is the half we
// own: no resolution in this tool's audit is ever 'posted', so a replay has nothing to replay.
test('no plan from this tool can reach posted, and only queued rows are considered', () => {
  const plan = planFor([QUEUED, { ...QUEUED, id: 'live1', state: 'live' }, { ...QUEUED, id: 'bld1', state: 'building' }], { mode: 'approval' });
  assert.equal(plan.audit.some((a) => a.resolution === 'posted'), false, 'posting is the executor, not this tool');
  assert.equal(plan.counts.dispatchable, 1);
  assert.equal(plan.counts.skipped, 2);
  assert.deepEqual(plan.audit.filter((a) => a.resolution === 'skipped-state').map((a) => a.queue_id), ['live1', 'bld1']);
});

test('every audit record names the confirm line and the bridge call it is gating', () => {
  const plan = planFor([QUEUED], { mode: 'approval', bridge: 'https://bridge.example' });
  const r = plan.audit[0];
  assert.equal(r.resolution, 'would-approve');
  assert.equal(r.path, APPROVAL_PATH);
  assert.equal(r.tool_name, TOOL_NAME);
  assert.equal(r.bridge_path, BRIDGE_PATH);
  assert.equal(approvalUrl('https://a-to-mind.com/'), 'https://a-to-mind.com' + APPROVAL_PATH);
  assert.equal(bridgeUrl('https://bridge.example/'), 'https://bridge.example' + BRIDGE_PATH);
});

// The gap this PR cannot close: approval.js refuses any toolName that is not in the GATED policy
// (400 'not a gated action'), so until bridge.task is gated the approval can never be granted.
// Recorded here so the refusal is a test, not a surprise in production.
test('bridge.task is not gated yet: approval.js would answer 400 until it is added to GATED', () => {
  assert.equal(isGated(TOOL_NAME), false);
  assert.equal(GATED[TOOL_NAME], undefined);
});