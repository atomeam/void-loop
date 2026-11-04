// The free-resource router (lib/free-router.js over resources/free.json). Run: node --test tools/free-router.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { candidates, runJob, status, dailyLimit, reachable, KINDS } from '../void-live-deploy/lib/free-router.js';
import * as models from '../void-live-deploy/lib/models.js';

const registry = JSON.parse(readFileSync(new URL('../void-live-deploy/resources/free.json', import.meta.url)));
// a D1 stand-in for lib/daily-cap.js: counts per key, refuses at the limit
function fakeDb() { const n = {}; return { prepare: (sql) => ({ bind: (...a) => ({ all: async () => { const [, key, lim] = a; if ((n[key] || 0) >= lim) return { results: [] }; n[key] = (n[key] || 0) + 1; return { results: [{ n: n[key] }] }; }, first: async () => ({ n: n[a[1]] || 0 }) }), run: async () => ({}) }), n }; }

test('free: every resource has an id, a known kind or a program kind, a limit, signup words and an https terms link; ids unique; models named only by lib/models.js export', () => {
  const ids = new Set();
  for (const r of registry.resources) {
    assert.ok(/^[a-z0-9-]+$/.test(r.id) && !ids.has(r.id), r.id); ids.add(r.id);
    assert.ok(KINDS.includes(r.kind) || ['credits', 'grant'].includes(r.kind), r.id);
    assert.ok(r.limit && r.limit.n > 0 && r.limit.per && r.limit.unit, r.id); assert.ok(r.signup && /^https:\/\//.test(r.terms), r.id);
    if (r.model) assert.ok(typeof models[r.model] === 'string', r.id + ' model ' + r.model);
    assert.ok(!/@cf\//.test(JSON.stringify(r)), 'a Workers AI model is named only in lib/models.js');
  }
  assert.ok(registry.rules.some((x) => /stacking/.test(x)));
});

test('free: programs and missing keys are never routed; keyless and bound ones are', () => {
  assert.equal(reachable({ access: 'program' }).ok, false);
  assert.equal(reachable({ access: 'key:GROQ_API_KEY' }, {}).ok, false);
  assert.equal(reachable({ access: 'key:GROQ_API_KEY' }, { GROQ_API_KEY: 'x' }).ok, true);
  const llm = candidates(registry, 'llm', { AI: {} }).map((r) => r.id);
  assert.deepEqual(llm, ['workers-ai-chat']);
  assert.ok(candidates(registry, 'llm', { AI: {}, GROQ_API_KEY: 'x' }).map((r) => r.id).includes('groq-free'));
  assert.equal(dailyLimit({ limit: { n: 3100, per: 'month' } }), 100);
});

test('free: a job fails over when the first provider says its quota is out, and when a daily share is used up', async () => {
  const db = fakeDb(); const env = { AI: {}, GROQ_API_KEY: 'x', DB: db };
  const adapters = { 'workers-ai-chat': async () => { const e = new Error('quota'); e.status = 429; throw e; }, 'groq-free': async (job) => 'groq:' + job.ask };
  const out = await runJob(registry, 'llm', { ask: 'hi' }, { env, adapters });
  assert.equal(out.ok, true); assert.equal(out.id, 'groq-free'); assert.equal(out.result, 'groq:hi'); assert.equal(out.tried[0].why, 'provider quota');
  db.n['free:workers-ai-chat'] = 400; db.n['free:groq-free'] = 1000;
  const none = await runJob(registry, 'llm', { ask: 'hi' }, { env, adapters });
  assert.equal(none.ok, false); assert.equal(none.tried.length, 2);
  assert.equal((await runJob(registry, 'llm', {}, { env: { AI: {} }, adapters })).ok, false, 'no counter: fail closed, nothing called');
});

test('free: status lists every resource with why; the /free/ page reads /api/free', async () => {
  const rows = await status(registry, { AI: {} });
  assert.equal(rows.length, registry.resources.length);
  assert.ok(rows.every((r) => typeof r.why === 'string' && 'available' in r));
  assert.match(readFileSync(new URL('../void-live-deploy/free/index.html', import.meta.url), 'utf8'), /\/api\/free/);
});
