// New automation triggers (owner, 2026-11-03: our own Zapier): a Gumroad sale, a team chat message and a GitHub event start the owner's
// rules (lib/automations.js gumroadEvent/teamEvent/githubEvent, lib/automations-run.js fire, functions/api/github-events.js).
// node --test tools/automations-triggers.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import * as R from '../void-live-deploy/lib/automations.js';
import * as A from '../void-live-deploy/lib/automations-run.js';
import { signedOk, onRequestPost as ghPost } from '../void-live-deploy/functions/api/github-events.js';
import { LIMITS, NO_ORIGIN_CHECK } from '../void-live-deploy/lib/guard.js';

const src = (p) => readFileSync(new URL('../void-live-deploy/' + p, import.meta.url), 'utf8');

// a D1 stand-in: rules (with scope), runs, action records; ranToday sets what the day cap reads
function fakeEnv({ ranToday = 0 } = {}) {
  const t = { rules: [], runs: [], actions: [] };
  const stmt = (sql, a = []) => ({
    bind: (...b) => stmt(sql, b),
    run: async () => {
      if (/^(CREATE|ALTER)/.test(sql)) return {};
      if (/INSERT INTO void_automation_runs/.test(sql)) { t.runs.push({ rule_id: a[1], trigger: a[3], ok: a[4], log: JSON.parse(a[5]) }); return {}; }
      if (/DELETE FROM/.test(sql)) return {};
      if (/INSERT INTO void_actions/.test(sql)) { t.actions.push(a); return {}; }
      throw new Error('unexpected run ' + sql);
    },
    first: async () => {
      if (/COUNT\(\*\).*FROM void_automation_runs/.test(sql)) return { n: ranToday };
      throw new Error('unexpected first ' + sql);
    },
    all: async () => {
      if (/FROM void_automations WHERE enabled = 1 AND scope = '' AND rule LIKE/.test(sql)) {
        const like = a[0].slice(1, -1);
        return { results: t.rules.filter((r) => r.enabled && r.scope === '' && r.rule.includes(like)) };
      }
      throw new Error('unexpected all ' + sql);
    },
  });
  const add = (id, rule, { enabled = 1, scope = '' } = {}) => t.rules.push({ id, enabled, scope, rule: JSON.stringify(rule) });
  return { t, add, env: { DB: { prepare: (sql) => stmt(sql) } } };
}

test('the three triggers validate, and every template is a valid rule', () => {
  for (const on of ['gumroad', 'team', 'github']) {
    const v = R.validate({ name: 'x', when: { on, match: { a: 'b' } }, do: [{ action: 'note', text: 'hi {{event.a}}' }] }, {});
    assert.ok(v.ok, on + ': ' + v.errors.join('; ')); assert.equal(v.rule.when.on, on);
    assert.ok(R.CAPPED.includes(on), on + ' counts against the day cap');
  }
  for (const tpl of R.TEMPLATES) assert.ok(R.validate(tpl, {}).ok, tpl.name);
  for (const on of ['gumroad', 'team', 'github']) assert.ok(R.TEMPLATES.some((x) => x.when.on === on), 'a template for ' + on);
  assert.match(src('skills/automations.js'), /gumroad: 'When Gumroad pings/);
});

test('gumroadEvent: what sold and for how much, never who bought it', () => {
  const e = R.gumroadEvent({ product_name: 'Verse Pro', product_permalink: 'verse', price: '900', currency: 'usd', email: 'buyer@example.com', full_name: 'A Buyer', ip_country: 'US', license_key: 'K-1', purchaser_id: '9', test: 'true' }, { resource: 'sale', effect: 'tier paid', at: 'T' });
  assert.deepEqual(e, { resource: 'sale', product: 'Verse Pro', permalink: 'verse', price: 9, currency: 'USD', quantity: 1, recurrence: '', test: true, refunded: false, effect: 'tier paid', at: 'T' });
  assert.ok(!/buyer@|A Buyer|K-1/.test(JSON.stringify(e)));
  assert.equal(R.fill('Sale: {{event.product}} for {{event.price}} {{event.currency}}', e), 'Sale: Verse Pro for 9 USD');
});

test('githubEvent: the usual fields, trimmed; a merged-PR rule matches on booleans', () => {
  const e = R.githubEvent('pull_request', 'd-1', { action: 'closed', repository: { full_name: 'atomeam/void-loop' }, sender: { login: 'atomeam' },
    pull_request: { number: 7, title: 'x'.repeat(900), html_url: 'https://github.com/atomeam/void-loop/pull/7', state: 'closed', merged: true, user: { login: 'grok' }, head: { ref: 'helper/a' }, base: { ref: 'main' }, body: 'y'.repeat(100000) } });
  assert.equal(e.event, 'pull_request'); assert.equal(e.repo, 'atomeam/void-loop'); assert.equal(e.pull_request.number, 7);
  assert.equal(e.pull_request.title.length, 300); assert.ok(JSON.stringify(e).length < 2000, 'the PR body never rides along');
  const tpl = R.TEMPLATES.find((x) => x.when.on === 'github');
  assert.ok(R.matches(tpl, e)); assert.ok(!R.matches(tpl, { ...e, pull_request: { ...e.pull_request, merged: false } }));
  const push = R.githubEvent('push', 'd-2', { ref: 'refs/heads/main', after: 'abc', commits: [{}, {}], head_commit: { id: 'abc', message: 'm', url: 'u', author: { username: 'z' } } });
  assert.equal(push.branch, 'main'); assert.equal(push.commits, 2); assert.equal(push.head_commit.author, 'z');
});

test('fire: runs the owner\'s enabled rules of that trigger only, under match and the day cap; never throws', async () => {
  const { env, t, add } = fakeEnv();
  add('sale-note', { name: 'sale', when: { on: 'gumroad', match: { resource: 'sale' } }, do: [{ action: 'note', text: 'sold {{event.product}}' }] });
  add('refund-note', { name: 'refund', when: { on: 'gumroad', match: { resource: 'refund' } }, do: [{ action: 'note', text: 'refund' }] });
  add('off', { name: 'off', when: { on: 'gumroad' }, do: [{ action: 'note', text: 'x' }] }, { enabled: 0 });
  add('member', { name: 'member', when: { on: 'gumroad' }, do: [{ action: 'note', text: 'x' }] }, { scope: 'acct-1' });
  add('team-one', { name: 'team', when: { on: 'team' }, do: [{ action: 'note', text: 'x' }] });
  const ran = await A.fire(env, 'gumroad', R.gumroadEvent({ product_name: 'Verse Pro', price: '900' }, { resource: 'sale' }));
  assert.deepEqual(ran.map((r) => [r.id, r.ok, r.skipped || '']), [['sale-note', true, ''], ['refund-note', true, 'the event does not match']]);
  assert.equal(t.runs.length, 1); assert.equal(t.runs[0].trigger, 'gumroad'); assert.match(t.runs[0].log[0].said, /sold Verse Pro/);
  assert.deepEqual(await A.fire(env, 'webhook', {}), [], 'only the event triggers fire');
  assert.deepEqual(await A.fire({}, 'team', {}), [], 'no DB, nothing');
  const capped = fakeEnv({ ranToday: R.RUN_CAP_DAY });
  capped.add('team-one', { name: 'team', when: { on: 'team' }, do: [{ action: 'note', text: 'x' }] });
  const c = await A.fire(capped.env, 'team', R.teamEvent({ id: 1, c: 'general', by: 'owner', body: 'hi' }));
  assert.match(c[0].skipped, /times a day from team events/);
  const broken = { DB: { prepare: () => { throw new Error('D1 down'); } } };
  assert.deepEqual(await A.fire(broken, 'github', {}), []);
});

test('the team chat fires on a person\'s or an agent\'s post, never on Verse\'s own; Gumroad fires once per new record', () => {
  const team = src('functions/api/team.js');
  const post = team.slice(team.indexOf("case 'post': {"), team.indexOf("case 'dream': {"));
  assert.match(post, /fire\(env, 'team', teamEvent\(\{ id, c, by: byOf\(me\), body, thread, at: now \}\)\)/);
  const says = team.slice(team.indexOf('export async function verseSays'), team.indexOf('async function threadId'));
  assert.ok(!/fire\(/.test(says), 'Verse\'s own posts never fire a rule (no loop)');
  const g = src('functions/api/gumroad.js');
  assert.ok(g.indexOf("fire(env, 'gumroad'") > g.indexOf("note: 'already recorded'"), 'after the duplicate check');
  assert.match(g, /gumroadEvent\(p, \{ resource, effect, at: now \}\)/);
});

const sign = (secret, raw) => 'sha256=' + createHmac('sha256', secret).update(raw).digest('hex');
const ghReq = (raw, headers) => new Request('https://a-to-mind.com/api/github-events', { method: 'POST', body: raw, headers: { 'content-type': 'application/json', ...headers } });

test('GitHub events: signed or refused, ping answers pong, a signed event fires the github rules', async () => {
  const secret = 's3cret', raw = JSON.stringify({ action: 'closed', pull_request: { number: 3, merged: true } });
  assert.ok(await signedOk(secret, raw, sign(secret, raw)));
  assert.ok(!(await signedOk(secret, raw, sign('other', raw)))); assert.ok(!(await signedOk(secret, raw + ' ', sign(secret, raw)))); assert.ok(!(await signedOk('', raw, sign('', raw))));
  let fired = null; const fireFn = async (env, on, ev) => { fired = { on, ev }; return [{ id: 'r', ok: true }]; };
  assert.equal((await ghPost({ request: ghReq(raw, {}), env: {}, fireFn })).status, 503);
  const env = { GITHUB_WEBHOOK_SECRET: secret };
  assert.equal((await ghPost({ request: ghReq(raw, { 'x-github-event': 'pull_request', 'x-hub-signature-256': sign('wrong', raw) }), env, fireFn })).status, 401);
  assert.equal(fired, null);
  const ping = await ghPost({ request: ghReq('{"zen":"z"}', { 'x-github-event': 'ping', 'x-hub-signature-256': sign(secret, '{"zen":"z"}') }), env, fireFn });
  assert.deepEqual(await ping.json(), { ok: true, pong: true }); assert.equal(fired, null);
  const ok = await ghPost({ request: ghReq(raw, { 'x-github-event': 'pull_request', 'x-github-delivery': 'd1', 'x-hub-signature-256': sign(secret, raw) }), env, fireFn });
  assert.equal(ok.status, 200); assert.equal(fired.on, 'github'); assert.equal(fired.ev.pull_request.number, 3); assert.equal(fired.ev.delivery, 'd1');
  assert.ok(LIMITS['github-events'] && NO_ORIGIN_CHECK.includes('github-events'));
});
