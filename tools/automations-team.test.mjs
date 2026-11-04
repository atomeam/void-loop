// Verse's automations speak in Verse's own team chat (owner, 2026-11-03: "we make our own zapier ... lets start using all our tools"):
// the team.post step and a watch with tell 'team' (lib/automations.js, lib/automations-run.js, functions/api/team.js verseSays).
// node --test tools/automations-team.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../void-live-deploy/lib/automations.js';
import * as A from '../void-live-deploy/lib/automations-run.js';
import { readFileSync } from 'node:fs';

// a D1 stand-in: the automations' tables, the action records, a watch's state and the team chat's channels and messages
function fakeEnv() {
  const t = { rules: [], runs: [], actions: [], state: {}, channels: [], msgs: [] };
  const stmt = (sql, a = []) => ({
    bind: (...b) => stmt(sql, b),
    run: async () => {
      if (/^(CREATE|ALTER)/.test(sql)) return {};
      if (/INSERT OR IGNORE INTO void_team_channels/.test(sql)) { if (!t.channels.some((c) => c.code === a[0])) t.channels.push({ code: a[0] }); return {}; }
      if (/UPDATE void_team_channels/.test(sql) || /UPDATE void_team_msgs/.test(sql)) return {};
      if (/INSERT INTO void_automations/.test(sql)) { t.rules = t.rules.filter((r) => r.id !== a[0]); t.rules.push({ id: a[0], name: a[1], enabled: a[2], rule: a[3], hook: a[4], created: a[5], updated: a[6] }); return { meta: { changes: 1 } }; }
      if (/INSERT INTO void_automation_runs/.test(sql)) { t.runs.push({ id: a[0], rule_id: a[1], at: a[2], trigger: a[3], ok: a[4], log: a[5] }); return {}; }
      if (/DELETE FROM void_automation_runs|DELETE FROM void_actions/.test(sql)) return {};
      if (/INSERT INTO void_actions/.test(sql)) { t.actions.push(a); return {}; }
      if (/INSERT INTO void_watch_state/.test(sql)) { t.state[a[0]] = { state: a[1], at: a[2], matched_at: a[3] }; return {}; }
      throw new Error('unexpected run ' + sql);
    },
    first: async () => {
      if (/INSERT INTO void_team_msgs/.test(sql)) { const id = t.msgs.length + 1; t.msgs.push({ id, channel: a[0], thread: a[1], by: a[3], body: a[4], mentions: a[6] }); return { id }; }
      if (/SELECT code FROM void_team_channels/.test(sql)) return t.channels.find((c) => c.code === a[0]) || null;
      if (/FROM void_watch_state/.test(sql)) return t.state[a[0]] || null;
      if (/FROM void_automations WHERE id/.test(sql)) return t.rules.find((r) => r.id === a[0]) || null;
      if (/COUNT\(\*\).*FROM void_automation_runs/.test(sql)) return { n: 0 };
      throw new Error('unexpected first ' + sql);
    },
    all: async () => ({ results: [] }),
  });
  return { t, env: { DB: { prepare: (sql) => stmt(sql) } } };
}

test('team.post: a valid step, the channel fixed (never from the event), the body filled; the card names it', () => {
  const ok = R.validate({ name: 'say', when: { on: 'webhook' }, do: [{ action: 'team.post', body: 'Sale: {{event.product}}' }] }, {});
  assert.ok(ok.ok, ok.errors.join('; '));
  assert.equal(ok.rule.do[0].c, 'general', '#general unless the rule names another');
  assert.deepEqual(R.steps(ok.rule, { product: 'Verse Pro' }), [{ action: 'team.post', c: 'general', body: 'Sale: Verse Pro' }]);
  for (const c of ['{{event.c}}', 'Bad Channel', '../x']) assert.ok(!R.validate({ name: 'x', when: { on: 'manual' }, do: [{ action: 'team.post', c, body: 'b' }] }, {}).ok, c);
  assert.ok(!R.validate({ name: 'x', when: { on: 'manual' }, do: [{ action: 'team.post', body: ' ' }] }, {}).ok, 'a body is needed');
  assert.ok(R.TEMPLATES.some((x) => x.do.some((s) => s.action === 'team.post')), 'a template to start from');
  assert.match(readFileSync(new URL('../void-live-deploy/skills/automations.js', import.meta.url), 'utf8'), /'team\.post': \(s\) => 'say in the team chat #'/);
});

test('team.post runs: Verse says it in #general, redacted, and @here from event data never pages everyone', async () => {
  const { env, t } = fakeEnv();
  const s = await A.save(env, { name: 'hook to team', when: { on: 'webhook' }, do: [{ action: 'team.post', body: 'From a hook: {{event.text}}' }] });
  assert.ok(s.ok, JSON.stringify(s));
  const out = await A.run(env, (await A.get(env, s.rule.id)).rule, { text: '@here deploy done, token ghp_' + 'a'.repeat(36) }, 'webhook');
  assert.ok(out.ok, JSON.stringify(out.log));
  assert.equal(t.msgs.length, 1);
  assert.equal(t.msgs[0].channel, 'general'); assert.equal(t.msgs[0].by, 'verse');
  assert.ok(!/@here/.test(t.msgs[0].body) && !/ here /.test(t.msgs[0].mentions || ''), 'no page to everyone');
  assert.ok(!/ghp_a{36}/.test(t.msgs[0].body), 'a token never lands in the chat');
  assert.match(out.log[0].said, /said in #general of the team chat/);
  const bad = await A.save(env, { name: 'to nowhere', when: { on: 'manual' }, do: [{ action: 'team.post', c: 'nope', body: 'hi' }] });
  const r2 = await A.run(env, (await A.get(env, bad.rule.id)).rule, {}, 'manual');
  assert.equal(r2.ok, false); assert.match(r2.log[0].said, /no channel #nope/);
});

test('a watch with tell team: says it in #general once when it trips, not every tick; a member\'s watch never reaches the chat', async () => {
  const { env, t } = fakeEnv();
  const rule = { id: 'guard-up', name: 'Guard: the site is up', enabled: true, scope: '', when: { on: 'schedule', every: 60 }, do: [{ action: 'watch', watch: { kind: 'page', url: 'https://a-to-mind.com/', op: 'not-contains', value: 'Verse' }, tell: 'team' }] };
  assert.ok(R.validate(rule, {}).ok, R.validate(rule, {}).errors.join('; '));
  assert.equal(R.validate(rule, {}).rule.do[0].tell, 'team');
  const down = async () => new Response('<h1>502 bad gateway</h1>', { status: 200 });
  await A.run(env, rule, { tick: true }, 'schedule', { fetcher: down });
  await A.run(env, rule, { tick: true }, 'schedule', { fetcher: down });
  assert.equal(t.msgs.length, 1, 'told once, not every tick');
  assert.match(t.msgs[0].body, /Guard: the site is up/);
  const { env: env2, t: t2 } = fakeEnv();
  await A.run(env2, { ...rule, id: 'member-watch', scope: 'acct-1' }, { tick: true }, 'schedule', { fetcher: down });
  assert.equal(t2.msgs.length, 0, 'only the owner\'s rules speak in the team chat');
});

test('the seeded hourly watches tell the team chat', () => {
  const j = JSON.parse(readFileSync(new URL('../automations/hourly.json', import.meta.url), 'utf8'));
  const watches = j.rules.flatMap((r) => r.do.filter((s) => s.action === 'watch'));
  assert.equal(watches.length, 7); assert.ok(watches.every((s) => s.tell === 'team'));
  for (const r of j.rules) assert.ok(R.validate(r, {}).ok, r.id);
});
