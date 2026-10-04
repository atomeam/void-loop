// Persistent tasks: Void's build queue becomes a2m-bridge task envelopes.
// Dry-run is the default, exactly like domains/forethinkers/think-tank.mjs: a dry run builds the
// envelopes, checks them against the bridge's real contract and prints them, and never calls out.
//
// The bridge contract is read off a2m-bridge (projects/aether/apps/bridge/src/worker.ts):
//   POST /tasks  ->  requireAuth(request, env, ['tasks','all'])  |  401 + AUTH_DENIED audit event
//   body validated by validateMutation(); ai_id and title are required (400 without either)
//   INSERT into tasks (lane 'Council', status 'Not started', priority 'P1') and an events row
//   -> { ok, task_id, ai_id, title, status:'pending', timestamp }
// There is no dry_run parameter on that route. A bridge handed dry_run:true ignores it and writes
// the task anyway, so a dry run must not call the bridge at all: the flag travels in the logged
// envelope and the audit trail only. env.BRIDGE_DB unbound answers 500.

import { readFile, appendFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const SCHEMA = 'a2m.task.v1';
export const BRIDGE_PATH = '/tasks';
export const BRIDGE_SCOPE = 'tasks';
export const DESCRIPTION_LIMIT = 5000; // the bridge truncates; we truncate first and say so
export const DISPATCHABLE = new Set(['queued']);
export const AI_ID = 'void-dispatcher';

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

/**
 * The envelope. dry_run is carried here for the audit trail; the bridge has no such field and
 * would ignore it, which is why a live run is the only thing that may send one.
 */
export function envelopeFor(item, { dryRun = true, source = 'void.queue.md' } = {}) {
  return {
    schema: SCHEMA,
    ai_id: AI_ID,
    title: titleFor(item),
    description: `${item.note || ''}`.slice(0, DESCRIPTION_LIMIT),
    dry_run: dryRun === true,
    source,
    queue_id: item.id,
    target: item.target || '',
    state: item.state || '',
    asked_at: item.asked || '',
  };
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

/** Live destination. Never used in a dry run. */
export function bridgeUrl(base) {
  return `${String(base || '').replace(/\/+$/, '')}${BRIDGE_PATH}`;
}

/**
 * The plan: envelopes for everything dispatchable, plus one audit record each.
 * resolution is what would happen: would-post, skipped-state, refused-invalid.
 */
export function planFor(items, { dryRun = true, source = 'void.queue.md', bridge = '' } = {}) {
  const envelopes = [];
  const audit = [];
  const at = new Date().toISOString();
  for (const item of items || []) {
    if (!DISPATCHABLE.has(item.state)) {
      audit.push({ at, schema: SCHEMA, dry_run: dryRun, queue_id: item.id, target: item.target,
        state: item.state, resolution: 'skipped-state', reason: `state ${item.state} is not queued` });
      continue;
    }
    const envelope = envelopeFor(item, { dryRun, source });
    const v = validateEnvelope(envelope);
    audit.push({ at, schema: SCHEMA, dry_run: dryRun, queue_id: item.id, target: item.target,
      method: 'POST', path: BRIDGE_PATH, scope: BRIDGE_SCOPE, bridge,
      resolution: v.ok ? 'would-post' : 'refused-invalid', errors: v.errors, envelope });
    if (v.ok) envelopes.push(envelope);
  }
  return { dryRun, source, bridge, envelopes, audit,
    counts: { seen: (items || []).length, dispatchable: envelopes.length,
      skipped: audit.filter((a) => a.resolution === 'skipped-state').length,
      refused: audit.filter((a) => a.resolution === 'refused-invalid').length } };
}

/** Never call fetch in a dry run. That is the whole safety property. */
async function deliver(plan, { fetchImpl, token }) {
  if (plan.dryRun) return plan;
  const refuse = (r, resolution, errors) => { r.resolution = resolution; r.errors = errors; };
  if (!plan.bridge || !token) {
    for (const r of plan.audit) if (r.resolution === 'would-post') {
      refuse(r, 'refused-no-credentials', ['a live run needs BRIDGE_URL and BRIDGE_TOKEN; nothing was sent']);
    }
    return plan;
  }
  for (const r of plan.audit) {
    if (r.resolution !== 'would-post') continue;
    const { ai_id, title, description } = r.envelope;
    try {
      const res = await fetchImpl(bridgeUrl(plan.bridge), {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, 'x-api-key': token },
        body: JSON.stringify({ ai_id, title, description }),
      });
      const text = await res.text();
      r.resolution = res.ok ? 'posted' : 'refused-by-bridge';
      r.bridge_status = res.status;
      r.bridge_response = text.slice(0, 500);
    } catch (e) {
      refuse(r, 'refused-transport', [String((e && e.message) || e)]);
    }
  }
  return plan;
}

export async function run(opts = {}) {
  const dryRun = (opts.dryRun ?? ((process.env.DRY_RUN || 'true') !== 'false')) === true;
  const items = opts.items || parseQueueMirror(await readFile(opts.mirrorPath || path.join(here, '..', 'domains', 'void.queue.md'), 'utf8'));
  const plan = planFor(items, { dryRun, source: opts.source || 'void.queue.md', bridge: opts.bridge ?? process.env.BRIDGE_URL ?? '' });
  await deliver(plan, { fetchImpl: opts.fetchImpl || fetch, token: opts.token ?? process.env.BRIDGE_TOKEN });
  if (opts.auditPath !== null) {
    await appendFile(opts.auditPath || path.join(here, '..', 'domains', 'void.dispatch-log.jsonl'),
      plan.audit.map((a) => JSON.stringify(a)).join('\n') + '\n');
  }
  plan.printed = true;
  return plan;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const plan = await run();
  console.log(`${new Date().toISOString()} dispatcher dry_run=${plan.dryRun} source=${plan.source} ` +
    `seen=${plan.counts.seen} dispatchable=${plan.counts.dispatchable} skipped=${plan.counts.skipped} refused=${plan.counts.refused}`);
  if (plan.dryRun) console.log('dry run: nothing was sent to the bridge and no live state changed.');
  for (const r of plan.audit) {
    console.log(`  ${r.queue_id} ${r.target} -> ${r.resolution}${r.errors?.length ? ' (' + r.errors.join('; ') + ')' : ''}`);
    if (r.envelope) console.log(`    POST ${BRIDGE_PATH} ${JSON.stringify({ ai_id: r.envelope.ai_id, title: r.envelope.title, dry_run: r.envelope.dry_run })}`);
  }
}