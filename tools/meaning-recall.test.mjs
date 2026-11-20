import test from 'node:test';
import assert from 'node:assert/strict';
import { rankByMeaning, mergeRecall, byMeaning, recentLines } from '../void-live-deploy/lib/meaning-recall.js';

const V = { dog: [1, 0, 0], puppy: [0.9, 0.436, 0], tax: [0, 0, 1] };
const fakeAI = (map) => ({ run: async (_m, { text }) => ({ data: text.map((t) => map[t]) }) });

test('a line close in meaning is kept, an unrelated one is not', () => {
  const r = rankByMeaning(V.dog, [V.puppy, V.tax], ['Rex is my puppy', 'tax is due in April']);
  assert.deepEqual(r.map((x) => x.line), ['Rex is my puppy']);
});

test('word matches come first and nothing repeats', () => {
  assert.deepEqual(mergeRecall(['a'], [{ line: 'a' }, { line: 'b' }, { line: 'c' }], 2), ['a', 'b']);
});

test('byMeaning finds the note words alone would miss', async () => {
  const env = { AI: fakeAI({ 'what is my dog called': V.dog, 'Rex is my puppy': V.puppy, 'tax is due in April': V.tax }) };
  assert.deepEqual((await byMeaning(env, 'what is my dog called', ['Rex is my puppy', 'tax is due in April'])).map((x) => x.line), ['Rex is my puppy']);
});

test('a failing or slow model falls back to nothing, never an error', async () => {
  assert.deepEqual(await byMeaning({ AI: { run: async () => { throw new Error('down'); } } }, 'x', ['y']), []);
  assert.deepEqual(await byMeaning({ AI: { run: () => new Promise(() => {}) } }, 'x', ['y'], 5, 20), []);
  assert.deepEqual(await byMeaning({}, 'x', ['y']), []);
});

test('recent lines are read for this member only', async () => {
  let bound;
  const env = { DB: { prepare: () => ({ bind: (...a) => { bound = a; return { all: async () => ({ results: [{ kind: 'note', summary: 'Rex is my puppy', links: '[]' }] }) }; } }) } };
  assert.deepEqual(await recentLines(env, 'member:1', (r) => r.summary), ['Rex is my puppy']);
  assert.equal(bound[0], 'member:1');
});
