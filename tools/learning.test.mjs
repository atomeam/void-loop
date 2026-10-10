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

// ---------------- five-minute challenge ----------------
import * as C from '../void-live-deploy/skills/challenge-rules.js';
import challenge, { challengeOf } from '../void-live-deploy/skills/challenge.js';

const T0 = 1_000_000;
const ready = (p, opts) => C.take(C.create(opts), p);
const go = (p, opts) => C.start(ready(p, opts), T0);
const roundNow = (s) => s.rounds[C.currentIndex(s)];
const predictRight = (s, t) => C.predict(s, roundNow(s).answer, t);
const predictWrong = (s, t) => { const r = roundNow(s); return C.predict(s, r.type === 'number' ? r.answer + r.tolerance + 1 : r.options.find((o) => o.id !== r.answer).id, t); };

test('learning.five-minute-challenge/accepts-all-three-explainer-payloads', () => {
  for (const [name, p] of [['gear', gearObs()], ['moon', moonObs()], ['lock', lockObs()]]) {
    const s = ready(p);
    assert.equal(s.status, 'ready', name);
    assert.ok(s.rounds.length >= 2, name);
    assert.ok(s.rounds.every((r) => r.prompt === p.items.find((it) => it.id === r.id).assessment.prompt), name + ': the source writes the prompt');
  }
});

test('learning.five-minute-challenge/handoff-does-not-autostart', () => {
  const s = ready(gearObs());
  assert.equal(s.status, 'ready'); assert.equal(s.startedAt, null);
  assert.equal(C.remainingMs(s, T0 + 600_000), 300_000, 'no time passes before Start');
  assert.equal(C.tick(s, T0 + 600_000), s);
  assert.equal(C.predict(s, 0.5, T0), s, 'nothing is scored before Start');
});

test('learning.five-minute-challenge/no-eligible-items-shows-empty-state', () => {
  const p = gearObs(); p.items = p.items.filter((it) => !(it.assessment && it.assessment.enabled));
  const s = ready(p);
  assert.equal(s.status, 'empty'); assert.equal(s.rounds.length, 0);
  assert.equal(C.start(s, T0), s, 'an empty tray cannot start');
});

test('learning.five-minute-challenge/caps-rounds-to-eligible-items', () => {
  assert.equal(ready(gearObs(), { roundCount: 3 }).rounds.length, 2);
  assert.equal(ready(moonObs(), { roundCount: 3 }).rounds.length, 3);
  assert.equal(ready(moonObs(), { roundCount: 1 }).rounds.length, 1);
  assert.equal(C.create({ roundCount: 7 }).roundCount, C.ROUNDS_MAX);
  assert.equal(C.create({ roundCount: 0 }).roundCount, C.ROUNDS_MIN);
});

test('learning.five-minute-challenge/pause-excludes-paused-time', () => {
  let s = go(gearObs());
  s = C.pause(s, T0 + 60_000);
  assert.equal(C.remainingMs(s, T0 + 60_000 + 3_600_000), 240_000, 'an hour paused costs nothing');
  s = C.resume(s, T0 + 3_660_000);
  assert.equal(C.remainingMs(s, T0 + 3_690_000), 210_000);
  assert.equal(C.elapsedMs(s, T0 + 3_690_000), 90_000);
});

test('learning.five-minute-challenge/remaining-time-independent-of-frame-rate', () => {
  const s0 = go(gearObs());
  let fast = s0; for (let t = T0; t <= T0 + 100_000; t += 16) fast = C.tick(fast, t);
  let slow = s0; for (let t = T0; t <= T0 + 100_000; t += 25_000) slow = C.tick(slow, t);
  assert.equal(C.remainingMs(fast, T0 + 100_000), 200_000);
  assert.equal(C.remainingMs(slow, T0 + 100_000), 200_000);
  assert.equal(C.remainingMs(s0, T0 + 100_000), 200_000, 'no ticks at all: the same');
});

test('learning.five-minute-challenge/zero-time-ends-once', () => {
  const s = predictRight(go(moonObs()), T0 + 1000);
  const end = C.tick(s, T0 + 300_000);
  assert.equal(end.status, 'time-ended');
  assert.equal(C.tick(end, T0 + 400_000), end, 'a later tick changes nothing');
  assert.equal(C.predict(end, 'waxing', T0 + 400_000), end);
  assert.equal(C.reveal(end, T0 + 400_000), end);
  assert.equal(C.elapsedMs(end, T0 + 999_999), 300_000);
  assert.match(C.summary(end), /^Time is up\./);
  assert.match(C.summary(end), /Unfinished: /, 'unfinished rounds included');
  // a late action ends it the same way, once
  const late = C.predict(go(moonObs()), 0.25, T0 + 301_000);
  assert.equal(late.status, 'time-ended'); assert.equal(late.rounds[0].prediction, null);
});

test('learning.five-minute-challenge/all-rounds-finished-completes-early', () => {
  let s = go(gearObs());
  s = C.reveal(predictRight(s, T0 + 5_000), T0 + 6_000);
  s = C.reveal(predictWrong(s, T0 + 9_000), T0 + 10_000);
  assert.equal(s.status, 'completed');
  assert.equal(C.elapsedMs(s, T0 + 200_000), 10_000, 'the clock stops at completion');
  assert.match(C.summary(s), /^Done\. 1 of 2 predictions matched\./);
});

test('learning.five-minute-challenge/reveal-prevents-later-scored-prediction', () => {
  let s = go(moonObs());
  s = C.reveal(s, T0 + 1000); // revealed with no prediction
  assert.equal(s.rounds[0].revealed, true); assert.equal(s.rounds[0].prediction, null);
  assert.equal(C.currentIndex(s), 1, 'that round is closed; the next one is current');
  const after = C.predict(s, s.rounds[1].answer, T0 + 2000);
  assert.equal(after.rounds[0].prediction, null, 'the revealed round never gets a scored prediction');
  assert.equal(after.rounds[1].correct, true);
});

test('learning.five-minute-challenge/source-change-preserves-snapshot', () => {
  const p = moonObs();
  const s = ready(p);
  p.items[0].value = 0.9; p.items[0].assessment.prompt = 'changed'; p.items.length = 0;
  assert.ok(Math.abs(s.rounds[0].answer - 0.25) < 1e-9);
  assert.match(s.rounds[0].prompt, /captured orbital position of 60°/);
  assert.equal(s.snapshot.items.length, 4);
});

test('learning.five-minute-challenge/finish-now-reports-partial-results', () => {
  let s = go(moonObs());
  s = C.reveal(predictRight(s, T0 + 2000), T0 + 3000);
  s = C.finishNow(s, T0 + 4000);
  assert.equal(s.status, 'ended-early');
  const sum = C.summary(s);
  assert.match(sum, /^Finished early\. 1 of 3 predictions matched\./);
  assert.match(sum, /✓ Lit fraction: you predicted 0\.25, the answer was 25%/);
  assert.match(sum, /Unfinished: phase, waxing or waning\./);
  assert.doesNotMatch(sum, /\b(?:genius|smart|great job|expert|beginner|you are a)\b/i, 'results, not traits');
  const g = C.gives(s, T0 + 4000);
  assert.ok(validateObservations(g.observations).ok);
  assert.deepEqual(g.observations.items.map((it) => it.result), ['matched', 'no-prediction', 'no-prediction']);
  assert.equal(g.elapsed, 4);
});

test('learning.five-minute-challenge/restart-clears-attempt', () => {
  let s = C.finishNow(predictWrong(go(gearObs()), T0 + 1000), T0 + 2000);
  const r = C.restart(s);
  assert.equal(r.status, 'ready'); assert.equal(r.base, 0); assert.equal(r.startedAt, null);
  assert.ok(r.rounds.every((x) => x.prediction === null && !x.revealed));
  assert.equal(r.rounds.length, 2, 'the same snapshot');
});

test('learning.five-minute-challenge/keyboard-completes-entire-activity', () => {
  let s = ready(moonObs()), t = T0;
  const key = (k) => { t += 500; s = C.onKey(s, k, t); };
  key('Enter'); assert.equal(s.status, 'active');
  for (const k of '25%') key(k);
  key('Enter'); assert.equal(s.rounds[0].correct, true);
  key('Enter'); assert.equal(s.rounds[0].revealed, true);
  key('p'); assert.equal(s.status, 'paused'); key('p'); assert.equal(s.status, 'active');
  key(String(s.rounds[1].options.findIndex((o) => o.id === 'waxing-crescent') + 1)); key('Enter'); key('Enter');
  key('2'); key('Enter'); key('Enter'); // 2 = Shrinking (waning): a wrong prediction
  assert.equal(s.status, 'completed'); assert.match(C.summary(s), /2 of 3 predictions matched/);
  key('Escape'); assert.equal(s.status, 'ready');
  key('Enter'); key('f'); assert.equal(s.status, 'ended-early');
});

test('learning.five-minute-challenge/state-not-persisted-by-default', () => {
  const kinds = { ...challenge.stageKinds, ...quiz.stageKinds, ...moonSkill.stageKinds };
  assert.equal(kinds.challenge.ephemeral, true);
  const things = { m: { id: 'm', kind: 'moon' }, c: { id: 'c', kind: 'challenge', state: go(moonObs()) }, q: { id: 'q', kind: 'quiz' } };
  assert.deepEqual(Object.keys(Q.persistable(things, kinds)), ['m']);
});

test('learning.five-minute-challenge/explicit-keep-retains-only-that-card', () => {
  const kinds = { ...challenge.stageKinds, ...quiz.stageKinds };
  const things = { c1: { id: 'c1', kind: 'challenge', keep: true }, c2: { id: 'c2', kind: 'challenge' }, q: { id: 'q', kind: 'quiz' } };
  assert.deepEqual(Object.keys(Q.persistable(things, kinds)), ['c1'], 'keeping one learning card keeps no other');
  assert.deepEqual(challengeOf('keep this challenge'), { keep: true });
});

// ---------------- the first end-to-end handoffs (void.learning.md) ----------------

const handoffKinds = () => ({ ...gearsSkill.stageKinds, ...moonSkill.stageKinds, ...quiz.stageKinds, ...challenge.stageKinds });
for (const [name, th] of [['gear', () => ({ id: 'g', kind: 'gears', state: G.create({ driverTeeth: 24, drivenTeeth: 12 }) })], ['moon', () => ({ id: 'm', kind: 'moon', state: M.setOrbit(M.create(), 270, 0) })]]) {
  test('handoff/' + name + '-to-quiz-no-adapter', () => {
    const kinds = handoffKinds(), src = th();
    const p = payloadOf(sourceOf({ [src.id]: src }, kinds, null), kinds);
    const s = Q.take(Q.create(), p.observations, p.explanation);
    assert.equal(s.status, 'answering');
    assert.deepEqual(s.snapshot, p.observations);
  });
}

test('handoff/quiz-missed-to-challenge', () => {
  const kinds = handoffKinds();
  // a moon quiz with the phase missed
  let qs = Q.take(Q.create(), moonObs());
  qs = Q.next(answerRight(qs)); qs = Q.next(answerWrong(qs)); qs = Q.next(answerRight(qs));
  const quizTh = { id: 'q', kind: 'quiz', state: qs }, moonTh = { id: 'm', kind: 'moon', state: M.create() };
  const things = { m: moonTh, q: quizTh };
  // "give me five minutes with this" picks the explainer, never the quiz; the missed ask picks the quiz
  assert.equal(sourceOf(things, kinds, 'q'), moonTh);
  assert.equal(sourceOf(things, kinds, null, { kind: 'quiz' }), quizTh);
  const p = payloadOf(quizTh, kinds);
  const before = JSON.stringify(p.observations);
  const c = C.take(C.create(), p.observations, p.explanation);
  assert.equal(JSON.stringify(p.observations), before, 'the quiz payload is not touched');
  assert.equal(c.status, 'ready');
  assert.deepEqual(c.rounds.map((r) => r.id), ['phaseName'], 'only the missed item becomes a round');
  assert.equal(c.rounds[0].prompt, moonObs().items.find((it) => it.id === 'phaseName').assessment.prompt);
  // a perfect quiz leaves nothing to practise: the empty state is the right message
  let all = Q.take(Q.create(), gearObs()); all = Q.next(answerRight(all)); all = Q.next(answerRight(all));
  assert.equal(C.take(C.create(), Q.gives(all).observations).status, 'empty');
});

test('challenge: summoned by the asks people type, not by look-alikes', () => {
  for (const a of ['give me five minutes with this', 'Give me 5 minutes with that', 'give me five minutes with the moon', 'five minute challenge', 'a 5-minute challenge on this'])
    assert.deepEqual(challengeOf(a), { start: true }, a);
  for (const a of ['turn the questions I missed into a five-minute challenge', 'turn the ones i got wrong into a challenge', 'challenge me on the ones I missed'])
    assert.deepEqual(challengeOf(a), { start: true, missed: true }, a);
  for (const a of ['give me five minutes', 'five minute timer', 'set a timer for five minutes', 'give me a challenge', 'five minutes from now', 'wait five minutes', 'quiz me on this'])
    assert.equal(challengeOf(a), null, a);
  for (const e of challenge.examples) assert.ok(challenge.match(e.toLowerCase(), e), e);
  for (const e of challenge.nearMisses) assert.ok(!challenge.match(e.toLowerCase(), e), e);
});
