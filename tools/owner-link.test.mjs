// lib/owner-link.js: one owner identity in the browser. A browser holding the owner key keeps it (and binds its signed-in account
// once per tab); a fresh owner session is kept; a stale or missing one is renewed through /api/passkey 'owner' with the account
// session; a 401 is remembered for the tab so a member's account asks once; a failed or odd answer leaves what was there.
// Run: node --test tools/owner-link.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

const DAY = 864e5;
const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; };
const session = (msFromNow) => 'vo1.' + (Date.now() + msFromNow).toString(36) + '.sig';
let calls = [], reply = null, events = [];
function reset({ owner = '', me = '' } = {}) {
  globalThis.localStorage = mem(); globalThis.sessionStorage = mem(); calls = []; events = [];
  if (owner) localStorage.setItem('a2m.void.owner.v1', owner);
  if (me) localStorage.setItem('a2m.void.me.v1', JSON.stringify({ token: me }));
}
globalThis.fetch = async (url, init) => { calls.push({ url, auth: init.headers.authorization, body: JSON.parse(init.body) }); return reply(); };
globalThis.CustomEvent = class { constructor(type, o) { this.type = type; this.detail = o && o.detail; } };
globalThis.dispatchEvent = (e) => events.push(e.type);
const ok = (j) => () => ({ status: 200, json: async () => j });
const { ownerLink, ownerFresh } = await import('../void-live-deploy/lib/owner-link.js');

test('ownerFresh: the key itself is always fresh, a session only with more than a day left', () => {
  assert.equal(ownerFresh(''), false);
  assert.equal(ownerFresh('the-owner-key'), true);
  assert.equal(ownerFresh(session(2 * DAY)), true);
  assert.equal(ownerFresh(session(DAY / 2)), false);
  assert.equal(ownerFresh('vo1..sig'), false);
});
test('no owner token and no account: nothing is asked', async () => {
  reset(); reply = ok({});
  assert.equal(await ownerLink(), '');
  assert.equal(calls.length, 0);
});
test('a fresh owner session is kept without a request', async () => {
  const s = session(3 * DAY); reset({ owner: s, me: 'acct-session-123456' }); reply = ok({});
  assert.equal(await ownerLink(), s);
  assert.equal(calls.length, 0);
});
test('a signed-in account renews a stale owner session, keeps it and tells the page', async () => {
  const fresh = session(7 * DAY); reset({ owner: session(DAY / 4), me: 'acct-session-123456' }); reply = ok({ session: { token: fresh } });
  assert.equal(await ownerLink(), fresh);
  assert.equal(localStorage.getItem('a2m.void.owner.v1'), fresh);
  assert.deepEqual(calls.map((c) => [c.url, c.auth, c.body.step]), [['/api/passkey', 'Bearer acct-session-123456', 'owner']]);
  assert.deepEqual(events, ['verse-owner']);
});
test("a member's account gets a 401 once per tab, then is not asked again", async () => {
  reset({ me: 'member-session-abcdef' }); reply = () => ({ status: 401, json: async () => ({}) });
  assert.equal(await ownerLink(), '');
  assert.equal(await ownerLink(), '');
  assert.equal(calls.length, 1);
});
test('an answer that is no owner session, or a server error, leaves what was there', async () => {
  const stale = session(DAY / 4);
  reset({ owner: stale, me: 'acct-session-123456' }); reply = ok({ session: { token: 'not-a-session' } });
  assert.equal(await ownerLink(), stale);
  reset({ owner: stale, me: 'acct-session-123456' }); reply = () => ({ status: 500, json: async () => ({}) });
  assert.equal(await ownerLink(), stale);
  reset({ owner: stale, me: 'acct-session-123456' }); reply = () => { throw new Error('offline'); };
  assert.equal(await ownerLink(), stale);
  assert.equal(localStorage.getItem('a2m.void.owner.v1'), stale);
});
test('the owner key stays, and binds the signed-in account once per tab', async () => {
  reset({ owner: 'the-owner-key', me: 'acct-session-123456' }); reply = ok({});
  assert.equal(await ownerLink(), 'the-owner-key');
  assert.equal(await ownerLink(), 'the-owner-key');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].auth, 'Bearer the-owner-key');
  assert.deepEqual(calls[0].body, { step: 'owner-bind-account', session: 'acct-session-123456' });
});
test('two calls at once share one request', async () => {
  reset({ owner: session(DAY / 4), me: 'acct-session-123456' }); reply = ok({ session: { token: session(7 * DAY) } });
  const [a, b] = await Promise.all([ownerLink(), ownerLink()]);
  assert.equal(a, b);
  assert.equal(calls.length, 1);
});
