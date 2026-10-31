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
  assert.match(src, /if \(!self && !isPaste\(ask\) && !note && route\.kind === 'skill' && route\.skill === 'self'/);
});

// a pasted status report is read as a report, never answered with key advice (owner, 2026-10-30: "the rekey ran and the old key stopped")
test('a pasted status report is a paste, and the rule asks for what it shows and what is open', () => {
  const report = 'The "5 m c" fix is live. The card no longer labels 5 m/s as Mach and makes no notation claim. ⏎ "The 3 mile run" showed a new fault live: the card said Not found, because the model\'s refusal hid the exact conversion. The fix (#1775) is on automerge, and I will check the live card after it deploys. ⏎ Beam\'s log shows the rekey ran and the old key stopped. Beam also gave back 2 Versus jobs because it found no spec for them.';
  assert.equal(isPaste(report), true);
  assert.match(PASTE_RULE, /status report, say what it shows as done or verified live, and what is still open or waiting/);
  assert.match(PASTE_RULE, /Never answer it with advice about keys, secrets or safety/);
});
