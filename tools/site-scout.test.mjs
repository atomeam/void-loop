// The site scout (tools/site-scout.mjs): what a press changed is the lines that were not there before. Run: node --test tools/site-scout.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { changed } from './site-scout.mjs';

test('a press reports only the lines it added or changed', () => {
  assert.deepEqual(changed('Flip a coin\nHeads: 0', 'Flip a coin\nHeads: 1\nTAILS'), ['Heads: 1', 'TAILS']);
  assert.deepEqual(changed('same', 'same'), []);
  assert.deepEqual(changed('', ' a \n\n b'), ['a', 'b']);
});
