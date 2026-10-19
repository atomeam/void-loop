import test from 'node:test';
import assert from 'node:assert/strict';
import * as V from '../void-live-deploy/skills/void-breaker-rules.js';

test('a game from a seed is the same every time: a full band of bricks, three lives each, a ball in the middle', () => {
  const a = V.create(3), b = V.create(3);
  assert.deepEqual(a, b); assert.equal(a.bricks.length, V.COLS * V.ROWS); assert.equal(V.bricksLeft(a), 32);
  assert.deepEqual(a.lives, { you: 3, void: 3 }); assert.equal(a.ball.x, V.W / 2);
  assert.notDeepEqual(V.create(3).ball, V.create(4).ball);
});

test('the same seed and the same pointer give the same whole game, tick for tick', () => {
  const run = (seed) => { const s = V.create(seed); const out = []; for (let t = 0; t < 600 && !s.over; t++) { V.tick(s, { x: 100 + 60 * Math.sin(t / 30) }); out.push(s.ball.x.toFixed(3) + ',' + s.ball.y.toFixed(3)); } return out.join('|'); };
  assert.equal(run(9), run(9)); assert.notEqual(run(9), run(10));
});

test('invariants on every tick of many games: the ball stays on the field, the speed stays bounded, the scores are ten a brick, lives never go up', () => {
  for (let seed = 1; seed <= 12; seed++) {
    const s = V.create(seed); let lives = 6, t = 0;
    while (!s.over && t++ < 6000) {
      V.tick(s, { x: V.botX(s, 'you').x });
      assert.ok(Number.isFinite(s.ball.x) && Number.isFinite(s.ball.y), 'finite');
      assert.ok(s.ball.x >= 0 && s.ball.x <= V.W, 'x in the field: ' + s.ball.x);
      assert.ok(s.ball.y > -2 * V.R && s.ball.y < V.H + 2 * V.R, 'y near the field: ' + s.ball.y);
      assert.ok(Math.hypot(s.ball.vx, s.ball.vy) <= 5.5, 'speed ' + Math.hypot(s.ball.vx, s.ball.vy));
      assert.equal(s.score.you + s.score.void, (32 - V.bricksLeft(s)) * 10);
      const now = s.lives.you + s.lives.void; assert.ok(now <= lives); lives = now;
      assert.ok(s.p1 >= V.PW / 2 && s.p1 <= V.W - V.PW / 2 && s.p2 >= V.PW / 2 && s.p2 <= V.W - V.PW / 2);
    }
  }
});

test('breaking a brick scores ten for whoever touched the ball last, and the ball bounces off it', () => {
  const s = V.create(1); s.bricks.forEach((k) => { k.alive = 0; }); s.bricks[0].alive = 1; s.bricks[1].alive = 1;
  const k = s.bricks[0]; s.ball = { x: k.x + 15, y: k.y + V.BH + V.R + 0.5, vx: 0, vy: -2 }; s.last = 'void';
  V.tick(s, { x: 120 }); V.tick(s, { x: 120 });
  assert.equal(k.alive, 0); assert.equal(s.score.void, 10); assert.equal(s.score.you, 0); assert.ok(s.ball.vy > 0, 'it bounced back down');
});

test('missing the ball costs a life and serves it to the one who lost it; out of lives ends the game', () => {
  const s = V.create(2); s.ball = { x: 20, y: V.H + V.R - 1, vx: 0, vy: 3 }; s.p1 = 200;
  V.tick(s, { x: 200 }); assert.equal(s.lives.you, 2); assert.ok(s.ball.vy > 0, 'served toward you again'); assert.equal(s.over, null);
  s.lives.you = 1; s.ball = { x: 20, y: V.H + V.R - 1, vx: 0, vy: 3 }; V.tick(s, { x: 200 }); assert.equal(s.over, 'void');
  const t = V.create(2); t.lives.void = 1; t.ball = { x: 20, y: -2, vx: 0, vy: -3 }; t.p2 = 200; V.tick(t, { x: 100 }); assert.equal(t.over, 'you');
  const done = JSON.stringify(t); V.tick(t, { x: 5 }); assert.equal(JSON.stringify(t), done, 'a finished game does not move');
});

test('where the ball lands on the paddle bends the bounce, and the paddle is never off the field', () => {
  const left = V.create(5); left.p1 = 120; left.ball = { x: 120 - 20, y: V.P1Y - V.R, vx: 0, vy: 2.4 }; V.tick(left, { x: 120 });
  const right = V.create(5); right.p1 = 120; right.ball = { x: 120 + 20, y: V.P1Y - V.R, vx: 0, vy: 2.4 }; V.tick(right, { x: 120 });
  assert.ok(left.ball.vx < 0 && right.ball.vx > 0 && left.ball.vy < 0 && right.ball.vy < 0, left.ball.vx + ' ' + right.ball.vx);
  const s = V.create(1); V.tick(s, { x: -500 }); assert.equal(s.p1, V.PW / 2); V.tick(s, { x: 9999 }); assert.equal(s.p1, V.W - V.PW / 2);
  V.tick(s, { x: NaN }); assert.equal(s.p1, V.W - V.PW / 2, 'a non-number leaves the paddle where it was');
});

test('games between two Verse-driven paddles always end, with a winner or a draw, and Verse is not a wall', () => {
  let ends = 0; const tally = { you: 0, void: 0, draw: 0 };
  for (let seed = 1; seed <= 30; seed++) { const r = V.selfPlay(seed); assert.ok(['you', 'void', 'draw'].includes(r.over), 'seed ' + seed + ' ' + r.over); tally[r.over]++; ends++; }
  assert.equal(ends, 30);
  assert.ok(tally.you > 0 && tally.void > 0, 'neither seat should win them all: ' + JSON.stringify(tally));
});
