// Match graphics: the right goals at the right minutes, scores in the picture, names escaped, an alt text that says the facts
import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreCard, timeline, statsBars, curve, pitch, collage, minuteOf, sideOf } from '../void-live-deploy/lib/matchgfx.js';
import { readScoreboard, readSummary } from '../void-live-deploy/lib/scores.js';
import { SCOREBOARD, SUMMARY } from './scores.fixtures.mjs';

const games = readScoreboard(SCOREBOARD), g = games[0];
test('minutes and sides are read from the feed\'s own words', () => {
  assert.equal(minuteOf("12'"), 12); assert.equal(minuteOf("45'+2'"), 47); assert.equal(minuteOf('90 + 4'), 94); assert.equal(minuteOf('x'), null);
  assert.equal(sideOf({ team: '359' }, g), 'home'); assert.equal(sideOf({ team: 'Southampton' }, g), 'away'); assert.equal(sideOf({ team: '' }, g), null);
});
test('the score card carries the score, the names, the colours and a plain alt text', () => {
  const c = scoreCard(g, 'Premier League', 'ESPN'); assert.match(c.svg, /^<svg [^>]*role="img"/); assert.match(c.svg, />2 - 1</); assert.match(c.svg, />Arsenal</); assert.match(c.svg, /fill="#ef0107"/); assert.match(c.svg, /Drawn by Verse from ESPN data/);
  assert.equal(c.alt, 'Premier League: Arsenal 2 - 1 Southampton, FT, Test Ground.'); assert.match(c.svg, /aria-label="Premier League: Arsenal 2 - 1 Southampton, FT, Test Ground\."/);
  assert.match(scoreCard(games[2], 'Premier League', 'ESPN', '18:30').alt, /Chelsea against Nottingham Forest, 18:30/);
});
test('names and text from a feed are escaped in every picture', () => {
  const evil = { ...g, home: { ...g.home, name: 'A<script>alert(1)</script>&"B' }, venue: '<img onerror=x>' }, all = [scoreCard(evil, 'L<>', 'S').svg, timeline(evil).svg, statsBars(evil.home.name, 'x', [{ label: '<b>', home: '1', away: '2' }]).svg, collage([evil], 'L', 'D').svg, curve([50], evil.home.name, 'y').svg];
  for (const s of all) { assert.doesNotMatch(s, /<script|<img|<b>/); assert.match(s, /^<svg/); assert.equal((s.match(/</g) || []).length, (s.match(/>/g) || []).length, 'balanced markup'); }
  assert.match(all[0], /A&lt;script&gt;/);
});
test('the timeline puts each goal and card at its minute, the home side above the axis', () => {
  const t = timeline(g), at = (m) => 30 + m / 90 * 540;
  const goal = /<circle cx="([\d.]+)" cy="(\d+)" r="8" fill="#ffffff" data-min="12" data-kind="goal"/.exec(t.svg); assert.ok(goal, 'a goal at 12 minutes'); assert.ok(Math.abs(+goal[1] - at(12)) < 0.1); assert.ok(+goal[2] < 90, 'Arsenal (home) is above the axis');
  const yel = /<rect x="([\d.]+)" y="(\d+)" width="10" height="14" fill="#f2c230" data-min="40"/.exec(t.svg), red = /fill="#d6334a" data-min="77" data-kind="red"/.exec(t.svg); assert.ok(yel && red); assert.ok(+yel[2] > 50 && +yel[2] + 7 > 90, 'Southampton (away) is below the axis'); assert.ok(Math.abs(+yel[1] + 5 - at(40)) < 0.1);
  assert.match(t.alt, /goal for Arsenal at 12 minutes, yellow card for Southampton at 40 minutes, red card for Southampton at 77 minutes/); assert.equal((t.svg.match(/data-kind="goal"/g) || []).length, 1);
  assert.match(timeline({ ...g, events: [] }).alt, /no goals or cards listed/);
});
test('stats bars share the width in proportion; the curve, the pitch and the collage say their facts', () => {
  const s = readSummary(SUMMARY), sb = statsBars('Arsenal', 'Southampton', s.stats[0].stats.map((x, i) => ({ label: x.label, home: x.value, away: s.stats[1].stats[i].value })));
  const w = (side) => +new RegExp('width="([\\d.]+)" height="12" fill="#[0-9a-f]+" data-stat="Possession" data-side="' + side + '"').exec(sb.svg)[1]; assert.ok(Math.abs(w('home') / w('away') - 61 / 39) < 0.01); assert.match(sb.alt, /Possession 61 to 39, Shots 14 to 5/);
  const c = curve([40, 55, 70], 'Arsenal', 'Southampton'); assert.match(c.alt, /Arsenal 70 per cent now, from 40 per cent at the first reading, across 3 readings/); assert.match(c.svg, /<polyline [^>]*points="30\.0,102\.0 300\.0,84\.0 570\.0,66\.0"/); assert.match(curve([], 'a', 'b').alt, /no readings yet/);
  const start = (n) => Array.from({ length: 11 }, (_, i) => ({ n: String(i + 1), name: n + ' Player ' + (i + 1) })), l = [{ side: 'home', team: 'Arsenal', formation: '4-3-3', starters: start('A') }, { side: 'away', team: 'Southampton', formation: '4-4-2', starters: start('S') }];
  const p = pitch(g, l); assert.equal((p.svg.match(/data-player=/g) || []).length, 22); assert.match(p.alt, /Arsenal in a 4-3-3/); assert.equal(pitch(g, [{ side: 'home', team: 'x', starters: start('A') }]), null, 'no formation, no pitch drawn');
  const cl = collage(games, 'Premier League', 'Sunday 25 May'); assert.match(cl.alt, /Arsenal 2-1 Southampton; Liverpool 1-1 Crystal Palace; Chelsea v Nottingham Forest/); assert.equal((cl.svg.match(/<rect x="(?:20|300)" y="\d+" width="270"/g) || []).length, 3);
});
