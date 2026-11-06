// Verse's crew on /team/ and Verse's own wants (lib/team-crew.js, lib/team-crew-run.js, functions/api/crew.js) with a FAKE D1 (node:sqlite)
// and a FAKE web. The crew takes its seats once and never over a member the owner removed; it never takes a build-queue job; each due
// member posts its own job in #work and closes it; Verse's brain files wants that cite their source and name one number, never twice;
// a want closes only when its number moves, and a job handed in with the number unmoved goes back on the queue.
// Run: node --test tools/team-crew.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import * as C from '../void-live-deploy/lib/team-crew.js';
import * as T from '../void-live-deploy/lib/team.js';
import { crewTick, crewView } from '../void-live-deploy/lib/team-crew-run.js';
import * as API from '../void-live-deploy/functions/api/team.js';

function d1() {
  const db = new DatabaseSync(':memory:');
  const stmt = (sql, a = []) => ({ bind: (...b) => stmt(sql, b), run: async () => { const r = db.prepare(sql).run(...a); return { meta: { changes: Number(r.changes) } }; }, first: async () => db.prepare(sql).get(...a) || null, all: async () => ({ results: db.prepare(sql).all(...a) }) });
  return { prepare: (sql) => stmt(sql), raw: db };
}
const T0 = Date.UTC(2026, 10, 4, 2);
const TOWER = { floors: {
  'maps': { speed: { verdict: 'worse', evidence: 'Verse (/maps/) 900 ms vs x 300 ms' }, offline: { verdict: 'equal' }, mobile: { verdict: 'better' } },
  'sports: flashscore.com': { speed: { verdict: 'equal-and-better' }, completeness: { verdict: 'equal' } },
  'calculator': { speed: { verdict: 'better', verse: 100, best: 900, at: '2026-11-03T00:00:00Z', evidence: 'Verse (/calculator/) 100 ms vs calculator.net 900 ms' } },
} };
const EXAM = { domains: { images: { score: 73.9, fails: [{ ask: 'draw a red circle' }] }, code: { score: 100, fails: [] }, words: { score: 88, fails: [] } } };
function web(over = {}) {
  const pages = {
    'https://a-to-mind.com/': '<a href="/store/">store</a><a href="/gone/">gone</a><a href="https://a-to-mind.com/team/">team</a><a href="/x.png">img</a><a href="/api/q">api</a>',
    'https://a-to-mind.com/exam/latest.json': JSON.stringify(EXAM),
    'https://a-to-mind.com/tools.json': '{"tools":[]}',
    'https://a-to-mind.com/tower.evidence.json': JSON.stringify(TOWER),
    'https://flashscore.com/robots.txt': 'User-agent: *\nSitemap: https://flashscore.com/sitemap.xml\n',
    'https://flashscore.com/sitemap.xml': '<urlset><url><loc>https://flashscore.com/football/a</loc></url><url><loc>https://flashscore.com/football/b</loc></url><url><loc>https://flashscore.com/tennis/c</loc></url></urlset>',
    'https://developer.chrome.com/static/blog/feed.xml': '<rss><channel><item><title>View transitions everywhere</title><link>https://developer.chrome.com/blog/vt</link></item></channel></rss>',
    'https://api.github.com/repos/atomeam/void-loop/pulls?state=open&per_page=30': JSON.stringify([{ number: 7, title: 'a fix', head: { sha: 'abc' } }]),
    'https://api.github.com/repos/atomeam/void-loop/pulls?state=closed&sort=updated&direction=desc&per_page=30': JSON.stringify([]),
    'https://api.github.com/repos/atomeam/void-loop/commits/abc/check-runs?per_page=100': JSON.stringify({ check_runs: [{ name: 'merge-gate', status: 'completed', conclusion: 'success' }] }),
    ...over,
  };
  const seen = [];
  const f = async (url) => {
    seen.push(url);
    if (url === 'https://a-to-mind.com/gone/') return new Response('no', { status: 404 });
    if (url in pages) return new Response(pages[url], { status: 200 });
    if (url.startsWith('https://a-to-mind.com/') && !url.endsWith('.json')) return new Response('<html>ok</html>', { status: 200 });
    return new Response('not here', { status: 404 });
  };
  f.seen = seen; f.pages = pages;
  return f;
}
function world(over) {
  const DB = d1();
  DB.raw.exec('CREATE TABLE void_queue (id TEXT PRIMARY KEY, ask TEXT, target TEXT, state TEXT, note TEXT, at TEXT, updated TEXT)');
  DB.raw.exec("CREATE TABLE void_misses (ask TEXT PRIMARY KEY, count INTEGER, first TEXT, last TEXT, fallback TEXT)");
  DB.raw.exec("CREATE TABLE void_sales (id TEXT PRIMARY KEY, resource TEXT NOT NULL, sale_id TEXT, subscription_id TEXT, product TEXT, void_id TEXT, verified INTEGER NOT NULL, effect TEXT, raw TEXT NOT NULL, at TEXT NOT NULL)");
  const m = DB.raw.prepare('INSERT INTO void_misses VALUES (?, ?, ?, ?, ?)');
  for (let i = 0; i < 6; i++) m.run('ask ' + i, 1, '2026-11-01T00:00:00Z', '2026-11-03T00:00:00Z', '');
  return { DB, SALT: 's', READ_TOKEN: 'k', CREW_FETCH: web(over) };
}
const rows = (env, sql, ...a) => env.DB.raw.prepare(sql).all(...a);

test('the wants come from evidence, cite it, name one number, and are ranked: broken pages, the exam, the Tower, then private counts', () => {
  const w = C.wantsOf({ at: '2026-11-04T02:00:00Z', exam: EXAM, tower: TOWER, probe: [{ path: '/', status: 200 }, { path: '/x/', status: 500, ms: 30 }], misses7: 9, sales30: 0 });
  assert.deepEqual(w.map((x) => x.key), ['page-x', 'exam-images', 'exam-words', 'tower-maps', 'tower-sports-flashscore-com', 'misses-2026-w45', 'revenue-2026-11']);
  for (const x of w) { assert.ok(x.cite.length && x.cite.every((c) => /^https:\/\//.test(c.url)), x.key); assert.ok(T.TEAM_KINDS.includes(x.kind), x.key + ' is a kind the team takes'); }
  assert.equal(w[1].metric.value, 73.9); assert.match(w[1].why, /draw a red circle/);
  assert.equal(w.find((x) => x.key === 'tower-maps').metric.value, 2, 'worse and equal are not wins');
  assert.ok(w.find((x) => x.key === 'misses-2026-w45').private && !/ask \d/.test(JSON.stringify(w)), 'what visitors typed never appears');
  assert.deepEqual(C.wantsOf({}), [], 'no evidence, no want: nothing is made up');
  assert.equal(C.wantsOf({ exam: { cases: [{ id: 'c1', ask: 'time in Tokyo', ok: false }] } })[0].key, 'exam-case-c1');
});

test('measure and improved read the same evidence the want was made from; a metric this read did not measure is null, not a change', () => {
  assert.equal(C.measure('exam:images', { exam: EXAM }), 73.9);
  assert.equal(C.measure('tower:maps', { tower: TOWER }), 2);
  assert.equal(C.measure('page:/x/', { probe: [{ path: '/x/', status: 200 }] }), 1);
  assert.equal(C.measure('page:/y/', { probe: [] }), null);
  assert.equal(C.measure('joblive:want-idea-a', { jobs: { 'want-idea-a': 'live' } }), 1);
  assert.ok(C.improved('up', 73.9, 80) && !C.improved('up', 73.9, 73.9) && C.improved('down', 2, 1) && !C.improved('down', 2, null));
});

test('the crew reads: links, sitemaps, feeds, sections, promos with a real measured win and a one-tap X link', () => {
  assert.deepEqual(C.linksIn('<a href="/a/">a</a><a href="/a/#x">a</a><a href="https://a-to-mind.com/b?x=1">b</a><a href="//evil.com/">e</a><a href="/f.pdf">f</a>'), ['/a/', '/b']);
  assert.deepEqual(C.sitemapsIn('Sitemap: https://x.com/s1.xml\nsitemap:https://x.com/s2.xml'), ['https://x.com/s1.xml', 'https://x.com/s2.xml']);
  assert.equal(C.readSitemap('<sitemapindex><sitemap><loc>https://x.com/a.xml</loc></sitemap></sitemapindex>').index, true);
  assert.deepEqual(C.sectionsOf(['https://x.com/a/1', 'https://x.com/a/2', 'https://x.com/b']), [{ section: 'a', pages: 2 }, { section: 'b', pages: 1 }]);
  assert.deepEqual(C.feedItems('<feed><entry><title>New &amp; shiny</title><link href="https://w.org/1"/></entry></feed>'), [{ title: 'New & shiny', url: 'https://w.org/1' }]);
  assert.equal(C.rivalOf('sports: flashscore.com'), 'flashscore.com'); assert.equal(C.rivalOf('maps'), '');
  assert.deepEqual(C.rotate([1, 2, 3, 4, 5], 2, 2), [5, 1]);
  const p = C.promosOf(TOWER);
  assert.equal(p.length, 1); assert.match(p[0].text, /calculator page loads in 100 ms, 9x faster/); assert.ok(p[0].intent.startsWith('https://x.com/intent/post?text='));
  for (const b of C.CREW) assert.ok(T.NAME_RE.test(b.name) && /^[0-9a-f]{12}$/.test(b.id) && T.CODE_RE.test(b.channel) && !T.RESERVED.includes(b.channel), b.name);
});

test('a run seats the crew, files wants as queue jobs with #work threads, and each due member claims, works and closes its own job', async () => {
  const env = world();
  const out = await crewTick(env, T0);
  assert.equal(out.crew.length, C.CREW.length);
  const ags = rows(env, 'SELECT * FROM void_team_agents');
  assert.equal(ags.length, C.CREW.length); assert.ok(ags.every((a) => a.crew === 1 && a.auto === 0 && a.key.length === 64 && a.seen === T0));
  assert.deepEqual(out.filed, ['link-gone', 'exam-images'], 'two a run, most urgent first');
  const q = rows(env, "SELECT * FROM void_queue WHERE id LIKE 'want-%' ORDER BY id");
  assert.deepEqual(q.map((j) => [j.id, j.target, j.state]), [['want-exam-images', 'gap:want-exam-images', 'queued'], ['want-link-gone', 'heal:want-link-gone', 'queued']]);
  const filed = rows(env, "SELECT * FROM void_team_msgs WHERE job = 'want-exam-images'")[0];
  assert.equal(filed.by, 'verse'); assert.match(filed.body, /Source: outcome exam https:\/\/a-to-mind.com\/exam\/latest.json/); assert.match(filed.body, /closes only when that number rises/); assert.match(filed.body, /Want key: exam-images/);
  assert.equal(out.jobs.length, C.CREW.length, 'every member is due on the first run');
  for (const b of C.CREW) {
    const root = rows(env, "SELECT * FROM void_team_msgs WHERE channel = 'work' AND thread = 0 AND job = ?", 'crew-' + b.slug + '-1')[0];
    assert.ok(root, b.name + ' has its job thread'); assert.match(root.body, new RegExp('^@' + b.name + ' your next job'));
    const rep = rows(env, 'SELECT * FROM void_team_msgs WHERE thread = ? ORDER BY id', root.id);
    assert.equal(rep[0].by, b.id); assert.equal(rep[0].body, 'Claimed. Working it now.'); assert.equal(rep.at(-1).by, b.id);
  }
  const tower = rows(env, "SELECT body FROM void_team_msgs WHERE by = ? AND thread > 0 ORDER BY id DESC LIMIT 1", C.CREW[0].id)[0].body;
  assert.match(tower, /Mapped flashscore\.com across its whole site: robots\.txt 200, 1 sitemap listed, 3 pages/); assert.match(tower, /football \(2\)/);
  const growth = rows(env, "SELECT body FROM void_team_msgs WHERE channel = 'growth'")[0].body; assert.match(growth, /x\.com\/intent\/post/); assert.match(growth, /never post outside/);
  const sh = await API.onRequestGet({ env, request: new Request('https://verse.test/api/team'), now: T0 + 60e3 }), j = await sh.json();
  const ts = j.members.find((m) => m.name === 'TowerScout');
  assert.equal(ts.state, 'idle'); assert.equal(ts.crew, true); assert.match(ts.did, /mapped flashscore\.com/); assert.equal(ts.done, 1);
  assert.equal(j.members.find((m) => m.name === 'ExamCoach').state, 'idle', '20 minutes after a run a crew member is still here (the clock is every 15)');
  // the second run: nobody due yet except StatusWatch at 30 minutes; nothing filed twice
  const out2 = await crewTick(env, T0 + 31 * 60e3);
  assert.deepEqual(out2.jobs.map((x) => x.bot), ['StatusWatch']);
  assert.ok(!out2.filed.some((k) => out.filed.includes(k)), 'never twice');
  assert.equal(rows(env, "SELECT COUNT(*) AS n FROM void_queue WHERE id = 'want-exam-images'")[0].n, 1);
  // the view: private wants show no number
  const v = await crewView(env, T0 + 32 * 60e3);
  assert.equal(v.crew.length, C.CREW.length); assert.ok(v.crew.every((c) => c.here && c.did));
  const pw = v.wants.find((w) => w.key.startsWith('misses-'));
  if (pw) assert.ok(pw.private && pw.baseline === null && pw.latest === null && !pw.cite.length);
  assert.equal(v.wants.find((w) => w.key === 'exam-images').baseline, 73.9);
});

test('a want closes only when its number moves; handed in with the number unmoved, it goes back on the queue', async () => {
  const env = world();
  await crewTick(env, T0);
  // a coder handed the exam job in, the exam did not move: a day later it goes back
  env.DB.raw.prepare("UPDATE void_queue SET state = 'live' WHERE id = 'want-exam-images'").run();
  await crewTick(env, T0 + 25 * 3600e3);
  assert.equal(rows(env, "SELECT state FROM void_queue WHERE id = 'want-exam-images'")[0].state, 'queued');
  assert.match(rows(env, "SELECT note FROM void_queue WHERE id = 'want-exam-images'")[0].note, /outcome not met yet: images exam score is 73.9 \(was 73.9\)/);
  // the exam rises: met, the job done, ExamCoach says so in the want's thread
  env.CREW_FETCH.pages['https://a-to-mind.com/exam/latest.json'] = JSON.stringify({ domains: { ...EXAM.domains, images: { score: 91, fails: [] } } });
  await crewTick(env, T0 + 26 * 3600e3);
  const w = rows(env, "SELECT * FROM void_team_wants WHERE key = 'exam-images'")[0];
  assert.equal(w.state, 'met'); assert.equal(w.latest, 91);
  assert.equal(rows(env, "SELECT state FROM void_queue WHERE id = 'want-exam-images'")[0].state, 'done');
  const said = rows(env, 'SELECT * FROM void_team_msgs WHERE thread = ? ORDER BY id DESC LIMIT 1', w.thread)[0];
  assert.equal(said.by, C.byLane('exam').id); assert.match(said.body, /Outcome met: images exam score went from 73.9 to 91/);
});

test('the owner removes a crew member and it stays removed; a crew member is never handed a build-queue job', async () => {
  const env = world();
  await crewTick(env, T0);
  env.DB.raw.prepare("UPDATE void_team_agents SET off = 1 WHERE name = 'Growth'").run();
  const out = await crewTick(env, T0 + 7 * 3600e3);
  assert.ok(!out.crew.includes('Growth')); assert.equal(rows(env, "SELECT off FROM void_team_agents WHERE name = 'Growth'")[0].off, 1);
  assert.ok(rows(env, 'SELECT job FROM void_team_agents').every((a) => a.job === null), 'no crew member holds a queue job');
  assert.equal(await API.handIdle(env, T0 + 7 * 3600e3), 0);
});

test('a crew card says when the member runs next, not a bare idle (owner, 2026-11-06: "why are all of verses own team idle ?")', async () => {
  const M = 60e3;
  assert.equal(T.crewNext(T0 + 12 * M, T0), 'next run in 12 min');
  assert.equal(T.crewNext(T0 + 179 * M, T0), 'next run in 2 h 59 min');
  assert.equal(T.crewNext(T0 + 120 * M, T0), 'next run in 2 h');
  assert.equal(T.crewNext(T0 - 5 * M, T0), 'next run due now', 'its turn came: the next knock runs it');
  assert.equal(T.crewNext(T0 - 130 * M, T0), 'next run late by 2 h 10 min (the clock missed)', 'a missed clock says so');
  assert.equal(T.crewNext(null, T0), 'runs on the next clock knock', 'before the first run');
  // the workspace and /api/crew carry each member's turn
  const env = world();
  await crewTick(env, T0);
  const ags = rows(env, 'SELECT * FROM void_team_agents');
  const turns = await API.crewTurns(env, ags);
  const scout = C.CREW.find((b) => b.slug === 'tower-scout'), watch = C.CREW.find((b) => b.slug === 'status-watch');
  assert.equal(turns[scout.id], T0 + scout.every * M - M);
  assert.equal(turns[watch.id], T0 + watch.every * M - M);
  const view = await crewView(env, T0 + M);
  assert.equal(view.crew.find((c) => c.name === 'StatusWatch').next, T0 + watch.every * M - M);
  assert.match(T.crewNext(view.crew.find((c) => c.name === 'TowerScout').next, T0 + M), /^next run in 3 h 58 min$/);
});
