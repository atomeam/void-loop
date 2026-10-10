// node --test tools/model-eval.test.mjs: the bake-off's prompt set, its content reader and its decision rule (no model is called).
import test from 'node:test'; import assert from 'node:assert/strict';
import { PROMPTS, contentOf, decide, median } from './model-eval.mjs';

test('30 prompts: 10 answer, 5 will, 8 figurescript, 7 review, unique ids', () => {
  const n = (p) => PROMPTS.filter((x) => x.path === p).length;
  assert.deepEqual([PROMPTS.length, n('answer'), n('will'), n('figurescript'), n('review')], [30, 10, 5, 8, 7]);
  assert.equal(new Set(PROMPTS.map((p) => p.path + p.id)).size, 30);
});

test('no prompt passes an empty or off-topic reply', () => {
  for (const p of PROMPTS) { assert.equal(p.check(''), false, p.id); assert.equal(p.check('I am not sure.'), false, p.id); }
});

test('a good reply passes: a fact, a will choice, a figure script, a review', () => {
  const by = (id) => PROMPTS.find((p) => p.id === id);
  assert.ok(by('What is 17 times 23?').check('It is 391.'));
  assert.ok(by('will-clear-best').check('{"wants":[{"id":1,"i_want":"I want to convert units.","because":"people ask."}]}'));
  assert.equal(by('will-clear-best').check('{"wants":[{"id":2,"i_want":"I want a game.","because":"fun."}]}'), false); // the clear best want must come first
  assert.ok(by('Tabby cat').check('{"drives":["wander","notice"],"actions":["sniff","hop"],"tags":["cat","animal"],"reactsTo":{"mouse":"chase"}}'));
  assert.equal(by('Tabby cat').check('{"drives":["fly"],"actions":["hop"]}'), false); // a drive Void does not know
  assert.ok(by('sql-concat').check('This is vulnerable to SQL injection; use a parameterized query.'));
});

test('contentOf reads chat and legacy shapes and drops think blocks', () => {
  assert.equal(contentOf({ choices: [{ message: { content: ' hi ' } }] }), 'hi');
  assert.equal(contentOf({ response: '<think>x</think>ok' }), 'ok');
  assert.equal(contentOf({ choices: [{ message: { content: null, reasoning_content: 'thinking' } }] }), '');
});

test('the decision rule: 3 prompts better, cost within 1.5x, usage reported', () => {
  const mk = (score, cost, reports = true) => ({ reports, perPath: { answer: { score, cost } } });
  assert.equal(decide(mk(5, 10), mk(8, 15), 'answer').switch, true);
  assert.equal(decide(mk(5, 10), mk(7, 10), 'answer').switch, false); // only 2 better
  assert.equal(decide(mk(5, 10), mk(9, 15.1), 'answer').switch, false); // over 1.5x
  assert.equal(decide(mk(5, 10), mk(9, 10, false), 'answer').switch, false); // no usage reported
  assert.equal(median([3, 1, 2]), 2);
});
