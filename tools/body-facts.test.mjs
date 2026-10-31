// Body facts and dog years carry their source (2026-10-30). Before, "normal body temperature", "how many calories in a pound of fat" and
// "how old is my dog in human years" stated their numbers with no link and no read date. Each now cites the page it was read from:
// MedlinePlus "Body temperature norms", the Mayo Clinic News Network on calories and weight loss, and the AKC page that gives the AVMA rule.
import test from 'node:test'; import assert from 'node:assert/strict'; import { load } from './word-math.mjs';
const W = load(), ask = (a) => W.wordMath(a.toLowerCase());
const MP = 'https://medlineplus.gov/ency/article/001982.htm';
const MAYO = 'https://newsnetwork.mayoclinic.org/discussion/its-complicated-calories-and-other-factors-affect-weight-loss/';
const AKC = 'https://www.akc.org/expert-advice/health/how-to-calculate-dog-years-to-human-years/';

test('body temperature is the MedlinePlus page: 98.6 °F, 97–99 °F, fever above 100.4 °F', () => {
  const r = ask('normal body temperature');
  assert.equal(r.value, '98.6 °F (37 °C)'); assert.match(r.note, /97–99 °F \(36\.1–37\.2 °C\)/); assert.match(r.note, /above 100\.4 °F \(38 °C\)/);
  assert.equal(r.src[0][1], MP); assert.equal(r.read, '2026-10-30');
});

test('a pound of fat is the Mayo Clinic figure, with its caveat', () => {
  for (const a of ['how many calories in a pound of fat', 'how many calories to lose a pound']) {
    const r = ask(a); assert.equal(r.value, 'about 3,500', a); assert.match(r.note, /fat, muscle and water/, a);
    assert.equal(r.src[0][1], MAYO, a); assert.equal(r.read, '2026-10-30', a);
  }
});

test('dog years follow the AVMA rule as the AKC page gives it', () => {
  const at = (n) => ask('how old is my dog in human years if he is ' + n);
  assert.equal(at(1).value, 'about 15'); assert.equal(at(2).value, 'about 24'); assert.equal(at(5).value, 'about 39');
  const r = at(5); assert.equal(r.src[0][1], AKC); assert.equal(r.read, '2026-10-30'); assert.match(r.note, /medium-sized/);
});
