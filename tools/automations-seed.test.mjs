// automations/hourly.json and tools/automations-seed.mjs: ten hourly automations, each one a rule Verse's own engine accepts
// (owner, 2026-10-14: "make sure Verse has 10 new automations hourly so that it starts to really utilize all it can to progress").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, check, seed } from './automations-seed.mjs';

test('ten hourly rules, every one valid; the engines each keep their own queue target', () => {
  const rules = load();
  assert.equal(rules.length, 10);
  assert.deepEqual(check(rules), []);
  for (const r of rules) assert.equal(r.when.every, 60, r.id + ' runs hourly');
  const targets = rules.flatMap((r) => r.do.filter((s) => s.action === 'queue.add').map((s) => s.target));
  assert.equal(targets.length, 3); assert.equal(new Set(targets).size, 3, 'one open job per engine, never one shared slot');
  assert.ok(targets.every((t) => /^auto:/.test(t)));
  assert.match(check([{ id: 'x', name: 'bad', when: { on: 'schedule', every: 5 }, do: [{ action: 'note', text: 'hi' }] }]).join(' '), /every/, 'a rule the engine would refuse fails here first');
});

test('seeding posts each rule to /api/automations with the owner token, and says which were saved', async () => {
  const sent = [];
  const fetchImpl = async (url, init) => { sent.push({ url, auth: init.headers.authorization, rule: JSON.parse(init.body).rule.id }); return new Response(JSON.stringify(sent.length === 2 ? { errors: ['nope'] } : { saved: {} }), { status: sent.length === 2 ? 400 : 200 }); };
  const rows = await seed(load().slice(0, 3), { site: 'https://x.test', token: 'tok', fetchImpl });
  assert.deepEqual(sent.map((s) => s.url), Array(3).fill('https://x.test/api/automations'));
  assert.ok(sent.every((s) => s.auth === 'Bearer tok'));
  assert.deepEqual(rows.map((r) => r.ok), [true, false, true]); assert.equal(rows[1].said, 'nope');
  await assert.rejects(seed([], {}), /VOID_OWNER_TOKEN/);
});
