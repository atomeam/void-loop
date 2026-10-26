// The fantasy page's pure half: sheets read from CSV, TSV and JSON, player against player, start or sit, trades, boards, and stats derived from box scores
import test from 'node:test';
import assert from 'node:assert/strict';
import { numOf, cells, parseSheet, lowerIsBetter, compare, startSit, tradeValue, board, entriesFrom, deriveStats } from '../void-live-deploy/lib/fantasy.js';
import { readSummary } from '../void-live-deploy/lib/scores.js';

const CSV = 'Player,Pos,Team,Proj,Floor,Ceiling,ADP\nAnn Lee,RB,AAA,15.5,9,24,3\n"Bob, Jr.",WR,BBB,14.2,10,20,5\nCy Dee,QB,CCC,"11",,,12\nAnn Lee,RB,AAA,99,1,1,1';
test('numbers and sheets are read as people write them', () => {
  assert.equal(numOf('$14'), 14); assert.equal(numOf('63%'), 63); assert.equal(numOf('1,234'), 1234); assert.equal(numOf('-3.5'), -3.5); assert.equal(numOf('.5'), 0.5); assert.equal(numOf('x'), null); assert.equal(numOf(''), null);
  assert.deepEqual(cells('a,b\n"x, y","say ""hi"""\n'), [['a', 'b'], ['x, y', 'say "hi"']]); assert.deepEqual(cells('a\tb\n1\t2'), [['a', 'b'], ['1', '2']]); assert.deepEqual(cells('a;b\n1;2'), [['a', 'b'], ['1', '2']]);
  const s = parseSheet(CSV); assert.equal(s.ok, true); assert.equal(s.nameCol, 'Player'); assert.equal(s.rows.length, 3, 'a repeated name is dropped'); assert.equal(s.rows[1].Player, 'Bob, Jr.'); assert.deepEqual(s.numeric, ['Proj', 'Floor', 'Ceiling', 'ADP']);
  assert.equal(parseSheet(JSON.stringify([{ name: 'A', pts: 3 }, { name: 'B', pts: 5 }])).rows.length, 2); assert.equal(parseSheet(JSON.stringify({ players: [{ player: 'A', x: 1 }] })).nameCol, 'player'); assert.equal(parseSheet(JSON.stringify({ A: { pts: 3 }, B: { pts: 4 } })).rows[1].name, 'B');
  for (const bad of ['', '   ', '{"a":', 'only a header', '[1,2,3]']) assert.equal(parseSheet(bad).ok, false, bad);
  assert.doesNotMatch(parseSheet('Player,Proj\n<b>x</b>\u0007,3').rows[0].Player, /\u0007/);
});
test('a smaller number is better for rank, ADP and the like', () => { for (const c of ['ADP', 'Rank', 'overall rank', 'Tier', 'Age']) assert.equal(lowerIsBetter(c), true, c); for (const c of ['Proj', 'Points', 'Ceiling']) assert.equal(lowerIsBetter(c), false, c); });
const sheet = parseSheet(CSV);
test('player against player marks the best number in each column, the right way round', () => {
  const c = compare(sheet, ['Ann Lee', 'Bob, Jr.']), proj = c.lines.find((l) => l.col === 'Proj'), adp = c.lines.find((l) => l.col === 'ADP');
  assert.deepEqual(proj.best, [true, false]); assert.deepEqual(adp.best, [true, false], 'ADP 3 beats 5'); assert.deepEqual(c.players, ['Ann Lee', 'Bob, Jr.']);
  assert.deepEqual(compare(sheet, ['Ann Lee', 'Nobody']).players, ['Ann Lee']);
});
test('start or sit says who, by how much, and what the floor and ceiling say', () => {
  const r = startSit(sheet, ['Ann Lee', 'Bob, Jr.'], 'Proj', 'Floor', 'Ceiling'); assert.equal(r.start, 'Ann Lee'); assert.deepEqual(r.sit, ['Bob, Jr.']); assert.equal(r.margin, 1.3); assert.match(r.verdict, /Start Ann Lee: 15.5 against 14.2 for Bob, Jr\. in Proj \(a margin of 1\.3\)\./); assert.match(r.verdict, /Bob, Jr\. has the higher floor \(10 against 9\)\./); assert.doesNotMatch(r.verdict, /ceiling/);
  assert.equal(startSit(sheet, ['Ann Lee', 'Bob, Jr.'], 'ADP').start, 'Ann Lee', 'a lower ADP starts'); assert.equal(startSit(sheet, ['Ann Lee'], 'Proj').ok, false); assert.equal(startSit(sheet, ['Ann Lee', 'Cy Dee'], 'Floor').ok, false, 'a player with no number in the column is left out');
});
test('a trade adds up the visitor\'s own column and says how fair it is', () => {
  const r = tradeValue(sheet, ['Ann Lee'], ['Bob, Jr.'], 'Proj'); assert.equal(r.give, 15.5); assert.equal(r.get, 14.2); assert.equal(r.net, -1.3); assert.match(r.verdict, /You give up 1\.3 Proj \(8\.4%\)/);
  assert.match(tradeValue(sheet, ['Ann Lee'], ['Ann Lee'], 'Proj').verdict, /Close to even/); assert.match(tradeValue(sheet, ['Ann Lee'], ['Bob, Jr.'], 'ADP').verdict, /ahead|give up/); assert.equal(tradeValue(sheet, [], ['Ann Lee'], 'Proj').ok, false);
  assert.match(tradeValue(sheet, ['Bob, Jr.'], ['Ann Lee'], 'Proj').verdict, /ahead by 1\.3/);
});
test('the board ranks by a column, best first', () => { assert.deepEqual(board(sheet, 'Proj').map((x) => x.name), ['Ann Lee', 'Bob, Jr.', 'Cy Dee']); assert.deepEqual(board(sheet, 'ADP').map((x) => x.name), ['Ann Lee', 'Bob, Jr.', 'Cy Dee']); assert.equal(board(sheet, 'Floor').length, 2); });
test('stats are derived from box scores: games, averages, the last n and home and away', () => {
  const box = (home, ys) => ({ game: { home: home ? { abbr: 'TMA', name: 'Team A', short: 'A' } : { abbr: 'OPP', name: 'Opp', short: 'Opp' }, away: home ? { abbr: 'OPP', name: 'Opp', short: 'Opp' } : { abbr: 'TMA', name: 'Team A', short: 'A' } }, players: [{ team: 'TMA', groups: [{ name: 'receiving', labels: ['REC', 'YDS', 'AVG', 'TD', 'LONG'], rows: [{ name: 'A. Wide', stats: ['5', String(ys), '10', '1', '30'] }] }] }] });
  const e = [...entriesFrom(box(true, 100), 'nfl', '2025-10-01'), ...entriesFrom(box(false, 50), 'nfl', '2025-10-08'), ...entriesFrom(box(true, 70), 'nfl', '2025-10-15')];
  assert.equal(e.length, 3); assert.equal(e[0].home, true); assert.equal(e[1].home, false); assert.equal(e[0].fpts, 21); assert.equal(e[0].stats.YDS, 100);
  const d = deriveStats(e, 'YDS', 2)[0]; assert.equal(d.games, 3); assert.equal(d.avg, 73.33); assert.equal(d.last, 60); assert.equal(d.home, 85); assert.equal(d.away, 50); assert.equal(d.trend, -13.33);
  assert.equal(deriveStats(e, 'FPTS', 1)[0].avg, 18.33); assert.deepEqual(deriveStats(e, 'NOPE'), []); assert.deepEqual(entriesFrom({}, 'nfl', '2025-10-01'), []);
  assert.equal(entriesFrom(readSummary({}), 'nba', 'x').length, 0);
});
