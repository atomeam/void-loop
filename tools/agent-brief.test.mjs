// The agent's system line (lib/agent-answer.js answerBrief): short everyday answers that lead with the answer, depth only when asked, and
// the general shapes of a comparison and a piece of writing. Run: node --test tools/agent-brief.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { answerBrief } from '../void-live-deploy/lib/agent-answer.js';

test('the general answerer leads with the answer and keeps to about 120 words unless asked for depth', () => {
  const b = answerBrief({ name: 'verse' });
  assert.match(b, /Lead with the answer in the first sentence/);
  assert.match(b, /About 120 words or less, unless the person asks for depth/);
  assert.match(b, /No preamble, no filler/);
  assert.ok(!/250 words/.test(b), 'the old long limit is gone');
});
test('a comparison gets what each one is, then a pick; writing gets ready-to-send text', () => {
  const b = answerBrief({ name: 'verse' });
  assert.match(b, /"A or B" and "difference between" questions, say in one line what each one is or does, then recommend or conclude/);
  assert.match(b, /ready-to-send text: a greeting, the point, a next step or another option/);
});
test('counted asks get a numbered list, calculations a check, caveats and declines an option, and getting around permission is never helped', () => {
  const b = answerBrief({ name: 'verse' });
  assert.match(b, /give exactly that many as a numbered list, 1\. 2\. 3\., one per line/);
  assert.match(b, /give the answer first, then one line showing how it checks/);
  assert.match(b, /the one condition or caveat that changes the pick/);
  assert.match(b, /name the one assumption or precondition the answer depends on/);
  assert.match(b, /one plain sentence of about 25 words that keeps every name, number and date/);
  assert.match(b, /another option when you decline or say no/);
  assert.match(b, /getting into a place or a thing without its owner saying yes, do not help with that; suggest asking the owner/);
  assert.ok(b.split(/\s+/).length < 290, 'the line stays short enough for a free model to follow');
});
test('the retry and a specialist keep the same short, lead-with-the-answer rule, and nothing is ever claimed as sent', () => {
  for (const bot of [{ name: 'verse', repair: true }, { name: 'word-counter', description: 'counts words' }]) {
    const b = answerBrief(bot);
    assert.match(b, /120 words or less/, bot.name);
    assert.match(b, /Never claim to have sent, paid, posted or deleted anything/, bot.name);
  }
  assert.match(answerBrief({ name: 'verse', repair: true }), /^You are Verse\. The last answer did not do the task\./);
  assert.match(answerBrief({ name: 'word-counter', description: 'counts words' }), /Lead with the result/);
});
