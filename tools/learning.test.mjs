// node tools/learning.test.mjs: the required tests for the quiz card (domains/void.learning.md §2), named
// learning.quiz/<case>, plus the handoff itself: an explainer's observations pass into the quiz unchanged.
// Fixtures are the real payloads the gear and Moon cards give (skills/gear-pair-rules.js, skills/moon-phases-rules.js);
// the lock is not built yet, so its fixture is written from its spec's addendum (domains/void.explainers.md §3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Q from '../void-live-deploy/skills/quiz-rules.js';
import quiz, { quizOf, sourceOf, payloadOf } from '../void-live-deploy/skills/quiz.js';
import gearsSkill from '../void-live-deploy/skills/gears.js';
import moonSkill from '../void-live-deploy/skills/moon.js';
import * as G from '../void-live-deploy/skills/gear-pair-rules.js';
import * as M from '../void-live-deploy/skills/moon-phases-rules.js';
import { validateObservations } from '../void-live-deploy/lib/observations.js';

const gearObs = () => G.observations(G.create({ driverTeeth: 16, drivenTeeth: 32 }));
const moonObs = () => M.observations(M.setOrbit(M.create(), 60, 0), 0); // a waxing crescent, captured at 60°
const lockObs = () => ({
  schema: 'void.observations.v1', source: { cardId: 'lock-1', revision: 3 },
  items: [
    { id: 'alignedPinCount', label: 'Aligned pins', value: 5, valueType: 'number', unit: 'pins', meaning: 'Pin stacks whose shear line meets the plug', displayValue: '5',
      assessment: { enabled: true, prompt: 'With the correct key inserted all the way, how many pin stacks are aligned at the shear line?', answerLabel: '5', tolerance: 0 } },
    { id: 'mechanismState', label: 'State', value: 'ready', valueType: 'text', meaning: 'The lock\'s state', displayValue: 'Ready',
      assessment: { enabled: true, prompt: 'With the correct key fully inserted at 0°, what state is the lock in?', answerLabel: 'Ready',
        options: ['withdrawn', 'inserting', 'blocked', 'ready', 'turned'].map((id) => ({ id, label: id[0].toUpperCase() + id.slice(1) })), answerId: 'ready' } },
    { id: 'canTurn', label: 'Can turn', value: 'yes', valueType: 'text', meaning: 'Whether full insertion lets the plug turn', displayValue: 'Yes',
      assessment: { enabled: true, prompt: 'Fully inserted, could the correct key turn the plug?', answerLabel: 'Yes', options: [{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }], answerId: 'yes' } },
    { id: 'keyPreset', label: 'Key', value: 'correct', valueType: 'text', meaning: 'Which key (an input)', displayValue: 'Correct' },
  ],
});
const started = (p, opts) => Q.take(Q.create(opts), p);
const cur = (s) => s.questions[s.current];
const answerRight = (s) => { const q = cur(s); return Q.answer(s, q.answer); };
const answerWrong = (s) => { const q = cur(s); return Q.answer(s, q.type === 'number' ? q.answer + q.tolerance + 1 : q.options.find((o) => o.id !== q.answer).id); };

test('learning.quiz/accepts-all-three-explainer-payloads', () => {
  for (const [name, p] of [['gear', gearObs()], ['moon', moonObs()], ['lock', lockObs()]]) {
    assert.ok(validateObservations(p).ok, name + ' fixture is a valid payload');
    const s = started(p);
    assert.equal(s.status, 'answering', name);
    assert.ok(s.questions.length >= 2, name + ' gives at least one number and one choice');
    assert.ok(s.questions.some((q) => q.type === 'number') && s.questions.some((q) => q.type === 'choice'), name);
  }
});

test('learning.quiz/caps-count-to-eligible-items', () => {
  // the gear gives two assessable items (four more are inputs or not assessed): asking five gives two
  assert.equal(started(gearObs(), { questionCount: 5 }).questions.length, 2);
  assert.equal(started(lockObs(), { questionCount: 2 }).questions.length, 2);
  assert.equal(Q.create({ questionCount: 9 }).questionCount, Q.COUNT_MAX);
  assert.equal(Q.create({ questionCount: 0 }).questionCount, Q.COUNT_MIN);
  // the source's order, never re-ordered or invented
  assert.deepEqual(started(moonObs(), { questionCount: 5 }).questions.map((q) => q.id), ['illuminatedFraction', 'phaseName', 'waxingOrWaning']);
});

test('learning.quiz/rejects-malformed-observations', () => {
  for (const bad of [null, {}, { ...gearObs(), schema: 'other' }, { ...gearObs(), items: 'x' },
    { ...gearObs(), items: [{ id: 'a', label: 'A', meaning: 'm', value: 'x', valueType: 'text', assessment: { enabled: true, prompt: 'free text?' } }] }]) {
    const s = started(bad);
    assert.equal(s.status, 'invalid');
    assert.ok(s.errors.length > 0);
    assert.equal(s.questions.length, 0);
  }
});

test('learning.quiz/no-assessable-items-shows-empty-state', () => {
  const p = gearObs(); p.items = p.items.filter((it) => !(it.assessment && it.assessment.enabled));
  const s = started(p);
  assert.equal(s.status, 'empty');
  assert.equal(s.questions.length, 0, 'no made-up questions');
  // a text item with no options is never a question either
  const q = moonObs(); q.items = q.items.filter((it) => it.id === 'orbitAngleDegrees');
  assert.equal(started(q).status, 'empty');
});

test('learning.quiz/numeric-answer-respects-unit-and-tolerance', () => {
  const s = started(moonObs()), q = cur(s); // the lit fraction at 60°: 0.25, tolerance 0.02 in its own unit (fraction)
  assert.equal(q.unit, 'fraction'); assert.equal(q.tolerance, 0.02);
  assert.ok(Math.abs(q.answer - 0.25) < 1e-9);
  assert.equal(Q.answer(s, '0.27').responses[0].correct, true, 'inside the tolerance');
  assert.equal(Q.answer(s, '0.28').responses[0].correct, false, 'outside it');
  assert.equal(Q.answer(s, '25%').responses[0].correct, true, 'a percent reads as a fraction');
  assert.equal(Q.answer(s, '25').responses[0].correct, false, 'a bare 25 is 25, not 25%');
  assert.equal(Q.answer(s, 'quarter'), s, 'not a number: nothing scored');
  const g = started(gearObs()); // turns-per-turn, tolerance 0.01
  assert.equal(Q.answer(g, 0.505).responses[0].correct, true);
  assert.equal(Q.answer(g, 0.52).responses[0].correct, false);
  const l = started(lockObs()); // pins, tolerance 0: exact
  assert.equal(Q.answer(l, 5).responses[0].correct, true);
  assert.equal(Q.answer(l, 4.5).responses[0].correct, false);
});

test('learning.quiz/choice-answer-uses-option-id', () => {
  let s = started(gearObs());
  s = Q.next(answerRight(s));
  const q = cur(s);
  assert.equal(q.type, 'choice');
  assert.deepEqual(q.options.map((o) => o.id), ['same', 'opposite'], 'the source\'s own options only');
  assert.equal(Q.answer(s, 'Opposite'), s, 'a label is not an answer: the id is');
  assert.equal(Q.answer(s, 'opposite').responses[1].correct, true);
  assert.equal(Q.answer(s, 'same').responses[1].correct, false);
});

test('learning.quiz/duplicate-submit-does-not-double-score', () => {
  const s1 = answerRight(started(gearObs()));
  const s2 = Q.answer(s1, cur(s1).answer);
  assert.equal(s2, s1);
  assert.equal(s2.responses.length, 1);
  // at-end feedback: the second click lands on the next question, never re-scores the first
  const e = answerWrong(started(gearObs(), { feedback: 'at-end' }));
  assert.equal(e.responses.length, 1); assert.equal(e.current, 1);
  const done = answerRight(e);
  assert.equal(done.status, 'complete');
  assert.equal(Q.answer(done, 'opposite'), done);
});

test('learning.quiz/source-change-does-not-mutate-active-quiz', () => {
  const p = gearObs();
  const s = started(p);
  p.items[0].value = 99; p.items[0].assessment.prompt = 'changed'; p.items.length = 0; // the source moves on
  assert.equal(cur(s).answer, 0.5);
  assert.match(cur(s).prompt, /16-tooth driver and a 32-tooth driven gear/);
  assert.equal(s.snapshot.items.length, 6);
});

test('learning.quiz/refresh-source-restarts-attempt', () => {
  let s = answerRight(started(gearObs()));
  const fresh = G.observations(G.create({ driverTeeth: 24, drivenTeeth: 12 }));
  s = Q.refresh(s, fresh);
  assert.equal(s.status, 'answering'); assert.equal(s.current, 0); assert.deepEqual(s.responses, []);
  assert.equal(cur(s).answer, 2);
  assert.equal(s.attempt, 2);
});

test('learning.quiz/completion-reports-correct-and-missed', () => {
  let s = started(moonObs());
  s = Q.next(answerRight(s)); s = Q.next(answerWrong(s)); s = Q.next(answerRight(s));
  assert.equal(s.status, 'complete');
  assert.ok(Math.abs(Q.score(s) - 2 / 3) < 1e-9);
  const r = Q.review(s);
  assert.match(r, /^2 of 3 right\./);
  assert.match(r, /✓ Lit fraction: 25%/);
  assert.match(r, /✗ Phase: Waxing crescent \(you said /);
  assert.match(r, /Look again at: phase\./);
  assert.doesNotMatch(r, /\b(?:genius|smart|great job|expert|beginner|you are a)\b/i, 'no personality or ability label');
  const g = Q.gives(s);
  assert.ok(validateObservations(g.observations).ok, 'the quiz gives a valid payload itself');
  assert.deepEqual(g.observations.items.map((it) => [it.id, it.result, !!it.assessment.enabled]), [['illuminatedFraction', 'correct', false], ['phaseName', 'missed', true], ['waxingOrWaning', 'correct', false]]);
  assert.equal(g.score, Q.score(s));
});

test('learning.quiz/retry-includes-only-missed-items', () => {
  let s = started(moonObs());
  s = Q.next(answerWrong(s)); s = Q.next(answerRight(s)); s = Q.next(answerWrong(s));
  const r = Q.retryMissed(s);
  assert.deepEqual(r.questions.map((q) => q.id), ['illuminatedFraction', 'waxingOrWaning']);
  assert.equal(r.status, 'answering'); assert.deepEqual(r.responses, []);
  // all right: nothing to retry
  let a = started(gearObs()); a = Q.next(answerRight(a)); a = Q.next(answerRight(a));
  assert.equal(Q.retryMissed(a), a);
});

test('learning.quiz/reset-clears-attempt', () => {
  let s = started(gearObs()); s = Q.next(answerWrong(s));
  const r = Q.reset(s);
  assert.equal(r.status, 'answering'); assert.equal(r.current, 0); assert.deepEqual(r.responses, []); assert.equal(r.draft, '');
  assert.equal(r.questions.length, 2, 'the same snapshot, a clean attempt');
});

test('learning.quiz/keyboard-completes-entire-quiz', () => {
  let s = started(moonObs()); // a number, then two choices
  for (const k of '25%') s = Q.onKey(s, k);
  s = Q.onKey(s, 'Enter'); assert.equal(s.status, 'feedback'); assert.equal(s.responses[0].correct, true);
  s = Q.onKey(s, 'Enter');
  const wax = cur(s).options.findIndex((o) => o.id === 'waxing-crescent') + 1;
  s = Q.onKey(s, String(wax)); s = Q.onKey(s, 'Enter'); s = Q.onKey(s, 'Enter');
  s = Q.onKey(s, '1'); s = Q.onKey(s, 'Enter'); s = Q.onKey(s, 'Enter'); // 1 = Growing (waxing)
  assert.equal(s.status, 'complete'); assert.equal(Q.score(s), 1);
  // a miss, then R retries it and Escape starts over, all without a pointer
  let m = started(gearObs());
  for (const k of ['9', 'Backspace', '0', '.', '5', 'Enter', 'Enter', '1', 'Enter', 'Enter']) m = Q.onKey(m, k);
  assert.equal(m.status, 'complete'); assert.equal(Q.missed(m).length, 1);
  m = Q.onKey(m, 'R'); assert.deepEqual(m.questions.map((q) => q.id), ['rotationDirection']);
  m = Q.onKey(m, 'Escape'); assert.equal(m.questions.length, 2);
});

test('learning.quiz/state-not-persisted-by-default', () => {
  // what the stage saves to the browser and syncs for a signed-in visitor goes through the same filter (void.html keptThings)
  const kinds = { ...quiz.stageKinds, ...gearsSkill.stageKinds };
  assert.equal(kinds.quiz.ephemeral, true);
  const things = { g1: { id: 'g1', kind: 'gears' }, q1: { id: 'q1', kind: 'quiz', state: started(gearObs()) }, n1: { id: 'n1', kind: 'kept' } };
  assert.deepEqual(Object.keys(Q.persistable(things, kinds)), ['g1', 'n1']);
});

test('learning.quiz/explicit-keep-retains-only-that-card', () => {
  const kinds = { ...quiz.stageKinds };
  const things = { q1: { id: 'q1', kind: 'quiz', keep: true }, q2: { id: 'q2', kind: 'quiz' } };
  assert.deepEqual(Object.keys(Q.persistable(things, kinds)), ['q1']);
  assert.deepEqual(quizOf('keep this quiz'), { keep: true });
});

// ---------------- the handoff: one card's output is another card's input, unchanged ----------------

test('learning.quiz/takes-gear-and-moon-observations-unchanged', () => {
  const kinds = { ...gearsSkill.stageKinds, ...moonSkill.stageKinds, ...quiz.stageKinds };
  const gear = { id: 'g', kind: 'gears', state: G.create({ driverTeeth: 12, drivenTeeth: 36 }) };
  const moon = { id: 'm', kind: 'moon', state: M.setOrbit(M.create(), 200, 0) };
  for (const th of [gear, moon]) {
    const things = { [th.id]: th, other: { id: 'other', kind: 'kept' } };
    assert.equal(sourceOf(things, kinds, null), th, 'the quiz finds the card by its declared port, not by its name');
    const p = payloadOf(th, kinds);
    const before = JSON.stringify(p.observations);
    const s = Q.take(Q.create(), p.observations, p.explanation);
    assert.equal(JSON.stringify(p.observations), before, 'the source payload is not touched');
    assert.deepEqual(s.snapshot, p.observations, 'the snapshot is the payload exactly');
    assert.equal(s.explanation, p.explanation);
    for (const q of s.questions) assert.equal(q.prompt, p.observations.items.find((it) => it.id === q.id).assessment.prompt, 'the source writes the question');
  }
  // with both up, the selected one wins; with none selected, the newest
  const both = { g: gear, m: moon };
  assert.equal(sourceOf(both, kinds, 'g'), gear);
  assert.equal(sourceOf(both, kinds, null), moon);
  assert.equal(sourceOf({ k: { id: 'k', kind: 'kept' } }, kinds, null), null);
});

test('quiz: summoned by the asks people type, not by look-alikes', () => {
  for (const a of ['quiz me on this', 'Quiz me', 'test me on that', 'test me on this', 'quiz me on it', 'quiz me about the moon phases', 'quiz me on the gears?'])
    assert.deepEqual(quizOf(a), { start: true }, a);
  for (const a of ['quiz', 'pub quiz near me', 'test my internet speed', 'quiz show', 'make a quiz about france', 'test me', 'i need to pass my quiz by friday'].filter((x) => x !== 'test me'))
    assert.equal(quizOf(a), null, a);
  for (const e of quiz.examples) assert.ok(quiz.match(e.toLowerCase(), e), e);
  for (const e of quiz.nearMisses) assert.ok(!quiz.match(e.toLowerCase(), e), e);
});
