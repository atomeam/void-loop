import test from 'node:test';
import assert from 'node:assert/strict';
import * as V from '../void-live-deploy/skills/void-breaker-rules.js';

test('a game from a seed is the same every time: full bricks, three lives each, two simultaneous balls served into the centre', () => {
  const a = V.create(3), b = V.create(3);
  assert.deepEqual(a, b);
  assert.equal(a.bricks.length, V.COLS * V.ROWS);
  assert.equal(V.bricksLeft(a), 32);
  assert.deepEqual(a.lives, { you: 3, void: 3 });
  assert.equal(a.balls.length, 2);
  const you = a.balls.find((x) => x.home === 'you'), v = a.balls.find((x) => x.home === 'void');
  assert.ok(you && v, 'each side has a ball');
  assert.equal(you.x, V.W / 2); assert.equal(v.x, V.W / 2);
  assert.ok(you.vy < 0, 'player ball serves upward'); assert.ok(v.vy > 0, 'Verse ball serves downward');
  assert.notDeepEqual(V.create(3).balls, V.create(4).balls);
});

test('the same seed and the same pointer give the same whole game, tick for tick', () => {
  const run = (seed) => {
    const s = V.create(seed); const out = [];
    for (let t = 0; t < 600 && !s.over; t++) {
      V.tick(s, { x: 100 + 60 * Math.sin(t / 30) });
      out.push(s.balls.map((b) => b.x.toFixed(3) + ',' + b.y.toFixed(3) + ',' + b.vy.toFixed(3)).join(';'));
    }
    return out.join('|');
  };
  assert.equal(run(9), run(9));
  assert.notEqual(run(9), run(10));
});

test('invariants on every tick of many games: both balls stay on the field, speeds stay bounded, scores are ten a brick, lives never go up', () => {
  for (let seed = 1; seed <= 12; seed++) {
    const s = V.create(seed); let lives = 6, t = 0;
    while (!s.over && t++ < 6000) {
      V.tick(s, { x: V.botX(s, 'you').x });
      for (const B of s.balls) {
        assert.ok(Number.isFinite(B.x) && Number.isFinite(B.y), 'finite');
        assert.ok(B.x >= 0 && B.x <= V.W, 'x in the field: ' + B.x);
        assert.ok(B.y > -2 * V.R && B.y < V.H + 2 * V.R, 'y near the field: ' + B.y);
        assert.ok(Math.hypot(B.vx, B.vy) <= 5.5, 'speed ' + Math.hypot(B.vx, B.vy));
      }
      assert.equal(s.score.you + s.score.void, (32 - V.bricksLeft(s)) * 10);
      const now = s.lives.you + s.lives.void; assert.ok(now <= lives); lives = now;
      assert.ok(s.p1 >= V.PW / 2 && s.p1 <= V.W - V.PW / 2 && s.p2 >= V.PW / 2 && s.p2 <= V.W - V.PW / 2);
    }
  }
});

test('breaking a brick scores ten for whoever last hit that ball, and returning the other side ball steals the points', () => {
  const s = V.create(1); s.bricks.forEach((k) => { k.alive = 0; }); s.bricks[0].alive = 1; s.bricks[1].alive = 1;
  const k = s.bricks[0];
  // a ball coming up through the brick: last touched by you (even if it was Verse\'s home ball), so you score
  s.balls = [
    { x: k.x + 15, y: k.y + V.BH + V.R + 0.5, vx: 0, vy: -2, last: 'you', home: 'void' },
    { x: Wfar(), y: V.H - 60, vx: 0, vy: -0.5, last: 'void', home: 'you' }
  ];
  function Wfar() { return V.W / 2; }
  s.balls[1].x = V.W / 2;
  V.tick(s, { x: 120 });
  assert.equal(k.alive, 0); assert.equal(s.score.you, 10); assert.equal(s.score.void, 0);
  assert.ok(s.balls[0].vy > 0, 'it bounced back down off the brick');
});

test('missing a ball costs that side a life and re-serves only that ball while the other stays in play; out of lives ends the game', () => {
  const s = V.create(2);
  const keep = { x: 120, y: 160, vx: 0.4, vy: -1.2, last: 'you', home: 'void' };
  s.balls = [ { x: 20, y: V.H + V.R - 1, vx: 0, vy: 3, last: 'void', home: 'you' }, { ...keep } ];
  s.p1 = 200;
  V.tick(s, { x: 200 });
  assert.equal(s.lives.you, 2);
  const youBall = s.balls.find((b) => b.home === 'you');
  const voidBall = s.balls.find((b) => b.home === 'void');
  assert.ok(youBall.vy < 0, 'player ball re-served upward');
  assert.ok(voidBall.y < V.H - 20, 'other ball stayed in play (not reset to serve)');

  const t = V.create(2);
  t.lives.void = 1;
  t.balls = [ { x: 120, y: 160, vx: 0, vy: 1.2, last: 'void', home: 'you' }, { x: 20, y: -V.R - 1, vx: 0, vy: -3, last: 'you', home: 'void' } ];
  t.p2 = 200;
  V.tick(t, { x: 100 });
  assert.equal(t.over, 'you');

  const done = JSON.stringify(t); V.tick(t, { x: 5 }); assert.equal(JSON.stringify(t), done, 'a finished game does not move');
});

test('where the ball lands on the paddle bends the bounce, and the paddle is never off the field', () => {
  const left = V.create(5); left.p1 = 120; left.balls = [{ x: 120 - 20, y: V.P1Y - V.R, vx: 0, vy: 2.4, last: 'void', home: 'void' }]; V.tick(left, { x: 120 });
  const right = V.create(5); right.p1 = 120; right.balls = [{ x: 120 + 20, y: V.P1Y - V.R, vx: 0, vy: 2.4, last: 'void', home: 'void' }]; V.tick(right, { x: 120 });
  assert.ok(left.balls[0].vx < 0 && right.balls[0].vx > 0 && left.balls[0].vy < 0 && right.balls[0].vy < 0, left.balls[0].vx + ' ' + right.balls[0].vx);
  const s = V.create(1); V.tick(s, { x: -500 }); assert.equal(s.p1, V.PW / 2); V.tick(s, { x: 9999 }); assert.equal(s.p1, V.W - V.PW / 2);
  V.tick(s, { x: NaN }); assert.equal(s.p1, V.W - V.PW / 2, 'a non-number leaves the paddle where it was');
});

test('games between two Verse-driven paddles always end, with a winner or a tie, and Verse is not a wall', () => {
  let ends = 0; const tally = { you: 0, void: 0, tie: 0 };
  for (let seed = 1; seed <= 30; seed++) {
    const r = V.selfPlay(seed);
    assert.ok(['you', 'void', 'tie'].includes(r.over), 'seed ' + seed + ' ' + r.over);
    tally[r.over]++; ends++;
  }
  assert.equal(ends, 30);
  assert.ok(tally.you > 0 && tally.void > 0, 'neither seat should win them all: ' + JSON.stringify(tally));
});
