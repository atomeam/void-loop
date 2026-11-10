// A long ask stays whole from the box to the free model. Search stays short.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ASK_MAX } from '../void-live-deploy/lib/answer-honesty.js';
import { ASK_CAP, clipAsk } from '../void-live-deploy/lib/ask-box.js';
import { isPaste, ANSWER_SYSTEM, PASTE_RULE } from '../void-live-deploy/functions/api/answer.js';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const long = ('This sentence stays whole. '.repeat(200)).slice(0, 3000);

test('a 3000 character ask is a paste and is not cut on the way to the model', () => {
  assert.equal(long.length, 3000);
  assert.equal(ASK_CAP, 4000);
  assert.equal(ASK_MAX, ASK_CAP);
  assert.equal(clipAsk(long), long);
  assert.equal(long.slice(0, ASK_MAX), long);
  assert.equal(isPaste(long), true, 'three sentences and more than 400 characters is still a paste');
  assert.equal(isPaste('what is two plus two?'), false);
  const user = 'Question: ' + long + '\n\nSources:\n(no sources found)';
  const prompt = ANSWER_SYSTEM + ' ' + PASTE_RULE + '\n' + user;
  assert.ok(prompt.length < 32000, 'the free model prompt stays inside a small context window (' + prompt.length + ' characters)');
  assert.match(user, /This sentence stays whole\./);
  assert.equal(user.includes(long), true);
});

test('the ask boxes, the hand-offs and the server all use 4000, and search stays 120', () => {
  const brain = read('void-live-deploy/brain/index.html');
  assert.match(brain, /id="mapWord" maxlength="4000"/);
  assert.match(brain, /id="kFind" type="search" maxlength="120"/);
  const page = read('void.html');
  assert.equal(page.includes('.slice(0, 500)'), false);
  assert.ok((page.match(/slice\(0, 4000\)/g) || []).length >= 3);
  const answer = read('void-live-deploy/functions/api/answer.js');
  assert.match(answer, /slice\(0, ASK_MAX\)/);
  assert.equal(answer.includes('slice(0, 600)'), false);
  assert.match(read('void-live-deploy/brain/app.js'), /clipAsk\(told\)/);
  assert.match(read('void-live-deploy/brain/map.js'), /clipAsk\(t\)/);
  assert.match(read('void-live-deploy/skills/verse-brain.js'), /maxlength="4000"/);
  assert.match(read('void-live-deploy/brain/unbidden.js'), /askBox\(input\)/);
});
