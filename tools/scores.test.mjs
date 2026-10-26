// The scores page's pure half (lib/scores.js) and its API (functions/api/scores.js) with FAKE feeds (tools/scores.fixtures.mjs): dates and leagues
// checked against allowlists, each feed read into one shape, the Bundesliga fallback, F1, cache lifetimes, the endpoint's bounds, the routes
import test from 'node:test';
import assert from 'node:assert/strict';
import { LEAGUES, leagueOf, dateOk, shiftDay, readEvent, readScoreboard, readStandings, readSummary, readOpenLiga, seasonOf, readF1Races, readF1Results, readF1Standings, ttlFor, wordsFor, idOk } from '../void-live-deploy/lib/scores.js';
import { askIn, lookScores, onRequestGet } from '../void-live-deploy/functions/api/scores.js';
import { routeAsk, TOOLS, RELATED, CARD_ASK } from '../void-live-deploy/lib/toolkit.js';
import { PAGES } from '../void-live-deploy/lib/seo.js';
import { SCOREBOARD, STANDINGS, SUMMARY, OPENLIGA, F1_RACES, F1_RESULTS, F1_DRIVERS, F1_CONS, fakeFeeds } from './scores.fixtures.mjs';

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
  const a = await lookScores(askIn('https://x.test/api/scores?league=epl&date=2025-05-25', NOW), ok, NOW); assert.equal(a.ok, true); assert.equal(a.games.length, 3); assert.equal(a.source, 'espn'); assert.equal(log[0], 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard?dates=20250525');
  const t = await lookScores(askIn('https://x.test/api/scores?league=nba&view=standings', NOW), ok, NOW); assert.equal(t.groups[0].rows.length, 2); assert.ok(log.some((l) => l === 'https://site.api.espn.com/apis/v2/sports/basketball/nba/standings'));
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
