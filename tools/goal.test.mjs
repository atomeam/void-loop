// Frontier #18, goals you meet by changing the miniature: skills/goal-rules.js (pure) and the goal card's routing
// (skills/goal.js). Every goal has a required test named goal/<source>/<goal>-reachable-within-controls: some setting
// inside the goal's declared control ranges meets it, through the source's own observations alone.
// Run: node --test tools/goal.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Goal from '../void-live-deploy/skills/goal-rules.js';
import * as G from '../void-live-deploy/skills/gear-pair-rules.js';
import goal, { goalAskOf } from '../void-live-deploy/skills/goal.js';

// each source kind's observations for a setting of its controls: the source's own rules, nothing goal-specific
const OBSERVE = { gears: (p) => G.observations(G.create(p)) };

for (const [kind, goals] of Object.entries(Goal.GOALS)) {
  for (const g of goals) {
    test('goal/' + kind + '/' + g.id + '-reachable-within-controls', () => {
      assert.ok(OBSERVE[kind], 'a way to observe ' + kind + ' for the test');
      const s = Goal.reachable(g, OBSERVE[kind]);
      assert.ok(s, g.text + ': no setting inside the controls meets it');
      assert.equal(Goal.check(g, OBSERVE[kind](s)).status, 'met');
    });
  }
}

test('the gear half-speed goal: 24 driving 12 is twice as fast (not yet), 12 driving 24 meets it, and the feedback says which way to go', () => {
  const g = Goal.goalOf('gears', 'half-speed');
  const fast = Goal.check(g, G.observations(G.create({ driverTeeth: 24, drivenTeeth: 12 })));
  assert.equal(fast.status, 'not-yet'); assert.match(fast.rows[0].say, /is 2, the goal is 0\.5 \(±0\.01\) · too high/);
  const same = Goal.check(g, G.observations(G.create({ driverTeeth: 20, drivenTeeth: 20 })));
  assert.match(same.rows[0].say, /too high/);
  const met = Goal.check(g, G.observations(G.create({ driverTeeth: 12, drivenTeeth: 24 })));
  assert.equal(met.status, 'met'); assert.match(met.rows[0].say, /0\.5 ✓/);
  assert.equal(Goal.check(g, G.observations(G.create({ driverTeeth: 20, drivenTeeth: 41 }))).status, 'not-yet', '0.4878 is outside ±0.01');
});

test('a goal reads only the observations document: a missing field or another schema is invalid, never a guess', () => {
  const g = Goal.goalOf('gears', 'half-speed');
  assert.equal(Goal.check(g, { schema: 'other', items: [] }).status, 'invalid');
  assert.equal(Goal.check(g, null).status, 'invalid');
  const r = Goal.check(g, { schema: Goal.SCHEMA, items: [{ id: 'driverTeeth', value: 12 }] });
  assert.equal(r.status, 'invalid'); assert.match(r.errors[0], /drivenTurnsPerDriverTurn/);
  assert.equal(Goal.reachable({ conditions: [{ id: 'x', cmp: 'eq', target: 1, tolerance: 0 }], controls: { a: { min: 0, max: 2 } } }, (s) => ({ schema: Goal.SCHEMA, items: [{ id: 'x', value: s.a * 3 }] })), null, 'an unreachable goal is caught');
  assert.equal([...Goal.settings({ a: { min: 1, max: 3 }, b: { min: 0, max: 1 } })].length, 6);
});

test('routing: "give me a challenge with this" and its kin open the goal card; a bare challenge, five minutes and quizzes stay out', () => {
  for (const t of goal.examples) assert.ok(goalAskOf(t), t);
  for (const t of goal.nearMisses) assert.equal(goalAskOf(t), null, t);
});

test('the goal set is the first one the source does not already meet: the default 16 driving 32 is already half speed, so it gets twice as fast', () => {
  assert.equal(Goal.nextGoal('gears', G.observations(G.create({ driverTeeth: 16, drivenTeeth: 32 }))).id, 'twice-as-fast');
  assert.equal(Goal.nextGoal('gears', G.observations(G.create({ driverTeeth: 17, drivenTeeth: 32 }))).id, 'half-speed');
  assert.equal(Goal.nextGoal('moon', { schema: Goal.SCHEMA, items: [] }), null, 'no goals for a kind without any');
});
