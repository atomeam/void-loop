// Verse Brain watches Verse's own health (lib/brain-watch.js; owner, 2026-10-30: "give the brain more to do and more power in the site"):
// runs on main, open pull requests and issues become breaks in its working memory, actions in its log, and pull of its attention.
// Run: node --test tools/brain-watch.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as W from '../void-live-deploy/lib/brain-watch.js';
import * as R from '../void-live-deploy/lib/brain-route.js';
import * as B from '../void-live-deploy/lib/brain.js';
import { startHost } from '../void-live-deploy/lib/brain-host.js';

const read = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const NOW = Date.parse('2026-10-30T06:00:00Z'), hAgo = (h) => new Date(NOW - h * 3600e3).toISOString();
const RUN = 'https://github.com/atomeam/void-loop/actions/runs/1';
const rows = (verify = 'failed') => [
  { name: 'Checks on main', file: 'verify.yml', state: verify, sha: 'abc1234', url: RUN, checks: ['appraise: the sky card', 'versus: a page'] },
  { name: 'Deploy', file: 'deploy.yml', state: 'passed', sha: 'abc1234', url: RUN },
  { name: 'MCP live', file: 'mcp-live.yml', state: 'unknown', note: 'GitHub answered HTTP 403' },
];

test('what was read becomes observations; a part that could not be read is left out, never called ok', () => {
  const o = W.observe({ rows: rows(), prs: [{ number: 9, created_at: hAgo(1) }, { number: 7, created_at: hAgo(5), html_url: 'https://github.com/atomeam/void-loop/pull/7' }], issues: [{ number: 9, pull_request: {} }] }, NOW);
  assert.deepEqual(o.map((x) => [x.key, x.ok]), [['ci:verify.yml', false], ['ci:deploy.yml', true], ['prs', false], ['issues', true]]);
  assert.equal(o[0].what, 'Checks on main failed on abc1234'); assert.match(o[0].why, /failing: appraise: the sky card; versus: a page/);
  assert.match(o[2].why, /the oldest, #7, has waited 5 hours; the goal is 0 open/); assert.equal(o[2].url, 'https://github.com/atomeam/void-loop/pull/7');
  assert.deepEqual(W.observe({ rows: [{ file: 'x.yml', state: 'unknown' }] }), [], 'nothing read, nothing claimed');
  assert.equal(W.observe({ rows: [{ ...rows()[0], url: 'https://evil.example/x' }] })[0].url, '', 'only links into the repository are kept');
});

test('a break is logged once, a change in it is logged again, and its end is logged as mended', () => {
  const w = W.createWatch();
  let r = W.takeIn(w, W.observe({ rows: rows() }, NOW), NOW);
  assert.deepEqual(r.news.map((a) => a.kind), ['watch']); assert.equal(r.breaks.length, 1);
  assert.equal(W.takeIn(w, W.observe({ rows: rows() }, NOW), NOW + 1).news.length, 0, 'the same break is not news');
  r = W.takeIn(w, W.observe({ rows: rows('passed') }, NOW), NOW + 2);
  assert.deepEqual(r.news.map((a) => a.kind), ['recovered']); assert.match(r.news[0].why, /it was Checks on main failed on abc1234/); assert.equal(r.breaks.length, 0);
});

test('while a break stands the brain attends to the skills that answer for it, and an ask more than one skill can answer leans their way; Mark seen lets go', () => {
  const w = W.createWatch(); W.takeIn(w, W.observe({ rows: rows() }, NOW), NOW);
  assert.deepEqual(W.focusOf(w), ['status', 'incident']);
  assert.equal(R.route(R.createRoutes(), 'is verse working', ['services', 'status']).pick, 'services', 'with no break the page order holds');
  assert.equal(R.route(R.createRoutes(), 'is verse working', ['services', 'status'], W.focusOf(w)).pick, 'status');
  const id = w.log[0].id; assert.ok(W.dismiss(w, id)); assert.deepEqual(W.focusOf(w), []); assert.equal(W.breaksOf(w)[0].marked, true);
  assert.ok(W.undismiss(w, id)); assert.deepEqual(W.focusOf(w), ['status', 'incident']);
});

test('what it saw is kept with the brain and comes back; wrong shapes are ignored', () => {
  const b = B.createBrain(3); b.watch = W.createWatch(); W.takeIn(b.watch, W.observe({ rows: rows() }, NOW), NOW);
  const b2 = B.createBrain(4); assert.ok(B.loadKnowledge(b2, JSON.parse(JSON.stringify(B.knowledgeOf(b)))).includes('watch'));
  assert.equal(W.breaksOf(b2.watch).length, 1); assert.equal(b2.watch.log[0].kind, 'watch');
  assert.equal(W.loadWatch(W.createWatch(), { seen: 3 }), false);
  const w3 = W.createWatch(); W.loadWatch(w3, { seen: { a: { kind: 'evil', ok: false } }, log: [{ id: 'r1', kind: 'route' }] }); assert.deepEqual(w3.seen, {}); assert.deepEqual(w3.log, []);
});

test('the host reads GitHub and /incidents.json, logs the breaks with its picks, and routes toward status while main is red', async () => {
  const calls = [], body = (j) => ({ ok: true, json: async () => j });
  const fetchFn = async (u) => {
    calls.push(u);
    if (u === '/incidents.json') return body({ incidents: [{ sha: 'abc1234def', suite: 'browser suite on main', checks: ['core: the stage loads'] }] });
    if (/workflows\/verify\.yml/.test(u)) return body({ workflow_runs: [{ head_sha: 'abc1234def', status: 'completed', conclusion: 'failure', created_at: '2026-10-30T05:00:00Z', html_url: RUN }] });
    if (/workflows\//.test(u)) return body({ workflow_runs: [{ head_sha: 'abc1234def', status: 'completed', conclusion: 'success', created_at: '2026-10-30T05:00:00Z', html_url: RUN }] });
    if (/\/pulls\?/.test(u)) return body([]);
    if (/\/issues\?/.test(u)) return body([{ number: 12, html_url: 'https://github.com/atomeam/void-loop/issues/12' }]);
    return { ok: false, status: 404 };
  };
  const h = startHost({ win: null, doc: null, ticking: false, bridge: false, fetch: fetchFn, store: { loadKept: async () => null, keep: async () => true } });
  await h.ready; const r = await h.watchNow();
  assert.ok(calls.includes('/incidents.json')); assert.ok(calls.some((u) => /api\.github\.com\/repos\/atomeam\/void-loop\/pulls/.test(u)));
  assert.deepEqual(r.breaks.map((b) => b.key).sort(), ['ci:verify.yml', 'issues']);
  assert.match(r.breaks.find((b) => b.key === 'ci:verify.yml').why, /failing: core: the stage loads/, 'the cause comes from /incidents.json');
  assert.deepEqual(h.watchStats().breaks, 2);
  const p = h.route('is verse working', ['services', 'status']); assert.equal(p.pick, 'status'); assert.match(p.why, /it is thinking about status/);
  const kinds = h.actions().map((a) => a.kind); assert.ok(kinds.includes('watch') && kinds.includes('route'));
  const id = h.actions().find((a) => a.kind === 'watch' && a.pick === 'ci:verify.yml').id;
  assert.ok(h.dismiss(id)); assert.equal(h.route('is verse working', ['services', 'status']).pick, 'services', 'marked seen: the red run no longer pulls toward status (the open issue pulls toward merges)');
  h.stop();
});

// the shapes /api/will and /api/team answer with (functions/api/will.js GET, functions/api/team.js GET), cut to what the watch reads
const WILL = { wants: [{ title: 'Offer its proven skills as MCP tools too', because: 'It lets Verse work inside other AIs.' }],
  lastRun: { title: 'Overhaul surface:ask', state: 'queued', tries: 2, shipped: false, pr: null, why: 'idle: no model answered (workers-ai 401)' },
  lap: { tower: { line: 'Versus: now onlineconverter.com (Verse ahead on 0 of 12 aspects), 0 surpassed', floor: 1, floors: 1270, beaten: 0 } } };
const TEAM = { ok: true, waiting: 86, members: [{ name: 'Vibe', state: 'away' }, { name: 'ClaudeDuet', state: 'away' }] };

test('what Verse decided is read from its will: a will run stuck after 2 tries and jobs with no agent here are breaks', () => {
  const o = W.observe({ will: WILL, team: TEAM }, NOW);
  assert.deepEqual(o.map((x) => [x.key, x.ok]), [['will', false], ['team', false]]);
  assert.match(o[0].what, /stuck on "Overhaul surface:ask"/); assert.match(o[0].why, /2 tries, nothing shipped; the last said: idle: no model answered/);
  assert.equal(o[1].what, '86 jobs wait on the team and no agent is here'); assert.match(o[1].why, /2 agents are on the team, all away/);
  const ok = W.observe({ will: { lastRun: { ...WILL.lastRun, tries: 1 } }, team: { ...TEAM, members: [{ name: 'Vibe', state: 'here' }] } }, NOW);
  assert.deepEqual(ok.map((x) => x.ok), [true, true], 'one try, or an agent here, is no break');
  assert.deepEqual(W.observe({ will: {}, team: { waiting: 'x' } }), [], 'nothing read, nothing claimed');
  const w = W.createWatch(); W.takeIn(w, o, NOW); assert.deepEqual(W.focusOf(w), ['wants', 'tower', 'team-chat']);
});

test('a new decision is an action in the log once, with what Verse wants next, why, and the site it is assimilating; it is kept', () => {
  const d = W.decisionOf(WILL);
  assert.deepEqual(d, { want: 'Offer its proven skills as MCP tools too', because: 'It lets Verse work inside other AIs.', site: 'onlineconverter.com', tower: WILL.lap.tower.line });
  const w = W.createWatch(), a = W.decide(w, d, NOW);
  assert.equal(a.kind, 'decided'); assert.equal(a.what, 'Verse decided next: "Offer its proven skills as MCP tools too"'); assert.match(a.why, /other AIs\.; Versus: now onlineconverter\.com/);
  assert.equal(W.decide(w, W.decisionOf(WILL), NOW + 1), null, 'the same decision is not news');
  assert.equal(W.decide(w, W.decisionOf({ ...WILL, wants: [{ title: 'Something else' }] }), NOW + 2).what, 'Verse decided next: "Something else"');
  assert.equal(W.decisionOf(null), null); assert.equal(W.decisionOf({ wants: 3 }), null);
  const w2 = W.createWatch(); assert.ok(W.loadWatch(w2, JSON.parse(JSON.stringify(W.watchOf(w)))));
  assert.equal(w2.next.want, 'Something else'); assert.deepEqual(w2.log.map((x) => x.kind), ['decided', 'decided']);
  assert.equal(W.dismiss(w, a.id), false, 'a decision is not a break to mark seen');
});

test('the host reads /api/will and /api/team in the same look and keeps the decision', async () => {
  const body = (j) => ({ ok: true, json: async () => j });
  const fetchFn = async (u) => (u === '/api/will' ? body(WILL) : u === '/api/team' ? body(TEAM) : { ok: false, status: 404 });
  const h = startHost({ win: null, doc: null, ticking: false, bridge: false, fetch: fetchFn, store: { loadKept: async () => null, keep: async () => true } });
  await h.ready; const r = await h.watchNow();
  assert.deepEqual(r.breaks.map((b) => b.key).sort(), ['team', 'will']); assert.ok(r.news.some((n) => n.kind === 'decided'));
  assert.equal(h.decision().site, 'onlineconverter.com');
  assert.equal(h.route('show my wants', ['status', 'wants']).pick, 'wants', 'a stuck will pulls toward the skill that answers for it');
  h.stop();
});

// growth ledger entries (void.growth.json), the shapes Verse and its builders write
const LEDGER = [
  { at: hAgo(30), by: 'verse', kind: 'fix', what: 'Verse fixes its old skill: learn to handle "too old"', try: 'too old' },
  { at: hAgo(5), by: 'verse', kind: 'fix', what: 'Verse fixes its quote skill: learn to handle "quote about perseverance"', try: 'quote about perseverance' },
  { at: hAgo(4), by: 'verse', kind: 'fix', what: 'Verse fixes its meteors skill: learn to handle "meteor shower dates"', try: 'meteor shower dates' },
  { at: hAgo(3), by: 'verse', kind: 'grow', what: "Verse hardened itself: 'hangman', 'play hangman' for hangman, yesno.  Why these: tab (no benchmark ask)" },
  { at: hAgo(2), by: 'claude', kind: 'build', what: 'asked by Verse: edge caching for answers: a stable answer comes from the cache' },
  { at: hAgo(2), by: 'verse', kind: 'build', what: 'Versus: took on no site; next randomarea.com' },
  { at: hAgo(1), by: 'void-verify', kind: 'retire', what: 'Taken back off the site: a merge that failed the browser suite' },
];

test('it writes what Verse changed in the last day in plain lines, from the ledger, and logs a new count once; it is kept', async () => {
  const G = await import('../void-live-deploy/skills/growth-tree.js'), r = W.writeLines(LEDGER, NOW, G.publicWhat);
  assert.equal(r.total, 6, 'the entry older than a day is left out');
  assert.deepEqual(r.lines, [
    'Verse learned to answer 2 more asks, like "meteor shower dates" and "quote about perseverance".',
    'It made 2 skills sturdier against asks that had failed, like yesno and hangman.',
    'New: Edge caching for answers: a stable answer comes from the cache.',
    'It took back 1 change that failed its checks on main.']);
  assert.deepEqual(W.writeLines([], NOW).lines, []); assert.equal(W.writeLines('x', NOW).total, 0);
  const w = W.createWatch(), a = W.write(w, r, NOW);
  assert.equal(a.kind, 'wrote'); assert.match(a.what, /\(6 changes\)/); assert.equal(W.write(w, r, NOW + 1), null, 'the same count is not news');
  const w2 = W.createWatch(); assert.ok(W.loadWatch(w2, JSON.parse(JSON.stringify(W.watchOf(w))))); assert.deepEqual(w2.wrote.lines, r.lines);
  assert.equal(w2.log[0].kind, 'wrote');
});

test('the host reads /void.growth.json in the same look and gives what it wrote as data', async () => {
  const body = (j) => ({ ok: true, json: async () => j }), fresh = LEDGER.map((e) => ({ ...e, at: new Date(Date.now() - (NOW - Date.parse(e.at))).toISOString() }));
  const h = startHost({ win: null, doc: null, ticking: false, bridge: false, fetch: async (u) => (u === '/void.growth.json' ? body(fresh) : { ok: false, status: 404 }), store: { loadKept: async () => null, keep: async () => true } });
  await h.ready; const r = await h.watchNow();
  assert.ok(r.news.some((n) => n.kind === 'wrote')); assert.equal(h.wrote().total, 6); assert.match(h.wrote().lines[0], /^Verse learned to answer 2 more asks/);
  h.stop();
});

test('/brain/ shows the breaks it sees with a Look now button, and each break in its log can be marked seen', () => {
  const page = read('void-live-deploy/brain/index.html'), app = read('void-live-deploy/brain/app.js'), host = read('void-live-deploy/lib/brain-host.js');
  assert.match(page, /id="watchBox"/); assert.match(page, /id="lookBtn"/); assert.match(page, /id="breaks"/);
  assert.match(page, /id="next"/); assert.match(page, /id="wrote"/); assert.match(app, /host\.wrote\(\)/); assert.match(app, /host\.decision\(\)/); assert.match(app, /a\.kind === 'decided'/);
  assert.match(app, /host\.dismiss\(a\.id\)/); assert.match(app, /host\.undismiss\(a\.id\)/); assert.match(app, /\['Watch', /);
  assert.match(host, /setTimeout\(\(\) => host\.ready\.then\(look\), 20000\)/); assert.match(host, /doc\.visibilityState === 'hidden'\) return; if \(Watch\.due/);
});
