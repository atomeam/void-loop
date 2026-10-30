// The scrim scorer's arithmetic (void-live-deploy/lib/scrim.js, used by /tournaments/). Run: node --test tools/scrim.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { nameKey, parseMatches, roster, mergeNames, duplicatePlaces, duplicateText, serialize, setEntry, renameTeam, standings, legacyPoints, heatList, ordinal, matchCell, catchUp, gaps, matchPoint } from '../void-live-deploy/lib/scrim.js';
import { snapName, parseSpots, spotGroups, spotLine, unclaimed, claimSpot } from '../void-live-deploy/lib/scrim.js';

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

// ---- tiers and kinds (stage 3) ----
import { parseTiers, tierPoints, serializeTiers, tierLabel, tierSentence, legacyTiers, parseRounds, serializeRounds, setRoundEntry, scorer, rank, gapsFor, matchPointFor } from '../void-live-deploy/lib/scrim.js';

test('tier text reads ordinals, ranges and dashes, and a place scores the first tier that holds it', () => {
  const t = parseTiers('1st:10, 2-5:5, 6th–10th: 3; 11-25:1, junk, 30:0');
  assert.deepEqual(t.map((x) => [x.from, x.to, x.pts]), [[1, 1, 10], [2, 5, 5], [6, 10, 3], [11, 25, 1], [30, 30, 0]]);
  assert.deepEqual([1, 2, 5, 6, 10, 11, 25, 26, 30].map((p) => tierPoints(t, p)), [10, 5, 5, 3, 3, 1, 1, 0, 0]);
  assert.equal(serializeTiers(t), '1:10,2-5:5,6-10:3,11-25:1,30:0');
  assert.equal(tierLabel(t[1]), '2nd-5th');
  assert.equal(tierSentence(t), 'Placement points by the highest matching threshold: 1st 10, 2nd-5th 5, 6th-10th 3, 11th-25th 1; everyone else 0.');
});

test('old links keep scoring the same: win and top5 become tiers, and the 22/19/6 match still adds up', () => {
  const t = legacyTiers({ win: 10, top5: 5, top10: 0, top15: 0, top25: 0 });
  assert.equal(serializeTiers(t), '1:10,2-5:5');
  const { rows } = rank(parseRounds('Alpha:1:6,Bravo:2:7,Charlie:6:3'), scorer('br', { tiers: t, elim: 2 }));
  assert.deepEqual(rows.map((r) => [r.name, r.points]), [['Alpha', 22], ['Bravo', 19], ['Charlie', 6]]);
  assert.deepEqual(serializeTiers(legacyTiers({ win: 10, top5: 5, top10: 3, top15: 2, top25: 1 })), '1:10,2-5:5,6-10:3,11-15:2,16-25:1');
});

test('a game night adds scores straight on, allows 0 and negatives, and the top score wins the round', () => {
  const sc = scorer('gamenight');
  const m = parseRounds('Owls:8,Foxes:6,Otters:9;Owls:7,Foxes:9,Otters:5;Owls:10,Foxes:7,Otters:7;Owls:0,Foxes:-2', 'gamenight');
  const { rows } = rank(m, sc);
  assert.deepEqual(rows.map((r) => [r.name, r.points, r.wins]), [['Owls', 25, 2], ['Otters', 21, 1], ['Foxes', 20, 1]]);
  assert.equal(serializeRounds(m, 'gamenight'), 'Owls:8,Foxes:6,Otters:9;Owls:7,Foxes:9,Otters:5;Owls:10,Foxes:7,Otters:7;Owls:0,Foxes:-2');
  assert.equal(gapsFor(rows, sc)[1].hint, '-4 pts · needs 5 pts to lead');
  const set = setRoundEntry(m, 0, 'owls', '0', '', 'gamenight');
  assert.equal(set[0][0].place, 0, 'a score of 0 stays in the round');
  assert.equal(setRoundEntry(m, 0, 'Owls', '', '', 'gamenight')[0].length, 2, 'a blank score takes the team out');
});

test('a league scores 3/1/0 from goals for and against and breaks ties on goal difference, then goals scored', () => {
  const sc = scorer('league');
  const { rows } = rank(parseRounds('Reds:2:1,Blues:1:2,Greens:0:0,Golds:0:0;Reds:0:3,Blues:3:0,Greens:4:1,Golds:1:4', 'league'), sc);
  assert.deepEqual(rows.map((r) => [r.name, r.points, r.wins, r.draws, r.losses, r.diff]), [['Greens', 4, 1, 1, 0, 3], ['Blues', 3, 1, 0, 1, 2], ['Reds', 3, 1, 0, 1, -2], ['Golds', 1, 0, 1, 1, -3]]);
  assert.equal(sc.cell(rows[0].per[1]), '3 (4-1)');
  assert.deepEqual(gapsFor(rows, sc).map((g) => g.hint), ['leads by 1 pts', '-1 pts · needs a win to lead', '-1 pts · needs a win to lead', '-3 pts · needs more than one game to lead']);
  assert.equal(matchPointFor(parseRounds('A:1:0,B:0:1;A:2:0,B:0:2', 'league'), sc, 3).champion, 'A');
});

test('racing pays a graded 10/6/3 plus a bonus point each, and the gap speaks in bonus points', () => {
  const sc = scorer('racing', { tiers: parseTiers('1:10,2:6,3:3'), elim: 1 });
  const { rows } = rank(parseRounds('Red:1:0,Blue:2:2,Green:3:1,Grey:4:0'), sc);
  assert.deepEqual(rows.map((r) => [r.name, r.points]), [['Red', 10], ['Blue', 8], ['Green', 4], ['Grey', 0]]);
  assert.equal(gapsFor(rows, sc)[1].hint, '-2 pts · needs 3 bonus points or a Top 3 to lead');
});

test('starting spots snap by key and word prefix, group by spot and say who is contesting with rank and points', () => {
  assert.equal(snapName('old m', ['Old Mill', 'Harbor']), 'Old Mill');
  assert.equal(snapName('HARB', ['Old Mill', 'Harbor']), 'Harbor');
  assert.equal(snapName('h', ['Harbor', 'Hill']), 'h', 'two prefix hits stay as typed');
  assert.equal(snapName('Old', ['Old Mill']), 'Old', 'a different word count is a different spot');
  const rows = [{ name: 'Alpha', points: 22 }, { name: 'Bravo', points: 19 }, { name: 'Charlie', points: 6 }];
  const claims = parseSpots('alpha:Old Mill\nBravo:Harbor\n charlie : old mill\nDelta:harb', rows.map((r) => r.name));
  assert.deepEqual(claims, [{ team: 'Alpha', spot: 'Old Mill' }, { team: 'Bravo', spot: 'Harbor' }, { team: 'Charlie', spot: 'Old Mill' }, { team: 'Delta', spot: 'Harbor' }]);
  const g = spotGroups(claims, rows);
  assert.deepEqual(g.map((x) => [x.spot, x.contested, spotLine(x)]), [['Old Mill', true, '#1 Alpha (22 pts) vs #3 Charlie (6 pts)'], ['Harbor', true, '#2 Bravo (19 pts) vs Delta']]);
  assert.deepEqual(unclaimed(claims.slice(0, 2), rows), ['Charlie']);
  assert.equal(parseSpots('Alpha:Harbor\nAlpha:Old Mill').length, 1, 'a team keeps its last claim');
  assert.equal(claimSpot('Alpha:Old Mill', 'bravo', 'old', ['Alpha', 'Bravo']), 'Alpha:Old Mill\nBravo:old');
  assert.equal(claimSpot('Alpha:Old Mill', 'bravo', 'old mi', ['Alpha', 'Bravo']), 'Alpha:Old Mill\nBravo:Old Mill');
  assert.equal(claimSpot('Alpha:Old Mill\nBravo:Harbor', 'Alpha', '', ['Alpha', 'Bravo']), 'Bravo:Harbor', 'an empty spot frees the team');
});

import { discordText } from '../void-live-deploy/lib/scrim.js';
test('Copy for Discord writes a bold title and a monospace block whose columns line up, and a name cannot break the block', () => {
  const sc = scorer('racing', { tiers: parseTiers('1:10,2:6,3:3'), elim: 1 });
  const { rows, matches } = rank(parseRounds('Red:1:0,Blue `x`:2:2,A very long team name here:3:1'), sc);
  const text = discordText(rows, sc, { title: 'Cup **night**', rounds: matches.length });
  const lines = text.split('\n');
  assert.equal(lines[0], '**Cup night** · after 1 race');
  assert.equal(lines[1], '```text');
  assert.equal(lines[lines.length - 1], '```');
  assert.equal((text.match(/```/g) || []).length, 2, 'a backtick in a name cannot close the block');
  assert.match(lines[2], /^#  Team\s+Points  Wins  Bonus  Avg place  Best$/);
  assert.match(text, /A very long team name here/, 'a long name is kept whole');
  const body = lines.slice(2, -1), at = body[0].indexOf('Points') + 'Points'.length;
  for (const l of body.slice(1)) assert.match(l.slice(at - 2, at), /\d/, 'points end in the same column: ' + l);
  assert.match(discordText(rows, scorer('gamenight'), { rounds: 3 }), /^\*\*Standings\*\* · after 3 rounds\n/);
});
