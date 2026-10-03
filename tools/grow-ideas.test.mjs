import test from 'node:test';
import assert from 'node:assert/strict';
import { asksIn, ideasToAdd, appendIdeas } from './grow-ideas.mjs';

const inbox = [
  '| status | date | ask | source |',
  '| --- | --- | --- | --- |',
  '| shipped abc | 2026-10-03 | show the magnetize step | board |',
  '| open | 2026-10-03 | what\'s already built | assimilate |',
  '',
].join('\n');

test('growth ideas skip asks already listed and add several', () => {
  const have = asksIn(inbox);
  assert.equal(have.includes('show the magnetize step'), true);
  const add = ideasToAdd(inbox, undefined, 5);
  assert.equal(add.length, 5);
  assert.equal(add.some(([ask]) => ask === 'show the magnetize step'), false);
  assert.equal(add.some(([ask]) => ask === "what's already built"), false);
  const next = appendIdeas(inbox, add, '2026-10-03');
  assert.equal(next.split('\n').filter((l) => l.startsWith('| open |')).length, 6);
  assert.match(next, /throw it off the screen/);
});
