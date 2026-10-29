// Stage pack I (owner, 2026-10-18): partial-answer, draft-triad, stale-work, certainty-budget, interrupt-priority. Pure logic
// (lib/stage-pack-i.js) plus routing of the five skill files. Run: node --test tools/stage-pack-i.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as I from '../void-live-deploy/lib/stage-pack-i.js';
import partial from '../void-live-deploy/skills/partial-answer.js';
import triadSkill from '../void-live-deploy/skills/draft-triad.js';
import stale from '../void-live-deploy/skills/stale-work.js';
import certainty from '../void-live-deploy/skills/certainty-budget.js';
import interrupt from '../void-live-deploy/skills/interrupt-priority.js';

const routes = (skill, yes, no) => {
  for (const a of yes) assert.ok(skill.match(a.toLowerCase(), a), skill.name + ' takes: ' + a);
  for (const a of no) assert.ok(!skill.match(a.toLowerCase(), a), skill.name + ' leaves: ' + a);
};

test('partial answer: the person\'s own facts, the local table, one hole at a time', () => {
  const p = I.partialOf('partial answer on the Berlin move known: rent is 900; job offer in hand / missing: start date; visa');
  assert.equal(p.subject, 'the Berlin move');
  assert.deepEqual(p.known, ['rent is 900', 'job offer in hand']);
  assert.deepEqual(p.missing, ['start date', 'visa']);
  assert.equal(p.next_question, 'Can you tell me start date?');
  const t = I.partialOf('tell me only what you know about my trip to Lisbon');
  assert.deepEqual(t.known, []);
  assert.deepEqual(t.missing, ['the dates', 'the budget', 'where you leave from']);
  assert.deepEqual(I.partialOf('partial answer on whatever').missing, I.DEFAULT_MISSING);
  const f = I.fillHole({ known: [], missing: ['the dates', 'the budget'], next_question: 'x' }, 'May 3 to 9');
  assert.deepEqual(f.known, ['dates: May 3 to 9']);
  assert.deepEqual(f.missing, ['the budget']);
  assert.equal(f.next_question, 'Can you tell me the budget?');
  assert.deepEqual(I.fillHole(f, 'a lot').missing, []);
  assert.equal(I.fillHole({ known: ['a'], missing: [], next_question: '' }, 'z').known.length, 1, 'nothing missing, nothing filled');
  assert.equal(I.holeOf('fill the hole: May 3'), 'May 3');
  assert.equal(I.holeOf('fill the hole in my wall'), '');
  routes(partial, partial.examples, partial.nearMisses);
});

test('draft triad: fixed labels, three different drafts, look-alikes left alone', () => {
  assert.equal(I.triadOf('Three drafts of we are late'), 'we are late');
  assert.equal(I.triadOf('the three drafts of the novel'), '');
  const d = I.triad('we are late with the report');
  assert.deepEqual(d.map((x) => x.label), ['aggressive', 'conservative', 'weird']);
  assert.equal(new Set(d.map((x) => x.text)).size, 3);
  assert.ok(d.every((x) => x.text.includes('we are late with the report') || x.text.includes('We are late with the report')));
  routes(triadSkill, triadSkill.examples, triadSkill.nearMisses);
});

test('stale work: the rule, defer, kill, and the bump ask', () => {
  let c = {};
  for (let i = 0; i < 4; i++) c = I.bump(c, 'edited', 'pitch');
  assert.deepEqual(I.staleList(c, '2026-10-18'), []);
  c = I.bump(c, 'edited', 'pitch');
  assert.deepEqual(I.staleList(c, '2026-10-18'), ['pitch']);
  assert.equal(I.isStale({ edits: 5, decisions: 1 }, '2026-10-18'), false);
  assert.deepEqual(I.staleList(I.defer(c, 'pitch', '2026-10-25'), '2026-10-18'), []);
  assert.deepEqual(I.staleList(I.defer(c, 'pitch', '2026-10-25'), '2026-10-26'), ['pitch']);
  assert.equal(I.defer(c, 'pitch', 'next week'), c, 'a non-date changes nothing');
  assert.deepEqual(I.staleList(I.kill(c, 'pitch'), '2026-10-18'), []);
  assert.deepEqual(I.staleList(I.decide(c, 'pitch'), '2026-10-18'), []);
  assert.deepEqual(I.bumpOf('note that I edited the pitch'), { kind: 'edited', thing: 'pitch' });
  assert.deepEqual(I.bumpOf('log that i decided on the logo'), { kind: 'decided', thing: 'logo' });
  assert.equal(I.bumpOf('I edited a photo yesterday', () => false), null, 'untracked bare ask is chat');
  assert.deepEqual(I.bumpOf('I edited the pitch', (t) => t === 'pitch'), { kind: 'edited', thing: 'pitch' });
  routes(stale, ['show stale work', 'note that I edited the pitch'], stale.nearMisses);
});

test('certainty budget: ten examples, spend, zero, refill', () => {
  const ex = [['It will definitely work.', 'hard'], ['This is always true', 'hard'], ['We must ship today', 'hard'], ['It is guaranteed to pass', 'hard'], ['100% sure it is the cache', 'hard'],
    ['Maybe it is the cache', 'soft'], ['I think it works', 'soft'], ['It will probably work', 'soft'], ['Is it the cache?', 'question'], ['option A or option B', 'option']];
  for (const [t, k] of ex) assert.equal(I.classifyClaim(t), k, t);
  let b = I.newBudget();
  assert.equal(b.left, 5);
  for (let i = 0; i < 5; i++) { const r = I.spend(b, 'it is definitely the cache'); assert.ok(r.ok); b = r.state; }
  assert.equal(b.left, 0);
  assert.equal(I.spend(b, 'it is definitely the cache').ok, false);
  assert.equal(I.spend(b, 'the cache is fine').ok, false, 'soft statements wait too at zero');
  assert.ok(I.spend(b, 'is it the cache?').ok);
  assert.ok(I.spend(b, 'either the cache or the router').ok);
  assert.equal(I.refill(b, '').ok, false);
  assert.equal(I.refill(b, 'is it paid?').ok, false);
  assert.equal(I.refill(b, 'the invoice was paid').state.left, 5);
  assert.equal(I.newBudget(3).max, 3);
  assert.deepEqual(I.budgetIntent('certainty budget of 3'), { act: 'show', n: 3 });
  assert.deepEqual(I.budgetIntent('refill certainty: the invoice was paid'), { act: 'refill', fact: 'the invoice was paid' });
  routes(certainty, certainty.examples, certainty.nearMisses);
});

test('interrupt priority: the levels, the queue, the hook', () => {
  assert.equal(I.priorityOf('set priority deep'), 'deep');
  assert.equal(I.priorityOf('set priority to deep clean the kitchen'), '');
  assert.ok(I.deferredIntent('show deferred') && !I.deferredIntent('show deferred revenue accounting'));
  assert.equal(I.allows('deep', 'important'), false);
  assert.equal(I.allows('normal', 'soft'), false);
  assert.equal(I.allows('normal', 'important'), true);
  assert.equal(I.allows('interruptible', 'soft'), true);
  I.clearDeferred(); I.setPriority('deep');
  assert.equal(I.maySuggest('try the minimap'), false);
  assert.deepEqual(I.deferred(), ['try the minimap']);
  I.setPriority('interruptible');
  assert.equal(I.maySuggest('try the clock'), true);
  assert.equal(I.setPriority('bogus'), 'interruptible');
  I.clearDeferred(); I.setPriority('normal');
  assert.deepEqual(I.deferred(), []);
  routes(interrupt, interrupt.examples, interrupt.nearMisses);
});
