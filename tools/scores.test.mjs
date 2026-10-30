// The scores page's pure half (lib/scores.js) and its API (functions/api/scores.js) with FAKE feeds (tools/scores.fixtures.mjs): dates and leagues
// checked against allowlists, each feed read into one shape, the Bundesliga fallback, F1, cache lifetimes, the endpoint's bounds, the routes
import test from 'node:test';
import assert from 'node:assert/strict';
import { LEAGUES, leagueOf, dateOk, shiftDay, readEvent, readScoreboard, readStandings, readSummary, readOpenLiga, seasonOf, readF1Races, readF1Results, readF1Standings, ttlFor, wordsFor, idOk, formOf, weekStart, fantasyPoints, progressOf, winProb, eloOf, simulate, scorePicks, survivorState, draftOrder, botPick, playersOf } from '../void-live-deploy/lib/scores.js';
import { askIn, lookScores, onRequestGet, board } from '../void-live-deploy/functions/api/scores.js';
import { routeAsk, TOOLS, RELATED, CARD_ASK } from '../void-live-deploy/lib/toolkit.js';
import { PAGES } from '../void-live-deploy/lib/seo.js';
import { askIn as sAsk, readAll, lookSearch, onRequestGet as sGet } from '../void-live-deploy/functions/api/sportsearch.js';
import { SDB, SCOREBOARD, STANDINGS, SUMMARY, OPENLIGA, F1_RACES, F1_RESULTS, F1_DRIVERS, F1_CONS, fakeFeeds } from './scores.fixtures.mjs';

const NOW = Date.parse('2025-05-25T16:00:00Z');
test('twelve leagues, each with an id the page and the API share, and a closed list', () => {
  assert.equal(LEAGUES.length, 12); assert.deepEqual(LEAGUES.map((l) => l.id).slice(0, 7), ['epl', 'laliga', 'bundesliga', 'seriea', 'ligue1', 'mls', 'ucl']);
  assert.equal(leagueOf('nba').path, 'basketball/nba'); assert.equal(leagueOf('../etc'), null); assert.equal(leagueOf('constructor'), null); assert.equal(leagueOf('f1').kind, 'f1');
});
test('dates: real days from 2000 to 400 days ahead, nothing else', () => {
  for (const d of ['2025-05-25', '2000-01-01', '2026-06-01']) assert.equal(dateOk(d, NOW), true, d);
  for (const d of ['2025-02-30', '1999-12-31', '2025-5-25', '2025-05-25x', '', '2030-01-01', '20250525', "2025-05-25'; drop"]) assert.equal(dateOk(d, NOW), false, d);
  assert.equal(shiftDay('2025-02-28', 1), '2025-03-01'); assert.equal(shiftDay('2025-01-01', -1), '2024-12-31'); assert.equal(idOk('359'), true); assert.equal(idOk('35a'), false); assert.equal(idOk('1234567890123'), false);
});
test('an ESPN scoreboard becomes games: final, live and upcoming, with goals and cards; broken rows are dropped', () => {
  const g = readScoreboard(SCOREBOARD); assert.equal(g.length, 3);
  assert.equal(g[0].state, 'final'); assert.equal(g[0].home.name, 'Arsenal'); assert.equal(g[0].home.score, '2'); assert.equal(g[0].away.score, '1'); assert.equal(g[0].home.winner, true); assert.equal(g[0].status, 'FT'); assert.equal(g[0].home.color, 'ef0107');
  assert.deepEqual(g[0].events.map((e) => e.kind), ['goal', 'yellow', 'red']); assert.equal(g[0].events[0].who, 'Test Striker');
  assert.equal(g[1].state, 'live'); assert.equal(g[1].status, "67'"); assert.equal(g[2].state, 'pre'); assert.equal(g[2].status, '');
  const ev = readEvent({ id: 1, competitions: [{ competitors: [{ homeAway: 'home', team: { displayName: '<b>X</b>\u0007' }, score: 'DROP' }, { homeAway: 'away', team: { displayName: 'Y' }, score: { displayValue: '3' } }] }] });
  assert.doesNotMatch(ev.home.name, /[<>\u0007]/, 'markup and control characters are stripped'); assert.equal(ev.home.score, ''); assert.equal(ev.away.score, '3');
  assert.equal(readScoreboard(null).length, 0); assert.equal(readScoreboard({ events: 'x' }).length, 0);
});
test('a game carries the town of its ground, for the weather there; the summary fills it from gameInfo when the header has none', () => {
  const comp = (venue) => ({ id: 7, competitions: [{ venue, competitors: [{ homeAway: 'home', team: { displayName: 'A' } }, { homeAway: 'away', team: { displayName: 'B' } }] }] });
  const g = readEvent(comp({ fullName: 'Stamford Bridge', address: { city: 'London', country: 'England' } })); assert.equal(g.venue, 'Stamford Bridge'); assert.equal(g.city, 'London');
  assert.equal(readEvent(comp(undefined)).city, ''); assert.doesNotMatch(readEvent(comp({ address: { city: '<i>X</i>' } })).city, /[<>]/);
  const s = readSummary({ header: { id: 7, competitions: [comp(undefined).competitions[0]] }, gameInfo: { venue: { fullName: 'Anfield', address: { city: 'Liverpool' } } } });
  assert.equal(s.game.venue, 'Anfield'); assert.equal(s.game.city, 'Liverpool');
  const kept = readSummary({ header: { id: 7, competitions: [comp({ fullName: 'Emirates Stadium', address: { city: 'London' } }).competitions[0]] }, gameInfo: { venue: { fullName: 'Elsewhere', address: { city: 'Nowhere' } } } });
  assert.equal(kept.game.venue, 'Emirates Stadium', 'the header venue wins'); assert.equal(kept.game.city, 'London');
  assert.equal(wordsFor('en').vwx, 'Weather at the ground'); assert.equal(wordsFor('de').vwx, 'Wetter am Stadion');
});
test('standings: ranked rows, the sport\'s columns', () => {
  const s = readStandings(STANDINGS, 'soccer'); assert.equal(s.groups.length, 1); assert.deepEqual(s.groups[0].cols, ['P', 'W', 'D', 'L', 'GD', 'Pts']);
  assert.equal(s.groups[0].rows[0].name, 'Liverpool'); assert.deepEqual(s.groups[0].rows[0].cells, ['38', '25', '9', '4', '+45', '84']); assert.equal(s.groups[0].rows[1].rank, 2);
  assert.equal(readStandings({}, 'nba').groups.length, 0); assert.equal(readStandings({ standings: { entries: STANDINGS.children[0].standings.entries } }, 'soccer').groups.length, 1);
});
test('a game summary: key events, team stats, line-ups', () => {
  const s = readSummary(SUMMARY); assert.equal(s.game.home.name, 'Arsenal'); assert.deepEqual(s.events.map((e) => e.kind), ['goal', 'red']); assert.equal(s.stats[0].stats[0].label, 'Possession'); assert.equal(s.lineups[0].starters.length, 1); assert.equal(readSummary({}).game, null);
});
test('the Bundesliga fallback reads OpenLigaDB: final score from the end result, the day by UTC date, the season from July', () => {
  const g = readOpenLiga(OPENLIGA, '2025-05-17', NOW); assert.equal(g.length, 1); assert.equal(g[0].state, 'final'); assert.equal(g[0].home.score, '2'); assert.equal(g[0].away.score, '1'); assert.equal(g[0].home.winner, true); assert.equal(g[0].events[1].kind, 'pen');
  assert.equal(seasonOf('2025-05-17'), 2024); assert.equal(seasonOf('2025-08-01'), 2025); assert.equal(readOpenLiga(OPENLIGA, '2025-05-18', NOW)[0].state, 'final'); assert.equal(readOpenLiga(null, '2025-05-17').length, 0);
});
test('F1 from Jolpica: a race on its day, its finishing order, both standings', () => {
  const r = readF1Races(F1_RACES, '2025-06-01', Date.parse('2025-06-02T00:00:00Z')); assert.equal(r.length, 1); assert.equal(r[0].state, 'final'); assert.equal(r[0].name, 'Spanish Grand Prix'); assert.equal(readF1Races(F1_RACES, '2025-06-02').length, 0);
  assert.equal(readF1Races(F1_RACES, '2025-06-01', Date.parse('2025-05-30T00:00:00Z'))[0].state, 'pre');
  const x = readF1Results(F1_RESULTS); assert.equal(x[0].driver, 'Test Winner'); assert.equal(x[1].time, '+10.0s');
  const s = readF1Standings(F1_DRIVERS, F1_CONS); assert.deepEqual(s.groups.map((g) => g.name), ['Drivers', 'Constructors']); assert.equal(s.groups[0].rows[0].cells[1], '198');
});
test('cache lifetimes: short while live, long once final, an hour for tables', () => {
  const today = '2025-05-25'; assert.equal(ttlFor('scores', { games: readScoreboard(SCOREBOARD) }, today, NOW), 20);
  assert.equal(ttlFor('scores', { games: [{ state: 'final' }] }, '2025-01-01', NOW), 21600); assert.equal(ttlFor('scores', { games: [{ state: 'pre' }] }, '2025-01-01', NOW), 900); assert.equal(ttlFor('scores', { games: [{ state: 'final' }] }, today, NOW), 60);
  assert.equal(ttlFor('standings', {}, today, NOW), 3600); assert.equal(ttlFor('game', { game: { state: 'final' } }, today, NOW), 21600);
});
test('the endpoint asks only what is allowed', () => {
  const u = (q) => 'https://a-to-mind.com/api/scores?' + q;
  assert.equal(askIn(u('league=epl&date=2025-05-25'), NOW).day, '2025-05-25'); assert.equal(askIn(u('league=epl'), NOW).day, '2025-05-25', 'no date means today');
  assert.equal(askIn(u('league=epl&view=standings')).view, 'standings'); assert.equal(askIn(u('league=nba&view=game&id=401')).id, '401'); assert.equal(askIn(u('league=nba&view=team&team=13')).id, '13');
  for (const bad of ['league=evil&date=2025-05-25', 'league=epl&date=yesterday', 'league=epl&view=raw', 'league=nba&view=game&id=../../x', 'league=nba&view=game', 'league=f1&view=game&id=5', 'league=epl&view=team&team=1;2', '', 'date=2025-05-25', 'league=http://evil.test']) assert.equal(askIn(u(bad), NOW), null, bad);
});
test('lookScores calls only the three feeds, with fixed paths, and falls back to OpenLigaDB for the Bundesliga', async () => {
  const log = []; const ok = fakeFeeds(log);
  const a = await lookScores(askIn('https://x.test/api/scores?league=epl&date=2025-05-25', NOW), ok, NOW); assert.equal(a.ok, true); assert.equal(a.games.length, 3); assert.equal(a.source, 'espn'); assert.equal(log[0], 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard?limit=400&dates=20250525');
  const t = await lookScores(askIn('https://x.test/api/scores?league=nba&view=standings', NOW), ok, NOW); assert.equal(t.groups[0].rows.length, 4); assert.ok(log.some((l) => l === 'https://site.api.espn.com/apis/v2/sports/basketball/nba/standings'));
  const g = await lookScores(askIn('https://x.test/api/scores?league=nfl&view=game&id=401', NOW), ok, NOW); assert.equal(g.game.home.name, 'Arsenal');
  const f = await lookScores(askIn('https://x.test/api/scores?league=f1&date=2025-06-01', NOW), ok, Date.parse('2025-06-02T00:00:00Z')); assert.equal(f.games[0].results.length, 2); assert.equal(f.source, 'jolpica');
  const fs = await lookScores(askIn('https://x.test/api/scores?league=f1&view=standings', NOW), ok, NOW); assert.equal(fs.groups.length, 2);
  const espnDown = async (u) => { if (String(u).includes('espn.com')) throw new Error('down'); return fakeFeeds()(u); };
  const bl = await lookScores(askIn('https://x.test/api/scores?league=bundesliga&date=2025-05-17', NOW), espnDown, NOW); assert.equal(bl.ok, true); assert.equal(bl.source, 'openligadb'); assert.equal(bl.games[0].home.name, 'VfB Stuttgart');
  const epl = await lookScores(askIn('https://x.test/api/scores?league=epl&date=2025-05-17', NOW), espnDown, NOW); assert.equal(epl.ok, false, 'no fallback for a league without one: a plain failure');
  for (const l of log) assert.match(l, /^https:\/\/(?:site\.api\.espn\.com|api\.openligadb\.de|api\.jolpi\.ca)\//);
});
test('onRequestGet: 400 for a bad ask, 502 when every feed is down, 200 with the games and no cache headers that last', async () => {
  const get = (q, fetchFn) => onRequestGet({ request: new Request('https://a-to-mind.com/api/scores?' + q), env: {}, fetchFn });
  assert.equal((await get('league=evil')).status, 400);
  const down = await get('league=epl&date=2025-05-25', async () => { throw new Error('down'); }); assert.equal(down.status, 502); assert.equal((await down.json()).ok, false); assert.equal(down.headers.get('cache-control'), 'no-store');
  const good = await get('league=epl&date=2025-05-25', fakeFeeds()); assert.equal(good.status, 200); const j = await good.json(); assert.equal(j.ok, true); assert.equal(j.league, 'epl'); assert.equal(j.games[0].home.name, 'Arsenal'); assert.ok(j.at);
});
test('the ask bar and the registers know the page', () => {
  assert.equal(routeAsk('nba scores'), '/scores/?league=nba'); assert.equal(routeAsk('Premier League table'), '/scores/?league=epl&tab=standings'); assert.equal(routeAsk('bundesliga results'), '/scores/?league=bundesliga'); assert.equal(routeAsk('f1 standings'), '/scores/?league=f1&tab=standings'); assert.equal(routeAsk('live scores'), '/scores/');
  assert.ok(routeAsk('pancake recipe').startsWith('/recipes/')); assert.ok(TOOLS['/scores/'] && RELATED['/scores/'].length && CARD_ASK['/scores/']);
  assert.ok(PAGES.find((p) => p.path === '/scores/')); assert.match(wordsFor('de-DE').scores, /Ergebnisse/); assert.equal(wordsFor('en-US').scores, 'Scores');
});
test('the table checks its own sums, and a game becomes a calendar file', async () => {
  const { rowIssues, icsOf, readStandings: rs } = await import('../void-live-deploy/lib/scores.js');
  const g = rs(STANDINGS, 'soccer').groups[0]; assert.deepEqual(rowIssues(g, 'soccer'), [], 'Liverpool 38 = 25+9+4 and 84 = 3x25+9');
  g.rows[0].cells[5] = '85'; assert.equal(rowIssues(g, 'soccer')[0].name, 'Liverpool'); g.rows[0].cells[0] = '37'; assert.equal(rowIssues(g, 'soccer').length, 2);
  assert.deepEqual(rowIssues({ cols: ['W', 'L', 'Pct'], rows: [{ name: 'A', cells: ['40', '40', '0.500'] }, { name: 'B', cells: ['60', '20', '0.700'] }] }, 'nba').map((x) => x.name), ['B']);
  const ics = icsOf(readScoreboard(SCOREBOARD)[2], leagueOf('epl')); assert.match(ics, /^BEGIN:VCALENDAR\r\n/); assert.match(ics, /DTSTART:20250525T183000Z/); assert.match(ics, /DTEND:20250525T203000Z/); assert.match(ics, /SUMMARY:Chelsea vs Nottingham Forest/); assert.equal(icsOf({ start: 'x' }), '');
});

test('weeks, form, cut-lines, play by play, earlier meetings', async () => {
  assert.equal(weekStart('2025-05-25', 'epl'), '2025-05-19'); assert.equal(weekStart('2025-05-19', 'epl'), '2025-05-19'); assert.equal(weekStart('2025-10-26', 'nfl'), '2025-10-21'); assert.equal(weekStart('2025-10-21', 'nfl'), '2025-10-21'); assert.equal(weekStart('2025-10-20', 'nfl'), '2025-10-14');
  const a = askIn('https://x.test/api/scores?league=nfl&date=2025-10-21&span=7', NOW); assert.equal(a.span, 7); assert.equal(askIn('https://x.test/api/scores?league=nfl&date=2025-10-21&span=30', NOW).span, 1); assert.equal(askIn('https://x.test/api/scores?league=f1&view=form&date=2025-10-21', NOW), null);
  const log = []; const w = await lookScores(a, fakeFeeds(log), NOW); assert.ok(log[0].endsWith('dates=20251021-20251027'), log[0]); assert.equal(w.games.length, 3);
  const f = formOf(readScoreboard(SCOREBOARD)); assert.deepEqual(f['359'], [{ r: 'W', opp: 'SOU', score: '2-1' }]); assert.equal(f['364'], undefined, 'a live game is not a result');
  const fo = await lookScores(askIn('https://x.test/api/scores?league=epl&view=form&date=2025-05-25', NOW), fakeFeeds(log), NOW); assert.ok(log.at(-1).includes('dates=20250413-20250525'), log.at(-1)); assert.equal(fo.form['359'][0].r, 'W');
  const st = readStandings(STANDINGS, 'soccer').groups[0]; assert.equal(st.rows[0].note.text, 'Champions League'); assert.equal(st.rows[0].note.color, '81d6ac'); assert.equal(st.legend.length, 1); assert.equal(st.rows[1].note, null);
  const su = readSummary(SUMMARY); assert.equal(su.plays[0].text, 'Foul by Test Back'); assert.ok(su.plays.some((x) => x.text === 'Full time.')); assert.ok(su.plays.some((x) => x.scoring && x.home === '1')); assert.equal(su.h2h[0].text, '1-1'); assert.deepEqual(su.last5[0].games.map((x) => x.r), ['W', 'D']);
  const ol = readOpenLiga(OPENLIGA, '2025-05-17', NOW, 2); assert.equal(ol.length, 2, 'a week reads both days');
});
test('the stale copy answers at once while the feed is asked again behind it', async () => {
  const store = new Map(); globalThis.caches = { default: { match: async (r) => { const v = store.get(r.url); return v ? new Response(v, { headers: { 'content-type': 'application/json' } }) : undefined; }, put: async (r, res) => { store.set(r.url, await res.text()); } } };
  try {
    const pend = []; const req = () => ({ request: new Request('https://a-to-mind.com/api/scores?league=epl&date=2025-05-17'), env: {}, fetchFn: fakeFeeds(), waitUntil: (p) => pend.push(p) });
    const first = await (await onRequestGet(req())).json(); assert.equal(first.ok, true);
    for (const k of [...store.keys()].filter((k) => !k.endsWith('/keep'))) store.delete(k); // the fresh copy has expired, the kept one has not
    for (const [k, v] of [...store]) store.set(k, v.replace('"state":"live"', '"state":"final"')); // a live score that old would be wrong, so only settled copies answer at once
    const slow = { ...req(), fetchFn: (u) => new Promise((r) => setTimeout(() => r(fakeFeeds()(u)), 150)) }, t0 = Date.now(); const second = await (await onRequestGet(slow)).json();
    assert.equal(second.stale, true); assert.equal(second.revalidating, true); assert.ok(Date.now() - t0 < 500, 'answered without waiting on the feed'); assert.equal(second.games.length, 3); await Promise.all(slow.pend || pend);
  } finally { delete globalThis.caches; }
});

test('fantasy points, win chance, ratings, the what-if table, pick\'em and survivor', () => {
  const rec = ['REC', 'YDS', 'AVG', 'TD', 'LONG'], row = ['8', '100', '12.5', '1', '30'];
  assert.equal(fantasyPoints('receiving', rec, row, 'ppr'), 24); assert.equal(fantasyPoints('receiving', rec, row, 'half'), 20); assert.equal(fantasyPoints('receiving', rec, row, 'std'), 16);
  assert.equal(fantasyPoints('passing', ['C/ATT', 'YDS', 'AVG', 'TD', 'INT'], ['20/30', '300', '10', '2', '1'], 'std'), 18); assert.equal(fantasyPoints('rushing', ['CAR', 'YDS', 'AVG', 'TD'], ['20', '100', '5', '1'], 'ppr'), 16); assert.equal(fantasyPoints('kicking', [], []), null);
  assert.equal(progressOf("45'", 'soccer'), 0.5); assert.equal(progressOf('HT', 'soccer'), 0.5); assert.ok(Math.abs(progressOf('6:00 - 2nd', 'nba') - 0.375) < 1e-9); assert.equal(progressOf('???', 'nba'), null);
  const live = (st, h, a) => ({ state: 'live', status: st, home: { score: h }, away: { score: a } });
  const e = winProb(live("67'", '1', '1'), 'soccer'); assert.ok(Math.abs(e.home - e.away) < 1e-9 && e.draw > 0.5 && Math.abs(e.home + e.draw + e.away - 1) < 1e-9);
  assert.ok(winProb(live("80'", '2', '0'), 'soccer').home > 0.95); assert.ok(winProb(live('2:00 - 4th', '100', '90'), 'nba').home > 0.98); assert.ok(Math.abs(winProb(live('6:00 - 2nd', '50', '50'), 'nba').home - 0.5) < 1e-6);
  assert.equal(winProb({ state: 'final' }, 'soccer'), null); assert.equal(winProb(live('weird', '1', '0'), 'nba'), null);
  const gs = [{ state: 'final', start: '2025-01-01', home: { id: 'a', name: 'A', score: '2' }, away: { id: 'b', name: 'B', score: '0' } }, { state: 'final', start: '2025-01-02', home: { id: 'b', name: 'B', score: '1' }, away: { id: 'a', name: 'A', score: '1' } }, { state: 'pre', home: { id: 'a', score: '' }, away: { id: 'c', score: '' } }];
  const el = eloOf(gs); assert.ok(el.a.elo > 1500 && el.b.elo < 1500 && el.a.n === 2 && !el.c, 'only finished games count');
  const g = readStandings(STANDINGS, 'soccer').groups[0], up = readScoreboard(SCOREBOARD).filter((x) => x.state === 'pre');
  const base = simulate(g, up, {}, 'soccer'); assert.deepEqual(base.rows.map((r) => r.name), g.rows.map((r) => r.name), 'no picks, no change');
  const sim = simulate(g, up, { [up[0].id]: 'a' }, 'soccer'); const nfo = sim.rows.find((r) => r.name === 'Nottingham Forest'), che = sim.rows.find((r) => r.name === 'Chelsea');
  assert.equal(nfo.cells[5], '68'); assert.equal(nfo.cells[0], '39'); assert.equal(che.cells[3], '9'); assert.equal(nfo.rank, 3); assert.equal(nfo.moved, 1); assert.equal(che.moved, -1); assert.equal(g.rows[2].cells[5], '66', 'the original table is untouched');
  assert.equal(simulate(g, up, { [up[0].id]: 'd' }, 'soccer').rows.find((r) => r.name === 'Chelsea').cells[5], '67');
  const fin = readScoreboard(SCOREBOARD), ids = fin.map((x) => x.id); assert.deepEqual(scorePicks(fin, { [ids[0]]: 'h', [ids[2]]: 'h' }), { right: 1, played: 1, points: 1, total: 1 }); assert.deepEqual(scorePicks(fin, { [ids[0]]: 'a' }, { [ids[0]]: 5 }), { right: 0, played: 1, points: 0, total: 5 });
  const wk = { w1: [{ state: 'final', home: { id: 'a', score: '2' }, away: { id: 'b', score: '1' } }], w2: [{ state: 'pre', home: { id: 'c', score: '' }, away: { id: 'd', score: '' } }] };
  assert.equal(survivorState({ w1: 'a' }, wk).status, 'alive'); assert.equal(survivorState({ w1: 'a', w2: 'c' }, wk).status, 'open'); assert.equal(survivorState({ w1: 'b' }, wk).status, 'out'); assert.equal(survivorState({ w1: 'a', w2: 'a' }, wk).why, 'a team used twice');
});

test('US conference tables get playoff places by rank, said plainly; a table ESPN already marks is left alone', () => {
  const mk = (n) => ({ children: [{ name: 'Eastern Conference', standings: { entries: Array.from({ length: n }, (_, i) => ({ team: { id: String(i + 1), displayName: 'T' + (i + 1) }, stats: [{ name: 'rank', value: i + 1 }, { name: 'wins', displayValue: String(60 - i) }, { name: 'losses', displayValue: String(20 + i) }] })) } }] });
  const g = readStandings(mk(15), 'nba').groups[0]; assert.equal(g.rows[5].note.text, 'Playoffs (by rank)'); assert.equal(g.rows[6].note.text, 'Play-in (by rank)'); assert.equal(g.rows[9].note.text, 'Play-in (by rank)'); assert.equal(g.rows[10].note, null); assert.equal(g.legend.length, 2);
  assert.equal(readStandings(mk(16), 'nfl').groups[0].rows.filter((r) => r.note).length, 7); assert.match(readStandings(mk(16), 'nfl').groups[0].legend[0].text, /not modelled/);
  assert.equal(readStandings(STANDINGS, 'soccer').groups[0].rows[2].note, null, 'soccer is untouched');
});

test('the mock draft: snake order, a bot that mostly takes the best, a pasted list read', () => {
  assert.deepEqual(draftOrder(3, 2).map((p) => p.team), [0, 1, 2, 2, 1, 0]); assert.equal(draftOrder(10, 6).length, 60); assert.equal(draftOrder(4, 3)[4].round, 2);
  assert.equal(botPick(['a', 'b', 'c', 'd', 'e'], 0), 0); assert.ok(botPick(['a', 'b', 'c', 'd', 'e'], 0.99) <= 3); assert.equal(botPick(['a'], 0.99), 0); assert.equal(botPick([], 0.5), -1);
  assert.deepEqual(playersOf('1. Ann Lee\n2) Bob Ray\n\n  3 - Cy Dee\nann lee\nEve'), ['Ann Lee', 'Bob Ray', 'Cy Dee', 'Eve']); assert.equal(playersOf('x\n'.repeat(5) + 'y').length, 2);
});

test('the search box: a plain name in, two sources read into text fields only, nothing else reachable', async () => {
  const { readEspn, merge } = await import('../void-live-deploy/functions/api/sportsearch.js'), { ESPN_SEARCH } = await import('./scores.fixtures.mjs');
  assert.deepEqual(sAsk('https://x.test/api/sportsearch?q=arsenal'), { q: 'arsenal' }); for (const bad of ['', 'a', 'x'.repeat(41), '../etc', 'a<b>', 'a;b', 'http://evil.test']) assert.equal(sAsk('https://x.test/api/sportsearch?q=' + encodeURIComponent(bad)), null, bad);
  const r = readAll(SDB.teams, SDB.event, SDB.venues, SDB.player); assert.equal(r.teams[0].name, 'Arsenal'); assert.equal(r.teams[0].src, 'TheSportsDB'); assert.equal(r.events[0].hs, '2'); assert.equal(r.venues[0].capacity, '60260'); assert.doesNotMatch(r.players[0].name, /[<>]/); assert.equal(r.teams[0].badge, undefined, 'no picture addresses are passed on');
  const e = readEspn(ESPN_SEARCH); assert.equal(e.teams.length, 1); assert.equal(e.teams[0].league, 'English Premier League'); assert.equal(e.teams[0].sport, 'Soccer'); assert.equal(e.players[0].name, 'Test Winger'); assert.equal(e.teams[0].src, 'ESPN'); assert.equal(readEspn({ results: [{ contents: [{ type: 'team', displayName: 'X FC' }] }] }).teams[0].name, 'X FC'); assert.deepEqual(readEspn(null), { teams: [], players: [] });
  assert.equal(merge(r, e).teams.length, 1, 'one Arsenal, the first source\'s'); assert.equal(merge(r, e).players.length, 2);
  const log = []; const f = async (u) => { log.push(String(u)); return fakeFeeds()(u); }; const out = await lookSearch({ q: 'arsenal' }, f); assert.equal(out.ok, true); assert.equal(log.length, 5); assert.equal(out.source, 'TheSportsDB and ESPN'); for (const l of log) assert.match(l, /^https:\/\/(?:www\.thesportsdb\.com\/api\/v1\/json\/123\/search|site\.api\.espn\.com\/apis\/common\/v3\/search\?limit=10&query=)/);
  const espnOnly = async (u) => { if (String(u).includes('thesportsdb')) return { ok: false, status: 429, json: async () => ({}) }; return fakeFeeds()(u); }; const eo = await lookSearch({ q: 'arsenal' }, espnOnly); assert.equal(eo.ok, true); assert.equal(eo.teams[0].src, 'ESPN', 'the second source answers when the first is refused'); assert.equal(eo.sources.thesportsdb, 429); assert.equal(eo.sources.espn, 200);
  const nothing = await lookSearch({ q: 'zzzz' }, async () => ({ ok: true, status: 200, json: async () => ({}) })); assert.equal(nothing.ok, true); assert.equal(nothing.teams.length, 0);
  assert.equal((await lookSearch({ q: 'x1' }, async () => { throw new Error('down'); })).ok, false);
  assert.equal((await sGet({ request: new Request('https://a-to-mind.com/api/sportsearch?q=%3Cb%3E'), env: {} })).status, 400);
  const good = await (await sGet({ request: new Request('https://a-to-mind.com/api/sportsearch?q=arsenal'), env: {}, fetchFn: fakeFeeds() })).json(); assert.equal(good.players.length, 2); assert.equal(good.report, undefined);
  assert.equal((await sGet({ request: new Request('https://a-to-mind.com/api/sportsearch?q=arsenal&diag=1'), env: {}, fetchFn: fakeFeeds() })).status, 401, 'the diag is the owner\'s');
  const dg = await (await sGet({ request: new Request('https://a-to-mind.com/api/sportsearch?q=arsenal&diag=1', { headers: { authorization: 'Bearer ownerkey' } }), env: { READ_TOKEN: 'ownerkey' }, fetchFn: espnOnly })).json(); assert.equal(dg.ok, true); assert.equal(dg.sources.thesportsdb, 429); assert.equal(dg.sources.espn, 200); assert.equal(dg.calls.length, 5); assert.equal(dg.found.espn, 2); assert.doesNotMatch(JSON.stringify(dg), /123\/search|ownerkey/, 'no address or key in the diag');
});

test('ESPN refuses a range of days (October 2026): a week is read day by day and a longer span month by month', async () => {
  const log = [], base = 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1';
  const res = (o, status = 200) => ({ ok: status < 400, status, text: async () => JSON.stringify(o) });
  const feed = async (u) => { log.push(u); const d = new URL(u).searchParams.get('dates');
    if (d.includes('-')) return res({ code: 400, message: 'Failed to get events endpoint.' }, 400);
    if (d === '20250526') return res({}, 500); // one day that does not answer leaves the others
    return res(d.length === 6 || d === '20250525' ? SCOREBOARD : { events: [] }); };
  const week = await board(feed, base, '2025-05-21', '2025-05-27');
  assert.equal(log.length, 1 + 7, 'the range once, then each of the 7 days'); assert.deepEqual(week.map((g) => g.id), ['1001', '1002', '1003'], 'each game once, in order');
  log.length = 0; const six = await board(feed, base, '2025-04-13', '2025-05-25');
  assert.deepEqual(log.slice(1).map((u) => new URL(u).searchParams.get('dates')), ['202504', '202505'], 'six weeks: the two months'); assert.equal(six.length, 3);
  assert.equal((await board(feed, base, '2025-05-28', '2025-06-02')).length, 0, 'a week with no games is an empty week, not a failure');
  await assert.rejects(board(async () => res({}, 500), base, '2025-05-21', '2025-05-27'), 'nothing answered: the page is told the feed is away');
  const a = await lookScores(askIn('https://x.test/api/scores?league=epl&date=2025-05-21&span=7', NOW), feed, NOW); assert.equal(a.ok, true); assert.equal(a.games.length, 3);
});

test('a game opens on Verse\'s own calendar: the link carries its title, its wall clock in the visitor\'s zone and the same length as the .ics', async () => {
  const { calendarEvent } = await import('../void-live-deploy/lib/scores.js');
  const { eventFromLink } = await import('../void-live-deploy/lib/calendar.js');
  const g = readScoreboard(SCOREBOARD)[2], e = calendarEvent(g, leagueOf('epl'), 'America/New_York');
  assert.match(e, /^[\w-]+$/, 'base64url, safe in a link as it is');
  const ev = eventFromLink(e);
  assert.equal(ev.title, 'Chelsea vs Nottingham Forest'); assert.equal(ev.tz, 'America/New_York');
  assert.equal(ev.start, '2025-05-25T14:30'); assert.equal(ev.end, '2025-05-25T16:30'); // 18:30 UTC, two hours, as icsOf
  assert.match(ev.notes, /typical length, not a schedule/);
  assert.equal(eventFromLink(calendarEvent(g, leagueOf('nfl'), 'UTC')).end, '2025-05-25T21:30', 'an NFL game runs three hours, as in the .ics');
  assert.equal(calendarEvent({ start: 'x' }, leagueOf('epl'), 'UTC'), ''); assert.equal(calendarEvent(g, leagueOf('epl'), 'Not/AZone'), ''); assert.equal(calendarEvent(g, leagueOf('epl'), ''), '');
});
