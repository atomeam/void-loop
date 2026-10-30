// "Verse reports": the template drafts, the validator that keeps a model's wording to the facts, and /api/report with a fake model and fake feeds
import test from 'node:test';
import assert from 'node:assert/strict';
import { readSummary, readStandings, readScoreboard } from '../void-live-deploy/lib/scores.js';
import { tableIndex, gameFacts, draftRecap, draftPreview, briefFacts, draftBrief, weekFacts, draftWeek, topStories, validate, polishMessages, dayWords } from '../void-live-deploy/lib/reports.js';
import { askIn, build, onRequestGet, HOUR_CAP } from '../void-live-deploy/functions/api/report.js';
import { SUMMARY, STANDINGS, SCOREBOARD, fakeFeeds } from './scores.fixtures.mjs';

// a stand-in for D1's void_daily_cap: INSERT ... ON CONFLICT ... WHERE n < ? RETURNING n
const fakeDb = () => { const rows = new Map(); return { prepare: (sql) => ({ run: async () => ({}), bind: (day, key, limit) => ({ all: async () => { const k = day + '|' + key, n = rows.get(k) || 0; if (n >= limit) return { results: [] }; rows.set(k, n + 1); return { results: [{ n: n + 1 }] }; } }) }) }; };
const table = tableIndex(readStandings(STANDINGS, 'soccer').groups), sum = readSummary(SUMMARY);
test('a recap is built from the data and says nothing the data does not', () => {
  const f = gameFacts('recap', 'Premier League', sum, table), d = draftRecap(f);
  assert.equal(d.headline, 'Arsenal beat Southampton 2-1'); assert.match(d.body, /Arsenal beat Southampton 2-1 at Test Ground in the Premier League\./); assert.match(d.body, /Test Striker Goal \(12'\)/); assert.match(d.body, /red card for Southampton \(77'\)/i);
  assert.match(d.body, /Arsenal had 61% of the ball to Southampton's 39%/); assert.ok(d.body.split(/(?<=\.)\s/).length <= 4);
  assert.deepEqual(validate(d.body, f), { ok: true, why: '' }, 'the draft itself passes its own validator');
  const g = { ...sum.game, home: { ...sum.game.home, score: '1' }, away: { ...sum.game.away, score: '1' } }, dd = draftRecap(gameFacts('recap', 'Premier League', { ...sum, game: g }, {}));
  assert.equal(dd.headline, 'Arsenal and Southampton draw 1-1');
});
test('a preview: form, last meeting, the table and how far apart they are', () => {
  const pre = { ...sum, game: { ...sum.game, state: 'pre', home: { ...sum.game.home, score: '' }, away: { ...sum.game.away, score: '' }, status: '', start: '2025-05-25T15:00Z' } };
  const f = gameFacts('preview', 'Premier League', pre, table), d = draftPreview(f);
  assert.equal(d.headline, 'Arsenal host Southampton'); assert.match(d.body, /on Sunday 25 May/); assert.match(d.body, /Recent form, latest first: ARS W D/); assert.match(d.body, /Last meeting: Southampton Arsenal 1-1\./);
  assert.equal(f.table.gap, undefined, 'no points for Southampton in the fixture table: no gap is made up'); assert.deepEqual(validate(d.body, f), { ok: true, why: '' });
  const f2 = gameFacts('preview', 'Premier League', { ...pre, game: { ...pre.game, home: { ...pre.game.home, id: '364' }, away: { ...pre.game.away, id: '359' } } }, table); assert.equal(f2.table.gap, 10); assert.match(draftPreview(f2).body, /10 points apart/);
});
test('the validator rejects an invented score, name, number, quote, injury or bet', () => {
  const f = gameFacts('recap', 'Premier League', sum, table);
  const good = 'Arsenal beat Southampton 2-1 at Test Ground, Test Striker scoring on 12 minutes before Test Keeper was sent off for Southampton.';
  assert.equal(validate(good, f).ok, true, JSON.stringify(validate(good, f)));
  for (const [bad, why] of [['Arsenal beat Southampton 3-1 at Test Ground in the Premier League.', /number/], ['Arsenal beat Southampton 2-1 thanks to Bukayo Saka in the Premier League.', /name/], ['Arsenal beat Southampton 2-1 with three late chances in the Premier League.', /number/],
    ['Arsenal beat Southampton 2-1 in the Premier League, and the manager said "we were brilliant".', /banned/], ['Arsenal beat Southampton 2-1 in the Premier League despite an injury to Test Striker.', /banned/], ['Arsenal beat Southampton 2-1, which pays well on the odds, in the Premier League.', /banned/], ['Arsenal won.', /length/],
    ['Arsenal beat Southampton 2-1 in the Premier League, moving to Chelsea in second place on 77 points overall.', /number|name/]]) { const v = validate(bad, f); assert.equal(v.ok, false, bad); assert.match(v.why, why, bad); }
});
test('a league brief, a weekly roundup, headlines: all from the scoreboard, nothing added', () => {
  const games = readScoreboard(SCOREBOARD), bf = briefFacts('Premier League', '2025-05-25', games, games.filter((g) => g.state === 'pre'), table), bd = draftBrief(bf);
  assert.equal(bd.headline, 'Premier League brief for Sunday 25 May'); assert.match(bd.body, /1 game finished on Sunday 25 May: Arsenal 2-1 Southampton\./); assert.match(bd.body, /1 game is live now\./); assert.match(bd.body, /Top of the table: 1st Liverpool \(84 points\), 2nd Arsenal \(74 points\)/); assert.deepEqual(validate(bd.body, bf), { ok: true, why: '' });
  const wf = weekFacts('Premier League', '2025-05-19', games), wd = draftWeek(wf); assert.match(wd.body, /1 game was played in the Premier League in the week from Monday 19 May, with 3 scored in all\./); assert.deepEqual(validate(wd.body, wf), { ok: true, why: '' });
  assert.match(draftBrief(briefFacts('NBA', '2025-05-25', [], [], {})).body, /No NBA games are listed/);
  const top = topStories(games); assert.deepEqual(top.map((t) => t.state), ['live', 'final', 'pre']); assert.equal(top[1].headline, 'Arsenal beat Southampton 2-1'); assert.equal(dayWords('2025-05-25'), 'Sunday 25 May');
  assert.equal(polishMessages(bf, bd)[0].role, 'system'); assert.match(polishMessages(bf, bd)[0].content, /Use only the names, numbers and facts/);
});
test('/api/report: the draft always; the model only when its wording validates; capped; kept once', async () => {
  const store = new Map(); globalThis.caches = { default: { match: async (r) => { const v = store.get(r.url); return v ? new Response(v) : undefined; }, put: async (r, res) => { store.set(r.url, await res.text()); } } };
  try {
    let calls = 0, say = 'Arsenal beat Southampton 2-1 at Test Ground, Test Striker scoring on 12 minutes before Test Keeper was sent off for Southampton.';
    const env = { DB: fakeDb(), AI: { run: async () => { calls++; return { response: say }; } } }, get = (q, e = env) => onRequestGet({ request: new Request('https://a-to-mind.com/api/report?' + q), env: e, fetchFn: fakeFeeds() });
    assert.equal((await get('league=epl&kind=nope')).status, 400); assert.equal((await get('league=f1&kind=recap&id=5')).status, 400); assert.equal((await get('league=epl&kind=recap&id=x')).status, 400);
    const a = await (await get('league=epl&kind=recap&id=1001')).json(); assert.equal(a.polished, true); assert.equal(a.body, say); assert.match(a.label, /^Written by Verse from ESPN data · \d\d:\d\d UTC$/); assert.equal(calls, 1);
    const b = await (await get('league=epl&kind=recap&id=1001')).json(); assert.equal(b.cached, true); assert.equal(calls, 1, 'the same story is never written twice');
    say = 'Arsenal beat Southampton 5-0 in the Premier League with Bukayo Saka scoring twice.';
    const preFeeds = async (u) => { if (String(u).includes('/summary')) { const hc = SUMMARY.header.competitions[0], j = { ...SUMMARY, header: { ...SUMMARY.header, competitions: [{ ...hc, status: { type: { state: 'pre', completed: false } } }] } }; return { ok: true, status: 200, text: async () => JSON.stringify(j) }; } return fakeFeeds()(u); };
    const c = await onRequestGet({ request: new Request('https://a-to-mind.com/api/report?league=epl&kind=recap&id=1003'), env, fetchFn: preFeeds }); assert.equal(c.status, 409); assert.equal((await c.json()).kind, 'state');
    store.clear(); const d = await (await get('league=epl&kind=recap&id=1001')).json(); assert.equal(d.polished, false, 'an invented score or name is thrown away'); assert.equal(d.headline, 'Arsenal beat Southampton 2-1'); assert.match(d.body, /Test Striker Goal \(12'\)/);
    store.clear(); const off = await (await get('league=epl&kind=recap&id=1001', {})).json(); assert.equal(off.polished, false); assert.equal(off.capped, false);
    store.clear(); const noDb = await (await get('league=epl&kind=recap&id=1001', { AI: env.AI })).json(); assert.equal(noDb.polished, false); assert.equal(noDb.capped, true, 'no D1 counter: fail closed, the draft is served');
    store.clear(); env.DB = fakeDb(); say = 'Arsenal beat Southampton 2-1 at Test Ground.'; calls = 0; const cap = [];
    for (let i = 0; i < HOUR_CAP + 3; i++) { store.forEach((v, k) => { store.delete(k); }); cap.push(await (await get('league=epl&kind=recap&id=1001')).json()); }
    assert.equal(calls, HOUR_CAP, 'no more than the hour cap of model calls'); assert.equal(cap.at(-1).capped, true); assert.equal(cap.at(-1).polished, false); assert.equal(cap.at(-1).headline, 'Arsenal beat Southampton 2-1', 'past the cap the draft is served');
    store.clear(); const top = await (await get('league=epl&kind=top&date=2025-05-25')).json(); assert.equal(top.stories.length, 3); assert.equal(calls, HOUR_CAP, 'headlines never call the model');
    const br = await (await get('league=epl&kind=brief&date=2025-05-25')).json(); assert.match(br.headline, /brief for Sunday 25 May/);
  } finally { delete globalThis.caches; }
});
