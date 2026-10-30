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
  const inv = await post(env, { do: 'invite', name: 'Scout', about: 'a coding agent' }, OWNER);
  assert.equal(inv.status, 201); assert.match(inv.key, T.KEY_RE);
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
  const a = (await post(env, { do: 'invite', name: 'Ada' }, OWNER)).key, b = (await post(env, { do: 'invite', name: 'Bee' }, OWNER)).key;
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
  const k = (await post(env, { do: 'invite', name: 'Scout' }, OWNER)).key;
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
  const key = (await post(env, { do: 'invite', name: 'Runner' }, OWNER)).key;
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
