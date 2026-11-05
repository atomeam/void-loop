// No human in the loop (tools/no-human-wait.mjs): the words that put an item in a state waiting for its owner are caught in live
// files, a sentence that says it never happens is not, and the repo as it stands has none.
// Run: node --test tools/no-human-wait.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { HUMAN_WAIT, waitsIn, scan, markOk } from './no-human-wait.mjs';
import { WAITS } from '../void-live-deploy/lib/v01d-fixes.js';

// the phrases, built from parts so this file is not itself a hit
const O = 'own' + 'er';
test('the wait is caught in its usual words', () => {
  for (const t of ['WebMCP origin trial (waits for the ' + O + ')', 'Paid Verse: waiting on the ' + O + ' to decide.', 'the card is held until the ' + O + ' says yes',
    'set the token. Needs the ' + O + '.', 'tracks prices (needs the ' + O + "'s go-ahead)", 'label: ' + WAITS])
    assert.ok(HUMAN_WAIT.test(t), t);
});
test('a sentence that says it never waits, and words about a thing the owner holds, are not a wait', () => {
  for (const t of ['Nothing waits on the ' + O + '.', 'It never waits for the ' + O + ', it retries.', 'the check waits for the card to settle', 'waits for the ' + O + ' token to load'])
    assert.equal(waitsIn(t).length, 0, t);
});
test('a mark counts only where it belongs: the retired label where it is defined, old words in a test', () => {
  const line = "x = '" + WAITS + "'; // no-human-wait: retired label";
  assert.equal(waitsIn(line, 'void-live-deploy/lib/v01d-fixes.js').length, 0);
  assert.equal(waitsIn(line, 'void-live-deploy/skills/wants.js').length, 1, 'the mark is not a way round the check in live code');
  assert.ok(markOk('tools/frontier.test.mjs', '// no-human-wait: old words'));
  assert.equal(markOk('domains/void.frontier.md', '// no-human-wait: old words'), false);
});
test('the repo has no live line that waits for a person (archive/ and append-only history are records)', () => {
  const hits = scan();
  assert.deepEqual(hits, [], hits.map((h) => h.file + ':' + h.line + ' ' + h.text).join('\n'));
});
