// The scrim scorer's arithmetic (void-live-deploy/lib/scrim.js, used by /tournaments/). Run: node --test tools/scrim.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { nameKey, parseMatches, roster, mergeNames, duplicatePlaces, duplicateText, serialize, setEntry, renameTeam, standings, legacyPoints, heatList, ordinal, matchCell, catchUp, gaps, matchPoint } from '../void-live-deploy/lib/scrim.js';

const RULES = { elim: 2, win: 10, top5: 5, top10: 0, top15: 0, top25: 0 };
const pts = (p) => legacyPoints(RULES, p);

test('names merge with case and spacing ignored, under the first spelling typed', () => {
  assert.equal(nameKey('  Team   Alpha '), 'team alpha');
  const m = parseMatches('Alpha:1:6,Bravo:2:7; alpha :3:1,  BRAVO:1:2,Team  Charlie:4:0\nteam charlie:2:2');
  assert.deepEqual(roster(m).map((r) => r.name), ['Alpha', 'Bravo', 'Team Charlie']);
  const merged = mergeNames(m);
  assert.deepEqual(merged[1].map((t) => t.name), ['Alpha', 'Bravo', 'Team Charlie']);
  const { rows } = standings(m, pts, RULES.elim);
  assert.equal(rows.length, 3, 'alpha and Alpha are one row');
  assert.deepEqual(rows.map((r) => [r.name, r.points, r.matches]), [['Bravo', 19 + 14, 2], ['Alpha', 22 + 7, 2], ['Team Charlie', 5 + 9, 2]]);
});

test('a team typed twice in one match counts once', () => {
  const merged = mergeNames(parseMatches('Alpha:1:6,alpha:2:3'));
  assert.equal(merged[0].length, 1); assert.deepEqual(merged[0][0], { name: 'Alpha', place: 1, elims: 6 });
});

test('the seeded ask still works out to 22, 19 and 6 (the old format reads the same)', () => {
  const { rows, matches } = standings(parseMatches('Alpha:1:6,Bravo:2:7,Charlie:6:3'), pts, 2);
  assert.equal(matches.length, 1);
  assert.deepEqual(rows.map((r) => [r.name, r.points, r.wins, r.elims, r.avg, r.best]), [['Alpha', 22, 1, 6, 1, 1], ['Bravo', 19, 0, 7, 2, 2], ['Charlie', 6, 0, 3, 6, 6]]);
  assert.deepEqual(rows[0].per, [{ pts: 22, place: 1, elims: 6 }]);
});

test('two teams on one place in a match are found and said plainly', () => {
  const d = duplicatePlaces(parseMatches('A:1:0,B:2:0;A:1:0,B:1:3,C:1:0,D:4:0'));
  assert.deepEqual(d, [{ match: 2, place: 1, teams: ['A', 'B', 'C'] }]);
  assert.equal(duplicateText(d), 'Match 2: A and B and C are both 1st.');
  assert.deepEqual(duplicatePlaces(parseMatches('A:1:0,B:2:0')), []);
});

test('the grid writes back the URL format: set, clear and a new match', () => {
  let m = parseMatches('Alpha:1:6,Bravo:2:7');
  m = setEntry(m, 1, 'bravo', 1, 4);
  assert.equal(serialize(m), 'Alpha:1:6,Bravo:2:7;bravo:1:4');
  m = setEntry(mergeNames(m), 1, 'Alpha', '3', '');
  assert.equal(serialize(m), 'Alpha:1:6,Bravo:2:7;Bravo:1:4,Alpha:3:0');
  m = setEntry(m, 1, 'Alpha', '', '');
  assert.equal(serialize(m), 'Alpha:1:6,Bravo:2:7;Bravo:1:4', 'a blank place takes the team out of that match');
  assert.equal(serialize(setEntry(m, 1, 'Bravo', 0, 0)), 'Alpha:1:6,Bravo:2:7', 'an empty match is dropped');
  assert.equal(serialize(renameTeam(parseMatches('Alfa:1:2;Alpha:2:1'), 'Alfa', 'Alpha')), 'Alpha:1:2;Alpha:2:1');
  assert.equal(serialize(parseMatches('Odd:Name:1:2')), 'Odd:1:1', 'the format\'s own marks never get into a name');
});

test('ordinals and snake heats', () => {
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 101].map(ordinal), ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '101st']);
  assert.deepEqual(heatList(['a', 'b', 'c', 'd', 'e'].map((name) => ({ name })), 2), [['a', 'd', 'e'], ['b', 'c']]);
});

test('per-match cells say points, place and elims', () => {
  assert.equal(matchCell({ pts: 22, place: 1, elims: 6 }), '22 (1/6)');
  assert.equal(matchCell(null), '–');
});

test('the gap to 1st says the points behind and what one match needs to pass', () => {
  const { rows } = standings(parseMatches('Alpha:1:6,Bravo:2:7,Charlie:6:3'), pts, 2);
  const g = gaps(rows, pts, 2);
  assert.deepEqual(g.map((x) => x.hint), ['leads by 3 pts', '-3 pts · needs 2 elims or a Top 5 to lead', '-16 pts · needs 9 elims or a win plus 4 elims to lead']);
  assert.equal(catchUp(1, pts, 2), '1 elim or a Top 5');
  assert.equal(catchUp(10, pts, 0), 'a win');
  assert.equal(catchUp(11, pts, 0), '');
});

test('a team below the cutoff is measured against the last place that qualifies', () => {
  const { rows } = standings(parseMatches('A:1:0,B:2:0,C:3:2,D:9:0'), pts, 2);
  const g = gaps(rows, pts, 2, { cutoff: 2 });
  assert.equal(g[2].target, 'cutoff'); assert.equal(g[2].gap, 4, 'B (5) against C (9), the last team in');
  assert.equal(rows[1].name, 'C'); assert.equal(g[2].hint, '-4 pts · needs 3 elims or a Top 5 to make the top 2');
  assert.equal(g[3].hint, '-9 pts · needs 5 elims or a win to make the top 2');
});

test('match point: reaching the threshold makes a team eligible, and its next win takes it', () => {
  const m = parseMatches('A:1:5,B:2:0;A:3:0,B:1:0;B:2:0,A:1:0');
  assert.deepEqual(matchPoint(m, pts, 2, 15), { champion: 'A', match: 3, eligible: ['A', 'B'] }, 'A hit 20 in match 1; B won match 2 before it was eligible; A wins match 3');
  assert.deepEqual(matchPoint(parseMatches('A:1:5'), pts, 2, 15), { champion: '', match: 0, eligible: ['A'] });
  assert.equal(matchPoint(m, pts, 2, 0).champion, '');
});
