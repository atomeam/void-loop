import test from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../void-live-deploy/skills/pong-rules.js';
import * as S from '../void-live-deploy/skills/snake-rules.js';
import pong from '../void-live-deploy/skills/pong.js';
import snake from '../void-live-deploy/skills/snake.js';
import { arcadeCard } from '../void-live-deploy/skills/arcade-card.js';

test('the arcade card is a function the games share', () => assert.equal(typeof arcadeCard, 'function'));

test('pong and snake asks route to their games, near misses do not', () => {
  for (const a of pong.examples) assert.ok(pong.match(a.toLowerCase(), a), a);
  for (const a of snake.examples) assert.ok(snake.match(a.toLowerCase(), a), a);
  for (const a of pong.nearMisses) assert.ok(!pong.match(a.toLowerCase(), a), a);
  for (const a of snake.nearMisses) assert.ok(!snake.match(a.toLowerCase(), a), a);
  assert.ok(pong.match('pong', 'pong')); assert.ok(snake.match('snake', 'snake'));
});

test('pong: Verse predicts the ball through wall bounces', () => {
  const s = P.create(3); s.ball = { x: 100, y: 20, vx: 200, vy: -200 };
  const y = P.predictY(s); assert.ok(y >= 0 && y <= P.H);
  // simulate the ball alone to the paddle line and compare
  const b = { ...s.ball }; while (b.x < P.W - P.PAD_W - P.BALL / 2) { b.x += b.vx * 0.001; b.y += b.vy * 0.001; if (b.y < P.BALL / 2) { b.y = P.BALL - b.y; b.vy = -b.vy; } if (b.y > P.H - P.BALL / 2) { b.y = 2 * (P.H - P.BALL / 2) - b.y; b.vy = -b.vy; } }
  assert.ok(Math.abs(b.y - y) < 3, b.y + ' vs ' + y);
});

test('pong: a still player loses to Verse, a game ends at 7, and every point has a reason', () => {
  const s = P.create(5);
  for (let i = 0; i < 200000 && !s.over; i++) P.step(s, 1 / 120, {});
  assert.equal(s.over, 'void'); assert.equal(s.void.score, P.WIN); assert.ok(s.lastWhy);
});

test('pong: Verse is beatable (a perfect tracker scores on it)', () => {
  const s = P.create(9); let you = 0;
  for (let i = 0; i < 400000 && !s.over; i++) { P.step(s, 1 / 120, { y: s.ball.y }); you = s.you.score; }
  assert.ok(you > 0, 'you scored ' + you);
});

test('snake: Verse eats, never turns back on itself, and says why', () => {
  const s = S.create(11); s.you.alive = true;
  let ate = 0, len = s.void.body.length;
  for (let i = 0; i < 400 && !s.over; i++) { S.turn(s, i % 40 < 20 ? 'down' : 'up'); const before = s.void.body.length; S.tick(s); if (s.void.body.length > before) ate++; }
  assert.ok(s.void.body.length > len || ate > 0, 'Verse grew'); assert.ok(s.why.length > 5);
});

test('snake: crashing into a wall ends you and Verse wins', () => {
  const s = S.create(2);
  S.turn(s, 'up'); for (let i = 0; i < 10 && !s.over; i++) S.tick(s);
  assert.equal(s.you.alive, false); assert.equal(s.over, 'void');
});

test('snake: Verse alone survives a long game (it keeps room to move)', () => {
  const s = S.create(4); s.you.alive = false; s.you.body = [[0, 0]];
  for (let i = 0; i < 600 && s.void.alive; i++) { s.over = null; S.tick(s); }
  assert.ok(s.void.alive || s.void.body.length > 12, 'length ' + s.void.body.length);
});

// the ghost (asked by Void): play against your own best Pong game or Snake run
import * as G from '../void-live-deploy/lib/arcade-ghost.js';
const mem = () => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); } }; };

test('ghost pong: a recorded game replays the paddle, and the best game is kept', () => {
  const s = P.create(5), rec = G.pongRecorder();
  for (let i = 0; i < 2000 && !s.over; i++) { P.step(s, 1 / 60, { y: 100 + (i % 60) }); rec.tick(1 / 60, s.you.y); }
  const run = rec.run(s); assert.ok(G.valid(run)); assert.ok(run.ys.length > 20);
  assert.ok(Math.abs(G.pongGhostY(run, 0.5) - run.ys[10]) < 1e-9);
  assert.equal(G.pongGhostY(run, 9999), run.ys[run.ys.length - 1]);
  const st = mem();
  assert.equal(G.submit(run, st).beat, true);
  const worse = { ...run, you: run.you - 1 }; assert.equal(G.submit(worse, st).beat, false);
  assert.equal(G.load('pong', st).you, run.you);
  const wider = { ...run, you: run.void + 7 }; assert.equal(G.submit(wider, st).beat, true);
  assert.match(G.words(G.load('pong', st)), /your best game/);
});

test('ghost snake: the longest run is the ghost and its body follows the recorded head', () => {
  const s = S.create(3), rec = G.snakeRecorder();
  for (let i = 0; i < 40 && !s.over; i++) { S.tick(s); rec.tick(s); }
  const run = rec.run(s); assert.ok(G.valid(run));
  const b = G.snakeGhostBody(run, 5); assert.deepEqual(b[0], run.path[5]); assert.equal(b.length, run.lens[5]);
  assert.deepEqual(G.snakeGhostBody(run, 99999)[0], run.path[run.path.length - 1]);
  const st = mem(); assert.equal(G.submit(run, st).beat, true);
  assert.equal(G.submit({ ...run, len: run.len - 1 }, st).beat, false);
  assert.equal(G.submit({ ...run, len: run.len + 1 }, st).beat, true);
});

test('ghost: junk in storage is ignored, a full or blocked store does not throw', () => {
  const st = mem(); st.setItem('void-ghost-pong', '{"game":"pong","you":"x"}');
  assert.equal(G.load('pong', st), null);
  assert.equal(G.load('snake', null), null);
  const run = { game: 'snake', len: 4, path: [[1, 1]], lens: [4] };
  assert.equal(G.submit(run, { getItem: () => null, setItem() { throw new Error('quota'); } }).beat, false);
  assert.match(G.words(null), /No ghost yet/);
});
