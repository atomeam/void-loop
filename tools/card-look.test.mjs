// Style inheritance for cards (lib/card-look.js; asked by Void): the family decides the frame. Run: node --test tools/card-look.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lookOfFamily, lookOfSkill, LOOK_CSS, LOOKS } from '../void-live-deploy/lib/card-look.js';
import { FAMILIES } from '../void-live-deploy/lib/art-rules.js';
import { CARD_CSS } from '../void-live-deploy/lib/card-frame.js';

const fam = JSON.parse(readFileSync(new URL('../void-live-deploy/skills/families.json', import.meta.url), 'utf8'));

test('sky and earth are organic, numbers and money are blueprint, every other family keeps the plain frame', () => {
  assert.ok(Object.keys(LOOKS).every((k) => FAMILIES.includes(k)), 'the looks are named by the Art Forge families');
  assert.equal(lookOfFamily(fam, 'sky'), 'organic'); assert.equal(lookOfFamily(fam, 'Sky and earth'), 'organic');
  assert.equal(lookOfFamily(fam, 'numbers'), 'blueprint'); assert.equal(lookOfFamily(fam, 'Numbers and money'), 'blueprint');
  for (const id of ['make', 'games', 'time', 'body', 'words', 'life', 'stage', 'self']) assert.equal(lookOfFamily(fam, id), '', id);
  assert.equal(lookOfFamily(null, 'Sky and earth'), 'organic', 'a name still works without the file');
  assert.equal(lookOfFamily(fam, ''), '');
});

test('a skill takes the look of the family that lists it', () => {
  assert.equal(lookOfSkill(fam, 'calc'), 'blueprint'); assert.equal(lookOfSkill(fam, 'tip'), 'blueprint');
  assert.equal(lookOfSkill(fam, 'eclipse'), 'organic'); assert.equal(lookOfSkill(fam, 'clock'), '');
  assert.equal(lookOfSkill(fam, 'no-such-skill'), ''); assert.equal(lookOfSkill(null, 'calc'), '');
});

test('the look is CSS only: a data attribute, a grid for blueprint, mist for organic, no script and no network', () => {
  assert.match(LOOK_CSS, /\[data-look=blueprint\]/); assert.match(LOOK_CSS, /\[data-look=organic\]/);
  assert.match(LOOK_CSS, /linear-gradient\(rgba\(120,190,255,\.16\) 1px/); assert.match(LOOK_CSS, /radial-gradient\(ellipse/);
  assert.ok(!/url\(|@import|<script/.test(LOOK_CSS)); assert.ok(CARD_CSS.includes(LOOK_CSS), 'the card stylesheet carries it');
});
