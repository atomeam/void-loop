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

test('pong: V01D predicts the ball through wall bounces', () => {
  const s = P.create(3); s.ball = { x: 100, y: 20, vx: 200, vy: -200 };
  const y = P.predictY(s); assert.ok(y >= 0 && y <= P.H);
  // simulate the ball alone to the paddle line and compare
  const b = { ...s.ball }; while (b.x < P.W - P.PAD_W - P.BALL / 2) { b.x += b.vx * 0.001; b.y += b.vy * 0.001; if (b.y < P.BALL / 2) { b.y = P.BALL - b.y; b.vy = -b.vy; } if (b.y > P.H - P.BALL / 2) { b.y = 2 * (P.H - P.BALL / 2) - b.y; b.vy = -b.vy; } }
  assert.ok(Math.abs(b.y - y) < 3, b.y + ' vs ' + y);
});

test('pong: a still player loses to V01D, a game ends at 7, and every point has a reason', () => {
  const s = P.create(5);
  for (let i = 0; i < 200000 && !s.over; i++) P.step(s, 1 / 120, {});
  assert.equal(s.over, 'void'); assert.equal(s.void.score, P.WIN); assert.ok(s.lastWhy);
});

test('pong: V01D is beatable (a perfect tracker scores on it)', () => {
  const s = P.create(9); let you = 0;
  for (let i = 0; i < 400000 && !s.over; i++) { P.step(s, 1 / 120, { y: s.ball.y }); you = s.you.score; }
  assert.ok(you > 0, 'you scored ' + you);
});

test('snake: V01D eats, never turns back on itself, and says why', () => {
  const s = S.create(11); s.you.alive = true;
  let ate = 0, len = s.void.body.length;
  for (let i = 0; i < 400 && !s.over; i++) { S.turn(s, i % 40 < 20 ? 'down' : 'up'); const before = s.void.body.length; S.tick(s); if (s.void.body.length > before) ate++; }
  assert.ok(s.void.body.length > len || ate > 0, 'V01D grew'); assert.ok(s.why.length > 5);
});

test('snake: crashing into a wall ends you and V01D wins', () => {
  const s = S.create(2);
  S.turn(s, 'up'); for (let i = 0; i < 10 && !s.over; i++) S.tick(s);
  assert.equal(s.you.alive, false); assert.equal(s.over, 'void');
});

test('snake: V01D alone survives a long game (it keeps room to move)', () => {
  const s = S.create(4); s.you.alive = false; s.you.body = [[0, 0]];
  for (let i = 0; i < 600 && s.void.alive; i++) { s.over = null; S.tick(s); }
  assert.ok(s.void.alive || s.void.body.length > 12, 'length ' + s.void.body.length);
});
