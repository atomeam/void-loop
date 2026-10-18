// tools/private.mjs + tools/public-ledger.mjs: what Verse studies stays off the site (the owner, 2026-10-13)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { privateFree, isPrivate } from './private.mjs';
import { publicLedger } from './public-ledger.mjs';

// a line about the study itself is not shown at all
assert.equal(privateFree('A second target, Candy.ai (the owner is studying it): its creator recorded'), '');
assert.equal(privateFree('Targets, and Verse\'s first one: Verse sets its sights on one site at a time.'), '');
// a feature line keeps the feature and loses the aside that names the product
assert.equal(privateFree('Draw: layers you talk to (ibisPaint target, layers): hide, show. Done.'), 'Draw: layers you talk to: hide, show. Done.');
assert.equal(privateFree('Draw learns your hand. ibisPaint X target: stabilizer beaten (1 of 8). Also, the review is quieter.'), 'Draw learns your hand. Also, the review is quieter.');
// ordinary lines are untouched, including ordinary uses of "target"
for (const s of ['A deploy target named main', 'candy colours on a skin', 'Weather in Tokyo'] ) { assert.equal(isPrivate(s), false, s); assert.equal(privateFree(s), s); }

// the real ledger, as the site would serve it: nothing names what Verse studies
const served = publicLedger(JSON.parse(readFileSync(new URL('../void-live-deploy/void.growth.json', import.meta.url), 'utf8')));
const leaks = served.filter((e) => isPrivate(JSON.stringify(e)) || /candy|ibis ?paint|elevenessee/i.test(JSON.stringify(e)));
assert.deepEqual(leaks.map((e) => e.at), [], 'served ledger lines that name what Verse studies');
assert.ok(served.length > 400);
// nothing served names the list either: the filter itself is not in the site folder
assert.throws(() => readFileSync(new URL('../void-live-deploy/lib/private.js', import.meta.url)));
console.log('private: all passed');
