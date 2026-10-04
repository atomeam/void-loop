// Dispatcher checks: the envelope matches what a2m-bridge POST /tasks actually requires, and a
// dry run provably sends nothing. node --test tools/dispatcher.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseQueueMirror, envelopeFor, validateEnvelope, planFor, bridgeUrl, run,
  SCHEMA, BRIDGE_PATH, BRIDGE_SCOPE, DESCRIPTION_LIMIT, AI_ID } from './dispatcher.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const QUEUED = { id: 'mukjtxjm', target: 'will:void-learns-skills', state: 'queued', asked: '2026-09-28T01:08', note: 'Void chose this.' };

test('the queue mirror parses, and the header and rule rows are not rows', async () => {
  const rows = parseQueueMirror(await readFile(path.join(here, '..', 'domains', 'void.queue.md'), 'utf8'));
  assert.ok(rows.length > 0, 'void.queue.md has rows');
  for (const r of rows) {
    assert.match(r.id, /^[a-z0-9-]+$/i, 'id looks like a queue id');
    assert.ok(r.state, 'every row has a state');
    assert.ok(!/^-+$/.test(r.id), 'the markdown rule row is not a row');
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

test('dry_run travels in the envelope; the live body does not carry it', async () => {
  const env = envelopeFor(QUEUED, { dryRun: true });
  assert.equal(env.dry_run, true);
  let sent = null;
  const fetchImpl = async (url, init) => { sent = { url, body: JSON.parse(init.body) }; return { ok: true, status: 200, text: async () => '{"ok":true}' }; };
  const plan = await run({ items: [QUEUED], dryRun: true, fetchImpl, auditPath: null });
  assert.equal(sent, null, 'a dry run must not call fetch at all');
  await run({ items: [QUEUED], dryRun: false, bridge: 'https://bridge.example', token: 'k', fetchImpl, auditPath: null });
  assert.equal(sent.url, 'https://bridge.example' + BRIDGE_PATH);
  assert.deepEqual(Object.keys(sent.body).sort(), ['ai_id', 'description', 'title']);
  assert.equal('dry_run' in sent.body, false, 'the bridge has no dry_run field; sending one would be ignored and the task written');
});

test('a live run with no bridge or token refuses instead of guessing', async () => {
  const plan = await run({ items: [QUEUED], dryRun: false, bridge: '', token: '', fetchImpl: async () => { throw new Error('must not be called'); }, auditPath: null });
  assert.equal(plan.audit[0].resolution, 'refused-no-credentials');
});

test('only queued rows dispatch; live and building rows are recorded as skipped', () => {
  const plan = planFor([
    QUEUED,
    { ...QUEUED, id: 'live1', state: 'live' },
    { ...QUEUED, id: 'bld1', state: 'building' },
  ], { dryRun: true });
  assert.equal(plan.counts.dispatchable, 1);
  assert.equal(plan.counts.skipped, 2);
  assert.deepEqual(plan.audit.filter((a) => a.resolution === 'skipped-state').map((a) => a.queue_id), ['live1', 'bld1']);
});

test('every audit record names the resolution path and the bridge scope it would use', () => {
  const plan = planFor([QUEUED], { dryRun: true, bridge: 'https://bridge.example' });
  const r = plan.audit[0];
  assert.equal(r.resolution, 'would-post');
  assert.equal(r.method, 'POST');
  assert.equal(r.path, BRIDGE_PATH);
  assert.equal(r.scope, BRIDGE_SCOPE);
  assert.equal(r.dry_run, true);
  assert.equal(bridgeUrl('https://bridge.example/'), 'https://bridge.example' + BRIDGE_PATH);
});