import test from 'node:test';
import assert from 'node:assert/strict';
import { words, overlap, neighbors, generateStress, generateCorpus } from './evolve-adversary.mjs';

const skills = [
  { name: 'throw-off', examples: ['throw it off the screen', 'toss it off the screen'] },
  { name: 'tidy-up', examples: ['clear the screen', 'tidy the stage'] },
  { name: 'weather', examples: ['weather in paris'] },
];

test('content words drop small words and numbers', () => {
  assert.deepEqual(words('Please throw it off the screen 2'), ['throw', 'screen']);
  assert.equal(overlap('throw it off the screen', 'toss it off the screen'), 1);
});

test('neighbors are the confusable skills, not the far ones', () => {
  const near = neighbors('throw-off', skills, 2);
  assert.equal(near[0].name, 'tidy-up');
  assert.ok(!near.some((s) => s.name === 'weather'));
});

test('stress cases cover the five families and are deterministic', () => {
  const a = generateStress({ name: 'throw-off', examples: skills[0].examples, neighbors: neighbors('throw-off', skills, 2) });
  const b = generateStress({ name: 'throw-off', examples: skills[0].examples, neighbors: neighbors('throw-off', skills, 2) });
  assert.deepEqual(a, b);
  assert.ok(a.length > 5);
  for (const kind of ['filler', 'colloquial', 'punctuation', 'boundary']) assert.ok(a.some((c) => c.kind === kind), kind + ' missing');
  assert.ok(a.every((c) => c.want === 'skill:throw-off'));
  const asks = a.map((c) => c.ask.toLowerCase());
  assert.equal(new Set(asks).size, asks.length);
});

test('a corpus keeps each skill as the want of its own cases', () => {
  const corpus = generateCorpus(skills, { cap: 10 });
  assert.ok(corpus.every((c) => c.want.startsWith('skill:')));
  assert.ok(corpus.some((c) => c.want === 'skill:weather'));
  assert.ok(corpus.every((c) => c.ask.length <= 140));
});
