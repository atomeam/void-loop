// "pick a random name from alice bob carol" (void.html chanceOf and pickItems): the ask fell to a web search that answered nothing (2026-10-30).
// The form and the list reader are taken from the page itself and run here.
//   node --test tools/pick-name.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../void.html', import.meta.url), 'utf8');
const pickItems = new Function('return ' + src.match(/\n    function pickItems\(s\) \{[\s\S]*?\n    \}\n/)[0].trim())();
const line = src.split('\n').find((l) => l.includes('(?:name|winner|person|item|one)') && l.includes('m = l.match(')), re = new RegExp(/m = l\.match\(\/(.+)\/\);/.exec(line)[1]);
const picks = (ask) => { const m = re.exec(ask); return m ? pickItems(m[1]) : null; };

test('a name from a list with spaces, commas, "or" or "and"', () => {
  for (const [a, xs] of [['pick a random name from alice bob carol', ['alice', 'bob', 'carol']], ['choose a winner from: ann, ben, cy', ['ann', 'ben', 'cy']],
    ['pick a name from tom and jerry', ['tom', 'jerry']], ['select a random person among sam or alex', ['sam', 'alex']], ['pick one at random from red green blue', ['red', 'green', 'blue']],
    ['draw a name out of mary jo', ['mary', 'jo']], ['pick a random name from new york, boston', ['new york', 'boston']]]) assert.deepEqual(picks(a), xs, a);
});

test('not a list to pick from: words that name a list, one item, numbers and cards', () => {
  for (const a of ['pick a winner from the comments', 'pick a random name from my class', 'pick a random name from a list', 'pick a name from alice', 'pick a random name',
    'pick a random number from 1 to 10', 'pick a card from the deck', 'choose a name for my dog']) assert.equal(picks(a), null, a);
  assert.equal(pickItems(Array.from({ length: 31 }, (_, i) => 'n' + i).join(' ')), null, 'more than 30 is not a pick');
});
