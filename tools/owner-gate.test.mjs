// lib/owner-gate.js and the middleware: files that name the sites Versus is measured against answer the owner (key or session in a header, or the
// owner session in the verse_owner cookie) and nobody else; /api/owner-cookie sets that cookie for the owner only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ownerOnlyPath, ownerGate } from '../void-live-deploy/lib/owner-gate.js';
import { mintOwnerSession } from '../void-live-deploy/lib/guard.js';
import { onRequest } from '../void-live-deploy/functions/_middleware.js';
import { onRequestPost } from '../void-live-deploy/functions/api/owner-cookie.js';

const env = { READ_TOKEN: 'owner-test-key', SALT: 'x', ASSETS: { fetch: async () => new Response('{}') } };
const get = (path, headers = {}, method = 'GET') => new Request('https://a-to-mind.com' + path, { headers, method });
const mw = (path, headers, method) => onRequest({ request: get(path, headers, method), env, next: async () => new Response('{"ok":1}', { headers: { 'cache-control': 'public, max-age=60' } }) });

test('which paths are owner-only', () => {
  for (const p of ['/tower.evidence.json', '/tower.shots/a-b.jpg', '/tower.icons/x.png', '/tower-evidence/a.json', '/rivals/index.json', '/history/some.site.json', '/assimilated.json', '/versus/compare.js', '/lib/tower.js', '/lib/versus-floor.js', '/versus/card.js', '/lib/treasury.js', '/treasury/policy.json'])
    assert.ok(ownerOnlyPath(p), p);
  for (const p of ['/', '/versus/', '/versus/open.js', '/history/', '/history/index.html', '/lib/avatar.js', '/skills/tower.js', '/lib/versus-sign.js', '/versus/open.js', '/api/versus-floor'])
    assert.ok(!ownerOnlyPath(p), p);
});

test('a visitor gets a 404, the owner key, an owner session header and the cookie get the file, private and never stored', async () => {
  assert.equal((await mw('/tower.evidence.json')).status, 404);
  assert.equal((await mw('/tower.evidence.json', { authorization: 'Bearer wrong' })).status, 404);
  assert.equal((await mw('/tower.evidence.json', { cookie: 'verse_owner=nope' })).status, 404);
  assert.equal((await mw('/tower.evidence.json', { authorization: 'Bearer owner-test-key' }, 'POST')).status, 404, 'reads only');
  const key = await mw('/versus/compare.js', { authorization: 'Bearer owner-test-key' });
  assert.equal(key.status, 200); assert.equal(key.headers.get('cache-control'), 'private, no-store');
  const { token } = await mintOwnerSession(env, 'test');
  assert.equal((await mw('/rivals/a.json', { authorization: 'Bearer ' + token })).status, 200);
  assert.equal((await mw('/rivals/a.json', { cookie: 'a=b; verse_owner=' + token + '; c=d' })).status, 200);
  assert.equal(await ownerGate(get('/x', { cookie: 'verse_owner=' + 'owner-test-key' }), env), false, 'the raw key is never accepted from a cookie');
});

test('/api/owner-cookie sets an owner session cookie for the owner and answers nobody else', async () => {
  const post = (headers) => onRequestPost({ request: get('/api/owner-cookie', headers, 'POST'), env });
  assert.equal((await post({})).status, 404); assert.equal((await post({ authorization: 'Bearer wrong' })).status, 404);
  const r = await post({ authorization: 'Bearer owner-test-key' });
  assert.equal(r.status, 204);
  const c = r.headers.get('set-cookie'); assert.match(c, /^verse_owner=vo1\./); assert.match(c, /HttpOnly/); assert.match(c, /Secure/); assert.match(c, /SameSite=Strict/);
  assert.ok(!c.includes('owner-test-key'));
  const tok = /^verse_owner=([^;]+)/.exec(c)[1];
  assert.equal((await mw('/tower.size.json', { cookie: 'verse_owner=' + tok })).status, 200);
});
