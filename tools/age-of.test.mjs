// The age answer on the page (ageOf in void.html): "how old am i if born 1990-05-01" fell to a web search that answered nothing (2026-10-30),
// and a dashed date was read as UTC midnight, one day early west of London. The function is taken from the page itself and run here.
//   node --test tools/age-of.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../void.html', import.meta.url), 'utf8').match(/\n    function ageOf\(l, now = new Date\(\)\) \{[\s\S]*?\n    \}\n/);
assert.ok(src, 'ageOf is in void.html');
const ageOf = new Function('return ' + src[0].trim())();
const now = new Date(2026, 9, 30); // 30 October 2026, local time

test('a birth date gives the age on that day, and the day stays the day typed', () => {
  for (const [a, big] of [['how old am i if born 1990-05-01', '36'], ['how old am i if born 1990-11-15', '35'], ['how old am i if born 1990-10-30', '36'],
    ['how old am i if i was born on may 3 1990', '36'], ['how old is someone born on 2000/12/31', '25'], ['age if born 1985-01-01', '41'], ['how old would i be if born 1990-05-01?', '36']]) {
    assert.equal(ageOf(a, now).big, big, a);
  }
  assert.match(ageOf('how old am i if born 1990-05-01', now).note, /May 1, 1990|1 May 1990/, 'the day typed, not April 30');
  assert.deepEqual(ageOf('how old is someone born in 1990', now), { big: '35 or 36', note: '36 after their birthday this year, 35 before it' });
});

test('a day that is not on the calendar says so; a future date, a date before 1850 and a question that is not an age are not answered here', () => {
  for (const a of ['how old am i if born 1990-02-30', 'how old am i if born 1990-13-01', 'how old am i if born 2023-02-29']) assert.equal(ageOf(a, now).big, 'No such day', a);
  assert.equal(ageOf('how old am i if born 2024-02-29', now).big, '2', 'a leap day that was');
  for (const a of ['how old am i if born 2030-01-01', 'how old am i if born 1700-01-01', 'how old is the moon', 'how old am i']) assert.equal(ageOf(a, now), null, a);
});
