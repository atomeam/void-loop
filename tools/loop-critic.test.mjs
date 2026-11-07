// tools/loop-critic.mjs: the critic reads the lines Verse shows, not the asks visitors type (#2361).
import test from 'node:test';
import assert from 'node:assert/strict';
import { critique } from './loop-critic.mjs';

const diff = (file, line) => `+++ b/${file}\n+${line}\n`;

test('a roleplay line in a skill is still a finding', () => {
  const f = critique(diff('void-live-deploy/skills/mood.js', "reply: 'I truly feel alive today'"));
  assert.equal(f.length, 1);
  assert.equal(f[0].id, 'roleplay');
});

test('skills/first.json holds visitor asks, so "translate i love you into spanish" is not Verse roleplay', () => {
  assert.equal(critique(diff('void-live-deploy/skills/first.json', ' "languages": ["translate i love you into spanish"]')).length, 0);
});

test('only first.json is read as asks: a file with a similar name is still critiqued', () => {
  assert.equal(critique(diff('void-live-deploy/skills/first.js', "say('I love you')")).length, 1);
});
