// node --test tools/own-work-prose.test.mjs (paraphrased cases, 2026-10-15):
// 1. a long pasted status note that mentions "air quality" must not fire the air card (or any keyword card) with the paste as a city;
// 2. a note about Verse's own cards/routing/fixes is a self ask, answered from Verse's facts with a rule against third-party troubleshooting.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isLongProse, LONG_OK } from '../void-live-deploy/lib/ask-text.js';
import { isSelfAsk, isOwnWorkAsk, SELF_RULE } from '../void-live-deploy/lib/self-context.js';

const PASTE = 'Status update for today. The crew shipped several fixes overnight and most checks passed. A few items still fail, including the air quality lookup for one city and a reminder wording. Thirteen of the claims did not answer and are now marked in progress. More tomorrow.';
test('long pasted prose is not a keyword ask; short asks and long-text instructions are', () => {
  assert.ok(isLongProse(PASTE));
  for (const a of ['air quality in Tokyo', 'weather in Lisbon', 'what time is it in japan']) assert.ok(!isLongProse(a), a);
  assert.ok(!isLongProse('summarize this transcript: ' + PASTE));
  assert.ok(!LONG_OK.has('air') && !LONG_OK.has('weather') && !LONG_OK.has('country') && LONG_OK.has('digest'));
});
test('notes about Verse\'s own cards and fixes are self asks', () => {
  for (const a of ['Verse\'s air quality card misrouted a pasted note; is the fix shipped?', 'the weather card fell through to the wrong card again', 'did the void routing fix get merged']) {
    assert.ok(isOwnWorkAsk(a), a); assert.ok(isSelfAsk(a), a);
  }
  for (const a of ['what is a void pointer in c', 'air quality in Tokyo', 'how do I fix my bike']) assert.ok(!isOwnWorkAsk(a), a);
  assert.match(SELF_RULE, /Never answer with troubleshooting for other products/);
});
