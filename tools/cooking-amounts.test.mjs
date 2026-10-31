// Rice, coffee and meat amounts carry their source (2026-10-30). Before, "rice to water ratio" said jasmine and basmati take 1 : 1½ and
// brown rice 1 : 2½, "how many cups of coffee in a pound" said "about 48" and "meat per person" said ½ lb, with no link and nothing behind
// any of them. USA Rice gives 2 parts water to 1 of long-grain white, jasmine and basmati, 1½ for medium grain, 1¼ for short grain and
// 2¼ for brown and parboiled, with 1 cup dry = 3 cups cooked at about 7 oz a cup; MSU Extension gives the MyPlate ½ cup cooked serving;
// the National Coffee Association gives 1 to 2 tablespoons per 6 oz of water and no cups per pound; CSU Extension gives ¾ lb boneless
// and 1 to 1½ lb bone-in per person. All read 2026-10-30. The gram figures are worked out here from those sizes.
import test from 'node:test'; import assert from 'node:assert/strict'; import { load } from './word-math.mjs';
const W = load(), ask = (a) => W.wordMath(a.toLowerCase()), links = (r) => JSON.stringify(r.src.map((s) => s[1]));
const RICE = 'https://www.usarice.com/thinkrice/how-to/how-to-cook-rice';
const MSU = 'https://www.montana.edu/extension/buyeatlivebetter/other_nep_resources/fact_sheets/servingsizes/Factsheet_Serving_Sizes_.pdf';
const NCA = 'https://www.aboutcoffee.org/brewing/drip-coffee/', CSU = 'https://extension.colostate.edu/resource/holiday-meat-safety/';
const OZ_G = 28.349523125, LB_G = 453.59237;

test('the rice ratios are the USA Rice chart, not the old jasmine and brown figures', () => {
  const r = ask('rice to water ratio');
  assert.equal(r.value, '1 : 2'); assert.equal(links(r), JSON.stringify([RICE])); assert.equal(r.read, '2026-10-30');
  for (const part of ['jasmine and basmati also 1 : 2', 'medium grain 1 : 1½', 'short grain 1 : 1¼', 'brown and parboiled 1 : 2¼']) assert.ok(r.note.includes(part), part);
  assert.doesNotMatch(r.note, /1 : 2½|about 1 : 1½/);
  assert.equal(ask('how much water for a cup of rice').value, '1 : 2');
});

test('rice per person rests on the USA Rice yield and the MyPlate serving', () => {
  const r = ask('how much rice per person');
  assert.equal(r.value, '¼–½ cup uncooked'); assert.equal(links(r), JSON.stringify([RICE, MSU])); assert.equal(r.read, '2026-10-30');
  assert.equal(Math.round(7 * OZ_G / 4 / 10) * 10, 50); assert.equal(Math.round(7 * OZ_G / 2 / 10) * 10, 100);
  assert.match(r.note, /about 50–100 g dry/); assert.match(r.note, /cooks to ¾–1½ cups/); assert.equal(3 / 4, 0.75); assert.equal(3 / 2, 1.5);
  assert.match(r.note, /serving of cooked rice is ½ cup/); assert.doesNotMatch(r.note, /45–90/);
});

test('coffee gives the NCA ratio and no invented count', () => {
  const r = ask('how many cups of coffee in a pound');
  assert.equal(r.value, '1–2 tbsp per 6 oz'); assert.equal(links(r), JSON.stringify([NCA])); assert.equal(r.read, '2026-10-30');
  assert.doesNotMatch(r.value + r.note, /48/); assert.match(r.note, /not a count/);
});

test('meat per person is the CSU Extension amount', () => {
  const r = ask('how many pounds of meat per person');
  assert.equal(r.value, '¾ lb boneless'); assert.equal(links(r), JSON.stringify([CSU])); assert.equal(r.read, '2026-10-30');
  assert.equal(Math.round(0.75 * LB_G / 10) * 10, 340); assert.match(r.note, /about 340 g/); assert.match(r.note, /1–1½ lb for a whole bird or a bone-in roast or ham/);
  assert.doesNotMatch(r.note, /225 g/);
  assert.equal(ask('how much meat per person').value, '¾ lb boneless');
});
