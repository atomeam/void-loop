// The stage-out family (skills/stage-out.js, lists run 4, 2026-10-21): stage-print and stage-export are one routing entry, each old
// ask still reaches the member that answered it before, and both old names stay as parts (aliases). Run: node --test tools/stage-out-family.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import fam from '../void-live-deploy/skills/stage-out.js';
import stagePrint from "../void-live-deploy/skills/stage-print.js";
import stageExport from "../void-live-deploy/skills/stage-export.js";

const before = (a) => (stagePrint.match(a.toLowerCase(), a) ? 'stage-print' : stageExport.match(a.toLowerCase(), a) ? 'stage-export' : null); // the old order: 1490, then 1665
test('every example of both old skills lands on the same member as before the merge', () => {
  const asks = [...(stagePrint.examples || []), ...(stageExport.examples || []), 'print the stage', 'print the stage on letter paper', 'export my stage as text'];
  assert.ok(asks.length >= 6);
  for (const a of asks) { assert.equal(fam.part(a.toLowerCase(), a), before(a), a); assert.ok(before(a), 'still answered: ' + a); }
});
test('the old names are kept as parts, the family takes one place in the index and the order, the members left both', () => {
  assert.deepEqual(fam.parts, ['stage-print', 'stage-export']);
  const index = JSON.parse(readFileSync(new URL('../void-live-deploy/skills/index.json', import.meta.url), 'utf8'));
  assert.ok(index.includes('stage-out')); assert.ok(!index.includes('stage-print') && !index.includes('stage-export'));
  assert.ok(existsSync(new URL('../void-live-deploy/skills/order/1490-stage-out', import.meta.url)));
  assert.ok(!existsSync(new URL('../void-live-deploy/skills/order/1665-stage-export', import.meta.url)));
});
test('near misses of either member still miss the family', () => {
  for (const a of fam.nearMisses) assert.equal(fam.match(a.toLowerCase(), a), false, a);
});
