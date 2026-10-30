// Football field, soccer field, Olympic pool and basketball hoop sizes carry their source (2026-10-30). Before, they had no link, the
// soccer answer called 105 × 68 m "typical" with nothing behind it, and the pool answer said "at least 2 m deep" and 2,500,000 liters.
// The NFL rulebook gives a 360 × 160 ft field with goal lines 10 yards from each end line; IFAB Law 1 gives 100–110 × 64–75 m for
// international matches and 90–120 × 45–90 m for others; the WA Government guide gives 50 m pools, lanes at least 2.5 m and 10 lanes
// for the Olympic Games; AP reports the World Aquatics minimum depth of 2.5 m and 3 m as best; the NBA rule puts the ring 10 ft up and
// FIBA puts it at 3,050 mm ± 6 mm. All read 2026-10-30. The acres and liters are worked out here from those sizes.
import test from 'node:test'; import assert from 'node:assert/strict'; import { load } from './word-math.mjs';
const W = load(), ask = (a) => W.wordMath(a.toLowerCase()), links = (r) => JSON.stringify(r.src.map((s) => s[1]));
const ACRE_FT2 = 43560, ACRE_M2 = 4046.8564224;
const NFL = 'https://operations.nfl.com/media/24emxacq/2024-nfl-rulebook.pdf', IFAB = 'https://www.theifab.com/laws/latest/the-field-of-play/';
const WA = 'https://dlgsc.wa.gov.au/sport-and-recreation/sports-dimensions-guide/swimming';
const AP = 'https://www.ksat.com/sports/2024/07/31/no-world-records-have-been-set-at-the-olympic-pool-is-it-too-shallow/';
const NBA = 'https://official.nba.com/rule-no-1-court-dimensions-equipment', FIBA = 'https://assets.fiba.basketball/image/upload/documents-corporate-fiba-official-rules-2026-equipment-v1-0.pdf';
const r2 = (x) => Math.round(x * 100) / 100;

test('a football field is the NFL rule size', () => {
  const r = ask('how big is a football field in acres');
  assert.equal(links(r), JSON.stringify([NFL])); assert.equal(r.read, '2026-10-30');
  assert.equal(r2(360 * 160 / ACRE_FT2), 1.32); assert.equal(r.value, 'about 1.32 acres'); assert.match(r.note, /360 × 160 ft/); assert.match(r.note, /57,600 sq ft/);
  assert.equal(360 - 2 * 30, 300); assert.equal(Math.round(300 * 160 / ACRE_FT2 * 10) / 10, 1.1); assert.match(r.note, /about 1\.1 acres for the 300 ft between the goal lines/);
});

test('a soccer field is the Law 1 range, not one "typical" size', () => {
  const r = ask('how big is a soccer field');
  assert.equal(links(r), JSON.stringify([IFAB])); assert.equal(r.read, '2026-10-30');
  assert.equal(Math.round(100 * 64 / ACRE_M2 * 10) / 10, 1.6); assert.equal(Math.round(110 * 75 / ACRE_M2 * 10) / 10, 2.0);
  assert.equal(r.value, 'about 1.6–2.0 acres'); assert.match(r.note, /100–110 × 64–75 m for international matches/);
  assert.equal(r2(105 * 68 / ACRE_M2), 1.76); assert.match(r.note, /90–120 m long and 45–90 m wide/); assert.doesNotMatch(r.note, /typical/);
});

test('an Olympic pool uses the current depth rule', () => {
  const r = ask('how long is an olympic pool');
  assert.equal(r.value, '50 m long'); assert.equal(links(r), JSON.stringify([WA, AP])); assert.equal(r.read, '2026-10-30');
  assert.equal(10 * 2.5, 25); assert.equal(50 * 25 * 2.5 * 1000, 3125000);
  assert.match(r.note, /at least 25 m wide/); assert.match(r.note, /at least 2\.5 m deep \(3 m is best\)/); assert.match(r.note, /3,125,000 liters/);
  assert.doesNotMatch(r.note, /2,500,000|at least 2 m deep/);
});

test('a basketball hoop is 10 ft by the NBA and FIBA rules', () => {
  const r = ask('how tall is a basketball hoop');
  assert.equal(r.value, '10 ft (3.05 m)'); assert.equal(links(r), JSON.stringify([NBA, FIBA])); assert.equal(r.read, '2026-10-30');
  assert.equal(Math.round(10 * 0.3048 * 100) / 100, 3.05); assert.match(r.note, /3,050 mm \(± 6 mm\)/);
});
