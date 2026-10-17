import test from 'node:test';
import assert from 'node:assert/strict';
import { isPaste, PASTE_RULE } from '../void-live-deploy/functions/api/answer.js';

test('a long pasted discussion is a paste; a question is not', () => {
  const pasted = 'I will capture this richer concept of cards as persistent, evolving entities. It is in the frontier as step 7. What the design says: Mint the first time anything touches an idea. Evolve as evidence arrives. Privacy: facts and counts only. Where it lives: server side storage, written only by the answer route. ' + 'More detail follows here. '.repeat(10);
  assert.equal(isPaste(pasted), true);
  assert.equal(isPaste('what is a black hole?'), false);
  assert.equal(isPaste('how do i make a timer'), false);
  assert.match(PASTE_RULE, /not a question/);
});

test('the initial self route keeps a paste off the ask-about-Void path', async () => {
  const src = (await import('node:fs')).readFileSync(new URL('../void-live-deploy/functions/api/answer.js', import.meta.url), 'utf8');
  assert.match(src, /const self = isSelfAsk\(ask\) && !isPaste\(ask\)/);
});

test('the semantic self route also keeps a paste off the ask-about-Void path', async () => {
  const src = (await import('node:fs')).readFileSync(new URL('../void-live-deploy/functions/api/answer.js', import.meta.url), 'utf8');
  assert.match(src, /if \(!self && !isPaste\(ask\) && route\.kind === 'skill' && route\.skill === 'self'/);
});
