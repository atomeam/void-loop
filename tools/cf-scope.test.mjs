// tools/cf-scope.mjs against a fake Cloudflare: which capabilities are reported, what the summary says, and that no token is ever printed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { probe, judge, format } from './cf-scope.mjs';

const ENV = { CLOUDFLARE_API_TOKEN: 'secret-pages-token', CLOUDFLARE_WORKERS_TOKEN: 'secret-workers-token', CLOUDFLARE_ACCOUNT_ID: 'acct123' };
const WITH_ANALYTICS = { ...ENV, CLOUDFLARE_ANALYTICS_TOKEN: 'secret-analytics-token' };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
// the Pages token may read analytics; the Workers-only token may not (the shape Cloudflare answers with when a scope is missing)
const fake = (canRead) => async (url, o) => {
  const token = (o.headers.authorization || '').replace('Bearer ', '');
  if (/tokens\/verify/.test(url)) return json({ success: true, result: { status: 'active' } });
  if (/\/graphql/.test(url)) return canRead.includes(token) ? json({ data: { viewer: { accounts: [{}] } }, errors: null }) : json({ data: null, errors: [{ message: 'does not have access to the path', extensions: { code: 'authz' } }] });
  if (/d1\/database/.test(url)) return canRead.includes(token) ? json({ success: true, result: [] }) : json({ success: false, errors: [{ code: 10000, message: 'Authentication error' }] }, 403);
  return json({}, 404);
};

test('cf-scope: it names which token can read analytics and says the usage meter can be built', async () => {
  const r = await probe(ENV, fake(['secret-pages-token']));
  const ok = (t, c) => r.rows.find((x) => x.token === t && x.check.startsWith(c)).ok;
  assert.equal(ok('CLOUDFLARE_API_TOKEN', 'analytics: Workers requests'), true);
  assert.equal(ok('CLOUDFLARE_WORKERS_TOKEN', 'analytics: Workers requests'), false);
  assert.equal(ok('CLOUDFLARE_WORKERS_TOKEN', 'token verifies'), true);
  assert.match(r.usageMeter, /can read analytics with CLOUDFLARE_API_TOKEN/);
});

test('cf-scope: when no token can read analytics, it names the missing scope and the fallback', async () => {
  const r = await probe(ENV, fake([]));
  assert.match(r.usageMeter, /Account Analytics: Read/); assert.match(r.usageMeter, /Workers AI usage headers/);
  assert.ok(r.rows.filter((x) => /GraphQL/.test(x.check)).every((x) => !x.ok && /authz|does not have access/.test(x.note)));
});

test('cf-scope: missing secrets, network failure and junk answers are rows, not crashes, and no token is ever printed', async () => {
  const none = await probe({}, fake([])); assert.ok(none.rows.every((r) => !r.ok) && none.rows.some((r) => /not set/.test(r.note))); assert.match(none.usageMeter, /^not checked/, 'no token is not the same as a missing scope');
  const offline = await probe(ENV, async () => { throw new Error('offline'); }); assert.ok(offline.rows.every((r) => !r.ok));
  const junk = await probe(ENV, async () => new Response('<html>', { status: 502 })); assert.ok(junk.rows.every((r) => !r.ok));
  for (const rep of [await probe(ENV, fake(['secret-pages-token'])), offline, junk]) { const text = format(rep) + JSON.stringify(rep); assert.ok(!/secret-pages-token|secret-workers-token|acct123/.test(text)); }
  assert.deepEqual(judge(200, { data: { x: 1 }, errors: null }), { ok: true, note: 'readable' });
  assert.equal(judge(200, { data: null, errors: [{ message: 'nope' }] }).ok, false);
});

test('cf-scope: a read-only analytics token added later is probed and named as the one that can build the meter', async () => {
  const r = await probe(WITH_ANALYTICS, fake(['secret-analytics-token']));
  assert.match(r.usageMeter, /can read analytics with CLOUDFLARE_ANALYTICS_TOKEN/);
  assert.ok(!/CLOUDFLARE_API_TOKEN/.test(r.usageMeter));
  assert.ok(!/secret-analytics-token/.test(format(r)));
});
