// nightsky inside the time family (skills/time.js, lists run 6, 2026-10-28): sky and nightsky both took "show me the sky" and "sky tonight"
// (tools/skill-overlap.mjs), so the sky world joined the family right after the sky card. Every old ask still reaches the member that
// answered it before, and "nightsky" stays a part (alias). Run: node --test tools/sky-world-family.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import fam from '../void-live-deploy/skills/time.js';
import sky from '../void-live-deploy/skills/sky.js';
import nightsky from '../void-live-deploy/skills/night-sky.js';

test('the asks both took stay on the sky card, the world keeps its own', () => {
  for (const a of ['show me the sky', 'sky tonight']) { assert.ok(sky.match(a, a) && nightsky.match(a, a), 'both took: ' + a); assert.equal(fam.part(a, a), 'sky', a); }
  for (const a of nightsky.examples) assert.equal(fam.part(a.toLowerCase(), a), 'nightsky', a);
  assert.equal(fam.part('hide the sky', 'hide the sky'), 'nightsky');
});
test('nightsky is a part of time, right after sky, and no longer its own entry', () => {
  assert.ok(fam.parts.includes('nightsky'));
  assert.equal(fam.parts.indexOf('nightsky'), fam.parts.indexOf('sky') + 1);
  const index = JSON.parse(readFileSync(new URL('../void-live-deploy/skills/index.json', import.meta.url), 'utf8'));
  assert.ok(index.includes('time') && !index.includes('night-sky'));
  assert.ok(!existsSync(new URL('../void-live-deploy/skills/order/0995-night-sky', import.meta.url)));
});
test('the world still runs through the family', () => {
  assert.equal(typeof fam.member('hide the sky', 'hide the sky').run, 'function');
});
