// Are the /fix/ pages lowering friction? (asked by Verse). node --test tools/fix-friction.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict';
import { frictionOf, shipsOf, compareShip, report } from './fix-friction.mjs';
const ROWS = [{ at: '2026-10-16T17:00:00Z', facts: { failing: 9, unsure: 52, skills: 160 } }, { at: '2026-10-17T11:00:00Z', facts: { failing: 9, unsure: 65, skills: 181 } }, { at: '2026-10-18T11:00:00Z', facts: { failing: 7, unsure: 104, skills: 294 } }, { at: '2026-10-19T14:00:00Z', facts: { failing: 7, unsure: 84, skills: 302 } }, { at: '2026-10-19T15:00:00Z' }];
test('friction is lib/better.js\'s formula', () => { assert.equal(frictionOf(ROWS[0].facts), 78); assert.equal(frictionOf(ROWS[3].facts), 84); assert.equal(frictionOf({ skills: 0 }), null); assert.equal(frictionOf(null), null); });
test('ships come from git log, one per commit, only fix pages, oldest first', () => {
  const s = shipsOf('@2026-10-18T08:44:14+00:00\n\nvoid-live-deploy/fix/a/index.html\nvoid-live-deploy/fix/b/index.html\n@2026-10-11T23:03:31+00:00\n\nvoid-live-deploy/fix/c/index.html\n@2026-10-12T00:00:00Z\nREADME.md\n');
  assert.deepEqual(s, [{ at: '2026-10-11T23:03:31.000Z', pages: ['c'] }, { at: '2026-10-18T08:44:14.000Z', pages: ['a', 'b'] }]);
});
test('a ship is split into what moved: failing, barely checked, and the bigger skill count; pages that are not skills are said to be outside the score', () => {
  const c = compareShip({ at: '2026-10-18T08:44:14.000Z', pages: ['a', 'b'] }, ROWS, ['chess']);
  assert.deepEqual([c.friction.before, c.friction.after, c.delta], [77, 84, 7]); assert.deepEqual(c.parts, { failing: -2, unsure: 19, skills: 121, fromCounts: -4, fromSkillCount: 11 });
  assert.match(c.verdict, /2 fewer failing, 19 more barely checked, 121 more skills counted\. With the skill count held at 181 it would be 73, so \+11 of the change is only the bigger count\. None of the 2 \/fix\/ pages is a skill/);
  assert.match(compareShip({ at: '2026-10-11T00:00:00.000Z', pages: ['c'] }, ROWS).verdict, /No friction measure before this ship \(the daily measure starts 2026-10-16\)/);
  assert.match(compareShip({ at: '2026-10-20T00:00:00.000Z', pages: ['c'] }, ROWS).verdict, /No friction measure after/);
  assert.equal(compareShip({ at: '2026-10-18T08:44:14.000Z', pages: ['chess', 'b'] }, ROWS, ['chess']).pagesAsSkills, 1);
});
test('the answer says plainly it is not shown either way when no page is in the score, and when nothing can be compared', () => {
  const r = report([{ at: '2026-10-11T00:00:00.000Z', pages: ['c'] }, { at: '2026-10-18T08:44:14.000Z', pages: ['a'] }], ROWS);
  assert.match(r.answer, /^Not shown either way\. .*\+7 around 2026-10-18, \+11 of it from a bigger skill count/); assert.equal(r.ships.length, 2);
  assert.equal(report([{ at: '2026-10-11T00:00:00.000Z', pages: ['c'] }], ROWS).answer, 'No /fix/ ship has a friction measure on both sides yet.');
});
