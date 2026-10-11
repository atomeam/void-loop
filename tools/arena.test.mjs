// Frontier #5, the first piece: Void plays Connect Four against itself (lib/arena.js), the stronger version is kept, and the
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
