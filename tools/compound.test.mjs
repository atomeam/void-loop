// The compounding pass (lib/compound.js, tools/tower-compound.mjs): who still wins, who goes back, new features as must-beat items, the owner row.
import test from 'node:test';
import assert from 'node:assert/strict';
import { countedIds, recheck, jobsOf, front, namesOf, newFeatures, openFeatures, relatedTo, rowOf, sayRow } from '../void-live-deploy/lib/compound.js';
import { compoundHtml } from '../void-live-deploy/versus/universe.js';
import { advance } from './tower-target.mjs';
import { apply as applyPass } from './tower-compound.mjs';
import { ownerOnlyPath } from '../void-live-deploy/lib/owner-gate.js';

const floors = [{ id: 'a', beaten: true, gateBeaten: true }, { id: 'b', gateBeaten: false, lost: ['speed'], open: ['journey: share'] }, { id: 'c', gateBeaten: true, beaten: false }, { id: 'n', n: 1, m: 5 }];
const file = (...fs) => ({ sites: { 'x.com': { features: fs.map(([name, verse]) => ({ name, verse })) } } });
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

test('counted ids: assimilated, passed and gate-beaten, once each', () => {
  assert.deepEqual(countedIds({ assimilated: [{ id: 'a' }], passed: [{ id: 'b' }, { id: 'a' }] }, floors), ['a', 'b', 'c']);
});
test('a counted floor that lost a check goes back with the failed checks; one that is gone is retired, not sent back', () => {
  const r = recheck(['a', 'b', 'c', 'gone'], floors);
  assert.equal(r.checked, 4); assert.deepEqual(r.won, ['a', 'c']); assert.deepEqual(r.retired, ['gone']);
  assert.deepEqual(r.requeued, [{ id: 'b', failed: ['speed', 'journey: share'], features: [] }]);
});
test('a new feature Verse lacks stops the floor counting until Verse has it', () => {
  assert.deepEqual(recheck(['a'], floors, { a: ['live map'] }).requeued.map((r) => r.id), ['a']);
  assert.deepEqual(recheck(['a'], floors, {}).won, ['a']);
});
test('the feature diff against the last record, by name, case and punctuation aside', () => {
  const before = file(['Live map', 'has'], ['Price alerts', 'missing']), after = file(['live  map!', 'has'], ['Price alerts', 'missing'], ['Fare calendar', 'missing'], ['Dark mode', 'has']);
  assert.deepEqual(newFeatures(before, after), [{ name: 'Fare calendar', verse: 'missing' }, { name: 'Dark mode', verse: 'has' }]);
  assert.deepEqual(openFeatures(after), ['Price alerts', 'Fare calendar']);
  assert.equal(namesOf(null).size, 0);
});
test('a feature Verse adds is re-scored on every related original: the files that list it', () => {
  assert.deepEqual(relatedTo('Live Map', { f1: file(['live map', 'has']), f2: file(['other', 'has']), f3: file(['LIVE MAP', 'missing']) }), ['f1', 'f3']);
});
test('build jobs: failed checks and features first, nothing twice', () => {
  const j = jobsOf([{ id: 'b', failed: ['speed'], features: ['live map'] }], '2026-11-19');
  assert.deepEqual(j.map((x) => x.aspect), ['speed', 'feature: live map']); assert.match(j[1].job, /^must-beat/);
  assert.deepEqual(front([{ id: 'b', aspect: 'speed' }, { id: 'z', aspect: 'q' }], j).map((x) => x.aspect), ['speed', 'feature: live map', 'q']);
});
test('the row and its plain words', () => {
  const row = rowOf({ at: '2026-11-19', result: recheck(['a', 'b'], floors), found: { b: ['live map'] }, beaten: [{ id: 'a', feature: 'x' }] });
  assert.deepEqual([row.checked, row.stillWin, row.requeued.length, row.newFeatures.length, row.featuresBeaten.length], [2, 1, 1, 1, 1]);
  assert.match(sayRow(row), /Re-checked 2 that counted: 1 still win, 1 sent back .* 1 new feature found on originals, 1 beaten\./);
  assert.match(sayRow(null), /No re-check yet/);
});
test('a pass takes the floors off the counted lists, puts them first on the build list and in the requeue', () => {
  const result = recheck(['b', 'a'], floors, {});
  const out = applyPass({ target: { id: 'n', assimilated: [{ id: 'a' }, { id: 'b' }], passed: [{ id: 'b' }], background: [{ id: 'z', aspect: 'q' }] }, compound: null, result, found: {}, blockers: {}, beaten: [], universe: { targets: 3, counted: 0 }, today: '2026-11-19' });
  assert.deepEqual(out.target.assimilated, [{ id: 'a' }]); assert.deepEqual(out.target.passed, []); assert.deepEqual(out.target.requeue, ['b']);
  assert.equal(out.target.background[0].id, 'b'); assert.equal(out.compound.rows.length, 1); assert.equal(out.compound.last.universe.targets, 3);
});
test('a requeued floor comes ahead of the target in progress and of every new target', () => {
  const fl = [{ id: 'cur', n: 1, m: 5, state: 'current' }, { id: 'b', n: 3, m: 5 }, { id: 'next', n: 0, m: 5 }];
  const { file: f } = advance({ id: 'cur', since: '2026-11-19', n: 1, requeue: ['b'] }, fl, '2026-11-19');
  assert.equal(f.id, 'b'); assert.deepEqual(f.requeue, ['b']);
  const done = advance({ id: 'b', since: '2026-11-19', requeue: ['b'] }, [{ id: 'b', beaten: true, gateBeaten: true, n: 5, m: 5 }, { id: 'x', n: 0, m: 5 }], '2026-11-19').file;
  assert.equal(done.requeue, undefined);
});
test('the owner box names what went back; the file is owner-only', () => {
  const html = compoundHtml({ last: rowOf({ at: '2026-11-19', result: recheck(['b'], floors), found: {}, beaten: [] }) }, esc);
  assert.match(html, /Compounding/); assert.match(html, /b: speed; journey: share/); assert.equal(compoundHtml(null, esc), '');
  assert.equal(ownerOnlyPath('/tower.compound.json'), true);
});
