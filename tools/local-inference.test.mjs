// skills/local-inference.js: when Ollama is not reachable from the page (nothing on localhost:11434, or the site's origin not allowed),
// the card says how to make it answer, not the browser's bare "Failed to fetch"; any other error keeps its own words.
import test from 'node:test';
import assert from 'node:assert/strict';
import { reachMessage } from '../void-live-deploy/skills/local-inference.js';

test('a fetch that never reaches Ollama names the address, the origin setting and the model to pull', () => {
  const m = reachMessage(new TypeError('Failed to fetch'));
  assert.match(m, /^Ollama did not answer at http:\/\/localhost:11434\./);
  assert.match(m, /OLLAMA_ORIGINS=https:\/\/a-to-mind\.com/);
  assert.match(m, /ollama pull deepseek-coder:6\.7b/);
  assert.doesNotMatch(m, /Failed to fetch/);
});

test('an answer from Ollama that is an error keeps its own words', () => {
  assert.equal(reachMessage(new Error('Ollama request failed: 404 Not Found')), 'Error: Ollama request failed: 404 Not Found');
});
