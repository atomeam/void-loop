// tools/key-keeper.mjs against a fake Cloudflare: Verse mints a scoped, expiring child key per job, sweeps only its own expired keys,
// and never prints a token value.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mint, sweep, status, tokenBody, groupsFor, JOBS } from './key-keeper.mjs';

const GROUPS = [{ id: 'g-ai-r', name: 'Workers AI Read' }, { id: 'g-ai-w', name: 'Workers AI Write' }, { id: 'g-r2-r', name: 'Workers R2 Storage Read' },
  { id: 'g-r2-w', name: 'Workers R2 Storage Write' }, { id: 'g-an', name: 'Account Analytics Read' }, { id: 'g-tok', name: 'Account API Tokens Write' }];
const ENV = { CF_KEYMASTER_TOKEN: 'master-secret', CLOUDFLARE_ACCOUNT_ID: 'acct1', GITHUB_RUN_ID: '42' };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
const NOW = new Date('2026-10-30T16:00:00Z');

function fakeCf({ tokens = [], groups = GROUPS, denyDelete = false } = {}) {
  const calls = [];
  const fn = async (url, o) => {
    calls.push({ url, method: o.method, auth: o.headers.authorization, body: o.body ? JSON.parse(o.body) : null });
    if (o.headers.authorization !== 'Bearer master-secret') return json({ success: false, errors: [{ code: 10000, message: 'Authentication error' }] }, 403);
    if (/\/tokens\/permission_groups$/.test(url)) return json({ success: true, result: groups });
    if (o.method === 'POST' && /\/accounts\/acct1\/tokens$/.test(url)) return json({ success: true, result: { id: 'new1', value: 'child-secret-value' } });
    if (o.method === 'GET' && /\/accounts\/acct1\/tokens\?/.test(url)) return json({ success: true, result: tokens });
    if (o.method === 'DELETE') return denyDelete ? json({ success: false, errors: [{ code: 9109, message: 'not allowed' }] }, 403) : json({ success: true, result: { id: 'x' } });
    return json({ success: false }, 404);
  };
  return { fn, calls };
}

test('key-keeper: the coder gets a Workers AI key scoped to this account only, expiring in 3 hours', async () => {
  const cf = fakeCf();
  const m = await mint('coder', ENV, cf.fn, NOW);
  assert.equal(m.minted, true); assert.equal(m.env, 'CLOUDFLARE_AI_TOKEN'); assert.equal(m.value, 'child-secret-value');
  const post = cf.calls.find((c) => c.method === 'POST');
  assert.deepEqual(post.body.policies[0].permission_groups, [{ id: 'g-ai-r' }, { id: 'g-ai-w' }]);
  assert.deepEqual(Object.keys(post.body.policies[0].resources), ['com.cloudflare.api.account.acct1']);
  assert.equal(post.body.expires_on, '2026-10-30T19:00:00Z');
  assert.match(post.body.name, /^verse-coder-202610301600-42$/);
  assert.ok(!post.body.policies[0].permission_groups.some((g) => g.id === 'g-tok'), 'a child key can never make keys');
});

test('key-keeper: no keymaster means no mint and a plain reason, so the job keeps its old secret', async () => {
  const m = await mint('coder', { CLOUDFLARE_ACCOUNT_ID: 'acct1' }, async () => { throw new Error('must not call'); });
  assert.equal(m.minted, false); assert.match(m.why, /CF_KEYMASTER_TOKEN is not set/);
});

test('key-keeper: a missing permission group or a refused call is named, never thrown, and never carries a value', async () => {
  const m = await mint('coder', ENV, fakeCf({ groups: GROUPS.filter((g) => g.name !== 'Workers AI Write') }).fn, NOW);
  assert.equal(m.minted, false); assert.match(m.why, /no permission group named Workers AI Write/);
  const bad = await mint('coder', { ...ENV, CF_KEYMASTER_TOKEN: 'wrong' }, fakeCf().fn, NOW);
  assert.equal(bad.minted, false); assert.match(bad.why, /answered 403 code 10000/); assert.doesNotMatch(bad.why, /wrong|acct1/);
});

test('key-keeper: the sweep deletes only Verse\'s own expired keys', async () => {
  const cf = fakeCf({ tokens: [
    { id: 'a', name: 'verse-coder-1', status: 'active', expires_on: '2026-10-30T15:00:00Z' },
    { id: 'b', name: 'verse-coder-2', status: 'active', expires_on: '2026-10-30T18:00:00Z' },
    { id: 'c', name: 'deploy (Adam)', status: 'expired', expires_on: '2026-01-01T00:00:00Z' },
    { id: 'd', name: 'verse-r2-1', status: 'expired' } ] });
  const s = await sweep(ENV, cf.fn, NOW);
  assert.deepEqual([s.swept, s.kept], [2, 1]);
  assert.deepEqual(cf.calls.filter((c) => c.method === 'DELETE').map((c) => c.url.split('/').pop()), ['a', 'd']);
});

test('key-keeper: a refused delete is reported, and the key still expires on its own', async () => {
  const s = await sweep(ENV, fakeCf({ denyDelete: true, tokens: [{ id: 'a', name: 'verse-ai-1', status: 'expired' }] }).fn, NOW);
  assert.equal(s.swept, 0); assert.match(s.why, /1 not deleted \(they expire on their own\)/);
});

test('key-keeper: status says which jobs the keymaster can mint, by name only', async () => {
  const s = await status(ENV, fakeCf({ groups: GROUPS.filter((g) => !/R2/.test(g.name)) }).fn);
  assert.equal(s.keymaster, true);
  assert.deepEqual(s.jobs.map((j) => [j.job, j.ok]), Object.keys(JOBS).map((j) => [j, j !== 'r2']));
  assert.ok(!JSON.stringify(s).includes('master-secret'));
});

test('key-keeper: every job asks for a named group and lives a few hours at most', () => {
  for (const [job, spec] of Object.entries(JOBS)) {
    assert.ok(spec.hours > 0 && spec.hours <= 6, job); assert.ok(spec.groups.length > 0, job);
    assert.ok(!spec.groups.some((g) => /API Tokens/.test(g)), job + ' must not mint keys itself');
  }
  assert.throws(() => groupsFor('nope', GROUPS), /no such job/);
  assert.equal(tokenBody('r2', 'acct1', [{ id: 'g' }], NOW).expires_on, '2026-10-30T18:00:00Z');
});
