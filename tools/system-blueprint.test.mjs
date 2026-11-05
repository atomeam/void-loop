/** system-blueprint pure helpers */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ideaOf, shapeOf, blueprintOf } from '../void-live-deploy/skills/system-blueprint.js';

test('ideaOf reads common leads', () => {
  assert.equal(ideaOf('blueprint this: late invoice follow-ups'), 'late invoice follow-ups');
  assert.equal(ideaOf('turn this into a system: new lead intake'), 'new lead intake');
  assert.equal(ideaOf('idea to system: sync CRM to sheet'), 'sync CRM to sheet');
  assert.equal(ideaOf('system blueprint for weekly ops metrics without copy-paste'), 'weekly ops metrics without copy-paste');
  assert.equal(ideaOf('system plan for: automate client onboarding'), 'automate client onboarding');
  assert.equal(ideaOf('sketch the system for: automate invoices'), 'automate invoices');
  assert.equal(ideaOf('what is a blueprint'), null);
  assert.equal(ideaOf('blueprint of the human body'), null);
  assert.equal(ideaOf('short'), null);
});

test('shapeOf picks follow-up and sync', () => {
  assert.equal(shapeOf('late invoice follow-ups for clients'), 'follow-up');
  assert.equal(shapeOf('sync closed deals from CRM to the finance sheet'), 'sync');
  assert.equal(shapeOf('something vague about growth'), 'generic');
});

test('blueprintOf returns structured plan', () => {
  const bp = blueprintOf('overdue invoice follow-ups');
  assert.equal(bp.shape, 'follow-up');
  assert.ok(bp.outcome.length > 10);
  assert.ok(bp.steps.length >= 4);
  assert.ok(bp.next.length >= 1);
  assert.ok(bp.questions.length >= 2);
  assert.equal(blueprintOf('x'), null);
});
