// The members gate's pure parts (void-live-deploy/lib/member-gate.js): which pages are members-only, the signed cookie, and the
// D1 re-check that makes a removed member or an ended $1 trial stop at once. No browser, no network.
import test from 'node:test';
import assert from 'node:assert/strict';
import { gatedPath, signSession, readSession, cookieValue, sessionCookie, memberOk, COOKIE } from '../void-live-deploy/lib/member-gate.js';

test('the nav pages are gated; the offer, the API, the join tools and assets are not', () => {
  for (const p of ['/', '/index.html', '/void.html', '/team/', '/team', '/bots/', '/agent/', '/conquered/', '/tower', '/tower/', '/films/', '/podcast/', '/treasury/', '/starboard/', '/scoreboard/', '/security/', '/limits/', '/contribute/']) assert.equal(gatedPath(p), true, p);
  for (const p of ['/join/', '/join/join.js', '/members/', '/store/', '/store/x', '/api/team', '/api/member-session', '/team/join/vj1-abc', '/team/mcp', '/team/agents.txt', '/team/agent.mjs', '/lib/member-gate.js', '/skills/place.js', '/fonts/x.woff', '/verse.css', '/sw.js', '/robots.txt', '/.well-known/security.txt']) assert.equal(gatedPath(p), false, p);
  assert.equal(gatedPath('/towers'), false, 'a longer word is not the Tower');
  assert.equal(gatedPath('/agents.txt'), false, 'not the /agent/ page');
});

test('a session token is signed, round-trips, and refuses tampering and expiry', async () => {
  const secret = 'test-secret-not-a-key';
  const p = { v: 1, k: 'team', id: 'm1', name: 'Sam', until: 0, exp: Date.now() + 60000 };
  const t = await signSession(p, secret);
  assert.deepEqual(await readSession(t, secret), p);
  assert.equal(await readSession(t, 'another-secret'), null);
  assert.equal(await readSession(t.slice(0, -1) + (t.endsWith('0') ? '1' : '0'), secret), null, 'a changed signature is refused');
  assert.equal(await readSession(await signSession({ ...p, exp: Date.now() - 1 }, secret), secret), null, 'expired');
  assert.equal(await readSession('', secret), null);
  assert.equal(await readSession(t, ''), null);
});

test('the cookie is HttpOnly, Secure, SameSite=Lax and scoped to the site', () => {
  const c = sessionCookie('abc.def');
  assert.match(c, new RegExp('^' + COOKIE + '=abc\\.def;'));
  assert.match(c, /HttpOnly/); assert.match(c, /Secure/); assert.match(c, /SameSite=Lax/); assert.match(c, /Path=\//);
  const req = new Request('https://a-to-mind.com/team/', { headers: { cookie: 'a=1; verse_session=abc.def; b=2' } });
  assert.equal(cookieValue(req), 'abc.def');
  assert.equal(cookieValue(new Request('https://a-to-mind.com/')), '');
});

test('the cookie claim is re-checked against D1: active member or trial, paid account, owner; never a stale row', async () => {
  const rows = { m1: { role: 'member', off: 0, until: 0 }, m2: { role: 'member', off: 0, until: Date.now() - 1 }, m3: { role: 'member', off: 1, until: 0 }, a1: { tier: 'paid' }, a2: { tier: 'free' } };
  const env = { DB: { prepare: (sql) => ({ bind: (id) => ({ first: async () => (sql.includes('void_team_agents') ? rows[id] || null : sql.includes('void_accounts') ? rows[id] || null : null) }) }) } };
  const now = Date.now();
  const team = (id, exp = now + 60000) => ({ v: 1, k: 'team', id, exp });
  assert.equal(await memberOk(team('m1'), env, now), true, 'active member, no expiry');
  assert.equal(await memberOk(team('m2'), env, now), false, 'the $1 trial ended');
  assert.equal(await memberOk(team('m3'), env, now), false, 'the owner removed it');
  assert.equal(await memberOk(team('gone'), env, now), false);
  assert.equal(await memberOk({ v: 1, k: 'acct', id: 'a1', exp: now + 60000 }, env, now), true);
  assert.equal(await memberOk({ v: 1, k: 'acct', id: 'a2', exp: now + 60000 }, env, now), false);
  assert.equal(await memberOk({ v: 1, k: 'owner', id: 'owner', exp: now + 60000 }, env, now), true);
  assert.equal(await memberOk(team('m1', now - 1), env, now), false, 'expired cookie');
  assert.equal(await memberOk(team('m1'), null, now), false, 'no D1: nobody gets in on the claim alone');
});
