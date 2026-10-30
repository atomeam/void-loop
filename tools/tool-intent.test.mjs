// A stage tool opens only when the message asks for it (owner, 2026-10-30: "when clock is mentioned in any message it opens
// the clock only on verse"). Before, any message with the word "clock" in it made a clock on the stage: a pasted report,
// "we worked around the clock", "my clock is broken". The gate is lib/ask-text.js asksTheStage / asksToMake / withoutIdioms,
// and void.html's freerEnglishParse calls it first. Run: node --test tools/tool-intent.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { asksTheStage, asksToMake, withoutIdioms, isPasted } from '../void-live-deploy/lib/ask-text.js';

const REPORT = 'Status: the deploy went out at 3pm. The clock skew check passed and the tower clock card still shows Changed.'
  + ' Waiting on the review for #1980. Nothing else is open.';

test('a message that only mentions a tool does not reach the stage', () => {
  const notAsks = [
    REPORT,
    'Changed:⏎- the clock card⏎- the timer copy⏎Waiting: review',
    'we worked around the clock to ship it',
    'around the clock',
    'my clock is broken',
    'I set a timer earlier but it never rang',
    'you are right',
    'it is 5 o clock',
    'the clock is ticking on this release',
    'I clocked out at 9 last night',
  ];
  for (const s of notAsks) assert.equal(asksTheStage(s), false, s);
  assert.equal(isPasted(REPORT), true, 'a report of several sentences reads as a paste');
});

test('a real ask still reaches the stage, and only a making ask may make a new tool', () => {
  const makes = ['make a clock', 'add a timer', 'can you make a clock', 'i want a big red clock', 'okay now put a note here',
    'please show the clock', 'note: buy milk', 'Make it blue'];
  for (const s of makes) assert.equal(asksTheStage(s), true, s);
  for (const s of ['make a clock', 'i want a big red clock', 'add a timer']) assert.equal(asksToMake(s), true, s);
  // a short message of only stage words is an ask too: the page passes terse = true for these
  for (const s of ['a big red clock', 'clock blue', 'the timers are blue']) {
    assert.equal(asksTheStage(s, true), true, s);
    assert.equal(asksToMake(s, true), true, s);
  }
  // a change to an existing tool is a stage ask, but not a making ask
  assert.equal(asksTheStage('can you move the timer to the top'), true);
  assert.equal(asksToMake('my clock is broken'), false);
});

test('a tool word inside an idiom does not pick the tool', () => {
  for (const s of ['we worked around the clock', 'round-the-clock support', "it is 5 o'clock", 'racing against the clock',
    'my body clock is off', 'cpu clock speed', 'set the clocks back tonight', 'over-the-counter meds'])
    assert.doesNotMatch(withoutIdioms(s), /\bclock|counter\b/, s);
  assert.match(withoutIdioms('make a clock'), /\bclock\b/);
});

test('every copy of the page gates the stage parser with asksTheStage before any tool is made', () => {
  for (const f of ['void.html', 'void-live-deploy/void.html', 'void-live-deploy/index.html']) {
    const html = readFileSync(new URL('../' + f, import.meta.url), 'utf8');
    const start = html.indexOf('function freerEnglishParse(');
    assert.ok(start > 0, f + ': freerEnglishParse');
    const gate = html.indexOf('askText.asksTheStage(text', start), firstEnsure = html.indexOf('.ensure(', start);
    assert.ok(gate > start && gate < firstEnsure, f + ': the gate comes before the first ensure');
    assert.match(html.slice(start, start + 200000), /findTargetThing\(targetKindName, mayMake\)/, f);
  }
  const a = readFileSync(new URL('../void.html', import.meta.url), 'utf8');
  for (const f of ['void-live-deploy/void.html', 'void-live-deploy/index.html'])
    assert.equal(readFileSync(new URL('../' + f, import.meta.url), 'utf8'), a, f + ' matches void.html');
});
