// tools/targets.mjs: a target's score counts only what Verse beats; every feature carries its plus one before the build
import assert from 'node:assert/strict';
import { scoreOf, problems, load } from './targets.mjs';
const t = { site: 'X', features: [{ id: 'a', theirs: 'A', plus_one: 'A+1', void: 'beats' }, { id: 'b', theirs: 'B', plus_one: 'B+1', void: 'none' }, { id: 'c', theirs: 'C', plus_one: 'C+1', void: 'matches' }] };
const s = scoreOf(t);
assert.deepEqual([s.total, s.beats, s.matches, s.none, s.done, s.next.id], [3, 1, 1, 1, false, 'c']); // a match is finished before a new feature starts
assert.equal(scoreOf({ site: 'Y', features: [{ id: 'a', theirs: 'A', plus_one: 'A+1', void: 'beats' }] }).done, true);
assert.deepEqual(problems(t), []);
assert.ok(problems({ site: 'Z', features: [{ id: 'q', theirs: 'Q', void: 'beats' }] }).some((p) => /plus one/.test(p))); // no plus one: not a target, a copy
assert.ok(problems({ site: 'Z', features: [{ id: 'q', theirs: 'Q', plus_one: 'Q+1', void: 'copied' }] }).some((p) => /void must be/.test(p)));
// the targets in the repo are well formed
for (const tg of load()) assert.deepEqual(problems(tg), [], tg.file);
// a target measured by its controls (the tower ranks sites by interactive elements on the home page): the sections add up to the total
for (const tg of load()) for (const k of ['home', 'archiveHome']) if (tg[k]) {
  assert.equal(tg[k].sections.reduce((n, x) => n + x.count, 0), tg[k].total, tg.file + ' ' + k + ' sections');
  assert.equal(Object.values(tg[k].byKind).reduce((n, x) => n + x, 0), tg[k].total, tg.file + ' ' + k + ' kinds');
}
assert.equal(load().find((tg) => tg.site === 'sycophanthex.com').home.total, 34);
console.log('targets: all passed');
