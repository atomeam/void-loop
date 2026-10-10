// node --test tools/share.test.mjs: bring someone into your Void (frontier #11, first piece). One Durable Object per invite
// relays stage changes between the tabs on it, and each tab shows the others' cursors as a faint presence.
// lib/share.js is the room (who is in it, what may pass, how fast); share-worker/index.js is the Durable Object around it;
// functions/api/share/ makes an invite (a signed-in member only) and hands a tab's WebSocket to the room.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mintRoom, roomOk, clean, Room, inviteLink, roomFromUrl, MAX_PEERS, RATE } from '../void-live-deploy/lib/share.js';
import { ShareRoom } from '../share-worker/index.js';
import { onRequestPost as mint } from '../void-live-deploy/functions/api/share/index.js';
import { onRequestGet as connect } from '../void-live-deploy/functions/api/share/[room].js';
import { guard, resetGuard } from '../void-live-deploy/lib/guard.js';
import inviteSkill from '../void-live-deploy/skills/invite.js';

const SECRET = 'test-salt-0123456789';
const peer = () => { const got = []; return { got, send: (m) => got.push(m) }; };

test('an invite is a room nobody can guess: a random name signed with the site secret', async () => {
  const a = await mintRoom(SECRET), b = await mintRoom(SECRET);
  assert.match(a, /^[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{16}$/);
  assert.notEqual(a, b);
  assert.equal(await roomOk(a, SECRET), true);
  assert.equal(await roomOk(a, 'another-secret-entirely'), false, 'signed by this site only');
  const [name, sig] = a.split('.');
  assert.equal(await roomOk(name + '.' + (sig[0] === 'A' ? 'B' : 'A') + sig.slice(1), SECRET), false, 'one changed letter is no room');
  for (const bad of ['', 'x', name, '../' + a, a + '?', null, undefined, 42]) assert.equal(await roomOk(bad, SECRET), false, String(bad));
  assert.equal(await roomOk(a, ''), false, 'no secret, no rooms');
  assert.equal(inviteLink('https://a-to-mind.com', a), 'https://a-to-mind.com/?with=' + a);
  assert.equal(roomFromUrl('https://a-to-mind.com/?with=' + a), a);
  assert.equal(roomFromUrl('https://a-to-mind.com/?with=nope'), null);
  assert.equal(roomFromUrl('https://a-to-mind.com/'), null);
});

test('only a cursor or a summon passes, small and well formed', () => {
  assert.deepEqual(clean(JSON.stringify({ t: 'cursor', x: 0.25, y: 0.5 })), { t: 'cursor', x: 0.25, y: 0.5 });
  assert.deepEqual(clean(JSON.stringify({ t: 'cursor', x: 7, y: -3 })), { t: 'cursor', x: 1, y: 0 }, 'kept on the screen');
  assert.deepEqual(clean(JSON.stringify({ t: 'summon', ask: '  a clock  ' })), { t: 'summon', ask: 'a clock' });
  assert.deepEqual(clean(JSON.stringify({ t: 'summon', ask: 'a clock', from: 'p9', html: '<img>' })), { t: 'summon', ask: 'a clock' }, 'nothing rides along');
  assert.deepEqual(clean(JSON.stringify({ t: 'cursor', x: 0.5, y: 0.5, from: 'p1' })), { t: 'cursor', x: 0.5, y: 0.5 }, 'nobody says they are someone else');
  for (const bad of ['', 'not json', '[]', 'null', JSON.stringify({ t: 'eval', code: '1' }), JSON.stringify({ t: 'cursor', x: 'a', y: 1 }),
    JSON.stringify({ t: 'cursor', x: NaN, y: 1 }), JSON.stringify({ t: 'summon', ask: '' }), JSON.stringify({ t: 'summon', ask: 'x'.repeat(121) }),
    JSON.stringify({ t: 'summon', ask: 5 }), 'x'.repeat(5000), new ArrayBuffer(8)]) assert.equal(clean(bad), null, String(bad).slice(0, 40));
});

test('the room relays what one tab does to the others, says who came and went, and stays small', () => {
  const room = new Room(), a = peer(), b = peer();
  const ia = room.join(a.send);
  assert.deepEqual(a.got.shift(), { t: 'hello', you: ia, peers: [] });
  const ib = room.join(b.send);
  assert.deepEqual(b.got.shift(), { t: 'hello', you: ib, peers: [ia] });
  assert.deepEqual(a.got.shift(), { t: 'join', id: ib }, 'the first tab sees the second arrive');
  assert.equal(room.message(ib, JSON.stringify({ t: 'cursor', x: 0.1, y: 0.2 })), 1);
  assert.deepEqual(a.got.shift(), { t: 'cursor', x: 0.1, y: 0.2, from: ib });
  assert.equal(b.got.length, 0, 'nobody hears their own echo');
  room.message(ia, JSON.stringify({ t: 'summon', ask: 'a timer for 5 minutes' }));
  assert.deepEqual(b.got.shift(), { t: 'summon', ask: 'a timer for 5 minutes', from: ia });
  assert.equal(room.message(ia, 'garbage'), 0, 'what does not pass is dropped, not relayed');
  assert.equal(room.message('nobody', JSON.stringify({ t: 'cursor', x: 0, y: 0 })), 0);
  room.leave(ib); room.leave(ib);
  assert.deepEqual(a.got, [{ t: 'left', id: ib }], 'leaving is said once');
  assert.equal(room.size, 1);
  const full = new Room(); for (let i = 0; i < MAX_PEERS; i++) assert.ok(full.join(() => {}));
  assert.equal(full.join(() => {}), null, 'a room holds ' + MAX_PEERS + ' tabs');
});

test('a tab that floods is slowed: past the rate a second, the rest of that second is dropped', () => {
  const room = new Room(), a = peer(), b = peer(), ia = room.join(a.send); room.join(b.send); b.got.length = 0;
  const msg = JSON.stringify({ t: 'cursor', x: 0.5, y: 0.5 });
  let sent = 0; for (let i = 0; i < RATE + 25; i++) sent += room.message(ia, msg, 1000);
  assert.equal(sent, RATE);
  assert.equal(room.message(ia, msg, 2001), 1, 'the next second starts fresh');
});

test('the Durable Object: each WebSocket joins the room, its messages go through it, closing leaves', () => {
  const sock = () => { const on = {}, sent = []; return { sent, on, accept() { this.accepted = true; }, addEventListener: (k, f) => { on[k] = f; }, send: (s) => sent.push(JSON.parse(s)), close(code) { this.closed = code; } }; };
  const doRoom = new ShareRoom({}, {});
  const s1 = sock(), s2 = sock();
  assert.ok(doRoom.accept(s1) && s1.accepted);
  doRoom.accept(s2);
  assert.equal(s2.sent[0].t, 'hello'); assert.equal(s1.sent[1].t, 'join');
  s2.on.message({ data: JSON.stringify({ t: 'summon', ask: 'a clock' }) });
  assert.deepEqual(s1.sent.at(-1), { t: 'summon', ask: 'a clock', from: s2.sent[0].you });
  s2.on.close({});
  assert.deepEqual(s1.sent.at(-1), { t: 'left', id: s2.sent[0].you });
  const busy = new ShareRoom({}, {}); for (let i = 0; i < MAX_PEERS; i++) busy.accept(sock());
  const late = sock(); assert.equal(busy.accept(late), null); assert.equal(late.closed, 4001, 'a full room says so and closes');
});

// the D1 rows a signed-in member has: any Bearer of the right shape with a live session row
const signedIn = { prepare: () => ({ bind: () => ({ first: async () => ({ user_id: 'u1', expires: Date.now() + 864e5 }) }) }) };
const nobody = { prepare: () => ({ bind: () => ({ first: async () => null }) }) };
const post = (auth) => new Request('https://a-to-mind.com/api/share', { method: 'POST', headers: auth ? { authorization: 'Bearer ' + 'k'.repeat(43) } : {} });

test('an invite is made for a signed-in member only', async () => {
  assert.equal((await mint({ request: post(false), env: { SALT: SECRET, DB: signedIn } })).status, 401);
  assert.equal((await mint({ request: post(true), env: { SALT: SECRET, DB: nobody } })).status, 401, 'a dead session makes nothing');
  assert.equal((await mint({ request: post(true), env: { DB: signedIn } })).status, 503, 'no secret on the site, no invites');
  const res = await mint({ request: post(true), env: { SALT: SECRET, DB: signedIn } });
  assert.equal(res.status, 200);
  const j = await res.json();
  assert.equal(await roomOk(j.room, SECRET), true);
  assert.equal(j.link, 'https://a-to-mind.com/?with=' + j.room);
  assert.equal(typeof j.live, 'boolean');
});

test('a tab joins a room only with a real invite, from Void itself, by WebSocket; without the relay it is told so', async () => {
  const room = await mintRoom(SECRET);
  const ws = (r, origin = 'https://a-to-mind.com', up = 'websocket') => new Request('https://a-to-mind.com/api/share/' + r, { headers: { upgrade: up, origin } });
  const forwarded = [];
  const SHARE = { idFromName: (n) => 'id:' + n, get: (id) => ({ fetch: async (req) => { forwarded.push(id); return new Response('relayed'); } }) };
  const env = { SALT: SECRET, SHARE };
  assert.equal((await connect({ request: ws(room, undefined, 'h2c'), env, params: { room } })).status, 426);
  assert.equal((await connect({ request: ws(room, 'https://evil.example'), env, params: { room } })).status, 403, 'another site cannot open a tab into a room');
  assert.equal((await connect({ request: ws('aaaaaaaaaaaaaaaa.bbbbbbbbbbbbbbbb'), env, params: { room: 'aaaaaaaaaaaaaaaa.bbbbbbbbbbbbbbbb' } })).status, 404, 'a guessed room is no room, and no Durable Object is woken for it');
  assert.deepEqual(forwarded, []);
  const off = await connect({ request: ws(room), env: { SALT: SECRET }, params: { room } });
  assert.equal(off.status, 503); assert.match((await off.json()).error, /not switched on/);
  assert.equal(await (await connect({ request: ws(room), env, params: { room } })).text(), 'relayed');
  assert.deepEqual(forwarded, ['id:' + room], 'one Durable Object per invite');
});

test('Void\'s guard hands an upgraded WebSocket through untouched', async () => {
  resetGuard();
  const up = { status: 101, webSocket: {}, headers: new Headers() };
  const out = await guard({ request: new Request('https://a-to-mind.com/api/share/x'), env: {}, next: async () => up });
  assert.equal(out, up);
});

test('"invite someone" is the ask; sharing a card stays the share skill', () => {
  for (const a of ['invite someone', 'invite a friend', 'Invite someone into my Void', 'bring someone in', 'bring a friend into my void', 'share my void live'])
    assert.ok(inviteSkill.match(a.toLowerCase(), a), a);
  for (const a of ['share this card', 'who invented the telephone', 'invite', 'how do i invite someone to a zoom call', 'send an invite to the party'])
    assert.ok(!inviteSkill.match(a.toLowerCase(), a), a);
});

test('the page: it joins by WebSocket, and when the relay is not there, tabs in one browser still share', async () => {
  const { join } = await import('../void-live-deploy/lib/share-client.js');
  const room = await mintRoom(SECRET);
  // a browser where the relay answers: the socket opens, the room says hello, a peer moves and summons
  const opened = [];
  class OkSocket { constructor(url) { this.url = url; this.sent = []; opened.push(this); setTimeout(() => { this.onopen && this.onopen(); this.onmessage({ data: JSON.stringify({ t: 'hello', you: 'p2', peers: ['p1'] }) }); }, 0); } send(s) { this.sent.push(JSON.parse(s)); } close() { this.closed = true; } }
  const seen = [], hooks = { summon: (a) => seen.push(['summon', a]), presence: (id, x, y) => seen.push(['at', id, x, y]), gone: (id) => seen.push(['gone', id]), note: (t) => seen.push(['note', t]) };
  const s = join(room, hooks, { WebSocket: OkSocket, location: { protocol: 'https:', host: 'a-to-mind.com' } });
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(opened[0].url, 'wss://a-to-mind.com/api/share/' + room);
  assert.equal(s.mode, 'live');
  opened[0].onmessage({ data: JSON.stringify({ t: 'cursor', x: 0.5, y: 0.25, from: 'p1' }) });
  opened[0].onmessage({ data: JSON.stringify({ t: 'summon', ask: 'a clock', from: 'p1' }) });
  opened[0].onmessage({ data: JSON.stringify({ t: 'summon', ask: '<script>', html: 1, from: 'p1' }) }); // whatever a room sends, the page cleans it again
  opened[0].onmessage({ data: JSON.stringify({ t: 'left', id: 'p1' }) });
  assert.deepEqual(seen.filter((x) => x[0] !== 'note'), [['at', 'p1', 0.5, 0.25], ['summon', 'a clock'], ['summon', '<script>'], ['gone', 'p1']]);
  s.cursor(0.1, 0.9); s.summoned('a timer');
  assert.deepEqual(opened[0].sent, [{ t: 'cursor', x: 0.1, y: 0.9 }, { t: 'summon', ask: 'a timer' }]);
  s.leave(); assert.ok(opened[0].closed);

  // a browser where the relay is not switched on: the socket fails before it opens, and a BroadcastChannel takes over
  class NoSocket { constructor() { setTimeout(() => this.onclose && this.onclose({ code: 1006 }), 0); } send() { throw new Error('closed'); } close() {} }
  const chans = [];
  class Chan { constructor(name) { this.name = name; chans.push(this); } postMessage(m) { for (const c of chans) if (c !== this && c.name === this.name && c.onmessage) c.onmessage({ data: structuredClone(m) }); } close() { this.closed = true; } }
  const env = { WebSocket: NoSocket, BroadcastChannel: Chan, location: { protocol: 'https:', host: 'a-to-mind.com' } };
  const seenA = [], seenB = [];
  const mk = (out) => ({ summon: (a) => out.push(['summon', a]), presence: (id) => out.push(['at']), gone: () => out.push(['gone']), note: (t) => out.push(['note', t]) });
  const A = join(room, mk(seenA), env), B = join(room, mk(seenB), env);
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(A.mode, 'tabs'); assert.equal(B.mode, 'tabs');
  assert.ok(seenA.some((x) => x[0] === 'note' && /this browser/.test(x[1])), 'the page says the share is this browser only');
  A.summoned('a clock'); B.cursor(0.3, 0.3);
  assert.deepEqual(seenB.filter((x) => x[0] === 'summon'), [['summon', 'a clock']]);
  assert.deepEqual(seenA.filter((x) => x[0] === 'at'), [['at']]);
  B.leave();
  assert.deepEqual(seenA.filter((x) => x[0] === 'gone'), [['gone']], 'closing the tab ends its presence');
});
