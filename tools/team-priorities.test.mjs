// Verse's Priorities step (lib/team-priorities.js; lib/team-crew-run.js prioritizeRun; functions/api/team.js handOut and the owner's one-message
// override): impact ÷ effort × confidence, 1-3 bets within the WIP cap (3 build + 1 research), the queue handed out in that order, a pinned
// brief posted only when the bets change, and "priority: <job>" / "drop: <job>" from the owner.
// Run: node --test tools/team-priorities.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import * as P from '../void-live-deploy/lib/team-priorities.js';
import * as API from '../void-live-deploy/functions/api/team.js';
import { prioritizeRun, crewView } from '../void-live-deploy/lib/team-crew-run.js';
import * as T from '../void-live-deploy/lib/team.js';

const T0 = Date.UTC(2026, 10, 3, 15); // a Tuesday
const J = (id, target, ask, extra = {}) => ({ id, target, ask, state: 'queued', note: '', at: '2026-11-01T00:00:00Z', ...extra });
const JOBS = [
  J('want-page-x', 'heal:want-page-x', 'Get /x/ answering again'),
  J('want-exam-images', 'gap:want-exam-images', 'Raise the images exam score'),
  J('f1', 'feature:tides', 'add a tide table to /weather/'),
  J('f2', 'feature:store-bundle', 'a bundle price on the store checkout'),
  J('n1', 'novelty:radar', 'research what View Transitions could do for the stage'),
  J('old', 'heal:flaky', 'fix a flaky check', { note: 'tries 2' }),
];
const WANTS = [
  { key: 'page-x', job: 'want-page-x', lane: 'page', title: 'Get /x/ answering again', label: '/x/ answers', baseline: 0, cite: '[{"what":"probe","url":"https://a-to-mind.com/x/"}]' },
  { key: 'exam-images', job: 'want-exam-images', lane: 'exam', title: 'Raise images', label: 'images exam score', baseline: 73.9, cite: '[{"what":"exam","url":"https://a-to-mind.com/exam/latest.json"}]' },
];

test('impact ÷ effort × confidence: breakage and evidence first, a retried job falls, each score says why', () => {
  const p = P.prioritize(JOBS, WANTS, {}, null, T0);
  assert.equal(p.ranked[0].id, 'want-page-x'); assert.match(p.ranked[0].drivers[0], /breakage/); assert.equal(p.ranked[0].evidence[0].url, 'https://a-to-mind.com/x/');
  const s = (id) => p.ranked.find((r) => r.id === id);
  assert.ok(s('f2').score > s('f1').score, 'revenue beats a plain feature');
  assert.ok(s('old').confidence < 0.5 && s('old').effort === 3, 'two tries: lower confidence, more effort');
  assert.equal(s('n1').lane, 'research');
  assert.ok(p.bets.length >= 1 && p.bets.length <= 3); assert.equal(p.bets[0].id, 'want-page-x');
  assert.ok(p.bets.every((b) => b.score >= p.bets[0].score * 0.5));
});

test('the WIP cap: 3 build lanes and 1 research lane among the bets and at hand-out', () => {
  const many = Array.from({ length: 6 }, (_, i) => J('h' + i, 'heal:h' + i, 'fix ' + i));
  const p = P.prioritize([...many, J('n1', 'novelty:x', 'research the stage'), J('n2', 'novelty:y', 'research more')], [], {}, null, T0);
  assert.equal(p.bets.filter((b) => b.lane === 'build').length, 3); assert.equal(p.bets.length, 3);
  const building = [J('b1', 'heal:a', 'a'), J('b2', 'heal:b', 'b'), J('b3', 'heal:c', 'c')];
  assert.equal(P.wipAllows(J('h9', 'heal:z', 'z'), building), false, 'a fourth build lane waits');
  assert.equal(P.wipAllows(J('n1', 'novelty:x', 'research'), building), true, 'the research lane is its own');
  assert.equal(P.wipAllows(J('n2', 'novelty:y', 'study'), [...building, J('n1', 'novelty:x', 'r')]), false);
});

test('the owner overrides with one message: first, last, reset; a week later it lapses', () => {
  assert.deepEqual(P.overrideOf('priority: f1'), { pin: 'f1' }); assert.deepEqual(P.overrideOf('drop want-page-x.'), { drop: 'want-page-x' });
  assert.deepEqual(P.overrideOf('Priority: reset'), { reset: true }); assert.equal(P.overrideOf('what is the priority here?'), null);
  let o = P.mergeOverride(null, { pin: 'f1' }, T0); o = P.mergeOverride(o, { drop: 'want-page-x' }, T0);
  const p = P.prioritize(JOBS, WANTS, {}, o, T0);
  assert.equal(p.order[0], 'f1'); assert.equal(p.order.at(-1), 'want-page-x'); assert.equal(p.bets[0].id, 'f1'); assert.equal(p.bets[0].override, 'pinned by the owner');
  assert.equal(P.prioritize(JOBS, WANTS, {}, o, T0 + P.OVERRIDE_MS + 1).order[0], 'want-page-x', 'a week later Verse ranks again');
  assert.deepEqual(P.mergeOverride(o, { reset: true }, T0).pin, []);
});

function d1() {
  const db = new DatabaseSync(':memory:');
  const stmt = (sql, a = []) => ({ bind: (...b) => stmt(sql, b), run: async () => { const r = db.prepare(sql).run(...a); return { meta: { changes: Number(r.changes) } }; }, first: async () => db.prepare(sql).get(...a) || null, all: async () => ({ results: db.prepare(sql).all(...a) }) });
  return { prepare: (sql) => stmt(sql), raw: db };
}
const OWNER = 'test-owner-key'; // secret-scan: ok
const req = (body, key) => new Request('https://verse.test/api/team', { method: 'POST', headers: { 'content-type': 'application/json', ...(key ? { authorization: 'Bearer ' + key } : {}) }, body: JSON.stringify(body) });
const post = async (env, body, key, now = T0) => { const r = await API.onRequestPost({ env, request: req(body, key), now }); return { status: r.status, ...(await r.json()) }; };

test('the run ranks the queue, pins a brief only when the bets change, hands jobs out in that order, and the owner\'s one message reorders it', async () => {
  const DB = d1(), env = { DB, SALT: 's', READ_TOKEN: OWNER };
  DB.raw.exec('CREATE TABLE void_queue (id TEXT PRIMARY KEY, ask TEXT, target TEXT, state TEXT, note TEXT, at TEXT, updated TEXT)');
  const add = DB.raw.prepare('INSERT INTO void_queue VALUES (?, ?, ?, ?, ?, ?, ?)');
  for (const j of JOBS) add.run(j.id, j.ask, j.target, j.state, j.note, j.at, j.at);
  await API.crewReady(env, T0);
  DB.raw.exec('CREATE TABLE IF NOT EXISTS void_team_crew (k TEXT PRIMARY KEY, v TEXT NOT NULL, at INTEGER NOT NULL)');
  DB.raw.exec("CREATE TABLE IF NOT EXISTS void_team_wants (key TEXT PRIMARY KEY, lane TEXT, kind TEXT, title TEXT, label TEXT, metric TEXT, better TEXT, baseline REAL, latest REAL, cite TEXT, private INTEGER DEFAULT 0, job TEXT, thread INTEGER, state TEXT, filed INTEGER, checked INTEGER, met_at INTEGER, reopened INTEGER DEFAULT 0, nag INTEGER DEFAULT 0)");
  const w = DB.raw.prepare("INSERT INTO void_team_wants (key, lane, title, label, baseline, cite, job, state) VALUES (?, ?, ?, ?, ?, ?, ?, 'open')");
  for (const x of WANTS) w.run(x.key, x.lane, x.title, x.label, x.baseline, x.cite, x.job);
  const r1 = await prioritizeRun(env, {}, T0);
  assert.equal(r1.changed, true); assert.equal(r1.bets[0], 'want-page-x');
  const brief = DB.raw.prepare('SELECT * FROM void_team_msgs WHERE id = ?').get(r1.brief);
  assert.equal(brief.by, 'verse'); assert.match(brief.body, /Bet 1: want-page-x .*score/); assert.match(brief.body, /Evidence: probe https:\/\/a-to-mind.com\/x\//); assert.match(brief.body, /priority: <job>/);
  assert.equal((await prioritizeRun(env, {}, T0 + 15 * 60e3)).changed, false, 'nothing moved: no re-rank, no post');
  const n = DB.raw.prepare('SELECT COUNT(*) AS n FROM void_team_msgs').get().n;
  assert.equal((await prioritizeRun(env, {}, T0 + 864e5)).why, 'the daily ranking');
  assert.equal(DB.raw.prepare('SELECT COUNT(*) AS n FROM void_team_msgs').get().n, n, 'the same bets: the brief is not posted again');
  // an agent is handed the top bet first
  const inv = await post(env, { do: 'invite', name: 'Worker' }, OWNER); const j = await post(env, { do: 'join', code: T.joinCode(inv.join) });
  const got = await post(env, { do: 'next' }, j.key, T0 + 864e5 + 1000);
  assert.equal(got.job.job, 'want-page-x');
  // the owner's one message: f1 first, at once
  const o = await post(env, { do: 'post', c: 'general', body: 'priority: f1' }, OWNER, T0 + 864e5 + 2000);
  assert.equal(o.status, 201); assert.equal(o.job, undefined, 'an override is not a job');
  const back = await post(env, { do: 'done', ok: false, failed: false, note: 'back' }, j.key, T0 + 864e5 + 3000);
  assert.equal(back.next.job, 'f1', 'the pin goes first, at once');
  const r3 = await prioritizeRun(env, {}, T0 + 864e5 + 5000, { force: true });
  assert.equal(r3.bets[0], 'f1'); assert.ok(r3.brief !== r1.brief, 'the bets changed: a new pinned brief');
  const v = await crewView(env, T0 + 864e5 + 6000);
  assert.equal(v.priorities.bets[0].id, 'f1'); assert.equal(v.priorities.brief, r3.brief); assert.deepEqual(v.priorities.override.pin, ['f1']);
});

test('a bet has a title a person reads whole: a flaky check by the head of its test name, anything else by its first clause, never cut', () => {
  const flake = P.titleOf({ ask: 'make "paste any size and read aloud: a 3,000-line pasted log reaches the server under 20 kB with its first line and its last" robust: fix the test or the code' });
  assert.equal(flake, 'Steady a flaky check: paste any size and read aloud');
  const long = 'word '.repeat(40).trim(); assert.equal(P.titleOf({ ask: 'make "' + long + '" robust: fix it' }), 'Steady a flaky check: ' + long, 'whole, never cut');
  assert.equal(P.titleOf({ ask: 'Fix the podcasts exam: crime junkie plays nothing. The card waits on two asks.' }), 'Fix the podcasts exam');
  assert.equal(P.titleOf({ ask: '', id: 'team-12' }), 'team-12');
  const r = P.scoreOf({ id: 'f1', ask: 'make "sky / still" robust: fix the test or the code, never skip', target: 'flake:sky', state: 'queued' }, null, {}); assert.equal(r.title, 'Steady a flaky check: sky / still');
});
