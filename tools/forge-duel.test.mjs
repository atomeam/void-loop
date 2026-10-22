import test from 'node:test';
import assert from 'node:assert/strict';
import * as F from '../void-live-deploy/lib/forge-duel.js';
import skill from '../void-live-deploy/skills/rally.js';

test('forging is deterministic and reads the text', () => {
  assert.deepEqual(F.forge('What if the moon could sing?'), F.forge('What if the moon could sing?'));
  assert.equal(F.forge('What if the moon could sing?').type, 'Idea');
  assert.equal(F.forge('I love you and miss you').type, 'Feeling');
  assert.equal(F.forge('Build a tiny boat').type, 'Action');
});
test('a saved duel resumes on the same turn and plays to the end (the reload bug)', () => {
  let s = F.newState([F.forge('Water boils at 100 degrees.')], 42);
  for (let t = 0; t < 3; t++) { const L = F.leader(s.turn); for (const side of [L, F.foe(L)]) F.applyPlan(s, side, F.randomPlan(s, side, F.rngOf(t + 1), 0.9)); F.endTurn(s); }
  const back = JSON.parse(JSON.stringify(s)); assert.equal(back.turn, 4); assert.equal(back.turn, s.turn);
  while (!back.over) { const L = F.leader(back.turn); for (const side of [L, F.foe(L)]) F.applyPlan(back, side, F.randomPlan(back, side, F.rngOf(back.turn), 0.9)); F.endTurn(back); }
  assert.ok(['p', 'v', 'd'].includes(F.result(back).w));
});
test('Verse plans with practice games inside its time budget', () => {
  const s = F.newState([], 7), t = F.think(s, 'v', { ms: 40 });
  assert.ok(t.sims > 0); assert.ok(t.win >= 0 && t.win <= 1); assert.equal(t.lane.length, 3);
});
test('every phrase of both games opens', () => {
  for (const a of ['forge duel', 'three lane duel', 'forge a card', 'make a card from this text', 'forge a card: hello world', 'card game help', 'my card game record', 'play my cards', 'card battle', 'my cards', 'saved cards', 'verse rally', 'rally tutorial', 'daily card challenge'])
    assert.ok(skill.match(a.toLowerCase(), a), a);
  assert.equal(skill.rallyOf('forge a card: What if the moon could sing?'), 'forge');
});
