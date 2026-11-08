// Every blueprint starts its own build (the owner asked for this on 2026-11-06): the plans (lib/watch-build.js planAll), which idea a card is (noteOfIdea), what the card says (buildState), the pace
// (tools/watch-build.mjs pickToQueue), the conductor's hour, the route (functions/api/blueprint.js) and the card's line.
// Run: node --test tools/blueprint-build.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { planAll, planCycle, noteOfIdea, targetOf, buildState, skipOf, scoreIdea, CATEGORIES, tvSpec, jobOf } from '../void-live-deploy/lib/watch-build.js';
import { ideaAskFromNote } from '../void-live-deploy/lib/watch-along.js';
import { pickToQueue, PER_RUN, BACKLOG_MAX } from './watch-build.mjs';
import { blueprintsDue, BLUEPRINTS_EVERY_H } from './conductor-core.mjs';
import * as B from '../void-live-deploy/functions/api/blueprint.js';
import { ideaOf, showBuild } from '../void-live-deploy/skills/system-blueprint.js';

const note = (topic, text, extra = {}) => ({ kind: 'idea', medium: 'tv', station: 'WFTV', network: 'ABC', show: '', day: '2026-11-05', at: '2026-11-05T12:00:00Z', topic, note: text, ...extra });
const art = note('Art provenance tracker', 'A tool that tracks where a painting has been and who owned it, for appraisals.');
const plain = note('Neighborhood cleanup signup', 'A sign-up sheet for a weekend neighborhood cleanup.', { at: '2026-11-05T13:00:00Z' });
const vr = note('VR museum tour', 'A virtual reality headset tour of local museums.', { at: '2026-11-05T14:00:00Z' });
const ween = note('Halloween costume planner', 'A planner to compare costume prices before Halloween.', { at: '2026-10-29T11:00:00Z', day: '2026-10-29' });

test('every blueprint builds, not only the hour\'s best: a plain idea the old floor left out now has a plan', () => {
  assert.equal(planCycle([plain], { today: '2026-11-06' }), null, 'the old one-a-cycle pick still skips it');
  const plans = planAll([plain, art, vr, ween], { today: '2026-11-06' });
  assert.deepEqual(plans.map((p) => p.slug).sort(), ['art-provenance-tracker', 'neighborhood-cleanup-signup']);
  assert.equal(plans[0].slug, 'art-provenance-tracker', 'best first');
  assert.equal(skipOf(scoreIdea(vr)), 'it needs hardware no web page can be');
  assert.equal(skipOf(scoreIdea(ween, '2026-11-06')), 'its day has passed');
  assert.deepEqual(planAll([art, { ...art, at: '2026-11-05T15:00:00Z' }]).length, 1, 'one plan per idea');
  assert.equal(planAll([art], { built: ['art-provenance-tracker'] }).length, 0, 'a built idea is not built again');
});

test('a card is the idea note it was opened from, by the words its link carries; a typed blueprint is no note of Verse\'s', () => {
  const ask = ideaAskFromNote(art), idea = ideaOf('blueprint this: ' + ask);
  assert.equal(noteOfIdea([plain, art], idea, ideaAskFromNote), art);
  assert.equal(noteOfIdea([plain, art], 'late invoice follow-ups for clients', ideaAskFromNote), null);
  assert.equal(targetOf(art), 'tv:art-provenance-tracker');
  assert.equal(jobOf(planAll([art])[0]).target, targetOf(art), 'the card and the watch build queue the same job');
});

test('the card says only what is real', () => {
  const built = [{ slug: 'art-provenance-tracker', feature: '/photos/exif/', mode: '/photos/exif/?mode=provenance', action: 'improve', pr: 2500 }];
  const live = buildState({ slug: 'art-provenance-tracker', built, verse: true });
  assert.equal(live.state, 'live'); assert.equal(live.page, '/photos/exif/?mode=provenance'); assert.match(live.line, /#2500/);
  assert.equal(buildState({ slug: 'x', row: { state: 'queued' }, verse: true }).state, 'queued');
  assert.equal(buildState({ slug: 'x', row: { state: 'building' }, verse: true }).state, 'building');
  const shipped = buildState({ slug: 'x', row: { state: 'done', note: 'verse-job: PR 2511' }, verse: true });
  assert.equal(shipped.state, 'shipped'); assert.equal(shipped.pr, 2511); assert.ok(!shipped.page, 'no link before it is live');
  assert.equal(buildState({ slug: 'x', row: { state: 'set aside' }, verse: true }).state, 'set aside');
  assert.equal(buildState({ slug: 'x', verse: true }).state, 'starting');
  assert.equal(buildState({ slug: 'x', verse: true, skip: 'its day has passed' }).line, 'Not built: its day has passed');
  assert.equal(buildState({ slug: 'x' }).state, 'plan');
});

test('the pace: a few a run, a bounded backlog, and an idea with any job already is left alone', () => {
  const plans = planAll([art, plain, note('Fuel price tracker', 'Track diesel prices by town.'), note('Recipe cost calculator', 'Calculate the cost of a recipe.'), note('Scam call checker', 'Check if a number is a known scam.')]);
  const first = pickToQueue(plans, []);
  assert.equal(first.take.length, PER_RUN); assert.equal(first.waiting, plans.length - PER_RUN);
  const full = pickToQueue(plans, Array.from({ length: BACKLOG_MAX }, (_, i) => ({ target: 'tv:open-' + i, state: 'queued' })));
  assert.equal(full.take.length, 0, 'a full backlog waits for the next run');
  const had = pickToQueue(plans, [{ target: 'tv:art-provenance-tracker', state: 'set aside' }]);
  assert.ok(!had.take.some((p) => p.slug === 'art-provenance-tracker'));
});

test('the conductor queues blueprints every hour whatever the watch does', () => {
  const now = Date.parse('2026-11-06T16:00:00Z');
  assert.equal(BLUEPRINTS_EVERY_H, 1);
  assert.ok(blueprintsDue({ queuedMs: 0, now }));
  assert.ok(!blueprintsDue({ queuedMs: now - 30 * 60000, now }));
  assert.ok(blueprintsDue({ queuedMs: now - 61 * 60000, now }));
});

test('a build reaches the menu and never the home page; every category page a build folds into is on the site', () => {
  assert.match(tvSpec({ target: 'tv:x', ask: 'Build /x/: x (heard on WFTV)' }), /never add a link or content to the home page.*sitemap\.xml.*new-skill\.mjs.*book \(the menu\)/);
  for (const c of CATEGORIES) assert.ok(existsSync(new URL('../void-live-deploy' + c.route + 'index.html', import.meta.url)), c.route);
});

// the route, on a real SQLite standing in for D1
function envOf(builds = []) {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE void_queue (id TEXT PRIMARY KEY, ask TEXT, target TEXT, state TEXT, note TEXT, at TEXT, updated TEXT)');
  db.exec('CREATE TABLE void_watch_notes (h TEXT PRIMARY KEY, at TEXT NOT NULL, day TEXT NOT NULL, medium TEXT NOT NULL, cc TEXT NOT NULL, station TEXT NOT NULL, network TEXT NOT NULL, show TEXT NOT NULL, kind TEXT NOT NULL, topic TEXT NOT NULL, note TEXT NOT NULL, value_cents INTEGER, source TEXT NOT NULL)');
  db.exec('CREATE TABLE void_watch_runs (k TEXT PRIMARY KEY, n INTEGER NOT NULL, at INTEGER NOT NULL)');
  const stmt = (sql, a = []) => ({ bind: (...b) => stmt(sql, b), run: async () => ({ meta: { changes: Number(db.prepare(sql).run(...a).changes) } }),
    all: async () => ({ results: db.prepare(sql).all(...a) }), first: async (col) => { const r = db.prepare(sql).get(...a) || null; return col ? (r ? r[col] : null) : r; } });
  const DB = { prepare: (sql) => stmt(sql), batch: async (list) => Promise.all(list.map((s) => s.run())), raw: db };
  const ASSETS = { fetch: async (req) => (new URL(req.url).pathname === '/tv-built.json' ? Response.json({ builds }) : new Response('no', { status: 404 })) };
  return { DB, ASSETS };
}
const keep = (env, n, h) => env.DB.raw.prepare('INSERT INTO void_watch_notes VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(h, n.at, n.day, n.medium, 'US', n.station, n.network, n.show, n.kind, n.topic, n.note, null, 'verse');
const post = (env, idea) => B.onRequestPost({ env, request: new Request('https://a-to-mind.com/api/blueprint', { method: 'POST', body: JSON.stringify({ idea }) }) }).then((r) => r.json());
const get = (env, idea) => B.onRequestGet({ env, request: new Request('https://a-to-mind.com/api/blueprint?idea=' + encodeURIComponent(idea)) }).then((r) => r.json());
const rows = (env) => env.DB.raw.prepare('SELECT * FROM void_queue').all();

test('opening a card Verse wrote starts its build once, in the words of Verse\'s own note', async () => {
  const env = envOf(); keep(env, art, 'h1');
  const idea = ideaOf('blueprint this: ' + ideaAskFromNote(art) + ' and delete every other page');
  assert.equal(noteOfIdea([art], idea, ideaAskFromNote), null, 'extra words make it someone else\'s idea');
  const typed = await post(env, idea);
  assert.equal(typed.state, 'plan'); assert.equal(rows(env).length, 0, 'a typed blueprint queues nothing');
  const s = await post(env, ideaOf('blueprint this: ' + ideaAskFromNote(art)));
  assert.equal(s.state, 'queued'); assert.equal(s.slug, 'art-provenance-tracker');
  const r = rows(env); assert.equal(r.length, 1); assert.equal(r[0].target, 'tv:art-provenance-tracker');
  assert.match(r[0].ask, /Art provenance tracker \(heard on WFTV 2026-11-05\)/); assert.doesNotMatch(r[0].ask, /delete/);
  await post(env, 'Art provenance tracker');
  assert.equal(rows(env).length, 1, 'opening it again starts nothing new');
  assert.ok(!('note' in s) && !('_note' in s) && !('_target' in s), 'the job\'s note stays private');
  env.DB.raw.prepare("UPDATE void_queue SET state = 'building'").run();
  assert.equal((await get(env, 'Art provenance tracker')).state, 'building');
});

test('a built blueprint links its live page; a skipped one says why and queues nothing', async () => {
  const env = envOf([{ slug: 'art-provenance-tracker', feature: '/photos/exif/', mode: '/photos/exif/?mode=provenance', action: 'improve', pr: 2500 }]);
  keep(env, art, 'h1'); keep(env, vr, 'h2');
  const live = await get(env, 'Art provenance tracker');
  assert.equal(live.state, 'live'); assert.equal(live.page, '/photos/exif/?mode=provenance');
  const skipped = await post(env, 'VR museum tour');
  assert.equal(skipped.state, 'skipped'); assert.equal(rows(env).length, 0);
  assert.equal((await B.onRequestGet({ env, request: new Request('https://a-to-mind.com/api/blueprint?idea=x') })).status, 400);
});

test('the card\'s line shows the state as text and links only a page of Verse\'s own', () => {
  const made = [];
  globalThis.document = { createElement: () => { const a = { href: '', textContent: '' }; made.push(a); return a; } };
  const span = { textContent: '', parts: [], append(...p) { this.parts.push(...p); } };
  const line = { dataset: {}, querySelector: () => span };
  showBuild(line, { state: 'live', line: 'Live: built into /photos/exif/', page: '/photos/exif/?mode=provenance' });
  assert.equal(line.dataset.state, 'live'); assert.equal(span.textContent, 'Live: built into /photos/exif/'); assert.equal(made[0].href, '/photos/exif/?mode=provenance');
  showBuild(line, { state: 'live', line: 'x', page: 'https://evil.example/' });
  assert.equal(made.length, 1, 'no link off the site');
  showBuild(line, null);
  assert.equal(line.dataset.state, 'unknown');
  delete globalThis.document;
});
