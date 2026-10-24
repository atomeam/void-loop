// tools/tower-gate.mjs and tools/tower-probes.mjs: the scores behind the aspects the gate measures, and the probes' answers worked out by hand
import test from 'node:test';
import assert from 'node:assert/strict';
import { verdict, rescore, germanScore, sharingScore, MEASURES, UA } from './tower-gate.mjs';
import { probeFor, score, PROBES } from './tower-probes.mjs';
import { FLOORS, aspectsOf } from '../void-live-deploy/lib/tower.js';

test('the gate presents as an ordinary browser, not a headless one', () => { assert.doesNotMatch(UA, /headless/i); assert.match(UA, /Chrome\/\d+/); });
test('local language: a German browser gets German when the page says so or speaks it', () => {
  assert.equal(germanScore('de-DE', ''), 1); assert.equal(germanScore('en', 'Ist heute Weihnachten? Nein, und morgen ist es nicht.'), 1);
  assert.equal(germanScore('en', 'Is it Christmas? No, and not tomorrow either.'), 0); assert.equal(germanScore('', 'Die'), 0, 'one word is not a language');
});
test('sharing: title, image, description and a share control, one each', () => {
  assert.equal(sharingScore({ ogTitle: true, ogImage: true, desc: true, control: true }), 4); assert.equal(sharingScore({}), 0); assert.equal(sharingScore({ desc: true }), 1);
});
test('verdicts for the new aspects: the ideal tie passes, a lower count loses, accuracy and completeness tie only at full marks', () => {
  assert.equal(verdict(1, 1, MEASURES.offline.hi, MEASURES.offline.ideal), 'equal-and-better'); assert.equal(verdict(0, 0, MEASURES.offline.hi, MEASURES.offline.ideal), 'equal');
  assert.equal(verdict(3, 4, MEASURES.sharing.hi, MEASURES.sharing.ideal), 'worse'); assert.equal(verdict(48, 30, MEASURES['big answer'].hi), 'better');
  const rows = rescore({ accuracy: { verdict: 'x', verse: 4, best: 4, of: 4 }, completeness: { verdict: 'x', verse: 9, best: 9, of: 13 } });
  assert.equal(rows.accuracy.verdict, 'equal-and-better'); assert.equal(rows.completeness.verdict, 'equal', 'both missing the same things is not beaten');
});
test('the colour probe: #ff5733 by hand, and a page that shows it passes every truth', () => {
  const p = probeFor('colour'), page = 'HEX #FF5733 RGB rgb(255, 87, 51) HSL hsl(11, 100%, 60%) CMYK 0%, 66%, 80%, 0% shades tints tones complementary triadic analogous contrast HSV lab nearest name tomato';
  assert.equal(score(page, p.truth).n, 4); assert.equal(score(page, p.facts).n, p.facts.length);
  const wrong = score('rgb(255, 88, 51) hsl(11, 100%, 61%) cmyk 0 65 80 0', p.truth); assert.equal(wrong.n, 0, 'a near miss is a miss: ' + wrong.has.join());
  assert.equal(probeFor('colour codes').facts.length, p.facts.length); assert.equal(probeFor('colour codes').site, 'https://hexcolor16.com/ff5733');
});
test('is it: the right answer depends on the day', () => {
  const t = probeFor('is it').truth; assert.equal(t.length, 1);
  const dec25 = new Date().getUTCMonth() === 11 && new Date().getUTCDate() === 25; assert.equal(score(dec25 ? 'YES' : 'NO', t).n, 1); assert.equal(score(dec25 ? 'NO' : 'YES', t).n, 0);
});
test('a probe exists only for a floor on the tower, and floors with no fair question leave accuracy unverified', () => {
  for (const id of Object.keys(PROBES)) assert.ok(FLOORS.some((f) => f.id === id), id);
  for (const id of ['coin flip', 'random number', 'base converter']) assert.equal(probeFor(id).truth, null, id);
  assert.equal(probeFor('weather'), null);
  for (const f of FLOORS) assert.ok(aspectsOf(f).includes('offline') && aspectsOf(f).includes('sharing'), f.id);
});
