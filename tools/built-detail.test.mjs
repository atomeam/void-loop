// every built / improved line names the specific thing and what changed (owner, 2026-10-21: "never vague categories"), and the
// self card's per-skill view is read from the real ledger (lib/built-detail.js)
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
import { builtByFamily, specific, builtDetailHtml } from '../void-live-deploy/lib/built-detail.js';
const ledger = JSON.parse(fs.readFileSync(new URL('../void-live-deploy/void.growth.json', import.meta.url)));
const fam = JSON.parse(fs.readFileSync(new URL('../void-live-deploy/skills/families.json', import.meta.url)));
test('vague lines are refused', () => {
  assert.equal(specific('Sky and earth +1'), false); assert.equal(specific('3 skills improved'), false);
  assert.equal(specific('weather card: now shows the hourly forecast for the next day'), true);
});
test('every ledger line from 2026-10-22 on is specific', () => {
  const bad = ledger.filter((e) => e && String(e.at) >= '2026-10-22' && !specific(e.what));
  assert.deepEqual(bad.map((e) => e.at + ' ' + e.what), []);
});
test('the per-skill view comes from the ledger, whole lines, no ellipsis', () => {
  const r = builtByFamily(ledger, fam); assert.ok(r.families.length >= 5);
  const h = builtDetailHtml(r); assert.ok(h.includes('data-sec="built-detail"')); assert.ok(!/\u2026<\/li>/.test(h));
});

test('under each skill, a batch of new phrases lists only the phrases that open that skill', () => {
  const fam = { families: [{ id: 'make', name: 'Making things', skills: [{ name: 'gradient' }, { name: 'wheel' }] }] };
  const led = [{ at: '2026-10-24T16:00:00Z', kind: 'grow', what: 'Verse hardened itself: 2 benchmark ask(s) for gradient, wheel.', phrases: [{ ask: 'css gradient', skill: 'gradient' }, { ask: 'spin the wheel', skill: 'wheel' }] }];
  const r = builtByFamily(led, fam), by = Object.fromEntries(r.families[0].skills.map((s) => [s.name, s.items[0].what]));
  assert.equal(by.gradient, 'New phrases: “css gradient” now opens gradient');
  assert.equal(by.wheel, 'New phrases: “spin the wheel” now opens wheel');
});
test('a probe route with no check on its answer is not listed as built; it is counted once in a note', () => {
  const fam = { families: [{ id: 'sky', name: 'Sky and earth', skills: [{ name: 'flights' }] }] };
  const led = [
    { at: '2026-10-31T01:21:43Z', kind: 'fix', what: 'Verse routes "london to sydney flight" to its flights skill (the answer is not checked) (from my probes)' },
    { at: '2026-10-30T19:46:31Z', kind: 'fix', what: 'Verse routes "flight status nyc to lon" to its flights skill (the answer is not checked) (from my probes)' },
    { at: '2026-10-30T10:00:00Z', kind: 'build', what: 'the flights skill now shows the flight time between two cities' }];
  const r = builtByFamily(led, fam);
  assert.equal(r.total, 1); assert.equal(r.unchecked, 2);
  assert.deepEqual(r.families[0].skills[0].items.map((i) => i.what), ['the flights skill now shows the flight time between two cities']);
  const h = builtDetailHtml(r);
  assert.ok(!h.includes('the answer is not checked')); assert.ok(h.includes('Left out: 2 probe lines'));
  // the real ledger: none of its unchecked routes reach the list
  const real = builtDetailHtml(builtByFamily(ledger, JSON.parse(fs.readFileSync(new URL('../void-live-deploy/skills/families.json', import.meta.url)))));
  assert.ok(!real.includes('(the answer is not checked)'));
});
