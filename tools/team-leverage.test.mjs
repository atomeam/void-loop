// Verse's leverage score and overlap check (lib/team-leverage.js; lib/team-priorities.js scoreOf; functions/api/team.js handOut, deconflict
// and the board): one piece of work goes to one seat, the highest-leverage job goes out first, busywork never goes out, and every card says
// its score and why. Owner, 2026-11-06: "make sure verse is not causing overlap"; "never busywork for the sake of nothing".
// Run: node --test tools/team-leverage.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import * as L from '../void-live-deploy/lib/team-leverage.js';
import * as P from '../void-live-deploy/lib/team-priorities.js';
import * as API from '../void-live-deploy/functions/api/team.js';
import { prioritizeRun } from '../void-live-deploy/lib/team-crew-run.js';
import * as T from '../void-live-deploy/lib/team.js';

const T0 = Date.UTC(2026, 10, 6, 15);
const J = (id, target, ask, extra = {}) => ({ id, target, ask, state: 'queued', note: '', at: '2026-11-05T00:00:00Z', ...extra });

test('a job\'s scope: its files, pages, pull requests and thread; a target that is only its own id says nothing', () => {
  const s = L.scopeOf(J('a', 'flake:3d-counter', 'The 3D counter check flakes in tools/browser-checks.mjs on /counter/ (PR #2421, thread #1090)'));
  for (const k of ['file:tools/browser-checks.mjs', 'page:/counter/', 'pr:2421', 'thread:1090', 'target:flake:3d-counter']) assert.ok(s.includes(k), k + ' in ' + s.join(' '));
  assert.ok(!s.includes('pr:1090'), 'a thread number is not a pull request');
  assert.ok(!L.scopeOf(J('t', 'feature:team-12', 'add a tide table')).some((k) => k.startsWith('target:')), 'feature:team-12 names only itself');
  assert.ok(!L.scopeOf(J('g', 'feature:x', 'see https://github.com/atomeam/void-loop/pull/2399 for context')).some((k) => k.startsWith('page:')), 'a GitHub address is no page of Verse');
  assert.ok(L.scopeOf(J('g', 'feature:x', 'see https://github.com/atomeam/void-loop/pull/2399')).includes('pr:2399'));
});

test('overlap: the same file, page, pull request, thread, target or ask; different work does not', () => {
  const a = J('a', 'flake:3d-counter', 'fix the 3D counter flake in tools/browser-checks.mjs');
  assert.equal(L.overlapOf(a, J('b', 'heal:suite', 'main is red: tools/browser-checks.mjs fails twice')), 'file:tools/browser-checks.mjs');
  assert.equal(L.overlapOf(a, J('c', 'flake:3d-counter', 'the counter, again')), 'target:flake:3d-counter');
  assert.equal(L.overlapOf(J('d', 'feature:w', 'a tide table on /weather/'), J('e', 'feature:v', 'a rain radar on a-to-mind.com/weather/')), 'page:/weather/');
  assert.equal(L.overlapOf(a, J('f', 'feature:tides', 'a tide table on /weather/')), null);
  assert.equal(L.overlapOf(a, a), null, 'a job never overlaps itself');
  assert.match(L.scopeWord('file:lib/x.js'), /the file lib\/x.js/);
});

test('leverage: unblocking a red main and income lead, the smallest site first, a repeat and churn fall to the bottom', () => {
  const ev = { now: T0, main: { red: true, checks: ['browser suite on main'] }, size: { sites: { 'tiny.example': { controls: 2 }, 'huge.example': { controls: 900 } } },
    done: [{ id: 'old-1', ask: 'add a similarity score to the movie picks JSON', target: 'feature:movie-sim', state: 'done', updated: '2026-11-05T12:00:00Z' }] };
  const jobs = [
    J('heal-main', 'heal:browser-suite', 'the browser suite on main is red'),
    J('x402', 'feature:x402-review', 'put the code review behind the x402 wallet so it earns'),
    J('tiny', 'versus:floor-tiny.example', 'outdo tiny.example'), J('huge', 'versus:floor-huge.example', 'outdo huge.example'),
    J('flaky', 'flake:3d-counter', 'the 3D counter animation flakes once in a while'),
    J('again', 'feature:movie-sim-2', 'add a similarity score to the movie picks JSON'),
    J('tidy', 'feature:wording', 'reword the footer'),
  ];
  const p = P.prioritize(jobs, [], ev, null, T0), s = (id) => p.ranked.find((r) => r.id === id);
  assert.equal(p.ranked[0].id, 'heal-main'); assert.match(s('heal-main').drivers.join(' '), /unblocks: main is red/);
  assert.match(s('x402').drivers.join(' '), /income/); assert.ok(s('x402').score > s('flaky').score);
  assert.ok(s('tiny').score > s('huge').score, 'the fewest controls first'); assert.match(s('tiny').drivers.join(' '), /smallest first: tiny.example has 2 controls/);
  assert.match(s('flaky').drivers.join(' '), /churn: a flaky test that is not what turned main red/);
  assert.equal(s('again').busywork, 'a repeat of old-1, already shipped'); assert.deepEqual(p.busywork, ['again']);
  assert.equal(p.order.at(-1), 'again', 'busywork goes last'); assert.ok(!p.bets.some((b) => b.id === 'again'), 'and is never a bet');
  assert.match(s('tidy').drivers.join(' '), /churn: a cosmetic change/);
  assert.match(P.leverageLine(s('again')), /^Leverage [\d.]+: busywork, a repeat of old-1/);
  assert.equal(P.scoresOf(p.ranked)['heal-main'][0], s('heal-main').score);
  assert.match(P.briefText(p, 'the week of 2026-11-02', 'test'), /as busywork .*again/);
});

function d1() {
  const db = new DatabaseSync(':memory:');
  const stmt = (sql, a = []) => ({ bind: (...b) => stmt(sql, b), run: async () => { const r = db.prepare(sql).run(...a); return { meta: { changes: Number(r.changes) } }; }, first: async () => db.prepare(sql).get(...a) || null, all: async () => ({ results: db.prepare(sql).all(...a) }) });
  return { prepare: (sql) => stmt(sql), raw: db };
}
const OWNER = 'test-owner-key'; // secret-scan: ok
const req = (body, key) => new Request('https://verse.test/api/team', { method: 'POST', headers: { 'content-type': 'application/json', ...(key ? { authorization: 'Bearer ' + key } : {}) }, body: JSON.stringify(body) });
const post = async (env, body, key, now = T0) => { const r = await API.onRequestPost({ env, request: req(body, key), now }); return { status: r.status, ...(await r.json()) }; };
const get = async (env, q, now = T0) => { const r = await API.onRequestGet({ env, request: new Request('https://verse.test/api/team' + q), now }); return r.json(); };
async function world(jobs) {
  const DB = d1(), env = { DB, SALT: 's', READ_TOKEN: OWNER };
  DB.raw.exec('CREATE TABLE void_queue (id TEXT PRIMARY KEY, ask TEXT, target TEXT, state TEXT, note TEXT, at TEXT, updated TEXT)');
  const add = DB.raw.prepare('INSERT INTO void_queue VALUES (?, ?, ?, ?, ?, ?, ?)');
  for (const j of jobs) add.run(j.id, j.ask, j.target, j.state, j.note, j.at, j.updated || j.at);
  await API.crewReady(env, T0);
  DB.raw.exec('CREATE TABLE IF NOT EXISTS void_team_crew (k TEXT PRIMARY KEY, v TEXT NOT NULL, at INTEGER NOT NULL)');
  DB.raw.exec("CREATE TABLE IF NOT EXISTS void_team_wants (key TEXT PRIMARY KEY, lane TEXT, kind TEXT, title TEXT, label TEXT, metric TEXT, better TEXT, baseline REAL, latest REAL, cite TEXT, private INTEGER DEFAULT 0, job TEXT, thread INTEGER, state TEXT, filed INTEGER, checked INTEGER, met_at INTEGER, reopened INTEGER DEFAULT 0, nag INTEGER DEFAULT 0)");
  const agent = async (name) => { const inv = await post(env, { do: 'invite', name }, OWNER); const j = await post(env, { do: 'join', code: T.joinCode(inv.join) }); return j.key; };
  return { DB, env, agent };
}

test('hand-out: two seats never get the same work, busywork never goes out, and the job thread carries the score and why', async () => {
  const { DB, env, agent } = await world([
    J('flake-a', 'flake:3d-counter', 'the 3D counter check flakes in tools/browser-checks.mjs'),
    J('heal-b', 'heal:suite', 'main is red: tools/browser-checks.mjs fails'),
    J('feat-c', 'feature:tides', 'a tide table on /weather/'),
    J('again', 'feature:movie-sim-2', 'add a similarity score to the movie picks JSON'),
    J('old-1', 'feature:movie-sim', 'add a similarity score to the movie picks JSON', { state: 'done', updated: '2026-11-05T12:00:00Z' }),
  ]);
  await prioritizeRun(env, { main: { red: true, checks: ['browser suite on main'] } }, T0);
  const a = await agent('openhands'), b = await agent('mimo'), c = await agent('ClaudeDuet');
  const ga = await post(env, { do: 'next' }, a, T0 + 1000);
  assert.equal(ga.job.job, 'heal-b', 'the red main first'); assert.ok(ga.job.leverage > 0);
  const root = DB.raw.prepare('SELECT body FROM void_team_msgs WHERE id = ?').get(ga.job.thread);
  assert.match(root.body, /Leverage [\d.]+: unblocks: main is red/);
  const gb = await post(env, { do: 'next' }, b, T0 + 2000);
  assert.equal(gb.job.job, 'feat-c', 'flake-a touches the same file as heal-b, so mimo gets other work');
  const gc = await post(env, { do: 'next' }, c, T0 + 3000);
  assert.ok(!gc.job, 'nothing left that is neither overlapping nor busywork');
  assert.equal(DB.raw.prepare("SELECT state FROM void_queue WHERE id = 'again'").get().state, 'queued', 'the repeat stays off every seat');
  const board = await get(env, '?jobs', T0 + 4000);
  assert.ok(board.jobs.every((j) => j.id !== 'again'), 'busywork is off the board');
  assert.ok(board.jobs.every((j) => j.leverage != null && j.why), 'every card shows its score and why');
});

test('deconflict: of two seats on one piece of work, the later claim gives its job back with the reason in its thread', async () => {
  const { DB, env, agent } = await world([
    J('one', 'feature:counter', 'speed up /counter/ on phones'),
    J('two', 'feature:counter-2', 'a dark mode for /counter/'),
  ]);
  const a = await agent('openhands'), b = await agent('mimo');
  const ga = await post(env, { do: 'claim', job: 'one' }, a, T0 + 1000); assert.equal(ga.job.job, 'one');
  // the old way in: a seat that took overlapping work before the check (the conductor, or a claim from before this change)
  const tb = DB.raw.prepare("SELECT id FROM void_team_agents WHERE name = 'mimo'").get().id;
  DB.raw.prepare("UPDATE void_queue SET state = 'building', note = 'claimed by team:mimo ·' WHERE id = 'two'").run();
  const th = DB.raw.prepare("INSERT INTO void_team_msgs (channel, thread, at, by, body, job, mentions) VALUES ('work', 0, ?, 'verse', 'job two', 'two', '') RETURNING id").get(T0).id;
  DB.raw.prepare('UPDATE void_team_agents SET job = ?, job_at = ?, thread = ?, seen = ? WHERE id = ?').run('two', T0 + 2000, th, T0 + 100e3, tb);
  DB.raw.prepare("UPDATE void_team_agents SET seen = ? WHERE name = 'openhands'").run(T0 + 100e3);
  const out = await API.deconflict(env, T0 + 120e3);
  assert.equal(out.length, 1); assert.equal(out[0].name, 'mimo'); assert.match(out[0].why, /overlaps one held by @openhands \(both touch the page \/counter\/\)/);
  assert.equal(DB.raw.prepare("SELECT state FROM void_queue WHERE id = 'two'").get().state, 'queued');
  assert.match(DB.raw.prepare('SELECT body FROM void_team_msgs WHERE thread = ? ORDER BY id DESC').get(th).body, /Back on the queue: overlaps one/);
  assert.equal(DB.raw.prepare("SELECT job FROM void_team_agents WHERE name = 'openhands'").get().job, 'one', 'the first claim keeps its job');
  assert.deepEqual(await API.deconflict(env, T0 + 130e3), [], 'at most one pass a minute');
  const r = await API.onRequestGet({ env, request: new Request('https://verse.test/api/team?held', { headers: { authorization: 'Bearer ' + OWNER } }), now: T0 + 140e3 });
  const held = await r.json();
  assert.deepEqual(held.held.map((x) => [x.name, x.job, x.overlaps || null]), [['openhands', 'one', null]], 'the owner reads who holds what, and no overlap is left');
  assert.ok(!JSON.stringify(held).includes('phones'), 'no job text in the read');
});
