// palindrome (skills/palindrome.js): a phrase is checked on the device, spaces and case ignored.
import test from 'node:test';
import assert from 'node:assert/strict';
import skill, { isPalindrome, phraseOf } from '../void-live-deploy/skills/palindrome.js';

test('racecar and the canal phrase are palindromes, hello is not', () => {
  assert.equal(phraseOf('is racecar a palindrome'), 'racecar');
  assert.equal(isPalindrome('racecar'), true);
  assert.equal(isPalindrome('a man a plan a canal panama'), true);
  assert.equal(isPalindrome('kayak'), true);
  assert.equal(isPalindrome('hello'), false);
  assert.equal(skill.match('is racecar a palindrome', 'is racecar a palindrome'), true);
  assert.equal(skill.match('what is a palindrome', 'what is a palindrome'), false);
  assert.equal(skill.suite().ok, true);
});
