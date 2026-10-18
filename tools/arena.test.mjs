// Frontier #5, the first piece: Verse plays Connect Four against itself (lib/arena.js), the stronger version is kept, and the
// ratings come out of the games, not a claim. Run: node --test tools/arena.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as K from '../void-live-deploy/skills/connect4-rules.js';
import { playGame, match, perf, ladder, tune } from '../void-live-deploy/lib/arena.js';

test('arena: the engine takes its weights as an argument, and the default weights play exactly as before', () => {
  let s = K.create(); for (const c of [3, 3, 2, 4]) s = K.drop(s, c);
  assert.deepEqual(K.voidMove(s, 4), K.voidMove(s, 4, K.WEIGHTS));
  assert.equal(typeof K.WEIGHTS.three, 'number');
  // weights that ignore the board still take a win and block a four (those come before the look-ahead)
  const flat = Object.fromEntries(Object.keys(K.WEIGHTS).map((k) => [k, 0]));
  let w = K.create(); for (const c of [0, 6, 0, 6, 1, 6]) w = K.drop(w, c);
  assert.equal(K.voidMove(w, 2, flat).col, 6);
});

test('arena: one game between two players, either colour, ends in a result; the same seed gives the same game', () => {
  const a = { name: 'd2', depth: 2 }, b = { name: 'd1', depth: 1 };
  const g1 = playGame(a, b, 7), g2 = playGame(a, b, 7);
  assert.ok(['a', 'b', 'draw'].includes(g1.result)); assert.deepEqual(g1, g2);
  assert.ok(g1.moves.length >= 7 && g1.moves.length <= 42);
});

test('arena: a performance rating from a score: even is the opponent, more wins is higher, a clean sweep is capped', () => {
  assert.equal(perf(1000, 0.5), 1000);
  assert.ok(perf(1000, 0.75) > 1150 && perf(1000, 0.75) < 1220);
  assert.equal(perf(1000, 1), 1400); assert.equal(perf(1000, 0), 600);
});

test('arena: looking further ahead wins: depth 3 beats depth 1 over 40 games (it won 28 of 40), colours swapped each game', () => {
  const m = match({ name: 'd3', depth: 3 }, { name: 'd1', depth: 1 }, 40, 1);
  assert.equal(m.games, 40); assert.equal(m.a + m.b + m.draw, 40);
  assert.ok(m.score >= 0.65, 'depth 3 should win most: ' + JSON.stringify(m));
});

test('arena: the ladder rates each depth against the one below it, anchored at depth 1 = 1000, and rises', () => {
  const L = ladder([1, 2, 3], 20, 1);
  assert.deepEqual(L.map((r) => r.name), ['depth 1', 'depth 2', 'depth 3']);
  assert.equal(L[0].rating, 1000);
  assert.ok(L[2].rating > L[0].rating, JSON.stringify(L));
});

test('arena: tuning keeps a challenger only when it beats the champion; the champion it returns is never worse than it started', () => {
  const t = tune({ depth: 2, rounds: 3, games: 20, seed: 3 });
  assert.equal(t.rounds.length, 3);
  for (const r of t.rounds) assert.equal(r.kept, r.score > 0.55);
  assert.ok(t.champion.weights && typeof t.champion.weights.three === 'number');
  assert.ok(t.final.games >= 20);
});

// run 61: "how good are you at connect four" answers from arena.json, the games' own record, with the curve
import { connect4Of } from '../void-live-deploy/skills/connect4.js';
import { readFileSync } from 'node:fs';
import { arenaSay, arenaCurve } from '../void-live-deploy/lib/arena.js';
test('arena: the ask is told apart from a game, and the answer is the record: the strongest depth, its rating, the games behind it', () => {
  for (const q of ['how good are you at connect four', 'how good are you at connect 4?', 'what is your connect four rating', 'are you good at four in a row', 'how strong is void at connect four']) assert.deepEqual(connect4Of(q), { kind: 'rating' }, q);
  for (const q of ['play connect 4', 'connect four']) assert.deepEqual(connect4Of(q), { kind: 'game' }, q);
  for (const q of ['how good are you at chess', 'connect four rules', 'who invented connect four']) assert.equal(connect4Of(q), null, q);
  const a = JSON.parse(readFileSync(new URL('../void-live-deploy/arena.json', import.meta.url)));
  const say = arenaSay(a), top = a.ladder[a.ladder.length - 1];
  assert.ok(say.includes(String(top.rating)) && say.includes(String(a.games)) && /depth 1 = 1000/.test(say), say);
  const svg = arenaCurve(a);
  assert.match(svg, /^<svg[^>]*role="img"/); assert.equal((svg.match(/<circle/g) || []).length, a.ladder.length);
  assert.match(arenaSay(null), /not played/);
  // a record that is not ours cannot add markup: names are escaped, ratings and depths are numbers
  const evil = arenaCurve({ ladder: [{ name: '<img src=x onerror=alert(1)>', rating: 1000, depth: 1 }, { name: 'b" onload="x', rating: '1200<script>', depth: '2' }] });
  assert.ok(!/<img|<script|" onload/.test(evil), evil); assert.equal((evil.match(/<circle/g) || []).length, 1);
});

// run 62: the second game. Othello's engine has no look-ahead depth, so its ladder is three players: random moves, the
// greedy one (most discs flipped), and the card's own engine (the position table and the reply it leaves); random = 1000.
import { playWith, othelloGame, othelloPlayers, ladderOf } from '../void-live-deploy/lib/arena.js';
import { othelloOf } from '../void-live-deploy/skills/othello.js';
test('arena: Othello through the same arena: games end, the same seed gives the same game, and the card beats random', () => {
  const P = othelloPlayers();
  assert.deepEqual(P.map((p) => p.name), ['random', 'greedy', 'the card']);
  const g1 = playWith(othelloGame, P[2], P[0], 4), g2 = playWith(othelloGame, P[2], P[0], 4);
  assert.deepEqual(g1, g2); assert.ok(['a', 'b', 'draw'].includes(g1.result)); assert.ok(g1.moves.length > 8 && g1.moves.length <= 64);
  const m = match(P[2], P[0], 20, 1, othelloGame);
  assert.ok(m.score >= 0.7, 'the card should beat random: ' + JSON.stringify(m));
  const L = ladderOf(othelloGame, P, 10, 1);
  assert.equal(L[0].rating, 1000); assert.equal(L[0].name, 'random'); assert.ok(L[2].rating > L[0].rating, JSON.stringify(L));
});
test('arena: "how good are you at othello" is its own ask, and the answer names the players, not a depth', () => {
  for (const q of ['how good are you at othello', 'how good are you at reversi?', 'what is your othello rating', 'are you good at othello']) assert.deepEqual(othelloOf(q), { kind: 'rating' }, q);
  assert.deepEqual(othelloOf('play othello'), { kind: 'game' });
  assert.equal(othelloOf('othello rules'), null);
  const rec = { game: 'othello', games: 60, anchor: 'random = 1000', ladder: [{ name: 'random', rating: 1000 }, { name: 'greedy', rating: 1150 }, { name: 'the card', rating: 1400 }] };
  const say = arenaSay(rec);
  assert.ok(/Othello/.test(say) && /the card plays at 1400/.test(say) && /400 above random/.test(say) && !/moves ahead/.test(say), say);
  assert.equal((arenaCurve(rec).match(/<circle/g) || []).length, 3);
});

// run 71: the learning half. Each day's run starts from the best evaluation self-play has found so far (arena.json's
// champion), tries challengers seeded by the date, keeps one only when it beats the champion clearly, and records how the
// champion does against the card's own weights. Same date, same result; the champion never gets worse than it was.
import { learn } from './arena.mjs';
import { WEIGHTS } from '../void-live-deploy/skills/connect4-rules.js';
test('arena: tuning can start from a given evaluation, not only the card\'s', () => {
  const start = { ...WEIGHTS, three: 9 };
  assert.deepEqual(tune({ depth: 2, rounds: 0, games: 10, seed: 5, start }).champion.weights, start, 'no rounds: the start is the champion');
});
test('arena: one day of learning is reproducible, keeps the champion unless beaten, and is rated against the card', () => {
  const a = learn(null, '2026-10-11', { rounds: 2, games: 12 }), b = learn(null, '2026-10-11', { rounds: 2, games: 12 });
  assert.deepEqual(a, b, 'same date, same result');
  assert.ok(a.weights && Number.isFinite(a.vsCard) && a.vsCard >= 0 && a.vsCard <= 1 && a.since && Array.isArray(a.tried));
  for (const t of a.tried) assert.equal(typeof t.kept, 'boolean');
  if (!a.tried.some((t) => t.kept)) assert.deepEqual(a.weights, { ...WEIGHTS }, 'nothing kept: still the card\'s weights');
  assert.deepEqual(learn(a, '2026-10-11', { rounds: 2, games: 12 }), a, 'a rerun the same day changes nothing');
  if (!a.tried.some((t) => t.kept)) assert.equal(a.vsCard, 0.5, 'the card against itself is even');
  const next = learn(a, '2026-10-12', { rounds: 0, games: 12 });
  assert.deepEqual(next.weights, a.weights, 'no challenger: yesterday\'s champion carries over'); assert.equal(next.since, a.since);
  assert.ok(next.days >= 2);
});
test('arena: the answer names the self-play champion when it beats the card\'s own evaluation', () => {
  const rec = JSON.parse(readFileSync(new URL('../void-live-deploy/arena.json', import.meta.url)));
  const say = arenaSay({ ...rec, champion: { weights: { ...WEIGHTS }, vsCard: 0.62, since: '2026-10-11', days: 3, tried: [] } });
  assert.match(say, /self-play.*62%.*since 2026-10-11/i);
  assert.doesNotMatch(arenaSay({ ...rec, champion: { weights: {}, vsCard: 0.5, since: '2026-10-11', days: 1, tried: [] } }), /62%/);
});

import { pushHistory, arenaDelta, arenaTrend } from '../void-live-deploy/lib/arena-say.js';
test('arena: day over day (the owner, 2026-10-11): one line a day, a rerun the same day replaces it, the last 60 kept', () => {
  let h = pushHistory(undefined, { date: '2026-10-10', rating: 1547, vsCard: 0.5 });
  h = pushHistory(h, { date: '2026-10-11', rating: 1609, vsCard: 0.5 });
  h = pushHistory(h, { date: '2026-10-11', rating: 1609, vsCard: 0.46 });
  assert.deepEqual(h, [{ date: '2026-10-10', rating: 1547, vsCard: 0.5 }, { date: '2026-10-11', rating: 1609, vsCard: 0.46 }]);
  let long = [];
  for (let d = 1; d <= 70; d++) long = pushHistory(long, { date: '2026-08-' + String(d).padStart(2, '0'), rating: 1000 + d, vsCard: null });
  assert.equal(long.length, 60); assert.equal(long[0].rating, 1011);
  assert.deepEqual(pushHistory(h, { date: 'yesterday', rating: 'x' }), h, 'a malformed day is not written');
});

test('arena: the change since the last day that differed, and an unchanged day says so instead of inventing one', () => {
  assert.equal(arenaDelta([]), '');
  assert.equal(arenaDelta([{ date: '2026-10-11', rating: 1609 }]), 'first day on record (Oct 11)');
  assert.equal(arenaDelta([{ date: '2026-10-10', rating: 1547 }, { date: '2026-10-11', rating: 1609 }]), '+62 since Oct 10');
  assert.equal(arenaDelta([{ date: '2026-10-10', rating: 1547 }, { date: '2026-10-11', rating: 1609 }, { date: '2026-10-12', rating: 1609 }]), '+62 since Oct 10');
  assert.equal(arenaDelta([{ date: '2026-10-11', rating: 1609 }, { date: '2026-10-12', rating: 1580 }]), '−29 since Oct 11');
  assert.equal(arenaDelta([{ date: '2026-10-10', rating: 1609 }, { date: '2026-10-12', rating: 1609 }]), 'no change since Oct 10');
});

test('arena: a small line of the days, labelled, only once there are two', () => {
  assert.equal(arenaTrend([{ date: '2026-10-11', rating: 1609 }]), '');
  const s = arenaTrend([{ date: '2026-10-10', rating: 1547 }, { date: '2026-10-11', rating: 1609 }]);
  assert.match(s, /^<svg [^>]*role="img"[^>]*aria-label="Rating by day: Oct 10 1547, Oct 11 1609"/);
  assert.equal((s.match(/<circle /g) || []).length, 2);
  assert.doesNotMatch(arenaTrend([{ date: '<b>', rating: 1 }, { date: '2026-10-11', rating: 2 }]), /<b>/, 'a date that is not a date never reaches the markup');
});
