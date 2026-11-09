// Plan asks (job want-misses-2026-w46): "make a plan to learn X" used to fall through the router to
// Gemma + Wikipedia and answer nothing. planAskOf catches it and hands the planner a goal; parsePlan and
// withLearnStep shape the answer the /api/answer plan path returns.
import assert from 'node:assert/strict';
import { planAskOf, parsePlan, withLearnStep, PLAN_MIN } from '../void-live-deploy/lib/plan.js';

// plan asks give a goal, cleaned and quoted-ready for the planner
const hits = [
  'make a plan to learn guitar',
  'Make a plan for my garden',
  'create a plan to run a 5k',
  'build a plan of the road trip',
  'come up with a plan about the move',
  'help me make a plan to move to Japan',
  'give me a plan to save money',
  'write a plan for the launch',
  'make me a plan to get fit',
];
for (const a of hits) assert.ok(planAskOf(a), 'goal from: ' + a);
assert.equal(planAskOf('make a plan to learn guitar'), 'learn guitar');
assert.equal(planAskOf('Make a Plan For My Garden'.toLowerCase()), 'my garden');
assert.equal(planAskOf('  make a plan to   learn  guitar  '), 'learn guitar');

// everything else stays out: no plan words, bare "plan", other skills' asks, too-short goals
const misses = ['what is a black hole', 'plan', 'make a plan', 'a plan to', 'make the chess board blue', 'set a timer for 5 minutes', 'plan my garden', 'to for about'];
for (const a of misses) assert.equal(planAskOf(a), null, 'not a plan ask: ' + a);

// the answer path's gates: the model's steps parse, and a learn goal gains the teacher step
const steps = parsePlan('["Pick the guitar model","Practise 20 minutes a day","Learn 50 words"]');
assert.ok(steps && steps.length >= PLAN_MIN, 'steps parse from a JSON array');
const bulleted = parsePlan('- Pick a course\n- Practise daily\n- Learn 50 words');
assert.ok(bulleted && bulleted.length >= PLAN_MIN, 'steps parse from a list');
const grown = withLearnStep(steps, { yes: true });
assert.equal(grown[0], 'Find a teacher or a course', 'a learn goal gains the teacher step');
assert.equal(withLearnStep(bulleted, { yes: true })[0], 'Pick a course', 'a plan with a teacher step stays as it is');
assert.equal(withLearnStep(steps, null).length, steps.length, 'no learn verdict, no extra step');

console.log('plan-ask: ok');
