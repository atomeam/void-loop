// Speed of sound, bulb lumens and drink sizes carry their source (2026-10-30). Before, "speed of sound" said "about 1,480 m/s" in water
// and "how many lumens is a 60 watt bulb" said "LED equivalents use about 8–10 W", with no link and nothing behind either number. The
// sound figures are The Physics Factbook (343 m/s at 20 °C, 331.5 + 0.60 T; 1,450 to 1,498 m/s in water), the lumens Energy Saver's
// "Buy Lumens, Not Watts" (450, 800, 1,100, 1,600 for 40, 60, 75, 100 W; it gives no LED wattage) and the drink sizes NIAAA's standard
// drink (1.5 fl oz of spirits, 5 fl oz of wine), all read 2026-10-30. The counts per bottle are worked out here from those sizes.
import test from 'node:test'; import assert from 'node:assert/strict'; import { load } from './word-math.mjs';
const W = load(), ask = (a) => W.wordMath(a.toLowerCase());
const AIR = 'https://hypertextbook.com/facts/2000/CheukWong.shtml', WATER = 'https://hypertextbook.com/facts/2000/NickyDu.shtml';
const LUMENS = 'https://www.energy.gov/node/380665', NIAAA = 'https://www.niaaa.nih.gov/alcohols-effects-health/what-standard-drink';
const FL_OZ_ML = 29.5735295625;

test('the speed of sound is the Factbook figure, with its water range and both links', () => {
  const r = ask('speed of sound');
  assert.equal(r.value, '343 m/s'); assert.equal(331.5 + 0.60 * 20, 343.5);
  assert.match(r.note, /767 mph/); assert.equal(Math.round(343 / 0.44704), 767);
  assert.match(r.note, /1,450–1,500 m\/s in water/); assert.doesNotMatch(r.note, /1,480/);
  assert.equal(JSON.stringify(r.src.map((s) => s[1])), JSON.stringify([AIR, WATER])); assert.equal(r.read, '2026-10-30');
  const mph = ask('speed of sound in mph'); assert.equal(mph.value, '767 mph'); assert.equal(mph.src[0][1], AIR); assert.equal(mph.read, '2026-10-30');
  assert.equal(ask('speed of light in mph').src, undefined);
});

test('bulb lumens are the Energy Saver rows, and no LED wattage is claimed', () => {
  const s = ask('how many lumens is a 60 watt bulb'), b = ask('how many lumens is a 100 watt bulb');
  assert.equal(s.value, '800 lumens'); assert.equal(b.value, '1,600 lumens');
  for (const r of [s, b]) { assert.equal(r.src[0][1], LUMENS); assert.equal(r.read, '2026-10-30'); assert.doesNotMatch(r.note, /LED|uses about/); }
  assert.match(s.note, /40 W ≈ 450, 75 W ≈ 1,100, 100 W ≈ 1,600/);
});

test('bottle counts follow from the NIAAA serving sizes', () => {
  const shots = ask('how many shots in a bottle'), wine = ask('how many ml in a wine bottle');
  assert.equal(shots.value, 'about 17'); assert.equal(Math.round(750 / (1.5 * FL_OZ_ML)), 17); assert.equal(Math.round(1750 / (1.5 * FL_OZ_ML)), 39);
  assert.equal(wine.value, '750 ml'); assert.equal(Math.round(750 / (5 * FL_OZ_ML)), 5);
  for (const r of [shots, wine]) { assert.equal(r.src[0][1], NIAAA); assert.equal(r.read, '2026-10-30'); }
});

test('the King Arthur facts keep their own read date', () => {
  const r = ask('how many grams of sugar are in a teaspoon'); assert.equal(r.src[0][1], 'https://www.kingarthurbaking.com/learn/ingredient-weight-chart'); assert.equal(r.read, '2026-10-30');
});
