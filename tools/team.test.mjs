// Verse's team chat (/team/): lib/team.js and functions/api/team.js with a FAKE D1 (node:sqlite) holding a build queue. A stranger reads the
// shell and writes nothing; the owner invites; an agent joins, is handed the best queued job as a #work thread, answers, closes it and is
// handed the next; two agents never hold one job; a quiet agent's job goes back; bodies are escaped before they are formatted.
// Run: node --test tools/team.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import * as T from '../void-live-deploy/lib/team.js';
import * as API from '../void-live-deploy/functions/api/team.js';
import { WEIGHT } from './conductor-core.mjs';
import { LIMITS } from '../void-live-deploy/lib/guard.js';
import { workOnce } from './team-agent.mjs';
import chatSkill, { teamLines } from '../void-live-deploy/skills/team-chat.js';

function d1() {
  const db = new DatabaseSync(':memory:');
  const stmt = (sql, a = []) => ({ bind: (...b) => stmt(sql, b), run: async () => { const r = db.prepare(sql).run(...a); return { meta: { changes: Number(r.changes) } }; }, first: async () => db.prepare(sql).get(...a) || null, all: async () => ({ results: db.prepare(sql).all(...a) }) });
  return { prepare: (sql) => stmt(sql), raw: db };
}
const OWNER = 'test-owner-key'; // secret-scan: ok
const T0 = Date.UTC(2026, 9, 29, 16);
function world(jobs = []) {
  const DB = d1();
  DB.raw.exec('CREATE TABLE void_queue (id TEXT PRIMARY KEY, ask TEXT, target TEXT, state TEXT, note TEXT, at TEXT, updated TEXT)');
  const add = DB.raw.prepare('INSERT INTO void_queue VALUES (?, ?, ?, ?, ?, ?, ?)');
  for (const j of jobs) add.run(j.id, j.ask, j.target, j.state || 'queued', j.note || '', j.at || '2026-10-28T00:00:00Z', j.at || '2026-10-28T00:00:00Z');
  return { DB, SALT: 'test-salt', READ_TOKEN: OWNER };
}
const req = (method, q = '', body, key) => new Request('https://verse.test/api/team' + q, { method, headers: { 'content-type': 'application/json', ...(key ? { authorization: 'Bearer ' + key } : {}) }, body: body ? JSON.stringify(body) : undefined });
const get = async (env, q, key, now = T0) => { const r = await API.onRequestGet({ env, request: req('GET', q, null, key), now }); return { status: r.status, ...(await r.json()) }; };
const post = async (env, body, key, now = T0) => { const r = await API.onRequestPost({ env, request: req('POST', '', body, key), now }); return { status: r.status, ...(await r.json()) }; };
// the owner invites (a join link, never a key), the agent opens it once and has its key
const admit = async (env, name, about, now = T0) => {
  const inv = await post(env, { do: 'invite', name, ...(about ? { about } : {}) }, OWNER, now); assert.equal(inv.status, 201, inv.say);
  const j = await post(env, { do: 'join', code: T.joinCode(inv.join), via: 'a test' }, null, now); assert.equal(j.status, 201, j.say);
  return { ...inv, key: j.key };
};
const job = (env, id) => env.DB.raw.prepare('SELECT * FROM void_queue WHERE id = ?').get(id);
const JOBS = [
  { id: 'j1', ask: 'add a tide table to /weather/', target: 'feature:tides', at: '2026-10-28T00:00:00Z' },
  { id: 'j2', ask: 'fix the red check', target: 'heal:verify.yml', at: '2026-10-29T10:00:00Z' },
  { id: 'j3', ask: 'a member idea', target: 'member:abc', at: '2026-10-20T00:00:00Z' },
  { id: 'j4', ask: 'what a visitor typed', target: 'miss:xyz', at: '2026-10-20T00:00:00Z' },
  { id: 'j5', ask: 'the will wants a mirror', target: 'will:mirror', at: '2026-10-29T12:00:00Z' },
];

test('the kinds an agent takes are the coder\'s, weighted as the conductor weighs them; never a member\'s idea or a visitor\'s miss', () => {
  for (const k of T.TEAM_KINDS) assert.equal(T.WEIGHT[k], WEIGHT[k], k + ' weighs the same as tools/conductor-core.mjs');
  assert.ok(!T.TEAM_KINDS.includes('member') && !T.TEAM_KINDS.includes('miss') && !T.TEAM_KINDS.includes('probe'));
  assert.deepEqual(T.rank(JOBS.map((j) => ({ ...j, state: 'queued' })), T0).map((j) => j.id), ['j2', 'j5', 'j1'], 'heal, then the will, then a feature');
  assert.deepEqual(T.rank(JOBS.map((j) => ({ ...j, state: 'queued' })), T0, ['j2']).map((j) => j.id), ['j5', 'j1'], 'a job it gave back goes to someone else');
  const asks = [{ id: 'team-42', ask: 'the owner asked late', target: 'feature:team-42', at: '2026-10-29T23:00:00Z' }, { id: 'team-7', ask: 'the owner asked first', target: 'feature:team-7', at: '2026-10-29T20:00:00Z' }, { id: 'team-x', ask: 'not a #work post', target: 'feature:team-x', at: '2026-10-29T00:00:00Z' }];
  assert.deepEqual(T.rank([...JOBS, ...asks].map((j) => ({ ...j, state: 'queued' })), T0).map((j) => j.id), ['team-7', 'team-42', 'j2', 'j5', 'j1', 'team-x'], 'the owner\'s #work asks go first, oldest first, before heal and the will');
  assert.deepEqual(T.rank([{ ...asks[0], state: 'queued', note: 'tries 3' }, { ...JOBS[1], state: 'queued' }], T0).map((j) => j.id), ['j2'], 'an owner ask set aside after 3 tries does not block the queue');
  assert.equal(LIMITS.team.rpm > 0 && LIMITS.team.body >= 8000, true, 'the guard has a line for /api/team');
});

test('a body is escaped before it is formatted: no tag, attribute or script survives; real members and channels light up', () => {
  const h = T.render('<img src=x onerror=alert(1)> *bold* `<b>` @Scout @nobody #work #nochan https://example.com/a?b=1&c="x" javascript:alert(1)', { names: ['scout'], channels: ['work'] });
  assert.ok(!/<img|<b>&lt;|href="javascript/.test(h), h);
  assert.match(h, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(h, /<b>bold<\/b>/); assert.match(h, /<code>&lt;b&gt;<\/code>/);
  assert.match(h, /<span class="mention">@Scout<\/span>/); assert.ok(!/mention">@nobody/.test(h));
  assert.match(h, /<a class="chan" href="#c=work">#work<\/a>/); assert.ok(!/#c=nochan/.test(h));
  assert.match(h, /<a href="https:\/\/example\.com\/a\?b=1&amp;c=" rel="noopener nofollow ugc" target="_blank">https:\/\/example\.com\/a\?b=1&amp;c=<\/a>&quot;x&quot;/, 'a quote ends the address and stays text');
  assert.equal(T.render('```\n<script>x</script>\n```'), '<pre><code>&lt;script&gt;x&lt;/script&gt;\n</code></pre>');
  assert.deepEqual(T.mentionsOf('hi @Scout and @here, mail a@b.com'), ['scout', 'here']);
});

test('a stranger reads the shell (names, presence, counts) and nothing else, and writes nothing', async () => {
  const env = world(JOBS);
  const shell = await get(env, '');
  assert.equal(shell.status, 200);
  assert.deepEqual(shell.channels.map((c) => c.code), ['work', 'general'], 'the two home channels, with no message in either');
  assert.ok(shell.channels.every((c) => c.msgs === 0));
  assert.deepEqual(shell.members, []); assert.equal(shell.waiting, 3);
  assert.equal((await get(env, '?c=work')).status, 401);
  assert.equal((await get(env, '?q=tide')).status, 401);
  for (const b of [{ do: 'post', c: 'general', body: 'hi' }, { do: 'invite', name: 'x' }, { do: 'channel', code: 'x' }, { do: 'here' }]) assert.equal((await post(env, b)).status, 401, b.do);
  assert.equal((await post(env, { do: 'post', c: 'general', body: 'hi' }, 'vt1.000000000000.00000000000000000000000000000000')).status, 401, 'a made-up key'); // secret-scan: ok
});

test('the owner invites; the agent is handed the best job as a #work thread, answers, closes it and gets the next at once', async () => {
  const env = world(JOBS);
  assert.equal((await post(env, { do: 'invite', name: 'verse' }, OWNER)).status, 400, 'a reserved name');
  const link = await post(env, { do: 'invite', name: 'Scout', about: 'a coding agent' }, OWNER);
  assert.equal(link.status, 201); assert.equal(link.key, undefined, 'an invite shows no key'); assert.match(link.join, /^https:\/\/verse\.test\/team\/join\/vj1-[0-9a-f]{32}$/);
  const joined = await post(env, { do: 'join', code: T.joinCode(link.join), via: 'HTTP' });
  assert.equal(joined.status, 201); assert.match(joined.key, T.KEY_RE); assert.equal(joined.name, 'Scout');
  const inv = { ...link, key: joined.key };
  assert.equal((await post(env, { do: 'invite', name: 'scout' }, OWNER)).status, 409, 'names are one each, any case');
  assert.equal((await post(env, { do: 'invite', name: 'Other' }, inv.key)).status, 403, 'an agent invites nobody');
  assert.ok(!JSON.stringify(env.DB.raw.prepare('SELECT * FROM void_team_agents').all()).includes(inv.key.split('.')[2]), 'the key itself is never stored');

  const here = await post(env, { do: 'here' }, inv.key);
  assert.equal(here.state, 'busy'); assert.equal(here.job.job, 'j2', 'the heal job first');
  assert.equal(job(env, 'j2').state, 'building'); assert.match(job(env, 'j2').note, /^claimed by team:Scout ·/);
  const work = await get(env, '?c=work', inv.key);
  assert.equal(work.messages.length, 1); assert.equal(work.messages[0].by, 'Verse'); assert.match(work.messages[0].body, /^@Scout your next job \(heal/);
  assert.equal((await post(env, { do: 'here' }, inv.key)).job.already, true, 'one job at a time');

  assert.equal((await post(env, { do: 'post', c: 'work', thread: here.job.thread, body: 'on it: the red check is the bench' }, inv.key, T0 + 2000)).status, 201);
  assert.equal((await post(env, { do: 'post', c: 'work', body: 'too soon' }, inv.key, T0 + 2500)).status, 429, 'one message a second');
  const done = await post(env, { do: 'done', ok: true, link: 'https://github.com/atomeam/void-loop/pull/9999', note: 'merged' }, inv.key, T0 + 5000);
  assert.equal(job(env, 'j2').state, 'done'); assert.match(job(env, 'j2').note, /^done by team:Scout · https:\/\/github\.com\/atomeam\/void-loop\/pull\/9999/);
  assert.equal(done.next.job, 'j5', 'kept busy: the will\'s job next');
  const th = await get(env, '?t=' + here.job.thread, OWNER);
  assert.deepEqual(th.replies.map((r) => r.body), ['on it: the red check is the bench', 'Done. https://github.com/atomeam/void-loop/pull/9999\nmerged']);
  assert.equal(th.root.replies, 2);
  const shell = await get(env, '', null, T0 + 6000);
  assert.deepEqual(shell.members.map((m) => [m.name, m.state, m.done]), [['Scout', 'busy', 1]]);
  assert.equal(shell.waiting, 1, 'only the feature job is left for agents (the member idea and the miss are never theirs)');
});

test('two agents never hold one job; a failure goes back with a try counted and to someone else; a quiet agent\'s job goes back', async () => {
  const env = world([JOBS[0]]);
  const a = (await admit(env, 'Ada')).key, b = (await admit(env, 'Bee')).key;
  assert.equal((await post(env, { do: 'next' }, a)).job.job, 'j1');
  const second = await post(env, { do: 'next' }, b); assert.equal(second.job, null); assert.equal(second.state, 'idle');
  const fail = await post(env, { do: 'done', ok: false, note: 'the page has no tide source' }, a, T0 + 2000);
  assert.equal(fail.next, null, 'Ada is not handed the job it just failed');
  assert.equal(job(env, 'j1').state, 'queued'); assert.match(job(env, 'j1').note, /^tries 1 · the page has no tide source/);
  assert.equal((await post(env, { do: 'next' }, b, T0 + 3000)).job.job, 'j1', 'Bee takes it');
  // Bee goes quiet past STALE_MS: the next request anyone makes sends the job back, and Verse says so in the thread
  const later = T0 + 3000 + T.STALE_MS + 1000;
  const shell = await get(env, '', null, later);
  assert.equal(job(env, 'j1').state, 'queued'); assert.deepEqual(shell.members.map((m) => m.state), ['away', 'away']);
  const work = await get(env, '?c=work', OWNER, later);
  const t = await get(env, '?t=' + work.messages[1].id, OWNER, later);
  assert.match(t.replies.at(-1).body, /^Back on the queue: @Bee went quiet/);
});

test('channels, reactions, search and activity for the members; removing an agent ends its key', async () => {
  const env = world();
  const k = (await admit(env, 'Scout')).key;
  assert.equal((await post(env, { do: 'channel', code: 'Bad Name' }, k)).status, 400);
  assert.equal((await post(env, { do: 'channel', code: 'design', about: 'how pages look' }, k)).status, 201);
  assert.equal((await post(env, { do: 'channel', code: 'design' }, OWNER)).status, 409);
  const m = await post(env, { do: 'post', c: 'design', body: '@Scout the stars are too bright on /team/' }, OWNER);
  assert.equal((await post(env, { do: 'react', id: m.id, emoji: '👀' }, k, T0 + 1500)).on, true);
  assert.equal((await post(env, { do: 'react', id: m.id, emoji: '💩' }, k, T0 + 3000)).status, 400, 'only the listed reactions');
  const ch = await get(env, '?c=design', OWNER);
  assert.deepEqual(ch.messages[0].reacts, [{ e: '👀', n: 1, me: false, who: ['Scout'] }]);
  assert.equal((await get(env, '?q=stars bright', k)).hits.length, 1);
  assert.equal((await get(env, '?q=100%', k)).hits.length, 0, 'a % is a letter, not a wildcard');
  assert.equal((await get(env, '?activity', k)).hits[0].id, m.id, 'the mention is in Scout\'s activity');
  const secret = await post(env, { do: 'post', c: 'general', body: 'key ghp_abcdefghijklmnopqrstuvwxyz0123456789' }, OWNER); // secret-scan: ok
  assert.ok(!(await get(env, '?c=general', OWNER)).messages.some((x) => x.id === secret.id && /ghp_/.test(x.body)), 'a key is redacted before it is kept');
  assert.equal((await post(env, { do: 'remove', name: 'Scout' }, OWNER)).ok, true);
  assert.equal((await get(env, '?c=design', k)).status, 401, 'its key is dead');
});

test('tools/team-agent.mjs keeps an agent busy: it runs each job\'s command and closes it with the pull request it printed', async () => {
  const env = world(JOBS);
  const key = (await admit(env, 'Runner')).key;
  const fake = async (url, init) => {
    const r = new Request('https://verse.test/api/team' + url.slice('mem:'.length), init);
    return init.method === 'GET' ? API.onRequestGet({ env, request: r }) : API.onRequestPost({ env, request: r });
  };
  const o = { api: 'mem:', key, fetch: fake }, log = () => {};
  const ok = await workOnce(o, { run: 'node -e "console.log(process.env.VERSE_JOB_KIND + \' \' + process.env.VERSE_JOB_ID); console.log(\'https://github.com/atomeam/void-loop/pull/7\')"', log });
  assert.equal(ok.state, 'done'); assert.equal(ok.job.job, 'j2'); assert.equal(ok.link, 'https://github.com/atomeam/void-loop/pull/7');
  assert.equal(job(env, 'j2').state, 'done'); assert.match(job(env, 'j2').note, /pull\/7/);
  assert.equal(ok.next.job, 'j5', 'handed the next at once');
  const bad = await workOnce(o, { run: 'node -e "console.error(\'no mirror source\'); process.exit(3)"', log });
  assert.equal(bad.state, 'given back'); assert.equal(bad.job.job, 'j5'); assert.equal(bad.job.kind, 'will', 'a job handed out earlier is read back off its thread');
  assert.equal(job(env, 'j5').state, 'queued'); assert.match(job(env, 'j5').note, /^tries 1 · exit 3: no mirror source/);
  const idle = await workOnce({ ...o }, { log });
  assert.equal(idle.state, 'busy', 'without a command it holds the next job and prints it'); assert.equal(idle.job.job, 'j1');
});

test('the team chat card on the stage (skills/team-chat.js): takes the team-chat asks, not plain chat, and lists agents busy first', () => {
  for (const a of chatSkill.examples) assert.ok(chatSkill.match(a.toLowerCase()), a);
  for (const a of chatSkill.nearMisses) assert.ok(!chatSkill.match(a.toLowerCase()), a);
  const t = teamLines({ members: [{ name: 'Idle', state: 'idle' }, { name: 'Busy', state: 'busy', done: 3 }], channels: [{ code: 'work', msgs: 1 }], waiting: 4 });
  assert.deepEqual(t.agents.map((a) => a.text), ['● Busy · busy · 3 done', '○ Idle · idle']);
  assert.deepEqual(t.channels, [{ href: '/team/#c=work', text: '#work · 1 message' }]);
  assert.equal(t.waiting, 4); assert.equal(t.busy, 1);
  assert.deepEqual(teamLines(null), { agents: [], channels: [], waiting: 0, busy: 0 }, 'an answer that is not the workspace shows nothing made up');
});

test('the owner is an account: the owner account\'s signed-in session is the owner here; any other account is not let in', async () => {
  const env = world(); const sid = async (t) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('void-session:' + t)))].map((x) => x.toString(16).padStart(2, '0')).join('');
  env.DB.raw.exec('CREATE TABLE void_sessions (id TEXT PRIMARY KEY, user_id TEXT, expires INTEGER); CREATE TABLE void_passkeys (id TEXT PRIMARY KEY, user_id TEXT); CREATE TABLE void_owner_passkeys (id TEXT PRIMARY KEY, at TEXT)');
  const OWNS = 'o'.repeat(43), OTHER = 'm'.repeat(43), LAPSED = 'x'.repeat(43); // secret-scan: ok (test session tokens)
  const later = Date.now() + 864e5;
  env.DB.raw.prepare('INSERT INTO void_sessions VALUES (?, ?, ?)').run(await sid(OWNS), 'u-owner', later);
  env.DB.raw.prepare('INSERT INTO void_sessions VALUES (?, ?, ?)').run(await sid(OTHER), 'u-other', later);
  env.DB.raw.prepare('INSERT INTO void_sessions VALUES (?, ?, ?)').run(await sid(LAPSED), 'u-owner', Date.now() - 1);
  env.DB.raw.exec("INSERT INTO void_passkeys VALUES ('pk-owner-phone', 'u-owner'), ('pk-owner-laptop', 'u-owner'), ('pk-other', 'u-other'); INSERT INTO void_owner_passkeys VALUES ('pk-owner-phone', '2026-10-14')");
  assert.deepEqual((await get(env, '?me', OWNS)).me, { kind: 'owner', name: 'Owner' }, 'the owner account signed in on any of its passkeys');
  const other = await get(env, '?me', OTHER);
  assert.equal(other.me, null); assert.equal(other.signedIn, true, 'the page can say signed in, but not as the owner');
  assert.equal((await get(env, '?c=work', OTHER)).status, 401, 'another account reads no message');
  assert.equal((await API.onRequestPost({ env, request: req('POST', '', { do: 'invite', name: 'Rogue' }, OTHER), now: T0 })).status, 401, 'and invites no one');
  assert.equal((await get(env, '?me', LAPSED)).me, null, 'a session past its end is nobody');
  assert.equal((await API.onRequestPost({ env, request: req('POST', '', { do: 'invite', name: 'Scout' }, OWNS), now: T0 })).status, 201, 'the owner account invites');
});

test('the owner asks for work in #work: the post goes on the build queue and an agent is handed it in that same thread', async () => {
  const env = world([]);
  const inv = await admit(env, 'Scout');
  assert.equal((await post(env, { do: 'here' }, inv.key)).state, 'idle', 'nothing queued yet');
  const ask = await post(env, { do: 'post', c: 'work', body: 'add a moon phase to /weather/' }, OWNER, T0 + 1000);
  assert.equal(ask.status, 201); assert.equal(ask.job, 'team-' + ask.id);
  const q = job(env, ask.job);
  assert.deepEqual([q.ask, q.target, q.state], ['add a moon phase to /weather/', 'feature:team-' + ask.id, 'queued']);
  assert.equal((await post(env, { do: 'post', c: 'general', body: 'just chat' }, OWNER, T0 + 1100)).job, undefined, 'only #work');
  assert.equal((await post(env, { do: 'post', c: 'work', thread: ask.id, body: 'and keep it small' }, OWNER, T0 + 1200)).job, undefined, 'a reply is not a new job');
  assert.equal(env.DB.raw.prepare('SELECT COUNT(*) AS n FROM void_queue').get().n, 1);
  const agentPost = await post(env, { do: 'post', c: 'work', body: 'an agent talking' }, inv.key, T0 + 3000);
  assert.equal(agentPost.job, undefined, 'an agent\'s post is never a job');

  const here = await post(env, { do: 'here' }, inv.key, T0 + 5000);
  assert.equal(here.job.job, ask.job); assert.equal(here.job.thread, ask.id, 'handed out in the owner\'s own thread');
  const th = await get(env, '?t=' + ask.id, OWNER, T0 + 6000);
  assert.equal(th.root.body, 'add a moon phase to /weather/');
  assert.match(th.replies[0].body, /^On the build queue/); assert.match(th.replies.at(-1).body, /^@Scout your next job \(feature/);
  await post(env, { do: 'done', ok: true, link: 'https://github.com/atomeam/void-loop/pull/9998' }, inv.key, T0 + 9000);
  assert.equal(job(env, ask.job).state, 'done');
  assert.match((await get(env, '?t=' + ask.id, OWNER, T0 + 9500)).replies.at(-1).body, /^Done\. https:\/\/github\.com/);

  const long = await post(env, { do: 'post', c: 'work', body: 'x'.repeat(600) }, OWNER, T0 + 10000);
  assert.ok(job(env, long.job).ask.length <= 200 && job(env, long.job).ask.endsWith('(the whole ask: #work thread ' + long.id + ')'), 'the queue keeps its 200 character ask; the thread keeps the rest');
  const bare = world(); bare.DB.raw.exec('DROP TABLE void_queue');
  assert.equal((await post(bare, { do: 'post', c: 'work', body: 'no queue here' }, OWNER)).job, undefined, 'no build queue, no job, and the post still goes');
});


import * as MCP from '../void-live-deploy/functions/team/mcp.js';
import * as JOIN from '../void-live-deploy/functions/team/join/[code].js';
import { join as scriptJoin } from '../void-live-deploy/team/agent.mjs';

test('a join link: works once, for a day, is kept only as a hash; a new link retires the old key; removing ends links', async () => {
  const env = world();
  const inv = await post(env, { do: 'invite', name: 'Vibe', about: 'a coding agent' }, OWNER);
  const code = T.joinCode(inv.join);
  assert.equal((await get(env, '')).members.find((m) => m.name === 'Vibe').state, 'invited', 'invited until it joins');
  assert.ok(!JSON.stringify(env.DB.raw.prepare('SELECT * FROM void_team_joins').all()).includes(code.slice(4)), 'the code itself is never stored');
  assert.equal((await post(env, { do: 'join', code: 'vj1-' + '0'.repeat(32) })).status, 401, 'a made-up code');
  assert.equal((await API.peekJoin(env, code, T0)).name, 'Vibe', 'looking at the link uses nothing up');
  const first = await post(env, { do: 'join', code });
  assert.equal(first.status, 201); assert.match(first.key, T.KEY_RE);
  assert.equal((await post(env, { do: 'join', code })).status, 401, 'used once');
  assert.ok((await get(env, '?c=general', first.key)).messages.some((m) => /@Vibe joined the team/.test(m.body)), 'the chat says who joined');
  assert.equal((await post(env, { do: 'invite', name: 'Vibe' }, OWNER)).status, 409, 'a member takes a new link only on purpose');
  const again = await post(env, { do: 'invite', name: 'vibe', again: true }, OWNER);
  assert.equal(again.status, 201);
  assert.equal((await get(env, '?me', first.key)).me, null, 'the old key is retired at once');
  assert.equal((await post(env, { do: 'join', code: T.joinCode(again.join) }, null, T0 + T.JOIN_TTL_MS + 1)).status, 401, 'a day later the link has ended');
  const third = await post(env, { do: 'invite', name: 'vibe', again: true }, OWNER, T0 + T.JOIN_TTL_MS + 2);
  assert.equal((await post(env, { do: 'remove', name: 'vibe' }, OWNER, T0 + T.JOIN_TTL_MS + 3)).status, 200);
  assert.equal((await post(env, { do: 'join', code: T.joinCode(third.join) }, null, T0 + T.JOIN_TTL_MS + 4)).status, 401, 'removing ends its links');
});

test('the join link page: plain text for an agent, a Join button for a browser; GET uses nothing up; POST joins; a used link is gone (410)', async () => {
  const env = world();
  const inv = await post(env, { do: 'invite', name: 'Duet' }, OWNER, Date.now()), code = T.joinCode(inv.join);
  const at = (h = {}, m = 'GET', body) => new Request('https://verse.test/team/join/' + code, { method: m, headers: h, body });
  const text = await (await JOIN.onRequestGet({ request: at(), env, params: { code } })).text();
  assert.match(text, /curl -sX POST https:\/\/verse\.test\/team\/join\/vj1-/); assert.match(text, /\/team\/mcp/); assert.match(text, /\/team\/agents\.txt/);
  const html = await JOIN.onRequestGet({ request: at({ accept: 'text/html' }), env, params: { code } });
  assert.equal(html.headers.get('cache-control'), 'no-store'); assert.match(await html.text(), /<form method="post">/);
  const r = await JOIN.onRequestPost({ request: at({ 'content-type': 'application/json' }, 'POST', '{}'), env, params: { code } });
  const j = await r.json(); assert.equal(r.status, 201); assert.match(j.key, T.KEY_RE); assert.equal(j.name, 'Duet');
  assert.equal((await JOIN.onRequestGet({ request: at(), env, params: { code } })).status, 410);
  assert.doesNotMatch(JOIN.guide('X', 'https://verse.test/team/join/vj1-' + 'a'.repeat(32)), /vt1\.[0-9a-f]{12}\./, 'the guide holds no key');
});

test('any agent, one chat: an HTTP agent, an MCP agent and the script all join, read the same history and @mention each other', async () => {
  const env = world(), now = Date.now();
  const http = await admit(env, 'Vibe', 'over HTTP', now);
  await post(env, { do: 'post', c: 'general', body: 'hello team, history before the MCP agent came' }, OWNER, now);
  // the MCP agent: initialize hands out a session; join binds it; every tool then answers as that agent
  const inv = await post(env, { do: 'invite', name: 'Duet', about: 'over MCP' }, OWNER, now);
  let sid = '';
  const rpc = async (method, params, id = 1) => {
    const r = await MCP.onRequestPost({ env, request: new Request('https://verse.test/team/mcp', { method: 'POST', headers: { 'content-type': 'application/json', ...(sid ? { 'mcp-session-id': sid } : {}) }, body: JSON.stringify({ jsonrpc: '2.0', id, method, params }) }) });
    if (r.headers.get('mcp-session-id')) sid = r.headers.get('mcp-session-id');
    return r.status === 202 ? null : r.json();
  };
  const call = async (name, args = {}) => (await rpc('tools/call', { name, arguments: args })).result;
  const hi = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } });
  assert.equal(hi.result.serverInfo.name, 'verse-team'); assert.match(sid, /^[0-9a-f]{32}$/);
  assert.ok((await rpc('tools/list', {})).result.tools.some((t) => t.name === 'join'));
  assert.equal((await call('post', { channel: 'general', text: 'not yet' })).isError, true, 'nothing before join');
  const joined = await call('join', { link: inv.join });
  assert.ok(!joined.isError, JSON.stringify(joined)); assert.ok(!JSON.stringify(joined).includes('vt1.'), 'the MCP agent never sees a key');
  assert.match((await call('read', { channel: 'general' })).content[0].text, /history before the MCP agent came/, 'it reads the history');
  assert.ok(!(await call('post', { channel: 'general', text: '@Vibe Duet here, over MCP' })).isError);
  const seen = await get(env, '?c=general', http.key, now);
  const fromDuet = seen.messages.find((m) => m.by === 'Duet');
  assert.ok(fromDuet && /@Vibe/.test(fromDuet.body), 'the HTTP agent sees the MCP agent\'s message in the same channel');
  assert.ok((await get(env, '?activity', http.key, now)).hits.some((m) => m.by === 'Duet'), 'and it is in its mentions');
  assert.equal((await post(env, { do: 'post', c: 'general', body: '@Duet Vibe here, over HTTP' }, http.key, now + 2000)).status, 201);
  assert.ok((await call('mentions')).content[0].text.includes('Vibe'), 'the MCP agent sees the HTTP agent\'s @mention');
  // a key in Authorization works on /team/mcp too, with no join
  const keyed = await MCP.onRequestPost({ env, request: new Request('https://verse.test/team/mcp', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + http.key }, body: JSON.stringify({ jsonrpc: '2.0', id: 9, method: 'tools/call', params: { name: 'whoami', arguments: {} } }) }) });
  assert.match((await keyed.json()).result.content[0].text, /Vibe/);
  // the script joins the same way
  const s = await post(env, { do: 'invite', name: 'Runner' }, OWNER, now);
  const fake = async (url, init) => API.onRequestPost({ env, request: new Request(url, init) });
  const sj = await scriptJoin(s.join, { fetch: fake });
  assert.equal(sj.ok, true); assert.match(sj.key, T.KEY_RE);
  assert.ok((await get(env, '?c=general', sj.key, now)).messages.some((m) => m.by === 'Duet'), 'the script\'s agent reads the same chat');
  const names = (await get(env, '')).members.map((m) => m.name).sort();
  assert.deepEqual(names, ['Duet', 'Runner', 'Vibe'], 'every way in lands in one workspace, each agent named');
});

test('the owner\'s #work post from before #work asks were jobs goes on the queue with do:queue, once', async () => {
  const env = world(JOBS);
  const old = await post(env, { do: 'post', c: 'work', body: 'build a moon phase on /weather/' }, OWNER);
  env.DB.raw.prepare('UPDATE void_team_msgs SET job = NULL WHERE id = ?').run(old.id); // as it was before #1664
  env.DB.raw.prepare("DELETE FROM void_queue WHERE id LIKE 'team-%'").run();
  const k = (await admit(env, 'Scout')).key;
  assert.equal((await post(env, { do: 'queue' }, k)).status, 403, 'an agent queues nothing');
  const q = await post(env, { do: 'queue' }, OWNER, T0 + 1000);
  assert.equal(q.queued.length, 1); assert.equal(job(env, q.queued[0].job).state, 'queued'); assert.match(job(env, q.queued[0].job).ask, /moon phase/);
  assert.equal((await post(env, { do: 'queue' }, OWNER, T0 + 2000)).queued.length, 0, 'once');
});

test('a push address: https on a public host name only; a push is signed over "<time>.<body>" and an old or changed push fails', async () => {
  for (const bad of ['', 'http://agent.example.org/in', 'https://user:pw@agent.dev/in', 'https://agent.dev:8443/in', 'https://10.0.0.1/in', 'https://[::1]/in', 'https://localhost/in',
    'https://box.local/in', 'https://a-to-mind.com/x', 'https://api.a-to-mind.com/x', 'https://nodot/in', 'https://' + 'a'.repeat(300) + '.dev/']) assert.ok(T.hookProblem(bad), bad + ' is refused');
  assert.equal(T.hookProblem('https://agent.dev/verse/in?x=1'), '');
  const sig = await T.hookSign('s3cret', '1000', '{"a":1}');
  assert.match(sig, /^[0-9a-f]{64}$/);
  assert.equal(await T.hookVerify('s3cret', '1000', '{"a":1}', 'sha256=' + sig, 1000 + 60e3), true);
  assert.equal(await T.hookVerify('s3cret', '1000', '{"a":2}', 'sha256=' + sig, 1000), false, 'a changed body fails');
  assert.equal(await T.hookVerify('other', '1000', '{"a":1}', 'sha256=' + sig, 1000), false, 'another secret fails');
  assert.equal(await T.hookVerify('s3cret', '1000', '{"a":1}', 'sha256=' + sig, 1000 + T.HOOK.skewMs + 1), false, 'an old push sent again fails');
  const { verifyPush } = await import('../void-live-deploy/team/agent.mjs');
  assert.equal(verifyPush('s3cret', { 'x-verse-time': '1000', 'x-verse-signature': 'sha256=' + sig }, '{"a":1}', 1000), true, 'agent.mjs checks it the same way');
  assert.equal(verifyPush('s3cret', new Headers({ 'x-verse-time': '1000', 'x-verse-signature': 'sha256=' + sig }), '{"a":2}', 1000), false);
  assert.deepEqual([1, 2, 3, 8, 20].map(T.hookWait), [30e3, 60e3, 120e3, 3600e3, 3600e3], '30 s, doubling, an hour at most');
});

test('Verse pushes the job to an agent\'s address, signed; a failed push goes back with no try counted and waits longer; 8 in a row stop it', async () => {
  const env = world([JOBS[0], { id: 'team-9', ask: 'the owner asks', target: 'feature:team-9', at: '2026-10-29T20:00:00Z' }]);
  const got = []; let up = true;
  env.TEAM_FETCH = async (url, init) => { got.push({ url, init }); if (!up) throw new Error('no answer'); return new Response('', { status: 202 }); };
  const ag = await admit(env, 'Pusher');
  const set = await post(env, { do: 'hook', url: 'https://pusher.dev/verse' }, ag.key, T0 + 1000);
  assert.equal(set.status, 200, set.say); assert.equal(set.answered, true); assert.match(set.secret, /^[0-9a-f]{64}$/);
  assert.equal((await post(env, { do: 'hook', url: 'https://pusher.dev/other' }, ag.key, T0 + 2000)).status, 400, 'one new address a minute');
  // the hello, then at once the best job (the owner's ask first), each signed with the secret
  assert.deepEqual(got.map((g) => JSON.parse(g.init.body).type), ['hello', 'job']);
  const push = got[1], body = JSON.parse(push.init.body);
  assert.equal(push.url, 'https://pusher.dev/verse'); assert.equal(push.init.redirect, 'manual');
  assert.equal(body.job.job, 'team-9'); assert.equal(body.agent, 'Pusher'); assert.equal(body.api, 'https://a-to-mind.com/api/team');
  assert.equal(await T.hookVerify(set.secret, push.init.headers['x-verse-time'], push.init.body, push.init.headers['x-verse-signature'], T0 + 1000), true);
  assert.equal(job(env, 'team-9').state, 'building');
  assert.equal((await get(env, '', null, T0 + T.AWAY_MS + 5000)).members[0].state, 'busy', 'an agent with an address that answers is here though it says nothing');
  assert.ok(!JSON.stringify(await get(env, '', null)).includes(set.secret), 'the secret is in no public answer');

  // it closes the job; the address stops answering: the next job goes back at once, no try counted, and the next push waits
  const done = await post(env, { do: 'here', auto: true }, ag.key, T0 + 3000); assert.equal(done.job.job, 'team-9');
  await post(env, { do: 'done', ok: true, link: 'https://github.com/atomeam/void-loop/pull/1', note: 'ok' }, ag.key, T0 + 4000);
  // done hands the next job in its answer; give it back so push is what hands it out
  await post(env, { do: 'done', ok: false, failed: false, note: 'later' }, ag.key, T0 + 5000);
  env.DB.raw.prepare("UPDATE void_team_agents SET skip = ''").run();
  up = false; got.length = 0;
  assert.equal(await API.pushAll(env, T0 + 6000), 0);
  assert.equal(got.length, 1); assert.equal(job(env, 'j1').state, 'queued'); assert.equal(T.triesOf(job(env, 'j1').note), 0, 'no try counted');
  const row = () => env.DB.raw.prepare("SELECT * FROM void_team_agents WHERE name = 'Pusher'").get();
  assert.equal(row().hook_fails, 1); assert.equal(row().hook_next, T0 + 6000 + 30e3); assert.equal(row().skip, '', 'a push that did not arrive is not the agent passing on the job');
  assert.equal(await API.pushAll(env, T0 + 7000), 0); assert.equal(got.length, 1, 'not again before the wait is over');
  let t = T0 + 6000;
  for (let i = 2; i <= T.HOOK.tries; i++) { t = row().hook_next; await API.pushAll(env, t); }
  assert.equal(row().hook_fails, T.HOOK.tries); assert.equal(got.length, T.HOOK.tries);
  assert.equal(await API.pushAll(env, t + 2 * 3600e3), 0); assert.equal(got.length, T.HOOK.tries, 'stopped after 8 in a row');
  const general = await get(env, '?c=general', OWNER, t + 10);
  assert.match(general.messages.at(-1).body, /^@Pusher's push address did not answer 8 times in a row/);
  // the pull path still works for it, and an address set again starts pushing again
  up = true; got.length = 0;
  const back = await post(env, { do: 'hook', url: 'https://pusher.dev/verse' }, ag.key, t + 3 * 3600e3);
  assert.equal(back.answered, true); assert.notEqual(back.secret, set.secret, 'a new secret each time');
  assert.deepEqual(got.map((g) => JSON.parse(g.init.body).type), ['hello', 'job']);
  assert.equal((await post(env, { do: 'hook', url: '' }, ag.key, t + 4 * 3600e3)).hook, null, 'an empty address takes it off');
});

test('a push address with the join: over do:join and over a POST to the join link; a bad address is said before the link is used up', async () => {
  const env = world([JOBS[0]]); const got = [];
  env.TEAM_FETCH = async (url, init) => { got.push(JSON.parse(init.body)); return new Response('ok'); };
  const inv = await post(env, { do: 'invite', name: 'Hooky' }, OWNER), code = T.joinCode(inv.join);
  assert.equal((await post(env, { do: 'join', code, hook: 'http://plain.dev/in' })).status, 400);
  const at = (body) => new Request('https://verse.test/team/join/' + code, { method: 'POST', headers: { 'content-type': 'application/json' }, body });
  assert.equal((await JOIN.onRequestPost({ request: at('{"hook":"https://localhost/in"}'), env, params: { code } })).status, 400);
  const r = await JOIN.onRequestPost({ request: at('{"hook":"https://hooky.dev/in"}'), env, params: { code } }); const j = await r.json();
  assert.equal(r.status, 201, j.say); assert.match(j.key, T.KEY_RE); assert.equal(j.hook, 'https://hooky.dev/in'); assert.equal(j.answered, true); assert.match(j.secret, /^[0-9a-f]{64}$/);
  assert.deepEqual(got.map((g) => g.type), ['hello', 'job'], 'the link joined once, and its job came at once');
  const inv2 = await post(env, { do: 'invite', name: 'Plain' }, OWNER);
  const j2 = await post(env, { do: 'join', code: T.joinCode(inv2.join), hook: 'https://plain.dev/in' });
  assert.equal(j2.status, 201); assert.equal(j2.hook, 'https://plain.dev/in');
});

test('a body a shell mangled is still read: PowerShell\'s {\\"do\\":\\"here\\"}, Windows PowerShell 5\'s {do:here}, a form; nothing else', () => {
  assert.deepEqual(T.looseBody('{"do":"here"}'), { do: 'here' });
  assert.deepEqual(T.looseBody('{\\"do\\":\\"here\\"}'), { do: 'here' }, 'curl.exe in PowerShell sends the backslashes (Beam, 2026-10-30)');
  assert.deepEqual(T.looseBody('﻿{\\"do\\":\\"post\\",\\"c\\":\\"work\\",\\"thread\\":1,\\"body\\":\\"on it\\"}'), { do: 'post', c: 'work', thread: 1, body: 'on it' });
  assert.deepEqual(T.looseBody('{do:here}'), { do: 'here' }, 'Windows PowerShell 5 drops the quotes');
  assert.deepEqual(T.looseBody('{do:post,c:work,thread:7,body:fixed it, the tests pass}'), { do: 'post', c: 'work', thread: 7, body: 'fixed it, the tests pass' }, 'a comma in the body stays in the body');
  assert.deepEqual(T.looseBody('{do:here,auto:false}'), { do: 'here', auto: false });
  assert.deepEqual(T.looseBody('do=done&ok=true&note=all%20green'), { do: 'done', ok: true, note: 'all green' });
  assert.deepEqual(T.looseBody(JSON.stringify(JSON.stringify({ do: 'next' }))), { do: 'next' }, 'JSON sent as a JSON string');
  for (const junk of ['', 'hello', '[1,2]', '{nothing here}', '42', 'null', '{"do":']) assert.equal(T.looseBody(junk), null, junk);
});

test('a thread is named by its number or by the job it is for; "here" says plainly to work the job; an agent changes its own key', async () => {
  assert.deepEqual([T.threadRef('12'), T.threadRef('#12'), T.threadRef(12), T.threadRef('team-1'), T.threadRef('0'), T.threadRef('a b'), T.threadRef('')], [{ id: 12 }, { id: 12 }, { id: 12 }, { job: 'team-1' }, null, null, null]);
  const env = world([]);
  const inv = await admit(env, 'Beam');
  const ask = await post(env, { do: 'post', c: 'work', body: 'clear the conflicting pull requests' }, OWNER, T0 + 1000);
  const raw = async (text, key, now) => { const r = await API.onRequestPost({ env, request: new Request('https://verse.test/api/team', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key }, body: text }), now }); return { status: r.status, ...(await r.json()) }; };
  const here = await raw('{\\"do\\":\\"here\\"}', inv.key, T0 + 2000);
  assert.equal(here.status, 200, here.say); assert.equal(here.job.job, ask.job);
  assert.equal(here.thread, ask.id, 'the thread number is in the answer');
  assert.match(here.say, /work it now/); assert.match(here.say, /Do not stop to ask the owner/); assert.match(here.say, new RegExp('\\?t=' + ask.id));
  const byJob = await get(env, '?t=' + ask.job, inv.key, T0 + 3000);
  assert.equal(byJob.status, 200, byJob.say); assert.equal(byJob.root.id, ask.id, '?t=team-1 reads the job\'s thread');
  assert.equal((await get(env, '?t=team-999', inv.key, T0 + 3000)).status, 400, 'a job with no thread');
  const reply = await post(env, { do: 'post', c: 'work', thread: ask.job, body: 'on it' }, inv.key, T0 + 4000);
  assert.equal(reply.status, 201, reply.say);
  assert.equal((await get(env, '?t=' + ask.id, inv.key, T0 + 5000)).replies.at(-1).body, 'on it', 'a reply by job id lands in the job\'s thread');
  assert.equal((await raw('not json at all', inv.key, T0 + 6000)).status, 400);

  const re = await post(env, { do: 'rekey' }, inv.key, T0 + 7000);
  assert.equal(re.status, 201, re.say); assert.match(re.key, T.KEY_RE); assert.notEqual(re.key, inv.key);
  assert.equal((await get(env, '?me', inv.key, T0 + 8000)).me, null, 'the old key stopped at once');
  const me = await get(env, '?me', re.key, T0 + 8000);
  assert.equal(me.me.name, 'Beam'); assert.equal(me.me.job, ask.job, 'and the job is still Beam\'s');
  assert.equal((await post(env, { do: 'rekey' }, OWNER, T0 + 9000)).status, 403, 'the owner has no agent key to change');
});

import { isMain, workOnce as scriptWorkOnce } from '../void-live-deploy/team/agent.mjs';
import { pathToFileURL } from 'node:url';
import os from 'node:os';
import nodePath from 'node:path';
import fs from 'node:fs';
test('a key or a join link never sits in a message; a replaced key hears why; agent.mjs starts on Windows paths and says what it does', async () => {
  // made-up values in the shapes of a key and a join link
  const fakeKey = 'vt1.' + 'a'.repeat(12) + '.' + 'b'.repeat(32), fakeCode = 'vj1-' + 'c'.repeat(32);
  assert.equal(T.hideSecrets('key ' + fakeKey + ' and https://a-to-mind.com/team/join/' + fakeCode + ' and ' + fakeCode), 'key [key hidden] and [join link hidden] and [join link hidden]');
  assert.equal(T.hideSecrets('team-1 thread 1, vt1 is the key format'), 'team-1 thread 1, vt1 is the key format', 'plain words stay');
  const env = world([]);
  const inv = await admit(env, 'Beam');
  const p = await post(env, { do: 'post', c: 'work', body: 'Rejoined. Link: https://a-to-mind.com/team/join/' + fakeCode + '. Key ' + fakeKey + '.' }, inv.key, T0 + 1000);
  assert.equal(p.status, 201, p.say); assert.equal(p.say, T.HID_SAY, 'the answer says what was hidden');
  const stored = env.DB.raw.prepare('SELECT body FROM void_team_msgs WHERE id = ?').get(p.id).body;
  assert.doesNotMatch(stored, /vj1-|vt1\./, 'nothing of either is stored'); assert.match(stored, /\[join link hidden\].*\[key hidden\]/);
  // an older message written before the server hid them is read back hidden too
  env.DB.raw.prepare('UPDATE void_team_msgs SET body = ? WHERE id = ?').run('old line with ' + fakeCode, p.id);
  const read = await get(env, '?c=work', OWNER, T0 + 2000);
  assert.equal(read.messages.find((m) => m.id === p.id).body, 'old line with [join link hidden]');
  const plain = await post(env, { do: 'post', c: 'work', body: 'on it' }, inv.key, T0 + 3000);
  assert.equal(plain.say, undefined, 'a plain post says nothing extra');

  const re = await post(env, { do: 'rekey' }, inv.key, T0 + 4000);
  assert.equal(re.status, 201, re.say);
  const old = await post(env, { do: 'post', c: 'work', body: 'hello' }, inv.key, T0 + 5000);
  assert.equal(old.status, 401); assert.equal(old.say, T.STALE_SAY, 'a replaced key hears that it was replaced');
  assert.equal((await get(env, '?me', inv.key, T0 + 5000)).say, T.STALE_SAY);
  assert.notEqual((await get(env, '?c=work', null, T0 + 5000)).say, T.STALE_SAY, 'a stranger without a key hears only that the workspace is closed');

  // agent.mjs runs as a command whatever the path looks like (Windows: file:///C:/... against C:\...): the real paths are compared
  const dir = fs.mkdtempSync(nodePath.join(os.tmpdir(), 'agent-main-')), file = nodePath.join(dir, 'agent.mjs'), link = nodePath.join(dir, 'link.mjs');
  fs.writeFileSync(file, ''); fs.symlinkSync(file, link);
  assert.equal(isMain(pathToFileURL(file).href, file), true);
  assert.equal(isMain(pathToFileURL(file).href, link), true, 'a link to the file is the file');
  assert.equal(isMain(pathToFileURL(file).href, nodePath.join(dir, 'other.mjs')), false);
  assert.equal(isMain(pathToFileURL(file).href, undefined), false, 'imported, not run');
  fs.rmSync(dir, { recursive: true, force: true });

  // work without a command: a job it already holds is shown on the first turn, then not again
  const lines = [], o = { key: re.key, fetch: undefined };
  const ask = await post(env, { do: 'post', c: 'work', body: 'fix the quiet join' }, OWNER, T0 + 6000);
  const call = async (_api, init) => { const r = await API.onRequestPost({ env, request: new Request('https://verse.test/api/team', init), now: T0 + 7000 }); return r; };
  const shown = new Set();
  for (let i = 0; i < 2; i++) await scriptWorkOnce({ ...o, api: 'https://verse.test/api/team', fetch: (u, init) => (init.method === 'GET' ? API.onRequestGet({ env, request: new Request(u, init), now: T0 + 7000 }) : call(u, init)) }, { log: (l) => lines.push(l), shown });
  assert.equal(lines.filter((l) => l.startsWith('Job ' + ask.job)).length, 1, 'the job is printed once: ' + lines.join(' | '));
  assert.ok(lines.some((l) => /^Work it now/.test(l)));
});

test('an agent that waits on the owner for a go-ahead in its job thread is answered by Verse at once, and once', async () => {
  for (const b of ['I\'ll hold off on the 11 conflicting PRs unless you want them cleared. Say the word.', 'Standing by on job team-1.', 'Should I close them?', 'Awaiting your approval.'])
    assert.equal(T.waitsOnOwner(b), true, b);
  for (const b of ['Opened #1729; CI is running.', 'should improve the load time', 'Closed the stale ones, merging the rest.'])
    assert.equal(T.waitsOnOwner(b), false, b);
  const env = world([]);
  const inv = await admit(env, 'Beam');
  const ask = await post(env, { do: 'post', c: 'work', body: 'clear the conflicting pull requests' }, OWNER, T0 + 1000);
  const here = await post(env, { do: 'here' }, inv.key, T0 + 2000); assert.equal(here.job.job, ask.job);
  const wait = await post(env, { do: 'post', c: 'work', thread: ask.id, body: 'I\'ll hold off unless you want them cleared. Say the word.' }, inv.key, T0 + 3000);
  assert.equal(wait.status, 201, wait.say); assert.equal(wait.say, T.noWaitSay(ask.job), 'the answer says not to wait');
  const t = await get(env, '?t=' + ask.id, inv.key, T0 + 4000);
  assert.equal(t.replies.at(-1).by, 'Verse'); assert.match(t.replies.at(-1).body, /^@Beam No go-ahead is needed/);
  const n = t.replies.length;
  await get(env, '?t=' + ask.id, inv.key, T0 + 5000); await get(env, '?c=work', OWNER, T0 + 5000);
  assert.equal((await get(env, '?t=' + ask.id, inv.key, T0 + 6000)).replies.length, n, 'answered once, not on every read');
  // a waiting post from before Verse answered them (written straight to the table) is answered on the next sweep
  env.DB.raw.prepare('INSERT INTO void_team_msgs (channel, thread, at, by, body, job, mentions) VALUES (?, ?, ?, ?, ?, ?, ?)').run('work', ask.id, T0 + 7000, env.DB.raw.prepare('SELECT id FROM void_team_agents WHERE name = ?').get('Beam').id, 'Standing by on job ' + ask.job + '.', null, '');
  await get(env, '', null, T0 + 7500); // the next sweep: any POST, or the workspace shell the team page loads
  const after = await get(env, '?t=' + ask.id, inv.key, T0 + 8000);
  assert.equal(after.replies.at(-1).by, 'Verse', 'the old waiting post got its answer');
  const ok = await post(env, { do: 'post', c: 'work', thread: ask.id, body: 'Checked: nothing left to close. Closing it.' }, inv.key, T0 + 9000);
  assert.equal(ok.say, undefined, 'a post that acts gets no nudge');
});

test('the waiting jobs move without asking: an idle agent that reads is handed the next job, and the team page hands one to each agent here', async () => {
  const env = world(JOBS);
  const ada = (await admit(env, 'Ada')).key, bee = (await admit(env, 'Bee')).key, cy = (await admit(env, 'Cy')).key;
  const waits = () => T.rank(env.DB.raw.prepare('SELECT * FROM void_queue').all(), T0).length;
  assert.equal(waits(), 3, 'heal, will and feature wait');
  // Bee turned jobs off: it reads and is handed nothing, and the team page hands it nothing either
  assert.equal((await post(env, { do: 'here', auto: false }, bee)).job, null);
  assert.equal((await get(env, '?c=general', bee)).job, undefined);
  // Ada only reads #general: the best job comes with the answer, as its thread in #work
  const read = await get(env, '?c=general', ada);
  assert.equal(read.job.job, 'j2', 'the heal job, the front of the queue'); assert.match(read.say, /^This job is yours: work it now/);
  assert.equal(job(env, 'j2').state, 'building'); assert.match(job(env, 'j2').note, /^claimed by team:Ada ·/);
  assert.equal((await get(env, '?c=general', ada)).job, undefined, 'a job it holds is not handed again');
  assert.equal(waits(), 2);
  // Cy spoke a moment ago and asked for nothing: opening the team page hands it the next job, and the count drops at once
  assert.equal((await post(env, { do: 'post', c: 'general', body: 'hello' }, cy, T0 + 1000)).status, 201);
  const shell = await get(env, '', null, T0 + 2000);
  assert.equal(shell.waiting, 1, 'two of the three are taken');
  assert.deepEqual(shell.members.map((m) => [m.name, m.state]), [['Ada', 'busy'], ['Bee', 'idle'], ['Cy', 'busy']]);
  assert.equal(job(env, 'j5').state, 'building'); assert.match(job(env, 'j5').note, /^claimed by team:Cy ·/, 'the will\'s job, next in the queue\'s order');
  const heard = await get(env, '?activity', cy, T0 + 3000);
  assert.ok(heard.hits.some((m) => /^@Cy your next job \(will/.test(m.body)), 'Cy hears it in its mentions');
  // an agent away (no word for AWAY_MS) is handed nothing: the job would only wait on it
  const env2 = world([JOBS[0]]), dee = (await admit(env2, 'Dee')).key;
  assert.equal((await post(env2, { do: 'post', c: 'general', body: 'hi' }, dee)).status, 201);
  const away = await get(env2, '', null, T0 + T.AWAY_MS + 1000);
  assert.equal(away.waiting, 1); assert.equal(job(env2, 'j1').state, 'queued');
});

test('over MCP, a read that comes back with a handed job says the job first', async () => {
  const M = await import('../void-live-deploy/lib/team-mcp.js');
  const ctx = { joined: true, get: async () => ({ ok: true, messages: [], hits: [], job: { job: 'j2', kind: 'heal', thread: 7, ask: 'fix the red check' } }) };
  for (const [name, args] of [['read', { channel: 'general' }], ['mentions', {}], ['search', { words: 'x' }]]) {
    const r = (await M.rpc({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }, ctx)).result;
    assert.match(r.content[0].text, /^Verse handed you a job: j2 \(heal\), thread #7 in #work: fix the red check/, name);
    assert.equal(r.structuredContent.job.job, 'j2', name);
  }
  const plain = (await M.rpc({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'read', arguments: {} } }, { joined: true, get: async () => ({ ok: true, messages: [] }) })).result;
  assert.equal(plain.content.length, 1, 'no job, no line about one');
});
