// Persistent tasks: Void's build queue becomes a2m-bridge task envelopes, released by the owner.
//
// Three states: dry-run -> awaiting-approval -> posted. dry-run is the default, like
// domains/forethinkers/think-tank.mjs.
//
// There is deliberately no path from this tool to the bridge. The dispatcher used to POST /tasks
// itself when DRY_RUN=false; that is gone. Every delivery now goes through the confirm line, so the
// only way a task reaches a2m-bridge is an owner decision. The dispatcher can build an envelope, ask
// for approval, and stop. The bridge call happens server side, inside the approval executor.
//
// The bridge contract, read off a2m-bridge (projects/aether/apps/bridge/src/worker.ts):
//   POST /tasks -> requireAuth(request, env, ['tasks','all']) | 401 + AUTH_DENIED audit event
//   body through validateMutation(); ai_id and title required (400 without either)
//   INSERT into tasks (lane 'Council', status 'Not started', priority 'P1') and an events row
//   -> { ok, task_id, ai_id, title, status:'pending', timestamp }
// env.BRIDGE_DB unbound answers 500. That route has no dry_run field and never will: it writes.
//
// The confirm line, read off void-live-deploy/functions/api/approval.js and lib/approval-core.js:
//   POST /api/approval { type:'a2m.approval.requested', toolName, args, argsFingerprint, runId?, stepId? }
//     400 'not a gated action' unless isGated(toolName)   |   409 on an argsFingerprint that disagrees
//     ttl = env.CONFIRM_TTL_MS, default 120s, clamped to [1s, 24h]
//   POST /api/approval { type:'a2m.approval.decision', approvalId, decision, actor, argsFingerprint }
//     resumeOnDecision() recomputes fingerprint(toolName, argsSnapshot) and refuses unless both it
//     and the event still equal the stored one; a missing executor answers 'not connected'
// fingerprint() is imported from lib/approval-core.js rather than reimplemented: that file is
// shared with the page precisely so the wording, policy and fingerprint cannot drift apart.

import { readFile, appendFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fingerprint, EVENT_REQUESTED } from '../void-live-deploy/lib/approval-core.js';

const here = path.dirname(fileURLToPath(import.meta.url));

export const SCHEMA = 'a2m.task.v1';
export const BRIDGE_PATH = '/tasks';
export const BRIDGE_SCOPE = 'tasks';
export const APPROVAL_PATH = '/api/approval';
export const TOOL_NAME = 'bridge.task';
export const DESCRIPTION_LIMIT = 5000;
export const DISPATCHABLE = new Set(['queued']);
export const AI_ID = 'void-dispatcher';
export const MODES = new Set(['dry-run', 'approval']);

/** Parse the public queue mirror, domains/void.queue.md: | id | target | state | asked | note | */
export function parseQueueMirror(md) {
  const rows = [];
  for (const line of String(md || '').split(/\r?\n/)) {
    const t = line.trim();
    if (!t.startsWith('|')) continue;
    const cells = t.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < 4) continue;
    const [id, target, state, asked] = cells;
    if (!id || /^-+$/.test(id) || id.toLowerCase() === 'id') continue;
    rows.push({ id, target, state, asked, note: cells[4] || '' });
  }
  return rows;
}

/** A title the bridge will accept: never empty, never longer than its column. */
export function titleFor(item) {
  return `${item.target || 'next'}`.slice(0, 120).trim() || 'next';
}

/** Exactly what a2m-bridge POST /tasks will be given. This object is the approval's args. */
export function bridgeArgs(item) {
  return { ai_id: AI_ID, title: titleFor(item), description: `${item.note || ''}`.slice(0, DESCRIPTION_LIMIT) };
}

/**
 * The envelope. mode records where this dispatcher run stopped; it is never sent, because the
 * bridge has no field for it and would ignore one that it had.
 */
export function envelopeFor(item, { mode = 'dry-run', source = 'void.queue.md' } = {}) {
  return { schema: SCHEMA, mode, ...bridgeArgs(item),
    source, queue_id: item.id, target: item.target || '', state: item.state || '', asked_at: item.asked || '' };
}

/** Check an envelope against what POST /tasks actually requires, so a dry run finds contract drift. */
export function validateEnvelope(env) {
  const errors = [];
  if (!env || typeof env !== 'object') return { ok: false, errors: ['envelope missing'] };
  if (!env.ai_id) errors.push('ai_id required (bridge answers 400)');
  if (!env.title) errors.push('title required (bridge answers 400)');
  if (typeof env.description === 'string' && env.description.length > DESCRIPTION_LIMIT) {
    errors.push(`description over ${DESCRIPTION_LIMIT}: the bridge would truncate it silently`);
  }
  return { ok: errors.length === 0, errors };
}

/** The exact body approval.js expects, fingerprinted with the same function the server uses. */
export async function approvalRequestFor(item, { mode = 'approval', source = 'void.queue.md' } = {}) {
  const args = bridgeArgs(item);
  return {
    type: EVENT_REQUESTED,
    toolName: TOOL_NAME,
    args,
    argsFingerprint: await fingerprint(TOOL_NAME, args),
    runId: `dispatcher:${item.id}`,
    stepId: TOOL_NAME,
    queue_id: item.id,
    mode,
    source,
  };
}

/** Live destinations. The bridge one is never called from here; it is recorded for the executor. */
export function approvalUrl(base) {
  return `${String(base || '').replace(/\/+$/, '')}${APPROVAL_PATH}`;
}

export function bridgeUrl(base) {
  return `${String(base || '').replace(/\/+$/, '')}${BRIDGE_PATH}`;
}

/**
 * The plan: envelopes for everything dispatchable, plus one audit record each, saying where this
 * run stopped: would-approve, skipped-state, refused-invalid, awaiting-approval or refused-*.
 * 'posted' never appears here, because no path from this tool reaches the bridge.
 */
export function planFor(items, { mode = 'dry-run', source = 'void.queue.md', bridge = '' } = {}) {
  const envelopes = [];
  const audit = [];
  const at = new Date().toISOString();
  for (const item of items || []) {
    if (!DISPATCHABLE.has(item.state)) {
      audit.push({ at, schema: SCHEMA, mode, queue_id: item.id, target: item.target, state: item.state,
        resolution: 'skipped-state', reason: `state ${item.state} is not queued` });
      continue;
    }
    const envelope = envelopeFor(item, { mode, source });
    const v = validateEnvelope(envelope);
    audit.push({ at, schema: SCHEMA, mode, queue_id: item.id, target: item.target,
      method: 'POST', path: APPROVAL_PATH, tool_name: TOOL_NAME, gate: BRIDGE_SCOPE, bridge_path: BRIDGE_PATH, bridge,
      resolution: v.ok ? 'would-approve' : 'refused-invalid', errors: v.errors, envelope });
    if (v.ok) envelopes.push(envelope);
  }
  return { mode, source, bridge, envelopes, audit,
    counts: { seen: (items || []).length, dispatchable: envelopes.length,
      skipped: audit.filter((a) => a.resolution === 'skipped-state').length,
      refused: audit.filter((a) => a.resolution === 'refused-invalid').length } };
}

/** Ask the confirm line for permission. Never calls the bridge, in either mode. */
async function requestApproval(plan, opts) {
  if (plan.mode !== 'approval') return plan;
  const { fetchImpl, token, site } = opts;
  const refuse = (r, resolution, errors) => { r.resolution = resolution; r.errors = errors; };
  if (!site || !token) {
    for (const r of plan.audit) if (r.resolution === 'would-approve') {
      refuse(r, 'refused-no-credentials', ['an approval run needs APPROVAL_URL and READ_TOKEN (owner token, as /api/queue); nothing was sent']);
    }
    return plan;
  }
  for (const r of plan.audit) {
    if (r.resolution !== 'would-approve') continue;
    const item = { id: r.queue_id, target: r.target, state: r.state, note: r.envelope.description };
    const body = await approvalRequestFor(item, { mode: plan.mode, source: plan.source });
    try {
      const res = await fetchImpl(approvalUrl(site), {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      r.approval = { requested: true, toolName: body.toolName, argsFingerprint: body.argsFingerprint, runId: body.runId, stepId: body.stepId };
      r.resolution = res.ok ? 'awaiting-approval' : 'refused-by-confirm-line';
      r.approval_status = res.status;
      r.approval_response = text.slice(0, 500);
      if (res.ok) {
        try {
          const rec = JSON.parse(text);
          r.approval_id = rec.approvalId || null;
          r.approval_expires_at = rec.expiresAt || null;
          r.approval_line = rec.line || null;
        } catch (_) { /* the body was not the record; the status still stands */ }
      }
    } catch (e) {
      refuse(r, 'refused-transport', [String((e && e.message) || e)]);
    }
  }
  return plan;
}

export async function run(opts = {}) {
  const fromEnv = process.env.DISPATCH || 'dry-run';
  const mode = MODES.has(opts.mode) ? opts.mode : (MODES.has(fromEnv) ? fromEnv : 'dry-run');
  const items = opts.items || parseQueueMirror(await readFile(opts.mirrorPath || path.join(here, '..', 'domains', 'void.queue.md'), 'utf8'));
  const plan = planFor(items, { mode, source: opts.source || 'void.queue.md', bridge: opts.bridge ?? process.env.BRIDGE_URL ?? '' });
  await requestApproval(plan, { fetchImpl: opts.fetchImpl || fetch, token: opts.token ?? process.env.READ_TOKEN, site: opts.site ?? process.env.APPROVAL_URL ?? '' });
  if (opts.auditPath !== null) {
    await appendFile(opts.auditPath || path.join(here, '..', 'domains', 'void.dispatch-log.jsonl'),
      plan.audit.map((a) => JSON.stringify(a)).join('\n') + '\n');
  }
  plan.printed = true;
  return plan;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const plan = await run();
  console.log(`${new Date().toISOString()} dispatcher mode=${plan.mode} source=${plan.source} ` +
    `seen=${plan.counts.seen} dispatchable=${plan.counts.dispatchable} skipped=${plan.counts.skipped} refused=${plan.counts.refused}`);
  if (plan.mode === 'dry-run') console.log('dry run: nothing was sent, nothing will be until an owner approves it.');
  else console.log('approval run: the owner now has the confirm line. Nothing reaches the bridge without that yes.');
  for (const r of plan.audit) {
    console.log(`  ${r.queue_id} ${r.target} -> ${r.resolution}${r.errors?.length ? ' (' + r.errors.join('; ') + ')' : ''}`);
    if (r.resolution === 'awaiting-approval') console.log(`    ${r.approval_line || ''} (expires ${r.approval_expires_at})`);
    else if (r.resolution === 'would-approve') console.log(`    would POST ${BRIDGE_PATH} ${JSON.stringify({ ai_id: r.envelope.ai_id, title: r.envelope.title })} via ${TOOL_NAME}`);
  }
}