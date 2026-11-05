// No human in the loop (tools/no-human-wait.mjs): the words that put an item in a state waiting for its owner are caught in live
// files, a sentence that says it never happens is not, and the repo as it stands has none.
// Run: node --test tools/no-human-wait.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { HUMAN_WAIT, PERSONAL_PATH, waitsIn, scan, markOk } from './no-human-wait.mjs';
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
// the owner by first name, and a personal home folder, built from parts too
const N = 'Ad' + 'am';
test('the first name, in a wait, is caught like the role', () => {
  for (const t of ['Verse grows first; building waits for ' + N + '.', 'rename waits for ' + N + "'s new name, one coordinated change", 'the card is held until ' + N + ' says yes'])
    assert.ok(HUMAN_WAIT.test(t), t);
  assert.equal(waitsIn('Nothing waits on ' + N + '.').length, 0, 'a denial is still not a wait');
});
test('a personal home folder is caught in its usual spellings; shared folders and placeholders are not', () => {
  const U = 'Us' + 'ers';
  for (const t of ['C:\\' + U + '\\' + N.toLowerCase() + 'm\\projects\\aether', '`C:\\\\' + U + '\\\\pat\\\\hold`', 'see d:/' + U + '/jo.smith/x', 'C:\\' + U + '\\' + N])
    assert.equal(waitsIn(t, 'docs/x.md').length, 1, t);
  for (const t of ['C:\\' + U + '\\Public\\x', 'C:\\' + U + '\\you\\proj\\.env', 'C:/' + U + '/Jane Doe/dev', 'C:\\' + U + '\\Default\\', '%USERPROFILE%\\a-to-mind.com'])
    assert.equal(PERSONAL_PATH.test(t), false, t);
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
