// Gap Glide, Cross the Bus, Debris Field and Null Waves: pure rules, Verse is seat 2, a round is a seed.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../void-live-deploy/skills/gap-glide-rules.js';
import * as B from '../void-live-deploy/skills/cross-bus-rules.js';
import { asked, daySeed, roundLink } from '../void-live-deploy/lib/studio-play.js';
import { TITLES, GAMES } from '../void-live-deploy/lib/ladder.js';

test('the same seed is the same opening, and a round link carries the seed and the score', () => {
  assert.deepEqual(G.create(4).pipes.map((p) => p.c), G.create(4).pipes.map((p) => p.c));
  assert.deepEqual(B.create(4).lanes[1].cells, B.create(4).lanes[1].cells);
  assert.equal(roundLink('gap-glide', 4, 3), '/arcade/?play=gap-glide&seed=4&score=3');
  assert.equal(roundLink('cross-bus', 9, 0, true), '/arcade/?play=cross-bus&seed=9&score=0&daily=1');
  assert.equal(daySeed(new Date('2026-11-13T23:00:00Z')), 20261113);
});

test('asks open the new games and leave the famous names alone', () => {
  assert.equal(asked('gap glide', ['gap glide']), true);
  assert.equal(asked("let's play cross the bus", ['cross the bus']), true);
  assert.equal(asked('play flappy bird', ['gap glide']), false);
  assert.equal(asked('play frogger', ['cross the bus']), false);
  for (const id of ['gap-glide', 'cross-bus']) {
    assert.ok(GAMES.includes(id), id);
    assert.doesNotMatch(TITLES[id], /void/i, id);
  }
});

test('Gap Glide: a careful glider lasts longer than Verse, and the game ends', () => {
  let you = 0;
  for (let seed = 1; seed <= 12; seed++) if (G.selfPlay(seed).over === 'you') you++;
  assert.ok(you >= 8, 'careful glider won ' + you + ' of 12');
  const one = G.selfPlay(2);
  assert.ok(one.over === 'you' || one.over === 'void' || one.over === 'draw');
  assert.ok(one.tick > 10);
});

test('Cross the Bus: both riders finish a round, and the far curb is reachable', () => {
  const done = B.selfPlay(3);
  assert.ok(done.over, 'a round ends');
  let reached = false;
  for (let seed = 1; seed <= 20 && !reached; seed++) {
    const s = B.create(seed);
    for (let i = 0; i < 700 && !s.over; i++) B.tick(s, { auto: true });
    if (s.you.r === 0 || s.verse.r === 0) reached = true;
  }
  assert.equal(reached, true);
});
