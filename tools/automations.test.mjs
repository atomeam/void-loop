// Void's own automations (lib/automations.js, lib/automations-run.js, functions/api/automations.js, functions/api/hook/[id].js):
// what a rule may say, how event data fills it (and can never widen it), the GitHub calls a run makes, the run log, and
// who may make, run or trigger a rule. node --test tools/automations.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../void-live-deploy/lib/automations.js';
import * as A from '../void-live-deploy/lib/automations-run.js';
import * as api from '../void-live-deploy/functions/api/automations.js';
import * as hook from '../void-live-deploy/functions/api/hook/[id].js';
import * as tickApi from '../void-live-deploy/functions/api/automations/tick.js';

const env0 = {};
const pr = (over = {}) => ({ name: 'pr', when: { on: 'manual' }, do: [{ action: 'github.pr', repo: 'atomeam/void-loop', branch: 'void/x', title: 't', files: [{ path: 'domains/a.md', content: 'a' }], ...over }] });

test('a rule: the templates are valid, and the basics are checked', () => {
  for (const t of R.TEMPLATES) { const v = R.validate(t, env0); assert.ok(v.ok, t.name + ': ' + v.errors.join('; ')); }
  assert.match(R.validate({}, env0).errors.join(' '), /needs a name/);
  assert.match(R.validate({ name: 'x', when: { on: 'cron' }, do: [{ action: 'note', text: 'hi' }] }, env0).errors.join(' '), /when.on/);
  assert.match(R.validate({ name: 'x', when: { on: 'manual' }, do: [] }, env0).errors.join(' '), /1 to 5 steps/);
  assert.match(R.validate({ name: 'x', when: { on: 'manual' }, do: Array(6).fill({ action: 'note', text: 'n' }) }, env0).errors.join(' '), /1 to 5 steps/);
  assert.match(R.validate({ name: 'x', when: { on: 'manual' }, do: [{ action: 'shell', cmd: 'rm' }] }, env0).errors.join(' '), /action is one of/);
});

test('a rule can only reach what the owner allows: repos, branches under void/, no workflow files, public https', () => {
  assert.match(R.validate(pr({ repo: 'someone/else' }), env0).errors.join(' '), /repo must be one Void may touch/);
  assert.match(R.validate(pr({ repo: '{{event.repo}}' }), env0).errors.join(' '), /repo must be/, 'event data never picks the repo');
  assert.ok(R.validate(pr({ repo: 'atomeam/other' }), { AUTOMATION_REPOS: 'atomeam/void-loop, atomeam/other' }).ok, 'the owner can allow more');
  for (const branch of ['main', 'feature/x', 'void/../main', 'void/a..b', 'void/x.lock', 'void/']) assert.ok(!R.validate(pr({ branch }), env0).ok, branch);
  for (const path of ['/etc/passwd', '../x', 'a/../../b', '.github/workflows/deploy.yml', '.git/config', 'a\\b', '{{event.path}}']) assert.ok(!R.validate(pr({ files: [{ path, content: 'x' }] }), env0).ok, path);
  assert.ok(!R.validate(pr({ files: [{ path: 'a.md', content: 'x'.repeat(R.MAX_FILE_BYTES + 1) }] }), env0).ok, 'file size');
  assert.ok(!R.validate(pr({ files: Array.from({ length: 21 }, (_, i) => ({ path: 'f' + i, content: '' })) }), env0).ok, 'file count');
  const post = (url) => R.validate({ name: 'p', when: { on: 'manual' }, do: [{ action: 'http.post', url }] }, env0);
  assert.ok(post('https://hooks.example.com/x').ok);
  for (const url of ['http://example.com', 'https://localhost/x', 'https://127.0.0.1/x', 'https://[::1]/x', 'https://u:p@example.com', 'https://example.com:8443/x', 'https://intranet/x', 'https://db.internal/x', 'https://{{event.host}}/x']) assert.ok(!post(url).ok, url);
});

test('event data fills text in, and is checked again after filling: it can never escape the branch prefix', () => {
  const v = R.validate(pr({ branch: 'void/{{event.name}}', title: 'For {{event.who}}', files: [{ path: 'domains/a.md', content: 'hi {{event.who}} {{event.obj}} {{event.missing}}' }] }), env0);
  assert.ok(v.ok, v.errors.join('; '));
  const [s] = R.steps(v.rule, { name: 'ok-branch', who: 'Adam', obj: { a: 1 } });
  assert.equal(s.branch, 'void/ok-branch'); assert.equal(s.title, 'For Adam'); assert.equal(s.files[0].content, 'hi Adam  ', 'objects and missing fields fill as empty');
  for (const name of ['../../main', '..', 'a/../../b']) { const [x] = R.steps(v.rule, { name }); assert.ok(x.error || (x.branch.startsWith('void/') && !x.branch.includes('..')), name + ' -> ' + JSON.stringify(x)); }
  const c = R.validate({ name: 'c', when: { on: 'webhook' }, do: [{ action: 'github.comment', repo: 'atomeam/void-loop', issue: '{{event.n}}', body: 'b' }] }, env0).rule;
  assert.equal(R.steps(c, { n: 42 })[0].issue, 42);
  assert.match(R.steps(c, { n: '1; drop' })[0].error, /no issue number/);
});

test('match: every listed field must equal its value', () => {
  const rule = { when: { on: 'webhook', match: { action: 'labeled', 'label.name': 'automerge' } } };
  assert.ok(R.matches(rule, { action: 'labeled', label: { name: 'automerge' } }));
  assert.ok(!R.matches(rule, { action: 'labeled', label: { name: 'bug' } }));
  assert.ok(!R.matches(rule, { action: 'opened' }));
  assert.ok(R.matches({ when: { on: 'webhook' } }, { anything: 1 }));
});

// a D1 stand-in for the tables the automations use, and a fetch stand-in for GitHub
function fakeEnv(extra = {}) {
  const t = { void_automations: [], void_automation_runs: [], void_queue: [] };
  const stmt = (sql, a = []) => ({
    bind: (...b) => stmt(sql, b),
    run: async () => {
      if (/^CREATE/.test(sql)) return {};
      if (/INSERT INTO void_automations/.test(sql)) { const i = t.void_automations.findIndex((r) => r.id === a[0]); const row = { id: a[0], name: a[1], enabled: a[2], rule: a[3], hook: a[4], created: a[5], updated: a[6] }; if (i >= 0) t.void_automations[i] = { ...row, created: t.void_automations[i].created }; else t.void_automations.push(row); return { meta: { changes: 1 } }; }
      if (/UPDATE void_automations SET enabled/.test(sql)) { const r = t.void_automations.find((x) => x.id === a[2]); if (r) r.enabled = a[0]; return { meta: { changes: r ? 1 : 0 } }; }
      if (/DELETE FROM void_automations WHERE/.test(sql)) { const n = t.void_automations.length; t.void_automations = t.void_automations.filter((x) => x.id !== a[0]); return { meta: { changes: n - t.void_automations.length } }; }
      if (/INSERT INTO void_automation_runs/.test(sql)) { t.void_automation_runs.push({ id: a[0], rule_id: a[1], at: a[2], trigger: a[3], ok: a[4], log: a[5] }); return {}; }
      if (/DELETE FROM void_automation_runs/.test(sql)) { t.void_automation_runs = t.void_automation_runs.slice(-a[0]); return {}; }
      if (/INSERT INTO void_queue/.test(sql)) { t.void_queue.push({ id: a[0], ask: a[1], target: a[2], state: a[3] }); return {}; }
      throw new Error('unexpected run ' + sql);
    },
    first: async () => {
      if (/FROM void_automations WHERE id/.test(sql)) return t.void_automations.find((r) => r.id === a[0]) || null;
      if (/FROM void_queue/.test(sql)) return t.void_queue.find((r) => r.target === a[0] && /queued|building/.test(r.state)) || null;
      throw new Error('unexpected first ' + sql);
    },
    all: async () => {
      if (/FROM void_automations WHERE enabled = 1/.test(sql)) return { results: t.void_automations.filter((r) => r.enabled) };
      if (/GROUP BY rule_id/.test(sql)) { const m = {}; for (const r of t.void_automation_runs) if (!m[r.rule_id] || r.at > m[r.rule_id]) m[r.rule_id] = r.at; return { results: Object.entries(m).map(([rule_id, at]) => ({ rule_id, at })) }; }
      if (/FROM void_automations/.test(sql)) return { results: t.void_automations };
      if (/FROM void_automation_runs/.test(sql)) return { results: [...t.void_automation_runs].reverse() };
      throw new Error('unexpected all ' + sql);
    },
  });
  return { t, env: { READ_TOKEN: 'owner-key', DB: { prepare: (sql) => stmt(sql) }, ...extra } };
}
function fakeGitHub() {
  const calls = [], files = {};
  const fetcher = async (url, o = {}) => {
    const u = new URL(url), m = o.method || 'GET', b = o.body ? JSON.parse(o.body) : null;
    calls.push(m + ' ' + u.pathname + u.search);
    const res = (status, data) => new Response(JSON.stringify(data), { status });
    if (u.hostname !== 'api.github.com') return res(200, {});
    if (m === 'GET' && /\/git\/ref\/heads\/main$/.test(u.pathname)) return res(200, { object: { sha: 'base-sha' } });
    if (m === 'POST' && /\/git\/refs$/.test(u.pathname)) return res(201, {});
    if (m === 'GET' && /\/contents\//.test(u.pathname)) return files[u.pathname] ? res(200, { sha: 'old' }) : res(404, {});
    if (m === 'PUT' && /\/contents\//.test(u.pathname)) { files[u.pathname] = Buffer.from(b.content, 'base64').toString(); return res(201, {}); }
    if (m === 'POST' && /\/pulls$/.test(u.pathname)) return res(201, { html_url: 'https://github.com/atomeam/void-loop/pull/999', draft: b.draft, base: b.base, head: b.head });
    if (m === 'POST' && /\/issues\/\d+\/comments$/.test(u.pathname)) return res(201, { html_url: 'https://github.com/c' });
    return res(404, {});
  };
  return { calls, files, fetcher };
}

test('a pull-request run: branch from the base, write each file, open a draft PR; never touches the base branch', async () => {
  const { env, t } = fakeEnv({ GITHUB_TOKEN: 'gh' });
  const g = fakeGitHub();
  const saved = await A.save(env, pr({ base: 'main', branch: 'void/note', title: 'Note', files: [{ path: 'domains/n.md', content: 'héllo' }] }));
  assert.ok(saved.ok);
  const r = await A.get(env, saved.rule.id);
  const out = await A.run(env, r.rule, {}, 'manual', { fetcher: g.fetcher });
  assert.ok(out.ok, JSON.stringify(out.log));
  assert.deepEqual(g.calls, ['GET /repos/atomeam/void-loop/git/ref/heads/main', 'POST /repos/atomeam/void-loop/git/refs', 'GET /repos/atomeam/void-loop/contents/domains/n.md?ref=void%2Fnote', 'PUT /repos/atomeam/void-loop/contents/domains/n.md', 'POST /repos/atomeam/void-loop/pulls']);
  assert.equal(g.files['/repos/atomeam/void-loop/contents/domains/n.md'], 'héllo', 'the content arrives intact (UTF-8)');
  assert.match(out.log[0].said, /opened https:\/\/github.com\/atomeam\/void-loop\/pull\/999/);
  assert.equal(t.void_automation_runs.length, 1); assert.equal(t.void_automation_runs[0].ok, 1);
});

test('a run without GITHUB_TOKEN fails with the reason in the log, and stops the steps after it', async () => {
  const { env, t } = fakeEnv();
  const s = await A.save(env, { name: 'two', when: { on: 'manual' }, do: [{ action: 'github.comment', repo: 'atomeam/void-loop', issue: '1', body: 'b' }, { action: 'queue.add', ask: 'never', target: 't' }] });
  const out = await A.run(env, (await A.get(env, s.rule.id)).rule, {}, 'manual', { fetcher: async () => { throw new Error('no network in this test'); } });
  assert.equal(out.ok, false); assert.equal(out.log.length, 1); assert.match(out.log[0].said, /GITHUB_TOKEN is not set/);
  assert.equal(t.void_queue.length, 0, 'the step after a failure never ran');
});

test('queue.add: a job in the build queue, once per open target', async () => {
  const { env, t } = fakeEnv();
  const s = await A.save(env, R.TEMPLATES[0]);
  const rule = (await A.get(env, s.rule.id)).rule;
  await A.run(env, rule, { ask: 'learn tide tables' }, 'webhook');
  await A.run(env, rule, { ask: 'again' }, 'webhook');
  assert.deepEqual(t.void_queue.map((q) => [q.ask, q.target]), [['from a webhook: learn tide tables', 'hook']]);
});

test('the owner API: refuses everyone but the owner; makes, lists, switches off and deletes rules; a webhook secret is shown once', async () => {
  const { env } = fakeEnv();
  const req = (method, b, key = 'owner-key') => new Request('https://a-to-mind.com/api/automations', { method, headers: key ? { authorization: 'Bearer ' + key } : {}, body: b ? JSON.stringify(b) : undefined });
  for (const key of ['', 'wrong', 'OWNER-KEY']) assert.equal((await api.onRequestGet({ request: req('GET', null, key), env })).status, 401, 'key ' + JSON.stringify(key));
  assert.equal((await api.onRequestPost({ request: req('POST', { rule: R.TEMPLATES[0] }, 'wrong'), env })).status, 401);
  const bad = await api.onRequestPost({ request: req('POST', { rule: pr({ repo: 'evil/repo' }) }), env });
  assert.equal(bad.status, 400); assert.match((await bad.json()).errors.join(' '), /repo must be/);
  const made = await (await api.onRequestPost({ request: req('POST', { rule: R.TEMPLATES[0] }), env })).json();
  assert.match(made.saved.hookSecret, /^[0-9a-f]{48}$/); assert.equal(made.saved.hookUrl, '/api/hook/' + made.saved.rule.id);
  const listed = await (await api.onRequestGet({ request: req('GET'), env })).json();
  assert.equal(listed.rules.length, 1); assert.equal(listed.rules[0].hasHook, true);
  assert.ok(!JSON.stringify(listed).includes(made.saved.hookSecret), 'the secret is never listed again');
  const again = await (await api.onRequestPost({ request: req('POST', { rule: { ...R.TEMPLATES[0], id: made.saved.rule.id } }), env })).json();
  assert.equal(again.saved.hookSecret, undefined, 'saving again keeps the secret; only rotate makes a new one');
  const off = await (await api.onRequestPatch({ request: req('PATCH', { id: made.saved.rule.id, enabled: false }), env })).json();
  assert.equal(off.rules[0].enabled, false);
  const gone = await (await api.onRequestDelete({ request: req('DELETE', { id: made.saved.rule.id }), env })).json();
  assert.equal(gone.rules.length, 0);
});

test('a webhook: the right secret runs the rule; a wrong one, a missing rule or a switched-off rule does nothing', async () => {
  const { env, t } = fakeEnv();
  const { rule, hookSecret } = await A.save(env, R.TEMPLATES[0]);
  const call = (id, key, b = { ask: 'tides' }) => hook.onRequestPost({ request: new Request('https://a-to-mind.com/api/hook/' + id, { method: 'POST', headers: key ? { 'x-void-hook': key } : {}, body: JSON.stringify(b) }), env, params: { id } });
  for (const [id, key] of [[rule.id, ''], [rule.id, 'wrong'], [rule.id, hookSecret.toUpperCase()], ['no-such-rule', hookSecret]]) assert.equal((await call(id, key)).status, 403, id + ' ' + key);
  assert.equal(t.void_queue.length, 0);
  const ok = await call(rule.id, hookSecret);
  assert.equal(ok.status, 200); assert.deepEqual(await ok.json(), { ok: true, steps: [{ action: 'queue.add', ok: true }] });
  assert.equal(t.void_queue.length, 1);
  await A.setEnabled(env, rule.id, false);
  t.void_queue.length = 0;
  assert.match((await (await call(rule.id, hookSecret, { ask: 'off' })).json()).skipped, /switched off/);
  assert.equal(t.void_queue.length, 0);
  const viaQuery = await hook.onRequestPost({ request: new Request('https://a-to-mind.com/api/hook/' + rule.id + '?key=' + hookSecret, { method: 'POST', body: '{}' }), env, params: { id: rule.id } });
  assert.equal(viaQuery.status, 200, 'senders that cannot set headers (GitHub) put the secret in ?key=');
  const manual = await A.save(env, { name: 'manual only', when: { on: 'manual' }, do: [{ action: 'note', text: 'n' }] });
  assert.equal((await call(manual.rule.id, 'anything')).status, 403, 'a manual rule has no webhook');
});

test('the clock: a schedule rule needs whole minutes from 15 to a week, and is due once its time has come round', () => {
  const sched = (every) => R.validate({ name: 's', when: { on: 'schedule', every }, do: [{ action: 'note', text: 'n' }] }, env0);
  assert.ok(sched(15).ok); assert.ok(sched(1440).ok); assert.ok(sched(10080).ok);
  for (const every of [undefined, 5, 14, 10081, 60.5, '60']) assert.ok(!sched(every).ok, 'every ' + every);
  const rule = { ...sched(60).rule, enabled: true }, now = Date.parse('2026-10-09T12:00:00Z'), ago = (m) => new Date(now - m * 60e3).toISOString();
  assert.ok(R.due(rule, null, now), 'never run: due');
  assert.ok(!R.due(rule, ago(30), now), 'half an hour ago: not yet');
  assert.ok(R.due(rule, ago(58), now), 'a late cron does not skip a whole tick');
  assert.ok(!R.due({ ...rule, enabled: false }, null, now), 'switched off: never');
  assert.ok(!R.due({ ...rule, when: { on: 'manual' } }, null, now), 'only schedule rules');
});

test('the clock: tick runs only the scheduled rules that are due, logs each as a schedule run, and is owner-only', async () => {
  const { env, t } = fakeEnv();
  const hourly = await A.save(env, { name: 'hourly', when: { on: 'schedule', every: 60 }, do: [{ action: 'queue.add', ask: 'hourly at {{event.at}}', target: 'hourly' }] });
  await A.save(env, { name: 'daily', when: { on: 'schedule', every: 1440 }, do: [{ action: 'note', text: 'daily' }] });
  const off = await A.save(env, { name: 'off', enabled: false, when: { on: 'schedule', every: 15 }, do: [{ action: 'note', text: 'never' }] });
  await A.save(env, R.TEMPLATES[0]); // a webhook rule: the clock never runs it
  const t0 = Date.parse('2026-10-09T12:00:00Z');
  const first = await A.tick(env, t0);
  assert.deepEqual(first.ran.map((r) => r.id).sort(), [hourly.rule.id, (await A.list(env)).rules.find((r) => r.name === 'daily').id].sort());
  assert.equal(t.void_queue[0].ask, 'hourly at 2026-10-09T12:00:00.000Z', 'the event carries the tick time');
  assert.ok(t.void_automation_runs.every((r) => r.trigger === 'schedule'));
  assert.ok(!first.ran.some((r) => r.id === off.rule.id), 'a switched-off rule never runs');
  t.void_automation_runs.forEach((r) => { r.at = new Date(t0).toISOString(); });
  assert.equal((await A.tick(env, t0 + 15 * 60e3)).ran.length, 0, 'a quarter of an hour later nothing is due');
  t.void_queue.length = 0;
  const later = await A.tick(env, t0 + 61 * 60e3);
  assert.deepEqual(later.ran.map((r) => r.id), [hourly.rule.id], 'an hour later only the hourly one');
  const req = (key) => new Request('https://a-to-mind.com/api/automations/tick', { method: 'POST', headers: key ? { authorization: 'Bearer ' + key } : {} });
  for (const key of ['', 'wrong']) assert.equal((await tickApi.onRequestPost({ request: req(key), env })).status, 401);
  const ok = await tickApi.onRequestPost({ request: req('owner-key'), env });
  assert.equal(ok.status, 200); assert.equal((await ok.json()).checked, 4 - 1, 'the enabled rules');
});
