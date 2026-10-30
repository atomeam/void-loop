// Report to growth (asked by Verse, 2026-10-18): a builder's note becomes open items on the frontier. Run: node --test tools/report-to-growth.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wishlistOf, newWishes, addWishes, inboxAsks } from './report-to-growth.mjs';
import { openItems, OPEN_HEADER } from './frontier.mjs';

const FRONTIER = ['# The frontier', '', OPEN_HEADER + ' (2026-10-11), still open:**', '- **A tide card for the harbour** (`owner`): why', '- **Teach the look skill to open the self card** (`verse`): why', '', 'after'].join('\n');
const INBOX = '| status | date | ask | source |\n| --- | --- | --- | --- |\n| shipped abc123 | 2026-10-02 | share this card | plan |\n| open | 2026-10-12 | days until new year | board |\n';

test('the wishes in a note: bullets under Evolve / Next, "Next:" lines, "What I\'d add:", "I would implement" sentences; empty and none are dropped', () => {
  const note = ['## Brief (B.I.T.E.)', '- **For:** the builders', '', '## Evolve', '- a spectator mode for the chess history', '- teach Verse to read the weather for a pasted postcode', '', '## Other', '- not a wish at all, an ordinary bullet', '',
    'Next: a decision matrix that exports to a spreadsheet', 'What I\'d add: a smoothing curve for the throttle', 'I would implement a dependency health check for the stage libraries.', 'Follow-up: none'].join('\n');
  assert.deepEqual(wishlistOf(note), ['a spectator mode for the chess history', 'teach Verse to read the weather for a pasted postcode', 'a decision matrix that exports to a spreadsheet', 'a smoothing curve for the throttle', 'I would implement a dependency health check for the stage libraries']);
  assert.deepEqual(wishlistOf('## Evolve\n- '), [], 'the PR template\'s empty Evolve bullet is nothing');
  assert.deepEqual(wishlistOf('## Evolve\n\n- first wish worth keeping\n- second wish worth keeping\n\n- not under it'), ['first wish worth keeping', 'second wish worth keeping']);
  assert.deepEqual(wishlistOf('nothing to see here, a plain sentence about a fix'), []);
});

test('a short list from --text: pieces split on ; and new lines are wishes, repeats and short ones dropped, at most eight', () => {
  assert.deepEqual(wishlistOf('a throttle for the starfield; a throttle for the starfield; ok; a tide card for the harbour', { bare: true }), ['a throttle for the starfield', 'a tide card for the harbour']);
  assert.equal(wishlistOf(Array.from({ length: 12 }, (_, i) => 'wish number ' + i + ' for the stage').join(';'), { bare: true }).length, 8);
});

test('what the frontier or the inbox already holds is not added again, even reworded; the rest goes into the open list with where it came from', () => {
  assert.deepEqual(inboxAsks(INBOX), ['share this card', 'days until new year']);
  const fresh = newWishes(['a tide card for the harbour', 'teach the look skill to open the self card for errors', 'days until new year', 'share this card', 'a chess history with replay buttons', 'a chess history with replay buttons'], FRONTIER, INBOX);
  assert.deepEqual(fresh, ['a chess history with replay buttons']);
  const out = addWishes(FRONTIER, fresh, 'claude 2026-10-18');
  assert.deepEqual(openItems(out).map((o) => o.title), ['A tide card for the harbour', 'Teach the look skill to open the self card', 'a chess history with replay buttons']);
  assert.match(out, /a chess history with replay buttons\*\* \(`claude 2026-10-18`\): from a builder's note/);
  assert.ok(out.endsWith('\nafter'), 'what follows the open list is untouched');
  assert.equal(addWishes(FRONTIER, [], 'x'), FRONTIER);
});

test('a wish over the limit ends at a whole clause or word, never mid-word and never with an ellipsis', () => {
  const long = 'a spectator mode for the chess history table '.repeat(12).trim(), [w] = wishlistOf('Next: ' + long);
  assert.ok(w.length <= 300 && !/…$|\.\.\.$/.test(w), w);
  assert.equal(long[w.length], ' ', 'the next character of the original is a space: the cut fell between words');
  const clauses = 'wait for the card to settle before checking it, then click the button, then read the result back from the page ' + 'and compare it with what the test expects to see there '.repeat(5), [c] = wishlistOf('Next: ' + clauses);
  assert.equal(c, 'wait for the card to settle before checking it, then click the button', c);
});
