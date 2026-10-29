import assert from 'node:assert/strict';
import { gapFiles, testFiles, buildGap, slug, title } from './store-gap.mjs';
const long = 'Start by listing what you need. '.repeat(10);
const ask = async () => long;
assert.equal(slug('Logo Design!'), 'logo-design'); assert.equal(title('logo-design'), 'Verse Logo Design Starter Kit');
const files = await gapFiles('logo-design', ask);
assert.equal(files.length, 4); assert.ok(testFiles(files).ok);
assert.ok(!testFiles(await gapFiles('x', async () => 'too short')).ok, 'thin content is not sold');
assert.match(testFiles(await gapFiles('x', async () => long + ' Use Minecraft skins.')).problems.join(), /trademark/);
const fakeKey = 'ghp_' + 'Q7m2Xr9LpT4vW8sK1nB6cY3hJ5dF0gZaEuRi'; // secret-scan: ok
assert.match(testFiles(await gapFiles('x', async () => long + ' token ' + fakeKey)).problems.join(), /key/);
const cat = { products: [{ id: 'a', name: 'A', cents: 900 }, { id: 'b', name: 'B', cents: 1900 }] };
const r = await buildGap('logo-design', { ask, dry: true, catalog: cat, asks: 4 });
assert.equal(r.id, 'v01d-logo-design-kit'); assert.ok(r.appraisal.cents >= 100); assert.match(r.appraisal.note, /^Why \$/); assert.match(r.appraisal.note, /asked for 4 times/);
assert.equal(r.row.status, 'live'); assert.equal(r.row.pwyw, true);
assert.deepEqual(await buildGap('logo-design', { ask, catalog: { products: [{ id: 'v01d-logo-design-kit' }] } }), { skipped: 'already in the store', id: 'v01d-logo-design-kit' });
console.log('store-gap: ok (files tested, trademarks/keys/thin content stopped, appraised, dedupe)');
