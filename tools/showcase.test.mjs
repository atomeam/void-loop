// The "look what I made" walkthrough picks what it shows (void-live-deploy/skills/showcase.js). Run: node --test tools/showcase.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { showcaseOf, playable, sinceLast, whatsNew, newestAt, lineOf, KNOWN, everythingOf, proved, hardenedLine, trayOf } from '../void-live-deploy/skills/showcase.js';

const e = (at, kind, what, extra = {}) => ({ at, by: 'claude', kind, what, ...extra });

test('the asks it answers, and the look-alikes it leaves', () => {
  for (const a of ['show me what you made', "what's new", 'whats new', 'What is new?', 'what did you make for me', 'look what you did', 'show me what you built while i was away', 'void, what\u2019s new', "what's new pussycat", 'whats new, pussy cat?', 'Verse, what is new pussycat'])
    assert.ok(showcaseOf(a), a);
  for (const a of ["what's new in the news", 'show me what you can do', 'what did you make for dinner', 'what is new york like', 'whats new pussycat recipe', 'a pussycat'])
    assert.ok(!showcaseOf(a), a);
});
