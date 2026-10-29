// lib/fuzzy.js: the fuzzy layer for skill activation (asked by Verse three times, 2026-10-14). A slip of a skill's trigger
// word is corrected from the skills' own examples; numbers, units, quoted names, real words and the word after a place
// preposition are never touched; a tie or a far word is left alone; the page only runs the corrected ask when the skill
// that takes it owns the corrected word.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { distance, words, allowed, vocabulary, nearest, correct, confirm, sameStem, COMMON, PROTECT_AFTER , sameLetters, openWords, settled } from '../void-live-deploy/lib/fuzzy.js';

// edit distance: a transposition is one edit, a far word stops early at max + 1
assert.equal(distance('weather', 'weather'), 0);
assert.equal(distance('wether', 'weather'), 1);
assert.equal(distance('tranlsate', 'translate'), 1);
assert.equal(distance('convrt', 'convert'), 1);
assert.equal(distance('recipie', 'recipe'), 1);
assert.equal(distance('distnace', 'distance'), 1);
assert.equal(distance('kitten', 'sitting'), 3);
assert.equal(distance('abcdefgh', 'zzzzzzzz', 1), 2);
assert.deepEqual(words("What's the Weather, in Paris? 5km"), ['what', 's', 'the', 'weather', 'in', 'paris', 'km']);
assert.equal(allowed(4), 0); assert.equal(allowed(5), 1); assert.equal(allowed(7), 1); assert.equal(allowed(8), 2);

// a small vocabulary shaped like the skills' contract
const skills = [
  { name: 'weather', examples: ['weather in Tokyo', 'will it rain tomorrow'], nearMisses: ['what causes rain', 'weather on mars'] },
  { name: 'translate', examples: ['translate hello to Spanish'], nearMisses: ['how many languages are there'] },
  { name: 'distance', examples: ['distance from london to paris'], nearMisses: [] },
  { name: 'recipe', examples: ['recipe for pancakes'], nearMisses: ['history of pancakes'] },
  { name: 'forge', examples: ['print parts for a robot', 'add a sofa to the room'], nearMisses: [] },
  { name: 'timer', examples: ['set a timer for 5 minutes', 'convert 5 miles to km'], nearMisses: [] },
];
const v = vocabulary(skills);
assert.ok(v.own.has('weather') && v.own.has('tokyo') && v.own.has('translate'));
assert.ok(v.known.has('causes') && !v.own.has('causes'), 'a near-miss word is known (never corrected) but never a target');
assert.deepEqual([...v.own.get('to')].sort(), ['distance', 'forge', 'timer', 'translate']);

// one slip of a trigger word, same first letter, no tie: corrected, with the skills that own the word
let r = correct('wether in paris', v);
assert.equal(r.text, 'weather in paris');
assert.deepEqual(r.fixes.map((f) => [f.from, f.to, f.d, f.skills]), [['wether', 'weather', 1, ['weather']]]);
assert.equal(correct('tranlsate hello to spanish', v).text, 'translate hello to spanish');
assert.equal(correct('distnace from london to paris', v).text, 'distance from london to paris');
assert.equal(correct('recipie for pancakes', v).text, 'recipe for pancakes');
assert.equal(correct('Tranlsate hello', v).fixes[0].from, 'Tranlsate', 'the fix keeps what was typed');
// two edits only from 8 letters
assert.equal(correct('transalte hello', v).text, 'translate hello', 'a transposition is one edit');
assert.equal(correct('trnslte hello', v).text, 'trnslte hello', 'two edits in a 7-letter word: left alone');
assert.equal(correct('tarnslaet hello', v).text, 'translate hello', 'two edits in a 9-letter word');
assert.equal(correct('wethr in paris', v).text, 'wethr in paris', 'two edits in a 5-letter word: left alone');

// never touched: numbers, units, short words, quoted names, the word after a place preposition, real and known words
assert.equal(correct('set a timer for 5 minuts', v).text, 'set a timer for 5 minutes', '"for" is a time slot, not a name slot');
assert.equal(correct('convrt 5 miles to km', v).text, 'convert 5 miles to km');
assert.equal(correct('weather in tokio', v).text, 'weather in tokio', 'the word after "in" is a place: left alone');
assert.equal(correct('weather in sofia', v).text, 'weather in sofia', 'a place one edit from a trigger word (sofa) stays');
assert.equal(correct('distance from londn to paris', v).text, 'distance from londn to paris', 'after "from" too');
for (const w of PROTECT_AFTER) assert.equal(correct('wether ' + w + ' wether', v).text, 'weather ' + w + ' wether', w);
assert.equal(correct('a sticky that says "wether"', v).text, 'a sticky that says "wether"', 'quoted');
assert.equal(correct("call it 'wether' please", v).text, "call it 'wether' please", 'single quotes');
assert.equal(correct('a note “wether here”', v).text, 'a note “wether here”', 'curly quotes');
assert.equal(correct('whether it rains', v).text, 'whether it rains', 'a common English word is never a slip');
assert.equal(correct('how many pairs of socks', v).text, 'how many pairs of socks', 'pairs is one edit from paris and a common word');
{ const c = correct('tokio time', v); assert.equal(c.text, 'tokyo time', 'a slip the layer proposes...'); assert.equal(confirm(c, null), false, '...that no skill takes is never run'); }
assert.equal(correct('timers and recipes', v).text, 'timers and recipes', 'an inflection of a trigger word is that word');
assert.equal(correct('converted it', v).text, 'converted it', 'converted is convert');
assert.ok(sameStem('rains', 'rain') && sameStem('timer', 'timers') && sameStem('converted', 'convert') && sameStem('recipes', 'recipe') && sameStem('copies', 'copy') && !sameStem('wether', 'weather') && !sameStem('parts', 'paris'));
assert.equal(correct('what causes rain', v).text, 'what causes rain', 'a near-miss word is known');
assert.equal(correct('weather on mars', v).text, 'weather on mars', 'a valid trigger word is never touched');
assert.equal(correct('5 km2 to m2', v).text, '5 km2 to m2', 'digits and units');
assert.equal(correct('wethr', v).text, 'wethr', 'short word');
assert.equal(correct('weath', v).text, 'weath', '5 letters, one edit from weather would be 2');
assert.equal(correct('aeather in paris', v).text, 'aeather in paris', 'a different first letter is not a slip');
assert.equal(correct('', v).text, ''); assert.deepEqual(correct(null, v).fixes, []); assert.equal(correct('wether', null).text, 'wether');
assert.equal(correct('x'.repeat(161), v).text, 'x'.repeat(161), 'a long paste is left alone');
assert.equal(correct('unlock abcdefghijklmnopqrstuvwxyz', v).text, 'unlock abcdefghijklmnopqrstuvwxyz', 'a long token (a key) is never a slip');
assert.ok(COMMON.has('whether') && COMMON.has('pairs') && !COMMON.has('wether'), 'COMMON is a guard of real words, not a dictionary');

// a tie between two trigger words is left alone
const tie = vocabulary([{ name: 'a', examples: ['convert', 'converter'] }]);
assert.equal(nearest('convertr', tie), null, 'convert and converter are both one edit away');
assert.deepEqual(nearest('convrt', tie), { to: 'convert', d: 1 });

// confirm: the page runs the corrected ask only when the skill that takes it owns every corrected word
r = correct('wether in paris', v);
assert.equal(confirm(r, 'weather'), true);
assert.equal(confirm(r, 'translate'), false, 'another skill took it: the slip stays as typed');
assert.equal(confirm(r, null), false, 'no skill took it');
assert.equal(confirm(correct('weather in paris', v), 'weather'), false, 'nothing to confirm');
const both = correct('tranlsate wether', v); // two fixes owned by two skills: neither skill owns both
assert.equal(both.fixes.length, 2);
assert.equal(confirm(both, 'weather'), false); assert.equal(confirm(both, 'translate'), false);

// the real skills: the layer corrects slips of their words and leaves every example and near miss alone
const dir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'void-live-deploy', 'skills');
const names = JSON.parse(readFileSync(resolve(dir, 'index.json'), 'utf8'));
const real = [];
for (const n of names) real.push((await import(pathToFileURL(resolve(dir, n + '.js')).href)).default);
const rv = vocabulary(real);
assert.ok(rv.own.size > 500, 'the skills carry a vocabulary: ' + rv.own.size);
let untouched = 0;
for (const sk of real) for (const ex of [...(sk.examples || []), ...(sk.nearMisses || [])]) { const c = correct(ex, rv); if (c.text === ex) untouched++; else assert.fail(sk.name + ': ' + JSON.stringify(ex) + ' -> ' + JSON.stringify(c.text)); }
assert.ok(untouched > 500, 'every example and near miss of every skill reads as typed: ' + untouched);
// translate lives in the languages family since lists run 1 (2026-10-21): the corrected ask reaches languages, which answers as translate
for (const [typed, want, owner] of [['tranlsate hello to spanish', 'translate hello to spanish', 'languages'], ['recipie for pancakes', 'recipe for pancakes', 'recipe'],
  ['distnace from london to paris', 'distance from london to paris', 'distance'], ['what rhymes with ornage', 'what rhymes with orange', 'words'], ['open a notpad', 'open a notepad', 'notepad']]) {
  const c = correct(typed, rv); assert.equal(c.text, want, typed);
  const sk = real.find((s) => s.match(c.text.toLowerCase(), c.text)); assert.equal(sk && sk.name, owner, typed + ' reaches ' + owner);
  assert.equal(confirm(c, sk.name), true, typed + ' confirmed by ' + owner);
}
console.log('fuzzy: ok');

// a tie goes to the word with the same letters swapped: "moive" is movie, not move (site-test issue #802)
{
  const v = vocabulary([{ name: 'movie', examples: ['movie metadata for the matrix'] }, { name: 'drag', examples: ['move the clock'] }]);
  assert.deepEqual(nearest('moive', v), { to: 'movie', d: 1 });
  assert.equal(correct('moive metadata for the matrix', v).text, 'movie metadata for the matrix');
  assert.equal(sameLetters('moive', 'movie'), true); assert.equal(sameLetters('moive', 'move'), false);
}

// settled (watchdog #110): the page stops waiting for skills still loading once the loaded skills know every word correct() could
// change. That is exact: a vocabulary of the first skills that says settled gives the same result as the full one, for every ask below.
{
  assert.deepEqual(openWords('loan payment on 20000 at 6% for 5 years'), ['payment']); // "years" is a common word, "loan" is too short
  assert.deepEqual(openWords('weather in "boston" near springfield'), ['weather']); // quoted, short and after-a-place words are never open
  const asks = ['loan payment on 20000 at 6% for 5 years', 'how much is 5 dollars a day for a year', 'compound interest on 1000 at 5% for 10 years',
    'what is the gpa of 3.5 and 4.0', 'recipie for pancakes', 'tranlsate hello to spanish', 'distnace from london to paris', 'open a notpad'];
  for (let n = 0; n <= real.length; n += 10) {
    const part = vocabulary(real.slice(0, n));
    for (const a of asks) if (settled(a, part)) assert.deepEqual(correct(a, rv), correct(a, part), a + ' settled with the first ' + n + ' skills');
  }
  assert.equal(settled('recipie for pancakes', rv), false, 'a slip is never settled: the wait goes on until the full vocabulary or 2.5 s');
  assert.equal(settled('loan payment on 20000 at 6% for 5 years', rv), true);
  assert.equal(settled('anything', null), false);
}
