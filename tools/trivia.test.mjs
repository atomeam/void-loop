import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../void-live-deploy/lib/trivia.js';
import skill from '../void-live-deploy/skills/trivia.js';
import quiz from '../void-live-deploy/skills/quiz.js';

test('a round is five questions, each with its answer among four different choices', () => {
  for (const it of T.BANK) { assert.equal(new Set([it.a, ...it.wrong]).size, 4, it.q); }
  const r = T.round(42);
  assert.equal(r.length, 5); assert.deepEqual(T.round(42), r, 'the same seed, the same round');
  for (const q of r) { assert.equal(q.choices.length, 4); assert.ok(q.choices.includes(q.a)); }
  assert.equal(new Set(r.map((q) => q.q)).size, 5);
});

test('picks score the round, and the end says how it went', () => {
  let s = T.create(7);
  for (const q of s.qs) s = T.pick(s, q.a);
  assert.equal(s.score, 5); assert.equal(T.pick(s, 'x'), s); assert.equal(T.verdict(5), 'Perfect round.');
  let w = T.create(7); w = T.pick(w, '__wrong__'); assert.equal(w.score, 0); assert.equal(w.at, 1);
});

test('trivia takes its asks; quiz keeps "quiz me on this"', () => {
  for (const a of ['trivia', 'play trivia', 'trivia game', "let's play trivia", 'ask me trivia questions', 'general knowledge quiz']) assert.equal(skill.match(a, a), true, a);
  for (const a of ['quiz me', 'quiz me on this', 'trivia about france', 'pub quiz near me']) assert.equal(skill.match(a, a), false, a);
  assert.equal(quiz.match('quiz me', 'quiz me'), true);
});
