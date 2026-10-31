// An identity probe ("who are you?", "are you an AI?", "what model are you?") is a fact about Verse, answered from its own facts and
// persona, never sent to Wikipedia as a question (asked by Verse's will, 2026-10-30). Run: node --test tools/self-identity.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { isSelfAsk } from '../void-live-deploy/lib/self-context.js';

const IDENTITY = ['who are you?', 'who are you', 'Hey, who are you really?', 'are you an AI?', 'are you a bot', 'are you human?', 'are you real?',
  'are you ChatGPT?', 'are you claude', 'what model are you?', 'what kind of ai are you', 'what llm powers you', 'who created you?', 'who built you',
  'who owns you', 'introduce yourself', 'what should I call you', 'are you sentient', 'how old are you?', 'where are you hosted', 'what do you do?',
  'What is Verse?', 'what is a-to-mind.com?'];
const NOT_IDENTITY = ['who are the beatles', 'who are you by the who lyrics', 'what is a verse', 'what is verse', 'are you kidding me',
  'are you sure that is right', 'who made the eiffel tower', 'who created the internet', 'how old are you to drive in texas',
  'where do you live in london with kids', 'what do you do when you are bored', 'is it real that bats are blind', 'what is a black hole'];

test('an identity probe is an ask about Verse itself', () => {
  for (const a of IDENTITY) assert.ok(isSelfAsk(a), a);
});
test('a question that only shares the words stays a question', () => {
  for (const a of NOT_IDENTITY) assert.ok(!isSelfAsk(a), a);
});
