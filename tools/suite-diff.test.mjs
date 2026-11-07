import test from 'node:test';
import assert from 'node:assert/strict';
import { norm, readRun, verdict, summary } from './suite-diff.mjs';

const run = (lines) => readRun(lines.join('\n'));
const done = (fails, passed = 40) => run([...fails.map((f) => 'FAIL ' + f + '  -> {"x":1}'), 'pass something', `${passed}/${passed + fails.length} passed`]);

test('norm drops the detail, the healed note and the numbers', () => {
  assert.equal(norm('tower: the target on top (4 won)  -> {"a":2}'), 'tower: the target on top (# won)');
  assert.equal(norm('quiz card  (healed on a second run alone)'), 'quiz card');
  assert.equal(norm('  a   b  '), 'a b');
});

test('readRun reads the red checks, whether the shard finished, and keeps runner time stamps out', () => {
  const r = readRun(['2026-11-06T15:57:26.3513187Z FAIL tower: the open card  -> {"before":1}', '2026-11-06T15:57:26.36Z 12/13 passed'].join('\n'));
  assert.equal(r.finished, true);
  assert.equal(r.broken, false);
  assert.deepEqual([...r.fails.values()], ['tower: the open card']);
  assert.equal(readRun('FAIL x').finished, false);
});

test('all green passes without a main run', () => {
  assert.equal(verdict(done([]), null).ok, true);
});

test('a check red on main alone too does not hold the batch, and is named', () => {
  const v = verdict(done(['the book: the rule registry', 'tower: the open card (3 sites)']), done(['tower: the open card (4 sites)', 'the book: the rule registry', 'another main red']));
  assert.equal(v.ok, true);
  assert.equal(v.inherited.length, 2);
  assert.match(summary(v, '2/8'), /Already red on main/);
});

test('a check the pull requests turned red fails the batch, even when main is red elsewhere', () => {
  const v = verdict(done(['the book: the rule registry', 'list card: seeds']), done(['the book: the rule registry']));
  assert.equal(v.ok, false);
  assert.deepEqual(v.fresh, ['list card: seeds']);
  assert.deepEqual(v.inherited, ['the book: the rule registry']);
});

test('a shard that stopped early or never finished is red, whatever main says', () => {
  assert.equal(verdict(run(['FAIL a', 'FAIL suite ran to the end  -> boom', '3/5 passed']), done(['a', 'suite ran to the end'])).ok, false);
  assert.equal(verdict(run(['FAIL check timeout: no check finished within 300 s  -> page', '3/5 passed']), done([])).ok, false);
  assert.equal(verdict(run(['FAIL a']), done(['a'])).ok, false);
});

test('no main result to compare with is red, never a guess', () => {
  assert.equal(verdict(done(['a']), null).ok, false);
  assert.equal(verdict(done(['a']), run(['FAIL a'])).ok, false);
});

test('a batch whose sky test was red is judged with test_void and the sky checks together (2026-11-06: every shard stopped at test_sky)', () => {
  const sky = ['FAIL the "sunrise and sunset" chip answers  -> The moon tonight', 'FAIL the "next eclipse" chip answers  -> The moon tonight'];
  const batch = run(['pass a card', '40/40 passed', ...sky]);
  assert.equal(batch.finished, true);
  assert.equal(batch.fails.size, 2);
  assert.equal(verdict(batch, run(['pass a card', '40/40 passed'])).ok, false, 'sky red only with the batch fails it');
  assert.equal(verdict(batch, run(['pass a card', '40/40 passed', ...sky])).ok, true, 'sky just as red on main alone does not hold it');
});
