import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanWord, sensesFrom } from '../void-live-deploy/lib/meanings.js';

test('a word is one to three words of letters', () => {
  assert.equal(cleanWord(' serendipity '), 'serendipity');
  assert.equal(cleanWord('déjà vu'), 'déjà vu');
  assert.equal(cleanWord('define <script>'), '');
  assert.equal(cleanWord('https://example.com'), '');
});

test('senses keep the part of speech, three lines, and one short example', () => {
  const senses = sensesFrom({ en: [{ partOfSpeech: 'noun', definitions: [{ definition: 'A <b>happy</b> accident.', examples: ['A serendipity.'] }, { definition: '   ' }] }] });
  assert.equal(senses.length, 1);
  assert.equal(senses[0].pos, 'noun');
  assert.equal(senses[0].defs[0], 'A happy accident.');
  assert.equal(senses[0].ex, 'A serendipity.');
  assert.deepEqual(sensesFrom(null), []);
  assert.deepEqual(sensesFrom({}), []);
});
